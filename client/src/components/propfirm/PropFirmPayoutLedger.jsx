import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle2, AlertCircle, Plus, ArrowUpRight, ShieldCheck, FileText, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const formatMoney = (value, currency = 'USD') => {
  const num = Number(value || 0);
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const getPayoutStatusBadge = (status) => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'APPROVED':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'UNDER_REVIEW':
    case 'REQUESTED':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default:
      return 'bg-surface-muted text-muted border-border';
  }
};

const PropFirmPayoutLedger = ({ account, compliance, onPayoutUpdated }) => {
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [amountRequested, setAmountRequested] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CRYPTO_USDT');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  const currency = account?.currency || 'USD';
  const propFirm = account?.propFirmAccount || {};
  const isFunded = propFirm.accountStatus === 'FUNDED' || ['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(propFirm.evaluationType);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/accounts/prop-firm/${account.id}/payouts`);
      setPayouts(data.payouts || []);
      setSummary(data.summary || {});
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.id) {
      fetchPayouts();
    }
  }, [account?.id]);

  const splitPercent = summary.profitSplitPercent ?? propFirm.profitSplitPercent ?? 80;
  const currentBalance = compliance?.currentBalance ?? account?.currentBalance ?? 0;
  const startingBalance = account?.startingBalance ?? 0;
  const availableProfit = Math.max(0, currentBalance - startingBalance);

  const numericAmount = Number(amountRequested) || 0;
  const estimatedNet = numericAmount * (splitPercent / 100);

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Enter a valid payout amount.');
      return;
    }

    if (numericAmount > availableProfit) {
      toast.error(`Amount exceeds available profits of ${formatMoney(availableProfit, currency)}.`);
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/accounts/prop-firm/${account.id}/payouts`, {
        amountRequested: numericAmount,
        paymentMethod,
        transactionReference,
        notes,
      });

      toast.success('Payout request submitted successfully!');
      setIsModalOpen(false);
      setAmountRequested('');
      setNotes('');
      setTransactionReference('');
      fetchPayouts();
      if (onPayoutUpdated) onPayoutUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request payout.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (payoutId, newStatus) => {
    try {
      await api.put(`/accounts/prop-firm/${account.id}/payouts/${payoutId}`, {
        status: newStatus,
        processedDate: newStatus === 'PAID' ? new Date().toISOString() : undefined,
      });
      toast.success(`Payout marked as ${newStatus}`);
      fetchPayouts();
      if (onPayoutUpdated) onPayoutUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update payout.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Paid Out</p>
          <p className="mt-2 text-2xl font-black text-emerald-400 font-mono">
            {formatMoney(summary.totalPaid, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Net trader profits disbursed</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Pending Payouts</p>
          <p className="mt-2 text-2xl font-black text-amber-400 font-mono">
            {formatMoney(summary.totalPending, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Under review or awaiting processing</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Profit Split</p>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">
            {splitPercent}% <span className="text-xs font-semibold text-muted">Trader</span>
          </p>
          <p className="mt-1 text-xs text-muted">{100 - splitPercent}% firm fee deduction</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Available to Request</p>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">
            {formatMoney(availableProfit, currency)}
          </p>
          <p className="mt-1 text-xs text-muted">Profits above initial balance</p>
        </div>
      </div>

      {/* 2. Payout Action Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-foreground">Transactional Payout Ledger</h3>
          <p className="text-xs text-muted">Auditable record of requests, profit splits, firm deductions, and disbursement references.</p>
        </div>

        {isFunded ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
          >
            <Plus size={14} />
            <span>Request New Payout</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl bg-surface-muted px-4 py-2 text-xs font-medium text-muted border border-border">
            <Clock size={14} />
            <span>Payouts unlock upon passing evaluation</span>
          </div>
        )}
      </div>

      {/* 3. Payout Activity Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted">Loading payout history...</div>
        ) : payouts.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <DollarSign size={24} className="mx-auto text-muted" />
            <p className="text-sm font-bold text-foreground">No payout records found</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {isFunded
                ? 'Submit a payout request to record profit disbursements against your funded account.'
                : 'Complete your evaluation phases to unlock live profit split requests.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Gross Request</th>
                  <th className="py-3 px-4">Split</th>
                  <th className="py-3 px-4">Net Payout</th>
                  <th className="py-3 px-4">Method / Ref</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted">
                      {new Date(payout.requestDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-foreground">
                      {formatMoney(payout.amountRequested, currency)}
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {payout.profitSplitPercent}%
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-emerald-400">
                      {formatMoney(payout.netTraderPayout, currency)}
                    </td>
                    <td className="py-3 px-4 text-muted">
                      <span className="block text-foreground font-semibold">{payout.paymentMethod}</span>
                      <span className="block text-[10px] truncate max-w-[140px]">{payout.transactionReference || 'No ref'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getPayoutStatusBadge(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {payout.status === 'REQUESTED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(payout.id, 'APPROVED')}
                          className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 mr-2"
                        >
                          Approve
                        </button>
                      )}
                      {payout.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(payout.id, 'PAID')}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          Mark Paid
                        </button>
                      )}
                      {payout.status === 'PAID' && (
                        <span className="text-[11px] text-muted">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Request Payout Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Request Prop Firm Payout</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-muted block mb-1">
                  Amount to Request ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  value={amountRequested}
                  onChange={(e) => setAmountRequested(e.target.value)}
                  placeholder={`Max available: ${availableProfit.toFixed(2)}`}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 font-mono text-sm text-foreground focus:border-emerald-500 focus:outline-none"
                  required
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Available profit above starting balance: {formatMoney(availableProfit, currency)}
                </span>
              </div>

              {/* Profit Split Estimate Preview */}
              <div className="rounded-xl border border-border/60 bg-surface-muted/60 p-3.5 space-y-1.5">
                <div className="flex justify-between text-muted">
                  <span>Firm Profit Split:</span>
                  <span className="font-semibold text-foreground">{splitPercent}% Trader / {100 - splitPercent}% Firm</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Gross Requested:</span>
                  <span className="font-bold text-foreground font-mono">{formatMoney(numericAmount, currency)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1 text-sm font-bold">
                  <span className="text-foreground">Estimated Net Payout:</span>
                  <span className="text-emerald-400 font-mono">{formatMoney(estimatedNet, currency)}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="CRYPTO_USDT">Crypto (USDT TRC20 / ERC20)</option>
                  <option value="BANK_WIRE">Bank Wire Transfer</option>
                  <option value="DEEL">Deel</option>
                  <option value="WISE">Wise</option>
                  <option value="OTHER">Other Provider</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted block mb-1">Destination Address / Reference</label>
                <input
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="e.g. USDT TRC20 Address or Deel email"
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-muted block mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional payout instructions or firm reference ID..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
                >
                  {submitting ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropFirmPayoutLedger;
