import { getInstrumentSpec, SPECIFICATION_SOURCES } from '../config/instrumentSpecs.js';
import { validateCustomBrokerSpec } from '../config/brokerSpecs.js';
import { getExchangeRateDetails } from './currencyConversionService.js';
import { calculateRiskReward } from '../utils/tradeCalculations.js';

/**
 * Pure Mathematical Position Size & Risk Management Calculator Engine V3
 * Live Broker & Market-Aware Pre-Trade Risk Management System.
 *
 * Deterministic Engine: NO AI is used to calculate position sizes, pip values,
 * execution costs, or prop-firm drawdown limits.
 */

const toPreciseNumber = (val, decimals = 2) => {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return 0;
  return Number.parseFloat(Number(val).toFixed(decimals));
};

/**
 * Floor rounding to step precision (e.g., 0.01, 0.1, 0.001)
 * Guarantees lot size rounding NEVER increases risk above max intended risk.
 */
export const floorToStep = (value, step = 0.01) => {
  if (!value || value <= 0 || !step || step <= 0) return 0;
  const precision = Math.round(1 / step);
  const normalized = Math.round(value * 1e8) / 1e8;
  return Math.floor(normalized * precision) / precision;
};

/**
 * Primary Position Size & Risk Calculation Engine V3
 */
