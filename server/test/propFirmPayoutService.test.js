const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const propFirmPayoutService = require('../src/services/propFirmPayoutService');

describe('PropFirmPayoutService — Payout Ledger & Eligibility', () => {
  test('1. Profit split and net trader payout calculation', () => {
    const amountRequested = 5000;
    const splitPercent = 80;
    const firmFee = 50;

    const grossTraderShare = amountRequested * (splitPercent / 100);
    const netTraderPayout = grossTraderShare - firmFee;

    assert.equal(grossTraderShare, 4000);
    assert.equal(netTraderPayout, 3950);
  });

  test('2. 90% profit split with zero fee', () => {
    const amountRequested = 10000;
    const splitPercent = 90;
    const firmFee = 0;

    const netTraderPayout = amountRequested * (splitPercent / 100) - firmFee;
    assert.equal(netTraderPayout, 9000);
  });
});
