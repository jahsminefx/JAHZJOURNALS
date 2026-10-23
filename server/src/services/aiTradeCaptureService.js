const { z } = require('zod');
const { getProvider } = require('../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../ai/utils/validateStructuredOutput');
const {
  classifyTrade,
  isStopAtOrPastEntry,
  OUTCOMES,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS,
  CLASSIFICATION_SOURCES,
} = require('./tradeClassificationService');
const {
  checkTradeDuplicate,
  detectBatchDuplicates,
} = require('./tradeDuplicateDetectionService');
const {
  resolveAccountHierarchy,
  detectCurrencyConflict,
  disambiguateMonetaryValue,
} = require('./accountResolutionService');

const parseNum = (v) => {
  if (v === null || v === undefined || v === '' || v === 'null') return null;
  const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? null : n;
};

// ==========================================
// ZOD SCHEMAS FOR TEXT & IMAGE CAPTURE
// ==========================================

const TextTradeCaptureSchema = z.object({
  instrument: z.string().nullable().default(null),
  direction: z.enum(['BUY', 'SELL']).nullable().default(null),
  entryPrice: z.number().nullable().default(null),
  exitPrice: z.number().nullable().default(null),
  stopLoss: z.number().nullable().default(null),
  takeProfit: z.number().nullable().default(null),
  volume: z.number().nullable().default(null),
  grossProfit: z.number().nullable().default(null),
  commission: z.number().nullable().default(null),
  swap: z.number().nullable().default(null),
  fees: z.number().nullable().default(null),
  accountName: z.string().nullable().default(null),
  strategyName: z.string().nullable().default(null),
  setupType: z.string().nullable().default(null),
  timeframe: z.string().nullable().default(null),
  entryReason: z.string().nullable().default(null),
  exitReason: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  emotions: z.array(z.string()).default([]),
  lessonsLearned: z.string().nullable().default(null),
  breakEvenMentioned: z.boolean().default(false),
  trailingStopMentioned: z.boolean().default(false),
  status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED']).nullable().default(null),
  assistantReply: z.string().default(''),
  missingFields: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).default(0.8),
});

/**
 * Coerces primitive values, null, undefined, or existing objects into the canonical
 * field structure: { value: any, status: 'CONFIRMED' | 'UNCERTAIN' | 'MISSING', note: string }
 */
const coerceToExtractedField = (input) => {
  if (input === undefined || input === null) {
    return { value: null, status: 'MISSING', note: '' };
  }
  if (typeof input === 'object' && !Array.isArray(input)) {
    if ('value' in input || 'status' in input) {
      const val = input.value !== undefined ? input.value : null;
      let status = input.status;
      if (!['CONFIRMED', 'UNCERTAIN', 'MISSING'].includes(status)) {
        status = val !== null && val !== undefined ? 'CONFIRMED' : 'MISSING';
      }
      return {
        value: val,
        status,
        note: typeof input.note === 'string' ? input.note : '',
      };
    }
  }
  // It's a primitive value (string, number, boolean, etc.)
  return {
    value: input,
    status: 'CONFIRMED',
    note: '',
  };
};

const ExtractedFieldSchema = z.preprocess(
  coerceToExtractedField,
  z.object({
    value: z.any().nullable().default(null),
    status: z.enum(['CONFIRMED', 'UNCERTAIN', 'MISSING']).default('MISSING'),
    note: z.string().default(''),
  })
);

const defaultField = () => ({ value: null, status: 'MISSING', note: '' });

/**
 * Normalizes BreakEvenCandidate structure from model
 */
const BreakEvenCandidateSchema = z.preprocess(
  (input) => {
    if (typeof input === 'boolean') {
      return {
        isBreakEvenCandidate: input,
        rationale: input ? 'Break-even stop visible' : '',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'UNKNOWN',
      };
    }
    if (!input || typeof input !== 'object') {
      return {
        isBreakEvenCandidate: false,
        rationale: '',
        requiresUserConfirmation: true,
        candidateEvidenceSource: 'UNKNOWN',
      };
    }
    return {
      isBreakEvenCandidate: Boolean(input.isBreakEvenCandidate || input.isCandidate || input.breakEvenCandidate),
      rationale: typeof input.rationale === 'string' ? input.rationale : '',
      requiresUserConfirmation: input.requiresUserConfirmation !== undefined ? Boolean(input.requiresUserConfirmation) : true,
      candidateEvidenceSource: ['MT_TRAILING_STOP', 'MT_SL_TO_ENTRY', 'PRICE_ACTION_INFERRED', 'UNKNOWN'].includes(input.candidateEvidenceSource)
        ? input.candidateEvidenceSource
        : 'UNKNOWN',
    };
  },
  z.object({
    isBreakEvenCandidate: z.boolean().default(false),
    rationale: z.string().default(''),
    requiresUserConfirmation: z.boolean().default(true),
    candidateEvidenceSource: z.enum([
      'MT_TRAILING_STOP',
      'MT_SL_TO_ENTRY',
      'PRICE_ACTION_INFERRED',
      'UNKNOWN',
    ]).default('UNKNOWN'),
  })
);