export const calculatePositionSize = ({
  balance = 10000,
  riskPercent = 1.0,
  riskAmountInput = null,
  entryPrice = 0,
  stopLoss = 0,
  takeProfit = 0,
  stopLossPipsInput = null,
  direction = 'BUY',
  pair = 'EURUSD',
  accountCurrency = 'USD',
  customSpec = null,
  manualConversionRate = null,
  // V3 Execution Cost Parameters
  spreadPips = 0,
  slippagePips = 0,
  commissionPerLot = 0,
  marketData = null,
  brokerProfile = null,
}) => {
  // 1. Determine Instrument Specification (Standard vs Custom vs Broker Profile)
  let spec = getInstrumentSpec(pair);
  let isCustomSpec = false;
  let customSpecValidation = { isValid: true, errors: [] };

  if (customSpec && Object.keys(customSpec).length > 0) {
    customSpecValidation = validateCustomBrokerSpec(customSpec);
    if (customSpecValidation.isValid) {
      isCustomSpec = true;
      spec = {
        ...spec,
        ...customSpec,
        specificationSource: SPECIFICATION_SOURCES.CUSTOM,
      };
    }
  }

  const numericBalance = Math.max(0, Number(balance) || 0);
  const numericRiskPercent = Math.max(0, Number(riskPercent) || 0);

  // 2. Target Capital at Risk Calculation
  let targetCapitalAtRisk = 0;
  if (riskAmountInput !== null && riskAmountInput !== undefined && riskAmountInput !== '') {
    targetCapitalAtRisk = Math.max(0, Number(riskAmountInput));
  } else {
    targetCapitalAtRisk = (numericBalance * numericRiskPercent) / 100;
  }

  const numEntry = Number(entryPrice) || 0;
  const numSL = Number(stopLoss) || 0;
  const numTP = Number(takeProfit) || 0;

  // 3. Price Distance & Stop Loss Pips Calculation
  let priceRiskDistance = 0;
  let stopLossPips = 0;
  let stopTicks = 0;
  let isInvalidSetup = false;
  let setupErrorMessage = null;

  if (stopLossPipsInput !== null && stopLossPipsInput !== undefined && Number(stopLossPipsInput) > 0) {
    stopLossPips = Number(stopLossPipsInput);
    priceRiskDistance = stopLossPips * spec.pipSize;
    stopTicks = priceRiskDistance / spec.tickSize;
  } else if (numEntry > 0 && numSL > 0) {
    if (direction === 'BUY') {
      priceRiskDistance = numEntry - numSL;
      if (priceRiskDistance <= 0) {
        isInvalidSetup = true;
        setupErrorMessage = 'For a BUY order, Stop Loss must be below Entry Price.';
      }
    } else {
      priceRiskDistance = numSL - numEntry;
      if (priceRiskDistance <= 0) {
        isInvalidSetup = true;
        setupErrorMessage = 'For a SELL order, Stop Loss must be above Entry Price.';
      }
    }
    if (priceRiskDistance > 0) {
      stopLossPips = priceRiskDistance / spec.pipSize;
      stopTicks = priceRiskDistance / spec.tickSize;
    }
  }

  // 4. Currency Conversion Details
  const rateDetails = getExchangeRateDetails({
    accountCurrency,
    quoteCurrency: spec.quoteCurrency,
    manualRate: manualConversionRate,
    entryPrice: numEntry,
    pairSymbol: spec.symbol,
  });

  // 5. Pip & Tick Values in Account Currency
  let calculationMethod = 'STANDARD_CONTRACT';
  let pipValuePerLotInQuote = (isCustomSpec && customSpec.contractSize && customSpec.pipSize)
    ? (Number(customSpec.contractSize) * Number(customSpec.pipSize))
    : (spec.pipValue || (spec.contractSize * spec.pipSize));
  let pipValuePerLotInAccount = pipValuePerLotInQuote * rateDetails.rate;

  let tickValuePerLotInQuote = (isCustomSpec && customSpec.tickValue)
    ? Number(customSpec.tickValue)
    : ((isCustomSpec && customSpec.contractSize && customSpec.tickSize)
      ? (Number(customSpec.contractSize) * Number(customSpec.tickSize))
      : (spec.tickValue || (spec.contractSize * spec.tickSize)));

  let tickValuePerLotInAccount = tickValuePerLotInQuote * rateDetails.rate;

  // 6. V3 Execution Costs per 1.00 Lot
  const numSpreadPips = Math.max(0, Number(spreadPips) || 0);
  const numSlippagePips = Math.max(0, Number(slippagePips) || 0);
  const numCommissionPerLot = Math.max(0, Number(commissionPerLot) || 0);

  // Total Execution Cost Per Lot (Stop Distance + Spread + Slippage + Commission)
  const totalPipsDistance = stopLossPips + numSpreadPips + numSlippagePips;
  const costPerLotInAccount = (totalPipsDistance * pipValuePerLotInAccount) + numCommissionPerLot;

  let rawLotSize = 0;

  if (spec.tickValue && spec.tickSize && stopTicks > 0 && tickValuePerLotInAccount > 0 && targetCapitalAtRisk > 0 && !isInvalidSetup) {
    calculationMethod = 'BROKER_TICK_VALUE';
    const totalTicksDistance = stopTicks + (numSpreadPips * (spec.pipSize / spec.tickSize)) + (numSlippagePips * (spec.pipSize / spec.tickSize));
    const tickCostPerLot = (totalTicksDistance * tickValuePerLotInAccount) + numCommissionPerLot;
    if (tickCostPerLot > 0) rawLotSize = targetCapitalAtRisk / tickCostPerLot;
  } else if (stopLossPips > 0 && costPerLotInAccount > 0 && targetCapitalAtRisk > 0 && !isInvalidSetup) {
    calculationMethod = 'STANDARD_CONTRACT';
    rawLotSize = targetCapitalAtRisk / costPerLotInAccount;
  }

  // 7. Dynamic Lot Step Floor Rounding & Min/Max Lot Enforcement
  const lotStep = spec.lotStep || 0.01;
  const minLot = spec.minLot || 0.01;
  const maxLot = spec.maxLot || 100.0;

  let safeLotSize = floorToStep(rawLotSize, lotStep);
  let isBelowMinLot = false;
  let minLotViolationMessage = null;
  let isCappedAtMaxLot = false;
  let maxLotNoticeMessage = null;

  if (rawLotSize > 0 && safeLotSize < minLot) {
    isBelowMinLot = true;
    minLotViolationMessage = `Calculated position size (${toPreciseNumber(rawLotSize, 4)} lots) is below your broker's minimum lot size (${minLot} lots).`;
    safeLotSize = 0; // Block execution safely
  } else if (safeLotSize > maxLot) {
    isCappedAtMaxLot = true;
    maxLotNoticeMessage = `Calculated position size (${safeLotSize} lots) exceeded your broker's maximum lot size (${maxLot} lots) and was capped.`;
    safeLotSize = maxLot;
  }

  // 8. Re-calculated Executable Risk Breakdown V3
  const actualPriceRisk = toPreciseNumber(stopLossPips * pipValuePerLotInAccount * safeLotSize, 2);
  const actualSpreadCost = toPreciseNumber(numSpreadPips * pipValuePerLotInAccount * safeLotSize, 2);
  const actualSlippageCost = toPreciseNumber(numSlippagePips * pipValuePerLotInAccount * safeLotSize, 2);
  const actualCommissionCost = toPreciseNumber(numCommissionPerLot * safeLotSize, 2);

  const estimatedTotalRisk = toPreciseNumber(actualPriceRisk + actualSpreadCost + actualSlippageCost + actualCommissionCost, 2);
  const unusedRiskBuffer = toPreciseNumber(targetCapitalAtRisk - estimatedTotalRisk, 2);
  const riskUtilizationPercent = targetCapitalAtRisk > 0 ? toPreciseNumber((estimatedTotalRisk / targetCapitalAtRisk) * 100, 1) : 0;

  // 9. Units & Fractional Lots
  const units = Math.round(safeLotSize * (spec.unitsPerLot || spec.contractSize));
  const miniLots = toPreciseNumber(safeLotSize * 10, 1);
  const microLots = toPreciseNumber(safeLotSize * 100, 0);

  // 10. Take Profit & Reward Calculation
  let takeProfitPips = 0;
  let potentialProfitAmount = 0;
  let isInvalidTP = false;

  if (numEntry > 0 && numTP > 0) {
    let tpPriceDistance = 0;
    if (direction === 'BUY') {
      tpPriceDistance = numTP - numEntry;
      if (tpPriceDistance <= 0) isInvalidTP = true;
    } else {
      tpPriceDistance = numEntry - numTP;
      if (tpPriceDistance <= 0) isInvalidTP = true;
    }
    if (tpPriceDistance > 0) {
      takeProfitPips = tpPriceDistance / spec.pipSize;
      potentialProfitAmount = toPreciseNumber(takeProfitPips * pipValuePerLotInAccount * safeLotSize, 2);
    }
  }

  // 11. Risk Reward Ratio
  const rrData = calculateRiskReward(direction, numEntry, numSL, numTP);
  const riskRewardRatio = rrData.riskRewardRatio;

  return {
    spec,
    isCustomSpec,
    customSpecValidation,
    balance: numericBalance,
    riskPercent: numericRiskPercent,
    targetCapitalAtRisk: toPreciseNumber(targetCapitalAtRisk, 2),

    // Executable Risk Breakdown V3
    actualPriceRisk,
    actualSpreadCost,
    actualSlippageCost,
    actualCommissionCost,
    estimatedTotalRisk,
    actualCapitalAtRisk: estimatedTotalRisk, // Backwards compatible alias
    unusedRiskBuffer,
    riskUtilizationPercent,

    stopLossPips: toPreciseNumber(stopLossPips, 1),
    stopTicks: toPreciseNumber(stopTicks, 1),
    takeProfitPips: toPreciseNumber(takeProfitPips, 1),
    spreadPips: numSpreadPips,
    slippagePips: numSlippagePips,
    commissionPerLot: numCommissionPerLot,

    pipValuePerLotInQuote: toPreciseNumber(pipValuePerLotInQuote, 4),
    pipValuePerLot: toPreciseNumber(pipValuePerLotInAccount, 4),
    tickValuePerLot: toPreciseNumber(tickValuePerLotInAccount, 4),
    rawLotSize: toPreciseNumber(rawLotSize, 4),
    safeLotSize: toPreciseNumber(safeLotSize, 2),
    lotStep,
    minLot,
    maxLot,
    isBelowMinLot,
    minLotViolationMessage,
    isCappedAtMaxLot,
    maxLotNoticeMessage,
    units,
    miniLots,
    microLots,
    potentialProfitAmount,
    riskRewardRatio,
    isInvalidSetup,
    setupErrorMessage,
    isInvalidTP,
    accountCurrency,
    rateDetails,
    calculationMethod,
    marketData,
    brokerProfile,
    calculatedAt: new Date().toISOString(),
  };
};

