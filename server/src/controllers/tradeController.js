const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { destroyScreenshots } = require('../services/screenshotService');
const { quickTradeSchema, tradeReviewSchema, ruleViolationSchema, emotionLogSchema } = require('../validation/tradeSchemas');
const { calculateRiskReward, calculateTradeResult, normalizeTradeState } = require('../utils/tradeCalculations');
const { evaluateTradeAgainstRules } = require('../services/ruleCheckService');

const hasValue = (value) => value !== undefined && value !== null && value !== '';
const parseOptionalFloat = (value) => (hasValue(value) ? Number.parseFloat(value) : null);
const parseOptionalDate = (value) => (hasValue(value) ? new Date(value) : null);
const parseOptionalBoolean = (value) => {
  if (!hasValue(value)) return null;
  return value === true || value === 'true' || value === 'on';
};

const optionalString = (value) => (hasValue(value) ? value : null);
const parseDateFilter = (value) => {
  if (!hasValue(value)) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
};

const buildTradeListWhere = (query, userId) => {
  const where = { tradingAccount: { userId } };

  if (hasValue(query.accountId)) {
    where.tradingAccountId = String(query.accountId);
  }

  if (hasValue(query.pair)) {
    where.pair = String(query.pair).trim().toUpperCase();
  }

  const date = parseDateFilter(query.date);
  if (date) {
    where.OR = [
      { entryTime: { gte: date.start, lte: date.end } },
      { exitTime: { gte: date.start, lte: date.end } },
      { createdAt: { gte: date.start, lte: date.end } },
    ];
  }

  return where;
};

const emotionStages = ['BEFORE_TRADE', 'DURING_TRADE', 'AFTER_TRADE'];
const emotions = [
  'CALM',
  'CONFIDENT',
  'ANXIOUS',
  'GREEDY',
  'FEARFUL',
  'ANGRY',
  'FOMO',
  'REVENGE_MINDSET',
  'DISCIPLINED',
  'REGRETFUL',
  'FRUSTRATED',
];
const violationSeverities = ['MINOR', 'MODERATE', 'MAJOR'];
const closedTradeResults = new Set(['WIN', 'LOSS', 'BREAKEVEN']);

const syncRuleViolations = async (tx, tradeId, incomingViolations) => {
  if (!incomingViolations) return;
  const existingRecords = await tx.tradeRuleViolation.findMany({ where: { tradeId } });
  const existingMap = new Map(existingRecords.map((r) => [r.id, r]));

  for (const v of incomingViolations) {
    if (!v.tradeRuleId) continue;
    const severity = violationSeverities.includes(v.severity) ? v.severity : 'MINOR';
    if (v.id && existingMap.has(v.id)) {
      await tx.tradeRuleViolation.update({
        where: { id: v.id },
        data: { severity, note: v.note || null },
      });
      existingMap.delete(v.id);
    } else {
      await tx.tradeRuleViolation.create({
        data: { tradeId, tradeRuleId: v.tradeRuleId, severity, note: v.note || null },
      });
    }
  }

  const idsToDelete = Array.from(existingMap.keys());
  if (idsToDelete.length > 0) {
    await tx.tradeRuleViolation.deleteMany({ where: { id: { in: idsToDelete } } });
  }
};

const syncEmotionLogs = async (tx, tradeId, incomingLogs) => {
  if (!incomingLogs) return;
  const existingRecords = await tx.emotionLog.findMany({ where: { tradeId } });
  const existingMap = new Map(existingRecords.map((r) => [r.id, r]));

  for (const log of incomingLogs) {
    const intensity = Number.parseInt(log.intensity, 10);
    if (log.id && existingMap.has(log.id)) {
      await tx.emotionLog.update({
        where: { id: log.id },
        data: { stage: log.stage, emotion: log.emotion, intensity, note: log.note || null },
      });
      existingMap.delete(log.id);
    } else {
      await tx.emotionLog.create({
        data: { tradeId, stage: log.stage, emotion: log.emotion, intensity, note: log.note || null },
      });
    }
  }

  const idsToDelete = Array.from(existingMap.keys());
  if (idsToDelete.length > 0) {
    await tx.emotionLog.deleteMany({ where: { id: { in: idsToDelete } } });
  }
};