/**
 * Preprocessor that unwraps response envelopes and standardizes field synonyms
 */
const normalizeVisionTradeResponse = (rawObj) => {
  if (!rawObj || typeof rawObj !== 'object') {
    return {};
  }

  let target = rawObj;

  // 1. Unwrap arrays e.g. { trades: [ { ... } ] } or [ { ... } ]
  if (Array.isArray(target)) {
    target = target[0] || {};
  } else if (Array.isArray(target.trades) && target.trades.length > 0) {
    target = { ...target, ...target.trades[0], detectedTradeCount: target.trades.length };
  } else if (Array.isArray(target.items) && target.items.length > 0) {
    target = { ...target, ...target.items[0], detectedTradeCount: target.items.length };
  }

  // 2. Unwrap nested object envelopes e.g. { trade: { ... } }, { data: { ... } }, { candidateTrade: { ... } }
  const envelopeKeys = [
    'trade',
    'candidateTrade',
    'extractedTrade',
    'extracted_trade',
    'tradeCapture',
    'deal',
    'order',
    'position',
    'result',
    'data',
    'details',
  ];

  for (const envKey of envelopeKeys) {
    if (
      target[envKey] &&
      typeof target[envKey] === 'object' &&
      !Array.isArray(target[envKey]) &&
      !('status' in target[envKey] && 'value' in target[envKey])
    ) {
      const inner = target[envKey];
      target = { ...target, ...inner };
      break;
    }
  }

  // Helper to pick first non-undefined alias
  const pick = (...keys) => {
    for (const k of keys) {
      if (target[k] !== undefined) return target[k];
    }
    return undefined;
  };

  const normalized = {
    screenshotType: pick('screenshotType', 'type_of_screenshot', 'imageType', 'receiptType') || 'UNKNOWN',
    instrument: pick('instrument', 'symbol', 'pair', 'asset', 'ticker', 'item', 'currencyPair', 'market'),
    direction: pick('direction', 'type', 'side', 'orderType', 'action', 'operation', 'cmd'),
    volume: pick('volume', 'lotSize', 'lots', 'size', 'amount', 'contracts', 'vol'),
    entryPrice: pick('entryPrice', 'openPrice', 'open_price', 'entry_price', 'price', 'openRate', 'open', 'rate'),
    exitPrice: pick('exitPrice', 'closePrice', 'close_price', 'exit_price', 'closeRate', 'close'),
    stopLoss: pick('stopLoss', 'sl', 's_l', 'stop_loss', 'stop'),
    takeProfit: pick('takeProfit', 'tp', 't_p', 'take_profit', 'target'),
    grossProfit: pick('grossProfit', 'profit', 'gross_profit', 'pnl', 'p_l', 'realizedProfit', 'netProfit'),
    commission: pick('commission', 'comm', 'commissions', 'brokerCommission'),
    swap: pick('swap', 'rollover', 'swaps', 'interest'),
    fees: pick('fees', 'fee', 'taxes', 'tax', 'brokerFees'),
    ticket: pick('ticket', 'order', 'orderId', 'order_id', 'deal', 'dealId', 'deal_id', 'ticketId', 'positionId'),
    entryTime: pick('entryTime', 'openTime', 'open_time', 'entry_time', 'date_open', 'openedAt'),
    exitTime: pick('exitTime', 'closeTime', 'close_time', 'exit_time', 'date_close', 'closedAt'),
    accountCurrency: pick('accountCurrency', 'currency', 'depositCurrency', 'account_currency'),
    accountIdentifier: pick('accountIdentifier', 'account', 'login', 'account_id', 'accountNumber'),
    brokerName: pick('brokerName', 'broker', 'server', 'company'),
    timeframe: pick('timeframe', 'tf', 'chartTimeframe', 'interval'),
    setupDescription: pick('setupDescription', 'setup', 'description', 'notes', 'analysis', 'setup_description'),
    breakEvenCandidate: pick('breakEvenCandidate', 'breakEven', 'be', 'beCandidate'),
    detectedTradeCount: pick('detectedTradeCount', 'count'),
    confidenceScore: pick('confidenceScore', 'confidence'),
    rawSummary: pick('rawSummary', 'summary', 'comment'),
  };

  return normalized;
};

