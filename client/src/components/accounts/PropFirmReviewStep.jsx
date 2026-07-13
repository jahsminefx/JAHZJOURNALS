import React from 'react';
import { useWatch, useFormContext } from 'react-hook-form';
import CurrencyDisplay from './CurrencyDisplay';

const enumLabel = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const SummaryCard = ({ title, onEdit, children }) => (
  <section className="rounded-lg border border-border bg-surface p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="font-bold text-foreground">{title}</h3>
      {onEdit && (
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-green-300 hover:text-green-200">
          Edit
        </button>
      )}
    </div>
    <div className="space-y-2 text-sm text-muted">{children}</div>
  </section>
);

const Row = ({ label, children }) => (
  <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <span>{label}</span>
    <span className="font-semibold text-foreground">{children}</span>
  </p>
);

const PropFirmReviewStep = ({ editableStepKeys = ['details', 'challenge'], onEditStep }) => {
  const { control } = useFormContext();
  const form = useWatch({ control });
  const firm = form.firmName === 'OTHER' ? form.customFirmName : form.firmName;
  const canEditDetails = editableStepKeys.includes('details');
  const canEditChallenge = editableStepKeys.includes('challenge');

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100/90">
        Verify these rules against your official prop-firm agreement before saving.
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SummaryCard title="Account details" onEdit={canEditDetails ? () => onEditStep('details') : null}>
          <Row label="Account name">{form.accountName || 'Not set'}</Row>
          <Row label="Prop-firm name">{firm || 'Not set'}</Row>
          <Row label="Programme">{form.programmeName || 'Not set'}</Row>
          <Row label="Account size"><CurrencyDisplay value={form.accountSize} currency={form.currency} /></Row>
          <Row label="Evaluation type">{enumLabel(form.evaluationType)}</Row>
          <Row label="Platform">{enumLabel(form.platform)}</Row>
        </SummaryCard>

        <SummaryCard title="Challenge rules" onEdit={canEditChallenge ? () => onEditStep('challenge') : null}>
          <Row label="Daily loss limit">{form.dailyLossPercent ? `${form.dailyLossPercent}%` : 'Not set'}</Row>
          <Row label="Maximum loss limit">{form.maximumLossPercent ? `${form.maximumLossPercent}%` : 'Not set'}</Row>
          <Row label="Drawdown type">{enumLabel(form.drawdownType)}</Row>
          <Row label="Minimum trading days">
            {(form.phases || []).length > 0 ? (form.phases || []).map((phase) => phase.minimumTradingDays || 0).join(', ') : 'No evaluation phase'}
          </Row>
          <Row label="Time limit">
            {(form.phases || []).length > 0
              ? (form.phases || []).map((phase) => phase.timeLimitType === 'UNLIMITED' ? 'Unlimited' : `${enumLabel(phase.timeLimitType)}: ${phase.timeLimitDays || '?'} days`).join(', ')
              : 'No evaluation phase'}
          </Row>
        </SummaryCard>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-bold text-foreground">Phase targets</h3>
          {canEditChallenge && <button type="button" onClick={() => onEditStep('challenge')} className="text-sm font-semibold text-green-300 hover:text-green-200">Edit</button>}
        </div>
        {(form.phases || []).length === 0 ? (
          <p className="text-sm text-muted">No evaluation phases for this account.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {(form.phases || []).map((phase, index) => {
              const targetAmount = Number(form.accountSize || 0) * (Number(phase.profitTargetPercent || 0) / 100);

              return (
                <div key={`${phase.name}-${index}`} className="rounded-lg border border-border bg-surface-muted p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-400">Phase {index + 1}</p>
                  <h4 className="mt-2 font-bold text-foreground">{phase.name || `Phase ${index + 1}`}</h4>
                  <p className="mt-2 text-sm text-muted">Target: {phase.profitTargetPercent || 0}%</p>
                  <p className="mt-1 text-sm text-muted">Amount: <CurrencyDisplay value={targetAmount} currency={form.currency} /></p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PropFirmReviewStep;
