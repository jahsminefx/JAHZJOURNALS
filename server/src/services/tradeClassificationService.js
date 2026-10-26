const { calculatePips } = require('../utils/pipCalculator');

/**
 * Valid trade outcome constants
 */
const OUTCOMES = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  BREAKEVEN: 'BREAKEVEN',
  OPEN: 'OPEN',
};

/**
 * Valid BE management evidence statuses
 */
const EVIDENCE_STATUS = {
  CONFIRMED: 'CONFIRMED',
  USER_CONFIRMED: 'USER_CONFIRMED',
  INFERRED: 'INFERRED',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Sources for BE management evidence
 */
const EVIDENCE_SOURCES = {
  MT_TRAILING_STOP: 'MT_TRAILING_STOP',
  MT_SL_TO_ENTRY: 'MT_SL_TO_ENTRY',
  USER_MANUAL: 'USER_MANUAL',
  AI_VISION_SUGGESTION: 'AI_VISION_SUGGESTION',
  CSV_IMPORT: 'CSV_IMPORT',
  PRICE_ACTION_INFERRED: 'PRICE_ACTION_INFERRED',
};

/**
 * Provenance / classification source
 */
const CLASSIFICATION_SOURCES = {
  DETERMINISTIC_CALCULATION: 'DETERMINISTIC_CALCULATION',
  USER_OVERRIDE: 'USER_OVERRIDE',
  BROKER_IMPORT: 'BROKER_IMPORT',
  AI_SUGGESTION: 'AI_SUGGESTION',
};

const hasVal = (v) => v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v));
const parseNum = (v) => (hasVal(v) ? Number.parseFloat(v) : null);

/**
 * Rounds a financial number to 2 decimal places in a decimal-safe manner.
 */
const roundFinancial = (val) => {
  if (val === null || val === undefined) return 0;
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
};

/**
 * Resolves instrument-specific price buffer (e.g. 1-2 pips equivalent in quote currency).
 * Used when assessing if stop-loss was placed at/near entry price.
 */
const getInstrumentPriceTolerance = (pair, entryPrice = 0) => {
  const p = String(pair || '').toUpperCase().trim();
  if (!p) return 0.0002;

  if (p.includes('JPY')) return 0.02; // 2 pips in JPY
  if (p.startsWith('XAU') || p.includes('GOLD')) return 0.20; // 20 cents in Gold
  if (p.startsWith('XAG') || p.includes('SILVER')) return 0.05;

  if (
    p.includes('BTC') ||
    p.includes('ETH') ||
    p.includes('US30') ||
    p.includes('NAS100') ||
    p.includes('SPX') ||
    p.includes('GER30') ||
    p.includes('DE30') ||
    p.includes('UK100') ||
    p.includes('US500')
  ) {
    // For crypto and indices, an entry-relative 0.05% or 2 index points
    const priceBased = entryPrice > 0 ? entryPrice * 0.0005 : 2.0;
    return Math.max(1.0, Math.min(15.0, priceBased));
  }

  // Standard 5-digit Forex (EURUSD, GBPUSD, etc.)
  return 0.0002; // 2 pips
};

/**
 * Determines whether a stop loss location indicates Break-Even management.
 * For BUY: stopLoss is at or above entry price (in profit or exact entry).
 * For SELL: stopLoss is at or below entry price (in profit or exact entry).
 * A stop-loss on the loss side of entry is strictly NOT break-even protected.
 */
const isStopAtOrPastEntry = ({
  direction,
  entryPrice,
  stopLoss,
  pair,
  exitPrice = null,
  profitLossAmount = null,
  grossProfit = null,
  status = null,
}) => {
  const dir = String(direction || '').toUpperCase().trim();
  const entry = parseNum(entryPrice);
  const sl = parseNum(stopLoss);
  const exit = parseNum(exitPrice);
  const netPnl = parseNum(profitLossAmount) ?? parseNum(grossProfit);

  if (entry === null || sl === null || !dir) return false;

  // Numerical precision epsilon for floating point representation
  const epsilon = 1e-6;
  const tol = getInstrumentPriceTolerance(pair, entry);
  const isClosed = String(status || '').toUpperCase() === 'CLOSED' || exit !== null;

  // Direction & Loss Consistency:
  // If a closed trade exited on the loss side of entry and suffered a realized financial loss,
  // it was NOT protected at break-even (any stop loss on the profit side is an OCR/input anomaly).
  if (isClosed) {
    if (dir === 'BUY') {
      if (exit !== null && exit < (entry - tol) && netPnl !== null && netPnl < 0) {
        return false;
      }
      if (netPnl !== null && netPnl < -Math.max(3.0, tol * 10)) {
        return false;
      }
      return sl >= (entry - epsilon);
    }
    if (dir === 'SELL') {
      if (exit !== null && exit > (entry + tol) && netPnl !== null && netPnl < 0) {
        return false;
      }
      if (netPnl !== null && netPnl < -Math.max(3.0, tol * 10)) {
        return false;
      }
      return sl <= (entry + epsilon);
    }
  }

  if (dir === 'BUY') {
    // Stop loss must be at or above entry price (in profit or exact entry)
    return sl >= (entry - epsilon);
  }
  if (dir === 'SELL') {
    // Stop loss must be at or below entry price (in profit or exact entry)
    return sl <= (entry + epsilon);
  }

  return false;
};