const ImageTradeCaptureSchema = z.preprocess(
  normalizeVisionTradeResponse,
  z.object({
    screenshotType: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const upper = val.toUpperCase().trim();
          if (['BROKER_RECEIPT', 'OPEN_POSITION', 'CHART_SETUP', 'UNKNOWN'].includes(upper)) {
            return upper;
          }
        }
        return 'UNKNOWN';
      },
      z.enum(['BROKER_RECEIPT', 'OPEN_POSITION', 'CHART_SETUP', 'UNKNOWN']).default('UNKNOWN')
    ),
    instrument: ExtractedFieldSchema.default(defaultField),
    direction: ExtractedFieldSchema.default(defaultField),
    volume: ExtractedFieldSchema.default(defaultField),
    entryPrice: ExtractedFieldSchema.default(defaultField),
    exitPrice: ExtractedFieldSchema.default(defaultField),
    stopLoss: ExtractedFieldSchema.default(defaultField),
    takeProfit: ExtractedFieldSchema.default(defaultField),
    grossProfit: ExtractedFieldSchema.default(defaultField),
    commission: ExtractedFieldSchema.default(defaultField),
    swap: ExtractedFieldSchema.default(defaultField),
    fees: ExtractedFieldSchema.default(defaultField),
    ticket: ExtractedFieldSchema.default(defaultField),
    entryTime: ExtractedFieldSchema.default(defaultField),
    exitTime: ExtractedFieldSchema.default(defaultField),
    accountCurrency: ExtractedFieldSchema.default(defaultField),
    accountIdentifier: ExtractedFieldSchema.default(defaultField),
    brokerName: ExtractedFieldSchema.default(defaultField),
    timeframe: ExtractedFieldSchema.default(defaultField),
    setupDescription: ExtractedFieldSchema.default(defaultField),
    breakEvenCandidate: BreakEvenCandidateSchema.default({
      isBreakEvenCandidate: false,
      rationale: '',
      requiresUserConfirmation: true,
      candidateEvidenceSource: 'UNKNOWN',
    }),
    detectedTradeCount: z.preprocess(
      (v) => (v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : 1),
      z.number().default(1)
    ),
    confidenceScore: z.preprocess(
      (v) => (v !== undefined && v !== null && !isNaN(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : 0.5),
      z.number().min(0).max(1).default(0.5)
    ),
    rawSummary: z.preprocess(
      (v) => (typeof v === 'string' ? v : ''),
      z.string().default('')
    ),
  })
);

const JournalEnrichmentSchema = z.object({
  suggestedEntryReason: z.string().default(''),
  suggestedExitReason: z.string().default(''),
  ruleAdherenceFeedback: z.string().default(''),
  riskManagementReflection: z.string().default(''),
  keyLessons: z.array(z.string()).default([]),
  suggestedMistakes: z.array(z.string()).default([]),
  summaryReflection: z.string().default(''),
});

// ==========================================
// SYSTEM PROMPTS ENFORCING BOUNDARIES
// ==========================================

const TEXT_CAPTURE_SYSTEM_PROMPT = `You are the JAHZ AI Trade Logging Assistant.
Your goal is to converse with a trader, extract structured trade information from their messages, and ask targeted follow-up questions for missing required details.

MANDATORY RULES:
1. NEVER invent or hallucinate financial values, prices, volume, accounts, or timestamps.
2. If the user mentions "gold", instrument should be "XAUUSD". If they mention "bitcoin", instrument is "BTCUSD". Standardize instrument symbols (e.g., EURUSD, GBPUSD, NAS100, US30).
3. Direction must be strictly BUY or SELL.
4. If the user mentions moving a stop loss to break-even or trailing the stop, set 'breakEvenMentioned' or 'trailingStopMentioned' to true.
5. In 'assistantReply', warmly acknowledge the values understood, summarize the pending trade draft in 1-2 bullet points, and politely ask for any missing key fields (such as account, lot size, or entry/exit prices).
6. Return strictly valid JSON matching the schema.`;

