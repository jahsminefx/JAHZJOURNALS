const { z } = require('zod');

const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const requiredString = (message) => z.string().trim().min(1, message);
const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().finite().optional());
const positiveNumber = (message) => z.preprocess(emptyToUndefined, z.coerce.number().finite().positive(message));
const optionalPositiveNumber = (message) => z.preprocess(emptyToUndefined, z.coerce.number().finite().positive(message).optional());
const nonNegativeNumber = z.preprocess(emptyToUndefined, z.coerce.number().finite().min(0, 'Must be zero or greater').optional());
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().optional());
const nonNegativeInt = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0, 'Must be zero or greater').optional());
const percent = z.preprocess(emptyToUndefined, z.coerce.number().finite().min(0, 'Must be at least 0').max(100, 'Must be at most 100').optional());
const optionalDate = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date;
}, z.date({ message: 'Must be a valid date' }).optional());
const booleanValue = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 'true' || value === 'on';
}, z.boolean());

const accountTypeOptions = ['DEMO', 'PERSONAL_LIVE', 'PRACTICE', 'BROKER_FUNDED', 'OTHER'];
const platformOptions = ['MT4', 'MT5', 'CTRADER', 'MATCH_TRADER', 'TRADELOCKER', 'DXTRADE', 'RITHMIC', 'NINJATRADER', 'OTHER'];
const marketTypeOptions = ['FOREX_CFD', 'FUTURES', 'OTHER'];
const evaluationTypeOptions = ['ONE_STEP', 'TWO_STEP', 'THREE_STEP', 'INSTANT_FUNDED', 'ALREADY_FUNDED', 'FREE_TRIAL', 'DEMO_EVALUATION'];
const creationEvaluationTypeOptions = ['ONE_STEP', 'TWO_STEP', 'THREE_STEP', 'INSTANT_FUNDED', 'ALREADY_FUNDED'];
const accountStatusOptions = ['NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'FUNDED', 'SUSPENDED', 'RESET', 'EXPIRED'];
const drawdownTypeOptions = ['STATIC', 'TRAILING', 'END_OF_DAY_TRAILING', 'INTRADAY_TRAILING', 'ABSOLUTE'];
const creationDrawdownTypeOptions = ['STATIC', 'TRAILING', 'END_OF_DAY_TRAILING', 'INTRADAY_TRAILING'];
const phaseStatusOptions = ['NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'RESET'];
const timeLimitOptions = ['UNLIMITED', 'CALENDAR_DAYS', 'TRADING_DAYS'];

const normalizeStringList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const createRegularAccountSchema = z.object({
  name: requiredString('Account name is required'),
  brokerName: optionalString,
  accountType: z.preprocess(emptyToUndefined, z.enum(accountTypeOptions).optional()),
  startingBalance: positiveNumber('Starting balance must be greater than zero'),
  currentBalance: optionalPositiveNumber('Current balance must be greater than zero'),
  currency: z.string().trim().min(1).default('USD'),
  platform: z.preprocess(emptyToUndefined, z.enum(platformOptions).optional()),
  riskPerTradePercent: percent,
  maxDailyLossPercent: percent,
  maxTradesPerDay: nonNegativeInt,
  maxLossesPerDay: nonNegativeInt,
  notes: optionalString,
});

const updateRegularAccountSchema = createRegularAccountSchema.partial().extend({
  name: optionalString,
});

const propFirmPhaseSchema = z.object({
  phaseNumber: z.coerce.number().int().min(1, 'Phase number must be at least 1'),
  name: requiredString('Phase name is required'),
  profitTargetPercent: percent,
  profitTargetAmount: nonNegativeNumber,
  minimumTradingDays: nonNegativeInt,
  minimumProfitableDays: nonNegativeInt,
  maximumTradingDays: nonNegativeInt,
  timeLimitType: z.preprocess(emptyToUndefined, z.enum(timeLimitOptions).optional()),
  timeLimitDays: nonNegativeInt,
  status: z.enum(phaseStatusOptions).default('NOT_STARTED'),
}).superRefine((phase, ctx) => {
  if (phase.maximumTradingDays !== undefined && phase.minimumTradingDays !== undefined && phase.maximumTradingDays < phase.minimumTradingDays) {
    ctx.addIssue({
      code: 'custom',
      path: ['maximumTradingDays'],
      message: 'Maximum trading days must not be lower than minimum trading days',
    });
  }
});

const propFirmPhaseRuleSchema = z.object({
  name: requiredString('Phase name is required'),
  profitTargetPercent: percent,
  minimumTradingDays: nonNegativeInt.default(0),
  timeLimitType: z.preprocess(emptyToUndefined, z.enum(timeLimitOptions).optional()).default('UNLIMITED'),
  timeLimitDays: nonNegativeInt,
});

const propFirmAccountDetailsShape = {
  accountName: optionalString,
  name: optionalString,
  firmName: requiredString('Prop-firm name is required'),
  customFirmName: optionalString,
  programmeName: requiredString('Programme/model name is required'),
  marketType: z.enum(marketTypeOptions).default('FOREX_CFD'),
  accountSize: positiveNumber('Account size must be greater than zero'),
  currency: z.string().trim().min(1, 'Currency is required').default('USD'),
  platform: z.preprocess(emptyToUndefined, z.enum(platformOptions).optional()),
  evaluationType: z.enum(creationEvaluationTypeOptions, { message: 'Evaluation type is required' }),
  startDate: optionalDate,
};

const propFirmChallengeRulesShape = {
  phaseCount: nonNegativeInt,
  phases: z.array(propFirmPhaseRuleSchema).default([]),
  dailyLossPercent: percent,
  maximumLossPercent: percent,
  drawdownType: z.preprocess(emptyToUndefined, z.enum(creationDrawdownTypeOptions).optional()).default('STATIC'),
};

const expectedPhaseCount = {
  ONE_STEP: 1,
  TWO_STEP: 2,
  THREE_STEP: 3,
  INSTANT_FUNDED: 0,
  ALREADY_FUNDED: 0,
};

const validatePropFirmDetails = (account, ctx) => {
  if (!String(account.accountName || account.name || '').trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['accountName'],
      message: 'Account name is required',
    });
  }

  if (account.firmName === 'OTHER' && !String(account.customFirmName || '').trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['customFirmName'],
      message: 'Custom prop-firm name is required when Other is selected',
    });
  }
};

