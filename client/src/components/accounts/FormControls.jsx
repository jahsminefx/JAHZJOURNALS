import React from 'react';

const fieldClass = 'mt-2 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60';

export const Field = ({ label, description, children }) => (
  <label className="block text-sm text-gray-300">
    <span className="font-medium text-gray-200">{label}</span>
    {description && <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>}
    {children}
  </label>
);

export const TextInput = ({ label, description, ...props }) => (
  <Field label={label} description={description}>
    <input {...props} className={fieldClass} />
  </Field>
);

export const SelectInput = ({ label, description, children, ...props }) => (
  <Field label={label} description={description}>
    <select {...props} className={fieldClass}>
      {children}
    </select>
  </Field>
);

export const CurrencyInput = ({ label, description, ...props }) => (
  <TextInput type="number" step="0.01" label={label} description={description} {...props} />
);

export const PercentageInput = ({ label, description, ...props }) => (
  <TextInput type="number" min="0" max="100" step="0.1" label={label} description={description} {...props} />
);

export const TimezoneSelect = ({ label = 'Timezone', ...props }) => (
  <SelectInput label={label} {...props}>
    <option value="">Select timezone</option>
    <option value="Africa/Lagos">Africa/Lagos</option>
    <option value="UTC">UTC</option>
    <option value="Europe/London">Europe/London</option>
    <option value="America/New_York">America/New_York</option>
    <option value="Asia/Dubai">Asia/Dubai</option>
  </SelectInput>
);

export const ToggleField = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-start justify-between gap-4 rounded-xl border border-gray-700 bg-gray-900 p-4 text-left transition hover:border-gray-600"
  >
    <span>
      <span className="block text-sm font-semibold text-gray-100">{label}</span>
      {description && <span className="mt-1 block text-sm leading-6 text-gray-500">{description}</span>}
    </span>
    <span className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-green-500' : 'bg-gray-700'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

export const FormNavigationButtons = ({ currentStep, totalSteps, saving, onBack, onNext, onSubmit, submitLabel = 'Save Prop-Firm Account' }) => (
  <div className="flex flex-col gap-3 border-t border-gray-700 pt-5 sm:flex-row sm:items-center sm:justify-between">
    <button
      type="button"
      onClick={onBack}
      disabled={currentStep === 0 || saving}
      className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
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
