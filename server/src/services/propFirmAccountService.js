const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { destroyScreenshots } = require('./screenshotService');

const propFirmInclude = {
  tradingAccount: {
    include: {
      trades: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  },
  phases: {
    orderBy: { phaseNumber: 'asc' },
  },
  progressSnapshots: {
    orderBy: { recordedAt: 'desc' },
    take: 10,
  },
};

const mapTradingAccountData = (userId, payload) => ({
  ...(userId ? { userId } : {}),
  accountCategory: 'PROP_FIRM',
  isPropFirmAccount: true,
  name: payload.name,
  brokerName: payload.brokerServer || null,
  accountType: payload.accountType || null,
  startingBalance: payload.accountSize,
  currentBalance: payload.currentBalance ?? payload.accountSize,
  currency: payload.currency || 'USD',
  platform: payload.platform || null,
  defaultRiskPercent: payload.maxRiskPerTradePercent ?? null,
  riskPerTradePercent: payload.maxRiskPerTradePercent ?? null,
  maxDailyLossPercent: payload.dailyLossPercent ?? null,
  maxTradesPerDay: null,
  maxLossesPerDay: payload.stopAfterLosses ?? null,
  notes: payload.customRules || null,
  propFirmName: payload.firmName,
  profitTarget: payload.phases?.[0]?.profitTargetAmount ?? null,
  maxDrawdown: payload.maximumLossAmount ?? null,
  dailyDrawdown: payload.dailyLossAmount ?? null,
  minimumTradingDays: payload.phases?.[0]?.minimumTradingDays ?? null,
});

const mapPropFirmData = (payload) => ({
  firmName: payload.firmName,
  customFirmName: payload.customFirmName || null,
  programmeName: payload.programmeName,
  marketType: payload.marketType,
  evaluationType: payload.evaluationType,
  accountStatus: payload.accountStatus,
  platform: payload.platform || null,
  brokerServer: payload.brokerServer || null,
  challengeFee: payload.challengeFee ?? null,
  startDate: payload.startDate ?? null,
  currentPhaseNumber: payload.currentPhaseNumber ?? null,
  dailyLossEnabled: payload.dailyLossEnabled,
  dailyLossPercent: payload.dailyLossPercent ?? null,
  dailyLossAmount: payload.dailyLossAmount ?? null,
  maximumLossPercent: payload.maximumLossPercent ?? null,
  maximumLossAmount: payload.maximumLossAmount ?? null,
  drawdownType: payload.drawdownType ?? null,
  dailyLossCalculationBasis: payload.dailyLossCalculationBasis || null,
  overallLossCalculationBasis: payload.overallLossCalculationBasis || null,
  includeFloatingPnl: payload.includeFloatingPnl,
  includeCommissions: payload.includeCommissions,
  includeSwaps: payload.includeSwaps,
  dailyResetTime: payload.dailyResetTime || null,
  dailyResetTimezone: payload.dailyResetTimezone || null,
  maxRiskPerTradePercent: payload.maxRiskPerTradePercent ?? null,
  maxRiskPerTradeIdea: payload.maxRiskPerTradeIdea ?? null,
  maxOpenPositions: payload.maxOpenPositions ?? null,
  maxLotSize: payload.maxLotSize ?? null,
  stopAfterLosses: payload.stopAfterLosses ?? null,
  consistencyRuleEnabled: payload.consistencyRuleEnabled,
  consistencyRuleType: payload.consistencyRuleType || null,
  consistencyThreshold: payload.consistencyThreshold ?? null,
  maximumBestDayPercent: payload.maximumBestDayPercent ?? null,
  minimumProfitableDays: payload.minimumProfitableDays ?? null,
  profitableDayMinimum: payload.profitableDayMinimum ?? null,
  newsTradingAllowed: payload.newsTradingAllowed ?? null,
  weekendHoldingAllowed: payload.weekendHoldingAllowed ?? null,
  overnightHoldingAllowed: payload.overnightHoldingAllowed ?? null,
  expertAdvisorsAllowed: payload.expertAdvisorsAllowed ?? null,
  copyTradingAllowed: payload.copyTradingAllowed ?? null,
  hedgingAllowed: payload.hedgingAllowed ?? null,
  scalpingAllowed: payload.scalpingAllowed ?? null,
  cryptoTradingAllowed: payload.cryptoTradingAllowed ?? null,
  restrictedSymbols: payload.restrictedSymbols || [],
  restrictedNewsBeforeMinutes: payload.restrictedNewsBeforeMinutes ?? null,
  restrictedNewsAfterMinutes: payload.restrictedNewsAfterMinutes ?? null,
  maximumInactivityDays: payload.maximumInactivityDays ?? null,
  prohibitedStrategies: payload.prohibitedStrategies || null,
  customRules: payload.customRules || null,
  profitSplitPercent: payload.profitSplitPercent ?? null,
  firstPayoutDate: payload.firstPayoutDate ?? null,
  payoutFrequency: payload.payoutFrequency || null,
  minimumPayoutAmount: payload.minimumPayoutAmount ?? null,
  payoutCycleStartDate: payload.payoutCycleStartDate ?? null,
  scalingPlanEnabled: payload.scalingPlanEnabled,
  nextScalingTarget: payload.nextScalingTarget ?? null,
  maximumAllocation: payload.maximumAllocation ?? null,
});

const mapPhaseData = (phase) => ({
  phaseNumber: phase.phaseNumber,
  name: phase.name,
  profitTargetPercent: phase.profitTargetPercent ?? null,
  profitTargetAmount: phase.profitTargetAmount ?? null,
  minimumTradingDays: phase.minimumTradingDays ?? null,
  minimumProfitableDays: phase.minimumProfitableDays ?? null,
  maximumTradingDays: phase.maximumTradingDays ?? null,
  timeLimitType: phase.timeLimitType || null,
  timeLimitDays: phase.timeLimitDays ?? null,
  status: phase.status || 'NOT_STARTED',
});

const getPropFirmAccountForUser = (tradingAccountId, userId) => prisma.propFirmAccount.findFirst({
  where: {
    tradingAccountId,
    tradingAccount: { userId },
  },
  include: propFirmInclude,
});

const createPropFirmAccount = async (userId, payload) => prisma.$transaction(async (tx) => {
  const tradingAccount = await tx.tradingAccount.create({
    data: mapTradingAccountData(userId, payload),
  });

  await tx.propFirmAccount.create({
    data: {
      ...mapPropFirmData(payload),
      tradingAccountId: tradingAccount.id,
      phases: {
        create: payload.phases.map(mapPhaseData),
      },
    },
  });

  return tx.propFirmAccount.findUnique({
    where: { tradingAccountId: tradingAccount.id },
    include: propFirmInclude,
  });
});

const updatePropFirmAccount = async (userId, tradingAccountId, payload) => prisma.$transaction(async (tx) => {
  const existing = await tx.propFirmAccount.findFirst({
    where: {
      tradingAccountId,
      tradingAccount: { userId },
    },
    include: {
      tradingAccount: {
        include: { _count: { select: { trades: true } } },
      },
    },
  });

  if (!existing) return null;

  await tx.tradingAccount.update({
    where: { id: tradingAccountId },
    data: mapTradingAccountData(null, payload),
  });

  await tx.propFirmAccount.update({
    where: { id: existing.id },
    data: mapPropFirmData(payload),
  });

  await tx.propFirmPhase.deleteMany({ where: { propFirmAccountId: existing.id } });
  if (payload.phases.length > 0) {
    await tx.propFirmPhase.createMany({
      data: payload.phases.map((phase) => ({
        propFirmAccountId: existing.id,
        ...mapPhaseData(phase),
      })),
    });
  }

  const updated = await tx.propFirmAccount.findUnique({
    where: { id: existing.id },
    include: propFirmInclude,
  });

  return {
    ...updated,
    tradeCountAtEdit: existing.tradingAccount._count.trades,
  };
});

const deletePropFirmAccount = async (userId, tradingAccountId) => {
  const existing = await prisma.propFirmAccount.findFirst({
    where: {
      tradingAccountId,
      tradingAccount: { userId },
    },
    include: {
      tradingAccount: {
        include: {
          trades: {
            include: { screenshots: true },
          },
        },
      },
    },
  });

  if (!existing) return null;

  const screenshots = existing.tradingAccount.trades.flatMap((trade) => trade.screenshots);
  await destroyScreenshots(screenshots);
  await prisma.tradingAccount.delete({ where: { id: tradingAccountId } });
  return existing;
};

const createPhase = async (userId, tradingAccountId, phase) => {
  const account = await prisma.propFirmAccount.findFirst({
    where: {
      tradingAccountId,
      tradingAccount: { userId },
    },
  });

  if (!account) return null;

  return prisma.propFirmPhase.create({
    data: {
      propFirmAccountId: account.id,
      ...mapPhaseData(phase),
    },
  });
};

const updatePhase = async (userId, phaseId, phase) => {
  const existing = await prisma.propFirmPhase.findFirst({
    where: {
      id: phaseId,
      propFirmAccount: {
        tradingAccount: { userId },
      },
    },
  });

  if (!existing) return null;

  return prisma.propFirmPhase.update({
    where: { id: phaseId },
    data: mapPhaseData(phase),
  });
};

const deletePhase = async (userId, phaseId) => {
  const existing = await prisma.propFirmPhase.findFirst({
    where: {
      id: phaseId,
      propFirmAccount: {
        tradingAccount: { userId },
      },
    },
  });

  if (!existing) return null;

  await prisma.propFirmPhase.delete({ where: { id: phaseId } });
  return existing;
};

const listProgressSnapshots = async (userId, tradingAccountId) => {
  const account = await prisma.propFirmAccount.findFirst({
    where: {
      tradingAccountId,
      tradingAccount: { userId },
    },
  });

  if (!account) return null;

  return prisma.propFirmProgressSnapshot.findMany({
    where: { propFirmAccountId: account.id },
    orderBy: { recordedAt: 'desc' },
  });
};

const createProgressSnapshot = async (userId, tradingAccountId, snapshot) => {
  const account = await prisma.propFirmAccount.findFirst({
    where: {
      tradingAccountId,
      tradingAccount: { userId },
    },
  });

  if (!account) return null;

  return prisma.propFirmProgressSnapshot.create({
    data: {
      propFirmAccountId: account.id,
      balance: snapshot.balance,
      equity: snapshot.equity ?? null,
      dailyProfitLoss: snapshot.dailyProfitLoss ?? null,
      overallProfitLoss: snapshot.overallProfitLoss ?? null,
      completedTradingDays: snapshot.completedTradingDays ?? 0,
      profitableDays: snapshot.profitableDays ?? 0,
      bestDayProfit: snapshot.bestDayProfit ?? null,
      recordedAt: snapshot.recordedAt ?? undefined,
    },
  });
};

module.exports = {
  propFirmInclude,
  getPropFirmAccountForUser,
  createPropFirmAccount,
  updatePropFirmAccount,
  deletePropFirmAccount,
  createPhase,
  updatePhase,
  deletePhase,
  listProgressSnapshots,
  createProgressSnapshot,
};
