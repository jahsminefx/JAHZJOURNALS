import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PropFirmPhaseForm from './PropFirmPhaseForm';
import PropFirmStepIndicator from './PropFirmStepIndicator';
import {
  CurrencyInput,
  FormNavigationButtons,
  PercentageInput,
  SelectInput,
  TextInput,
  TimezoneSelect,
  ToggleField,
} from './FormControls';

const steps = ['Account details', 'Evaluation phases', 'Drawdown and risk', 'Restrictions and funded'];

const defaultPhase = (phaseNumber) => ({
  phaseNumber,
  name: phaseNumber === 1 ? 'Phase 1' : `Phase ${phaseNumber}`,
  profitTargetPercent: '',
  profitTargetAmount: '',
  minimumTradingDays: '',
  minimumProfitableDays: '',
  maximumTradingDays: '',
  timeLimitType: 'UNLIMITED',
  timeLimitDays: '',
  status: phaseNumber === 1 ? 'ACTIVE' : 'NOT_STARTED',
});

const defaultForm = {
  template: 'blank',
  name: '',
  firmName: '',
  customFirmName: '',
  programmeName: '',
  marketType: 'FOREX_CFD',
  accountSize: '',
  currency: 'USD',
  platform: 'MT5',
  brokerServer: '',
  challengeFee: '',
  startDate: '',
  accountType: '',
  evaluationType: 'TWO_STEP',
  accountStatus: 'NOT_STARTED',
  currentBalance: '',
  currentPhaseNumber: '1',
  phases: [defaultPhase(1), defaultPhase(2)],
  dailyLossEnabled: true,
  dailyLossPercent: '',
  dailyLossAmount: '',
  maximumLossPercent: '',
  maximumLossAmount: '',
  drawdownType: 'STATIC',
  dailyLossCalculationBasis: 'INITIAL_BALANCE',
  overallLossCalculationBasis: 'INITIAL_BALANCE',
  includeFloatingPnl: true,
  includeCommissions: true,
  includeSwaps: true,
  dailyResetTime: '',
  dailyResetTimezone: 'UTC',
  maxRiskPerTradePercent: '',
  maxRiskPerTradeIdea: '',
  maxOpenPositions: '',
  maxLotSize: '',
  stopAfterLosses: '',
  consistencyRuleEnabled: false,
  consistencyRuleType: '',
  consistencyThreshold: '',
  maximumBestDayPercent: '',
  minimumProfitableDays: '',
  profitableDayMinimum: '',
  newsTradingAllowed: true,
  weekendHoldingAllowed: false,
  overnightHoldingAllowed: true,
  expertAdvisorsAllowed: false,
  copyTradingAllowed: false,
  hedgingAllowed: true,
  scalpingAllowed: true,
  cryptoTradingAllowed: false,
  restrictedSymbols: '',
  restrictedNewsBeforeMinutes: '',
  restrictedNewsAfterMinutes: '',
  maximumInactivityDays: '',
  prohibitedStrategies: '',
  customRules: '',
  profitSplitPercent: '',
  firstPayoutDate: '',
  payoutFrequency: '',
  minimumPayoutAmount: '',
  payoutCycleStartDate: '',
  scalingPlanEnabled: false,
  nextScalingTarget: '',
  maximumAllocation: '',
};

const templates = {
  blank: null,
  genericTwoStep: {
    programmeName: 'Generic two-step evaluation',
    evaluationType: 'TWO_STEP',
    phases: [
      { ...defaultPhase(1), name: 'Challenge', profitTargetPercent: '8', status: 'ACTIVE' },
      { ...defaultPhase(2), name: 'Verification', profitTargetPercent: '5' },
    ],
    dailyLossEnabled: true,
    dailyLossPercent: '5',
    maximumLossPercent: '10',
    drawdownType: 'STATIC',
    consistencyRuleEnabled: false,
  },
};

const fundedEvaluationTypes = new Set(['INSTANT_FUNDED', 'ALREADY_FUNDED']);
const fundedStatuses = new Set(['FUNDED']);

const enumLabel = (value) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const normalizeInitialValues = (initialValues) => ({
  ...defaultForm,
  ...(initialValues || {}),
  phases: initialValues?.phases?.length ? initialValues.phases : defaultForm.phases,
});

