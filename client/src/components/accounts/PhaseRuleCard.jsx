import React from 'react';
import CurrencyDisplay from './CurrencyDisplay';
import TimeLimitFields from './TimeLimitFields';
import { PercentageInput, TextInput } from './FormControls';

const PhaseRuleCard = ({ index, accountSize, currency, register, watch, errors = {} }) => {
  const baseName = `phases.${index}`;
  const targetPercent = Number(watch(`${baseName}.profitTargetPercent`) || 0);
  const targetAmount = Number(accountSize || 0) * (targetPercent / 100);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-400">Phase {index + 1}</p>
          <h3 className="mt-1 font-bold text-foreground">Rules and target</h3>
        </div>
        <p className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
          Target amount: <CurrencyDisplay value={targetAmount} currency={currency} />
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TextInput label="Phase name" error={errors.name?.message} {...register(`${baseName}.name`)} />
        <PercentageInput label="Profit target percentage" error={errors.profitTargetPercent?.message} {...register(`${baseName}.profitTargetPercent`)} />
        <TextInput type="number" min="0" label="Minimum trading days" error={errors.minimumTradingDays?.message} {...register(`${baseName}.minimumTradingDays`)} />
        <TimeLimitFields baseName={baseName} register={register} watch={watch} errors={errors} />
      </div>

      {targetPercent > 0 && (
        <p className="mt-4 text-sm text-muted">
          Account size: <CurrencyDisplay value={accountSize} currency={currency} />. Profit target: {targetPercent}%. Target amount: <CurrencyDisplay value={targetAmount} currency={currency} />.
        </p>
      )}
    </div>
  );
};

export default PhaseRuleCard;
