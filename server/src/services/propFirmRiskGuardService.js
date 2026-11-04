const propFirmRuleEngine = require('./propFirmRuleEngine');
const prisma = propFirmRuleEngine.prisma || new (require('@prisma/client').PrismaClient)();

/**
 * Standard pip sizes for basic monetary risk approximation when not provided directly
 */
function getPipSize(pair = '') {
  const upper = String(pair).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.includes('JPY')) return 0.01;
  if (upper.includes('XAU') || upper.includes('GOLD')) return 0.1;
  if (upper.includes('US30') || upper.includes('NAS') || upper.includes('SPX')) return 1.0;
  if (upper.includes('BTC') || upper.includes('ETH')) return 1.0;
  return 0.0001;
}

/**
 * Approximate standard pip value per 1.0 standard lot in USD
 */
function getApproxPipValuePerLot(pair = '') {
  const upper = String(pair).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.includes('XAU') || upper.includes('GOLD')) return 10.0;
  if (upper.includes('US30') || upper.includes('NAS')) return 1.0;
  if (upper.includes('BTC')) return 1.0;
  return 10.0; // Standard 100k fx lot = $10/pip on USD quote pairs
}

/**
 * Evaluates a proposed trade against the authoritative prop firm compliance engine
 *
 * @param {Object} params
 * @param {string} params.tradingAccountId - UUID of trading account
 * @param {string} params.userId - Authenticated user UUID
 * @param {number} [params.lotSize] - Proposed lot size
 * @param {number} [params.entryPrice] - Proposed entry price
 * @param {number} [params.stopLoss] - Proposed stop loss price
 * @param {string} [params.pair] - Currency or instrument symbol
 * @param {string} [params.direction] - 'BUY' or 'SELL'
 * @param {number} [params.estimatedRiskAmount] - Pre-calculated monetary risk amount
 * @returns {Promise<Object>} Risk guard evaluation report
 */
