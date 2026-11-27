import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  DollarSign,
  Info,
  Receipt,
  SlidersHorizontal,
  Wallet,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import CustomSelect from '../common/CustomSelect';
import { dialog } from '../common/dialog';
import { formatCurrency } from '../../utils/dashboard';
import { invalidateCache } from '../../utils/apiCache';
import { TRANSACTION_TYPE_META } from '../../utils/accountTransactions';

const CREATABLE_TYPE_OPTIONS = [
  { value: 'DEPOSIT', label: 'Deposit', icon: ArrowDownLeft, badge: '+ Balance' },
  { value: 'WITHDRAWAL', label: 'Withdrawal', icon: ArrowUpRight, badge: '− Balance' },
  { value: 'PAYOUT', label: 'Payout', icon: DollarSign, badge: 'Prop cash-out' },
  { value: 'FEE', label: 'Fee', icon: Receipt, badge: '− Balance' },
  { value: 'ADJUSTMENT', label: 'Balance adjustment', icon: SlidersHorizontal, badge: '+ / −' },
];

const toLocalDateTimeInput = (value) => {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n) => String(n).padStart(2, '0');
  return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}T${pad(safe.getHours())}:${pad(safe.getMinutes())}`;
};

const generateIdempotencyKey = () => `acct_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const EMPTY_ACCOUNTS = [];