/**
 * Reverse Calculator: "What Stop Loss Can I Afford?"
 */
export const calculateReverseStopLoss = ({
  balance = 10000,
  riskPercent = 1.0,
  lotSize = 0.5,
  pair = 'EURUSD',
  entryPrice = 1.1000,
  direction = 'BUY',
  accountCurrency = 'USD',
  customSpec = null,
  manualConversionRate = null,
}) => {
  let spec = getInstrumentSpec(pair);
  if (customSpec && validateCustomBrokerSpec(customSpec).isValid) {
    spec = { ...spec, ...customSpec };
  }

  const capitalAtRisk = (balance * riskPercent) / 100;
  const rateDetails = getExchangeRateDetails({
    accountCurrency,
    quoteCurrency: spec.quoteCurrency,
    manualRate: manualConversionRate,
    entryPrice,
    pairSymbol: spec.symbol,
  });

  const pipValueInAccount = (spec.pipValue || (spec.contractSize * spec.pipSize)) * rateDetails.rate;

  if (lotSize <= 0 || pipValueInAccount <= 0) return { maxStopLossPips: 0, suggestedStopLossPrice: null };

  const maxStopLossPips = capitalAtRisk / (lotSize * pipValueInAccount);
  const pipsDistance = maxStopLossPips * spec.pipSize;

  let suggestedStopLossPrice = 0;
  if (direction === 'BUY') {
    suggestedStopLossPrice = entryPrice - pipsDistance;
  } else {
    suggestedStopLossPrice = entryPrice + pipsDistance;
  }

  return {
    maxStopLossPips: toPreciseNumber(maxStopLossPips, 1),
    suggestedStopLossPrice: toPreciseNumber(suggestedStopLossPrice, spec.pricePrecision || 5),
    capitalAtRisk: toPreciseNumber(capitalAtRisk, 2),
  };
};

