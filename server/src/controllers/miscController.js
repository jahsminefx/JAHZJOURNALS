const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

const parseBoolean = (value) => value === true || value === 'true' || value === 'on';

const getUserTrade = async (tradeId, userId) => prisma.trade.findFirst({
  where: {
    id: tradeId,
    tradingAccount: { userId },
  },
});

const getRules = async (req, res) => {
  try {
    const rules = await prisma.tradeRule.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(rules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch rules' });
  }
};

const createRule = async (req, res) => {
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Rule name is required' });
    }

    const rule = await prisma.tradeRule.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        description: description || null,
        active: active === undefined ? true : parseBoolean(active),
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create rule' });
  }
};

const getRuleById = async (req, res) => {
  try {
    const rule = await prisma.tradeRule.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        _count: { select: { violations: true } },
      },
    });

    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch rule' });
  }
};

const updateRule = async (req, res) => {
  try {
    const rule = await prisma.tradeRule.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const { name, description, active } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Rule name is required' });
    }

    const updatedRule = await prisma.tradeRule.update({
      where: { id: rule.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(active !== undefined && { active: parseBoolean(active) }),
      },
    });

    res.json(updatedRule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update rule' });
  }
};

const updateRuleStatus = async (req, res) => {
  try {
    const rule = await prisma.tradeRule.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    if (typeof req.body.active !== 'boolean' && typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ message: 'Rule status must be a boolean' });
    }

    const active = typeof req.body.active === 'boolean' ? req.body.active : req.body.isActive;
    const updatedRule = await prisma.tradeRule.update({
      where: { id: rule.id },
      data: { active },
    });

    res.json(updatedRule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update rule status' });
  }
};

const deleteRule = async (req, res) => {
  try {
    const rule = await prisma.tradeRule.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        _count: { select: { violations: true } },
      },
    });

    if (!rule) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    if (rule._count.violations > 0) {
      return res.status(409).json({
        message: 'This rule has historical violations. Disable it instead of deleting it to preserve journal history.',
      });
    }

    await prisma.tradeRule.delete({ where: { id: rule.id } });
    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete rule' });
  }
};

const logEmotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, emotion, intensity, note } = req.body;
    const parsedIntensity = Number.parseInt(intensity, 10);

    if (!emotionStages.includes(stage) || !emotions.includes(emotion)) {
      return res.status(400).json({ message: 'A valid stage and emotion are required' });
    }

    if (Number.isNaN(parsedIntensity) || parsedIntensity < 1 || parsedIntensity > 10) {
      return res.status(400).json({ message: 'Emotion intensity must be between 1 and 10' });
    }

    const trade = await getUserTrade(id, req.user.id);

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const emotionLog = await prisma.emotionLog.create({
      data: {
        tradeId: id,
        stage,
        emotion,
        intensity: parsedIntensity,
        note: note || null,
      },
    });

    res.status(201).json(emotionLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to log emotion' });
  }
};

