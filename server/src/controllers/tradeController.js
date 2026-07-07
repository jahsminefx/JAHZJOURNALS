const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { destroyScreenshots } = require('../services/screenshotService');

const hasValue = (value) => value !== undefined && value !== null && value !== '';
const parseOptionalFloat = (value) => (hasValue(value) ? Number.parseFloat(value) : null);
const parseOptionalDate = (value) => (hasValue(value) ? new Date(value) : null);
const parseOptionalBoolean = (value) => {
  if (!hasValue(value)) return null;
  return value === true || value === 'true' || value === 'on';
};

const optionalString = (value) => (hasValue(value) ? value : null);
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

const buildTradeData = (tradeData, existingTrade = {}) => ({
  pair: hasValue(tradeData.pair) ? tradeData.pair.trim().toUpperCase() : existingTrade.pair,
  direction: tradeData.direction || existingTrade.direction,
  entryPrice: parseOptionalFloat(tradeData.entryPrice),
  stopLoss: parseOptionalFloat(tradeData.stopLoss),
  takeProfit: parseOptionalFloat(tradeData.takeProfit),
  exitPrice: parseOptionalFloat(tradeData.exitPrice),
  lotSize: parseOptionalFloat(tradeData.lotSize),
  riskAmount: parseOptionalFloat(tradeData.riskAmount),
  rewardAmount: parseOptionalFloat(tradeData.rewardAmount),
  profitLossAmount: parseOptionalFloat(tradeData.profitLossAmount),
  profitLossPercent: parseOptionalFloat(tradeData.profitLossPercent),
  riskRewardRatio: parseOptionalFloat(tradeData.riskRewardRatio),
  pips: parseOptionalFloat(tradeData.pips),
  result: tradeData.result || existingTrade.result || 'OPEN',
  status: tradeData.status || existingTrade.status || 'PLANNED',
  session: optionalString(tradeData.session),
  setupType: optionalString(tradeData.setupType),
  strategyName: optionalString(tradeData.strategyName),
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
});

const getTrades = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { tradingAccount: { userId: req.user.id } },
      include: { tradingAccount: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
};

const createTrade = async (req, res) => {
  try {
    const tradeData = req.body;

    if (!tradeData.tradingAccountId || !tradeData.pair || !tradeData.direction) {
      return res.status(400).json({ message: 'Account, pair, and direction are required' });
    }

    // Ensure account belongs to user
    const account = await prisma.tradingAccount.findFirst({
        where: { id: tradeData.tradingAccountId, userId: req.user.id }
    });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const trade = await prisma.trade.create({
      data: {
        tradingAccountId: tradeData.tradingAccountId,
        ...buildTradeData(tradeData),
      }
    });

    res.status(201).json(trade);
  } catch (error) {
    console.log(error);
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
        tradingAccount: { select: { id: true, name: true } },
        screenshots: true,
        ruleViolations: {
          include: {
            tradeRule: { select: { id: true, name: true, active: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        emotionLogs: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (trade) {
      res.json(trade);
    } else {
      res.status(404).json({ message: 'Trade not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, tradingAccount: { userId: req.user.id } }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const tradeData = req.body;
    let tradingAccountId = trade.tradingAccountId;

    if (tradeData.tradingAccountId && tradeData.tradingAccountId !== trade.tradingAccountId) {
      const account = await prisma.tradingAccount.findFirst({
        where: { id: tradeData.tradingAccountId, userId: req.user.id }
      });

      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
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
        return res.status(400).json({ message: 'One or more selected rules are invalid' });
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
        return res.status(400).json({ message: 'One or more emotion logs are invalid' });
      }
    }

    const updatedTrade = await prisma.$transaction(async (tx) => {
      const savedTrade = await tx.trade.update({
        where: { id: req.params.id },
        data: {
          tradingAccountId,
          ...buildTradeData({ ...trade, ...tradeData }, trade),
        }
      });

      if (ruleViolations) {
        await tx.tradeRuleViolation.deleteMany({ where: { tradeId: req.params.id } });
        if (ruleViolations.length > 0) {
          await tx.tradeRuleViolation.createMany({
            data: ruleViolations
              .filter((violation) => violation.tradeRuleId)
              .map((violation) => ({
                tradeId: req.params.id,
                tradeRuleId: violation.tradeRuleId,
                severity: violationSeverities.includes(violation.severity) ? violation.severity : 'MINOR',
                note: violation.note || null,
              })),
          });
        }
      }

      if (emotionLogs) {
        await tx.emotionLog.deleteMany({ where: { tradeId: req.params.id } });
        if (emotionLogs.length > 0) {
          await tx.emotionLog.createMany({
            data: emotionLogs.map((log) => ({
              tradeId: req.params.id,
              stage: log.stage,
              emotion: log.emotion,
              intensity: Number.parseInt(log.intensity, 10),
              note: log.note || null,
            })),
          });
        }
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
    res.status(500).json({ message: 'Failed to update trade' });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, tradingAccount: { userId: req.user.id } },
      include: { screenshots: true },
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    await destroyScreenshots(trade.screenshots);
    await prisma.trade.delete({ where: { id: req.params.id } });

    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete trade' });
  }
};

module.exports = {
  getTrades,
  createTrade,
  getTradeById,
  updateTrade,
  deleteTrade
};
