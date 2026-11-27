const { z } = require('zod');

const USER_CREATABLE_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'PAYOUT', 'FEE', 'ADJUSTMENT'];
const DIRECTIONS = ['INFLOW', 'OUTFLOW'];

const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);

const validateOccurredAt = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  if (normalized instanceof Date) return normalized;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}, z.date({ message: 'Please provide a valid date and time.' })).refine((date) => {
  if (!date) return true;
  const maxAllowed = Date.now() + 24 * 60 * 60 * 1000;
  return date.getTime() <= maxAllowed;
}, { message: 'Transaction date cannot be more than 24 hours in the future.' });

const noteField = z.preprocess(
  (value) => (value === undefined ? undefined : (value === null ? null : String(value).trim())),
  z.string().max(500, 'Note cannot exceed 500 characters.').nullable().optional()
).transform((val) => (val === '' ? null : val));

const currencyField = z.preprocess(
  (value) => {
    const normalized = emptyToUndefined(value);
    return normalized === undefined ? undefined : String(normalized).trim().toUpperCase();
  },
  z.string().min(3, 'Currency code must be at least 3 characters.').max(10, 'Currency code is too long.').optional()
);

const idempotencyKeyField = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(128, 'Idempotency key is too long.').optional()
);

const validateTypeDirectionConsistency = (data, ctx, existingType = null) => {
  const effectiveType = data.type || existingType;
  if (!effectiveType) return;

  if (effectiveType === 'ADJUSTMENT') {
    if (!data.direction) {
      ctx.addIssue({
        code: 'custom',
        path: ['direction'],
        message: 'Please select whether this balance adjustment increases (INFLOW) or decreases (OUTFLOW) the account.',
      });
    }
    return;
  }

  if (data.direction) {
    const expectedDirection = effectiveType === 'DEPOSIT' ? 'INFLOW' : 'OUTFLOW';
    if (data.direction !== expectedDirection) {
      ctx.addIssue({
        code: 'custom',
        path: ['direction'],
        message: `${effectiveType} transactions must use direction ${expectedDirection}.`,
      });
    }
  }
};

const createAccountTransactionSchema = z.object({
  type: z.enum(USER_CREATABLE_TYPES, {
    message: 'Transaction type must be Deposit, Withdrawal, Payout, Fee, or Balance adjustment.',
  }),
  amount: z.coerce
    .number({ message: 'Please enter a valid positive amount.' })
    .finite('Amount must be a valid finite number.')
    .positive('Amount must be greater than zero.')
    .max(1_000_000_000, 'Amount is too large.'),
  direction: z.preprocess(emptyToUndefined, z.enum(DIRECTIONS).optional()),
  currency: currencyField,
  occurredAt: validateOccurredAt.optional(),
  note: noteField,
  idempotencyKey: idempotencyKeyField,
}).superRefine((data, ctx) => {
  validateTypeDirectionConsistency(data, ctx);
});

const updateAccountTransactionSchema = z.object({
  type: z.preprocess(
    emptyToUndefined,
    z.enum(USER_CREATABLE_TYPES, {
      message: 'Transaction type must be Deposit, Withdrawal, Payout, Fee, or Balance adjustment.',
    }).optional()
  ),
  amount: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ message: 'Please enter a valid positive amount.' })
      .finite('Amount must be a valid finite number.')
      .positive('Amount must be greater than zero.')
      .max(1_000_000_000, 'Amount is too large.')
      .optional()
  ),
  direction: z.preprocess(emptyToUndefined, z.enum(DIRECTIONS).optional()),
  currency: currencyField,
  occurredAt: validateOccurredAt.optional(),
  note: noteField,
}).superRefine((data, ctx) => {
  const hasAnyUpdate =
    data.type !== undefined
    || data.amount !== undefined
    || data.direction !== undefined
    || data.occurredAt !== undefined
    || data.note !== undefined
    || data.currency !== undefined;

  if (!hasAnyUpdate) {
    ctx.addIssue({
      code: 'custom',
      path: [],
      message: 'Provide at least one field to update.',
    });
  }

  if (data.type === 'ADJUSTMENT' && !data.direction) {
    ctx.addIssue({
      code: 'custom',
      path: ['direction'],
      message: 'Please select whether this balance adjustment increases or decreases the account.',
    });
  } else if (data.type && data.type !== 'ADJUSTMENT' && data.direction) {
    validateTypeDirectionConsistency(data, ctx);
  }
});

const archiveAccountTransactionSchema = z.object({
  reason: z.preprocess(
    (value) => (value === undefined || value === null ? undefined : String(value).trim()),
    z.string().max(300, 'Archive reason cannot exceed 300 characters.').optional()
  ).transform((val) => (val === '' ? undefined : val)),
});

const formatTransactionZodError = (error) => ({
  message: error?.issues?.[0]?.message || 'Validation failed',
  errors: (error?.issues || []).map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  })),
});

module.exports = {
  USER_CREATABLE_TYPES,
  DIRECTIONS,
  createAccountTransactionSchema,
  updateAccountTransactionSchema,
  archiveAccountTransactionSchema,
  formatTransactionZodError,
};