const updateEmotion = async (req, res) => {
  try {
    const { stage, emotion, intensity, note } = req.body;
    const parsedIntensity = Number.parseInt(intensity, 10);

    if (!emotionStages.includes(stage) || !emotions.includes(emotion)) {
      return res.status(400).json({ message: 'A valid stage and emotion are required' });
    }

    if (Number.isNaN(parsedIntensity) || parsedIntensity < 1 || parsedIntensity > 10) {
      return res.status(400).json({ message: 'Emotion intensity must be between 1 and 10' });
    }

    const emotionLog = await prisma.emotionLog.findFirst({
      where: {
        id: req.params.id,
        trade: {
          tradingAccount: {
            userId: req.user.id,
          },
        },
      },
    });

    if (!emotionLog) {
      return res.status(404).json({ message: 'Emotion log not found' });
    }

    const updatedEmotion = await prisma.emotionLog.update({
      where: { id: emotionLog.id },
      data: {
        stage,
        emotion,
        intensity: parsedIntensity,
        note: note || null,
      },
    });

    res.json(updatedEmotion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update emotion log' });
  }
};

const deleteEmotion = async (req, res) => {
  try {
    const emotionLog = await prisma.emotionLog.findFirst({
      where: {
        id: req.params.id,
        trade: {
          tradingAccount: {
            userId: req.user.id,
          },
        },
      },
    });

    if (!emotionLog) {
      return res.status(404).json({ message: 'Emotion log not found' });
    }

    await prisma.emotionLog.delete({ where: { id: emotionLog.id } });
    res.json({ message: 'Emotion log deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete emotion log' });
  }
};

const createAiTradeReview = async (req, res) => {
  try {
    const { id, tradeId } = req.params;
    const targetTradeId = tradeId || id;
    const trade = await prisma.trade.findFirst({
      where: {
        id: targetTradeId,
        tradingAccount: { userId: req.user.id },
      },
      include: {
        ruleViolations: true,
        emotionLogs: true,
      },
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const profitLoss = Number(trade.profitLossAmount || 0);
    const resultText = trade.result === 'OPEN'
      ? 'This trade is still open, so the review focuses on preparation and risk.'
      : `This trade closed as ${trade.result.toLowerCase()} with P/L of ${profitLoss.toFixed(2)}.`;

    const mistakes = [
      trade.followedPlan === false ? 'The trade was marked as not following the plan.' : null,
      trade.ruleViolations.length > 0 ? `${trade.ruleViolations.length} rule violation(s) were logged.` : null,
      trade.emotionLogs.some((log) => log.intensity >= 7) ? 'High-intensity emotion was recorded during the trade.' : null,
    ].filter(Boolean);

    const review = await prisma.aiTradeReview.create({
      data: {
        tradeId: targetTradeId,
        summary: `${resultText} Pair: ${trade.pair}. Setup: ${trade.setupType || 'not specified'}.`,
        mistakes: mistakes.length > 0 ? mistakes.join(' ') : 'No major process mistakes were logged.',
        strengths: trade.followedPlan ? 'The trade was marked as plan-compliant.' : 'Add more process notes to identify repeatable strengths.',
        ruleFeedback: trade.ruleViolations.length > 0 ? 'Review and reduce the logged rule violations before the next setup.' : 'No rule violations were logged.',
        psychologyFeedback: trade.emotionLogs.length > 0 ? 'Use the emotion log to compare mindset before, during, and after execution.' : 'No emotion logs were added yet.',
        riskFeedback: trade.riskAmount ? `Recorded risk amount: ${trade.riskAmount}.` : 'Add risk amount and planned reward to improve risk analysis.',
        recommendation: 'Before the next trade, confirm account risk, setup quality, and whether the trade matches the written plan.',
        disciplineScore: mistakes.length === 0 ? 8 : Math.max(1, 8 - mistakes.length * 2),
        rawResponse: JSON.stringify({ generatedBy: 'local-analytics' }),
        provider: 'rule-based',
        modelUsed: null,
        promptVersion: 'automated-review-v1',
        generatedAt: new Date(),
        inputSnapshot: {
          tradeId: targetTradeId,
          pair: trade.pair,
          result: trade.result,
          ruleViolationCount: trade.ruleViolations.length,
          emotionLogCount: trade.emotionLogs.length,
        },
        structuredOutput: {
          summaryGenerated: true,
          mistakes,
        },
        tokenUsage: null,
        reviewStatus: 'COMPLETED',
      },
    });

    res.status(201).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate trade review' });
  }
};

const getAiTradeReview = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const trade = await getUserTrade(tradeId, req.user.id);

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const review = await prisma.aiTradeReview.findFirst({
      where: { tradeId },
      orderBy: { createdAt: 'desc' },
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch trade review' });
  }
};

module.exports = {
  getRules,
  createRule,
  getRuleById,
  updateRule,
  updateRuleStatus,
  deleteRule,
  logEmotion,
  updateEmotion,
  deleteEmotion,
  createAiTradeReview,
  getAiTradeReview,
};