const IMAGE_CAPTURE_SYSTEM_PROMPT = `You are a financial OCR and visual data extraction engine for trading journal records.
You extract exact visual text and numbers from MetaTrader receipts, broker deal confirmations, open position tickets, or marked chart screenshots.

MANDATORY RULES:
1. NEVER calculate, invent, or project financial figures. AI must never authoritatively compute profit/loss.
2. Distinguish screenshot nature in 'screenshotType':
   - 'BROKER_RECEIPT': Closed trade ticket with executed entry, exit price, and pnl.
   - 'OPEN_POSITION': Active/running position ticket (floating pnl, exit price missing).
   - 'CHART_SETUP': Candlestick chart with technical analysis/lines, not an executed broker deal.
3. For each extracted field, output an object with 'value' and 'status':
   - 'CONFIRMED': If the number or text is sharp and clearly visible on the image.
   - 'UNCERTAIN': If partially obscured, fuzzy, or ambiguous.
   - 'MISSING': If absent or not shown on the image, with value null.
4. Check if stop loss was moved to/past entry or if trailing stop is visible in comments, setting 'breakEvenCandidate.isBreakEvenCandidate = true'.
5. Always set 'requiresUserConfirmation' to true for any inferred break-even management.
6. Return strictly valid JSON adhering to this exact schema structure:

{
  "screenshotType": "BROKER_RECEIPT",
  "instrument": { "value": "BTCUSD", "status": "CONFIRMED" },
  "direction": { "value": "BUY", "status": "CONFIRMED" },
  "volume": { "value": 0.22, "status": "CONFIRMED" },
  "entryPrice": { "value": 82351.75, "status": "CONFIRMED" },
  "exitPrice": { "value": 82361.97, "status": "CONFIRMED" },
  "stopLoss": { "value": 82370.08, "status": "CONFIRMED" },
  "takeProfit": { "value": 83174.00, "status": "CONFIRMED" },
  "grossProfit": { "value": 2.25, "status": "CONFIRMED" },
  "commission": { "value": -0.66, "status": "CONFIRMED" },
  "swap": { "value": 0.00, "status": "CONFIRMED" },
  "fees": { "value": 0.00, "status": "CONFIRMED" },
  "ticket": { "value": "43789391", "status": "CONFIRMED" },
  "entryTime": { "value": "2026-10-19T08:30:00Z", "status": "CONFIRMED" },
  "exitTime": { "value": "2026-10-19T14:45:00Z", "status": "CONFIRMED" },
  "accountCurrency": { "value": "USD", "status": "CONFIRMED" },
  "accountIdentifier": { "value": null, "status": "MISSING" },
  "brokerName": { "value": null, "status": "MISSING" },
  "timeframe": { "value": null, "status": "MISSING" },
  "setupDescription": { "value": null, "status": "MISSING" },
  "breakEvenCandidate": {
    "isBreakEvenCandidate": true,
    "rationale": "Stop loss was trailed above entry price",
    "requiresUserConfirmation": true,
    "candidateEvidenceSource": "MT_TRAILING_STOP"
  },
  "detectedTradeCount": 1,
  "confidenceScore": 0.95,
  "rawSummary": "BTCUSD BUY 0.22 lots closed at 82361.97 with profit 2.25"
}`;

// ==========================================
// CORE EXTRACTION METHODS
// ==========================================

/**
 * Method A: Natural-Language Conversational Trade Capture
 */
