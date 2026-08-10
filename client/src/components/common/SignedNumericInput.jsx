import React, { useState, useEffect } from 'react';

/**
 * SignedNumericInput
 * Mobile-friendly numeric input with an integrated +/- sign toggle button.
 * Enables Android and mobile users to easily toggle negative/positive values
 * even when the mobile soft keyboard does not expose a +/- key.
 */
const SignedNumericInput = ({
  label,
  name,
  register,
  setValue,
  watch,
  step = '0.01',
  placeholder = '0.00',
  disabled = false,
  className = '',
  id,
  error,
}) => {
  const rawValue = watch ? watch(name) : '';
  const strValue = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';

  const isCurrentlyNegative = strValue.startsWith('-');
  const [forceNegative, setForceNegative] = useState(false);

  useEffect(() => {
    if (strValue && strValue !== '-' && strValue !== '-0') {
      setForceNegative(strValue.startsWith('-'));
    }
  }, [strValue]);

  const isNegative = isCurrentlyNegative || (forceNegative && (!strValue || strValue === '0' || strValue === '0.00'));

  const toggleSign = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (!strValue || strValue === '0' || strValue === '0.00') {
      const nextNegative = !forceNegative;
      setForceNegative(nextNegative);
      if (nextNegative) {
        if (setValue) setValue(name, '-0', { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      } else {
        if (setValue) setValue(name, '0', { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      }
      return;
    }

    if (strValue.startsWith('-')) {
      const positiveVal = strValue.substring(1);
      setForceNegative(false);
      if (setValue) setValue(name, positiveVal === '0' || positiveVal === '0.00' ? '0' : positiveVal, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } else {
      setForceNegative(true);
      if (setValue) setValue(name, `-${strValue}`, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
  };

  const registeredField = register ? register(name) : {};

  const handleInputChange = (e) => {
    let val = e.target.value;
    if (forceNegative && val && !val.startsWith('-') && val !== '0' && val !== '0.00') {
      val = `-${val}`;
      e.target.value = val;
      if (setValue) {
        setValue(name, val, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      }
    } else if (registeredField.onChange) {
      registeredField.onChange(e);
    }
  };

  const inputId = id || `signed-input-${name}`;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm text-muted mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center rounded-md shadow-sm">
        <button
          type="button"
          onClick={toggleSign}
          disabled={disabled}
          aria-label={isNegative ? "Set positive value" : "Set negative value"}
          title={isNegative ? "Click to set positive (+)" : "Click to set negative (-)"}
          className={`h-[38px] min-w-[40px] px-3 font-mono font-bold text-base border border-r-0 rounded-l-md transition-all flex items-center justify-center shrink-0 select-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
            isNegative
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isNegative ? '−' : '+'}
        </button>
        <input
          id={inputId}
          type="number"
          step={step}
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          {...registeredField}
          onChange={handleInputChange}
          className="block w-full h-[38px] bg-surface border border-border rounded-r-md py-2 px-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-green-500 text-sm font-medium"
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
};

export default SignedNumericInput;
