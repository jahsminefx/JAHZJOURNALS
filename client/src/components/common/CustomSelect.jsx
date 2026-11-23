import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Reusable accessible JAHZJOURNALS Select / Dropdown component
 * Replaces native <select> elements to avoid browser/Android popups.
 */
export const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  disabled = false,
  icon: LeftIcon,
  className = '',
  dropdownClassName = '',
  id,
  name,
  'aria-label': ariaLabel,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxRef = useRef(null);
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  // Normalize options to { value, label, disabled, badge, icon }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value ?? '',
        label: opt.label ?? String(opt.value ?? ''),
        disabled: Boolean(opt.disabled),
        badge: opt.badge,
        icon: opt.icon,
      };
    }
    return {
      value: opt,
      label: String(opt),
      disabled: false,
    };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Close on outside click or touch
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Adjust highlighted index when opening
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = normalizedOptions.findIndex(
        (opt) => String(opt.value) === String(value)
      );
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value]);

  // Keyboard navigation
  const handleKeyDown = (event) => {
    if (disabled) return;

    switch (event.key) {
      case ' ':
      case 'Enter': {
        event.preventDefault();
        if (isOpen) {
          if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
            const opt = normalizedOptions[highlightedIndex];
            if (!opt.disabled) {
              onChange?.(opt.value);
              setIsOpen(false);
              triggerRef.current?.focus();
            }
          }
        } else {
          setIsOpen(true);
        }
        break;
      }
      case 'ArrowDown': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            const next = prev + 1;
            return next < normalizedOptions.length ? next : 0;
          });
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            const next = prev - 1;
            return next >= 0 ? next : normalizedOptions.length - 1;
          });
        }
        break;
      }
      case 'Home': {
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      }
      case 'End': {
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(normalizedOptions.length - 1);
        }
        break;
      }
      case 'Escape': {
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        break;
      }
      case 'Tab': {
        if (isOpen) {
          setIsOpen(false);
        }
        break;
      }
      default:
        break;
    }
  };

  const handleSelectOption = (opt) => {
    if (opt.disabled) return;
    onChange?.(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      {/* Hidden input for standard form submission if name is provided */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value ?? ''}
          required={required}
        />
      )}

      {/* Custom Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel || placeholder}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`flex w-full min-w-0 items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5 sm:py-3 text-left text-sm text-foreground shadow-sm transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-border/80 ${className}`}
      >
        <div className="flex min-w-0 items-center gap-2.5 truncate">
          {LeftIcon && (
            <LeftIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
          )}
          {selectedOption ? (
            <span className="truncate font-medium text-foreground">
              {selectedOption.label}
            </span>
          ) : (
            <span className="truncate text-muted">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ml-2 ${
            isOpen ? 'rotate-180 text-emerald-500' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={selectId}
          tabIndex={-1}
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-center text-xs text-muted">
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt, index) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={`${opt.value}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={() => handleSelectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    opt.disabled
                      ? 'cursor-not-allowed opacity-40'
                      : isSelected
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : isHighlighted
                      ? 'bg-surface-muted text-foreground'
                      : 'text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <opt.icon size={15} className="shrink-0 text-muted" />}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {opt.badge && (
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-muted">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check size={16} className="shrink-0 text-emerald-500" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
