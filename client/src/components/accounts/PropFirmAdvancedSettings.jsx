import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AdvancedSettingsSection from './AdvancedSettingsSection';
import {
  CurrencyInput,
  PercentageInput,
  SelectInput,
  TextInput,
  TimezoneSelect,
  ToggleField,
} from './FormControls';
import { propFirmAdvancedSettingsSchema } from '../../validation/propFirmSchemas';
import { shouldShowFundedSettings } from '../../utils/propFirmAdvancedSettings';

const defaultValues = {
  brokerServer: '',
  challengeFee: '',
  accountStatus: 'ACTIVE',
  currentPhaseNumber: '',
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

const PropFirmAdvancedSettings = ({ account, initialValues, isSaving, onCancel, onSubmit }) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { ...defaultValues, ...(initialValues || {}) },
    resolver: zodResolver(propFirmAdvancedSettingsSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    reset({ ...defaultValues, ...(initialValues || {}) });
  }, [initialValues, reset]);

  const consistencyEnabled = watch('consistencyRuleEnabled');
  const scalingEnabled = watch('scalingPlanEnabled');
  const accountStatus = watch('accountStatus');
  const showFundedSettings = shouldShowFundedSettings({ evaluationType: account?.evaluationType, accountStatus });

  const toggle = (field) => (value) => setValue(field, value, { shouldDirty: true, shouldValidate: true });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <AdvancedSettingsSection title="Account details" description="Operational account fields that are useful after the account exists.">
        <div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Broker or server name" error={errors.brokerServer?.message} {...register('brokerServer')} />
          <CurrencyInput label="Challenge or purchase fee" error={errors.challengeFee?.message} {...register('challengeFee')} />
          <SelectInput label="Current account status" error={errors.accountStatus?.message} {...register('accountStatus')}>
            {['ACTIVE', 'PASSED', 'FAILED', 'BREACHED', 'FUNDED', 'SUSPENDED', 'RESET', 'EXPIRED'].map((status) => (
              <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
            ))}
          </SelectInput>
          <TextInput type="number" min="1" label="Current phase number" error={errors.currentPhaseNumber?.message} {...register('currentPhaseNumber')} />
        </div>
      </AdvancedSettingsSection>

      <AdvancedSettingsSection title="Drawdown calculation rules" description="Tune how daily and overall loss limits are interpreted.">
        <div className="grid gap-5 md:grid-cols-2">
          <SelectInput label="Daily-loss calculation basis" error={errors.dailyLossCalculationBasis?.message} {...register('dailyLossCalculationBasis')}>
            <option value="INITIAL_BALANCE">Initial balance</option>
            <option value="START_OF_DAY_BALANCE">Start-of-day balance</option>
            <option value="START_OF_DAY_EQUITY">Start-of-day equity</option>
            <option value="HIGHER_OF_BALANCE_OR_EQUITY">Higher of balance or equity</option>
            <option value="CUSTOM">Custom</option>
          </SelectInput>
          <SelectInput label="Overall-loss calculation basis" error={errors.overallLossCalculationBasis?.message} {...register('overallLossCalculationBasis')}>
            <option value="INITIAL_BALANCE">Initial balance</option>
            <option value="HIGHEST_BALANCE">Highest balance</option>
            <option value="HIGHEST_EQUITY">Highest equity</option>
            <option value="CUSTOM">Custom</option>
          </SelectInput>
          <ToggleField label="Include floating profit/loss" checked={Boolean(watch('includeFloatingPnl'))} onChange={toggle('includeFloatingPnl')} />
          <ToggleField label="Include commissions" checked={Boolean(watch('includeCommissions'))} onChange={toggle('includeCommissions')} />
          <ToggleField label="Include swaps" checked={Boolean(watch('includeSwaps'))} onChange={toggle('includeSwaps')} />
          <TextInput label="Daily reset time" placeholder="17:00" error={errors.dailyResetTime?.message} {...register('dailyResetTime')} />
          <TimezoneSelect label="Daily reset timezone" error={errors.dailyResetTimezone?.message} {...register('dailyResetTimezone')} />
        </div>
      </AdvancedSettingsSection>

      <AdvancedSettingsSection title="Risk limits" description="Add guardrails for position size and loss streaks.">
        <div className="grid gap-5 md:grid-cols-3">
          <PercentageInput label="Maximum risk per trade" error={errors.maxRiskPerTradePercent?.message} {...register('maxRiskPerTradePercent')} />
          <PercentageInput label="Maximum risk per trade idea" error={errors.maxRiskPerTradeIdea?.message} {...register('maxRiskPerTradeIdea')} />
          <TextInput type="number" min="0" label="Maximum open positions" error={errors.maxOpenPositions?.message} {...register('maxOpenPositions')} />
          <TextInput type="number" min="0" step="0.01" label="Maximum lot size or contracts" error={errors.maxLotSize?.message} {...register('maxLotSize')} />
          <TextInput type="number" min="0" label="Stop trading after losses" error={errors.stopAfterLosses?.message} {...register('stopAfterLosses')} />
        </div>
      </AdvancedSettingsSection>

      <AdvancedSettingsSection title="Consistency rules" description="Optional rule checks for payout eligibility and best-day limits.">
        <div className="space-y-5">
          <ToggleField label="Consistency rule enabled" checked={Boolean(consistencyEnabled)} onChange={toggle('consistencyRuleEnabled')} />
          {consistencyEnabled && (
            <div className="grid gap-5 md:grid-cols-3">
              <SelectInput label="Consistency rule type" error={errors.consistencyRuleType?.message} {...register('consistencyRuleType')}>
                <option value="">Select rule</option>
                <option value="BEST_DAY_PERCENTAGE">Best-day percentage</option>
                <option value="MAXIMUM_DAILY_PROFIT_PERCENTAGE">Maximum daily-profit percentage</option>
                <option value="MINIMUM_PROFITABLE_DAYS">Minimum profitable days</option>
                <option value="CUSTOM">Custom</option>
              </SelectInput>
              <PercentageInput label="Consistency threshold" error={errors.consistencyThreshold?.message} {...register('consistencyThreshold')} />
              <PercentageInput label="Maximum best-day percentage" error={errors.maximumBestDayPercent?.message} {...register('maximumBestDayPercent')} />
              <TextInput type="number" min="0" label="Minimum profitable days" error={errors.minimumProfitableDays?.message} {...register('minimumProfitableDays')} />
              <CurrencyInput label="Minimum profit for a profitable day" error={errors.profitableDayMinimum?.message} {...register('profitableDayMinimum')} />
            </div>
          )}
        </div>
      </AdvancedSettingsSection>

      <AdvancedSettingsSection title="Trading restrictions" description="Record what the firm allows and what should be avoided.">
        <div className="grid gap-4 md:grid-cols-2">
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
            <ToggleField key={field} label={label} checked={Boolean(watch(field))} onChange={toggle(field)} />
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <TextInput label="Restricted symbols" placeholder="XAUUSD, US30" error={errors.restrictedSymbols?.message} {...register('restrictedSymbols')} />
          <TextInput type="number" min="0" label="Restricted news window before event" error={errors.restrictedNewsBeforeMinutes?.message} {...register('restrictedNewsBeforeMinutes')} />
          <TextInput type="number" min="0" label="Restricted news window after event" error={errors.restrictedNewsAfterMinutes?.message} {...register('restrictedNewsAfterMinutes')} />
          <TextInput type="number" min="0" label="Maximum inactivity days" error={errors.maximumInactivityDays?.message} {...register('maximumInactivityDays')} />
          <div className="md:col-span-2">
            <TextInput label="Prohibited strategies" error={errors.prohibitedStrategies?.message} {...register('prohibitedStrategies')} />
          </div>
          <label className="block text-sm text-muted md:col-span-3">
            <span className="font-medium text-foreground">Custom rules and notes</span>
            <textarea rows="4" {...register('customRules')} className="mt-2 block w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-green-400" />
            {errors.customRules?.message && <span className="mt-2 block text-xs font-medium text-red-300">{errors.customRules.message}</span>}
          </label>
        </div>
      </AdvancedSettingsSection>

      {showFundedSettings && (
        <AdvancedSettingsSection title="Funded-account settings" description="Payout and scaling details for funded accounts.">
          <div className="grid gap-5 md:grid-cols-3">
            <PercentageInput label="Profit split percentage" error={errors.profitSplitPercent?.message} {...register('profitSplitPercent')} />
            <TextInput type="date" label="First payout date" error={errors.firstPayoutDate?.message} {...register('firstPayoutDate')} />
            <SelectInput label="Payout frequency" error={errors.payoutFrequency?.message} {...register('payoutFrequency')}>
              <option value="">Select frequency</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Biweekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ON_DEMAND">On demand</option>
              <option value="CUSTOM">Custom</option>
            </SelectInput>
            <CurrencyInput label="Minimum payout amount" error={errors.minimumPayoutAmount?.message} {...register('minimumPayoutAmount')} />
            <TextInput type="date" label="Payout-cycle start date" error={errors.payoutCycleStartDate?.message} {...register('payoutCycleStartDate')} />
            <ToggleField label="Scaling plan enabled" checked={Boolean(scalingEnabled)} onChange={toggle('scalingPlanEnabled')} />
            {scalingEnabled && (
              <>
                <CurrencyInput label="Next scaling target" error={errors.nextScalingTarget?.message} {...register('nextScalingTarget')} />
                <CurrencyInput label="Maximum allocation" error={errors.maximumAllocation?.message} {...register('maximumAllocation')} />
              </>
            )}
          </div>
        </AdvancedSettingsSection>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm font-medium text-muted hover:bg-surface-muted">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
          {isSaving ? 'Saving...' : 'Save Advanced Settings'}
        </button>
      </div>
    </form>
  );
};

export default PropFirmAdvancedSettings;
