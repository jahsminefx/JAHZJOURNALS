import React, { useState } from 'react';
import { SelectInput } from './FormControls';

const propFirmTemplates = {
  blank: {
    label: 'Start from blank',
    summary: ['No rules are prefilled.'],
    values: {},
  },
  genericOneStep: {
    label: 'Generic one-step template',
    summary: ['Phase 1 target: 10%', 'Daily loss: 4%', 'Maximum loss: 6%', 'Time limit: Unlimited'],
    values: {
      evaluationType: 'ONE_STEP',
      phaseCount: 1,
      phases: [{ name: 'Phase 1', profitTargetPercent: '10', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' }],
      dailyLossPercent: '4',
      maximumLossPercent: '6',
      drawdownType: 'STATIC',
    },
  },
  genericTwoStep: {
    label: 'Generic two-step template',
    summary: ['Phase 1 target: 8%', 'Phase 2 target: 5%', 'Daily loss: 5%', 'Maximum loss: 10%', 'Time limit: Unlimited'],
    values: {
      evaluationType: 'TWO_STEP',
      phaseCount: 2,
      phases: [
        { name: 'Phase 1', profitTargetPercent: '8', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
        { name: 'Phase 2', profitTargetPercent: '5', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
      ],
      dailyLossPercent: '5',
      maximumLossPercent: '10',
      drawdownType: 'STATIC',
    },
  },
  genericThreeStep: {
    label: 'Generic three-step template',
    summary: ['Phase 1 target: 6%', 'Phase 2 target: 5%', 'Phase 3 target: 4%', 'Daily loss: 5%', 'Maximum loss: 10%', 'Time limit: Unlimited'],
    values: {
      evaluationType: 'THREE_STEP',
      phaseCount: 3,
      phases: [
        { name: 'Phase 1', profitTargetPercent: '6', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
        { name: 'Phase 2', profitTargetPercent: '5', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
        { name: 'Phase 3', profitTargetPercent: '4', minimumTradingDays: '0', timeLimitType: 'UNLIMITED', timeLimitDays: '' },
      ],
      dailyLossPercent: '5',
      maximumLossPercent: '10',
      drawdownType: 'STATIC',
    },
  },
  instantFunded: {
    label: 'Instant-funded template',
    summary: ['No evaluation phases', 'Daily loss: 5%', 'Maximum loss: 10%', 'Drawdown: Static'],
    values: {
      evaluationType: 'INSTANT_FUNDED',
      phaseCount: 0,
      phases: [],
      dailyLossPercent: '5',
      maximumLossPercent: '10',
      drawdownType: 'STATIC',
    },
  },
  savedUser: {
    label: 'Saved user template',
    summary: ['Saved templates are not available yet.'],
    values: null,
  },
};

const TemplateSelector = ({ onApply }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const template = propFirmTemplates[selectedTemplate];
  const canApply = Boolean(template?.values);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <SelectInput label="Start from" value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}>
        {Object.entries(propFirmTemplates).map(([key, item]) => (
          <option key={key} value={key}>{item.label}</option>
        ))}
      </SelectInput>

      {template && (
        <div className="mt-4 rounded-lg border border-border bg-surface-muted p-4">
          <p className="font-semibold text-foreground">{template.label}</p>
          <div className="mt-2 space-y-1 text-sm text-muted">
            {template.summary.map((line) => <p key={line}>{line}</p>)}
          </div>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => onApply(template.values)}
            className="mt-4 rounded-lg border border-green-500/50 px-4 py-2 text-sm font-bold text-green-300 transition hover:bg-green-500/10 disabled:cursor-not-allowed disabled:border-border disabled:text-gray-500"
          >
            Apply template
          </button>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