const validateChallengeRules = (account, ctx) => {
  const expected = expectedPhaseCount[account.evaluationType];
  const phaseCount = account.phaseCount ?? account.phases.length;

  if (expected !== undefined && account.phases.length !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['phases'],
      message: `${account.evaluationType.replaceAll('_', ' ').toLowerCase()} accounts require ${expected} phase(s)`,
    });
  }

  if (expected !== undefined && phaseCount !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['phaseCount'],
      message: `${account.evaluationType.replaceAll('_', ' ').toLowerCase()} accounts require ${expected} phase(s)`,
    });
  }

  if (account.dailyLossPercent !== undefined && account.maximumLossPercent !== undefined && account.dailyLossPercent > account.maximumLossPercent) {
    ctx.addIssue({
      code: 'custom',
      path: ['dailyLossPercent'],
      message: 'Maximum daily loss must not exceed maximum overall loss',
    });
  }

  for (const [index, phase] of account.phases.entries()) {
    if (phase.timeLimitType && phase.timeLimitType !== 'UNLIMITED' && phase.timeLimitDays === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['phases', index, 'timeLimitDays'],
        message: 'Time-limit days are required when the time limit is not unlimited',
      });
    }
  }
};

const propFirmAccountDetailsSchema = z.object(propFirmAccountDetailsShape).superRefine(validatePropFirmDetails);
const propFirmChallengeRulesSchema = z.object({
  evaluationType: z.enum(creationEvaluationTypeOptions),
  ...propFirmChallengeRulesShape,
}).superRefine(validateChallengeRules);

const simplifiedPropFirmAccountSchema = z.object({
  ...propFirmAccountDetailsShape,
  ...propFirmChallengeRulesShape,
}).superRefine((account, ctx) => {
  validatePropFirmDetails(account, ctx);
  validateChallengeRules(account, ctx);
});

