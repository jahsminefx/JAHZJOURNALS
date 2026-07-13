import React from 'react';

const fieldClass = 'mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60';

export const Field = ({ label, description, error, children }) => (
  <label className="block text-sm text-muted">
    <span className="font-medium text-foreground">{label}</span>
    {description && <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>}
    {children}
    {error && <span className="mt-2 block text-xs font-medium text-red-300">{error}</span>}
  </label>
);

export const TextInput = React.forwardRef(({ label, description, error, ...props }, ref) => (
  <Field label={label} description={description} error={error}>
    <input ref={ref} {...props} className={`${fieldClass} ${error ? 'border-red-400 focus:border-red-300' : ''}`} />
  </Field>
));

TextInput.displayName = 'TextInput';

export const SelectInput = React.forwardRef(({ label, description, error, children, ...props }, ref) => (
  <Field label={label} description={description} error={error}>
    <select ref={ref} {...props} className={`${fieldClass} ${error ? 'border-red-400 focus:border-red-300' : ''}`}>
      {children}
    </select>
  </Field>
));

SelectInput.displayName = 'SelectInput';

export const CurrencyInput = React.forwardRef(({ label, description, ...props }, ref) => (
  <TextInput ref={ref} type="number" step="0.01" label={label} description={description} {...props} />
));

CurrencyInput.displayName = 'CurrencyInput';

export const PercentageInput = React.forwardRef(({ label, description, ...props }, ref) => (
  <TextInput ref={ref} type="number" min="0" max="100" step="0.1" label={label} description={description} {...props} />
));

PercentageInput.displayName = 'PercentageInput';

export const TimezoneSelect = React.forwardRef(({ label = 'Timezone', ...props }, ref) => (
  <SelectInput ref={ref} label={label} {...props}>
    <option value="">Select timezone</option>
    <option value="Africa/Lagos">Africa/Lagos</option>
    <option value="UTC">UTC</option>
    <option value="Europe/London">Europe/London</option>
    <option value="America/New_York">America/New_York</option>
    <option value="Asia/Dubai">Asia/Dubai</option>
  </SelectInput>
));

TimezoneSelect.displayName = 'TimezoneSelect';

export const ToggleField = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-foreground/20"
  >
    <span>
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {description && <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>}
    </span>
    <span className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-green-500' : 'bg-gray-700'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

export const FormNavigationButtons = ({ currentStep, totalSteps, saving, onBack, onNext, onSubmit, submitLabel = 'Save Prop-Firm Account' }) => (
  <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
    <button
      type="button"
      onClick={onBack}
      disabled={currentStep === 0 || saving}
      className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      Back
    </button>
    {currentStep < totalSteps - 1 ? (
      <button
        type="button"
        onClick={onNext}
        disabled={saving}
        className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:opacity-70"
      >
        Continue
      </button>
    ) : (
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:opacity-70"
      >
        {saving ? 'Saving...' : submitLabel}
      </button>
    )}
  </div>
);
