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
    res.status(500).json({ message: 'We couldn\'t retrieve your trading rules.' });
  }
};

const createRule = async (req, res) => {
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Please give your rule a name.' });
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
    res.status(500).json({ message: 'We hit a snag saving your rule.' });
  }
};

const createRulesBulk = async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of rules.' });
    }

    const createdRules = [];
    for (const ruleText of rules) {
       if (ruleText && String(ruleText).trim()) {
         const existing = await prisma.tradeRule.findFirst({
           where: { userId: req.user.id, name: String(ruleText).trim() }
         });
         
         if (!existing) {
           const rule = await prisma.tradeRule.create({
             data: {
               userId: req.user.id,
               name: String(ruleText).trim(),
               active: true
             }
           });
           createdRules.push(rule);
         }
       }
    }

    res.status(201).json(createdRules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to import bulk rules.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that rule.' });
    }

    res.json(rule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Our servers hit a snag retrieving this rule.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that rule.' });
    }

    const { name, description, active } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Please give your rule a name.' });
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
    res.status(500).json({ message: 'We hit a snag updating your rule.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that rule to update.' });
    }

    if (typeof req.body.active !== 'boolean' && typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ message: 'Invalid rule status format.' });
    }

    const active = typeof req.body.active === 'boolean' ? req.body.active : req.body.isActive;
    const updatedRule = await prisma.tradeRule.update({
      where: { id: rule.id },
      data: { active },
    });

    res.json(updatedRule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t update this rule\'s status.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that rule to delete.' });
    }

    if (rule._count.violations > 0) {
      return res.status(409).json({
        message: 'You have trades violating this rule. Disable it instead of deleting to preserve your journal history.',
      });
    }

    await prisma.tradeRule.delete({ where: { id: rule.id } });
    res.json({ message: 'Rule removed from your sanctuary.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t remove that rule right now.' });
  }
};

const logEmotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, emotion, intensity, note } = req.body;
    const parsedIntensity = Number.parseInt(intensity, 10);

    if (!emotionStages.includes(stage) || !emotions.includes(emotion)) {
      return res.status(400).json({ message: 'Please select both a stage and an emotion.' });
    }

    if (Number.isNaN(parsedIntensity) || parsedIntensity < 1 || parsedIntensity > 10) {
      return res.status(400).json({ message: 'Intensity feels best rated between 1 and 10.' });
    }

    const trade = await getUserTrade(id, req.user.id);

    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find the trade for this emotion.' });
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
    res.status(500).json({ message: 'We hit a snag logging your emotion.' });
  }
};

const updateEmotion = async (req, res) => {
  try {
    const { stage, emotion, intensity, note } = req.body;
    const parsedIntensity = Number.parseInt(intensity, 10);

    if (!emotionStages.includes(stage) || !emotions.includes(emotion)) {
      return res.status(400).json({ message: 'Please select both a stage and an emotion.' });
    }

    if (Number.isNaN(parsedIntensity) || parsedIntensity < 1 || parsedIntensity > 10) {
      return res.status(400).json({ message: 'Intensity feels best rated between 1 and 10.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that emotion log.' });
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
    res.status(500).json({ message: 'We hit a snag updating your emotion log.' });
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
      return res.status(404).json({ message: 'We couldn\'t find that emotion log.' });
    }

    await prisma.emotionLog.delete({ where: { id: emotionLog.id } });
    res.json({ message: 'Emotion log removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t remove that emotion log right now.' });
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
      return res.status(404).json({ message: 'We couldn\'t find the trade for this review.' });
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
    res.status(500).json({ message: 'We couldn\'t craft an AI review at this time.' });
  }
};

const getAiTradeReview = async (req, res) => {
  try {
    const { tradeId } = req.params;
    const trade = await getUserTrade(tradeId, req.user.id);

    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find the trade for this review.' });
    }

    const review = await prisma.aiTradeReview.findFirst({
      where: { tradeId },
      orderBy: { createdAt: 'desc' },
    });

    if (!review) {
      return res.status(404).json({ message: 'We couldn\'t find a review for this trade.' });
    }

    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t retrieve the AI review.' });
  }
};

const logViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const { tradeRuleId, severity, note } = req.body;

    if (!['MINOR', 'MODERATE', 'MAJOR'].includes(severity)) {
      return res.status(400).json({ message: 'Severity must be MINOR, MODERATE, or MAJOR.' });
    }

    const trade = await getUserTrade(id, req.user.id);
    if (!trade) {
      return res.status(404).json({ message: 'We couldn\'t find the trade for this violation.' });
    }

    const rule = await prisma.tradeRule.findFirst({ where: { id: tradeRuleId, userId: req.user.id } });
    if (!rule) {
      return res.status(404).json({ message: 'We couldn\'t find that rule.' });
    }

    const violation = await prisma.tradeRuleViolation.create({
      data: { tradeId: id, tradeRuleId, severity, note: note || null },
    });

    res.status(201).json(violation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag logging your rule violation.' });
  }
};

const updateViolation = async (req, res) => {
  try {
    const { severity, note } = req.body;
    
    if (severity && !['MINOR', 'MODERATE', 'MAJOR'].includes(severity)) {
      return res.status(400).json({ message: 'Severity must be MINOR, MODERATE, or MAJOR.' });
    }

    const violation = await prisma.tradeRuleViolation.findFirst({
      where: { id: req.params.id, trade: { tradingAccount: { userId: req.user.id } } },
    });

    if (!violation) {
      return res.status(404).json({ message: 'We couldn\'t find that rule violation.' });
    }

    const updatedViolation = await prisma.tradeRuleViolation.update({
      where: { id: violation.id },
      data: { 
        ...(severity && { severity }),
        note: note !== undefined ? note : violation.note 
      },
    });

    res.json(updatedViolation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag updating your rule violation.' });
  }
};

const deleteViolation = async (req, res) => {
  try {
    const violation = await prisma.tradeRuleViolation.findFirst({
      where: { id: req.params.id, trade: { tradingAccount: { userId: req.user.id } } },
    });

    if (!violation) {
      return res.status(404).json({ message: 'We couldn\'t find that rule violation.' });
    }

    await prisma.tradeRuleViolation.delete({ where: { id: violation.id } });
    res.json({ message: 'Rule violation removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t remove that violation right now.' });
  }
};

const createUserFeedback = async (req, res) => {
  try {
     const { type, subject, description } = req.body;
     if (!subject || !description) return res.status(400).json({ message: 'Subject and detailed descriptions are legally required for tracking.' });

     if (type === 'BUG') {
         await prisma.bugReport.create({ data: { reporterId: req.user.id, title: subject, description, severity: 'MEDIUM', status: 'NEW' } });
     } else if (type === 'FEATURE') {
         await prisma.featureRequest.create({ data: { userId: req.user.id, title: subject, description, status: 'UNDER_REVIEW', votes: 1 } });
     } else {
         const ticketCount = await prisma.supportTicket.count();
         await prisma.supportTicket.create({ data: { userId: req.user.id, subject, description, ticketNumber: `TK-${1000 + ticketCount}`, status: 'OPEN', priority: 'MEDIUM' } });
     }

     res.status(201).json({ message: 'Your transmission has successfully reached our Customer Success matrix natively. Thank you for making JAHZJOURNALS strictly better.' });
  } catch (error) {
     console.error(error);
     res.status(500).json({ message: 'Hard fault bridging feedback matrices. Please hold on.' });
  }
};

module.exports = {
  getRules,
  createRule,
  createRulesBulk,
  getRuleById,
  updateRule,
  updateRuleStatus,
  deleteRule,
  logEmotion,
  updateEmotion,
  deleteEmotion,
  logViolation,
  updateViolation,
  deleteViolation,
  createAiTradeReview,
  getAiTradeReview,
  createUserFeedback,
};
