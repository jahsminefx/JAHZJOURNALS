const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { encryptCredential, decryptCredential } = require('../utils/cryptoUtils');
const { provisionCloudAccount, removeCloudAccount, fetchAccountHistory, fetchOpenPositions, getAccountConnectionStatus, fetchAccountInformation } = require('../services/metaApiService');
const { detectTradingSession, resolveTradeRiskReward } = require('../utils/tradeCalculations');
const { calculatePips } = require('../utils/pipCalculator');

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
const findMatchingTrade = (incoming, existingTrades, timeToleranceMs = 15 * 60 * 1000) => {
  for (const existing of existingTrades) {
    // 1. Direct Ticket ID match
    if (incoming.externalId && existing.externalId) {
      if (String(incoming.externalId).trim() === String(existing.externalId).trim()) {
        return existing;
      }
      // If BOTH trades have explicit MT ticket IDs and they differ, they are distinct trades
      continue;
    }

    // 2. Pair / Symbol match (e.g. EURUSD, XAUUSD)
    if (!existing.pair || !incoming.pair || String(existing.pair).toUpperCase().trim() !== String(incoming.pair).toUpperCase().trim()) {
      continue;
    }

    // 3. Direction match (BUY vs SELL)
    if (incoming.direction && existing.direction && String(incoming.direction).toUpperCase() !== String(existing.direction).toUpperCase()) {
      continue;
    }

    // 4. Open Trade Reconciliation:
    // If existing trade is currently ACTIVE in DB and incoming trade is CLOSED:
    // Match if entry prices are within 0.5% OR entry times are within 1 hour
    const isExistingOpen = existing.status === 'ACTIVE' || existing.result === 'OPEN' || existing.exitPrice === null;
    if (isExistingOpen && incoming.status === 'CLOSED') {
      const entryPriceMatch = existing.entryPrice && incoming.entryPrice
        ? Math.abs(existing.entryPrice - incoming.entryPrice) / existing.entryPrice < 0.005
        : false;
      const entryTimeDiff = (existing.entryTime && incoming.entryTime)
        ? Math.abs(new Date(existing.entryTime).getTime() - new Date(incoming.entryTime).getTime())
        : Infinity;

      if (entryPriceMatch || entryTimeDiff <= 60 * 60 * 1000) {
        return existing;
      }
    }

    // 5. Open Time tolerance check (within 15 minutes)
    if (incoming.entryTime && existing.entryTime) {
      const entryDiff = Math.abs(new Date(incoming.entryTime).getTime() - new Date(existing.entryTime).getTime());
      if (entryDiff > timeToleranceMs) {
        continue;
      }
    }

    // 6. Close Time tolerance check if both trades are closed (within 15 minutes)
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
const syncAccountTrades = async (accountId, { isCronJob = false } = {}) => {
  const account = await prisma.tradingAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.cloudSyncEnabled) {
    return { success: false, importedCount: 0, skippedCount: 0, message: 'Cloud sync is disabled for this account.' };
  }

  const cloudId = account.cloudAccountId;
  if (!cloudId || cloudId.startsWith('dev_cloud_')) {
    return { success: false, importedCount: 0, skippedCount: 0, message: 'Account is not connected to a live MetaTrader terminal. Please reconnect.' };
  }

  // Check terminal status first to provide accurate feedback
  try {
    const statusInfo = await getAccountConnectionStatus(cloudId);
    if (statusInfo && statusInfo.connectionStatus === 'DISCONNECTED') {
      await prisma.tradingAccount.update({
        where: { id: account.id },
        data: {
          cloudSyncStatus: 'ERROR',
          cloudError: 'Broker rejected login or terminal is disconnected. Please verify your investor password and reconnect.',
        },
      });
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        message: 'Broker connection failed: MetaTrader terminal is disconnected. Please check your broker server, login, and investor password, then reconnect.',
      };
    }
  } catch (statusErr) {
    // Continue if status check times out
  }

  // Fetch Live Account Information (balance, equity, broker) + History Deals + Open Positions
  const [accountInfo, historyDeals, openPositions] = await Promise.all([
    fetchAccountInformation(cloudId).catch(() => null),
    fetchAccountHistory(cloudId, 180).catch(() => []),
    fetchOpenPositions(cloudId).catch(() => []),
  ]);

  // Merge & Deduplicate by ticket (History deals take precedence over open positions)
  const tradeMap = new Map();
  for (const t of historyDeals || []) {
    const ticket = String(t.ticket || '').trim();
    if (ticket) tradeMap.set(ticket, t);
  }
  for (const t of openPositions || []) {
    const ticket = String(t.ticket || '').trim();
    if (ticket && !tradeMap.has(ticket)) {
      tradeMap.set(ticket, t);
    }
  }
  const rawTrades = tradeMap.size > 0 ? Array.from(tradeMap.values()) : [...(historyDeals || []), ...(openPositions || [])];

  if (!rawTrades || rawTrades.length === 0) {
    if (accountInfo && typeof accountInfo.balance === 'number') {
      await prisma.tradingAccount.update({
        where: { id: account.id },
        data: {
          currentBalance: Math.round(accountInfo.balance * 100) / 100,
          cloudSyncStatus: 'CONNECTED',
          cloudLastSyncedAt: new Date(),
          lastSyncedAt: new Date(),
          ...(accountInfo.broker && (!account.brokerName || account.brokerName === 'MetaTrader') && { brokerName: accountInfo.broker }),
        },
      });
    }
    return { success: true, importedCount: 0, skippedCount: 0, message: 'No trades found in MT account. Balance synced.' };
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

    const validEntryTime = !isNaN(entryTime.getTime()) ? entryTime : new Date();
    const validExitTime = exitTime && !isNaN(exitTime.getTime()) ? exitTime : null;
    const session = detectTradingSession(validEntryTime);
    const pips = calculatePips({ pair, direction, entryPrice, exitPrice });

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
      session,
      pips,
      entryTime: validEntryTime,
      exitTime: validExitTime,
      notesBefore: item.comment || 'Auto-Synced from MetaTrader Cloud Account',
    };
    incomingTrade.riskRewardRatio = resolveTradeRiskReward(incomingTrade);

    // Cross-check with existing trades in JahzJournals DB
    const match = findMatchingTrade(incomingTrade, existingTrades);

    if (match) {
      skippedCount++;
      // Check if existing trade needs enrichment (closing open trade, adding ticket ID or exit details)
      const isClosingOpenTrade = (match.status === 'ACTIVE' || match.status === 'PLANNED') && incomingTrade.status === 'CLOSED';
      const needsUpdate = isClosingOpenTrade ||
        (!match.externalId && incomingTrade.externalId) ||
        (incomingTrade.exitPrice !== null && match.exitPrice === null) ||
        (incomingTrade.profitLossAmount !== null && match.profitLossAmount === null) ||
        (!match.session && session) ||
        (match.pips === null && pips !== null) ||
        (match.riskRewardRatio === null && incomingTrade.riskRewardRatio !== null);

      if (needsUpdate) {
        tradesToEnrich.push({
          id: match.id,
          data: {
            ...(incomingTrade.externalId && { externalId: incomingTrade.externalId }),
            ...(incomingTrade.exitPrice !== null && { exitPrice: incomingTrade.exitPrice }),
            ...(incomingTrade.profitLossAmount !== null && { profitLossAmount: incomingTrade.profitLossAmount, result: incomingTrade.result, status: incomingTrade.status }),
            ...(incomingTrade.exitTime && { exitTime: incomingTrade.exitTime }),
            ...((!match.session && session) && { session }),
            ...((match.pips === null && pips !== null) && { pips }),
            ...((match.riskRewardRatio === null && incomingTrade.riskRewardRatio !== null) && { riskRewardRatio: incomingTrade.riskRewardRatio }),
          },
          pnlDelta: (incomingTrade.profitLossAmount || 0) - (match.profitLossAmount || 0),
        });
      }
    } else {
      // Check if already queued in pendingNewTrades in this batch
      const pendingMatch = findMatchingTrade(incomingTrade, pendingNewTrades);
      if (pendingMatch) {
        if ((pendingMatch.status === 'ACTIVE' || pendingMatch.result === 'OPEN') && incomingTrade.status === 'CLOSED') {
          Object.assign(pendingMatch, incomingTrade);
        }
        skippedCount++;
      } else {
        // New unique trade -> Add to import list!
        pendingNewTrades.push(incomingTrade);
      }
    }
  }

  const now = new Date();
  const liveBalance = (accountInfo && typeof accountInfo.balance === 'number')
    ? Math.round(accountInfo.balance * 100) / 100
    : null;

  if (pendingNewTrades.length === 0 && tradesToEnrich.length === 0) {
    const updateData = {
      cloudSyncStatus: 'CONNECTED',
      cloudLastSyncedAt: now,
      lastSyncedAt: now,
    };
    if (liveBalance !== null) {
      updateData.currentBalance = liveBalance;
    }
    if (accountInfo?.broker && (!account.brokerName || account.brokerName === 'MetaTrader')) {
      updateData.brokerName = accountInfo.broker;
    }

    await prisma.tradingAccount.update({
      where: { id: account.id },
      data: updateData,
    });

    return {
      success: true,
      importedCount: 0,
      enrichedCount: 0,
      skippedCount,
      currentBalance: liveBalance ?? account.currentBalance,
      message: 'All trades are up to date and account balance is synchronized with MetaTrader.',
    };
  }

  // Transaction: Insert new trades & enrich matched trades & update balance
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

    const accountUpdateData = {
      cloudSyncStatus: 'CONNECTED',
      cloudLastSyncedAt: now,
      lastSyncedAt: now,
    };
    if (liveBalance !== null) {
      accountUpdateData.currentBalance = liveBalance;
    } else if (netProfitDelta !== 0) {
      accountUpdateData.currentBalance = { increment: netProfitDelta };
    }
    if (accountInfo?.broker && (!account.brokerName || account.brokerName === 'MetaTrader')) {
      accountUpdateData.brokerName = accountInfo.broker;
    }

    await tx.tradingAccount.update({
      where: { id: account.id },
      data: accountUpdateData,
    });
  });

  const { reconcileAccountBalance } = require('../services/accountBalanceService');
  await reconcileAccountBalance(account.id);

  if (pendingNewTrades.length > 0 || tradesToEnrich.length > 0) {
    try {
      const { sendPushToUser } = require('../services/pushNotificationService');
      const newCount = pendingNewTrades.length;
      const enrichedCount = tradesToEnrich.length;
      let pushMsg = `${newCount} new trade(s) automatically logged from MetaTrader.`;
      if (newCount > 0 && enrichedCount > 0) {
        pushMsg = `${newCount} new trade(s) logged & ${enrichedCount} trade(s) updated from MetaTrader.`;
      } else if (newCount === 0 && enrichedCount > 0) {
        pushMsg = `${enrichedCount} trade(s) updated from MetaTrader.`;
      }

      sendPushToUser(account.userId, {
        title: `⚡ MetaTrader Cloud Sync`,
        message: pushMsg,
        url: `/trades`,
        category: 'TRADE_SYNC',
      }).catch((err) => console.error('Cloud MT sync push error:', err));
    } catch (pushErr) {
      console.error('Failed sending cloud sync push notification:', pushErr);
    }
  }

  return {
    success: true,
    importedCount: pendingNewTrades.length,
    enrichedCount: tradesToEnrich.length,
    skippedCount,
    currentBalance: liveBalance ?? undefined,
    message: `Cross-check complete! ${pendingNewTrades.length} new trades added${tradesToEnrich.length > 0 ? `, ${tradesToEnrich.length} existing trades updated` : ''} (${skippedCount} duplicates matched). Balance synchronized with MetaTrader.`,
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
 * Auto-Connect & Auto-Create Trading Account from MetaTrader
 * Automatically provisions MT terminal, fetches live account info (broker, currency, balance),
 * creates the TradingAccount in DB, and runs initial trade backfill.
 * POST /api/accounts/cloud-sync/auto-connect
 */
const autoConnectCloudSync = async (req, res) => {
  try {
    const { platform, server, login, investorPassword, accountCategory, accountName: customName } = req.body;

    if (!platform || !server || !login || !investorPassword) {
      return res.status(400).json({ message: 'Platform (MT4/MT5), broker server, account login, and investor password are required.' });
    }

    const cleanServer = String(server).trim();
    const cleanLogin = String(login).trim();
    const cleanPassword = String(investorPassword).trim();
    const cleanPlatform = String(platform).toUpperCase().trim();

    // 1. Provision cloud account instance via MetaApi
    const provisionResult = await provisionCloudAccount({
      platform: cleanPlatform,
      server: cleanServer,
      login: cleanLogin,
      password: cleanPassword,
      accountName: customName?.trim() || `${cleanServer} #${cleanLogin}`,
    });

    const cloudAccountId = provisionResult.cloudAccountId;

    // 2. Fetch live account info from MetaTrader
    let accountInfo = null;
    try {
      accountInfo = await fetchAccountInformation(cloudAccountId);
    } catch (_) {}

    // Derive broker, currency, balance, leverage from MetaTrader data
    const broker = accountInfo?.broker || cleanServer.split('-')[0] || cleanServer.split('.')[0] || 'MetaTrader';
    const currency = (accountInfo?.currency || 'USD').toUpperCase();
    const liveBalance = (accountInfo?.balance !== undefined && accountInfo?.balance !== null)
      ? Number(accountInfo.balance)
      : 10000;
    const accountName = customName?.trim()
      ? customName.trim()
      : accountInfo?.name
      ? `${accountInfo.name} (${cleanServer})`
      : `${broker} #${cleanLogin}`;

    // 3. Encrypt password for secure storage
    const encryptedPassword = encryptCredential(cleanPassword);

    const isProp = accountCategory === 'PROP_FIRM';

    // 4. Create the Trading Account in database
    const newAccount = await prisma.tradingAccount.create({
      data: {
        userId: req.user.id,
        name: accountName,
        brokerName: broker,
        accountType: 'LIVE',
        platform: cleanPlatform,
        startingBalance: liveBalance,
        currentBalance: liveBalance,
        currency: currency,
        accountCategory: isProp ? 'PROP_FIRM' : 'REGULAR',
        isPropFirmAccount: isProp,
        propFirmName: isProp ? broker : undefined,
        cloudSyncEnabled: true,
        cloudSyncStatus: provisionResult.status || 'CONNECTED',
        cloudServer: cleanServer,
        cloudLogin: cleanLogin,
        cloudInvestorPassword: encryptedPassword,
        cloudAccountId: cloudAccountId,
        cloudLastSyncedAt: new Date(),
        lastSyncedAt: new Date(),
        ...(isProp && {
          propFirmAccount: {
            create: {
              firmName: broker,
              programmeName: 'Standard Challenge',
              marketType: 'FOREX',
              evaluationType: 'TWO_STEP',
              accountStatus: 'ACTIVE',
              platform: cleanPlatform,
              brokerServer: cleanServer,
            },
          },
        }),
      },
      include: {
        propFirmAccount: true,
      },
    });

    // 5. Backfill historical trades immediately
    let syncResult = { importedCount: 0, enrichedCount: 0, skippedCount: 0 };
    try {
      syncResult = await syncAccountTrades(newAccount.id);
    } catch (syncErr) {
      console.warn('[Auto-Connect] Initial sync warning:', syncErr.message);
    }

    // 6. Fetch updated account with any reconciled balance
    const updatedAccount = await prisma.tradingAccount.findUnique({
      where: { id: newAccount.id },
      include: { propFirmAccount: true },
    });

    return res.status(201).json({
      success: true,
      account: updatedAccount || newAccount,
      importedCount: syncResult.importedCount || 0,
      enrichedCount: syncResult.enrichedCount || 0,
      skippedCount: syncResult.skippedCount || 0,
      message: `Account connected successfully! "${newAccount.name}" created with ${currency} ${(updatedAccount?.currentBalance ?? liveBalance).toLocaleString()} balance and ${syncResult.importedCount || 0} trades imported.`,
    });
  } catch (error) {
    console.error('Error auto-connecting Cloud MT Sync:', error);
    return res.status(500).json({
      message: error.message || 'Failed to connect MetaTrader account. Please check your broker server, login, and investor password.',
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
    return res.status(500).json({ message: error.message || 'Failed to sync trades from MetaTrader.' });
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

/**
 * Background Auto-Sync: Sync ALL cloud-connected accounts
 * Called by the cron scheduler every 5 minutes
 */
const syncAllCloudAccounts = async () => {
  try {
    // Find all accounts that have cloud sync enabled and are connected
    const connectedAccounts = await prisma.tradingAccount.findMany({
      where: {
        cloudSyncEnabled: true,
        cloudSyncStatus: { in: ['CONNECTED', 'CONNECTING'] },
        cloudAccountId: { not: null },
      },
      select: {
        id: true,
        name: true,
        cloudLogin: true,
        userId: true,
      },
    });

    if (connectedAccounts.length === 0) {
      return { totalAccounts: 0, synced: 0, errors: 0 };
    }

    let syncedCount = 0;
    let errorCount = 0;
    let totalImported = 0;
    let totalEnriched = 0;

    for (const account of connectedAccounts) {
      try {
        const result = await syncAccountTrades(account.id, { isCronJob: true });

        if (result.success && (result.importedCount > 0 || result.enrichedCount > 0)) {
          console.log(
            `[AUTO-SYNC] ${account.name} (${account.cloudLogin}): +${result.importedCount} new, ~${result.enrichedCount || 0} updated, =${result.skippedCount} matched`
          );
          totalImported += result.importedCount || 0;
          totalEnriched += result.enrichedCount || 0;
        }

        syncedCount++;

        // Clear any previous error
        await prisma.tradingAccount.update({
          where: { id: account.id },
          data: { cloudError: null },
        });
      } catch (accountError) {
        errorCount++;
        console.error(`[AUTO-SYNC] Error syncing ${account.name} (${account.cloudLogin}):`, accountError.message);

        // Log error to the account so user can see it in the UI
        await prisma.tradingAccount.update({
          where: { id: account.id },
          data: { cloudError: `Auto-sync failed: ${accountError.message}` },
        }).catch(() => {}); // Don't let meta-error crash the loop
      }
    }

    if (totalImported > 0 || totalEnriched > 0) {
      console.log(
        `[AUTO-SYNC] Complete: ${connectedAccounts.length} accounts checked, ${totalImported} trades imported, ${totalEnriched} enriched, ${errorCount} errors`
      );
    }

    return {
      totalAccounts: connectedAccounts.length,
      synced: syncedCount,
      errors: errorCount,
      totalImported,
      totalEnriched,
    };
  } catch (error) {
    console.error('[AUTO-SYNC] Critical error in background sync:', error);
    return { totalAccounts: 0, synced: 0, errors: 1 };
  }
};

module.exports = {
  connectCloudSync,
  autoConnectCloudSync,
  syncCloudTradesNow,
  disconnectCloudSync,
  getCloudSyncStatus,
  syncAllCloudAccounts,
  findMatchingTrade,
  syncAccountTrades,
};