const parseTradeFromText = async ({
  text,
  currentDraft = {},
  userAccounts = [],
  userStrategies = [],
  userSetups = [],
  userThresholdAmount = null,
  mockExtraction = null,
} = {}) => {
  let extraction = mockExtraction;

  if (!extraction) {
    const provider = getProvider();
    const userPrompt = `Trader Message: "${text}"

Current Draft State:
${JSON.stringify(currentDraft, null, 2)}

User's Trading Accounts Available:
${userAccounts.map((a) => `- ${a.name} (${a.currency || 'USD'}, ID: ${a.id})`).join('\n') || 'None'}

User's Strategies Available:
${userStrategies.map((s) => `- ${s.name}`).join('\n') || 'None'}

Extract any new or modified trade information and provide an assistant reply asking for any missing fields needed to log this trade.`;

    const result = await validateStructuredOutput(
      provider,
      TEXT_CAPTURE_SYSTEM_PROMPT,
      userPrompt,
      TextTradeCaptureSchema,
      1
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to interpret trade description');
    }

    extraction = result.data;
  }

  // Merge newly extracted values with currentDraft (new confirmed values take precedence)
  const pair = extraction.instrument ? extraction.instrument.toUpperCase().trim() : (currentDraft.pair || null);
  const direction = extraction.direction || currentDraft.direction || null;
  const entryPrice = extraction.entryPrice != null ? extraction.entryPrice : parseNum(currentDraft.entryPrice);
  const exitPrice = extraction.exitPrice != null ? extraction.exitPrice : parseNum(currentDraft.exitPrice);
  const stopLoss = extraction.stopLoss != null ? extraction.stopLoss : parseNum(currentDraft.stopLoss);
  const takeProfit = extraction.takeProfit != null ? extraction.takeProfit : parseNum(currentDraft.takeProfit);
  const lotSize = extraction.volume != null ? extraction.volume : parseNum(currentDraft.lotSize);
  const grossProfit = extraction.grossProfit != null ? extraction.grossProfit : parseNum(currentDraft.grossProfit);
  const commission = extraction.commission != null ? extraction.commission : (parseNum(currentDraft.commission) ?? 0);
  const swap = extraction.swap != null ? extraction.swap : (parseNum(currentDraft.swap) ?? 0);
  const fees = extraction.fees != null ? extraction.fees : (parseNum(currentDraft.fees) ?? 0);

  // Resolve trading account through hierarchical resolution service
  const accountResolution = resolveAccountHierarchy({
    currentAccountId: currentDraft.tradingAccountId,
    requestedAccountName: extraction.accountName,
    userAccounts,
  });

  const resolvedAccount = accountResolution.resolvedAccount;
  const matchedAccountId = resolvedAccount?.id || currentDraft.tradingAccountId || null;
  const matchedAccountName = resolvedAccount?.name || currentDraft.accountName || null;
  const authoritativeCurrency = resolvedAccount?.currency || currentDraft.accountCurrency || 'USD';

  // Determine trade status
  let status = extraction.status || currentDraft.status || (exitPrice !== null ? 'CLOSED' : (entryPrice !== null ? 'ACTIVE' : 'PLANNED'));

  // Calculate deterministic net profit if closed
  let netProfit = null;
  if (status === 'CLOSED' && grossProfit !== null) {
    netProfit = Math.round((grossProfit + commission + swap + fees) * 100) / 100;
  } else if (currentDraft.profitLossAmount !== null && currentDraft.profitLossAmount !== undefined) {
    netProfit = parseNum(currentDraft.profitLossAmount);
  }

  // Evaluate break-even protection
  const isStopBe = (stopLoss !== null && entryPrice !== null && direction)
    ? isStopAtOrPastEntry({ direction, entryPrice, stopLoss, pair })
    : false;

  const isBeProtected = Boolean(
    extraction.breakEvenMentioned ||
    currentDraft.breakEvenActivated ||
    isStopBe
  );

  // Deterministically classify outcome using canonical service
  const classification = classifyTrade({
    status,
    direction,
    pair,
    entryPrice,
    exitPrice,
    stopLoss,
    initialStopLoss: stopLoss,
    lotSize,
    grossProfit,
    commission,
    swap,
    fees,
    profitLossAmount: status === 'CLOSED' ? netProfit : null,
    breakEvenActivated: isBeProtected,
    breakEvenPrice: isBeProtected ? (stopLoss || entryPrice) : null,
    breakEvenEvidenceSource: extraction.breakEvenMentioned ? EVIDENCE_SOURCES.USER_MANUAL : (isStopBe ? EVIDENCE_SOURCES.PRICE_ACTION_INFERRED : null),
    breakEvenEvidenceStatus: extraction.breakEvenMentioned ? EVIDENCE_STATUS.USER_CONFIRMED : (isStopBe ? EVIDENCE_STATUS.CONFIRMED : EVIDENCE_STATUS.UNKNOWN),
    userConfirmedBe: extraction.breakEvenMentioned || Boolean(currentDraft.userConfirmedBe),
    userThresholdAmount,
  });

  const updatedDraft = {
    pair,
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    lotSize,
    grossProfit,
    commission,
    swap,
    fees,
    profitLossAmount: status === 'CLOSED' ? (netProfit ?? classification.netProfit) : null,
    status,
    result: classification.result,
    tradingAccountId: matchedAccountId,
    accountName: matchedAccountName,
    accountCurrency: authoritativeCurrency,
    strategyName: extraction.strategyName || currentDraft.strategyName || null,
    setupType: extraction.setupType || currentDraft.setupType || null,
    entryTimeframe: extraction.timeframe || currentDraft.entryTimeframe || null,
    entryReason: extraction.entryReason || currentDraft.entryReason || null,
    exitReason: extraction.exitReason || currentDraft.exitReason || null,
    notes: extraction.notes || currentDraft.notes || currentDraft.notesBefore || null,
    notesBefore: extraction.notes || currentDraft.notesBefore || currentDraft.notes || null,
    notesAfter: extraction.lessonsLearned || currentDraft.notesAfter || null,
    breakEvenActivated: classification.breakEvenActivated,
    breakEvenPrice: classification.breakEvenPrice,
    breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
    breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
    classificationSource: CLASSIFICATION_SOURCES.AI_SUGGESTION,
    badgeLabel: classification.badgeLabel,
    entryTime: currentDraft.entryTime || new Date().toISOString(),
    exitTime: status === 'CLOSED' ? (currentDraft.exitTime || new Date().toISOString()) : null,
  };

  // Determine missing fields required to save
  const missing = [];
  if (!updatedDraft.tradingAccountId) missing.push('Trading Account');
  if (!updatedDraft.pair) missing.push('Trading Pair');
  if (!updatedDraft.direction) missing.push('Direction (BUY/SELL)');
  if (status !== 'PLANNED' && updatedDraft.entryPrice === null) missing.push('Entry Price');
  if (status === 'CLOSED' && updatedDraft.exitPrice === null) missing.push('Exit Price');

  let assistantReply = extraction.assistantReply || '';
  if (accountResolution.status === 'CONFIRMATION_REQUIRED') {
    assistantReply = `${assistantReply}\n\n⚠️ ${accountResolution.conflictReason} Please confirm which account you want to use.`.trim();
  } else if (accountResolution.status === 'AMBIGUOUS') {
    assistantReply = `${assistantReply}\n\n❓ Which trading account should this trade belong to?`.trim();
  }

  const isReadyToSave = missing.length === 0 && accountResolution.status !== 'CONFIRMATION_REQUIRED';

  return {
    updatedDraft,
    assistantReply,
    missingFields: missing,
    isReadyToSave,
    confidenceScore: extraction.confidenceScore || 0.8,
    accountResolution,
  };
};

