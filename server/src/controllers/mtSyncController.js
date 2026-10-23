const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPushToUser } = require('../services/pushNotificationService');
const {
  classifyTrade,
  isStopAtOrPastEntry,
  CLASSIFICATION_SOURCES,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS,
} = require('../services/tradeClassificationService');

/**
 * Helper to parse numbers safely
 */
const getNum = (val) => {
  if (val === null || val === undefined || val === '' || val === 'null') return null;
  const n = Number(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? null : n;
};

/**
 * Handle MetaTrader 4 / MetaTrader 5 EA Webhook Pushes
 * Route: POST /api/webhooks/mt-sync
 * Auth: x-sync-token header or query/body syncToken
 */
const handleMtSyncWebhook = async (req, res) => {
  try {
    const syncToken = 
      req.headers['x-sync-token'] || 
      req.headers['authorization']?.replace('Bearer ', '') || 
      req.query.token || 
      req.body.syncToken;

    if (!syncToken) {
      return res.status(401).json({ status: 'error', message: 'Missing MetaTrader sync token.' });
    }

    // Find account by sync token
    const account = await prisma.tradingAccount.findUnique({
      where: { syncToken },
    });

    if (!account || !account.syncEnabled) {
      return res.status(403).json({ status: 'error', message: 'Invalid or disabled MetaTrader sync token.' });
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: account.userId },
    });
    const userThresholdAmount = userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null;

    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];

    let processedCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const ticket = String(item.ticket || item.orderId || item.dealId || '').trim();
      if (!ticket) continue;

      const rawPair = item.symbol || item.pair || item.instrument || '';
      const pair = String(rawPair).toUpperCase().trim();
      if (!pair) continue;

      const rawDirection = String(item.type || item.action || item.direction || '').toLowerCase();
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
      const pips = getNum(item.pips);
      const netProfit = profit + swap + commission;

      const entryTimeRaw = item.openTime || item.entryTime;
      const exitTimeRaw = item.closeTime || item.exitTime;

      const entryTime = entryTimeRaw ? new Date(entryTimeRaw) : new Date();
      const exitTime = exitTimeRaw && exitTimeRaw !== 'null' && exitTimeRaw !== 'undefined' ? new Date(exitTimeRaw) : null;

      const isClosed = Boolean(exitTime || item.isClosed || item.status === 'CLOSED' || item.eventType === 'CLOSE');
      const status = isClosed ? 'CLOSED' : 'ACTIVE';

      // Check if trade already exists by ticket number for this account
      const existingTrade = await prisma.trade.findFirst({
        where: {
          tradingAccountId: account.id,
          externalId: ticket,
        },
      });

      const now = new Date();

      if (!existingTrade) {
        // Detect if initial stop is already at or past entry (break-even protected)
        const isInitialStopBe = isStopAtOrPastEntry({
          direction,
          entryPrice,
          stopLoss,
          pair,
        });

        // Build initial SL/TP history record
        const initialHistory = [];
        if (stopLoss !== null || takeProfit !== null) {
          initialHistory.push({
            timestamp: now.toISOString(),
            stopLoss,
            takeProfit,
            note: isInitialStopBe ? 'Initial SL set at or past entry (BE protected)' : 'Initial SL/TP set on open',
            eventType: 'OPEN',
          });
        }

        const classification = classifyTrade({
          status,
          direction,
          pair,
          entryPrice,
          exitPrice,
          stopLoss,
          initialStopLoss: stopLoss,
          lotSize,
          grossProfit: profit,
          commission,
          swap,
          fees: 0,
          profitLossAmount: isClosed ? netProfit : null,
          slTpHistory: initialHistory,
          breakEvenActivated: isInitialStopBe,
          breakEvenPrice: isInitialStopBe ? stopLoss : null,
          breakEvenEvidenceSource: isInitialStopBe ? EVIDENCE_SOURCES.MT_TRAILING_STOP : null,
          breakEvenEvidenceStatus: isInitialStopBe ? EVIDENCE_STATUS.CONFIRMED : EVIDENCE_STATUS.UNKNOWN,
          userThresholdAmount,
        });

        const newTrade = await prisma.trade.create({
          data: {
            tradingAccountId: account.id,
            externalId: ticket,
            pair,
            direction,
            entryPrice,
            stopLoss,
            takeProfit,
            initialStopLoss: stopLoss,
            initialTakeProfit: takeProfit,
            slTpHistory: initialHistory,
            exitPrice,
            lotSize,
            grossProfit: profit,
            commission,
            swap,
            fees: 0,
            profitLossAmount: isClosed ? netProfit : null,
            pips,
            status,
            result: classification.result,
            breakEvenActivated: classification.breakEvenActivated,
            breakEvenPrice: classification.breakEvenPrice,
            breakEvenActivatedAt: classification.breakEvenActivatedAt,
            breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
            breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
            classificationSource: CLASSIFICATION_SOURCES.BROKER_IMPORT,
            resultCalculatedAt: classification.resultCalculatedAt || now,
            isManualResultOverride: false,
            entryTime: !isNaN(entryTime.getTime()) ? entryTime : now,
            exitTime: exitTime && !isNaN(exitTime.getTime()) ? exitTime : null,
            notesBefore: item.comment ? `MT Comment: ${item.comment}` : null,
          },
        });

        if (isClosed && netProfit !== 0) {
          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: {
              currentBalance: { increment: netProfit },
              lastSyncedAt: now,
            },
          });
        } else {
          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: { lastSyncedAt: now },
          });
        }

        const notifTitle = isClosed ? `🏁 MT Trade Logged: ${pair} (${classification.result})` : `📈 MT Trade Synced: ${pair} ${direction}`;
        const notifMsg = isClosed
          ? `${pair} ${direction} ${lotSize ? lotSize + ' lots' : ''} closed on ${account.name}. P&L: ${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`
          : `${pair} ${direction} ${lotSize ? lotSize + ' lots' : ''} logged on ${account.name} @ ${entryPrice || 'market'}.`;
        const notifUrl = `/trades/${newTrade.id}`;

        // Send instant Push Notification for synced trade
        sendPushToUser(account.userId, {
          title: notifTitle,
          message: notifMsg,
          url: notifUrl,
          category: 'TRADE_SYNC',
          timestamp: now.toISOString()
        }).catch(err => console.error('MT sync push error:', err));

        // Create in-app notification
        prisma.notification.create({
          data: {
            userId: account.userId,
            type: 'TRADE_SYNC',
            category: 'TRADE',
            title: notifTitle,
            message: notifMsg,
            actionUrl: notifUrl,
            isGlobal: false
          }
        }).catch(err => console.error('Failed to create in-app notification for MT trade:', err));

        processedCount++;
      } else {
        // Trade exists - check if SL/TP modified or if trade closed
        let history = Array.isArray(existingTrade.slTpHistory) ? [...existingTrade.slTpHistory] : [];
        let slTpChanged = false;
        let changeNote = 'SL/TP modified in MT';

        const currentEntry = existingTrade.entryPrice ?? entryPrice;
        const currentDirection = existingTrade.direction ?? direction;
        const currentPair = existingTrade.pair ?? pair;

        let stopMovedToBe = false;
        if (stopLoss !== null && stopLoss !== existingTrade.stopLoss) {
          slTpChanged = true;
          const isBeNow = isStopAtOrPastEntry({
            direction: currentDirection,
            entryPrice: currentEntry,
            stopLoss,
            pair: currentPair,
          });

          if (isBeNow) {
            stopMovedToBe = true;
            changeNote = 'Moved Stop Loss to Break Even / Profit Protection';
          } else if (existingTrade.stopLoss && currentEntry && Math.abs(stopLoss - currentEntry) < Math.abs(existingTrade.stopLoss - currentEntry)) {
            changeNote = 'Trailed Stop Loss closer to price';
          }
        }

        if (takeProfit !== null && takeProfit !== existingTrade.takeProfit) {
          slTpChanged = true;
        }

        if (slTpChanged) {
          history.push({
            timestamp: now.toISOString(),
            previousStopLoss: existingTrade.stopLoss,
            newStopLoss: stopLoss,
            previousTakeProfit: existingTrade.takeProfit,
            newTakeProfit: takeProfit,
            note: changeNote,
            eventType: 'MODIFY',
          });
        }

        const wasClosed = existingTrade.status === 'CLOSED';
        const nowClosing = isClosed && !wasClosed;
        const updatedStatus = isClosed ? 'CLOSED' : existingTrade.status;

        const effectiveGross = profit !== 0 ? profit : (existingTrade.grossProfit ?? profit);
        const effectiveComm = commission !== 0 ? commission : (existingTrade.commission ?? commission);
        const effectiveSwap = swap !== 0 ? swap : (existingTrade.swap ?? swap);
        const effectiveNet = isClosed ? netProfit : (existingTrade.profitLossAmount ?? null);

        const classification = classifyTrade({
          status: updatedStatus,
          direction: currentDirection,
          pair: currentPair,
          entryPrice: currentEntry,
          exitPrice: exitPrice !== null ? exitPrice : existingTrade.exitPrice,
          stopLoss: stopLoss !== null ? stopLoss : existingTrade.stopLoss,
          initialStopLoss: existingTrade.initialStopLoss,
          lotSize: lotSize !== null ? lotSize : existingTrade.lotSize,
          grossProfit: effectiveGross,
          commission: effectiveComm,
          swap: effectiveSwap,
          fees: existingTrade.fees ?? 0,
          profitLossAmount: effectiveNet,
          slTpHistory: history,
          breakEvenActivated: stopMovedToBe ? true : existingTrade.breakEvenActivated,
          breakEvenPrice: stopMovedToBe ? stopLoss : existingTrade.breakEvenPrice,
          breakEvenEvidenceSource: stopMovedToBe ? EVIDENCE_SOURCES.MT_TRAILING_STOP : existingTrade.breakEvenEvidenceSource,
          breakEvenEvidenceStatus: stopMovedToBe ? EVIDENCE_STATUS.CONFIRMED : existingTrade.breakEvenEvidenceStatus,
          userConfirmedBe: existingTrade.breakEvenEvidenceStatus === EVIDENCE_STATUS.USER_CONFIRMED,
          manualResultOverride: existingTrade.isManualResultOverride ? existingTrade.result : null,
          userThresholdAmount,
        });

        const pnlDelta = nowClosing ? netProfit : (wasClosed && netProfit !== existingTrade.profitLossAmount ? netProfit - (existingTrade.profitLossAmount || 0) : 0);

        await prisma.trade.update({
          where: { id: existingTrade.id },
          data: {
            ...(stopLoss !== null && { stopLoss }),
            ...(takeProfit !== null && { takeProfit }),
            ...(slTpChanged && { slTpHistory: history }),
            ...(exitPrice !== null && { exitPrice }),
            ...(lotSize !== null && { lotSize }),
            ...(pips !== null && { pips }),
            grossProfit: effectiveGross,
            commission: effectiveComm,
            swap: effectiveSwap,
            breakEvenActivated: classification.breakEvenActivated,
            breakEvenPrice: classification.breakEvenPrice,
            breakEvenActivatedAt: classification.breakEvenActivatedAt || (stopMovedToBe ? now : existingTrade.breakEvenActivatedAt),
            breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
            breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
            classificationSource: existingTrade.isManualResultOverride ? CLASSIFICATION_SOURCES.USER_OVERRIDE : classification.classificationSource,
            resultCalculatedAt: classification.resultCalculatedAt,
            ...(isClosed && {
              status: 'CLOSED',
              result: classification.result,
              profitLossAmount: effectiveNet,
              exitTime: exitTime && !isNaN(exitTime.getTime()) ? exitTime : now,
            }),
          },
        });

        if (pnlDelta !== 0) {
          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: {
              currentBalance: { increment: pnlDelta },
              lastSyncedAt: now,
            },
          });
        } else {
          await prisma.tradingAccount.update({
            where: { id: account.id },
            data: { lastSyncedAt: now },
          });
        }

        // Notify user if trade closed in this sync update
        if (nowClosing) {
          const closeTitle = `🏁 MT Trade Closed: ${existingTrade.pair} (${classification.result})`;
          const closeMsg = `${existingTrade.pair} ${existingTrade.direction} closed on ${account.name}. P&L: ${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`;
          const closeUrl = `/trades/${existingTrade.id}`;

          sendPushToUser(account.userId, {
            title: closeTitle,
            message: closeMsg,
            url: closeUrl,
            category: 'TRADE_SYNC',
            timestamp: now.toISOString(),
          }).catch(err => console.error('MT close push error:', err));

          prisma.notification.create({
            data: {
              userId: account.userId,
              type: 'TRADE_SYNC',
              category: 'TRADE',
              title: closeTitle,
              message: closeMsg,
              actionUrl: closeUrl,
              isGlobal: false,
            },
          }).catch(err => console.error('Failed to log closed trade notification to DB:', err));
        }

        updatedCount++;
      }
    }

    return res.status(200).json({
      status: 'success',
      message: `Processed MT sync successfully.`,
      newTrades: processedCount,
      updatedTrades: updatedCount,
    });
  } catch (error) {
    console.error('Error handling MT Sync Webhook:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to process MetaTrader sync.' });
  }
};

