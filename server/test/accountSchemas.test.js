const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRegularAccountSchema,
  createPropFirmAccountSchema,
  propFirmAdvancedSettingsSchema,
} = require('../src/validation/accountSchemas');
const {
  mapTradingAccountData,
  mapPhaseData,
  calculateTargetAmount,
} = require('../src/services/propFirmAccountService');

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
  accountName: 'FTMO 100K',
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

test('regular account schema accepts blank optional current balance', () => {
  const result = createRegularAccountSchema.safeParse({
    ...validRegularAccount,
    currentBalance: '',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.currentBalance, undefined);
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

test('prop-firm schema accepts three-step evaluation with three phases', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    evaluationType: 'THREE_STEP',
    phases: [phase(1), phase(2), phase(3)],
  });

  assert.equal(result.success, true);
});

test('prop-firm schema accepts blank optional current balance', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    currentBalance: '',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.currentBalance, undefined);
});

test('prop-firm schema accepts instant-funded account with no phases', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    evaluationType: 'INSTANT_FUNDED',
    phases: [],
  });
  assert.equal(result.success, true);
});

test('prop-firm schema rejects instant-funded account with phases', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    evaluationType: 'INSTANT_FUNDED',
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /0 phase/);
});

test('prop-firm schema rejects two-step account with the wrong phase count', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    phases: [phase(1)],
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /2 phase/);
});

test('prop-firm schema rejects daily loss above maximum overall loss', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    dailyLossPercent: 12,
    maximumLossPercent: 10,
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /daily loss/i);
});

test('prop-firm schema rejects negative minimum trading days', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    phases: [{ ...phase(1), minimumTradingDays: -1 }, phase(2)],
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /zero or greater/);
});

test('prop-firm schema requires time-limit days when limit is not unlimited', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    phases: [{ ...phase(1), timeLimitType: 'CALENDAR_DAYS', timeLimitDays: '' }, phase(2)],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /Time-limit days/);
});

test('prop-firm schema requires custom firm name when Other is selected', () => {
  const result = createPropFirmAccountSchema.safeParse({
    ...validPropFirmAccount,
    firmName: 'OTHER',
    customFirmName: '',
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /Custom prop-firm/);
});

test('prop-firm defaults map current balance and calculated phase targets', () => {
  const tradingAccount = mapTradingAccountData('user-1', validPropFirmAccount);
  const firstPhase = mapPhaseData(validPropFirmAccount.phases[0], 0, validPropFirmAccount.accountSize);
  const secondPhase = mapPhaseData(validPropFirmAccount.phases[1], 1, validPropFirmAccount.accountSize);

  assert.equal(tradingAccount.accountCategory, 'PROP_FIRM');
  assert.equal(tradingAccount.currentBalance, validPropFirmAccount.accountSize);
  assert.equal(calculateTargetAmount(100000, 8), 8000);
  assert.equal(firstPhase.profitTargetAmount, 8000);
  assert.equal(firstPhase.status, 'ACTIVE');
  assert.equal(secondPhase.status, 'NOT_STARTED');
});

test('advanced settings schema accepts funded settings and restrictions', () => {
  const result = propFirmAdvancedSettingsSchema.safeParse({
    brokerServer: 'MetaQuotes-Demo',
    challengeFee: '499',
    accountStatus: 'FUNDED',
    profitSplitPercent: '80',
    scalingPlanEnabled: true,
    nextScalingTarget: '200000',
    restrictedSymbols: 'XAUUSD, US30',
    consistencyRuleEnabled: true,
    consistencyThreshold: '30',
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.restrictedSymbols, ['XAUUSD', 'US30']);
});