const basePropFirmAccountSchema = z.object({
  name: requiredString('Account name is required'),
  firmName: requiredString('Prop-firm name is required'),
  customFirmName: optionalString,
  programmeName: requiredString('Programme/model name is required'),
  marketType: z.enum(marketTypeOptions),
  accountSize: positiveNumber('Account size must be greater than zero'),
  currency: z.string().trim().min(1).default('USD'),
  platform: z.preprocess(emptyToUndefined, z.enum(platformOptions).optional()),
  brokerServer: optionalString,
  challengeFee: nonNegativeNumber,
  startDate: optionalDate,
  accountType: optionalString,
  evaluationType: z.enum(evaluationTypeOptions),
  accountStatus: z.enum(accountStatusOptions).default('NOT_STARTED'),
  currentBalance: optionalPositiveNumber('Current balance must be greater than zero'),
  currentPhaseNumber: optionalInt,

  phases: z.array(propFirmPhaseSchema).default([]),

  dailyLossEnabled: booleanValue.default(true),
  dailyLossPercent: percent,
  dailyLossAmount: nonNegativeNumber,
  maximumLossPercent: percent,
  maximumLossAmount: nonNegativeNumber,
  drawdownType: z.preprocess(emptyToUndefined, z.enum(drawdownTypeOptions).optional()),
  dailyLossCalculationBasis: optionalString,
  overallLossCalculationBasis: optionalString,
  includeFloatingPnl: booleanValue.default(true),
  includeCommissions: booleanValue.default(true),
  includeSwaps: booleanValue.default(true),
  dailyResetTime: optionalString,
  dailyResetTimezone: optionalString,
  maxRiskPerTradePercent: percent,
  maxRiskPerTradeIdea: percent,
  maxOpenPositions: nonNegativeInt,
  maxLotSize: nonNegativeNumber,
  stopAfterLosses: nonNegativeInt,

  consistencyRuleEnabled: booleanValue.default(false),
  consistencyRuleType: optionalString,
  consistencyThreshold: percent,
  maximumBestDayPercent: percent,
  minimumProfitableDays: nonNegativeInt,
  profitableDayMinimum: nonNegativeNumber,

  newsTradingAllowed: booleanValue.optional(),
  weekendHoldingAllowed: booleanValue.optional(),
  overnightHoldingAllowed: booleanValue.optional(),
  expertAdvisorsAllowed: booleanValue.optional(),
  copyTradingAllowed: booleanValue.optional(),
  hedgingAllowed: booleanValue.optional(),
  scalpingAllowed: booleanValue.optional(),
  cryptoTradingAllowed: booleanValue.optional(),
  restrictedSymbols: z.preprocess(normalizeStringList, z.array(z.string()).default([])),
  restrictedNewsBeforeMinutes: nonNegativeInt,
  restrictedNewsAfterMinutes: nonNegativeInt,
  maximumInactivityDays: nonNegativeInt,
  prohibitedStrategies: optionalString,
  customRules: optionalString,

  profitSplitPercent: percent,
  firstPayoutDate: optionalDate,
  payoutFrequency: optionalString,
  minimumPayoutAmount: nonNegativeNumber,
  payoutCycleStartDate: optionalDate,
  scalingPlanEnabled: booleanValue.default(false),
  nextScalingTarget: nonNegativeNumber,
  maximumAllocation: nonNegativeNumber,
});

const validatePropFirmRules = (account, ctx) => {
  const phaseNumbers = new Set();
  for (const [index, phase] of account.phases.entries()) {
    if (phaseNumbers.has(phase.phaseNumber)) {
      ctx.addIssue({
        code: 'custom',
        path: ['phases', index, 'phaseNumber'],
        message: 'Phase numbers must be unique',
      });
    }
    phaseNumbers.add(phase.phaseNumber);
  }

  if (expectedPhaseCount[account.evaluationType] !== undefined && account.phases.length !== expectedPhaseCount[account.evaluationType]) {
    ctx.addIssue({
      code: 'custom',
      path: ['phases'],
      message: `${account.evaluationType.replaceAll('_', ' ').toLowerCase()} accounts require ${expectedPhaseCount[account.evaluationType]} phase(s)`,
    });
  }

  if (['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(account.evaluationType) && account.phases.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['phases'],
      message: 'Instant-funded and already-funded accounts may skip evaluation phases',
    });
  }

  if (account.dailyLossPercent !== undefined && account.maximumLossPercent !== undefined && account.dailyLossPercent > account.maximumLossPercent) {
    ctx.addIssue({
      code: 'custom',
      path: ['dailyLossPercent'],
      message: 'Daily loss percentage cannot exceed maximum overall loss percentage',
    });
  }

  if (account.dailyLossAmount !== undefined && account.maximumLossAmount !== undefined && account.dailyLossAmount > account.maximumLossAmount) {
    ctx.addIssue({
      code: 'custom',
      path: ['dailyLossAmount'],
      message: 'Daily loss amount cannot exceed maximum overall loss amount',
    });
  }
};

