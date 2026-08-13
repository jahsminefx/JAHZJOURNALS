import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculatePositionSize, 
  calculateReverseStopLoss, 
  calculateReverseRisk, 
  generateRiskScenarios,
  evaluateTradeRiskCheck,
  floorToStep
} from '../src/services/riskCalculatorService.js';
import { getInstrumentSpec, SPECIFICATION_SOURCES } from '../src/config/instrumentSpecs.js';
import { validateCustomBrokerSpec } from '../src/config/brokerSpecs.js';
import { getExchangeRateDetails, convertCurrency } from '../src/services/currencyConversionService.js';
import { getMarketData, resolveExecutionPrice, MARKET_DATA_STATUS } from '../src/services/marketDataService.js';
import { getSavedBrokerProfiles, saveBrokerProfile, deleteBrokerProfile, DEFAULT_BROKER_PROFILE } from '../src/services/brokerProfileService.js';

// ==========================================
// 1. STANDARD INSTRUMENT TESTS (1 - 6)
// ==========================================

test('1. Standard EURUSD calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.targetCapitalAtRisk, 100);
  assert.equal(res.stopLossPips, 20);
  assert.equal(res.safeLotSize, 0.50);
  assert.equal(res.estimatedTotalRisk, 100);
});

test('2. Standard USDJPY calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 150.00, stopLoss: 149.50, direction: 'BUY', pair: 'USDJPY' });
  assert.equal(res.stopLossPips, 50);
  assert.equal(res.safeLotSize, 0.30);
  assert.equal(res.estimatedTotalRisk, 100);
});

test('3. Standard GBPJPY cross pair calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 195.00, stopLoss: 194.00, direction: 'BUY', pair: 'GBPJPY', manualConversionRate: 150.00 });
  assert.equal(res.stopLossPips, 100);
  assert.equal(res.safeLotSize, 0.15);
});

test('4. Standard XAUUSD (Gold) calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 2400.00, stopLoss: 2390.00, direction: 'BUY', pair: 'XAUUSD' });
  assert.equal(res.stopLossPips, 100);
  assert.equal(res.safeLotSize, 0.10);
  assert.equal(res.units, 10);
});

test('5. Standard NAS100 index calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 19500, stopLoss: 19450, direction: 'BUY', pair: 'NAS100' });
  assert.equal(res.stopLossPips, 50);
  assert.equal(res.safeLotSize, 2.0);
});

test('6. Standard US30 index calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 39000, stopLoss: 38900, direction: 'BUY', pair: 'US30' });
  assert.equal(res.stopLossPips, 100);
  assert.equal(res.safeLotSize, 1.0);
});

// ==========================================
// 2. CUSTOM BROKER SPECIFICATIONS (7 - 12)
// ==========================================

test('7. Custom contract size calculation (Gold 10oz micro contract)', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 2400.00, stopLoss: 2390.00, direction: 'BUY', pair: 'XAUUSD', customSpec: { contractSize: 10, pipSize: 0.10, tickSize: 0.01, lotStep: 0.01, minLot: 0.01, maxLot: 100 } });
  assert.equal(res.isCustomSpec, true);
  assert.equal(res.safeLotSize, 1.0);
});

test('8. Custom tick size calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', customSpec: { contractSize: 100000, tickSize: 0.0001, pipSize: 0.0001, lotStep: 0.01, minLot: 0.01, maxLot: 100 } });
  assert.equal(res.safeLotSize, 0.50);
});

test('9. Custom tick value methodology calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 19500, stopLoss: 19450, direction: 'BUY', pair: 'NAS100', customSpec: { contractSize: 1, tickSize: 0.1, tickValue: 0.20, lotStep: 0.01, minLot: 0.01, maxLot: 100 } });
  assert.equal(res.calculationMethod, 'BROKER_TICK_VALUE');
  assert.equal(res.safeLotSize, 1.0);
});

