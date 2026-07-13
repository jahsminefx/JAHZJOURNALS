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

const fundedEvaluationTypes = new Set(['INSTANT_FUNDED', 'ALREADY_FUNDED']);

const hasOwn = (payload, key) => Object.prototype.hasOwnProperty.call(payload, key);
const accountNameFromPayload = (payload) => payload.accountName || payload.name;
const calculateTargetAmount = (accountSize, profitTargetPercent) => {
  if (profitTargetPercent === undefined || profitTargetPercent === null) return null;
  return Number(accountSize) * (Number(profitTargetPercent) / 100);
};

const mapTradingAccountData = (userId, payload) => ({
  ...(userId ? { userId } : {}),
  accountCategory: 'PROP_FIRM',
  isPropFirmAccount: true,
  name: accountNameFromPayload(payload),
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

const mapTradingAccountChallengeData = (payload) => ({
  name: accountNameFromPayload(payload),
  startingBalance: payload.accountSize,
  currency: payload.currency || 'USD',
  platform: payload.platform || null,
  propFirmName: payload.firmName,
  profitTarget: calculateTargetAmount(payload.accountSize, payload.phases?.[0]?.profitTargetPercent),
  maxDailyLossPercent: payload.dailyLossPercent ?? null,
  minimumTradingDays: payload.phases?.[0]?.minimumTradingDays ?? null,
});

const mapPropFirmData = (payload, { forCreate = false } = {}) => ({
  firmName: payload.firmName,
  customFirmName: payload.customFirmName || null,
  programmeName: payload.programmeName,
  marketType: payload.marketType || 'FOREX_CFD',
  evaluationType: payload.evaluationType,
  accountStatus: payload.accountStatus || (fundedEvaluationTypes.has(payload.evaluationType) ? 'FUNDED' : 'ACTIVE'),
  platform: payload.platform || null,
  brokerServer: payload.brokerServer || null,
  challengeFee: payload.challengeFee ?? null,
  startDate: payload.startDate ?? null,
  currentPhaseNumber: payload.currentPhaseNumber ?? (payload.phases?.length ? 1 : null),
  dailyLossEnabled: payload.dailyLossEnabled ?? true,
  dailyLossPercent: payload.dailyLossPercent ?? null,
  dailyLossAmount: payload.dailyLossAmount ?? null,
  maximumLossPercent: payload.maximumLossPercent ?? null,
  maximumLossAmount: payload.maximumLossAmount ?? null,
  drawdownType: payload.drawdownType ?? 'STATIC',
  dailyLossCalculationBasis: payload.dailyLossCalculationBasis || (forCreate ? 'INITIAL_BALANCE' : null),
  overallLossCalculationBasis: payload.overallLossCalculationBasis || (forCreate ? 'INITIAL_BALANCE' : null),
  includeFloatingPnl: payload.includeFloatingPnl ?? (forCreate ? true : undefined),
  includeCommissions: payload.includeCommissions ?? (forCreate ? true : undefined),
  includeSwaps: payload.includeSwaps ?? (forCreate ? true : undefined),
  dailyResetTime: payload.dailyResetTime || null,
  dailyResetTimezone: payload.dailyResetTimezone || (forCreate ? 'UTC' : null),
  maxRiskPerTradePercent: payload.maxRiskPerTradePercent ?? null,
  maxRiskPerTradeIdea: payload.maxRiskPerTradeIdea ?? null,
  maxOpenPositions: payload.maxOpenPositions ?? null,
  maxLotSize: payload.maxLotSize ?? null,
  stopAfterLosses: payload.stopAfterLosses ?? null,
  consistencyRuleEnabled: payload.consistencyRuleEnabled ?? (forCreate ? false : undefined),
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
  scalingPlanEnabled: payload.scalingPlanEnabled ?? (forCreate ? false : undefined),
  nextScalingTarget: payload.nextScalingTarget ?? null,
  maximumAllocation: payload.maximumAllocation ?? null,
});

const mapChallengeUpdateData = (payload) => ({
  firmName: payload.firmName,
  customFirmName: payload.customFirmName || null,
  programmeName: payload.programmeName,
  marketType: payload.marketType || 'FOREX_CFD',
  evaluationType: payload.evaluationType,
  accountStatus: payload.accountStatus || (fundedEvaluationTypes.has(payload.evaluationType) ? 'FUNDED' : 'ACTIVE'),
  platform: payload.platform || null,
  startDate: payload.startDate ?? null,
  currentPhaseNumber: payload.phases?.length ? 1 : null,
  dailyLossEnabled: true,
  dailyLossPercent: payload.dailyLossPercent ?? null,
  maximumLossPercent: payload.maximumLossPercent ?? null,
  drawdownType: payload.drawdownType ?? 'STATIC',
});

const mapAdvancedSettingsData = (payload) => ({
  ...(hasOwn(payload, 'brokerServer') && { brokerServer: payload.brokerServer || null }),
  ...(hasOwn(payload, 'challengeFee') && { challengeFee: payload.challengeFee ?? null }),
  ...(hasOwn(payload, 'accountStatus') && { accountStatus: payload.accountStatus || 'ACTIVE' }),
  ...(hasOwn(payload, 'currentPhaseNumber') && { currentPhaseNumber: payload.currentPhaseNumber ?? null }),
  ...(hasOwn(payload, 'dailyLossCalculationBasis') && { dailyLossCalculationBasis: payload.dailyLossCalculationBasis || null }),
  ...(hasOwn(payload, 'overallLossCalculationBasis') && { overallLossCalculationBasis: payload.overallLossCalculationBasis || null }),
  ...(hasOwn(payload, 'includeFloatingPnl') && { includeFloatingPnl: payload.includeFloatingPnl }),
  ...(hasOwn(payload, 'includeCommissions') && { includeCommissions: payload.includeCommissions }),
  ...(hasOwn(payload, 'includeSwaps') && { includeSwaps: payload.includeSwaps }),
  ...(hasOwn(payload, 'dailyResetTime') && { dailyResetTime: payload.dailyResetTime || null }),
  ...(hasOwn(payload, 'dailyResetTimezone') && { dailyResetTimezone: payload.dailyResetTimezone || null }),
  ...(hasOwn(payload, 'maxRiskPerTradePercent') && { maxRiskPerTradePercent: payload.maxRiskPerTradePercent ?? null }),
  ...(hasOwn(payload, 'maxRiskPerTradeIdea') && { maxRiskPerTradeIdea: payload.maxRiskPerTradeIdea ?? null }),
  ...(hasOwn(payload, 'maxOpenPositions') && { maxOpenPositions: payload.maxOpenPositions ?? null }),
  ...(hasOwn(payload, 'maxLotSize') && { maxLotSize: payload.maxLotSize ?? null }),
  ...(hasOwn(payload, 'stopAfterLosses') && { stopAfterLosses: payload.stopAfterLosses ?? null }),
  ...(hasOwn(payload, 'consistencyRuleEnabled') && { consistencyRuleEnabled: payload.consistencyRuleEnabled }),
  ...(hasOwn(payload, 'consistencyRuleType') && { consistencyRuleType: payload.consistencyRuleType || null }),
  ...(hasOwn(payload, 'consistencyThreshold') && { consistencyThreshold: payload.consistencyThreshold ?? null }),
  ...(hasOwn(payload, 'maximumBestDayPercent') && { maximumBestDayPercent: payload.maximumBestDayPercent ?? null }),
  ...(hasOwn(payload, 'minimumProfitableDays') && { minimumProfitableDays: payload.minimumProfitableDays ?? null }),
  ...(hasOwn(payload, 'profitableDayMinimum') && { profitableDayMinimum: payload.profitableDayMinimum ?? null }),
  ...(hasOwn(payload, 'newsTradingAllowed') && { newsTradingAllowed: payload.newsTradingAllowed }),
  ...(hasOwn(payload, 'weekendHoldingAllowed') && { weekendHoldingAllowed: payload.weekendHoldingAllowed }),
  ...(hasOwn(payload, 'overnightHoldingAllowed') && { overnightHoldingAllowed: payload.overnightHoldingAllowed }),
  ...(hasOwn(payload, 'expertAdvisorsAllowed') && { expertAdvisorsAllowed: payload.expertAdvisorsAllowed }),
  ...(hasOwn(payload, 'copyTradingAllowed') && { copyTradingAllowed: payload.copyTradingAllowed }),
  ...(hasOwn(payload, 'hedgingAllowed') && { hedgingAllowed: payload.hedgingAllowed }),
  ...(hasOwn(payload, 'scalpingAllowed') && { scalpingAllowed: payload.scalpingAllowed }),
  ...(hasOwn(payload, 'cryptoTradingAllowed') && { cryptoTradingAllowed: payload.cryptoTradingAllowed }),
  ...(hasOwn(payload, 'restrictedSymbols') && { restrictedSymbols: payload.restrictedSymbols || [] }),
  ...(hasOwn(payload, 'restrictedNewsBeforeMinutes') && { restrictedNewsBeforeMinutes: payload.restrictedNewsBeforeMinutes ?? null }),
  ...(hasOwn(payload, 'restrictedNewsAfterMinutes') && { restrictedNewsAfterMinutes: payload.restrictedNewsAfterMinutes ?? null }),
  ...(hasOwn(payload, 'maximumInactivityDays') && { maximumInactivityDays: payload.maximumInactivityDays ?? null }),
  ...(hasOwn(payload, 'prohibitedStrategies') && { prohibitedStrategies: payload.prohibitedStrategies || null }),
  ...(hasOwn(payload, 'customRules') && { customRules: payload.customRules || null }),
  ...(hasOwn(payload, 'profitSplitPercent') && { profitSplitPercent: payload.profitSplitPercent ?? null }),
  ...(hasOwn(payload, 'firstPayoutDate') && { firstPayoutDate: payload.firstPayoutDate ?? null }),
  ...(hasOwn(payload, 'payoutFrequency') && { payoutFrequency: payload.payoutFrequency || null }),
  ...(hasOwn(payload, 'minimumPayoutAmount') && { minimumPayoutAmount: payload.minimumPayoutAmount ?? null }),
  ...(hasOwn(payload, 'payoutCycleStartDate') && { payoutCycleStartDate: payload.payoutCycleStartDate ?? null }),
  ...(hasOwn(payload, 'scalingPlanEnabled') && { scalingPlanEnabled: payload.scalingPlanEnabled }),
  ...(hasOwn(payload, 'nextScalingTarget') && { nextScalingTarget: payload.nextScalingTarget ?? null }),
  ...(hasOwn(payload, 'maximumAllocation') && { maximumAllocation: payload.maximumAllocation ?? null }),
});

const mapPhaseData = (phase, index = 0, accountSize = 0) => ({
  phaseNumber: phase.phaseNumber ?? index + 1,
  name: phase.name || `Phase ${index + 1}`,
  profitTargetPercent: phase.profitTargetPercent ?? null,
  profitTargetAmount: phase.profitTargetAmount ?? calculateTargetAmount(accountSize, phase.profitTargetPercent),
  minimumTradingDays: phase.minimumTradingDays ?? null,
  minimumProfitableDays: phase.minimumProfitableDays ?? null,
  maximumTradingDays: phase.maximumTradingDays ?? null,
  timeLimitType: phase.timeLimitType || 'UNLIMITED',
  timeLimitDays: phase.timeLimitDays ?? null,
  status: phase.status || (index === 0 ? 'ACTIVE' : 'NOT_STARTED'),
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
      ...mapPropFirmData(payload, { forCreate: true }),
      tradingAccountId: tradingAccount.id,
      phases: {
        create: (payload.phases || []).map((phase, index) => mapPhaseData(phase, index, payload.accountSize)),
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
    data: mapTradingAccountChallengeData(payload),
  });

  await tx.propFirmAccount.update({
    where: { id: existing.id },
    data: mapChallengeUpdateData(payload),
  });

  await tx.propFirmPhase.deleteMany({ where: { propFirmAccountId: existing.id } });
  if (payload.phases.length > 0) {
    await tx.propFirmPhase.createMany({
      data: payload.phases.map((phase, index) => ({
        propFirmAccountId: existing.id,
        ...mapPhaseData(phase, index, payload.accountSize),
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

const updateAdvancedSettings = async (userId, tradingAccountId, payload) => prisma.$transaction(async (tx) => {
  const existing = await tx.propFirmAccount.findFirst({
    where: {
      tradingAccountId,
      tradingAccount: { userId },
    },
  });

  if (!existing) return null;

  if (hasOwn(payload, 'brokerServer') || hasOwn(payload, 'maxRiskPerTradePercent') || hasOwn(payload, 'stopAfterLosses') || hasOwn(payload, 'customRules')) {
    await tx.tradingAccount.update({
      where: { id: tradingAccountId },
      data: {
        ...(hasOwn(payload, 'brokerServer') && { brokerName: payload.brokerServer || null }),
        ...(hasOwn(payload, 'maxRiskPerTradePercent') && {
          defaultRiskPercent: payload.maxRiskPerTradePercent ?? null,
          riskPerTradePercent: payload.maxRiskPerTradePercent ?? null,
        }),
        ...(hasOwn(payload, 'stopAfterLosses') && { maxLossesPerDay: payload.stopAfterLosses ?? null }),
        ...(hasOwn(payload, 'customRules') && { notes: payload.customRules || null }),
      },
    });
  }

  await tx.propFirmAccount.update({
    where: { id: existing.id },
    data: mapAdvancedSettingsData(payload),
  });

  return tx.propFirmAccount.findUnique({
    where: { id: existing.id },
    include: propFirmInclude,
  });
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
  mapTradingAccountData,
  mapPhaseData,
  calculateTargetAmount,
  getPropFirmAccountForUser,
  createPropFirmAccount,
  updatePropFirmAccount,
  updateAdvancedSettings,
  deletePropFirmAccount,
  createPhase,
  updatePhase,
  deletePhase,
  listProgressSnapshots,
  createProgressSnapshot,
};
