import { z } from 'zod';

const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const requiredString = (message) => z.string().trim().min(1, message);
const positiveNumber = (message) => z.preprocess(emptyToUndefined, z.coerce.number().finite().positive(message));
const nonNegativeNumber = z.preprocess(emptyToUndefined, z.coerce.number().finite().min(0, 'Must be zero or greater').optional());
const nonNegativeInt = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0, 'Must be zero or greater').optional());
const percent = z.preprocess(emptyToUndefined, z.coerce.number().finite().min(0, 'Must be at least 0').max(100, 'Must be at most 100').optional());

export const platformOptions = ['MT4', 'MT5', 'CTRADER', 'MATCH_TRADER', 'TRADELOCKER', 'DXTRADE', 'RITHMIC', 'NINJATRADER', 'OTHER'];
export const evaluationTypeOptions = ['ONE_STEP', 'TWO_STEP', 'THREE_STEP', 'INSTANT_FUNDED', 'ALREADY_FUNDED'];
export const drawdownTypeOptions = ['STATIC', 'TRAILING', 'END_OF_DAY_TRAILING', 'INTRADAY_TRAILING'];
export const timeLimitOptions = ['UNLIMITED', 'CALENDAR_DAYS', 'TRADING_DAYS'];

export const expectedPhaseCount = {
  ONE_STEP: 1,
  TWO_STEP: 2,
  THREE_STEP: 3,
  INSTANT_FUNDED: 0,
  ALREADY_FUNDED: 0,
};

export const propFirmPhaseRuleSchema = z.object({
  name: requiredString('Phase name is required'),
  profitTargetPercent: percent,
  minimumTradingDays: nonNegativeInt.default(0),
  timeLimitType: z.enum(timeLimitOptions).default('UNLIMITED'),
  timeLimitDays: nonNegativeInt,
});

export const propFirmAccountDetailsSchema = z.object({
  accountName: requiredString('Account name is required'),
  firmName: requiredString('Prop-firm name is required'),
  customFirmName: optionalString,
  programmeName: requiredString('Programme name is required'),
  accountSize: positiveNumber('Account size must be greater than zero'),
  currency: requiredString('Currency is required'),
  platform: z.preprocess(emptyToUndefined, z.enum(platformOptions).optional()),
  evaluationType: z.enum(evaluationTypeOptions, { message: 'Evaluation type is required' }),
  startDate: optionalString,
}).superRefine((account, ctx) => {
  if (account.firmName === 'OTHER' && !account.customFirmName) {
    ctx.addIssue({
      code: 'custom',
      path: ['customFirmName'],
      message: 'Custom prop-firm name is required when Other is selected',
    });
  }
});

export const propFirmChallengeRulesSchema = z.object({
  evaluationType: z.enum(evaluationTypeOptions),
  phaseCount: z.coerce.number().int().min(0).max(3),
  phases: z.array(propFirmPhaseRuleSchema),
  dailyLossPercent: percent,
  maximumLossPercent: percent,
  drawdownType: z.enum(drawdownTypeOptions),
}).superRefine((rules, ctx) => {
  const expected = expectedPhaseCount[rules.evaluationType];

  if (expected !== undefined && rules.phaseCount !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['phaseCount'],
      message: `${rules.evaluationType.replaceAll('_', ' ').toLowerCase()} accounts require ${expected} phase(s)`,
    });
  }

  if (expected !== undefined && rules.phases.length !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['phases'],
      message: `${rules.evaluationType.replaceAll('_', ' ').toLowerCase()} accounts require ${expected} phase(s)`,
    });
  }

  if (rules.dailyLossPercent !== undefined && rules.maximumLossPercent !== undefined && rules.dailyLossPercent > rules.maximumLossPercent) {
    ctx.addIssue({
      code: 'custom',
      path: ['dailyLossPercent'],
      message: 'Maximum daily loss must not exceed maximum overall loss',
    });
  }

  rules.phases.forEach((phase, index) => {
    if (phase.timeLimitType !== 'UNLIMITED' && phase.timeLimitDays === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['phases', index, 'timeLimitDays'],
        message: 'Time-limit days are required when the time limit is not unlimited',
      });
    }
  });
});

export const propFirmAdvancedSettingsSchema = z.object({
  brokerServer: optionalString,
  challengeFee: nonNegativeNumber,
  accountStatus: optionalString,
  currentPhaseNumber: nonNegativeInt,
  dailyLossCalculationBasis: optionalString,
  overallLossCalculationBasis: optionalString,
  includeFloatingPnl: z.boolean().optional(),
  includeCommissions: z.boolean().optional(),
  includeSwaps: z.boolean().optional(),
  dailyResetTime: optionalString,
  dailyResetTimezone: optionalString,
  maxRiskPerTradePercent: percent,
  maxRiskPerTradeIdea: percent,
  maxOpenPositions: nonNegativeInt,
  maxLotSize: nonNegativeNumber,
  stopAfterLosses: nonNegativeInt,
  consistencyRuleEnabled: z.boolean().optional(),
  consistencyRuleType: optionalString,
  consistencyThreshold: percent,
  maximumBestDayPercent: percent,
  minimumProfitableDays: nonNegativeInt,
  profitableDayMinimum: nonNegativeNumber,
  newsTradingAllowed: z.boolean().optional(),
  weekendHoldingAllowed: z.boolean().optional(),
  overnightHoldingAllowed: z.boolean().optional(),
  expertAdvisorsAllowed: z.boolean().optional(),
  copyTradingAllowed: z.boolean().optional(),
  hedgingAllowed: z.boolean().optional(),
  scalpingAllowed: z.boolean().optional(),
  cryptoTradingAllowed: z.boolean().optional(),
  restrictedSymbols: optionalString,
  restrictedNewsBeforeMinutes: nonNegativeInt,
  restrictedNewsAfterMinutes: nonNegativeInt,
  maximumInactivityDays: nonNegativeInt,
  prohibitedStrategies: optionalString,
  customRules: optionalString,
  profitSplitPercent: percent,
  firstPayoutDate: optionalString,
  payoutFrequency: optionalString,
  minimumPayoutAmount: nonNegativeNumber,
  payoutCycleStartDate: optionalString,
  scalingPlanEnabled: z.boolean().optional(),
  nextScalingTarget: nonNegativeNumber,
  maximumAllocation: nonNegativeNumber,
});
