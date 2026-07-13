import React from 'react';
import { useForm } from 'react-hook-form';
import { CurrencyInput, PercentageInput, SelectInput, TextInput } from './FormControls';

const defaultValues = {
  name: '',
  brokerName: '',
  accountType: 'DEMO',
  startingBalance: '',
  currentBalance: '',
  currency: 'USD',
  platform: '',
  riskPerTradePercent: '',
  maxDailyLossPercent: '',
  maxTradesPerDay: '',
  maxLossesPerDay: '',
  notes: '',
};

const RegularAccountForm = ({ initialValues, isSaving, onSubmit, onCancel, submitLabel = 'Save Account' }) => {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      ...defaultValues,
      ...(initialValues || {}),
    },
    values: {
      ...defaultValues,
      ...(initialValues || {}),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextInput label="Account name" required {...register('name')} placeholder="Main broker account" />
        </div>
        <TextInput label="Broker name" {...register('brokerName')} placeholder="IC Markets, OANDA, Exness" />
        <SelectInput label="Account type" {...register('accountType')}>
          <option value="DEMO">Demo</option>
          <option value="PERSONAL_LIVE">Personal live</option>
          <option value="PRACTICE">Practice</option>
          <option value="BROKER_FUNDED">Broker-funded</option>
          <option value="OTHER">Other</option>
        </SelectInput>
        <CurrencyInput label="Starting balance" required {...register('startingBalance')} placeholder="1000" />
        <CurrencyInput label="Current balance" {...register('currentBalance')} placeholder="Leave empty if it matches your starting balance" />
        <SelectInput label="Currency" {...register('currency')}>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="NGN">NGN</option>
        </SelectInput>
        <SelectInput label="Trading platform" {...register('platform')}>
          <option value="">Select platform</option>
          <option value="MT4">MT4</option>
          <option value="MT5">MT5</option>
          <option value="CTRADER">cTrader</option>
          <option value="MATCH_TRADER">Match-Trader</option>
          <option value="TRADELOCKER">TradeLocker</option>
          <option value="DXTRADE">DXtrade</option>
          <option value="RITHMIC">Rithmic</option>
          <option value="NINJATRADER">NinjaTrader</option>
          <option value="OTHER">Other</option>
        </SelectInput>
        <PercentageInput label="Default risk per trade percentage" {...register('riskPerTradePercent')} placeholder="1" />
        <PercentageInput label="Maximum daily loss percentage" {...register('maxDailyLossPercent')} placeholder="3" />
        <TextInput type="number" min="0" label="Maximum trades per day" {...register('maxTradesPerDay')} />
        <TextInput type="number" min="0" label="Maximum losses per day" {...register('maxLossesPerDay')} />
        <div className="md:col-span-2">
          <label className="block text-sm text-muted">
            <span className="font-medium text-foreground">Notes</span>
            <textarea rows="4" {...register('notes')} className="mt-2 block w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-green-400" />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-muted hover:bg-surface-muted">Go Back</button>
        <button type="submit" disabled={isSaving} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
          {isSaving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default RegularAccountForm;
