const { PrismaClient } = require('@prisma/client');
const currencyService = require('../services/fx/currencyService');
const { calculatePips } = require('../utils/pipCalculator');
const { classifyTrade } = require('../services/tradeClassificationService');
const { buildAudienceSafeTradeSnapshot } = require('./cohortSharingController');

const prisma = new PrismaClient();

/**
 * Automatically syncs any CohortTradeShare records linked to a mentor's trade
 * (or matches a recent open direct signal by the same mentor on the same pair)
 * whenever the mentor logs or concludes the trade in their personal account.
 */
const syncMentorCohortTradeSharesForTrade = async (trade, userId) => {
  try {
    if (!trade || !userId) return;

    // 1. Find any CohortTradeShares explicitly linked to this trade
    let sharesToSync = await prisma.cohortTradeShare.findMany({
      where: {
        mentorId: userId,
        sourceTradeId: trade.id,
      },
    });

    // 2. If none are explicitly linked yet, check if the mentor has a recent OPEN direct signal for the same pair
    if (sharesToSync.length === 0 && trade.pair) {
      const recentOpenShares = await prisma.cohortTradeShare.findMany({
        where: {
          mentorId: userId,
          sourceTradeId: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const normPair = String(trade.pair).trim().toUpperCase();
      const matchingOpenShare = recentOpenShares.find((s) => {
        const snap = s.tradeSnapshot || {};
        const snapPair = String(snap.pair || '').trim().toUpperCase();
        const snapOutcome = String(snap.outcome || snap.result || 'OPEN').toUpperCase();
        return snapPair === normPair && (snapOutcome === 'OPEN' || snapOutcome === 'ACTIVE');
      });

      if (matchingOpenShare) {
        sharesToSync = [matchingOpenShare];
      }
    }

    for (const share of sharesToSync) {
      const existingSnap = share.tradeSnapshot || {};
      const updatedSnapshot = buildAudienceSafeTradeSnapshot(
        trade,
        existingSnap.visibility || existingSnap.visibilityOptions || null,
        null
      );

      await prisma.cohortTradeShare.update({
        where: { id: share.id },
        data: {
          sourceTradeId: trade.id,
          tradeSnapshot: updatedSnapshot,
          ...(trade.notesAfter && !share.outcomeLessons ? { outcomeLessons: trade.notesAfter } : {}),
        },
      });
    }
  } catch (err) {
    console.warn('syncMentorCohortTradeSharesForTrade warning:', err?.message);
  }
};

const buildTradeListWhere = (query, userId) => {
  const where = {
    tradingAccount: { userId }
  };

  if (query.accountId) {
    where.tradingAccountId = query.accountId;
  }
  if (query.pair) {
    where.pair = { equals: query.pair, mode: 'insensitive' };
  }
  if (query.session) {
    where.session = query.session;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.result) {
    where.result = query.result;
  }
  if (query.startDate || query.endDate) {
    where.entryTime = {};
    if (query.startDate) where.entryTime.gte = new Date(query.startDate);
    if (query.endDate) where.entryTime.lte = new Date(query.endDate);
  }

  return where;
};

const getTrades = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: buildTradeListWhere(req.query, req.user.id),
      include: {
        tradingAccount: { select: { id: true, name: true, currency: true } },
        strategy: { select: { id: true, name: true } },
        setup: { select: { id: true, name: true } },
        screenshots: true,
        aiReviews: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { entryTime: 'desc' },
    });
    res.json(trades);
  } catch (error) {
    console.error('Error in getTrades:', error);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
};

const createTrade = async (req, res) => {
  try {
    const {
      tradingAccountId,
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      lotSize,
      riskAmount,
      rewardAmount,
      profitLossAmount,
      profitLossPercent,
      riskRewardRatio,
      pips,
      result,
      status,
      grossProfit,
      commission,
      swap,
      fees,
      breakEvenActivated,
      breakEvenPrice,
      breakEvenEvidenceSource,
      breakEvenEvidenceStatus,
      isManualResultOverride,
      session,
      strategyId,
      setupId,
      higherTimeframe,
      entryTimeframe,
      htfBias,
      entryReason,
      exitReason,
      notesBefore,
      notesAfter,
      followedPlan,
      isAPlusSetup,
      newsRelated,
      grade,
      entryTime,
      exitTime,
    } = req.body;

    if (!tradingAccountId) {
      return res.status(400).json({ message: 'Trading account selection is mandatory' });
    }

    const account = await prisma.tradingAccount.findFirst({
      where: { id: tradingAccountId, userId: req.user.id }
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found' });
    }

    const parseNum = (val) => (val !== undefined && val !== null && val !== '' && !Number.isNaN(Number(val))) ? parseFloat(val) : null;

    const parsedPips = parseNum(pips);
    const computedPips = parsedPips !== null ? parsedPips : calculatePips({
      pair,
      direction,
      entryPrice: parseNum(entryPrice),
      exitPrice: parseNum(exitPrice),
    });

    const tradeStatus = status || 'ACTIVE';
    const rawResult = result || 'OPEN';

    // Lookup user settings for configurable BE tolerance
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
      select: { breakEvenThresholdAmount: true },
    });

    const isManualOverride = isManualResultOverride !== undefined
      ? Boolean(isManualResultOverride)
      : (rawResult && ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawResult));

    const classification = classifyTrade({
      status: tradeStatus,
      direction,
      pair: pair.toUpperCase().trim(),
      entryPrice: parseNum(entryPrice),
      exitPrice: parseNum(exitPrice),
      stopLoss: parseNum(stopLoss),
      initialStopLoss: parseNum(stopLoss),
      lotSize: parseNum(lotSize),
      grossProfit: parseNum(grossProfit),
      commission: parseNum(commission),
      swap: parseNum(swap),
      fees: parseNum(fees),
      profitLossAmount: parseNum(profitLossAmount),
      initialRisk: parseNum(riskAmount),
      breakEvenActivated: breakEvenActivated !== undefined ? Boolean(breakEvenActivated) : false,
      breakEvenPrice: parseNum(breakEvenPrice),
      breakEvenEvidenceSource: breakEvenEvidenceSource || (breakEvenActivated ? 'USER_MANUAL' : null),
      breakEvenEvidenceStatus: breakEvenEvidenceStatus || (breakEvenActivated ? 'USER_CONFIRMED' : null),
      userConfirmedBe: Boolean(breakEvenActivated),
      manualResultOverride: isManualOverride ? rawResult : null,
      userThresholdAmount: userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null,
    });

    const isClosed = tradeStatus === 'CLOSED' || ['WIN', 'LOSS', 'BREAKEVEN'].includes(classification.result);

    // Compute historical FX metadata if trade is closed
    let fxRateToReporting = null;
    let fxRateSource = null;
    let fxRateTimestamp = null;

    if (isClosed) {
      const fxDetails = await currencyService.getExchangeRateDetails(account.currency || 'USD', 'USD');
      fxRateToReporting = fxDetails.rate;
      fxRateSource = fxDetails.source;
      fxRateTimestamp = new Date();
    }

    const trade = await prisma.trade.create({
      data: {
        tradingAccountId,
        pair: pair.toUpperCase().trim(),
        direction,
        entryPrice: parseNum(entryPrice),
        stopLoss: parseNum(stopLoss),
        takeProfit: parseNum(takeProfit),
        exitPrice: parseNum(exitPrice),
        lotSize: parseNum(lotSize),
        riskAmount: parseNum(riskAmount),
        rewardAmount: parseNum(rewardAmount),
        profitLossAmount: parseNum(profitLossAmount),
        profitLossPercent: parseNum(profitLossPercent),
        riskRewardRatio: parseNum(riskRewardRatio),
        pips: computedPips,
        result: classification.result,
        status: tradeStatus,
        grossProfit: classification.grossProfit,
        commission: classification.commission,
        swap: classification.swap,
        fees: classification.fees,
        breakEvenActivated: classification.breakEvenActivated,
        breakEvenPrice: classification.breakEvenPrice,
        breakEvenActivatedAt: classification.breakEvenActivatedAt || (classification.breakEvenActivated ? new Date() : null),
        breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
        breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
        isManualResultOverride: classification.isManualResultOverride,
        classificationSource: classification.classificationSource,
        resultCalculatedAt: classification.resultCalculatedAt,
        session: session || null,
        strategyId: strategyId || null,
        setupId: setupId || null,
        higherTimeframe: higherTimeframe || null,
        entryTimeframe: entryTimeframe || null,
        htfBias: htfBias || null,
        entryReason: entryReason || null,
        exitReason: exitReason || null,
        notesBefore: notesBefore || null,
        notesAfter: notesAfter || null,
        followedPlan: followedPlan !== undefined ? Boolean(followedPlan) : null,
        isAPlusSetup: isAPlusSetup !== undefined ? Boolean(isAPlusSetup) : null,
        newsRelated: newsRelated !== undefined ? Boolean(newsRelated) : null,
        grade: grade || null,
        entryTime: entryTime ? new Date(entryTime) : (tradeStatus === 'PLANNED' ? null : new Date()),
        exitTime: exitTime ? new Date(exitTime) : null,
        fxRateToReporting,
        fxRateSource,
        fxRateTimestamp,
      },
    });

    const { reconcileAccountBalance } = require('../services/accountBalanceService');
    await reconcileAccountBalance(tradingAccountId);
    await syncMentorCohortTradeSharesForTrade(trade, req.user.id);

    res.status(201).json(trade);
  } catch (error) {
    console.error('Error in createTrade:', error);
    res.status(500).json({ message: 'Failed to create trade' });
  }
};