test('10. Custom lot step calculation (0.1 step)', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0985, direction: 'BUY', pair: 'EURUSD', customSpec: { contractSize: 100000, pipSize: 0.0001, tickSize: 0.00001, lotStep: 0.1, minLot: 0.1, maxLot: 100 } });
  assert.equal(res.safeLotSize, 0.6);
});

test('11. Custom min lot calculation (Blocked below min)', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', customSpec: { contractSize: 100000, pipSize: 0.0001, tickSize: 0.00001, lotStep: 0.01, minLot: 1.0, maxLot: 100 } });
  assert.equal(res.isBelowMinLot, true);
  assert.equal(res.safeLotSize, 0);
});

test('12. Custom max lot capping calculation', () => {
  const res = calculatePositionSize({ balance: 100000, riskPercent: 5.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', customSpec: { contractSize: 100000, pipSize: 0.0001, tickSize: 0.00001, lotStep: 0.01, minLot: 0.01, maxLot: 10.0 } });
  assert.equal(res.isCappedAtMaxLot, true);
  assert.equal(res.safeLotSize, 10.0);
});

// ==========================================
// 3. FLOOR ROUNDING & STEP TESTS (13 - 15)
// ==========================================

test('13. Floor rounding at 0.01 step', () => {
  assert.equal(floorToStep(0.5379, 0.01), 0.53);
});

test('14. Floor rounding at 0.1 step', () => {
  assert.equal(floorToStep(0.5379, 0.1), 0.5);
});

test('15. Floor rounding at 0.001 step', () => {
  assert.equal(floorToStep(0.5379, 0.001), 0.537);
});

// ==========================================
// 4. BOUNDARY & ACTUAL RISK TESTS (16 - 18)
// ==========================================

test('16. Minimum lot violation check', () => {
  const calc = calculatePositionSize({ balance: 1000, riskPercent: 0.1, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  const check = evaluateTradeRiskCheck({ calculationResult: calc });
  assert.equal(check.isPassed, false);
  assert.equal(check.status, 'FAIL');
});

test('17. Maximum lot capping warning check', () => {
  const calc = calculatePositionSize({ balance: 100000, riskPercent: 5.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', customSpec: { contractSize: 100000, pipSize: 0.0001, tickSize: 0.00001, lotStep: 0.01, minLot: 0.01, maxLot: 10.0 } });
  const check = evaluateTradeRiskCheck({ calculationResult: calc });
  assert.ok(check.warnings.some(w => w.includes('exceeded your broker\'s maximum lot size')));
});

test('18. Actual risk after floor rounding calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0985, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.targetCapitalAtRisk, 100);
  assert.equal(res.safeLotSize, 0.66);
  assert.equal(res.estimatedTotalRisk, 99.00);
  assert.equal(res.unusedRiskBuffer, 1.00);
});

// ==========================================
// 5. CURRENCY CONVERSION TESTS (19 - 25)
// ==========================================

test('19. USD account direct matching calculation', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'USD', quoteCurrency: 'USD' });
  assert.equal(details.rate, 1.0);
  assert.equal(details.isDirectMatch, true);
});

test('20. EUR account rate calculation', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'EUR', quoteCurrency: 'USD', manualRate: 0.92 });
  assert.equal(details.rate, 0.92);
  assert.equal(details.source, 'MANUAL');
});

test('21. GBP account rate calculation', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'GBP', quoteCurrency: 'USD', manualRate: 0.78 });
  assert.equal(details.rate, 0.78);
});

test('22. NGN account rate calculation', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'NGN', quoteCurrency: 'USD', manualRate: 1500 });
  assert.equal(details.rate, 1500);
  assert.equal(convertCurrency(100, details), 150000);
});

test('23. JPY account rate calculation', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'JPY', quoteCurrency: 'USD', manualRate: 150 });
  assert.equal(details.rate, 150);
});

test('24. Missing conversion rate handling', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'NGN', quoteCurrency: 'USD' });
  assert.equal(details.isAvailable, false);
  assert.equal(details.source, 'UNAVAILABLE');
});

