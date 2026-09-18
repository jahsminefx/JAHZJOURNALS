const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { encryptCredential, decryptCredential } = require('../utils/cryptoUtils');
const { provisionCloudAccount, removeCloudAccount, fetchAccountHistory } = require('../services/metaApiService');

const getNum = (val) => {
  if (val === null || val === undefined || val === '' || val === 'null') return null;
  const n = Number(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? null : n;
};

/**
 * Smart Trade Cross-Checking & Match Finder
 * Cross-checks incoming MT trades against user's existing trades
 * Uses Ticket ID match OR Symbol + Direction + Open/Close Time Tolerance Window
 */
const findMatchingTrade = (incoming, existingTrades, timeToleranceMs = 10 * 60 * 1000) => {
  for (const existing of existingTrades) {
    // 1. Direct Ticket ID match
    if (incoming.externalId && existing.externalId && String(incoming.externalId).trim() === String(existing.externalId).trim()) {
      return existing;
    }

    // 2. Pair / Symbol match (e.g. EURUSD, XAUUSD)
    if (!existing.pair || !incoming.pair || String(existing.pair).toUpperCase().trim() !== String(incoming.pair).toUpperCase().trim()) {
      continue;
    }

    // 3. Direction match (BUY vs SELL)
    if (incoming.direction && existing.direction && String(incoming.direction).toUpperCase() !== String(existing.direction).toUpperCase()) {
      continue;
    }

    // 4. Open Time tolerance check (within 10 minutes)
    if (incoming.entryTime && existing.entryTime) {
      const entryDiff = Math.abs(new Date(incoming.entryTime).getTime() - new Date(existing.entryTime).getTime());
      if (entryDiff > timeToleranceMs) {
        continue;
      }
    }

    // 5. Close Time tolerance check if both trades are closed (within 10 minutes)
    if (incoming.exitTime && existing.exitTime) {
      const exitDiff = Math.abs(new Date(incoming.exitTime).getTime() - new Date(existing.exitTime).getTime());
      if (exitDiff > timeToleranceMs) {
        continue;
      }
    }

    // Match found!
    return existing;
  }

  return null;
};

/**
 * Perform Historical Backfill & Smart Cross-Check Sync for Cloud MT Account
 */
const syncAccountTrades = async (accountId) => {
  const account = await prisma.tradingAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.cloudSyncEnabled) {
    return { success: false, importedCount: 0, skippedCount: 0, message: 'Cloud sync is disabled for this account.' };
  }

  // Fetch MT historical deals / trades
  const rawTrades = await fetchAccountHistory(account.cloudAccountId || `dev_cloud_${account.cloudLogin}`);
  if (!rawTrades || rawTrades.length === 0) {
    return { success: true, importedCount: 0, skippedCount: 0, message: 'No trades found in MT account history.' };
  }

  // Fetch existing trades to cross-check
  const existingTrades = await prisma.trade.findMany({
    where: { tradingAccountId: account.id },
  });

  const pendingNewTrades = [];
  const tradesToEnrich = [];
  let skippedCount = 0;

  for (const item of rawTrades) {
    const ticket = String(item.ticket || item.id || item.orderId || '').trim();
    const rawPair = item.symbol || item.pair || item.instrument || '';
    const pair = String(rawPair).toUpperCase().trim();
    if (!pair || pair.length < 2) continue;

    const rawDirection = String(item.type || item.action || '').toLowerCase();
    const direction = rawDirection.includes('buy') || rawDirection === '0'
      ? 'BUY'
      : rawDirection.includes('sell') || rawDirection === '1'
      ? 'SELL'
      : null;

    if (!direction) continue;

    const entryPrice = getNum(item.openPrice || item.entryPrice || item.price);
    const exitPrice = getNum(item.closePrice || item.exitPrice);
    const stopLoss = getNum(item.stopLoss || item.sl);
    const takeProfit = getNum(item.takeProfit || item.tp);
    const lotSize = getNum(item.lots || item.volume || item.size || item.lotSize);
    const profit = getNum(item.profit || item.pnl || item.profitLoss) || 0;
    const swap = getNum(item.swap) || 0;
    const commission = getNum(item.commission) || 0;
    const netProfit = profit + swap + commission;

    const entryTimeRaw = item.openTime || item.entryTime;
    const exitTimeRaw = item.closeTime || item.exitTime;

    const entryTime = entryTimeRaw ? new Date(entryTimeRaw) : new Date();
    const exitTime = exitTimeRaw && exitTimeRaw !== 'null' ? new Date(exitTimeRaw) : null;

    const isClosed = Boolean(exitTime || item.isClosed || exitPrice !== null);
    const status = isClosed ? 'CLOSED' : 'ACTIVE';
    const result = isClosed ? (netProfit > 0 ? 'WIN' : netProfit < 0 ? 'LOSS' : 'BREAKEVEN') : 'OPEN';

    const incomingTrade = {
      tradingAccountId: account.id,
      externalId: ticket || null,
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      initialStopLoss: stopLoss,
      initialTakeProfit: takeProfit,
      exitPrice,
      lotSize,
      profitLossAmount: isClosed ? netProfit : null,
      status,
      result,
      entryTime: !isNaN(entryTime.getTime()) ? entryTime : new Date(),
      exitTime: exitTime && !isNaN(exitTime.getTime()) ? exitTime : null,
      notesBefore: item.comment || 'Auto-Synced from MetaTrader Cloud Account',
    };

    // Cross-check with existing trades in JahzJournals
    const match = findMatchingTrade(incomingTrade, existingTrades);

    if (match) {
      skippedCount++;
      // Check if existing trade needs enrichment (e.g. adding ticket ID or exit details)
      const needsUpdate = (!match.externalId && incomingTrade.externalId) ||
        (incomingTrade.exitPrice !== null && match.exitPrice === null) ||
        (incomingTrade.profitLossAmount !== null && match.profitLossAmount === null);

      if (needsUpdate) {
        tradesToEnrich.push({
          id: match.id,
          data: {
            ...(incomingTrade.externalId && { externalId: incomingTrade.externalId }),
            ...(incomingTrade.exitPrice !== null && { exitPrice: incomingTrade.exitPrice }),
            ...(incomingTrade.profitLossAmount !== null && { profitLossAmount: incomingTrade.profitLossAmount, result: incomingTrade.result, status: incomingTrade.status }),
            ...(incomingTrade.exitTime && { exitTime: incomingTrade.exitTime }),
          },
          pnlDelta: (incomingTrade.profitLossAmount || 0) - (match.profitLossAmount || 0),
        });
      }
    } else {
      // New unique trade -> Add to import list!
      pendingNewTrades.push(incomingTrade);
    }
  }

  if (pendingNewTrades.length === 0 && tradesToEnrich.length === 0) {
    return {
      success: true,
      importedCount: 0,
      skippedCount,
      message: 'All trades from your MetaTrader account are already up to date in JahzJournals.',
    };
  }

  // Transaction: Insert new trades & enrich matched trades & update balance
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (pendingNewTrades.length > 0) {
      await tx.trade.createMany({
        data: pendingNewTrades,
      });
    }

    let netProfitDelta = pendingNewTrades.reduce((sum, t) => {
      if (t.status === 'CLOSED' && typeof t.profitLossAmount === 'number') {
        return sum + t.profitLossAmount;
      }
      return sum;
    }, 0);

    for (const enrich of tradesToEnrich) {
      await tx.trade.update({
        where: { id: enrich.id },
        data: enrich.data,
      });
      if (enrich.pnlDelta !== 0) {
        netProfitDelta += enrich.pnlDelta;
      }
    }

    await tx.tradingAccount.update({
      where: { id: account.id },
      data: {
        cloudLastSyncedAt: now,
        lastSyncedAt: now,
      },
    });
  });

  const { reconcileAccountBalance } = require('../services/accountBalanceService');
  await reconcileAccountBalance(account.id);

  return {
    success: true,
    importedCount: pendingNewTrades.length,
    enrichedCount: tradesToEnrich.length,
    skippedCount,
    message: `Cross-check complete! ${pendingNewTrades.length} new trades added${tradesToEnrich.length > 0 ? `, ${tradesToEnrich.length} existing trades updated` : ''} (${skippedCount} duplicates matched).`,
  };
};