const getTradeById = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      },
      include: {
        tradingAccount: true,
        strategy: true,
        setup: true,
        screenshots: true,
        aiReviews: { orderBy: { createdAt: 'desc' } },
        ruleViolations: { include: { tradeRule: true } },
        emotionLogs: { orderBy: { createdAt: 'desc' } },
        mentorFeedbacks: {
          include: {
            mentor: { select: { id: true, name: true, avatarUrl: true, role: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    res.json(trade);
  } catch (error) {
    console.error('Error in getTradeById:', error);
    res.status(500).json({ message: 'Failed to fetch trade details' });
  }
};

const updateTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const {
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      lotSize,
      riskAmount,
      rewardAmount,
      profitLossAmount,
      profitLossPercent,
      riskRewardRatio,
      pips,
      result,
      status,
      grossProfit,
      commission,
      swap,
      fees,
      breakEvenActivated,
      breakEvenPrice,
      breakEvenEvidenceSource,
      breakEvenEvidenceStatus,
      isManualResultOverride,
      session,
      strategyId,
      setupId,
      higherTimeframe,
      entryTimeframe,
      htfBias,
      entryReason,
      exitReason,
      notesBefore,
      notesAfter,
      followedPlan,
      isAPlusSetup,
      newsRelated,
      grade,
      entryTime,
      exitTime,
    } = req.body;

    const parseNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

    const finalEntryPrice = entryPrice !== undefined ? parseNum(entryPrice) : trade.entryPrice;
    const finalExitPrice = exitPrice !== undefined ? parseNum(exitPrice) : trade.exitPrice;
    const finalPair = pair !== undefined ? (pair ? String(pair).toUpperCase().trim() : null) : trade.pair;
    const finalStatus = status || trade.status;
    const finalDirection = direction ? String(direction).toUpperCase() : trade.direction;
    const finalStopLoss = stopLoss !== undefined ? parseNum(stopLoss) : trade.stopLoss;
    const finalLotSize = lotSize !== undefined ? parseNum(lotSize) : trade.lotSize;
    const finalRiskAmount = riskAmount !== undefined ? parseNum(riskAmount) : trade.riskAmount;
    const finalGrossProfit = grossProfit !== undefined ? parseNum(grossProfit) : trade.grossProfit;
    const finalCommission = commission !== undefined ? parseNum(commission) : trade.commission;
    const finalSwap = swap !== undefined ? parseNum(swap) : trade.swap;
    const finalFees = fees !== undefined ? parseNum(fees) : trade.fees;
    const finalProfitLoss = profitLossAmount !== undefined ? parseNum(profitLossAmount) : trade.profitLossAmount;
    const finalBreakEvenActivated = breakEvenActivated !== undefined ? Boolean(breakEvenActivated) : trade.breakEvenActivated;
    const finalBreakEvenPrice = breakEvenPrice !== undefined ? parseNum(breakEvenPrice) : trade.breakEvenPrice;

    // Lookup user settings for configurable BE tolerance
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
      select: { breakEvenThresholdAmount: true },
    });

    const isManualOverride = isManualResultOverride !== undefined
      ? Boolean(isManualResultOverride)
      : (result !== undefined ? Boolean(result && ['WIN', 'LOSS', 'BREAKEVEN'].includes(result)) : trade.isManualResultOverride);

    const classification = classifyTrade({
      status: finalStatus,
      direction: finalDirection,
      pair: finalPair,
      entryPrice: finalEntryPrice,
      exitPrice: finalExitPrice,
      stopLoss: finalStopLoss,
      initialStopLoss: trade.initialStopLoss,
      lotSize: finalLotSize,
      grossProfit: finalGrossProfit,
      commission: finalCommission,
      swap: finalSwap,
      fees: finalFees,
      profitLossAmount: finalProfitLoss,
      initialRisk: finalRiskAmount,
      breakEvenActivated: finalBreakEvenActivated,
      breakEvenPrice: finalBreakEvenPrice,
      breakEvenEvidenceSource: breakEvenEvidenceSource !== undefined ? breakEvenEvidenceSource : trade.breakEvenEvidenceSource,
      breakEvenEvidenceStatus: breakEvenEvidenceStatus !== undefined ? breakEvenEvidenceStatus : trade.breakEvenEvidenceStatus,
      userConfirmedBe: Boolean(finalBreakEvenActivated),
      manualResultOverride: isManualOverride ? (result || trade.result) : null,
      userThresholdAmount: userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null,
    });

    let computedPips = pips !== undefined ? parseNum(pips) : null;
    if (computedPips === null && finalEntryPrice !== null && finalExitPrice !== null && finalPair) {
      computedPips = calculatePips(finalPair, finalEntryPrice, finalExitPrice, finalDirection);
    }

    let fxRateToReporting = undefined;
    let fxRateSource = undefined;
    let fxRateTimestamp = undefined;

    if (finalPair) {
      const account = await prisma.tradingAccount.findUnique({
        where: { id: trade.tradingAccountId },
        select: { currency: true },
      });
      if (account) {
        const fxInfo = await currencyService.getConversionRateForTrade(finalPair, account.currency || 'USD');
        fxRateToReporting = fxInfo.rate;
        fxRateSource = fxInfo.source;
        fxRateTimestamp = fxInfo.timestamp;
      }
    }

    const updatedTrade = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        pair: finalPair,
        direction: finalDirection,
        entryPrice: finalEntryPrice,
        stopLoss: finalStopLoss,
        takeProfit: takeProfit !== undefined ? parseNum(takeProfit) : undefined,
        exitPrice: finalExitPrice,
        lotSize: finalLotSize,
        riskAmount: finalRiskAmount,
        rewardAmount: rewardAmount !== undefined ? parseNum(rewardAmount) : undefined,
        profitLossAmount: finalProfitLoss,
        profitLossPercent: profitLossPercent !== undefined ? parseNum(profitLossPercent) : undefined,
        riskRewardRatio: riskRewardRatio !== undefined ? parseNum(riskRewardRatio) : undefined,
        pips: computedPips !== null ? computedPips : undefined,
        result: classification.result,
        status: finalStatus,
        grossProfit: classification.grossProfit,
        commission: classification.commission,
        swap: classification.swap,
        fees: classification.fees,
        breakEvenActivated: classification.breakEvenActivated,
        breakEvenPrice: classification.breakEvenPrice,
        breakEvenActivatedAt: classification.breakEvenActivatedAt || (classification.breakEvenActivated ? (trade.breakEvenActivatedAt || new Date()) : null),
        breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
        breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
        isManualResultOverride: classification.isManualResultOverride,
        classificationSource: classification.classificationSource,
        resultCalculatedAt: classification.resultCalculatedAt,
        session: session !== undefined ? session : undefined,
        strategyId: strategyId !== undefined ? strategyId : undefined,
        setupId: setupId !== undefined ? setupId : undefined,
        higherTimeframe: higherTimeframe !== undefined ? higherTimeframe : undefined,
        entryTimeframe: entryTimeframe !== undefined ? entryTimeframe : undefined,
        htfBias: htfBias !== undefined ? htfBias : undefined,
        entryReason: entryReason !== undefined ? entryReason : undefined,
        exitReason: exitReason !== undefined ? exitReason : undefined,
        notesBefore: notesBefore !== undefined ? notesBefore : undefined,
        notesAfter: notesAfter !== undefined ? notesAfter : undefined,
        followedPlan: followedPlan !== undefined ? Boolean(followedPlan) : undefined,
        isAPlusSetup: isAPlusSetup !== undefined ? Boolean(isAPlusSetup) : undefined,
        newsRelated: newsRelated !== undefined ? Boolean(newsRelated) : undefined,
        grade: grade !== undefined ? grade : undefined,
        entryTime: entryTime !== undefined ? (entryTime ? new Date(entryTime) : null) : undefined,
        exitTime: exitTime !== undefined ? (exitTime ? new Date(exitTime) : null) : undefined,
        ...(fxRateToReporting !== undefined && { fxRateToReporting, fxRateSource, fxRateTimestamp }),
      }
    });

    const { reconcileAccountBalance } = require('../services/accountBalanceService');
    await reconcileAccountBalance(trade.tradingAccountId);
    await syncMentorCohortTradeSharesForTrade(updatedTrade, req.user.id);

    res.json(updatedTrade);
  } catch (error) {
    console.error('Error in updateTrade:', error);
    res.status(500).json({ message: 'Failed to update trade' });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const accountId = trade.tradingAccountId;

    await prisma.trade.delete({
      where: { id: req.params.id }
    });

    const { reconcileAccountBalance } = require('../services/accountBalanceService');
    await reconcileAccountBalance(accountId);

    res.json({ message: 'Trade removed successfully' });
  } catch (error) {
    console.error('Error in deleteTrade:', error);
    res.status(500).json({ message: 'Failed to delete trade' });
  }
};