test('25. Manual conversion rate override', () => {
  const details = getExchangeRateDetails({ accountCurrency: 'EUR', quoteCurrency: 'USD', manualRate: 0.90 });
  assert.equal(details.source, 'MANUAL');
  assert.equal(details.rate, 0.90);
});

// ==========================================
// 6. SETUP & BOUNDARY TESTS (26 - 35)
// ==========================================

test('26. Valid BUY calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.isInvalidSetup, false);
  assert.equal(res.safeLotSize, 0.50);
});

test('27. Valid SELL calculation', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.1020, direction: 'SELL', pair: 'EURUSD' });
  assert.equal(res.isInvalidSetup, false);
  assert.equal(res.safeLotSize, 0.50);
});

test('28. Invalid entry price handling', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1, entryPrice: 0, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.safeLotSize, 0);
});

test('29. Invalid stop loss price structure', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.1050, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.isInvalidSetup, true);
  assert.equal(res.safeLotSize, 0);
});

test('30. Zero risk percentage handling', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.targetCapitalAtRisk, 0);
  assert.equal(res.safeLotSize, 0);
});

test('31. Negative risk handling', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: -1, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.targetCapitalAtRisk, 0);
  assert.equal(res.safeLotSize, 0);
});

test('32. Zero account balance handling', () => {
  const res = calculatePositionSize({ balance: 0, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.targetCapitalAtRisk, 0);
  assert.equal(res.safeLotSize, 0);
});

test('33. Negative account balance handling', () => {
  const res = calculatePositionSize({ balance: -5000, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.targetCapitalAtRisk, 0);
  assert.equal(res.safeLotSize, 0);
});

test('34. Invalid custom tick value validation', () => {
  const val = validateCustomBrokerSpec({ contractSize: 100000, tickSize: 0.0001, tickValue: -1, lotStep: 0.01, minLot: 0.01, maxLot: 100 });
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some(e => e.includes('Tick Value')));
});

test('35. Invalid custom contract size validation', () => {
  const val = validateCustomBrokerSpec({ contractSize: 0, tickSize: 0.0001, lotStep: 0.01, minLot: 0.01, maxLot: 100 });
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some(e => e.includes('Contract Size')));
});

// ==========================================
// 7. PROP FIRM & SAFETY TESTS (36 - 40)
// ==========================================