const syncChecklistResponses = async (tx, tradeId, incomingResponses) => {
  if (!incomingResponses) return;
  const existingRecords = await tx.tradeChecklistResponse.findMany({ where: { tradeId } });
  const existingMap = new Map(existingRecords.map((r) => [r.checklistItemId, r]));

  for (const resp of incomingResponses) {
    if (!resp.checklistItemId) continue;
    if (existingMap.has(resp.checklistItemId)) {
      await tx.tradeChecklistResponse.update({
        where: { id: existingMap.get(resp.checklistItemId).id },
        data: { checked: resp.checked, notes: resp.notes || null },
      });
      existingMap.delete(resp.checklistItemId);
    } else {
      await tx.tradeChecklistResponse.create({
         data: { tradeId, checklistItemId: resp.checklistItemId, checked: Boolean(resp.checked), notes: resp.notes || null }
      });
    }
  }

  const idsToDelete = Array.from(existingMap.values()).map(r => r.id);
  if (idsToDelete.length > 0) {
    await tx.tradeChecklistResponse.deleteMany({ where: { id: { in: idsToDelete } } });
  }
};

const buildTradeData = (tradeData, existingTrade = {}) => {
  const direction = tradeData.direction || existingTrade.direction;
  const status = tradeData.status || existingTrade.status || 'PLANNED';
  const entryPrice = hasValue(tradeData.entryPrice) ? tradeData.entryPrice : existingTrade.entryPrice;
  const stopLoss = hasValue(tradeData.stopLoss) ? tradeData.stopLoss : existingTrade.stopLoss;
  const takeProfit = hasValue(tradeData.takeProfit) ? tradeData.takeProfit : existingTrade.takeProfit;
  const profitLossAmount = hasValue(tradeData.profitLossAmount) ? tradeData.profitLossAmount : existingTrade.profitLossAmount;

  // Derive R/R
  const { rewardDistance, riskRewardRatio } = calculateRiskReward(direction, entryPrice, stopLoss, takeProfit);
  
  // Derive result from status and realised P/L so CLOSED trades cannot keep the form's default OPEN result.
  const calculatedResult = calculateTradeResult(status, profitLossAmount, tradeData.result);

  const rawTrade = {
    pair: hasValue(tradeData.pair) ? tradeData.pair.trim().toUpperCase() : existingTrade.pair,
    direction,
    entryPrice: parseOptionalFloat(tradeData.entryPrice),
    stopLoss: parseOptionalFloat(tradeData.stopLoss),
    takeProfit: parseOptionalFloat(tradeData.takeProfit),
    exitPrice: parseOptionalFloat(tradeData.exitPrice),
    lotSize: parseOptionalFloat(tradeData.lotSize),
    riskAmount: parseOptionalFloat(tradeData.riskAmount),
    rewardAmount: parseOptionalFloat(tradeData.rewardAmount) || rewardDistance,
    profitLossAmount: parseOptionalFloat(tradeData.profitLossAmount),
    profitLossPercent: parseOptionalFloat(tradeData.profitLossPercent),
    riskRewardRatio: parseOptionalFloat(tradeData.riskRewardRatio) || riskRewardRatio,
    pips: parseOptionalFloat(tradeData.pips),
    result: calculatedResult,
    status,
    session: optionalString(tradeData.session),
    strategyId: optionalString(tradeData.strategyId) || existingTrade.strategyId || null,
    setupId: optionalString(tradeData.setupId) || existingTrade.setupId || null,
    higherTimeframe: optionalString(tradeData.higherTimeframe),
    entryTimeframe: optionalString(tradeData.entryTimeframe),
    htfBias: optionalString(tradeData.htfBias),
    entryReason: optionalString(tradeData.entryReason),
    exitReason: optionalString(tradeData.exitReason),
    notesBefore: optionalString(tradeData.notesBefore),
    notesAfter: optionalString(tradeData.notesAfter),
    followedPlan: parseOptionalBoolean(tradeData.followedPlan),
    isAPlusSetup: parseOptionalBoolean(tradeData.isAPlusSetup),
    newsRelated: parseOptionalBoolean(tradeData.newsRelated),
    grade: optionalString(tradeData.grade),
    entryTime: parseOptionalDate(tradeData.entryTime),
    exitTime: parseOptionalDate(tradeData.exitTime),
  };
  
  return normalizeTradeState(rawTrade);
};

const getTrades = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: buildTradeListWhere(req.query, req.user.id),
      include: { tradingAccount: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: 'We couldn\'t retrieve your trades right now.' });
  }
};

