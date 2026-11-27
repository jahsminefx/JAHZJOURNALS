import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { TextInput, SelectInput, CurrencyInput, PercentageInput } from './FormControls';
import { SUPPORTED_CURRENCIES } from '../../services/currencyConversionService';

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

const RegularAccountForm = ({
  initialValues,
  isEditMode = false,
  accountId = null,
  hasActivity = false,
  isSaving,
  onSubmit,
  onCancel,
  submitLabel = 'Save Account',
}) => {
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

  const displayCurrency = initialValues?.currency || 'USD';
  const displayCurrentBalance = Number(initialValues?.currentBalance ?? initialValues?.startingBalance ?? 0);

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
        <CurrencyInput
          label={isEditMode ? 'Opening balance' : 'Starting balance'}
          required
          disabled={isEditMode && hasActivity}
          description={
            isEditMode && hasActivity
              ? 'Locked once trades or cash-flow entries exist. Record a Balance adjustment in Account Transactions instead.'
              : 'Sets the initial opening balance baseline for this account.'
          }
          {...register('startingBalance')}
          placeholder="1000"
        />
        {isEditMode ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <span className="font-medium text-foreground block">Current balance (Ledger-derived)</span>
            <p className="mt-1.5 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
              {displayCurrentBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Direct balance overwrites are disabled.{' '}
              {accountId && (
                <Link
                  to={`/accounts/${accountId}#account-transactions`}
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Record a Deposit, Withdrawal, Fee, or Balance adjustment
                </Link>
              )}
              .
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <span className="font-medium text-foreground block">Opening ledger baseline</span>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Current balance starts at your Starting balance. Add subsequent deposits, withdrawals, fees, or adjustments from Account Transactions.
            </p>
          </div>
        )}
        <SelectInput label="Currency" {...register('currency')}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol.trim()}) — {c.name}
            </option>
          ))}
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
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-muted">Go Back</button>
        <button type="submit" disabled={isSaving} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
          {isSaving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default RegularAccountForm;