test('36. Prop-firm daily loss limit breach check', () => {
  const calc = calculatePositionSize({ balance: 10000, riskPercent: 2.5, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  const check = evaluateTradeRiskCheck({ calculationResult: calc, account: { propFirmAccount: { dailyLossLimit: 200 }, todayLossAmount: 50 } });
  assert.equal(check.isPassed, false);
  assert.equal(check.status, 'FAIL');
});

test('37. Low Risk/Reward ratio warning check', () => {
  const calc = calculatePositionSize({ balance: 10000, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.0980, takeProfit: 1.1010, direction: 'BUY', pair: 'EURUSD' });
  const check = evaluateTradeRiskCheck({ calculationResult: calc, userSettings: { minimumRiskRewardRatio: 1.5 } });
  assert.equal(check.status, 'WARN');
  assert.ok(check.warnings.some(w => w.includes('below your minimum target')));
});

test('38. Quick Trade helper integration output consistency', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(res.safeLotSize, 0.50);
  assert.equal(res.estimatedTotalRisk, 100);
});

test('39. Reverse SL calculation consistency', () => {
  const res = calculateReverseStopLoss({ balance: 10000, riskPercent: 1, lotSize: 0.50, pair: 'EURUSD', entryPrice: 1.1000, direction: 'BUY' });
  assert.equal(res.maxStopLossPips, 20);
  assert.equal(res.suggestedStopLossPrice, 1.0980);
});

test('40. Comprehensive custom broker specification validator', () => {
  const valid = validateCustomBrokerSpec({ contractSize: 100000, tickSize: 0.00001, lotStep: 0.01, minLot: 0.01, maxLot: 100 });
  assert.equal(valid.isValid, true);
});

// ==========================================
// 8. V3 MARKET DATA TESTS (41 - 44)
// ==========================================

test('41. Live market data lookup for EURUSD', () => {
  const md = getMarketData('EURUSD');
  assert.equal(md.symbol, 'EURUSD');
  assert.equal(md.source, MARKET_DATA_STATUS.LIVE);
  assert.ok(md.bid > 0);
  assert.ok(md.ask > 0);
});

test('42. Resolve BUY execution price on Ask side', () => {
  const md = getMarketData('EURUSD');
  const price = resolveExecutionPrice({ marketData: md, direction: 'BUY' });
  assert.equal(price, md.ask);
});

test('43. Resolve SELL execution price on Bid side', () => {
  const md = getMarketData('EURUSD');
  const price = resolveExecutionPrice({ marketData: md, direction: 'SELL' });
  assert.equal(price, md.bid);
});

test('44. Market data lookup for unknown pair falls back to UNAVAILABLE', () => {
  const md = getMarketData('UNKNOWN_PAIR_999');
  assert.equal(md.source, MARKET_DATA_STATUS.UNAVAILABLE);
  assert.equal(md.bid, null);
});

// ==========================================
// 9. V3 BROKER PROFILES TESTS (45 - 48)
// ==========================================

test('45. Get saved broker profiles returns default profile', () => {
  const profiles = getSavedBrokerProfiles();
  assert.ok(Array.isArray(profiles));
  assert.ok(profiles.length > 0);
  assert.equal(profiles[0].id, DEFAULT_BROKER_PROFILE.id);
});

test('46. Save new custom broker profile', () => {
  const newProfile = { name: 'FTMO Standard', accountCurrency: 'USD', commissionPerLot: 6 };
  const saved = saveBrokerProfile(newProfile);
  assert.ok(saved.id);
  assert.equal(saved.name, 'FTMO Standard');

  const all = getSavedBrokerProfiles();
  assert.ok(all.some(p => p.id === saved.id));
  deleteBrokerProfile(saved.id); // cleanup
});

test('47. Delete broker profile', () => {
  const temp = saveBrokerProfile({ name: 'Temp Profile' });
  const deleted = deleteBrokerProfile(temp.id);
  assert.equal(deleted, true);
});

test('48. Default broker profile deletion is protected', () => {
  const deleted = deleteBrokerProfile(DEFAULT_BROKER_PROFILE.id);
  assert.equal(deleted, false);
});

// ==========================================
// 10. V3 EXECUTION COSTS TESTS (49 - 53)
// ==========================================

test('49. Calculation with zero execution costs', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', spreadPips: 0, slippagePips: 0, commissionPerLot: 0 });
  assert.equal(res.safeLotSize, 0.50);
  assert.equal(res.actualPriceRisk, 100);
  assert.equal(res.actualSpreadCost, 0);
  assert.equal(res.actualCommissionCost, 0);
  assert.equal(res.estimatedTotalRisk, 100);
});

test('50. Calculation with spread cost included', () => {
  // Balance: $10k, Risk: 1% ($100), SL: 20 pips, Spread: 5 pips -> Total distance 25 pips -> 100 / (25 * 10) = 0.40 lots
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', spreadPips: 5.0 });
  assert.equal(res.safeLotSize, 0.40);
  assert.equal(res.actualPriceRisk, 80);
  assert.equal(res.actualSpreadCost, 20);
  assert.equal(res.estimatedTotalRisk, 100);
});

test('51. Calculation with slippage buffer included', () => {
  // Balance: $10k, Risk: 1% ($100), SL: 20 pips, Slippage: 5 pips -> 100 / (25 * 10) = 0.40 lots
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', slippagePips: 5.0 });
  assert.equal(res.safeLotSize, 0.40);
  assert.equal(res.actualSlippageCost, 20);
  assert.equal(res.estimatedTotalRisk, 100);
});