/**
 * Inspects SL/TP history records to determine if a stop was trailed to break-even or moved to entry.
 */
const checkSlHistoryForBe = (slTpHistory, entryPrice, direction, pair) => {
  if (!Array.isArray(slTpHistory) || slTpHistory.length === 0) return null;

  for (const event of slTpHistory) {
    if (!event) continue;
    const note = String(event.note || event.changeNote || '').toLowerCase();
    if (note.includes('break even') || note.includes('breakeven') || note.includes('trailed stop')) {
      return {
        confirmed: true,
        source: EVIDENCE_SOURCES.MT_TRAILING_STOP,
        status: EVIDENCE_STATUS.CONFIRMED,
        price: parseNum(event.stopLoss),
        timestamp: event.timestamp ? new Date(event.timestamp) : null,
      };
    }

    if (hasVal(event.stopLoss) && entryPrice) {
      if (isStopAtOrPastEntry({ direction, entryPrice, stopLoss: event.stopLoss, pair })) {
        return {
          confirmed: true,
          source: EVIDENCE_SOURCES.MT_SL_TO_ENTRY,
          status: EVIDENCE_STATUS.CONFIRMED,
          price: parseNum(event.stopLoss),
          timestamp: event.timestamp ? new Date(event.timestamp) : null,
        };
      }
    }
  }

  return null;
};

/**
 * Authoritative Canonical Trade Classification Service
 *
 * Deterministically classifies:
 * 1. Financial outcome: WIN, LOSS, BREAKEVEN, OPEN
 * 2. Break-even management: breakEvenActivated, breakEvenPrice, evidenceSource, evidenceStatus
 * 3. Provenance & User Overrides
 * 4. Human-readable badge text (e.g., 'Small win · BE protected', 'Break-Even', etc.)
 *
 * @param {Object} input
 * @returns {Object}
 */