/**
 * Method B & C: Screenshot-to-Trade Extraction (Broker receipts, open positions, chart setups)
 */
const parseTradeFromImage = async ({
  imageBuffer,
  mimeType = 'image/png',
  imageUrl = null,
  userAccounts = [],
  userThresholdAmount = null,
  existingTrades = null,
  userId = null,
  userMessage = null,
  currentDraft = {},
  mockExtraction = null,
} = {}) => {
  let extraction = mockExtraction;

  if (!extraction) {
    let base64ImageUrl;
    if (typeof imageBuffer === 'string' && imageBuffer.startsWith('data:')) {
      base64ImageUrl = imageBuffer;
    } else if (Buffer.isBuffer(imageBuffer)) {
      base64ImageUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } else if (imageUrl) {
      base64ImageUrl = imageUrl;
    } else {
      throw new Error('Valid image buffer or URL is required for trade extraction');
    }

    const provider = getProvider();
    const promptText = userMessage && typeof userMessage === 'string' && userMessage.trim()
      ? `Examine this screenshot alongside user's description: "${userMessage.trim()}". Determine if it is a broker trade receipt, an open position, or an annotated chart setup. Extract all visible prices, volume, ticket, broker costs, timestamps, and stop management details adhering strictly to the schema.`
      : 'Examine this screenshot. Determine if it is a broker trade receipt, an open position, or an annotated chart setup. Extract all visible prices, volume, ticket, broker costs, timestamps, and stop management details adhering strictly to the schema.';

    const userPrompt = [
      {
        type: 'text',
        text: promptText,
      },
      {
        type: 'image_url',
        image_url: { url: base64ImageUrl, detail: 'high' },
      },
    ];

    const result = await validateStructuredOutput(
      provider,
      IMAGE_CAPTURE_SYSTEM_PROMPT,
      userPrompt,
      ImageTradeCaptureSchema,
      1,
      true // useVision
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract trade data from screenshot');
    }

    extraction = result.data;
  } else {
    extraction = ImageTradeCaptureSchema.parse(mockExtraction);
  }

  // Parse extracted raw numbers deterministically
  const rawPair = extraction.instrument?.value ? String(extraction.instrument.value).toUpperCase().trim() : null;
  const rawDirection = extraction.direction?.value ? String(extraction.direction.value).toUpperCase().trim() : null;
  const direction = rawDirection && (rawDirection.includes('BUY') || rawDirection === '0')
    ? 'BUY'
    : (rawDirection && (rawDirection.includes('SELL') || rawDirection === '1') ? 'SELL' : null);

  const entryPrice = parseNum(extraction.entryPrice?.value);
  const exitPrice = parseNum(extraction.exitPrice?.value);
  const stopLoss = parseNum(extraction.stopLoss?.value);
  const takeProfit = parseNum(extraction.takeProfit?.value);
  const lotSize = parseNum(extraction.volume?.value);
  const grossProfit = parseNum(extraction.grossProfit?.value);
  const commission = parseNum(extraction.commission?.value) ?? 0;
  const swap = parseNum(extraction.swap?.value) ?? 0;
  const fees = parseNum(extraction.fees?.value) ?? 0;

  // Determine status based on screenshot type
  let status = 'CLOSED';
  if (extraction.screenshotType === 'CHART_SETUP') {
    status = 'PLANNED'; // Never mark an unexecuted chart as a closed trade!
  } else if (extraction.screenshotType === 'OPEN_POSITION' || exitPrice === null) {
    status = 'ACTIVE';
  }

  const isClosed = status === 'CLOSED';
  const netProfit = (isClosed && grossProfit !== null)
    ? Math.round((grossProfit + commission + swap + fees) * 100) / 100
    : null;

  // Check if user explicitly mentioned break-even or trailing stop
  const userBeMention = Boolean(
    userMessage && /break[\s-]?even|trailing\s+stop|\bbe\b/i.test(userMessage)
  );

  // Check if stop loss is at or past entry
  const isStopBe = (stopLoss !== null && entryPrice !== null && direction)
    ? isStopAtOrPastEntry({ direction, entryPrice, stopLoss, pair: rawPair })
    : false;

  const beCandidate = extraction.breakEvenCandidate || {};
  const isCandidateBe = Boolean(
    userBeMention ||
    currentDraft?.breakEvenActivated ||
    beCandidate.isBreakEvenCandidate ||
    isStopBe
  );

  const beEvidenceSource = userBeMention
    ? EVIDENCE_SOURCES.USER_MANUAL
    : (beCandidate.candidateEvidenceSource === 'MT_TRAILING_STOP'
      ? EVIDENCE_SOURCES.MT_TRAILING_STOP
      : (isStopBe ? EVIDENCE_SOURCES.PRICE_ACTION_INFERRED : EVIDENCE_SOURCES.AI_VISION_SUGGESTION));

  const beEvidenceStatus = (userBeMention || currentDraft?.userConfirmedBe)
    ? EVIDENCE_STATUS.USER_CONFIRMED
    : EVIDENCE_STATUS.INFERRED;

  // Deterministically classify outcome using canonical service
  const classification = classifyTrade({
    status,
    direction,
    pair: rawPair,
    entryPrice,
    exitPrice,
    stopLoss,
    initialStopLoss: stopLoss,
    lotSize,
    grossProfit,
    commission,
    swap,
    fees,
    profitLossAmount: isClosed ? netProfit : null,
    breakEvenActivated: isCandidateBe,
    breakEvenPrice: isCandidateBe ? (stopLoss || entryPrice || currentDraft?.breakEvenPrice) : null,
    breakEvenEvidenceSource: beEvidenceSource,
    breakEvenEvidenceStatus: beEvidenceStatus,
    userConfirmedBe: Boolean(userBeMention || currentDraft?.userConfirmedBe),
    userThresholdAmount,
  });

  // Resolve trading account through hierarchical resolution service
  const accountResolution = resolveAccountHierarchy({
    currentAccountId: currentDraft?.tradingAccountId || null,
    requestedAccountName: userMessage || null,
    screenshotAccountInfo: {
      accountNumber: extraction.accountIdentifier?.value,
      brokerName: extraction.brokerName?.value,
    },
    userAccounts,
  });

  const resolvedAccount = accountResolution.resolvedAccount;
  const matchedAccountId = resolvedAccount?.id || null;
  const matchedAccountName = resolvedAccount?.name || null;
  const authoritativeCurrency = resolvedAccount?.currency || 'USD';

  // Check currency conflict with screenshot-reported currency
  const extractedCurrency = extraction.accountCurrency?.value || null;
  const currencyConflict = detectCurrencyConflict({
    account: resolvedAccount,
    screenshotCurrency: extractedCurrency,
  });

  const candidateTrade = {
    pair: rawPair,
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    lotSize,
    grossProfit,
    commission,
    swap,
    fees,
    profitLossAmount: isClosed ? netProfit : null,
    status,
    result: classification.result,
    tradingAccountId: matchedAccountId,
    accountName: matchedAccountName,
    accountCurrency: authoritativeCurrency,
    screenshotCurrency: extractedCurrency,
    hasCurrencyConflict: currencyConflict.hasCurrencyConflict,
    currencyConflictWarning: currencyConflict.warning,
    externalId: extraction.ticket?.value ? String(extraction.ticket.value).trim() : null,
    entryTime: extraction.entryTime?.value ? new Date(extraction.entryTime.value).toISOString() : new Date().toISOString(),
    exitTime: isClosed && extraction.exitTime?.value ? new Date(extraction.exitTime.value).toISOString() : (isClosed ? new Date().toISOString() : null),
    breakEvenActivated: classification.breakEvenActivated,
    breakEvenPrice: classification.breakEvenPrice,
    breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
    breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
    classificationSource: CLASSIFICATION_SOURCES.AI_SUGGESTION,
    badgeLabel: classification.badgeLabel,
    screenshotType: extraction.screenshotType,
    imageUrl,
    timeframe: extraction.timeframe?.value || null,
    strategyId: currentDraft?.strategyId || null,
    emotions: currentDraft?.emotions || [],
    notes: currentDraft?.notes || currentDraft?.notesBefore || (userMessage ? userMessage.trim() : null),
    notesBefore: currentDraft?.notesBefore || currentDraft?.notes || (userMessage ? userMessage.trim() : null),
    entryReason: extraction.setupDescription?.value || null,
  };

  // Check for duplicates against existing journal trades
  let duplicateInfo = { hasDuplicate: false, isPossibleDuplicate: false, similarityScore: 0, matchReason: 'No duplicates' };
  if (userId) {
    duplicateInfo = await checkTradeDuplicate({
      candidate: candidateTrade,
      userId,
      tradingAccountId: matchedAccountId,
      existingTrades,
    });
  }

  let assistantReply = `Extracted trade details for ${rawPair || 'trade'} (${direction || 'ticket'}).`;
  if (userBeMention) {
    assistantReply += ` Recorded break-even protection from your message.`;
  }
  if (accountResolution.status === 'CONFIRMATION_REQUIRED') {
    assistantReply += ` ⚠️ ${accountResolution.conflictReason}`;
  } else if (accountResolution.status === 'AMBIGUOUS') {
    assistantReply += ` ❓ Which trading account should this trade belong to?`;
  }

  return {
    candidateTrade,
    fieldStatuses: {
      instrument: extraction.instrument?.status || 'MISSING',
      direction: extraction.direction?.status || 'MISSING',
      entryPrice: extraction.entryPrice?.status || 'MISSING',
      exitPrice: extraction.exitPrice?.status || 'MISSING',
      stopLoss: extraction.stopLoss?.status || 'MISSING',
      takeProfit: extraction.takeProfit?.status || 'MISSING',
      grossProfit: extraction.grossProfit?.status || 'MISSING',
      commission: extraction.commission?.status || 'MISSING',
      swap: extraction.swap?.status || 'MISSING',
      volume: extraction.volume?.status || 'MISSING',
      ticket: extraction.ticket?.status || 'MISSING',
      brokerName: extraction.brokerName?.status || 'MISSING',
      timeframe: extraction.timeframe?.status || 'MISSING',
      account: matchedAccountId ? 'CONFIRMED' : (accountResolution.status === 'AMBIGUOUS' ? 'UNCERTAIN' : 'MISSING'),
      currency: currencyConflict.hasCurrencyConflict ? 'UNCERTAIN' : 'CONFIRMED',
    },
    requiresUserConfirmation: true,
    duplicateInfo,
    confidenceScore: extraction.confidenceScore || 0.5,
    rationale: beCandidate.rationale || extraction.rawSummary || 'Extracted via JAHZ Vision AI; review before saving.',
    accountResolution,
    currencyConflict,
    assistantReply,
  };
};