const createTrade = async (req, res) => {
  try {
    const tradeData = req.body;

    const validation = quickTradeSchema.safeParse(tradeData);
    if (!validation.success) {
      return res.status(400).json({ message: 'Check your trade details and try again.', errors: validation.error.flatten() });
    }

    const account = await prisma.tradingAccount.findFirst({
        where: { id: tradeData.tradingAccountId, userId: req.user.id }
    });
    if (!account) return res.status(404).json({ message: 'We couldn\'t find that trading account.' });

    const normalizedData = buildTradeData(tradeData);
    const trade = await prisma.$transaction(async (tx) => {
      const createdTrade = await tx.trade.create({
        data: {
          tradingAccountId: tradeData.tradingAccountId,
          ...normalizedData,
          checklistResponses: Array.isArray(tradeData.checklistResponses) ? {
             create: tradeData.checklistResponses.map(r => ({
                checklistItemId: r.checklistItemId,
                checked: Boolean(r.checked),
                notes: r.notes || null
             }))
          } : undefined
        }
      });

      if (createdTrade.status === 'CLOSED' && typeof createdTrade.profitLossAmount === 'number' && createdTrade.profitLossAmount !== 0) {
        await tx.tradingAccount.update({
          where: { id: createdTrade.tradingAccountId },
          data: { currentBalance: { increment: createdTrade.profitLossAmount } }
        });
      }

      // Auto-log system violations
      const evalRes = await evaluateTradeAgainstRules(req.user.id, normalizedData);
      if (evalRes.warnings && evalRes.warnings.length > 0) {
         let systemRule = await tx.tradeRule.findFirst({
            where: { userId: req.user.id, name: 'System Rule Violation' }
         });
         if (!systemRule) {
            systemRule = await tx.tradeRule.create({
               data: { userId: req.user.id, name: 'System Rule Violation', category: 'RISK_MANAGEMENT', active: true }
            });
         }
         for (const warning of evalRes.warnings) {
            await tx.tradeRuleViolation.create({
               data: {
                  tradeId: createdTrade.id,
                  tradeRuleId: systemRule.id,
                  severity: 'MODERATE',
                  note: `[AUTO-DETECTED] ${warning}`
               }
            });
         }
      }

      return createdTrade;
    });

    res.status(201).json(trade);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'We hit a snag saving your trade.' });
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
        tradingAccount: { select: { id: true, name: true } },
        strategy: { select: { id: true, name: true, style: true } },
        setup: { select: { id: true, name: true } },
        checklistResponses: true,
        screenshots: true,
        ruleViolations: {
          include: {
            tradeRule: { select: { id: true, name: true, active: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        emotionLogs: { orderBy: { createdAt: 'asc' } },
        aiReviews: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (trade) {
      res.json(trade);
    } else {
      res.status(404).json({ message: 'We couldn\'t find that trade. It may have been deleted.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Our servers encountered an issue.' });
  }
};

const updateTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, tradingAccount: { userId: req.user.id } }
    });

    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find that trade. It may have been deleted.' });
    }

    const tradeData = req.body;
    let tradingAccountId = trade.tradingAccountId;
    const nextStatus = tradeData.status || trade.status;
    const nextResult = tradeData.result ?? trade.result;
    const nextProfitLossAmount = Object.prototype.hasOwnProperty.call(tradeData, 'profitLossAmount')
      ? tradeData.profitLossAmount
      : trade.profitLossAmount;

    if (nextStatus === 'CLOSED' && !hasValue(nextProfitLossAmount) && !closedTradeResults.has(nextResult)) {
      return res.status(400).json({ message: 'We need a result or realized P/L to close this trade.' });
    }

    if (tradeData.tradingAccountId && tradeData.tradingAccountId !== trade.tradingAccountId) {
      const account = await prisma.tradingAccount.findFirst({
        where: { id: tradeData.tradingAccountId, userId: req.user.id }
      });

      if (!account) {
        return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
      }

      tradingAccountId = tradeData.tradingAccountId;
    }

    const ruleViolations = Array.isArray(tradeData.ruleViolations) ? tradeData.ruleViolations : null;
    const emotionLogs = Array.isArray(tradeData.emotionLogs) ? tradeData.emotionLogs : null;

    if (ruleViolations) {
      const ruleIds = [...new Set(ruleViolations.map((violation) => violation.tradeRuleId).filter(Boolean))];
      const ownedRules = await prisma.tradeRule.findMany({
        where: { id: { in: ruleIds }, userId: req.user.id },
        select: { id: true },
      });
      const ownedRuleIds = new Set(ownedRules.map((rule) => rule.id));
      const hasInvalidRule = ruleIds.some((ruleId) => !ownedRuleIds.has(ruleId));

      if (hasInvalidRule) {
        return res.status(400).json({ message: 'Some of the rules you logged don\'t seem to exist.' });
      }
    }

    if (emotionLogs) {
      const invalidEmotion = emotionLogs.some((log) => {
        const intensity = Number.parseInt(log.intensity, 10);
        return !emotionStages.includes(log.stage)
          || !emotions.includes(log.emotion)
          || Number.isNaN(intensity)
          || intensity < 1
          || intensity > 10;
      });

      if (invalidEmotion) {
        return res.status(400).json({ message: 'Some of your emotion logs have invalid values.' });
      }
    }

    const updatedTrade = await prisma.$transaction(async (tx) => {
      const normalizedData = buildTradeData({ ...trade, ...tradeData }, trade);
      
      const oldAccountId = trade.tradingAccountId;
      const newAccountId = tradingAccountId;
      const oldPL = (trade.status === 'CLOSED' && typeof trade.profitLossAmount === 'number') ? trade.profitLossAmount : 0;
      const newPL = (normalizedData.status === 'CLOSED' && typeof normalizedData.profitLossAmount === 'number') ? normalizedData.profitLossAmount : 0;

      if (oldAccountId === newAccountId) {
        const diff = newPL - oldPL;
        if (diff !== 0) {
          await tx.tradingAccount.update({
             where: { id: oldAccountId },
             data: { currentBalance: { increment: diff } }
          });
        }
      } else {
        if (oldPL !== 0) {
          await tx.tradingAccount.update({
             where: { id: oldAccountId },
             data: { currentBalance: { decrement: oldPL } }
          });
        }
        if (newPL !== 0) {
          await tx.tradingAccount.update({
             where: { id: newAccountId },
             data: { currentBalance: { increment: newPL } }
          });
        }
      }

      const savedTrade = await tx.trade.update({
        where: { id: req.params.id },
        data: {
          tradingAccountId,
          ...normalizedData,
        }
      });

      if (ruleViolations) {
        await syncRuleViolations(tx, req.params.id, ruleViolations);
      }

      if (emotionLogs) {
        await syncEmotionLogs(tx, req.params.id, emotionLogs);
      }

      if (Array.isArray(tradeData.checklistResponses)) {
        await syncChecklistResponses(tx, req.params.id, tradeData.checklistResponses);
      }

      // Auto-log system violations
      const evalRes = await evaluateTradeAgainstRules(req.user.id, normalizedData);
      if (evalRes.warnings && evalRes.warnings.length > 0) {
         let systemRule = await tx.tradeRule.findFirst({
            where: { userId: req.user.id, name: 'System Rule Violation' }
         });
         if (!systemRule) {
            systemRule = await tx.tradeRule.create({
               data: { userId: req.user.id, name: 'System Rule Violation', category: 'RISK_MANAGEMENT', active: true }
            });
         }
         
         // Only log if it's not already logged to prevent duplicates on edits
         const existingAutoLogs = await tx.tradeRuleViolation.findMany({
            where: { tradeId: req.params.id, tradeRuleId: systemRule.id }
         });

         for (const warning of evalRes.warnings) {
            const warningText = `[AUTO-DETECTED] ${warning}`;
            if (!existingAutoLogs.some(log => log.note === warningText)) {
              await tx.tradeRuleViolation.create({
                 data: {
                    tradeId: req.params.id,
                    tradeRuleId: systemRule.id,
                    severity: 'MODERATE',
                    note: warningText
                 }
              });
            }
         }
      }

      return tx.trade.findUnique({
        where: { id: savedTrade.id },
        include: {
          tradingAccount: { select: { id: true, name: true } },
          strategy: true,
          setup: true,
          checklistResponses: true,
          screenshots: true,
          ruleViolations: { include: { tradeRule: { select: { id: true, name: true, active: true } } } },
          emotionLogs: true,
        },
      });
    });

    res.json(updatedTrade);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag updating your trade.' });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, tradingAccount: { userId: req.user.id } },
      include: { screenshots: true },
    });

    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find that trade to delete.' });
    }

    try {
      await destroyScreenshots(trade.screenshots);
    } catch (error) {
      console.warn(`Trade ${trade.id} deleted, but screenshot asset cleanup failed: ${error.message}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.trade.delete({ where: { id: req.params.id } });
      if (trade.status === 'CLOSED' && typeof trade.profitLossAmount === 'number' && trade.profitLossAmount !== 0) {
        await tx.tradingAccount.update({
          where: { id: trade.tradingAccountId },
          data: { currentBalance: { decrement: trade.profitLossAmount } }
        });
      }
    });

    res.json({ message: 'Trade removed from your sanctuary.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t delete that trade right now.' });
  }
};

const updateTradeReview = async (req, res) => {
  try {
    const validation = tradeReviewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Check your review details and try again.', errors: validation.error.flatten() });
    }
    const tradeData = validation.data;

    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, tradingAccount: { userId: req.user.id } }
    });

    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find that trade to review.' });
    }

    const { ruleViolations, emotionLogs, ...contextData } = tradeData;

    // Verify rules if provided
    if (ruleViolations && ruleViolations.length > 0) {
      const ruleIds = [...new Set(ruleViolations.map((v) => v.tradeRuleId))];
      const ownedRules = await prisma.tradeRule.findMany({
        where: { id: { in: ruleIds }, userId: req.user.id },
        select: { id: true },
      });
      if (ownedRules.length !== ruleIds.length) {
        return res.status(400).json({ message: 'Some of the rules you selected don\'t seem to exist.' });
      }
    }

    const updatedTrade = await prisma.$transaction(async (tx) => {
      // 1. Update context
      const dataToUpdate = {};
      if (contextData.session !== undefined) dataToUpdate.session = contextData.session || null;
      if (contextData.higherTimeframe !== undefined) dataToUpdate.higherTimeframe = contextData.higherTimeframe || null;
      if (contextData.entryTimeframe !== undefined) dataToUpdate.entryTimeframe = contextData.entryTimeframe || null;
      if (contextData.htfBias !== undefined) dataToUpdate.htfBias = contextData.htfBias || null;
      if (contextData.isAPlusSetup !== undefined) dataToUpdate.isAPlusSetup = contextData.isAPlusSetup === '' ? null : contextData.isAPlusSetup;
      if (contextData.followedPlan !== undefined) dataToUpdate.followedPlan = contextData.followedPlan === '' ? null : contextData.followedPlan;
      if (contextData.newsRelated !== undefined) dataToUpdate.newsRelated = contextData.newsRelated === '' ? null : contextData.newsRelated;
      if (contextData.grade !== undefined) dataToUpdate.grade = contextData.grade || null;
      if (contextData.entryReason !== undefined) dataToUpdate.entryReason = contextData.entryReason || null;
      if (contextData.exitReason !== undefined) dataToUpdate.exitReason = contextData.exitReason || null;
      if (contextData.notesBefore !== undefined) dataToUpdate.notesBefore = contextData.notesBefore || null;
      if (contextData.notesAfter !== undefined) dataToUpdate.notesAfter = contextData.notesAfter || null;

      const savedTrade = await tx.trade.update({
        where: { id: req.params.id },
        data: dataToUpdate,
      });

      // 2. Upsert Rule Violations
      if (ruleViolations) {
        await syncRuleViolations(tx, req.params.id, ruleViolations);
      }

      // 3. Upsert Emotions
      if (emotionLogs) {
        await syncEmotionLogs(tx, req.params.id, emotionLogs);
      }

      return tx.trade.findUnique({
        where: { id: savedTrade.id },
        include: {
          tradingAccount: { select: { id: true, name: true } },
          screenshots: true,
          ruleViolations: { include: { tradeRule: { select: { id: true, name: true, active: true } } } },
          emotionLogs: true,
        },
      });
    });

    res.json(updatedTrade);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag saving your review.' });
  }
};

const exportTradesCsv = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: buildTradeListWhere(req.query, req.user.id),
      include: { tradingAccount: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (trades.length === 0) {
      return res.status(404).json({ message: 'No trades found to export.' });
    }

    const csvRows = ['id,account,pair,direction,entryPrice,stopLoss,takeProfit,exitPrice,profitLossAmount,pips,status,result,entryTime,exitTime'];
    trades.forEach(t => {
      csvRows.push(`${t.id},${t.tradingAccount.name},${t.pair},${t.direction},${t.entryPrice},${t.stopLoss},${t.takeProfit},${t.exitPrice},${t.profitLossAmount},${t.pips},${t.status},${t.result},${t.entryTime},${t.exitTime}`);
    });

    res.setHeader('Content-disposition', 'attachment; filename=jahzjournals_trades.csv');
    res.setHeader('Content-type', 'text/csv');
    res.status(200).send(csvRows.join('\\n'));
  } catch (error) {
    res.status(500).json({ message: 'Could not export trades at this time.' });
  }
};

module.exports = {
  getTrades,
  createTrade,
  getTradeById,
  updateTrade,
  deleteTrade,
  updateTradeReview,
  exportTradesCsv
};
