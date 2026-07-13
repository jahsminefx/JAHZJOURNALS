import {
  expectedPhaseCount,
  propFirmAccountDetailsSchema,
  propFirmChallengeRulesSchema,
} from '../validation/propFirmSchemas.js';

export const defaultPhase = (index, values = {}) => ({
  name: values.name || `Phase ${index + 1}`,
  profitTargetPercent: values.profitTargetPercent ?? '',
  minimumTradingDays: values.minimumTradingDays ?? '0',
  timeLimitType: values.timeLimitType || 'UNLIMITED',
  timeLimitDays: values.timeLimitDays ?? '',
});

export const defaultPropFirmWizardValues = {
  accountName: '',
  firmName: '',
  customFirmName: '',
  programmeName: '',
  accountSize: '',
  currency: 'USD',
  platform: 'MT5',
  evaluationType: 'TWO_STEP',
  startDate: '',
  phaseCount: 2,
  phases: [defaultPhase(0, { profitTargetPercent: '8' }), defaultPhase(1, { profitTargetPercent: '5' })],
  dailyLossPercent: '5',
  maximumLossPercent: '10',
  drawdownType: 'STATIC',
};

export const wizardStepSets = {
  full: [
    { key: 'details', label: 'Account Details' },
    { key: 'challenge', label: 'Challenge Rules' },
    { key: 'review', label: 'Review and Create' },
  ],
  account: [
    { key: 'details', label: 'Account Details' },
    { key: 'review', label: 'Review and Save' },
  ],
  challenge: [
    { key: 'challenge', label: 'Challenge Rules' },
    { key: 'review', label: 'Review and Save' },
  ],
};

export const getWizardStepSet = (mode = 'full') => wizardStepSets[mode] || wizardStepSets.full;

export const getSchemaForStep = (stepKey) => {
  if (stepKey === 'details') return propFirmAccountDetailsSchema;
  if (stepKey === 'challenge') return propFirmChallengeRulesSchema;
  return null;
};

export const normalizePropFirmInitialValues = (initialValues) => {
  if (!initialValues) return defaultPropFirmWizardValues;

  const phases = (initialValues.phases || []).map((phase, index) => defaultPhase(index, phase));

  return {
    ...defaultPropFirmWizardValues,
    ...initialValues,
    accountName: initialValues.accountName || initialValues.name || '',
    phaseCount: phases.length,
    phases,
  };
};

export const resizePhases = (count, currentPhases = []) => {
  const nextCount = Number(count);
  return Array.from({ length: nextCount }, (_, index) => defaultPhase(index, currentPhases[index]));
};

export const coerceExpectedPhaseCount = (evaluationType, currentCount) => {
  const expected = expectedPhaseCount[evaluationType];
  return expected === undefined ? Number(currentCount || 0) : expected;
};

export const buildPropFirmPayload = (form) => ({
  accountName: form.accountName,
  firmName: form.firmName,
  customFirmName: form.firmName === 'OTHER' ? form.customFirmName : '',
  programmeName: form.programmeName,
  marketType: 'FOREX_CFD',
  accountSize: form.accountSize,
  currency: form.currency,
  platform: form.platform,
  evaluationType: form.evaluationType,
  startDate: form.startDate || '',
  phaseCount: Number(form.phaseCount || 0),
  phases: (form.phases || []).map((phase, index) => ({
    name: phase.name || `Phase ${index + 1}`,
    profitTargetPercent: phase.profitTargetPercent,
    minimumTradingDays: phase.minimumTradingDays || '0',
    timeLimitType: phase.timeLimitType || 'UNLIMITED',
    timeLimitDays: phase.timeLimitType === 'UNLIMITED' ? '' : phase.timeLimitDays,
  })),
  dailyLossPercent: form.dailyLossPercent,
  maximumLossPercent: form.maximumLossPercent,
  drawdownType: form.drawdownType,
});

export {
  propFirmAccountDetailsSchema,
  propFirmChallengeRulesSchema,
};