const updateTradeReview = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const { notesAfter, grade, followedPlan, isAPlusSetup, newsRelated } = req.body;

    const updated = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        notesAfter: notesAfter !== undefined ? notesAfter : undefined,
        grade: grade !== undefined ? grade : undefined,
        followedPlan: followedPlan !== undefined ? Boolean(followedPlan) : undefined,
        isAPlusSetup: isAPlusSetup !== undefined ? Boolean(isAPlusSetup) : undefined,
        newsRelated: newsRelated !== undefined ? Boolean(newsRelated) : undefined,
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error in updateTradeReview:', error);
    res.status(500).json({ message: 'Failed to update trade review' });
  }
};

const exportTradesCsv = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: buildTradeListWhere(req.query, req.user.id),
      include: { tradingAccount: { select: { name: true, currency: true } } },
      orderBy: { entryTime: 'desc' },
    });

    if (trades.length === 0) {
      return res.status(404).json({ message: 'No trades found to export.' });
    }

    const headers = [
      'id', 'account', 'currency', 'pair', 'direction', 'entryPrice', 'stopLoss', 
      'takeProfit', 'exitPrice', 'lotSize', 'riskAmount', 'rewardAmount',
      'profitLossAmount', 'profitLossPercent', 'riskRewardRatio', 'pips',
      'status', 'result', 'session', 'fxRateToReporting', 'fxRateSource', 'fxRateTimestamp',
      'higherTimeframe', 'entryTimeframe', 'htfBias', 'entryReason', 'exitReason',
      'notesBefore', 'notesAfter', 'followedPlan', 'isAPlusSetup', 'newsRelated', 'grade',
      'entryTime', 'exitTime'
    ];

    const escapeCsvField = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];

    trades.forEach(t => {
      const row = [
        t.id,
        t.tradingAccount?.name || '',
        t.tradingAccount?.currency || 'USD',
        t.pair || '',
        t.direction || '',
        t.entryPrice ?? '',
        t.stopLoss ?? '',
        t.takeProfit ?? '',
        t.exitPrice ?? '',
        t.lotSize ?? '',
        t.riskAmount ?? '',
        t.rewardAmount ?? '',
        t.profitLossAmount ?? '',
        t.profitLossPercent ?? '',
        t.riskRewardRatio ?? '',
        t.pips ?? '',
        t.status || '',
        t.result || '',
        t.session || '',
        t.fxRateToReporting ?? '',
        t.fxRateSource || '',
        t.fxRateTimestamp ? new Date(t.fxRateTimestamp).toISOString() : '',
        t.higherTimeframe || '',
        t.entryTimeframe || '',
        t.htfBias || '',
        t.entryReason || '',
        t.exitReason || '',
        t.notesBefore || '',
        t.notesAfter || '',
        t.followedPlan ?? '',
        t.isAPlusSetup ?? '',
        t.newsRelated ?? '',
        t.grade || '',
        t.entryTime ? new Date(t.entryTime).toISOString() : '',
        t.exitTime ? new Date(t.exitTime).toISOString() : '',
      ];
      csvLines.push(row.map(escapeCsvField).join(','));
    });

    res.setHeader('Content-disposition', 'attachment; filename=jahzjournals_trades.csv');
    res.setHeader('Content-type', 'text/csv');
    res.status(200).send(csvLines.join('\n'));
  } catch (error) {
    console.error('Error exporting trades CSV:', error);
    res.status(500).json({ message: 'Could not export trades at this time.' });
  }
};

