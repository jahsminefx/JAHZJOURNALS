const { z } = require('zod');

// Helpers
const dateTimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const emptyValue = z.literal('').or(z.null());
const optionalString = z.union([z.string().trim(), emptyValue]).optional();
const optionalDate = z.union([
  z.string().datetime(),
  z.string().regex(dateTimeLocalPattern, 'Invalid datetime'),
  z.date(),
  emptyValue,
]).optional();
const optionalFloat = z.union([z.number(), z.string().regex(/^-?\d*\.?\d+$/).transform(Number), emptyValue]).optional();
const optionalBoolean = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((v) => v === 'true'),
  emptyValue,
]).optional();
const emotionIntensity = z.union([
  z.number(),
  z.string().regex(/^\d+$/).transform(Number),
]).pipe(z.number().int().min(1).max(10));

const emotionStages = ['BEFORE_TRADE', 'DURING_TRADE', 'AFTER_TRADE'];
const emotions = [
  'CALM', 'CONFIDENT', 'ANXIOUS', 'GREEDY', 'FEARFUL', 
  'ANGRY', 'FOMO', 'REVENGE_MINDSET', 'DISCIPLINED', 'REGRETFUL', 'FRUSTRATED'
];
const violationSeverities = ['MINOR', 'MODERATE', 'MAJOR'];
const closedTradeResults = ['WIN', 'LOSS', 'BREAKEVEN'];

// Trade core schemas
const baseTradeContextSchema = z.object({
  tradingAccountId: z.string().uuid('Invalid account ID'),
  pair: z.string().min(1, 'Pair is required').transform((val) => val.trim().toUpperCase()),
  direction: z.enum(['BUY', 'SELL'], { required_error: 'Direction is required' }),
  status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED']),
});

const quickTradeSchema = baseTradeContextSchema.extend({
  entryPrice: optionalFloat,
  stopLoss: optionalFloat,
  takeProfit: optionalFloat,
  exitPrice: optionalFloat,
  lotSize: optionalFloat,
  riskAmount: optionalFloat,
  profitLossAmount: optionalFloat,
  result: z.enum(['OPEN', ...closedTradeResults]).optional(),
  
  entryTime: optionalDate,
  exitTime: optionalDate,
  
  strategyName: optionalString,
  setupType: optionalString,
  entryReason: optionalString,
}).superRefine((data, ctx) => {
  // If status is OPEN, require entry info (simplification depending on actual UX requirements)
  if (data.status === 'ACTIVE' || data.status === 'CLOSED') {
    if (!data.entryPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Entry price is required for active/closed trades", path: ['entryPrice'] });
    }
    if (!data.entryTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Entry time is required for active/closed trades", path: ['entryTime'] });
    }
  }

  // If CLOSED, exit info is normally required, but we allow partial saves if they just hit 'Save'. Wait, instructions: 'Closed trade - Entry price required, Exit price required, Entry time required, Exit time required'
  if (data.status === 'CLOSED') {
    if (!data.exitPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exit price is required for closed trades", path: ['exitPrice'] });
    }
    if (!data.exitTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exit time is required for closed trades", path: ['exitTime'] });
    }
    const hasProfitLossAmount = data.profitLossAmount !== undefined && data.profitLossAmount !== null && data.profitLossAmount !== '';
    if (!hasProfitLossAmount && !closedTradeResults.includes(data.result)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Realised P/L or a closed result is required for closed trades", path: ['profitLossAmount'] });
    }
  }

  // If exit and entry time exist, exit must be after entry
  if (data.entryTime && data.exitTime) {
    if (new Date(data.exitTime) < new Date(data.entryTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exit time cannot be before entry time", path: ['exitTime'] });
    }
  }
});

const closedTradeOutcomeSchema = z.object({
  profitLossAmount: optionalFloat,
});

const ruleViolationSchema = z.object({
  id: z.string().uuid().optional(),
  tradeRuleId: z.string().uuid(),
  severity: z.enum(violationSeverities).default('MINOR'),
  note: optionalString,
});

const emotionLogSchema = z.object({
  id: z.string().uuid().optional(),
  stage: z.enum(emotionStages),
  emotion: z.enum(emotions),
  intensity: emotionIntensity,
  note: optionalString,
});

const tradeReviewSchema = z.object({
  session: optionalString,
  higherTimeframe: optionalString,
  entryTimeframe: optionalString,
  htfBias: optionalString,

  isAPlusSetup: optionalBoolean,
  followedPlan: optionalBoolean,
  newsRelated: optionalBoolean,
  grade: z.enum(['A_PLUS', 'A', 'B', 'C', 'D', 'MISTAKE']).optional().or(z.literal('')),

  entryReason: optionalString,
  exitReason: optionalString,
  notesBefore: optionalString,
  notesAfter: optionalString,

  ruleViolations: z.array(ruleViolationSchema).optional(),
  emotionLogs: z.array(emotionLogSchema).optional(),
});

module.exports = {
  quickTradeSchema,
  tradeReviewSchema,
  ruleViolationSchema,
  emotionLogSchema,
};