const PropFirmAccountWizard = ({ initialValues, isSaving, onSubmit, submitLabel = 'Save Prop-Firm Account' }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(() => normalizeInitialValues(initialValues));

  useEffect(() => {
    setForm(normalizeInitialValues(initialValues));
  }, [initialValues]);

  const showFundedFields = useMemo(
    () => fundedEvaluationTypes.has(form.evaluationType) || fundedStatuses.has(form.accountStatus),
    [form.accountStatus, form.evaluationType],
  );

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const applyTemplate = (templateKey) => {
    const template = templates[templateKey];
    setForm((current) => ({
      ...current,
      template: templateKey,
      ...(template || {}),
      phases: template?.phases || current.phases,
    }));
  };

  const setPhaseCount = (count) => {
    setForm((current) => {
      const nextCount = Number.parseInt(count, 10);
      if (nextCount === 0) {
        return { ...current, phases: [] };
      }

      const phases = Array.from({ length: nextCount }, (_, index) => ({
        ...defaultPhase(index + 1),
        ...(current.phases[index] || {}),
        phaseNumber: index + 1,
      }));

      return { ...current, phases };
    });
  };

  const updatePhase = (index, phase) => {
    setForm((current) => ({
      ...current,
      phases: current.phases.map((item, itemIndex) => (itemIndex === index ? phase : item)),
    }));
  };

  const removePhase = (index) => {
    setForm((current) => ({
      ...current,
      phases: current.phases.filter((_, itemIndex) => itemIndex !== index).map((phase, phaseIndex) => ({
        ...phase,
        phaseNumber: phaseIndex + 1,
      })),
    }));
  };

  const movePhase = (index, direction) => {
    setForm((current) => {
      const phases = [...current.phases];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= phases.length) return current;
      [phases[index], phases[nextIndex]] = [phases[nextIndex], phases[index]];
      return {
        ...current,
        phases: phases.map((phase, phaseIndex) => ({ ...phase, phaseNumber: phaseIndex + 1 })),
      };
    });
  };

  const addPhase = () => {
    setForm((current) => ({
      ...current,
      phases: [...current.phases, defaultPhase(current.phases.length + 1)],
    }));
  };

  const validateStep = (step) => {
    if (step === 0) {
      if (!form.name.trim() || !form.firmName.trim() || !form.programmeName.trim() || Number(form.accountSize) <= 0) {
        toast.error('Complete account name, firm name, programme name, and account size.');
        return false;
      }
    }

    if (step === 1) {
      const expected = { ONE_STEP: 1, TWO_STEP: 2, THREE_STEP: 3 }[form.evaluationType];
      if (expected !== undefined && form.phases.length !== expected) {
        toast.error(`${enumLabel(form.evaluationType)} requires ${expected} phase(s).`);
        return false;
      }
      if (fundedEvaluationTypes.has(form.evaluationType) && form.phases.length > 0) {
        toast.error('Instant-funded and already-funded accounts should skip evaluation phases.');
        return false;
      }
      if (form.phases.some((phase) => !String(phase.name || '').trim())) {
        toast.error('Every phase needs a name.');
        return false;
      }
    }

    if (step === 2) {
      if (Number(form.dailyLossPercent || 0) > Number(form.maximumLossPercent || 100)) {
        toast.error('Daily loss percentage cannot exceed maximum overall loss percentage.');
        return false;
      }
      if (Number(form.dailyLossAmount || 0) > Number(form.maximumLossAmount || Number.POSITIVE_INFINITY)) {
        toast.error('Daily loss amount cannot exceed maximum overall loss amount.');
        return false;
      }
    }

    if (step === 3 && showFundedFields && !form.profitSplitPercent) {
      toast.error('Profit split percentage is required for funded account settings.');
      return false;
    }

    return true;
  };

  const next = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const submit = () => {
    if (!validateStep(currentStep)) return;
    const payload = { ...form };
    delete payload.template;
    onSubmit(payload);
  };

  return (
    <div className="space-y-6">
      <PropFirmStepIndicator steps={steps} currentStep={currentStep} />

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6">
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100/90">
              Verify these rules against your official prop-firm agreement before saving.
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <SelectInput label="Start from" value={form.template} onChange={(event) => applyTemplate(event.target.value)}>
                <option value="blank">Blank account</option>
                <option value="genericTwoStep">Generic two-step template</option>
              </SelectInput>
              <TextInput label="Account name" value={form.name} onChange={(event) => update('name', event.target.value)} />
              <TextInput label="Prop-firm name" value={form.firmName} onChange={(event) => update('firmName', event.target.value)} />
              <TextInput label="Custom prop-firm name" value={form.customFirmName} onChange={(event) => update('customFirmName', event.target.value)} />
              <TextInput label="Programme/model name" value={form.programmeName} onChange={(event) => update('programmeName', event.target.value)} />
              <SelectInput label="Market type" value={form.marketType} onChange={(event) => update('marketType', event.target.value)}>
                <option value="FOREX_CFD">Forex/CFD</option>
                <option value="FUTURES">Futures</option>
                <option value="OTHER">Other</option>
              </SelectInput>
              <CurrencyInput label="Account size" value={form.accountSize} onChange={(event) => update('accountSize', event.target.value)} />
              <CurrencyInput label="Current balance" description="Leave blank to match account size." value={form.currentBalance} onChange={(event) => update('currentBalance', event.target.value)} />
              <SelectInput label="Account currency" value={form.currency} onChange={(event) => update('currency', event.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="NGN">NGN</option>
              </SelectInput>
              <SelectInput label="Trading platform" value={form.platform} onChange={(event) => update('platform', event.target.value)}>
                {['MT4', 'MT5', 'CTRADER', 'MATCH_TRADER', 'TRADELOCKER', 'DXTRADE', 'RITHMIC', 'NINJATRADER', 'OTHER'].map((platform) => (
                  <option key={platform} value={platform}>{enumLabel(platform)}</option>
                ))}
              </SelectInput>
              <TextInput label="Broker or server name" value={form.brokerServer} onChange={(event) => update('brokerServer', event.target.value)} />
              <CurrencyInput label="Challenge or purchase fee" value={form.challengeFee} onChange={(event) => update('challengeFee', event.target.value)} />
              <TextInput type="date" label="Account start date" value={form.startDate} onChange={(event) => update('startDate', event.target.value)} />
              <TextInput label="Account category" value={form.accountType} onChange={(event) => update('accountType', event.target.value)} placeholder="Evaluation, instant-funded, funded" />
              <SelectInput label="Evaluation type" value={form.evaluationType} onChange={(event) => update('evaluationType', event.target.value)}>
                <option value="ONE_STEP">One-step evaluation</option>
                <option value="TWO_STEP">Two-step evaluation</option>
                <option value="THREE_STEP">Three-step evaluation</option>
                <option value="INSTANT_FUNDED">Instant funded</option>
                <option value="ALREADY_FUNDED">Already funded</option>
                <option value="FREE_TRIAL">Free trial</option>
                <option value="DEMO_EVALUATION">Demo evaluation</option>
              </SelectInput>
              <SelectInput label="Current account status" value={form.accountStatus} onChange={(event) => update('accountStatus', event.target.value)}>
                {['NOT_STARTED', 'ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'FUNDED', 'SUSPENDED', 'RESET', 'EXPIRED'].map((status) => (
                  <option key={status} value={status}>{enumLabel(status)}</option>
                ))}
              </SelectInput>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <SelectInput label="Number of phases" value={form.phases.length} onChange={(event) => setPhaseCount(event.target.value)}>
                <option value="0">No evaluation phase</option>
                <option value="1">One phase</option>
                <option value="2">Two phases</option>
                <option value="3">Three phases</option>
              </SelectInput>
              <TextInput type="number" label="Current phase number" value={form.currentPhaseNumber} onChange={(event) => update('currentPhaseNumber', event.target.value)} />
            </div>
            {form.phases.length === 0 ? (
              <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 text-sm text-gray-400">
                Evaluation phases are skipped for this account.
              </div>
            ) : (
              <div className="space-y-4">
                {form.phases.map((phase, index) => (
                  <PropFirmPhaseForm
                    key={`${phase.phaseNumber}-${index}`}
                    phase={phase}
                    index={index}
                    canMoveUp={index > 0}
                    canMoveDown={index < form.phases.length - 1}
                    onChange={updatePhase}
                    onRemove={removePhase}
                    onMove={movePhase}
                  />
                ))}
              </div>
            )}
            <button type="button" onClick={addPhase} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              Add phase
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <p className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm leading-6 text-green-100/80">
              Enter the exact drawdown and risk rules for this programme. These values should match the official prop-firm agreement.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField label="Daily-loss rule enabled" checked={form.dailyLossEnabled} onChange={(value) => update('dailyLossEnabled', value)} />
              <ToggleField label="Include floating profit/loss" checked={form.includeFloatingPnl} onChange={(value) => update('includeFloatingPnl', value)} />
              <ToggleField label="Include commissions" checked={form.includeCommissions} onChange={(value) => update('includeCommissions', value)} />
              <ToggleField label="Include swaps" checked={form.includeSwaps} onChange={(value) => update('includeSwaps', value)} />
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <PercentageInput label="Maximum daily loss percentage" value={form.dailyLossPercent} onChange={(event) => update('dailyLossPercent', event.target.value)} />
              <CurrencyInput label="Maximum daily loss amount" value={form.dailyLossAmount} onChange={(event) => update('dailyLossAmount', event.target.value)} />
              <PercentageInput label="Maximum overall loss percentage" value={form.maximumLossPercent} onChange={(event) => update('maximumLossPercent', event.target.value)} />
              <CurrencyInput label="Maximum overall loss amount" value={form.maximumLossAmount} onChange={(event) => update('maximumLossAmount', event.target.value)} />
              <SelectInput label="Drawdown type" value={form.drawdownType} onChange={(event) => update('drawdownType', event.target.value)}>
                {['STATIC', 'TRAILING', 'END_OF_DAY_TRAILING', 'INTRADAY_TRAILING', 'ABSOLUTE'].map((type) => (
                  <option key={type} value={type}>{enumLabel(type)}</option>
                ))}
              </SelectInput>
              <SelectInput label="Daily-loss calculation basis" value={form.dailyLossCalculationBasis} onChange={(event) => update('dailyLossCalculationBasis', event.target.value)}>
                <option value="INITIAL_BALANCE">Initial balance</option>
                <option value="START_OF_DAY_BALANCE">Start-of-day balance</option>
                <option value="START_OF_DAY_EQUITY">Start-of-day equity</option>
                <option value="HIGHER_OF_BALANCE_OR_EQUITY">Higher of balance or equity</option>
                <option value="CUSTOM">Custom</option>
              </SelectInput>
              <SelectInput label="Overall-loss calculation basis" value={form.overallLossCalculationBasis} onChange={(event) => update('overallLossCalculationBasis', event.target.value)}>
                <option value="INITIAL_BALANCE">Initial balance</option>
                <option value="HIGHEST_BALANCE">Highest balance</option>
                <option value="HIGHEST_EQUITY">Highest equity</option>
                <option value="CUSTOM">Custom</option>
              </SelectInput>
              <TextInput label="Daily reset time" value={form.dailyResetTime} onChange={(event) => update('dailyResetTime', event.target.value)} placeholder="17:00" />
              <TimezoneSelect label="Daily reset timezone" value={form.dailyResetTimezone} onChange={(event) => update('dailyResetTimezone', event.target.value)} />
              <PercentageInput label="Maximum risk per trade percentage" value={form.maxRiskPerTradePercent} onChange={(event) => update('maxRiskPerTradePercent', event.target.value)} />
              <PercentageInput label="Maximum risk per trade idea" value={form.maxRiskPerTradeIdea} onChange={(event) => update('maxRiskPerTradeIdea', event.target.value)} />
              <TextInput type="number" label="Maximum open positions" value={form.maxOpenPositions} onChange={(event) => update('maxOpenPositions', event.target.value)} />
              <TextInput type="number" step="0.01" label="Maximum lot size or contracts" value={form.maxLotSize} onChange={(event) => update('maxLotSize', event.target.value)} />
              <TextInput type="number" label="Stop trading after losses" value={form.stopAfterLosses} onChange={(event) => update('stopAfterLosses', event.target.value)} />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-green-400">Consistency rules</h3>
              <ToggleField label="Consistency rule enabled" checked={form.consistencyRuleEnabled} onChange={(value) => update('consistencyRuleEnabled', value)} />
              <div className="grid gap-5 md:grid-cols-3">
                <SelectInput label="Consistency rule type" value={form.consistencyRuleType} onChange={(event) => update('consistencyRuleType', event.target.value)}>
                  <option value="">Select rule</option>
                  <option value="BEST_DAY_PERCENTAGE">Best-day percentage</option>
                  <option value="MAXIMUM_DAILY_PROFIT_PERCENTAGE">Maximum daily-profit percentage</option>
                  <option value="MINIMUM_PROFITABLE_DAYS">Minimum profitable days</option>
                  <option value="CUSTOM">Custom</option>
                </SelectInput>
                <PercentageInput label="Consistency threshold" value={form.consistencyThreshold} onChange={(event) => update('consistencyThreshold', event.target.value)} />
                <PercentageInput label="Maximum best-day percentage" value={form.maximumBestDayPercent} onChange={(event) => update('maximumBestDayPercent', event.target.value)} />
                <TextInput type="number" label="Minimum profitable days" value={form.minimumProfitableDays} onChange={(event) => update('minimumProfitableDays', event.target.value)} />
                <CurrencyInput label="Minimum profit for profitable day" value={form.profitableDayMinimum} onChange={(event) => update('profitableDayMinimum', event.target.value)} />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-bold text-green-400">Trading restrictions</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['newsTradingAllowed', 'News trading allowed'],
                  ['weekendHoldingAllowed', 'Weekend holding allowed'],
                  ['overnightHoldingAllowed', 'Overnight holding allowed'],
                  ['expertAdvisorsAllowed', 'Expert Advisors allowed'],
                  ['copyTradingAllowed', 'Copy trading allowed'],
                  ['hedgingAllowed', 'Hedging allowed'],
                  ['scalpingAllowed', 'Scalping allowed'],
                  ['cryptoTradingAllowed', 'Cryptocurrency trading allowed'],
                ].map(([field, label]) => (
                  <ToggleField key={field} label={label} checked={Boolean(form[field])} onChange={(value) => update(field, value)} />
                ))}
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                <TextInput label="Restricted symbols" value={form.restrictedSymbols} onChange={(event) => update('restrictedSymbols', event.target.value)} placeholder="XAUUSD, US30" />
                <TextInput type="number" label="Restricted news window before event" value={form.restrictedNewsBeforeMinutes} onChange={(event) => update('restrictedNewsBeforeMinutes', event.target.value)} />
                <TextInput type="number" label="Restricted news window after event" value={form.restrictedNewsAfterMinutes} onChange={(event) => update('restrictedNewsAfterMinutes', event.target.value)} />
                <TextInput type="number" label="Maximum inactivity days" value={form.maximumInactivityDays} onChange={(event) => update('maximumInactivityDays', event.target.value)} />
                <div className="md:col-span-2">
                  <TextInput label="Prohibited strategies" value={form.prohibitedStrategies} onChange={(event) => update('prohibitedStrategies', event.target.value)} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm text-gray-300">
                    <span className="font-medium text-gray-200">Custom rules and notes</span>
                    <textarea rows="4" value={form.customRules} onChange={(event) => update('customRules', event.target.value)} className="mt-2 block w-full resize-none rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-green-400" />
                  </label>
                </div>
              </div>
            </section>

            {showFundedFields && (
              <section className="space-y-4 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                <h3 className="text-lg font-bold text-green-300">Funded-account settings</h3>
                <div className="grid gap-5 md:grid-cols-3">
                  <PercentageInput label="Profit split percentage" value={form.profitSplitPercent} onChange={(event) => update('profitSplitPercent', event.target.value)} />
                  <TextInput type="date" label="First payout eligibility date" value={form.firstPayoutDate} onChange={(event) => update('firstPayoutDate', event.target.value)} />
                  <SelectInput label="Payout frequency" value={form.payoutFrequency} onChange={(event) => update('payoutFrequency', event.target.value)}>
                    <option value="">Select frequency</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Biweekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ON_DEMAND">On demand</option>
                    <option value="CUSTOM">Custom</option>
                  </SelectInput>
                  <CurrencyInput label="Minimum payout amount" value={form.minimumPayoutAmount} onChange={(event) => update('minimumPayoutAmount', event.target.value)} />
                  <TextInput type="date" label="Current payout-cycle start date" value={form.payoutCycleStartDate} onChange={(event) => update('payoutCycleStartDate', event.target.value)} />
                  <ToggleField label="Scaling plan enabled" checked={form.scalingPlanEnabled} onChange={(value) => update('scalingPlanEnabled', value)} />
                  <CurrencyInput label="Next scaling target" value={form.nextScalingTarget} onChange={(event) => update('nextScalingTarget', event.target.value)} />
                  <CurrencyInput label="Maximum allocation" value={form.maximumAllocation} onChange={(event) => update('maximumAllocation', event.target.value)} />
                </div>
              </section>
            )}
          </div>
        )}

        <div className="mt-8">
          <FormNavigationButtons
            currentStep={currentStep}
            totalSteps={steps.length}
            saving={isSaving}
            onBack={() => setCurrentStep((step) => Math.max(step - 1, 0))}
            onNext={next}
            onSubmit={submit}
            submitLabel={submitLabel}
          />
        </div>
      </div>
    </div>
  );
};

export default PropFirmAccountWizard;