/**
 * Method D: Multi-Screenshot Batch Logging
 */
const parseBatchImages = async ({
  images = [],
  userAccounts = [],
  userThresholdAmount = null,
  existingTrades = null,
  userId = null,
  userMessage = null,
  currentDraft = {},
  mockExtraction = null,
} = {}) => {
  const extractedList = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const parsed = await parseTradeFromImage({
        imageBuffer: img.buffer,
        mimeType: img.mimetype,
        imageUrl: img.imageUrl || null,
        userAccounts,
        userThresholdAmount,
        existingTrades,
        userId,
        userMessage,
        currentDraft,
        mockExtraction: img.mockExtraction || mockExtraction || null,
      });

      extractedList.push({
        batchId: `batch_${Date.now()}_${i}`,
        originalFilename: img.originalname || `Screenshot_${i + 1}.png`,
        ...parsed,
      });
    } catch (err) {
      extractedList.push({
        batchId: `batch_${Date.now()}_${i}`,
        originalFilename: img.originalname || `Screenshot_${i + 1}.png`,
        error: err.message,
        candidateTrade: null,
      });
    }
  }

  // Cross-check for intra-batch duplicates among successfully parsed candidates
  const validCandidates = extractedList.filter((item) => item.candidateTrade !== null);
  const batchCrossChecked = detectBatchDuplicates(validCandidates.map((item) => item.candidateTrade));

  batchCrossChecked.forEach((crossCheck, idx) => {
    validCandidates[idx].isDuplicateInBatch = crossCheck.isDuplicateInBatch;
    validCandidates[idx].duplicateReasonInBatch = crossCheck.duplicateReason;
  });

  return extractedList;
};