const createPropFirmAccountSchema = simplifiedPropFirmAccountSchema;
const updatePropFirmAccountSchema = simplifiedPropFirmAccountSchema;

const propFirmAdvancedSettingsSchema = z.object({
  brokerServer: optionalString,
  challengeFee: nonNegativeNumber,
  accountStatus: z.preprocess(emptyToUndefined, z.enum(accountStatusOptions).optional()),
  currentPhaseNumber: optionalInt,

  dailyLossCalculationBasis: optionalString,
  overallLossCalculationBasis: optionalString,
  includeFloatingPnl: booleanValue.optional(),
  includeCommissions: booleanValue.optional(),
  includeSwaps: booleanValue.optional(),
  dailyResetTime: optionalString,
  dailyResetTimezone: optionalString,

  maxRiskPerTradePercent: percent,
  maxRiskPerTradeIdea: percent,
  maxOpenPositions: nonNegativeInt,
  maxLotSize: nonNegativeNumber,
  stopAfterLosses: nonNegativeInt,

  consistencyRuleEnabled: booleanValue.default(false),
  consistencyRuleType: optionalString,
  consistencyThreshold: percent,
  maximumBestDayPercent: percent,
  minimumProfitableDays: nonNegativeInt,
  profitableDayMinimum: nonNegativeNumber,

  newsTradingAllowed: booleanValue.optional(),
  weekendHoldingAllowed: booleanValue.optional(),
  overnightHoldingAllowed: booleanValue.optional(),
  expertAdvisorsAllowed: booleanValue.optional(),
  copyTradingAllowed: booleanValue.optional(),
  hedgingAllowed: booleanValue.optional(),
  scalpingAllowed: booleanValue.optional(),
  cryptoTradingAllowed: booleanValue.optional(),
  restrictedSymbols: z.preprocess(normalizeStringList, z.array(z.string()).default([])),
  restrictedNewsBeforeMinutes: nonNegativeInt,
  restrictedNewsAfterMinutes: nonNegativeInt,
  maximumInactivityDays: nonNegativeInt,
  prohibitedStrategies: optionalString,
  customRules: optionalString,

  profitSplitPercent: percent,
  firstPayoutDate: optionalDate,
  payoutFrequency: optionalString,
  minimumPayoutAmount: nonNegativeNumber,
  payoutCycleStartDate: optionalDate,
  scalingPlanEnabled: booleanValue.default(false),
  nextScalingTarget: nonNegativeNumber,
  maximumAllocation: nonNegativeNumber,
});

const propFirmProgressSnapshotSchema = z.object({
  balance: positiveNumber('Balance must be greater than zero'),
  equity: optionalNumber,
  dailyProfitLoss: optionalNumber,
  overallProfitLoss: optionalNumber,
  completedTradingDays: nonNegativeInt.default(0),
  profitableDays: nonNegativeInt.default(0),
  bestDayProfit: optionalNumber,
  recordedAt: optionalDate,
});

const formatZodError = (error) => ({
  message: 'Validation failed',
  errors: error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  })),
});

module.exports = {
  createRegularAccountSchema,
  updateRegularAccountSchema,
  propFirmAccountDetailsSchema,
  propFirmChallengeRulesSchema,
  propFirmAdvancedSettingsSchema,
  createPropFirmAccountSchema,
  updatePropFirmAccountSchema,
  propFirmPhaseSchema,
  propFirmProgressSnapshotSchema,
  formatZodError,
};
