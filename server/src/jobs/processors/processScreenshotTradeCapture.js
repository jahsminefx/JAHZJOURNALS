const { z } = require('zod');
const { getProvider } = require('../../ai/providers/providerFactory');
const { validateStructuredOutput } = require('../../ai/utils/validateStructuredOutput');
const {
  classifyTrade,
  isStopAtOrPastEntry,
  OUTCOMES,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS,
  CLASSIFICATION_SOURCES,
} = require('../../services/tradeClassificationService');
const {
  ImageTradeCaptureSchema,
  IMAGE_CAPTURE_SYSTEM_PROMPT,
} = require('../../services/aiTradeCaptureService');

const ScreenshotTradeCaptureSchema = ImageTradeCaptureSchema;
const SYSTEM_PROMPT = IMAGE_CAPTURE_SYSTEM_PROMPT;

const parseNum = (v) => {
  if (v === null || v === undefined || v === '' || v === 'null') return null;
  const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? null : n;
};

/**
 * Extract trade data from screenshot and deterministically classify candidate outcome
 *
 * @param {Object} options
 * @param {Buffer|string} options.imageBuffer - Raw image buffer or data URI
 * @param {string} [options.mimeType] - Mime type e.g. 'image/png'
 * @param {number} [options.userThresholdAmount] - Configured BE threshold
 * @param {Object} [options.mockExtraction] - Used in tests or offline fallbacks
 * @returns {Promise<Object>}
 */
const extractTradeFromScreenshot = async ({
  imageBuffer,
  mimeType = 'image/png',
  userThresholdAmount = null,
  mockExtraction = null,
} = {}) => {
  let extraction = mockExtraction;

  if (!extraction) {
    let base64ImageUrl;
    if (typeof imageBuffer === 'string' && imageBuffer.startsWith('data:')) {
      base64ImageUrl = imageBuffer;
    } else if (Buffer.isBuffer(imageBuffer)) {
      base64ImageUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } else {
      throw new Error('Valid image buffer or data URI is required for trade extraction');
    }

    const provider = getProvider();
    const userPromptContent = [
      {
        type: 'text',
        text: 'Extract all trade ticket details, prices, broker costs (commission, swap), volumes, and stop-loss placement from this trade record image.',
      },
      {
        type: 'image_url',
        image_url: { url: base64ImageUrl, detail: 'high' },
      },
    ];

    const result = await validateStructuredOutput(
      provider,
      SYSTEM_PROMPT,
      userPromptContent,
      ScreenshotTradeCaptureSchema,
      1,
      true // useVision
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract trade data from screenshot');
    }

    extraction = result.data;
  } else {
    extraction = ScreenshotTradeCaptureSchema.parse(mockExtraction);
  }

  // Parse extracted raw numbers deterministically
  const rawPair = extraction.instrument?.value ? String(extraction.instrument.value).toUpperCase().trim() : null;
  const rawDirection = extraction.direction?.value ? String(extraction.direction.value).toUpperCase().trim() : null;
  const direction = rawDirection && (rawDirection.includes('BUY') || rawDirection === '0') ? 'BUY' : (rawDirection && (rawDirection.includes('SELL') || rawDirection === '1') ? 'SELL' : null);

  const entryPrice = parseNum(extraction.entryPrice?.value);
  const exitPrice = parseNum(extraction.exitPrice?.value);
  const stopLoss = parseNum(extraction.stopLoss?.value);
  const takeProfit = parseNum(extraction.takeProfit?.value);
  const lotSize = parseNum(extraction.volume?.value);
  const grossProfit = parseNum(extraction.grossProfit?.value);
  const commission = parseNum(extraction.commission?.value) ?? 0;
  const swap = parseNum(extraction.swap?.value) ?? 0;
  const fees = parseNum(extraction.fees?.value) ?? 0;

  // Calculate net profit deterministically
  const netProfit = grossProfit !== null ? Math.round((grossProfit + commission + swap + fees) * 100) / 100 : null;
  const isClosed = Boolean(exitPrice !== null || extraction.exitTime?.value);
  const status = isClosed ? 'CLOSED' : 'ACTIVE';

  // Check if stop loss was at or past entry deterministically
  const isStopBe = (stopLoss !== null && entryPrice !== null && direction)
    ? isStopAtOrPastEntry({ direction, entryPrice, stopLoss, pair: rawPair })
    : false;

  const beCandidate = extraction.breakEvenCandidate || {};
  const isCandidateBe = Boolean(beCandidate.isBreakEvenCandidate || isStopBe);

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
    breakEvenPrice: isCandidateBe ? (stopLoss || entryPrice) : null,
    breakEvenEvidenceSource: EVIDENCE_SOURCES.AI_VISION_SUGGESTION,
    breakEvenEvidenceStatus: EVIDENCE_STATUS.INFERRED,
    userConfirmedBe: false, // Requires user confirmation!
    userThresholdAmount,
  });

  return {
    extractionRaw: extraction,
    deterministicTrade: {
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
      breakEvenActivated: classification.breakEvenActivated,
      breakEvenPrice: classification.breakEvenPrice,
      breakEvenActivatedAt: null,
      breakEvenEvidenceSource: EVIDENCE_SOURCES.AI_VISION_SUGGESTION,
      breakEvenEvidenceStatus: EVIDENCE_STATUS.INFERRED,
      classificationSource: CLASSIFICATION_SOURCES.AI_SUGGESTION,
      badgeLabel: classification.badgeLabel,
      externalId: extraction.ticket?.value ? String(extraction.ticket.value).trim() : null,
      entryTime: extraction.entryTime?.value ? new Date(extraction.entryTime.value) : new Date(),
      exitTime: extraction.exitTime?.value ? new Date(extraction.exitTime.value) : null,
    },
    requiresUserConfirmation: true,
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
    },
    confidenceScore: extraction.confidenceScore || 0.5,
    rationale: beCandidate.rationale || 'Candidate trade extracted via Vision AI; review values before creating trade.',
  };
};

module.exports = {
  extractTradeFromScreenshot,
  ScreenshotTradeCaptureSchema,
  SYSTEM_PROMPT,
};
