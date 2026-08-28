const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getUtcWeekRange } = require('../utils/timezone');
const { calculateSummary } = require('../services/analyticsService');

const writtenReviewFields = [
  'mainMistake',
  'personalLesson',
  'nextWeekFocus',
  'generalReflection',
  'additionalNotes',
];

const getUserTimezone = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  return user?.timezone || 'UTC';
};

const getScopeKey = (accountId) => accountId || 'all';

const getReviewInclude = {
  tradingAccount: { select: { id: true, name: true } },
  bestTrade: { select: { id: true, pair: true, profitLossAmount: true } },
  worstTrade: { select: { id: true, pair: true, profitLossAmount: true } },
};

const calculateMostCommon = (items) => {
  const counts = new Map();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

const calculateDisciplineScore = (trades) => {
  if (trades.length === 0) {
    return {
      score: null,
      components: {
        formulaVersion: 'discipline-v1',
        reason: 'No trades were found for this week.',
      },
    };
  }

  const followedPlanCount = trades.filter((trade) => trade.followedPlan === true).length;
  const planKnownCount = trades.filter((trade) => trade.followedPlan !== null).length;
  const planRate = planKnownCount ? followedPlanCount / planKnownCount : 0;
  const violationCount = trades.reduce((total, trade) => total + trade.ruleViolations.length, 0);
  const violationRate = violationCount / trades.length;
  const notedCount = trades.filter((trade) => trade.notesAfter && trade.notesAfter.trim().length >= 10).length;
  const noteRate = notedCount / trades.length;
  const highEmotionCount = trades.reduce(
    (total, trade) => total + trade.emotionLogs.filter((log) => log.intensity >= 8).length,
    0,
  );
  const highEmotionRate = highEmotionCount / trades.length;

  const score = Math.max(0, Math.min(100, Math.round(
    (planRate * 50)
      + (Math.max(0, 1 - violationRate) * 25)
      + (noteRate * 15)
      + (Math.max(0, 1 - highEmotionRate) * 10),
  )));

  return {
    score,
    components: {
      formulaVersion: 'discipline-v1',
      planFollowingRate: Number((planRate * 100).toFixed(1)),
      ruleViolationsPerTrade: Number(violationRate.toFixed(2)),
      postTradeNoteCompletionRate: Number((noteRate * 100).toFixed(1)),
      highIntensityEmotionLogsPerTrade: Number(highEmotionRate.toFixed(2)),
      weights: {
        planFollowing: 50,
        ruleDiscipline: 25,
        postTradeNotes: 15,
        emotionalControl: 10,
      },
    },
  };
};

const getWeeklyReviews = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
    const where = { userId: req.user.id };

    if (req.query.accountId) {
      const account = await prisma.tradingAccount.findFirst({
        where: { id: req.query.accountId, userId: req.user.id },
      });
      if (!account) return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
      where.tradingAccountId = req.query.accountId;
    }

    if (req.query.startDate || req.query.endDate) {
      where.weekStartDate = {};
      if (req.query.startDate) where.weekStartDate.gte = new Date(req.query.startDate);
      if (req.query.endDate) where.weekStartDate.lte = new Date(req.query.endDate);
    }

    const [reviews, total] = await prisma.$transaction([
      prisma.weeklyReview.findMany({
        where,
        include: getReviewInclude,
        orderBy: { weekStartDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.weeklyReview.count({ where }),
    ]);

    res.json({ success: true, page, limit, total, data: reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t retrieve your weekly reflections.' });
  }
};

const generateWeeklyReview = async (req, res) => {
  try {
    const { accountId, weekStartDate } = req.body;
    const timezone = req.body.timezone || await getUserTimezone(req.user.id);
    const range = getUtcWeekRange(weekStartDate, timezone);

    if (!range) {
      return res.status(400).json({ message: 'Please provide a valid start date for this week.' });
    }

    if (accountId) {
      const account = await prisma.tradingAccount.findFirst({ where: { id: accountId, userId: req.user.id } });
      if (!account) return res.status(404).json({ message: 'We couldn\'t find that trading account.' });
    }

    const trades = await prisma.trade.findMany({
      where: {
        tradingAccount: { userId: req.user.id },
        ...(accountId && { tradingAccountId: accountId }),
        entryTime: { gte: range.start, lte: range.end },
      },
      include: {
        ruleViolations: { include: { tradeRule: true } },
        emotionLogs: true,
      },
      orderBy: [{ entryTime: 'asc' }, { createdAt: 'asc' }],
    });

    const summary = calculateSummary(trades);
    const tradesByProfit = [...trades].sort((a, b) => Number(b.profitLossAmount || 0) - Number(a.profitLossAmount || 0));
    const bestTrade = tradesByProfit[0] || null;
    const worstTrade = tradesByProfit[tradesByProfit.length - 1] || null;
    const mostBrokenRule = calculateMostCommon(trades.flatMap((trade) => trade.ruleViolations.map((violation) => violation.tradeRule?.name)));
    const mostCommonEmotion = calculateMostCommon(trades.flatMap((trade) => trade.emotionLogs.map((log) => log.emotion)));
    const aPlusSummary = calculateSummary(trades.filter((trade) => trade.isAPlusSetup));
    const newsSummary = calculateSummary(trades.filter((trade) => trade.newsRelated));
    const planKnown = trades.filter((trade) => trade.followedPlan !== null);
    const planFollowingRate = planKnown.length
      ? Number(((planKnown.filter((trade) => trade.followedPlan).length / planKnown.length) * 100).toFixed(1))
      : null;
    const discipline = calculateDisciplineScore(trades);
    const scopeKey = getScopeKey(accountId);

    const automaticData = {
      userId: req.user.id,
      tradingAccountId: accountId || null,
      scopeKey,
      weekStartDate: range.start,
      weekEndDate: range.end,
      totalTrades: summary?.totalTrades ?? 0,
      wins: summary?.winningTrades ?? 0,
      losses: summary?.losingTrades ?? 0,
      breakevens: summary?.breakEvenTrades ?? 0,
      winRate: summary?.winRate ?? 0,
      netProfitLoss: summary?.netRealisedProfitLoss ?? 0,
      grossProfit: summary?.grossProfit ?? 0,
      grossLoss: summary?.grossLoss ?? 0,
      profitFactor: summary?.profitFactor ?? null,
      expectancy: summary?.expectancy ?? 0,
      averageWin: summary?.averageWin ?? null,
      averageLoss: summary?.averageLoss ?? null,
      averageRiskReward: summary?.averageRiskRewardRatio ?? null,
      bestTradeId: bestTrade?.id || null,
      worstTradeId: worstTrade?.id || null,
      mostBrokenRule,
      mostCommonEmotion,
      aPlusSetupWinRate: aPlusSummary?.winRate ?? 0,
      newsRelatedWinRate: newsSummary?.winRate ?? 0,
      planFollowingRate,
      disciplineScore: discipline.score,
      disciplineScoreFormulaVersion: 'discipline-v1',
      disciplineScoreComponents: discipline.components,
    };

    const existingReview = await prisma.weeklyReview.findUnique({
      where: {
        userId_scopeKey_weekStartDate: {
          userId: req.user.id,
          scopeKey,
          weekStartDate: range.start,
        },
      },
    });

    const review = existingReview
      ? await prisma.weeklyReview.update({
        where: { id: existingReview.id },
        data: automaticData,
        include: getReviewInclude,
      })
      : await prisma.weeklyReview.create({
        data: automaticData,
        include: getReviewInclude,
      });

    res.status(existingReview ? 200 : 201).json({
      success: true,
      regenerated: Boolean(existingReview),
      message: existingReview
        ? 'Weekly review recalculated. Written reflections were preserved.'
        : 'Weekly review generated successfully.',
      data: review,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We couldn\'t generate your weekly summary right now.' });
  }
};

const getWeeklyReviewById = async (req, res) => {
  try {
    const review = await prisma.weeklyReview.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: getReviewInclude,
    });

    if (!review) {
      return res.status(404).json({ message: 'We couldn\'t find that weekly reflection.' });
    }

    res.json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag finding your weekly reflection.' });
  }
};

const updateWeeklyReview = async (req, res) => {
  try {
    const review = await prisma.weeklyReview.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!review) {
      return res.status(404).json({ message: 'We couldn\'t find that weekly reflection.' });
    }

    const data = {};
    writtenReviewFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field] ? String(req.body[field]).slice(0, 5000) : null;
      }
    });

    const updatedReview = await prisma.weeklyReview.update({
      where: { id: review.id },
      data,
      include: getReviewInclude,
    });

    res.json(updatedReview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'We hit a snag saving your reflections.' });
  }
};

module.exports = {
  getWeeklyReviews,
  generateWeeklyReview,
  getWeeklyReviewById,
  updateWeeklyReview,
};
