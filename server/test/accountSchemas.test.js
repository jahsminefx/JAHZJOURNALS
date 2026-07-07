const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRegularAccountSchema,
  createPropFirmAccountSchema,
} = require('../src/validation/accountSchemas');

const validRegularAccount = {
  name: 'Main Broker',
  accountType: 'DEMO',
  startingBalance: 1000,
  currentBalance: 1000,
  currency: 'USD',
  platform: 'MT5',
  riskPerTradePercent: 1,
};

const phase = (phaseNumber) => ({
  phaseNumber,
  name: `Phase ${phaseNumber}`,
  profitTargetPercent: phaseNumber === 1 ? 8 : 5,
  minimumTradingDays: 5,
  maximumTradingDays: 30,
  timeLimitType: 'CALENDAR_DAYS',
  timeLimitDays: 30,
  status: phaseNumber === 1 ? 'ACTIVE' : 'NOT_STARTED',
});

const validPropFirmAccount = {
  name: 'FTMO 100K',
  firmName: 'FTMO',
  programmeName: 'Challenge',
  marketType: 'FOREX_CFD',
  accountSize: 100000,
  currency: 'USD',
  platform: 'MT5',
  evaluationType: 'TWO_STEP',
  accountStatus: 'ACTIVE',
  phases: [phase(1), phase(2)],
  dailyLossEnabled: true,
  dailyLossPercent: 5,
  maximumLossPercent: 10,
  includeFloatingPnl: true,
  includeCommissions: true,
  includeSwaps: true,
  consistencyRuleEnabled: false,
  scalingPlanEnabled: false,
};

test('regular account schema accepts simple broker account data', () => {
  const result = createRegularAccountSchema.safeParse(validRegularAccount);
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Main Broker');
});

test('regular account schema rejects non-positive starting balance', () => {
  const result = createRegularAccountSchema.safeParse({ ...validRegularAccount, startingBalance: 0 });
  assert.equal(result.success, false);
});

test('prop-firm schema accepts one-step evaluation with one phase', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    evaluationType: 'ONE_STEP',
    phases: [phase(1)],
  });
  assert.equal(result.success, true);
});

test('prop-firm schema accepts two-step evaluation with two phases', () => {
  const result = createPropFirmAccountSchema.safeParse(validPropFirmAccount);
  assert.equal(result.success, true);
});

test('prop-firm schema accepts instant-funded account with no phases and funded settings', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    evaluationType: 'INSTANT_FUNDED',
    accountStatus: 'FUNDED',
    phases: [],
    profitSplitPercent: 80,
  });
  assert.equal(result.success, true);
});

test('prop-firm schema rejects duplicate phase numbers', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    phases: [phase(1), { ...phase(2), phaseNumber: 1 }],
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /unique/);
});

test('prop-firm schema rejects daily loss above maximum overall loss', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    dailyLossPercent: 12,
    maximumLossPercent: 10,
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /Daily loss/);
});

test('prop-firm schema rejects phase maximum days below minimum days', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    phases: [{ ...phase(1), maximumTradingDays: 2 }, phase(2)],
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /Maximum trading days/);
});
