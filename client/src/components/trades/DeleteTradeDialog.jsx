import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const DeleteTradeDialog = ({ trade, isOpen, isDeleting, onCancel, onConfirm }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting, isOpen, onCancel]);

  if (!isOpen || !trade) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-trade-title"
        aria-describedby="delete-trade-description"
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-300">
              <AlertTriangle size={22} />
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              aria-label="Close delete confirmation"
              className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-gray-900 dark:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <h2 id="delete-trade-title" className="text-xl font-bold text-foreground">
              Remove {trade.pair}?
            </h2>
            <p id="delete-trade-description" className="text-sm leading-6 text-muted">
              This will permanently remove this trade, along with its review, emotions, broken rules, and screenshots.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep It
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} />
              {isDeleting ? 'Removing...' : 'Yes, Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteTradeDialog;