const RecordTransactionModal = ({
  isOpen,
  onClose,
  onSuccess,
  accounts = EMPTY_ACCOUNTS,
  fixedAccount = null,
  defaultAccountId = '',
  editTransaction = null,
}) => {
  const isEditMode = Boolean(editTransaction?.id);

  const availableAccounts = useMemo(() => {
    if (fixedAccount?.id) return [fixedAccount];
    return Array.isArray(accounts) ? accounts : EMPTY_ACCOUNTS;
  }, [accounts, fixedAccount]);

  const resolveInitialAccountId = useCallback(() => {
    if (editTransaction?.tradingAccountId) return editTransaction.tradingAccountId;
    if (fixedAccount?.id) return fixedAccount.id;
    if (defaultAccountId && availableAccounts.some((acc) => acc.id === defaultAccountId)) {
      return defaultAccountId;
    }
    return availableAccounts[0]?.id || '';
  }, [availableAccounts, defaultAccountId, editTransaction?.tradingAccountId, fixedAccount?.id]);

  const [selectedAccountId, setSelectedAccountId] = useState(resolveInitialAccountId);
  const [type, setType] = useState('DEPOSIT');
  const [adjustmentDirection, setAdjustmentDirection] = useState('INFLOW');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const idempotencyKeyRef = useRef(generateIdempotencyKey());
  const initializedSessionRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const sessionKey = `${editTransaction?.id || 'create'}::${fixedAccount?.id || defaultAccountId || ''}`;
    if (initializedSessionRef.current === sessionKey) {
      return;
    }
    initializedSessionRef.current = sessionKey;

    if (editTransaction?.id) {
      setSelectedAccountId(editTransaction.tradingAccountId || fixedAccount?.id || '');
      setType(editTransaction.type || 'DEPOSIT');
      setAdjustmentDirection(editTransaction.direction || 'INFLOW');
      setAmount(
        editTransaction.amount !== undefined && editTransaction.amount !== null
          ? String(Math.abs(Number(editTransaction.amount)))
          : ''
      );
      setOccurredAt(toLocalDateTimeInput(editTransaction.occurredAt || new Date()));
      setNote(editTransaction.note || '');
    } else {
      setSelectedAccountId(resolveInitialAccountId());
      setType('DEPOSIT');
      setAdjustmentDirection('INFLOW');
      setAmount('');
      setOccurredAt(toLocalDateTimeInput(new Date()));
      setNote('');
    }
    setErrorMsg('');
    idempotencyKeyRef.current = generateIdempotencyKey();
  }, [isOpen, editTransaction, fixedAccount?.id, defaultAccountId, resolveInitialAccountId]);

  useEffect(() => {
    if (isOpen && !isEditMode && !selectedAccountId && availableAccounts.length > 0) {
      setSelectedAccountId(resolveInitialAccountId());
    }
  }, [isOpen, isEditMode, selectedAccountId, availableAccounts.length, resolveInitialAccountId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, submitting, onClose]);

  const activeAccount = useMemo(() => {
    if (fixedAccount?.id && fixedAccount.id === selectedAccountId) return fixedAccount;
    return availableAccounts.find((acc) => acc.id === selectedAccountId) || fixedAccount || null;
  }, [availableAccounts, fixedAccount, selectedAccountId]);

  const accountCurrency = activeAccount?.currency || editTransaction?.currency || 'USD';
  const currentBalance = Number(activeAccount?.currentBalance ?? 0);

  const effectiveDirection = useMemo(() => {
    if (type === 'DEPOSIT') return 'INFLOW';
    if (type === 'ADJUSTMENT') return adjustmentDirection === 'OUTFLOW' ? 'OUTFLOW' : 'INFLOW';
    return 'OUTFLOW';
  }, [adjustmentDirection, type]);

  const numericAmount = useMemo(() => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return Math.round(num * 100) / 100;
  }, [amount]);

  const signedDelta = useMemo(() => {
    if (!numericAmount) return 0;
    const newDelta = effectiveDirection === 'OUTFLOW' ? -numericAmount : numericAmount;
    if (isEditMode && editTransaction) {
      const oldSigned = Number(editTransaction.signedAmount ?? 0);
      return Math.round((newDelta - oldSigned) * 100) / 100;
    }
    return newDelta;
  }, [editTransaction, effectiveDirection, isEditMode, numericAmount]);

  const projectedBalance = Math.round((currentBalance + signedDelta) * 100) / 100;
  const cashFlowChangeDisplay = effectiveDirection === 'OUTFLOW' ? -numericAmount : numericAmount;

  const accountOptions = useMemo(() => (
    availableAccounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
      badge: `${formatCurrency(acc.currentBalance || 0, acc.currency || 'USD')}`,
      icon: Wallet,
    }))
  ), [availableAccounts]);

  if (!isOpen) return null;

  const handleAmountChange = (e) => {
    const raw = e.target.value;
    // Disallow leading minus sign to avoid ambiguous negative entry in Adjustment or Outflow types
    if (raw.includes('-')) return;
    setAmount(raw);
    if (!isEditMode) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const targetAccountId = activeAccount?.id || selectedAccountId;
    if (!targetAccountId) {
      setErrorMsg('Please select a trading account.');
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Please enter an amount greater than zero.');
      return;
    }

    const parsedDate = new Date(occurredAt);
    if (!occurredAt || Number.isNaN(parsedDate.getTime())) {
      setErrorMsg('Please provide a valid transaction date and time.');
      return;
    }

    const needsConfirmation = isEditMode
      || type === 'WITHDRAWAL'
      || type === 'PAYOUT'
      || type === 'FEE'
      || type === 'ADJUSTMENT';

    if (needsConfirmation) {
      const typeLabel = TRANSACTION_TYPE_META[type]?.label || type;
      const actionVerb = isEditMode ? 'Update' : 'Confirm';
      const impactText = formatCurrency(cashFlowChangeDisplay, accountCurrency, { signDisplay: 'always' });
      const confirmed = await dialog.confirm({
        title: `${actionVerb} ${typeLabel.toLowerCase()}?`,
        message: `${activeAccount?.name || 'Trading account'}: record a ${typeLabel} of ${impactText}. Projected account balance will be ${formatCurrency(projectedBalance, accountCurrency)}. Trading P&L remains unchanged.`,
        confirmText: isEditMode ? 'Save changes' : `Record ${typeLabel}`,
        cancelText: 'Review again',
        variant: effectiveDirection === 'OUTFLOW' || type === 'ADJUSTMENT' ? 'warning' : 'primary',
      });
      if (!confirmed) return;
    }

    try {
      setSubmitting(true);
      const payload = {
        type,
        amount: numericAmount,
        ...(type === 'ADJUSTMENT' ? { direction: effectiveDirection } : {}),
        currency: accountCurrency,
        occurredAt: parsedDate.toISOString(),
        note: note.trim() ? note.trim() : null,
      };

      let responseData;
      if (isEditMode) {
        const { data } = await api.put(
          `/accounts/${targetAccountId}/transactions/${editTransaction.id}`,
          payload,
        );
        responseData = data;
        toast.success('Transaction updated and account balance reconciled.');
      } else {
        const { data } = await api.post(
          `/accounts/${targetAccountId}/transactions`,
          payload,
          {
            headers: {
              'X-Idempotency-Key': idempotencyKeyRef.current,
            },
          },
        );
        responseData = data;
        toast.success(`${TRANSACTION_TYPE_META[type]?.label || 'Transaction'} recorded.`);
      }

      invalidateCache();
      if (typeof window !== 'undefined') {
        try {
          window.localStorage?.setItem('jahzjournal:data-version', String(Date.now()));
        } catch (storageError) {
          console.debug('[AccountTransactions] Could not update data-version:', storageError?.message);
        }
        window.dispatchEvent(new Event('jahzjournal:data-changed'));
      }

      onSuccess?.(responseData);
      onClose?.();
    } catch (error) {
      const serverMsg = error.response?.data?.message || 'Unable to save this account transaction right now.';
      setErrorMsg(serverMsg);
      toast.error(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-slate-950/65 dark:bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-transaction-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Coins size={20} />
            </div>
            <div>
              <h3 id="record-transaction-title" className="text-base sm:text-lg font-black text-foreground">
                {isEditMode ? 'Edit Transaction' : 'Record Transaction'}
              </h3>
              <p className="text-xs text-muted">
                Update account capital separately from closed-trade Trading P&amp;L.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {!fixedAccount && !isEditMode ? (
            <div>
              <label htmlFor="tx-account-select" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Trading Account
              </label>
              <CustomSelect
                id="tx-account-select"
                aria-label="Select trading account"
                value={selectedAccountId}
                onChange={(val) => {
                  setSelectedAccountId(val);
                  idempotencyKeyRef.current = generateIdempotencyKey();
                  setErrorMsg('');
                }}
                options={accountOptions}
                placeholder="Select trading account"
                disabled={availableAccounts.length === 0 || submitting}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2.5 text-xs">
              <span className="font-medium text-muted">Account</span>
              <span className="font-bold text-foreground">
                {activeAccount?.name || 'Selected account'} ({accountCurrency})
              </span>
            </div>
          )}

          <div>
            <label htmlFor="tx-type-select" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
              Transaction Type
            </label>
            <CustomSelect
              id="tx-type-select"
              aria-label="Select transaction type"
              value={type}
              onChange={(val) => {
                setType(val);
                if (!isEditMode) idempotencyKeyRef.current = generateIdempotencyKey();
                setErrorMsg('');
              }}
              options={CREATABLE_TYPE_OPTIONS}
              disabled={submitting}
            />
          </div>

          {type === 'ADJUSTMENT' && (
            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Adjustment Direction
              </span>
              <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Adjustment direction">
                <button
                  type="button"
                  onClick={() => setAdjustmentDirection('INFLOW')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                    adjustmentDirection === 'INFLOW'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'border-border bg-surface-muted/50 text-muted hover:text-foreground'
                  }`}
                >
                  <ArrowDownLeft size={15} />
                  <span>Increase balance (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentDirection('OUTFLOW')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                    adjustmentDirection === 'OUTFLOW'
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30'
                      : 'border-border bg-surface-muted/50 text-muted hover:text-foreground'
                  }`}
                >
                  <ArrowUpRight size={15} />
                  <span>Decrease balance (−)</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="tx-amount-input" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Amount ({accountCurrency})
              </label>
              <input
                id="tx-amount-input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                disabled={submitting}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-mono text-sm font-semibold text-foreground outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Currency
              </span>
              <div className="flex h-[42px] items-center justify-center rounded-xl border border-border bg-surface-muted px-4 font-mono text-xs font-bold text-foreground">
                {accountCurrency}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="tx-occurred-at" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
              Date &amp; Time
            </label>
            <input
              id="tx-occurred-at"
              type="datetime-local"
              required
              value={occurredAt}
              onChange={(e) => {
                setOccurredAt(e.target.value);
                setErrorMsg('');
              }}
              disabled={submitting}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="tx-note-input" className="text-xs font-bold uppercase tracking-wider text-muted">
                Note (Optional)
              </label>
              <span className="text-[11px] text-muted">{note.length}/500</span>
            </div>
            <textarea
              id="tx-note-input"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === 'PAYOUT'
                  ? 'e.g. Monthly funded payout via Rise / Wire'
                  : type === 'FEE'
                  ? 'e.g. Swap / platform / wire fee'
                  : 'Add context or broker reference (optional)'
              }
              disabled={submitting}
              className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Live Impact Preview */}
          <div className="rounded-xl border border-border bg-surface-muted/60 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted">
              <span>Current account balance</span>
              <span className="font-mono font-semibold text-foreground">
                {formatCurrency(currentBalance, accountCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Balance impact ({TRANSACTION_TYPE_META[type]?.label || type})</span>
              <span className={`font-mono font-bold ${
                cashFlowChangeDisplay > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : cashFlowChangeDisplay < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted'
              }`}>
                {numericAmount > 0
                  ? formatCurrency(cashFlowChangeDisplay, accountCurrency, { signDisplay: 'always' })
                  : '--'}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/70 pt-2 font-bold">
              <span className="text-foreground">Projected account balance</span>
              <span className="font-mono text-sm text-foreground">
                {formatCurrency(projectedBalance, accountCurrency)}
              </span>
            </div>
            <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-muted">
              <Info size={13} className="mt-0.5 shrink-0 text-sky-500" />
              <span>
                Trading P&amp;L stays unchanged. Cash movements only affect your account balance, cash flow metrics, and equity trajectory.
              </span>
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !activeAccount}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-60"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                ? 'Save Changes'
                : `Record ${TRANSACTION_TYPE_META[type]?.label || 'Transaction'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordTransactionModal;
