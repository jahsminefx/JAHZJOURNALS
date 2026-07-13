import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPropFirmPayload,
  coerceExpectedPhaseCount,
  getWizardStepSet,
  normalizePropFirmInitialValues,
  resizePhases,
} from '../src/utils/propFirmWizard.js';
import {
  propFirmAccountDetailsSchema,
  propFirmChallengeRulesSchema,
} from '../src/validation/propFirmSchemas.js';
import { shouldShowFundedSettings } from '../src/utils/propFirmAdvancedSettings.js';

const validDetails = {
  accountName: 'JAHZ FX',
  firmName: 'FTMO',
  customFirmName: '',
  programmeName: 'Swift',
  accountSize: '10000',
  currency: 'USD',
  platform: 'MT5',
  evaluationType: 'TWO_STEP',
  startDate: '2026-07-03',
};

const validRules = {
  evaluationType: 'TWO_STEP',
  phaseCount: 2,
  phases: [
    { name: 'Phase 1', profitTargetPercent: '8', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
    { name: 'Phase 2', profitTargetPercent: '5', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
  ],
  dailyLossPercent: '5',
  maximumLossPercent: '10',
  drawdownType: 'STATIC',
};

test('account details step validates required fields and conditional custom firm name', () => {
  assert.equal(propFirmAccountDetailsSchema.safeParse(validDetails).success, true);

  const result = propFirmAccountDetailsSchema.safeParse({
    ...validDetails,
    firmName: 'OTHER',
    customFirmName: '',
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join(' '), /Custom prop-firm/);
});

test('challenge rules validate phase counts, loss limits, and time-limit days', () => {
  assert.equal(propFirmChallengeRulesSchema.safeParse(validRules).success, true);

  const wrongPhaseCount = propFirmChallengeRulesSchema.safeParse({ ...validRules, phaseCount: 1, phases: [validRules.phases[0]] });
  assert.equal(wrongPhaseCount.success, false);
  assert.match(wrongPhaseCount.error.issues.map((issue) => issue.message).join(' '), /2 phase/);

  const badLoss = propFirmChallengeRulesSchema.safeParse({ ...validRules, dailyLossPercent: '12', maximumLossPercent: '10' });
  assert.equal(badLoss.success, false);
  assert.match(badLoss.error.issues.map((issue) => issue.message).join(' '), /daily loss/i);

  const missingTimeLimitDays = propFirmChallengeRulesSchema.safeParse({
    ...validRules,
    phases: [{ ...validRules.phases[0], timeLimitType: 'CALENDAR_DAYS', timeLimitDays: '' }, validRules.phases[1]],
  });
  assert.equal(missingTimeLimitDays.success, false);
  assert.match(missingTimeLimitDays.error.issues.map((issue) => issue.message).join(' '), /Time-limit days/);
});

test('wizard helper keeps entered phase data when moving backward and changing phase count', () => {
  const resized = resizePhases(3, [
    { name: 'Challenge', profitTargetPercent: '9', minimumTradingDays: '2', timeLimitType: 'CALENDAR_DAYS', timeLimitDays: '30' },
    { name: 'Verification', profitTargetPercent: '5', minimumTradingDays: '1', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
  ]);

  assert.equal(resized.length, 3);
  assert.equal(resized[0].name, 'Challenge');
  assert.equal(resized[0].profitTargetPercent, '9');
  assert.equal(resized[1].name, 'Verification');
  assert.equal(resized[2].name, 'Phase 3');
});

test('wizard helper normalizes existing accounts and builds simplified API payloads', () => {
  const initial = normalizePropFirmInitialValues({
    name: 'Legacy Name',
    firmName: 'FTMO',
    phases: validRules.phases,
  });

  assert.equal(initial.accountName, 'Legacy Name');
  assert.equal(initial.phaseCount, 2);

  const payload = buildPropFirmPayload({ ...validDetails, ...validRules });
  assert.equal(payload.accountName, 'JAHZ FX');
  assert.equal(payload.marketType, 'FOREX_CFD');
  assert.equal(payload.phases[0].timeLimitDays, '');
});

test('wizard modes create distinct edit flows', () => {
  assert.deepEqual(getWizardStepSet('account').map((step) => step.key), ['details', 'review']);
  assert.deepEqual(getWizardStepSet('challenge').map((step) => step.key), ['challenge', 'review']);
  assert.deepEqual(getWizardStepSet('full').map((step) => step.key), ['details', 'challenge', 'review']);
});

test('funded settings and expected phase counts are conditional', () => {
  assert.equal(coerceExpectedPhaseCount('ONE_STEP', 3), 1);
  assert.equal(coerceExpectedPhaseCount('INSTANT_FUNDED', 2), 0);
  assert.equal(shouldShowFundedSettings({ evaluationType: 'TWO_STEP', accountStatus: 'ACTIVE' }), false);
  assert.equal(shouldShowFundedSettings({ evaluationType: 'INSTANT_FUNDED', accountStatus: 'ACTIVE' }), true);
  assert.equal(shouldShowFundedSettings({ evaluationType: 'TWO_STEP', accountStatus: 'FUNDED' }), true);
});
