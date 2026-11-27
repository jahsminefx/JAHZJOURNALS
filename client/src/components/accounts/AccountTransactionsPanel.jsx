import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  ArchiveX,
  ArrowUpDown,
  CheckCircle2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import CustomSelect from '../common/CustomSelect';
import { dialog } from '../common/dialog';
import { formatCurrency } from '../../utils/dashboard';
import { invalidateCache } from '../../utils/apiCache';
import { TRANSACTION_TYPE_META } from '../../utils/accountTransactions';
import RecordTransactionModal from './RecordTransactionModal';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'OPENING_BALANCE', label: 'Opening balance' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAWAL', label: 'Withdrawal' },
  { value: 'PAYOUT', label: 'Payout' },
  { value: 'FEE', label: 'Fee' },
  { value: 'ADJUSTMENT', label: 'Balance adjustment' },
];

const formatDateTime = (value) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
};

const AccountTransactionsPanel = ({
  id = 'account-transactions',
  account,
  onUpdated,
  externalModalSignal = 0,
}) => {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(account?.ledgerSummary || null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  const currency = account?.currency || 'USD';

  const fetchTransactions = useCallback(async () => {
    if (!account?.id) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/accounts/${account.id}/transactions`, {
        params: {
          ...(typeFilter ? { type: typeFilter } : {}),
          includeArchived: includeArchived ? 'true' : 'false',
        },
      });
      setTransactions(data.transactions || []);
      setSummary((prev) => data.summary || prev || null);
    } catch (error) {
      if (error.response?.status !== 503) {
        toast.error(error.response?.data?.message || 'Unable to load account transactions.');
      }
    } finally {
      setLoading(false);
    }
  }, [account?.id, includeArchived, typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (externalModalSignal > 0) {
      setEditingTx(null);
      setModalOpen(true);
    }
  }, [externalModalSignal]);

  const handleArchive = async (tx) => {
    const label = TRANSACTION_TYPE_META[tx.type]?.label || tx.type;
    const confirmed = await dialog.confirm({
      title: `Archive ${label.toLowerCase()}?`,
      message: `Archiving this ${label} (${formatCurrency(tx.signedAmount, tx.currency || currency, { signDisplay: 'always' })}) keeps the entry in audit history while removing its effect from your current balance.`,
      confirmText: 'Archive entry',
      cancelText: 'Keep entry',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const { data } = await api.post(`/accounts/${account.id}/transactions/${tx.id}/archive`, {});
      setSummary(data.summary || null);
      toast.success('Transaction archived and account balance reconciled.');
      invalidateCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('jahzjournal:data-changed'));
      }
      fetchTransactions();
      onUpdated?.(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to archive that transaction.');
    }
  };

  const handleConfirmPayout = async (tx) => {
    const confirmed = await dialog.confirm({
      title: 'Classify synced withdrawal as prop-firm payout?',
      message: `Confirming reclassifies this MetaTrader-synced outflow (${formatCurrency(tx.signedAmount, tx.currency || currency, { signDisplay: 'always' })}) from Withdrawal to Payout in your cash-flow ledger while keeping it read-only and excluded from Trading P&L.`,
      confirmText: 'Mark as Payout',
      cancelText: 'Keep as Withdrawal',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      const { data } = await api.post(`/accounts/${account.id}/transactions/${tx.id}/confirm-payout`, {});
      setSummary(data.summary || null);
      toast.success('Synced withdrawal classified as a prop-firm payout.');
      invalidateCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('jahzjournal:data-changed'));
      }
      fetchTransactions();
      onUpdated?.(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to classify transaction as a payout.');
    }
  };

  const renderSourceAndStatusBadges = (tx, meta, { isOpening, isArchived }) => {
    const isMtSync = tx.source === 'MT_CLOUD_SYNC';
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}>
          {meta.label}
        </span>
        {isMtSync && (
          <span
            title={tx.externalDealId ? `Imported from MetaTrader deal #${tx.externalDealId} (read-only)` : 'Imported from MetaTrader Sync (read-only)'}
            className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
          >
            <Lock size={10} />
            <span>MT Sync · Read-only</span>
          </span>
        )}
        {tx.payoutClassificationStatus === 'VERIFIED_PAYOUT_MATCH' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={10} />
            <span>Verified Payout</span>
          </span>
        )}
        {tx.payoutClassificationStatus === 'USER_CONFIRMED_PAYOUT' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={10} />
            <span>Confirmed Payout</span>
          </span>
        )}
        {tx.editedAt && !isArchived && tx.payoutClassificationStatus !== 'USER_CONFIRMED_PAYOUT' && (
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted border border-border">
            Edited
          </span>
        )}
        {isArchived && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20">
            Archived
          </span>
        )}
        {!isMtSync && isOpening && (
          <span className="sr-only">Opening balance baseline</span>
        )}
      </div>
    );
  };

  const renderTransactionActions = (tx, { isOpening, isArchived, compact = false }) => {
    const isReadOnly = Boolean(tx.isReadOnly || isOpening || tx.source === 'MT_CLOUD_SYNC');
    if (isArchived) {
      return compact ? null : <span className="text-[11px] text-muted">Archived</span>;
    }

    if (isReadOnly) {
      const canConfirm = Boolean(tx.canConfirmAsPayout);
      if (!canConfirm && compact) {
        return (
          <div className="flex items-center justify-end border-t border-border/60 pt-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Lock size={11} />
              <span>{tx.source === 'MT_CLOUD_SYNC' ? 'Synced read-only' : 'Baseline'}</span>
            </span>
          </div>
        );
      }

      return (
        <div className={compact ? 'flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2' : 'inline-flex items-center gap-2'}>
          {canConfirm && (
            <button
              type="button"
              onClick={() => handleConfirmPayout(tx)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <CheckCircle2 size={12} />
              <span>Mark as Payout</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Lock size={11} />
            <span>{tx.source === 'MT_CLOUD_SYNC' ? 'Read-only' : 'Baseline'}</span>
          </span>
        </div>
      );
    }

    return (
      <div className={compact ? 'flex items-center justify-end gap-2 border-t border-border/60 pt-2' : 'inline-flex items-center gap-2'}>
        <button
          type="button"
          onClick={() => {
            setEditingTx(tx);
            setModalOpen(true);
          }}
          className={`inline-flex items-center gap-1 rounded-lg border border-border text-[11px] font-semibold transition ${
            compact
              ? 'px-3 py-1.5 text-foreground hover:bg-surface-muted'
              : 'px-2.5 py-1 text-muted hover:text-foreground hover:bg-surface-muted'
          }`}
          aria-label="Edit transaction"
        >
          <Pencil size={12} />
          <span>Edit</span>
        </button>
        <button
          type="button"
          onClick={() => handleArchive(tx)}
          className={`inline-flex items-center gap-1 rounded-lg border border-border text-[11px] font-semibold transition ${
            compact
              ? 'px-3 py-1.5 text-rose-600 dark:text-rose-300'
              : 'px-2.5 py-1 text-muted hover:text-rose-600 dark:hover:text-rose-300 hover:border-rose-500/30'
          }`}
          aria-label="Archive transaction"
        >
          <Archive size={12} />
          <span>Archive</span>
        </button>
      </div>
    );
  };

  const activeSummary = summary || account?.ledgerSummary || {
    openingBalance: Number(account?.startingBalance || 0),
    realisedTradingPnl: 0,
    netCashFlow: 0,
    netAccountChange: 0,
    accountBalance: Number(account?.currentBalance || 0),
    deposits: 0,
    withdrawals: 0,
    payouts: 0,
    fees: 0,
    adjustments: 0,
  };

  return (
    <section id={id} className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ArrowUpDown size={18} className="text-emerald-500" />
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Account Transactions &amp; Cash Flow
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted">
            Explicit ledger for deposits, withdrawals, payouts, fees, and adjustments. Trading P&amp;L stays separate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-xs"
          >
            <Plus size={15} />
            <span>Record transaction</span>
          </button>
          <button
            type="button"
            onClick={fetchTransactions}
            aria-label="Refresh transactions"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Ledger Summary Breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Opening Balance</p>
          <p className="mt-1.5 font-mono text-sm sm:text-base font-bold text-foreground">
            {formatCurrency(activeSummary.openingBalance, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Trading P&amp;L</p>
          <p className={`mt-1.5 font-mono text-sm sm:text-base font-bold ${
            activeSummary.realisedTradingPnl > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : activeSummary.realisedTradingPnl < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-foreground'
          }`}>
            {formatCurrency(activeSummary.realisedTradingPnl, currency, {
              signDisplay: activeSummary.realisedTradingPnl === 0 ? 'auto' : 'always',
            })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Net Cash Flow</p>
          <p className={`mt-1.5 font-mono text-sm sm:text-base font-bold ${
            activeSummary.netCashFlow > 0
              ? 'text-sky-600 dark:text-sky-300'
              : activeSummary.netCashFlow < 0
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-foreground'
          }`}>
            {formatCurrency(activeSummary.netCashFlow, currency, {
              signDisplay: activeSummary.netCashFlow === 0 ? 'auto' : 'always',
            })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Net Account Change</p>
          <p className={`mt-1.5 font-mono text-sm sm:text-base font-bold ${
            activeSummary.netAccountChange > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : activeSummary.netAccountChange < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-foreground'
          }`}>
            {formatCurrency(activeSummary.netAccountChange, currency, {
              signDisplay: activeSummary.netAccountChange === 0 ? 'auto' : 'always',
            })}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Account Balance</p>
          <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-foreground">
            {formatCurrency(activeSummary.accountBalance ?? account.currentBalance, currency)}
          </p>
        </div>
      </div>

      {/* Category Totals + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1">
            Deposits: <strong className="font-mono text-foreground">{formatCurrency(activeSummary.deposits, currency)}</strong>
          </span>
          <span className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1">
            Withdrawals: <strong className="font-mono text-foreground">{formatCurrency(activeSummary.withdrawals, currency)}</strong>
          </span>
          <span className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1">
            Payouts: <strong className="font-mono text-foreground">{formatCurrency(activeSummary.payouts, currency)}</strong>
          </span>
          <span className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1">
            Fees: <strong className="font-mono text-foreground">{formatCurrency(activeSummary.fees, currency)}</strong>
          </span>
          <span className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-1">
            Adjustments:{' '}
            <strong className="font-mono text-foreground">
              {formatCurrency(activeSummary.adjustments, currency, {
                signDisplay: activeSummary.adjustments === 0 ? 'auto' : 'always',
              })}
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <CustomSelect
              id="tx-history-type-filter"
              aria-label="Filter transactions by type"
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={TYPE_FILTER_OPTIONS}
            />
          </div>
          <button
            type="button"
            onClick={() => setIncludeArchived((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              includeArchived
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-surface text-muted hover:text-foreground'
            }`}
          >
            <ArchiveX size={14} />
            <span>{includeArchived ? 'Showing archived' : 'Show archived'}</span>
          </button>
        </div>
      </div>

      {/* Transaction History */}
      {loading ? (
        <div className="rounded-xl border border-border bg-surface-muted/30 p-8 text-center text-xs text-muted">
          Loading ledger history...
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/20 p-8 text-center">
          <p className="text-sm font-bold text-foreground">No cash-flow transactions recorded yet</p>
          <p className="mt-1 text-xs text-muted">
            Record a deposit, withdrawal, payout, fee, or balance adjustment to maintain an auditable balance ledger.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/60 text-[10px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Note</th>
                  <th className="py-3 px-4 text-right">Resulting Balance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {transactions.map((tx) => {
                  const meta = TRANSACTION_TYPE_META[tx.type] || {
                    label: tx.type,
                    badgeClass: 'bg-surface-muted text-muted border-border',
                  };
                  const isArchived = Boolean(tx.archivedAt);
                  const isOpening = tx.type === 'OPENING_BALANCE';
                  const signedVal = Number(tx.signedAmount || 0);

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isArchived ? 'opacity-60 bg-surface-muted/30' : 'hover:bg-surface-muted/30'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-muted whitespace-nowrap">
                        {formatDateTime(tx.occurredAt)}
                      </td>
                      <td className="py-3 px-4">
                        {renderSourceAndStatusBadges(tx, meta, { isOpening, isArchived })}
                      </td>
                      <td className={`py-3 px-4 font-mono font-bold whitespace-nowrap ${
                        signedVal > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : signedVal < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-foreground'
                      }`}>
                        {formatCurrency(signedVal, tx.currency || currency, { signDisplay: 'always' })}
                      </td>
                      <td className="py-3 px-4 text-muted max-w-xs truncate" title={tx.note || ''}>
                        {tx.note || <span className="italic opacity-60">No note</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                        {tx.resultingBalance !== null && tx.resultingBalance !== undefined
                          ? formatCurrency(tx.resultingBalance, tx.currency || currency)
                          : '--'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {renderTransactionActions(tx, { isOpening, isArchived, compact: false })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="space-y-3 md:hidden">
            {transactions.map((tx) => {
              const meta = TRANSACTION_TYPE_META[tx.type] || {
                label: tx.type,
                badgeClass: 'bg-surface-muted text-muted border-border',
              };
              const isArchived = Boolean(tx.archivedAt);
              const isOpening = tx.type === 'OPENING_BALANCE';
              const signedVal = Number(tx.signedAmount || 0);

              return (
                <div
                  key={tx.id}
                  className={`rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2.5 text-xs ${
                    isArchived ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      {renderSourceAndStatusBadges(tx, meta, { isOpening, isArchived })}
                      <p className="font-mono text-[11px] text-muted">{formatDateTime(tx.occurredAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-bold ${
                        signedVal > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : signedVal < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-foreground'
                      }`}>
                        {formatCurrency(signedVal, tx.currency || currency, { signDisplay: 'always' })}
                      </p>
                      <p className="font-mono text-[11px] text-muted">
                        Bal:{' '}
                        {tx.resultingBalance !== null && tx.resultingBalance !== undefined
                          ? formatCurrency(tx.resultingBalance, tx.currency || currency)
                          : '--'}
                      </p>
                    </div>
                  </div>

                  {tx.note && (
                    <p className="rounded-lg bg-surface p-2.5 text-xs text-muted border border-border/60">
                      {tx.note}
                    </p>
                  )}

                  {renderTransactionActions(tx, { isOpening, isArchived, compact: true })}
                </div>
              );
            })}
          </div>
        </>
      )}

      <RecordTransactionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
        fixedAccount={account}
        editTransaction={editingTx}
        onSuccess={(data) => {
          fetchTransactions();
          onUpdated?.(data);
        }}
      />
    </section>
  );
};

export default AccountTransactionsPanel;