async function evaluateProposedTrade({
  tradingAccountId,
  userId,
  lotSize = 0,
  entryPrice = 0,
  stopLoss = 0,
  pair = '',
  direction = 'BUY',
  estimatedRiskAmount = null,
}) {
  const compliance = await propFirmRuleEngine.getPropFirmComplianceReport(tradingAccountId, userId);
  if (!compliance) {
    return {
      isPropFirmAccount: false,
      message: 'Not a prop-firm account or account not found',
    };
  }

  // Fetch full propFirm details for advanced restriction rules
  const propFirmRecord = await prisma.propFirmAccount.findUnique({
    where: { tradingAccountId },
  });

  const numericLot = Number(lotSize) || 0;
  const numEntry = Number(entryPrice) || 0;
  const numSL = Number(stopLoss) || 0;
  let tradeRisk = Number(estimatedRiskAmount) || 0;

  // Approximate monetary risk if not explicitly provided
  if (tradeRisk <= 0 && numericLot > 0 && numEntry > 0 && numSL > 0) {
    const pipSize = getPipSize(pair);
    const pipValuePerLot = getApproxPipValuePerLot(pair);
    const priceDiff = Math.abs(numEntry - numSL);
    const pipsAtRisk = priceDiff / pipSize;
    tradeRisk = Number((pipsAtRisk * pipValuePerLot * numericLot).toFixed(2));
  }

  const warnings = [];
  const hardBlocks = [];

  const dailyRemaining = compliance.dailyLoss.enabled
    ? Math.max(0, compliance.dailyLoss.remainingAllowanceAmount)
    : Infinity;
  const drawdownRemaining = Math.max(0, compliance.overallDrawdown.remainingAllowanceAmount);

  // 1. Prohibited / Restricted Symbols
  if (propFirmRecord?.restrictedSymbols?.length && pair) {
    const cleanPair = pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const isRestricted = propFirmRecord.restrictedSymbols.some((sym) =>
      cleanPair.includes(sym.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    );
    if (isRestricted) {
      hardBlocks.push(`Restricted Symbol: Trading on ${pair} is prohibited by your prop firm rules.`);
    }
  }

  // 2. Max Lot Size Rule
  if (propFirmRecord?.maxLotSize && numericLot > propFirmRecord.maxLotSize) {
    hardBlocks.push(
      `Max Lot Exceeded: Proposed lot size (${numericLot}) exceeds firm maximum limit of ${propFirmRecord.maxLotSize} lots.`
    );
  }

  // 3. Max Risk Per Trade Percent Rule
  if (propFirmRecord?.maxRiskPerTradePercent && compliance.currentBalance > 0 && tradeRisk > 0) {
    const riskPercent = (tradeRisk / compliance.currentBalance) * 100;
    if (riskPercent > propFirmRecord.maxRiskPerTradePercent) {
      warnings.push(
        `Risk Rule Alert: Planned risk of ${riskPercent.toFixed(2)}% exceeds firm guideline limit of ${propFirmRecord.maxRiskPerTradePercent}%.`
      );
    }
  }

  // 4. Daily Loss & Overall Drawdown Buffer Impacts
  const dailyBufferAfterTrade = compliance.dailyLoss.enabled
    ? Number((dailyRemaining - tradeRisk).toFixed(2))
    : dailyRemaining;
  const drawdownBufferAfterTrade = Number((drawdownRemaining - tradeRisk).toFixed(2));

  let status = 'SAFE';
  let canExecuteSafely = true;

  if (tradeRisk > dailyRemaining && compliance.dailyLoss.enabled) {
    status = 'POTENTIAL_BREACH';
    canExecuteSafely = false;
    hardBlocks.push(
      `Daily Loss Breach Risk: Proposed trade risk ($${tradeRisk.toFixed(2)}) exceeds remaining daily allowance ($${dailyRemaining.toFixed(2)}). An adverse exit will breach your daily loss limit.`
    );
  } else if (tradeRisk > drawdownRemaining) {
    status = 'POTENTIAL_BREACH';
    canExecuteSafely = false;
    hardBlocks.push(
      `Overall Drawdown Breach Risk: Proposed trade risk ($${tradeRisk.toFixed(2)}) exceeds remaining distance to liquidation floor ($${drawdownRemaining.toFixed(2)}). An adverse exit will breach your account.`
    );
  } else if (
    (compliance.dailyLoss.enabled && dailyBufferAfterTrade <= compliance.dailyLoss.limitAmount * 0.15) ||
    drawdownBufferAfterTrade <= compliance.overallDrawdown.drawdownLimitAmount * 0.15
  ) {
    status = 'CRITICAL';
    warnings.push(
      `Critical Margin: Proposed trade leaves very thin protection ($${dailyBufferAfterTrade.toFixed(2)} daily / $${drawdownBufferAfterTrade.toFixed(2)} overall) before breach threshold.`
    );
  } else if (
    compliance.dailyLoss.enabled &&
    dailyBufferAfterTrade <= compliance.dailyLoss.limitAmount * 0.35
  ) {
    status = 'CAUTION';
    warnings.push(
      `Caution: Proposed trade consumes more than 65% of your available daily risk budget.`
    );
  }

  // Calculate maximum safe lot size that would fit the tighter of the allowances
  let maxSafeLotSize = null;
  if (numEntry > 0 && numSL > 0) {
    const pipSize = getPipSize(pair);
    const pipValuePerLot = getApproxPipValuePerLot(pair);
    const pipsAtRisk = Math.abs(numEntry - numSL) / pipSize;
    if (pipsAtRisk > 0 && pipValuePerLot > 0) {
      const bindingAllowance = Math.min(dailyRemaining, drawdownRemaining);
      const computedLot = bindingAllowance / (pipsAtRisk * pipValuePerLot);
      maxSafeLotSize = Math.max(0, Number(computedLot.toFixed(2)));
    }
  }

  let explanation = '';
  if (status === 'SAFE') {
    explanation = `Trade risk of $${tradeRisk.toFixed(2)} is well within your daily buffer ($${dailyRemaining.toFixed(2)}) and drawdown allowance ($${drawdownRemaining.toFixed(2)}).`;
  } else if (status === 'POTENTIAL_BREACH') {
    explanation = `Trade risk of $${tradeRisk.toFixed(2)} will breach your account buffer if stop loss is hit! Maximum safe lot size is ${maxSafeLotSize ?? 0}.`;
  } else {
    explanation = `Trade risk of $${tradeRisk.toFixed(2)} is allowable but leaves tight margin ($${dailyBufferAfterTrade.toFixed(2)} daily remaining).`;
  }

  return {
    isPropFirmAccount: true,
    tradingAccountId,
    accountName: compliance.accountName,
    status,
    canExecuteSafely: canExecuteSafely && hardBlocks.length === 0,
    estimatedTradeRisk: tradeRisk,
    dailyLoss: {
      enabled: compliance.dailyLoss.enabled,
      limitAmount: compliance.dailyLoss.limitAmount,
      currentRemaining: dailyRemaining,
      remainingAfterTrade: dailyBufferAfterTrade,
    },
    overallDrawdown: {
      drawdownType: compliance.overallDrawdown.drawdownType,
      liquidationFloor: compliance.overallDrawdown.liquidationFloor,
      highWaterMark: compliance.overallDrawdown.highWaterMark,
      currentRemaining: drawdownRemaining,
      remainingAfterTrade: drawdownBufferAfterTrade,
    },
    maxSafeLotSize,
    warnings,
    hardBlocks,
    explanation,
    disclaimer:
      'Advisory Risk Guard — JahzJournals calculates compliance based on journaled trades and broker sync. JahzJournals does not physically restrict broker order placement.',
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  evaluateProposedTrade,
  getPipSize,
  getApproxPipValuePerLot,
};
