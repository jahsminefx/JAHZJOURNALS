import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, Info, CheckCircle2, HelpCircle, X, AlertCircle } from 'lucide-react';
import { useOverlay } from '../../../context/OverlayContext';

export const DialogOverlay = () => {
  const { dialogState, closeDialog } = useOverlay();
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  // Initialize input value when a prompt opens
  useEffect(() => {
    if (dialogState?.type === 'prompt') {
      setInputValue(dialogState.defaultValue || '');
      setInputError('');
    }
  }, [dialogState?.id, dialogState?.defaultValue, dialogState?.type]);

  // Accessibility: Focus trapping, Escape handling, and Scroll lock
  useEffect(() => {
    if (!dialogState?.isOpen) return undefined;

    // Save active element to restore upon close
    previousActiveElementRef.current = document.activeElement;

    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus priority
    const timer = setTimeout(() => {
      if (dialogState.type === 'prompt' && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (dialogState.variant === 'danger' && cancelButtonRef.current) {
        // For destructive actions, focus Cancel first to prevent accidental confirmation
        cancelButtonRef.current.focus();
      } else if (confirmButtonRef.current) {
        confirmButtonRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Disallow Escape on destructive dialogs unless explicitly permitted
        if (dialogState.variant === 'danger' && !dialogState.allowBackdropDismiss) {
          return;
        }
        event.preventDefault();
        closeDialog(dialogState.type === 'confirm' ? false : null);
        return;
      }

      // Focus trap
      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus to triggering element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [dialogState?.isOpen, dialogState?.id, dialogState?.type, dialogState?.variant, dialogState?.allowBackdropDismiss, closeDialog]);

  if (!dialogState?.isOpen) return null;

  const isDanger = dialogState.variant === 'danger';
  const isWarning = dialogState.variant === 'warning';
  const isPrompt = dialogState.type === 'prompt';
  const isAlert = dialogState.type === 'alert';

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && dialogState.allowBackdropDismiss) {
      closeDialog(dialogState.type === 'confirm' ? false : null);
    }
  };

  const handleConfirm = () => {
    if (isPrompt) {
      if (dialogState.required && (!inputValue || !inputValue.trim())) {
        setInputError('This field is required.');
        inputRef.current?.focus();
        return;
      }
      if (typeof dialogState.validate === 'function') {
        const validationError = dialogState.validate(inputValue);
        if (validationError) {
          setInputError(validationError);
          inputRef.current?.focus();
          return;
        }
      }
      closeDialog(inputValue.trim());
      return;
    }

    if (dialogState.type === 'confirm') {
      closeDialog(true);
      return;
    }

    closeDialog();
  };

  const handleCancel = () => {
    closeDialog(dialogState.type === 'confirm' ? false : null);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && dialogState.inputType !== 'textarea') {
      e.preventDefault();
      handleConfirm();
    }
  };

  // Icon configuration
  const renderIcon = () => {
    if (isDanger) {
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
          <Trash2 size={20} />
        </div>
      );
    }
    if (isWarning) {
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle size={20} />
        </div>
      );
    }
    if (isPrompt) {
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <HelpCircle size={20} />
        </div>
      );
    }
    if (isAlert) {
      if (dialogState.alertType === 'error') {
        return (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertCircle size={20} />
          </div>
        );
      }
      if (dialogState.alertType === 'success') {
        return (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        );
      }
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Info size={20} />
        </div>
      );
    }
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Info size={20} />
      </div>
    );
  };

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 dark:bg-black/75 backdrop-blur-xs transition-opacity duration-200"
      onClick={handleBackdropClick}
      data-testid="dialog-backdrop"
    >
      <div
        ref={dialogRef}
        role={isDanger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="overlay-dialog-title"
        aria-describedby="overlay-dialog-description"
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface text-foreground shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {renderIcon()}
            <div>
              <h2 id="overlay-dialog-title" className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                {dialogState.title}
              </h2>
            </div>
          </div>
          {dialogState.allowBackdropDismiss && (
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {dialogState.message && (
          <div id="overlay-dialog-description" className="mt-4 text-sm leading-relaxed text-muted whitespace-pre-line">
            {dialogState.message}
          </div>
        )}

        {/* Prompt Input Field */}
        {isPrompt && (
          <div className="mt-4 space-y-2">
            {dialogState.inputType === 'textarea' ? (
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (inputError) setInputError('');
                }}
                rows={3}
                placeholder={dialogState.placeholder}
                className={`w-full rounded-xl border bg-surface-muted px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 ${
                  inputError
                    ? 'border-red-500 focus:ring-red-500/20'
                    : 'border-border focus:border-emerald-500 focus:ring-emerald-500/20'
                }`}
              />
            ) : (
              <input
                ref={inputRef}
                type={dialogState.inputType || 'text'}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (inputError) setInputError('');
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={dialogState.placeholder}
                className={`w-full rounded-xl border bg-surface-muted px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 ${
                  inputError
                    ? 'border-red-500 focus:ring-red-500/20'
                    : 'border-border focus:border-emerald-500 focus:ring-emerald-500/20'
                }`}
              />
            )}
            {inputError && (
              <p className="text-xs font-medium text-red-500">{inputError}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
          {(dialogState.type === 'confirm' || isPrompt) && (
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-muted"
            >
              {dialogState.cancelText || 'Cancel'}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            className={`w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] focus:outline-none focus:ring-2 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500/40'
                : isWarning
                ? 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500/40'
                : 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500/40'
            }`}
          >
            {dialogState.confirmText || (isAlert ? 'Close' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default DialogOverlay;
