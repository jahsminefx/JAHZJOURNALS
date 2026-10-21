const { z } = require('zod');

const emptyValue = z.literal('').or(z.null());
const optionalString = z.union([z.string().trim(), emptyValue]).optional();
const optionalBoolean = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((v) => v === 'true'),
  emptyValue,
]).optional();

const visibilityOptionsSchema = z.object({
  showPrices: optionalBoolean,
  showRR: optionalBoolean,
  showResult: optionalBoolean,
  showPnLPercent: optionalBoolean,
  showPnLDollar: optionalBoolean,
  showPips: optionalBoolean,
  showLotSize: optionalBoolean,
  showSession: optionalBoolean,
}).optional().nullable();

const customTradeSetupSchema = z.object({
  pair: z.string().trim().max(30).optional().nullable(),
  direction: z.string().trim().max(30).optional().nullable(),
  entryPrice: z.union([z.number(), z.string(), z.null()]).optional(),
  stopLoss: z.union([z.number(), z.string(), z.null()]).optional(),
  takeProfit: z.union([z.number(), z.string(), z.null()]).optional(),
  exitPrice: z.union([z.number(), z.string(), z.null()]).optional(),
  riskRewardRatio: z.union([z.number(), z.string(), z.null()]).optional(),
  pips: z.union([z.number(), z.string(), z.null()]).optional(),
  profitLoss: z.union([z.number(), z.string(), z.null()]).optional(),
  profitLossPercent: z.union([z.number(), z.string(), z.null()]).optional(),
  lotSize: z.union([z.number(), z.string(), z.null()]).optional(),
  result: z.string().trim().max(30).optional().nullable(),
  status: z.string().trim().max(30).optional().nullable(),
  session: z.string().trim().max(40).optional().nullable(),
  higherTimeframe: z.string().trim().max(30).optional().nullable(),
  entryTimeframe: z.string().trim().max(30).optional().nullable(),
  htfBias: z.string().trim().max(30).optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
  shareMode: z.enum(['JOURNAL_TRADE', 'DIRECT_SETUP']).optional(),
}).optional().nullable();

const createTradeShareSchema = z.object({
  targetCohortIds: z.array(z.string().uuid('Invalid cohort ID')).min(1, 'Please select at least one cohort to share this trade with.'),
  sourceTradeId: z.string().uuid('Invalid source trade ID').optional().nullable().or(z.literal('')),
  title: z.string().trim().max(160, 'Title cannot exceed 160 characters').optional().nullable(),
  setupThesis: optionalString,
  entryReasoning: optionalString,
  riskRationale: optionalString,
  managementReasoning: optionalString,
  outcomeLessons: optionalString,
  generalNotes: optionalString,
  isCaseStudy: optionalBoolean.default(false),
  pinned: optionalBoolean.default(false),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  attachmentIds: z.array(z.string()).optional().default([]),
  visibilityOptions: visibilityOptionsSchema,
  customTradeSetup: customTradeSetupSchema,
  logToMentorAccount: optionalBoolean,
  mentorTradingAccountId: z.string().uuid().optional().nullable().or(z.literal('')),
});

const updateTradeShareSchema = z.object({
  targetCohortIds: z.array(z.string().uuid('Invalid cohort ID')).optional(),
  title: z.string().trim().max(160).optional().nullable(),
  setupThesis: optionalString,
  entryReasoning: optionalString,
  riskRationale: optionalString,
  managementReasoning: optionalString,
  outcomeLessons: optionalString,
  generalNotes: optionalString,
  isCaseStudy: optionalBoolean,
  pinned: optionalBoolean,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  attachmentIds: z.array(z.string()).optional(),
  visibilityOptions: visibilityOptionsSchema,
  customTradeSetup: customTradeSetupSchema,
  logToMentorAccount: optionalBoolean,
  mentorTradingAccountId: z.string().uuid().optional().nullable().or(z.literal('')),
});

const announcementCategories = ['GENERAL', 'MARKET_UPDATE', 'WEBINAR', 'TRADE_ALERT', 'ASSIGNMENT', 'RISK_NOTICE'];

const createAnnouncementSchema = z.object({
  mentorGroupId: z.string().uuid('Invalid cohort ID').optional().nullable(),
  targetCohortIds: z.array(z.string().uuid('Invalid cohort ID')).optional(),
  title: z.string().trim().min(1, 'Title is required').max(160, 'Title cannot exceed 160 characters'),
  content: z.string().trim().min(1, 'Announcement content is required').max(10000, 'Content cannot exceed 10,000 characters'),
  category: z.enum(announcementCategories).default('GENERAL'),
  isPinned: optionalBoolean.default(false),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  attachments: z.array(z.object({
    title: z.string().trim().max(100),
    url: z.string().url('Invalid attachment URL'),
    type: z.string().optional(),
  })).optional().default([]),
});

const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  category: z.enum(announcementCategories).optional(),
  isPinned: optionalBoolean,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  attachments: z.array(z.object({
    title: z.string().trim().max(100),
    url: z.string().url('Invalid attachment URL'),
    type: z.string().optional(),
  })).optional(),
});

const sendDirectMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000, 'Message cannot exceed 5,000 characters'),
  tradeShareId: z.string().uuid().optional().nullable().or(z.literal('')),
  attachmentUrl: z.string().trim().max(1000).optional().nullable().or(z.literal('')),
});

module.exports = {
  createTradeShareSchema,
  updateTradeShareSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  sendDirectMessageSchema,
};