/**
 * Connect Trading Account via MetaTrader Investor (Viewer) Password Cloud Sync
 * POST /api/accounts/:id/cloud-sync/connect
 */
const connectCloudSync = async (req, res) => {
  try {
    const accountId = req.params.id;
    const { platform, server, login, investorPassword } = req.body;

    if (!platform || !server || !login || !investorPassword) {
      return res.status(400).json({ message: 'Platform, broker server, account login, and investor password are required.' });
    }

    // Verify account ownership
    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    const cleanServer = String(server).trim();
    const cleanLogin = String(login).trim();
    const cleanPassword = String(investorPassword).trim();
    const cleanPlatform = String(platform).toUpperCase().trim();

    // Provision cloud account instance
    const provisionResult = await provisionCloudAccount({
      platform: cleanPlatform,
      server: cleanServer,
      login: cleanLogin,
      password: cleanPassword,
      accountName: `${account.name} (JahzJournal)`,
    });

    // Encrypt password for secure storage
    const encryptedPassword = encryptCredential(cleanPassword);

    await prisma.tradingAccount.update({
      where: { id: accountId },
      data: {
        platform: cleanPlatform,
        brokerName: cleanServer.split('-')[0] || cleanServer,
        cloudSyncEnabled: true,
        cloudSyncStatus: provisionResult.status || 'CONNECTED',
        cloudServer: cleanServer,
        cloudLogin: cleanLogin,
        cloudInvestorPassword: encryptedPassword,
        cloudAccountId: provisionResult.cloudAccountId,
        cloudLastSyncedAt: new Date(),
        cloudError: null,
      },
    });

    // Perform initial historical backfill & smart cross-check sync immediately!
    const syncResult = await syncAccountTrades(accountId);

    return res.status(200).json({
      success: true,
      message: `Cloud MT sync connected successfully! ${syncResult.message}`,
      cloudSyncStatus: 'CONNECTED',
      cloudServer: cleanServer,
      cloudLogin: cleanLogin,
      importedCount: syncResult.importedCount,
      enrichedCount: syncResult.enrichedCount,
      skippedCount: syncResult.skippedCount,
    });
  } catch (error) {
    console.error('Error connecting Cloud MT Sync:', error);
    return res.status(500).json({
      message: error.message || 'Failed to connect Cloud MT Sync. Please check your broker server and investor password.',
    });
  }
};