/**
 * Post-Save Journaling Enrichment Assistant
 */
const generateJournalEnrichment = async ({ trade, userNotes = '' } = {}) => {
  const provider = getProvider();
  const systemPrompt = `You are an elite prop-firm trading performance coach.
Review this completed trade execution and user notes.
Generate thoughtful, structured journaling reflections covering entry/exit execution, rule adherence, risk management, and key lessons.
DO NOT fabricate emotions, intentions, or facts that the trader did not experience.
Return ONLY valid JSON matching the schema.`;

  const userPrompt = `Trade Summary:
- Pair: ${trade.pair}
- Direction: ${trade.direction}
- Status: ${trade.status}
- Result: ${trade.result}
- P&L: $${trade.profitLossAmount}
- Risk/Reward: ${trade.riskRewardRatio || 'N/A'}
- Break-Even Protected: ${trade.breakEvenActivated ? 'YES' : 'NO'}
- Existing Notes: ${userNotes || 'None'}

Provide structured journal suggestions that the trader can easily review and accept into their trading journal.`;

  const result = await validateStructuredOutput(
    provider,
    systemPrompt,
    userPrompt,
    JournalEnrichmentSchema,
    1
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to generate journal enrichment');
  }

  return result.data;
};

module.exports = {
  parseTradeFromText,
  parseTradeFromImage,
  parseBatchImages,
  generateJournalEnrichment,
  TextTradeCaptureSchema,
  ImageTradeCaptureSchema,
  ExtractedFieldSchema,
  BreakEvenCandidateSchema,
  normalizeVisionTradeResponse,
  IMAGE_CAPTURE_SYSTEM_PROMPT,
  JournalEnrichmentSchema,
};