/**
 * Reverse Calculator: "What Risk Am I Taking?"
 */
export const calculateReverseRisk = ({
  balance = 10000,
  lotSize = 0.5,
  entryPrice = 1.1000,
  stopLoss = 1.0980,
  direction = 'BUY',
  pair = 'EURUSD',
  accountCurrency = 'USD',
  customSpec = null,
  manualConversionRate = null,
}) => {
  let spec = getInstrumentSpec(pair);
  if (customSpec && validateCustomBrokerSpec(customSpec).isValid) {
    spec = { ...spec, ...customSpec };
  }

  const numEntry = Number(entryPrice) || 0;
  const numSL = Number(stopLoss) || 0;

  if (numEntry <= 0 || numSL <= 0 || lotSize <= 0) {
    return { riskAmount: 0, riskPercent: 0, stopLossPips: 0 };
  }

  let pipsDiff = 0;
  if (direction === 'BUY') {
    pipsDiff = (numEntry - numSL) / spec.pipSize;
  } else {
    pipsDiff = (numSL - numEntry) / spec.pipSize;
  }

  if (pipsDiff <= 0) return { riskAmount: 0, riskPercent: 0, stopLossPips: 0, isInvalid: true };

  const rateDetails = getExchangeRateDetails({
    accountCurrency,
    quoteCurrency: spec.quoteCurrency,
    manualRate: manualConversionRate,
    entryPrice: numEntry,
    pairSymbol: spec.symbol,
  });

  const pipValueInAccount = (spec.pipValue || (spec.contractSize * spec.pipSize)) * rateDetails.rate;
  const riskAmount = pipsDiff * pipValueInAccount * lotSize;
  const riskPercent = balance > 0 ? (riskAmount / balance) * 100 : 0;

  return {
    riskAmount: toPreciseNumber(riskAmount, 2),
    riskPercent: toPreciseNumber(riskPercent, 2),
    stopLossPips: toPreciseNumber(pipsDiff, 1),
    isInvalid: false,
  };
};