/**
 * Trigger Manual Sync & Backfill Now
 * POST /api/accounts/:id/cloud-sync/sync-now
 */
const syncCloudTradesNow = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    const syncResult = await syncAccountTrades(accountId);

    return res.status(200).json(syncResult);
  } catch (error) {
    console.error('Error triggering manual Cloud MT Sync:', error);
    return res.status(500).json({ message: 'Failed to sync trades from MetaTrader.' });
  }
};

/**
 * Disconnect Cloud MetaTrader Sync
 * DELETE /api/accounts/:id/cloud-sync/disconnect
 */
const disconnectCloudSync = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    if (account.cloudAccountId) {
      await removeCloudAccount(account.cloudAccountId);
    }

    const updatedAccount = await prisma.tradingAccount.update({
      where: { id: accountId },
      data: {
        cloudSyncEnabled: false,
        cloudSyncStatus: 'DISCONNECTED',
        cloudAccountId: null,
        cloudServer: null,
        cloudLogin: null,
        cloudInvestorPassword: null,
        cloudError: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Cloud MetaTrader Sync disconnected successfully.',
      cloudSyncStatus: updatedAccount.cloudSyncStatus,
    });
  } catch (error) {
    console.error('Error disconnecting Cloud MT Sync:', error);
    return res.status(500).json({ message: 'Could not disconnect Cloud MetaTrader Sync.' });
  }
};

/**
 * Get Cloud Sync Status for Account
 * GET /api/accounts/:id/cloud-sync/status
 */
const getCloudSyncStatus = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
      select: {
        id: true,
        name: true,
        cloudSyncEnabled: true,
        cloudSyncStatus: true,
        cloudServer: true,
        cloudLogin: true,
        cloudLastSyncedAt: true,
        cloudError: true,
      },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    return res.status(200).json(account);
  } catch (error) {
    console.error('Error getting cloud sync status:', error);
    return res.status(500).json({ message: 'Failed to retrieve cloud sync status.' });
  }
};

module.exports = {
  connectCloudSync,
  syncCloudTradesNow,
  disconnectCloudSync,
  getCloudSyncStatus,
  findMatchingTrade,
};
