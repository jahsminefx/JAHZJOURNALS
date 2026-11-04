import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Award, AlertTriangle, AlertCircle, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, Trophy, Zap, ShieldAlert,
  ChevronRight, ExternalLink
} from 'lucide-react';

const formatMoney = (value, currency = 'USD') => {
  const num = Number(value || 0);
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const getStatusPill = (status) => {
  switch (status) {
    case 'FUNDED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'PASSED':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'ACTIVE':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'BREACHED':
    case 'FAILED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default:
      return 'bg-surface-muted text-muted border-border';
  }
};

const PropFirmCommandCenter = ({ accounts = [] }) => {
  const propAccounts = accounts.filter(
    (a) => a.accountCategory === 'PROP_FIRM' || a.isPropFirmAccount
  );

  const activeChallenges = propAccounts.filter(
    (a) => a.propFirmAccount?.accountStatus === 'ACTIVE' || !a.propFirmAccount?.accountStatus
  );

  const fundedAccounts = propAccounts.filter(
    (a) =>
      a.propFirmAccount?.accountStatus === 'FUNDED' ||
      ['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(a.propFirmAccount?.evaluationType)
  );

  const passedAccounts = propAccounts.filter(
    (a) => a.propFirmAccount?.accountStatus === 'PASSED'
  );

  const breachedAccounts = propAccounts.filter(
    (a) => ['BREACHED', 'FAILED'].includes(a.propFirmAccount?.accountStatus)
  );

  const totalCapitalUnderMgmt = propAccounts.reduce(
    (sum, a) => sum + (Number(a.startingBalance) || 0),
    0
  );

  const totalCurrentBalance = propAccounts.reduce(
    (sum, a) => sum + (Number(a.currentBalance) || 0),
    0
  );

  const netVerifiedProfit = totalCurrentBalance - totalCapitalUnderMgmt;

  const totalFeesPaid = propAccounts.reduce(
    (sum, a) => sum + (Number(a.propFirmAccount?.challengeFee) || 0),
    0
  );

  const totalResolved = passedAccounts.length + breachedAccounts.length;
  const passRate = totalResolved > 0 ? (passedAccounts.length / totalResolved) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 1. Command Center Portfolio Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Capital */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Capital Under Management</p>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">
            {formatMoney(totalCapitalUnderMgmt)}
          </p>
          <p className="mt-1 text-xs text-muted">{propAccounts.length} total prop-firm accounts</p>
        </div>

        {/* Net Verified Profit */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Net Portfolio P&L</p>
          <p className={`mt-2 text-2xl font-black font-mono ${
            netVerifiedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {netVerifiedProfit >= 0 ? '+' : ''}{formatMoney(netVerifiedProfit)}
          </p>
          <p className="mt-1 text-xs text-muted">Aggregated across all firm balances</p>
        </div>

        {/* Active Challenges vs Funded */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Active / Funded</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{activeChallenges.length}</span>
            <span className="text-xs font-semibold text-muted">challenges</span>
            <span className="text-muted font-bold">/</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{fundedAccounts.length}</span>
            <span className="text-xs font-semibold text-emerald-400">funded</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {passedAccounts.length > 0 ? `${passedAccounts.length} passed evaluation` : 'In progress'}
          </p>
        </div>

        {/* Total Fees & Pass Rate */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Challenge Fees</p>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">
            {formatMoney(totalFeesPaid)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {totalResolved > 0 ? `Pass rate: ${passRate.toFixed(1)}%` : 'No resolved evaluations yet'}
          </p>
        </div>
      </div>

      {/* 2. Prop Firm Portfolio Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Prop Firm Accounts Portfolio</h3>
            <p className="text-xs text-muted">Multi-account status, drawdown model, and challenge tracking.</p>
          </div>
          <Link
            to="/accounts/prop-firm/new"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
          >
            <span>+ Add Prop Firm Account</span>
          </Link>
        </div>

        {propAccounts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShieldCheck size={32} className="mx-auto text-muted" />
            <h4 className="text-sm font-bold text-foreground">No prop firm accounts registered</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Add your FTMO, Apex, Topstep, FundedNext, or custom prop firm account to monitor your risk allowance.
            </p>
            <div className="pt-2">
              <Link
                to="/accounts/prop-firm/new"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                Create First Prop-Firm Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-3 px-4">Account / Firm</th>
                  <th className="py-3 px-4">Model & Phase</th>
                  <th className="py-3 px-4">Drawdown Type</th>
                  <th className="py-3 px-4">Balance / Target</th>
                  <th className="py-3 px-4">Current P&L</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Cockpit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {propAccounts.map((account) => {
                  const propFirm = account.propFirmAccount || {};
                  const starting = Number(account.startingBalance || 0);
                  const current = Number(account.currentBalance || 0);
                  const pnl = current - starting;
                  const pnlPct = starting > 0 ? (pnl / starting) * 100 : 0;
                  const status = propFirm.accountStatus || 'ACTIVE';

                  return (
                    <tr key={account.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link to={`/accounts/${account.id}`} className="font-bold text-foreground hover:text-emerald-400 block truncate max-w-[160px]">
                          {account.name}
                        </Link>
                        <span className="text-[11px] text-muted">
                          {propFirm.customFirmName || propFirm.firmName || 'Prop Firm'} • {formatMoney(starting, account.currency)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-muted">
                        <span className="block font-semibold text-foreground">
                          {status === 'FUNDED' ? 'FUNDED' : `Phase ${propFirm.currentPhaseNumber || 1}`}
                        </span>
                        <span className="text-[11px]">{propFirm.evaluationType?.replaceAll('_', ' ') || 'Evaluation'}</span>
                      </td>

                      <td className="py-3.5 px-4 text-muted">
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-foreground border border-border">
                          {propFirm.drawdownType || 'STATIC'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold font-mono text-foreground block">
                          {formatMoney(current, account.currency)}
                        </span>
                        <span className="text-[10px] text-muted">
                          {propFirm.dailyLossPercent ? `${propFirm.dailyLossPercent}% daily limit` : 'No daily loss limit'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className={pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {pnl >= 0 ? '+' : ''}{formatMoney(pnl, account.currency)}
                        </span>
                        <span className="block text-[10px] font-semibold text-muted">
                          ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getStatusPill(status)}`}>
                          {status.replaceAll('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/accounts/${account.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          <span>Open</span>
                          <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropFirmCommandCenter;