const classifyTrade = (input = {}) => {
  const {
    status = 'CLOSED',
    direction = null,
    pair = null,
    entryPrice = null,
    exitPrice = null,
    stopLoss = null,
    initialStopLoss = null,
    lotSize = null,
    grossProfit = null,
    commission = null,
    swap = null,
    fees = null,
    profitLossAmount = null,
    initialRisk = null,
    slTpHistory = null,
    breakEvenActivated = null,
    breakEvenPrice = null,
    breakEvenEvidenceSource = null,
    breakEvenEvidenceStatus = null,
    userConfirmedBe = null,
    manualResultOverride = null,
    userThresholdAmount = null,
  } = input;

  const finalStatus = String(status || '').toUpperCase();
  const dir = direction ? String(direction).toUpperCase().trim() : null;
  const p = pair ? String(pair).toUpperCase().trim() : null;
  const entry = parseNum(entryPrice);
  const exit = parseNum(exitPrice);
  const sl = parseNum(stopLoss);
  const initialSl = parseNum(initialStopLoss);
  const lots = parseNum(lotSize);

  // 1. OPEN / NON-CLOSED TRADES
  const isOpenBeProtected = Boolean(
    breakEvenActivated ||
    userConfirmedBe ||
    (sl !== null && entry !== null && dir && isStopAtOrPastEntry({ direction: dir, entryPrice: entry, stopLoss: sl, pair: p }))
  );

  if (finalStatus === 'PLANNED' || finalStatus === 'ACTIVE' || finalStatus === 'CANCELLED') {
    return {
      result: OUTCOMES.OPEN,
      netProfit: null,
      grossProfit: parseNum(grossProfit),
      commission: parseNum(commission),
      swap: parseNum(swap),
      fees: parseNum(fees),
      breakEvenActivated: isOpenBeProtected,
      breakEvenPrice: parseNum(breakEvenPrice) || (isOpenBeProtected ? sl : null),
      breakEvenActivatedAt: null,
      breakEvenEvidenceSource: breakEvenEvidenceSource || (userConfirmedBe ? EVIDENCE_SOURCES.USER_MANUAL : (isOpenBeProtected ? EVIDENCE_SOURCES.MT_TRAILING_STOP : null)),
      breakEvenEvidenceStatus: breakEvenEvidenceStatus || (userConfirmedBe ? EVIDENCE_STATUS.USER_CONFIRMED : (isOpenBeProtected ? EVIDENCE_STATUS.INFERRED : EVIDENCE_STATUS.UNKNOWN)),
      isManualResultOverride: false,
      classificationSource: CLASSIFICATION_SOURCES.DETERMINISTIC_CALCULATION,
      resultCalculatedAt: new Date(),
      badgeLabel: finalStatus === 'CANCELLED' ? 'Cancelled' : finalStatus === 'PLANNED' ? 'Planned' : 'Active',
      isBeProtected: isOpenBeProtected,
    };
  }

  // 2. NET PROFIT CALCULATION
  // Determine net realized result: profitLossAmount takes precedence if already net,
  // or aggregate grossProfit + commission + swap + fees.
  let calculatedNetProfit = null;
  const parsedGross = parseNum(grossProfit);
  const parsedComm = parseNum(commission) || 0;
  const parsedSwap = parseNum(swap) || 0;
  const parsedFees = parseNum(fees) || 0;

  if (hasVal(profitLossAmount)) {
    calculatedNetProfit = roundFinancial(profitLossAmount);
  } else if (hasVal(grossProfit)) {
    calculatedNetProfit = roundFinancial(parsedGross + parsedComm + parsedSwap + parsedFees);
  }

  // 3. FINANCIAL TOLERANCE EVALUATION
  // Determine effective dollar tolerance threshold for Break-Even classification.
  // By default, financial tolerance is strictly 0.00 across all workflows.
  // Any non-zero financial tolerance REQUIRES explicit user configuration via userThresholdAmount.
  // initialRisk does NOT automatically scale financial tolerance.
  const userThreshold = parseNum(userThresholdAmount);
  let effectiveTolerance = 0.00;

  if (userThreshold !== null && userThreshold >= 0) {
    effectiveTolerance = userThreshold;
  }

  // 4. BREAK-EVEN MANAGEMENT EVALUATION
  let beActivated = Boolean(breakEvenActivated || userConfirmedBe);
  let bePrice = parseNum(breakEvenPrice);
  let beSource = breakEvenEvidenceSource || null;
  let beStatus = breakEvenEvidenceStatus || (userConfirmedBe ? EVIDENCE_STATUS.USER_CONFIRMED : EVIDENCE_STATUS.UNKNOWN);
  let beActivatedAt = null;

  // Check explicit user confirmation
  if (userConfirmedBe === true) {
    beActivated = true;
    beStatus = EVIDENCE_STATUS.USER_CONFIRMED;
    beSource = beSource || EVIDENCE_SOURCES.USER_MANUAL;
    if (bePrice === null && sl !== null) bePrice = sl;
    if (bePrice === null && entry !== null) bePrice = entry;
  }

  // Check if this closed trade is an undeniable loss on the loss side of entry.
  // For a closed loss trade, automatic BE cannot be inferred from a contradictory stopLoss price.
  const isUndeniableLoss = finalStatus === 'CLOSED' && (
    (calculatedNetProfit !== null && calculatedNetProfit < -Math.max(3.00, (effectiveTolerance || 1.00) * 2.5)) ||
    (dir === 'BUY' && exit !== null && entry !== null && exit < (entry - getInstrumentPriceTolerance(p, entry)) && (calculatedNetProfit !== null ? calculatedNetProfit < 0 : true)) ||
    (dir === 'SELL' && exit !== null && entry !== null && exit > (entry + getInstrumentPriceTolerance(p, entry)) && (calculatedNetProfit !== null ? calculatedNetProfit < 0 : true))
  );

  // Check SL/TP modification history
  if (!beActivated && !isUndeniableLoss && Array.isArray(slTpHistory) && slTpHistory.length > 0) {
    const historyEvidence = checkSlHistoryForBe(slTpHistory, entry, dir, p);
    if (historyEvidence) {
      beActivated = true;
      beStatus = historyEvidence.status;
      beSource = historyEvidence.source;
      bePrice = historyEvidence.price || bePrice;
      beActivatedAt = historyEvidence.timestamp;
    }
  }

  // Check final stop loss placement relative to entry
  if (!beActivated && !isUndeniableLoss && sl !== null && entry !== null && dir) {
    if (isStopAtOrPastEntry({
      direction: dir,
      entryPrice: entry,
      stopLoss: sl,
      pair: p,
      exitPrice: exit,
      profitLossAmount: calculatedNetProfit,
      grossProfit: parsedGross,
      status: finalStatus,
    })) {
      beActivated = true;
      beStatus = EVIDENCE_STATUS.INFERRED;
      beSource = EVIDENCE_SOURCES.MT_TRAILING_STOP;
      bePrice = sl;
    }
  }

  // If a closed trade suffered a genuine loss and user did NOT explicitly confirm BE,
  // ensure automatic/inferred breakEvenActivated is never left active.
  if (isUndeniableLoss && userConfirmedBe !== true) {
    beActivated = false;
    beStatus = EVIDENCE_STATUS.UNKNOWN;
    beSource = null;
    bePrice = null;
  }

  // 5. CLASSIFY FINANCIAL OUTCOME
  // Financial outcome reflects realized financial performance against tolerance.
  // Break-even management (trailing stop / moved to BE) is completely independent.
  let finalOutcome = OUTCOMES.BREAKEVEN;
  let isOverride = false;
  let provenance = CLASSIFICATION_SOURCES.DETERMINISTIC_CALCULATION;

  // Check user manual override
  const normalizedOverride = manualResultOverride ? String(manualResultOverride).toUpperCase().trim() : null;
  if (normalizedOverride && [OUTCOMES.WIN, OUTCOMES.LOSS, OUTCOMES.BREAKEVEN].includes(normalizedOverride)) {
    finalOutcome = normalizedOverride;
    isOverride = true;
    provenance = CLASSIFICATION_SOURCES.USER_OVERRIDE;
  } else if (calculatedNetProfit !== null) {
    // Deterministic tolerance comparison:
    // If effectiveTolerance is 0.00:
    // - Positive net profit (> 0.00) is WIN
    // - Negative net profit (< -0.00) is LOSS
    // - Exactly 0.00 is BREAKEVEN
    // If a user specified a custom threshold (e.g. $2.50), trades within [-threshold, +threshold] are BREAKEVEN.
    if (calculatedNetProfit > effectiveTolerance) {
      finalOutcome = OUTCOMES.WIN;
    } else if (calculatedNetProfit < -effectiveTolerance) {
      finalOutcome = OUTCOMES.LOSS;
    } else {
      finalOutcome = OUTCOMES.BREAKEVEN;
    }
  } else {
    // Insufficient financial data
    finalOutcome = OUTCOMES.BREAKEVEN;
  }

  // 6. SMART BADGE LABEL
  // Accurately reflects both Financial Outcome AND Trade Management
  let badgeLabel = 'Break-Even';
  if (finalOutcome === OUTCOMES.BREAKEVEN) {
    badgeLabel = beActivated ? 'Break-Even (BE protected)' : 'Break-Even';
  } else if (finalOutcome === OUTCOMES.WIN) {
    const isSmallWin = calculatedNetProfit !== null && calculatedNetProfit <= Math.max(5.00, (effectiveTolerance || 1.00) * 2.5);
    badgeLabel = (beActivated && isSmallWin) ? 'Small win · BE protected' : (beActivated ? 'Win · BE protected' : 'Win');
  } else if (finalOutcome === OUTCOMES.LOSS) {
    const isSmallLoss = calculatedNetProfit !== null && Math.abs(calculatedNetProfit) <= Math.max(5.00, (effectiveTolerance || 1.00) * 2.5);
    badgeLabel = (beActivated && isSmallLoss) ? 'Small loss · BE protected' : 'Loss';
  }

  return {
    result: finalOutcome,
    netProfit: calculatedNetProfit,
    grossProfit: parsedGross,
    commission: parseNum(commission),
    swap: parseNum(swap),
    fees: parseNum(fees),
    breakEvenActivated: beActivated,
    breakEvenPrice: bePrice,
    breakEvenActivatedAt: beActivatedAt,
    breakEvenEvidenceSource: beSource,
    breakEvenEvidenceStatus: beStatus,
    isManualResultOverride: isOverride,
    classificationSource: provenance,
    resultCalculatedAt: new Date(),
    badgeLabel,
    isBeProtected: beActivated,
    effectiveTolerance,
  };
};

module.exports = {
  OUTCOMES,
  EVIDENCE_STATUS,
  EVIDENCE_SOURCES,
  CLASSIFICATION_SOURCES,
  classifyTrade,
  isStopAtOrPastEntry,
  getInstrumentPriceTolerance,
};