test('52. Calculation with commission per lot included', () => {
  // Balance: $10k, Risk: 1% ($100), SL: 20 pips ($200/lot), Commission: $10/lot -> Cost/lot = $210 -> 100 / 210 = 0.476 -> safe 0.47 lots
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', commissionPerLot: 10.0 });
  assert.equal(res.safeLotSize, 0.47);
  assert.equal(res.actualPriceRisk, 94);
  assert.equal(res.actualCommissionCost, 4.70);
  assert.equal(res.estimatedTotalRisk, 98.70);
});

test('53. Combined costs (Spread + Slippage + Commission) guarantee Total Risk <= Target Risk', () => {
  const res = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', spreadPips: 2.0, slippagePips: 1.0, commissionPerLot: 7.0 });
  assert.ok(res.estimatedTotalRisk <= res.targetCapitalAtRisk);
});

// ==========================================
// 11. V3 SCENARIO SIMULATOR TESTS (54 - 56)
// ==========================================

test('54. Risk scenario matrix generation produces 5 standard target scenarios', () => {
  const scenarios = generateRiskScenarios({ balance: 10000, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(scenarios.length, 5);
  assert.equal(scenarios[0].riskPercent, 0.25);
  assert.equal(scenarios[2].riskPercent, 1.0);
  assert.equal(scenarios[2].safeLotSize, 0.50);
});

test('55. Risk scenario matrix lot sizes scale deterministically', () => {
  const scenarios = generateRiskScenarios({ balance: 10000, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  assert.equal(scenarios[0].safeLotSize, 0.12);
  assert.equal(scenarios[1].safeLotSize, 0.25);
  assert.equal(scenarios[2].safeLotSize, 0.50);
  assert.equal(scenarios[3].safeLotSize, 0.75);
  assert.equal(scenarios[4].safeLotSize, 1.00);
});

test('56. Scenario matrix respects floor rounding for each scenario', () => {
  const scenarios = generateRiskScenarios({ balance: 10000, entryPrice: 1.1000, stopLoss: 1.0985, direction: 'BUY', pair: 'EURUSD' });
  scenarios.forEach(sc => {
    assert.ok(sc.estimatedTotalRisk <= sc.targetCapitalAtRisk);
  });
});

// ==========================================
// 12. V3 COMBINED PROP-FIRM RISK TESTS (57 - 60)
// ==========================================

test('57. Combined prop-firm risk (Existing Open Risk + New Trade Risk) within limit', () => {
  const calc = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  const check = evaluateTradeRiskCheck({ calculationResult: calc, account: { propFirmAccount: { dailyLossLimit: 300 }, todayLossAmount: 50 }, existingOpenTradeRisk: 50 });
  assert.equal(check.isPassed, true);
  assert.equal(check.propFirmDetails.combinedRisk, 150);
});

test('58. Combined prop-firm risk breach triggers HARD BLOCK', () => {
  const calc = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  const check = evaluateTradeRiskCheck({ calculationResult: calc, account: { propFirmAccount: { dailyLossLimit: 200 }, todayLossAmount: 50 }, existingOpenTradeRisk: 100 });
  // New trade $100 + Existing $100 = $200. Remaining allowance is $150 ($200 daily limit - $50 today loss). Combined $200 > remaining $150!
  assert.equal(check.isPassed, false);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.hardBlocks.some(b => b.includes('EXCEEDS COMBINED PROP-FIRM DAILY LIMIT')));
});

test('59. 11-point safety checklist renders all 11 categories', () => {
  const calc = calculatePositionSize({ balance: 10000, riskPercent: 1.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD', spreadPips: 1, slippagePips: 0.5, commissionPerLot: 5 });
  const check = evaluateTradeRiskCheck({ calculationResult: calc });
  assert.equal(check.checklist.length, 11);
});

test('60. Failed safety evaluation blocks Apply to New Trade transition', () => {
  const calc = calculatePositionSize({ balance: 10000, riskPercent: 5.0, entryPrice: 1.1000, stopLoss: 1.0980, direction: 'BUY', pair: 'EURUSD' });
  const check = evaluateTradeRiskCheck({ calculationResult: calc, account: { propFirmAccount: { dailyLossLimit: 200 }, todayLossAmount: 0 } });
  assert.equal(check.isPassed, false);
});
