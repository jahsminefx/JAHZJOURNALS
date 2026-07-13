const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const checkAiLimit = async (userId, plan) => {
  // Free: 0, Starter: 5/mo, Pro: 50/mo, Mentor: Unlimited
  if (plan === 'FREE') return { allowed: false, message: 'AI features require a paid subscription.' };
  
  const limit = plan === 'STARTER' ? 5 : plan === 'PRO' ? 50 : Infinity;
  if (limit === Infinity) return { allowed: true };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageCount = await prisma.aiTradeReview.count({
    where: {
      trade: { tradingAccount: { userId } },
      generatedAt: { gte: startOfMonth },
    }
  });

  if (usageCount >= limit) {
    return { allowed: false, message: `You have reached your monthly AI insight limit (${limit}/${limit}). Upgrade your plan for more.` };
  }

  return { allowed: true };
};

const generateTradeInsight = async (req, res) => {
  try {
    const { tradeId } = req.params;

    if (!openai) {
      return res.status(503).json({ message: 'AI module is currently disabled by the server administrator.' });
    }

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        ruleViolations: { include: { tradeRule: true } },
        emotionLogs: true,
        tradingAccount: { select: { userId: true } },
      }
    });

    if (!trade || trade.tradingAccount.userId !== req.user.id) {
      return res.status(404).json({ message: 'Trade not found.' });
    }

    const limitCheck = await checkAiLimit(req.user.id, req.user.subscriptionPlan);
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    const promptText = `
    Analyze this Forex/Day-trading trade execution. Provide structural feedback in JSON.
    Trade Details:
    - Pair: ${trade.pair}
    - Direction: ${trade.direction}
    - Result: ${trade.result}
    - Profit/Loss: $${trade.profitLossAmount}
    - Risk/Reward: ${trade.riskRewardRatio || 'Unknown'}
    - Emotion Logs: ${JSON.stringify(trade.emotionLogs.map(l => ({ emotion: l.emotion, intensity: l.intensity, stage: l.stage })))}
    - Rules Broken: ${trade.ruleViolations.length > 0 ? trade.ruleViolations.map(v => v.tradeRule?.name).join(', ') : 'None'}
    
    Respond STRICTLY with valid JSON respecting this schema:
    {
      "strengths": ["string", "string"],
      "weaknesses": ["string"],
      "actionableAdvice": "string"
    }
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a disciplined, elite prop-firm trading mentor. You are blunt but constructive.' },
        { role: 'user', content: promptText }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    });

    const aiContent = completion.choices[0].message.content;
    const parsedInsight = JSON.parse(aiContent);

    // Save insight to DB
    const aiReview = await prisma.aiTradeReview.create({
      data: {
        tradeId,
        provider: 'OpenAI',
        modelUsed: 'gpt-4o-mini',
        strengths: parsedInsight.strengths.join(', \n'),
        mistakes: parsedInsight.weaknesses.join(', \n'),
        recommendation: parsedInsight.actionableAdvice,
        rawResponse: aiContent,
        generatedAt: new Date(),
        structuredOutput: parsedInsight,
      }
    });

    res.json({
      success: true,
      insight: parsedInsight,
    });
  } catch (error) {
    console.error('AI Insight Error:', error);
    res.status(500).json({ message: 'Our AI mentor encountered an error analyzing your trade.' });
  }
};

module.exports = {
  generateTradeInsight,
};