/**
 * Generate or regenerate MetaTrader sync token for account
 * Route: POST /api/accounts/:id/sync-token
 * Access: Private
 */
const generateSyncToken = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    const token = 'jj_mt_' + crypto.randomBytes(16).toString('hex');

    const updatedAccount = await prisma.tradingAccount.update({
      where: { id: accountId },
      data: {
        syncToken: token,
        syncEnabled: true,
      },
    });

    return res.status(200).json({
      success: true,
      syncToken: updatedAccount.syncToken,
      syncEnabled: updatedAccount.syncEnabled,
      message: 'MetaTrader Sync Token generated successfully.',
    });
  } catch (error) {
    console.error('Error generating sync token:', error);
    return res.status(500).json({ message: 'Could not generate sync token.' });
  }
};

/**
 * Revoke MetaTrader sync token for account
 * Route: DELETE /api/accounts/:id/sync-token
 * Access: Private
 */
const revokeSyncToken = async (req, res) => {
  try {
    const accountId = req.params.id;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found.' });
    }

    const updatedAccount = await prisma.tradingAccount.update({
      where: { id: accountId },
      data: {
        syncToken: null,
        syncEnabled: false,
      },
    });

    return res.status(200).json({
      success: true,
      syncEnabled: updatedAccount.syncEnabled,
      message: 'MetaTrader Sync Token revoked.',
    });
  } catch (error) {
    console.error('Error revoking sync token:', error);
    return res.status(500).json({ message: 'Could not revoke sync token.' });
  }
};

module.exports = {
  handleMtSyncWebhook,
  generateSyncToken,
  revokeSyncToken,
};