/**
 * Risk Scenario Simulator V3 Engine
 * Computes scenario matrix for multiple risk target percentages.
 */
export const generateRiskScenarios = (baseParams) => {
  const scenarioTargets = [0.25, 0.50, 1.00, 1.50, 2.00];

  return scenarioTargets.map((rp) => {
    const res = calculatePositionSize({
      ...baseParams,
      riskPercent: rp,
      riskAmountInput: null,
    });

    return {
      riskPercent: rp,
      targetCapitalAtRisk: res.targetCapitalAtRisk,
      safeLotSize: res.safeLotSize,
      estimatedTotalRisk: res.estimatedTotalRisk,
      unusedRiskBuffer: res.unusedRiskBuffer,
      riskUtilizationPercent: res.riskUtilizationPercent,
      isBelowMinLot: res.isBelowMinLot,
    };
  });
};

/**
 * Expanded 11-Point Broker-Aware & Market-Aware Safety Check V3
 */
export const evaluateTradeRiskCheck = ({
  calculationResult,
  userSettings = {},
  account = null,
  existingOpenTradeRisk = 0,
}) => {
  const warnings = [];
  const hardBlocks = [];
  const checklist = [];

  const {
    estimatedTotalRisk,
    riskPercent,
    stopLossPips,
    riskRewardRatio,
    isInvalidSetup,
    setupErrorMessage,
    safeLotSize,
    isBelowMinLot,
    minLotViolationMessage,
    isCappedAtMaxLot,
    maxLotNoticeMessage,
    rateDetails,
    spec,
    marketData,
    spreadPips,
    slippagePips,
    commissionPerLot,
  } = calculationResult;

  // 1. RISK CHECK
  const maxConfiguredRisk = userSettings?.maxRiskPerTrade || 2.0;
  if (riskPercent > 3.5) {
    warnings.push(`🚨 High Risk Alert: Planned risk is ${riskPercent}% of account balance.`);
    checklist.push({ category: '1. RISK CHECK', label: 'Risk % Threshold', status: 'WARN', detail: `${riskPercent}% (High Risk > 3.5%)` });
  } else if (riskPercent > maxConfiguredRisk) {
    warnings.push(`⚠️ Planned risk (${riskPercent}%) exceeds your max limit of ${maxConfiguredRisk}%.`);
    checklist.push({ category: '1. RISK CHECK', label: 'Risk % Threshold', status: 'WARN', detail: `${riskPercent}% > ${maxConfiguredRisk}%` });
  } else {
    checklist.push({ category: '1. RISK CHECK', label: 'Risk % Threshold', status: 'PASS', detail: `${riskPercent}% of account balance` });
  }

  // 2. STOP CHECK
  if (isInvalidSetup) {
    hardBlocks.push(setupErrorMessage || 'Invalid entry/stop loss price structure.');
    checklist.push({ category: '2. STOP CHECK', label: 'Setup Structure', status: 'FAIL', detail: setupErrorMessage });
  } else if (stopLossPips <= 0) {
    warnings.push('A stop loss is required to calculate safe position size.');
    checklist.push({ category: '2. STOP CHECK', label: 'Stop Loss Distance', status: 'WARN', detail: 'Missing Stop Loss' });
  } else {
    checklist.push({ category: '2. STOP CHECK', label: 'Stop Loss Distance', status: 'PASS', detail: `${stopLossPips} pips` });
  }

  // 3. BROKER CHECK
  if (isBelowMinLot) {
    hardBlocks.push(`🚨 BROKER MINIMUM VIOLATION: ${minLotViolationMessage}`);
    checklist.push({ category: '3. BROKER CHECK', label: 'Broker Lot Boundaries', status: 'FAIL', detail: `< ${spec.minLot} min lot` });
  } else if (isCappedAtMaxLot) {
    warnings.push(`⚠️ ${maxLotNoticeMessage}`);
    checklist.push({ category: '3. BROKER CHECK', label: 'Broker Lot Boundaries', status: 'WARN', detail: `Capped at ${spec.maxLot} max lot` });
  } else {
    checklist.push({ category: '3. BROKER CHECK', label: 'Broker Lot Boundaries', status: 'PASS', detail: `${safeLotSize} lots (step: ${spec.lotStep})` });
  }

  // 4. TRADE STRUCTURE CHECK
  if (!isInvalidSetup) {
    checklist.push({ category: '4. TRADE STRUCTURE', label: 'Price Order Structure', status: 'PASS', detail: 'Entry and SL prices valid.' });
  } else {
    checklist.push({ category: '4. TRADE STRUCTURE', label: 'Price Order Structure', status: 'FAIL', detail: 'Invalid Entry / Stop Loss' });
  }

  // 5. R:R CHECK
  const minRR = userSettings?.minimumRiskRewardRatio || 1.5;
  if (riskRewardRatio && riskRewardRatio < minRR) {
    warnings.push(`⚠️ Target R:R (1:${riskRewardRatio}) is below your minimum target of 1:${minRR}.`);
    checklist.push({ category: '5. R:R CHECK', label: 'Risk/Reward Target', status: 'WARN', detail: `1:${riskRewardRatio} < Min 1:${minRR}` });
  } else if (riskRewardRatio) {
    checklist.push({ category: '5. R:R CHECK', label: 'Risk/Reward Target', status: 'PASS', detail: `1:${riskRewardRatio}` });
  } else {
    checklist.push({ category: '5. R:R CHECK', label: 'Risk/Reward Target', status: 'PASS', detail: 'No Take Profit Set' });
  }

  // 6. PROP FIRM & COMBINED RISK CHECK
  let propFirmDetails = null;
  if (account && (account.propFirmAccount || userSettings?.dailyLossLimit)) {
    const dailyLimit = account.propFirmAccount?.dailyLossLimit || userSettings?.dailyLossLimit;
    if (dailyLimit && dailyLimit > 0) {
      const remainingDaily = dailyLimit - (account.todayLossAmount || 0);
      const combinedRisk = existingOpenTradeRisk + estimatedTotalRisk;
      const remainingAfterCombined = remainingDaily - combinedRisk;

      propFirmDetails = {
        dailyLimit,
        remainingDaily: Math.max(0, remainingDaily),
        existingOpenRisk: existingOpenTradeRisk,
        newTradeRisk: estimatedTotalRisk,
        combinedRisk,
        remainingAfterCombined,
      };

      if (combinedRisk > remainingDaily) {
        hardBlocks.push(`🚨 EXCEEDS COMBINED PROP-FIRM DAILY LIMIT: Existing risk ($${existingOpenTradeRisk}) + New trade risk ($${estimatedTotalRisk}) = $${combinedRisk}, exceeding remaining daily allowance of $${Math.max(0, remainingDaily).toFixed(2)}.`);
        checklist.push({ category: '6. PROP FIRM CHECK', label: 'Combined Daily Loss Limit', status: 'FAIL', detail: `$${combinedRisk} > Remaining $${Math.max(0, remainingDaily).toFixed(2)}` });
      } else if (remainingAfterCombined <= 20) {
        warnings.push(`⚠️ Combined trade risk leaves only $${remainingAfterCombined.toFixed(2)} remaining before prop-firm limit breach.`);
        checklist.push({ category: '6. PROP FIRM CHECK', label: 'Combined Daily Loss Limit', status: 'WARN', detail: `$${combinedRisk} (Leaves $${remainingAfterCombined.toFixed(2)})` });
      } else {
        checklist.push({ category: '6. PROP FIRM CHECK', label: 'Combined Daily Loss Limit', status: 'PASS', detail: `$${combinedRisk} within remaining $${remainingDaily.toFixed(2)}` });
      }
    } else {
      checklist.push({ category: '6. PROP FIRM CHECK', label: 'Prop Firm Rules', status: 'PASS', detail: 'No Active Limits' });
    }
  } else {
    checklist.push({ category: '6. PROP FIRM CHECK', label: 'Prop Firm Rules', status: 'PASS', detail: 'Standard Account' });
  }

  // 7. CURRENCY CHECK
  if (rateDetails && !rateDetails.isAvailable) {
    warnings.push(`⚠️ Currency conversion rate unavailable for ${spec.quoteCurrency} to ${calculationResult.accountCurrency}. Enter a manual rate.`);
    checklist.push({ category: '7. CURRENCY CHECK', label: 'Currency Rate Source', status: 'WARN', detail: 'Rate Unavailable / Manual Rate Required' });
  } else if (rateDetails && rateDetails.source === 'MANUAL') {
    warnings.push(`⚠️ Using manually supplied currency conversion rate (${rateDetails.rate}).`);
    checklist.push({ category: '7. CURRENCY CHECK', label: 'Currency Rate Source', status: 'PASS', detail: `Manual (${rateDetails.rate})` });
  } else {
    checklist.push({ category: '7. CURRENCY CHECK', label: 'Currency Rate Source', status: 'PASS', detail: `${rateDetails?.source || 'Direct Match'}` });
  }

  // 8. MARKET DATA CHECK
  if (marketData && marketData.source === 'LIVE') {
    checklist.push({ category: '8. MARKET DATA CHECK', label: 'Price Feed Status', status: 'PASS', detail: '🟢 LIVE Market Feed' });
  } else if (marketData && marketData.source === 'CACHED') {
    warnings.push('⚠️ Market price data is cached. Verify current live price with your broker.');
    checklist.push({ category: '8. MARKET DATA CHECK', label: 'Price Feed Status', status: 'WARN', detail: '🟡 CACHED Feed' });
  } else {
    checklist.push({ category: '8. MARKET DATA CHECK', label: 'Price Feed Status', status: 'PASS', detail: '🔵 MANUAL Entry' });
  }

  // 9. SPREAD CHECK
  if (spreadPips > 0) {
    checklist.push({ category: '9. SPREAD CHECK', label: 'Spread Cost Included', status: 'PASS', detail: `${spreadPips} pips ($${calculationResult.actualSpreadCost})` });
  } else {
    checklist.push({ category: '9. SPREAD CHECK', label: 'Spread Cost Included', status: 'PASS', detail: '0.0 pips (Zero Spread)' });
  }

  // 10. SLIPPAGE CHECK
  if (slippagePips > 0) {
    checklist.push({ category: '10. SLIPPAGE CHECK', label: 'Slippage Buffer Included', status: 'PASS', detail: `${slippagePips} pips ($${calculationResult.actualSlippageCost})` });
  } else {
    checklist.push({ category: '10. SLIPPAGE CHECK', label: 'Slippage Buffer Included', status: 'PASS', detail: '0.0 pips (Zero Buffer)' });
  }

  // 11. COMMISSION CHECK
  if (commissionPerLot > 0) {
    checklist.push({ category: '11. COMMISSION CHECK', label: 'Broker Commission Included', status: 'PASS', detail: `$${commissionPerLot}/lot ($${calculationResult.actualCommissionCost})` });
  } else {
    checklist.push({ category: '11. COMMISSION CHECK', label: 'Broker Commission Included', status: 'PASS', detail: '$0.00 / lot' });
  }

  const isPassed = hardBlocks.length === 0;
  const status = !isPassed ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

  return {
    isPassed,
    status,
    checklist,
    warnings,
    hardBlocks,
    propFirmDetails,
    summaryMessage: isPassed
      ? (warnings.length > 0 ? '⚠️ TRADE ALLOWED WITH WARNINGS — Review discipline notes before placing order.' : '✅ TRADE WITHIN YOUR RULES — Clear for execution.')
      : '🚨 TRADE BLOCKED — Does not meet your risk and broker safety rules.',
  };
};
