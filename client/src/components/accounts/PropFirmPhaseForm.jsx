import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { CurrencyInput, PercentageInput, SelectInput, TextInput } from './FormControls';

const PropFirmPhaseForm = ({ phase, index, canMoveUp, canMoveDown, onChange, onRemove, onMove }) => {
  const update = (field, value) => onChange(index, { ...phase, [field]: value });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">Phase {phase.phaseNumber || index + 1}</h3>
          <p className="text-sm text-muted">Enter exact rules from the official programme agreement.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={!canMoveUp} onClick={() => onMove(index, -1)} className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted disabled:opacity-40">
            <ArrowUp size={16} />
          </button>
          <button type="button" disabled={!canMoveDown} onClick={() => onMove(index, 1)} className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted disabled:opacity-40">
            <ArrowDown size={16} />
          </button>
          <button type="button" onClick={() => onRemove(index)} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <TextInput label="Phase number" type="number" min="1" value={phase.phaseNumber} onChange={(event) => update('phaseNumber', event.target.value)} />
        <TextInput label="Phase name" value={phase.name} onChange={(event) => update('name', event.target.value)} />
        <SelectInput label="Phase status" value={phase.status} onChange={(event) => update('status', event.target.value)}>
          <option value="NOT_STARTED">Not started</option>
          <option value="ACTIVE">Active</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="RESET">Reset</option>
        </SelectInput>
        <PercentageInput label="Profit target percentage" value={phase.profitTargetPercent} onChange={(event) => update('profitTargetPercent', event.target.value)} />
        <CurrencyInput label="Profit target amount" value={phase.profitTargetAmount} onChange={(event) => update('profitTargetAmount', event.target.value)} />
        <TextInput label="Minimum trading days" type="number" min="0" value={phase.minimumTradingDays} onChange={(event) => update('minimumTradingDays', event.target.value)} />
        <TextInput label="Minimum profitable days" type="number" min="0" value={phase.minimumProfitableDays} onChange={(event) => update('minimumProfitableDays', event.target.value)} />
        <TextInput label="Maximum trading days" type="number" min="0" value={phase.maximumTradingDays} onChange={(event) => update('maximumTradingDays', event.target.value)} />
        <SelectInput label="Time-limit type" value={phase.timeLimitType} onChange={(event) => update('timeLimitType', event.target.value)}>
          <option value="">Select limit</option>
          <option value="UNLIMITED">Unlimited</option>
          <option value="CALENDAR_DAYS">Calendar days</option>
          <option value="TRADING_DAYS">Trading days</option>
        </SelectInput>
        <TextInput label="Time-limit days" type="number" min="0" value={phase.timeLimitDays} onChange={(event) => update('timeLimitDays', event.target.value)} />
      </div>
    </div>
  );
};

export default PropFirmPhaseForm;