/**
 * Get Unique Traded Pairs (scoped to user or specific account)
 * GET /api/trades/traded-pairs?accountId=...
 */
const getTradedPairs = async (req, res) => {
  try {
    const { accountId } = req.query;
    const where = {
      tradingAccount: { userId: req.user.id },
    };
    if (accountId) {
      where.tradingAccountId = accountId;
    }
    const pairs = await prisma.trade.findMany({
      where,
      select: { pair: true },
      distinct: ['pair'],
      orderBy: { pair: 'asc' },
    });
    const pairList = pairs.map((p) => p.pair).filter(Boolean);
    res.json(pairList);
  } catch (error) {
    console.error('Error fetching traded pairs:', error);
    res.status(500).json({ message: 'Failed to fetch traded pairs' });
  }
};

const captureTradeFromScreenshot = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload a trade screenshot to analyze.' });
    }

    const { extractTradeFromScreenshot } = require('../jobs/processors/processScreenshotTradeCapture');

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
    });
    const userThresholdAmount = userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null;

    const result = await extractTradeFromScreenshot({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype || 'image/png',
      userThresholdAmount,
    });

    res.json(result);
  } catch (error) {
    console.error('Error extracting trade from screenshot:', error);
    res.status(500).json({ message: error.message || 'Failed to extract trade from screenshot.' });
  }
};

module.exports = {
  getTrades,
  createTrade,
  getTradeById,
  updateTrade,
  deleteTrade,
  updateTradeReview,
  exportTradesCsv,
  getTradedPairs,
  captureTradeFromScreenshot,
};
