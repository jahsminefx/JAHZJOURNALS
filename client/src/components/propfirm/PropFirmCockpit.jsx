import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, Clock, Trophy,
  TrendingUp, Award, DollarSign, Calendar, ArrowUpRight, CheckCircle2,
  Download, RefreshCw, Layers, Zap, Info, ChevronRight, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import PropFirmPayoutLedger from './PropFirmPayoutLedger';
import { generatePropFirmCompliancePdfReport } from '../../utils/pdfReportService';

const formatMoney = (value, currency = 'USD') => {
  const num = Number(value || 0);
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const formatTimeRemaining = (targetDateStr) => {
  if (!targetDateStr) return '00:00:00';
  const target = new Date(targetDateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return 'Resetting...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'SAFE':
    case 'PASSED':
    case 'FUNDED':
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: ShieldCheck,
        label: status,
      };
    case 'APPROACHING_LIMIT':
    case 'CAUTION':
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: AlertTriangle,
        label: 'Approaching Limit',
      };
    case 'CRITICAL':
      return {
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        icon: AlertCircle,
        label: 'Critical Margin',
      };
    case 'BREACH_DETECTED':
    case 'FAILED':
      return {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: ShieldAlert,
        label: 'Breach Detected',
      };
    default:
      return {
        bg: 'bg-surface-muted text-muted border-border',
        icon: Info,
        label: status || 'Unknown',
      };
  }
};

const PropFirmCockpit = ({ account, onRefresh }) => {
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'rules' | 'payouts'
  const [countdown, setCountdown] = useState('');

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/accounts/prop-firm/${account.id}/compliance`);
      setCompliance(data);
    } catch (err) {
      console.error('Failed to load compliance report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.id) {
      fetchCompliance();
    }
  }, [account?.id]);

  // Live Reset Clock countdown
  useEffect(() => {
    if (!compliance?.dailyLoss?.resetBoundaries?.nextResetUtc) return;

    const interval = setInterval(() => {
      setCountdown(formatTimeRemaining(compliance.dailyLoss.resetBoundaries.nextResetUtc));
    }, 1000);

    setCountdown(formatTimeRemaining(compliance.dailyLoss.resetBoundaries.nextResetUtc));
    return () => clearInterval(interval);
  }, [compliance?.dailyLoss?.resetBoundaries?.nextResetUtc]);

  const handleAdvancePhase = async () => {
    if (!window.confirm('Ready to advance to the next phase based on verified profit and trading day requirements?')) return;
    try {
      setAdvancing(true);
      const { data } = await api.post(`/accounts/prop-firm/${account.id}/advance-phase`);
      toast.success(data.message || 'Phase advanced successfully!');
      fetchCompliance();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to advance phase.');
    } finally {
      setAdvancing(false);
    }
  };

  const handleExportPdf = async () => {
    if (!compliance) {
      toast.error('Compliance metrics are loading. Please wait a moment.');
      return;
    }
    try {
      toast.loading('Generating compliance report...', { id: 'pdf-toast' });
      await generatePropFirmCompliancePdfReport({
        account,
        compliance,
        trades: account.trades || [],
      });
      toast.success('Report downloaded successfully!', { id: 'pdf-toast' });
    } catch (err) {
      toast.error('Failed to generate PDF report.', { id: 'pdf-toast' });
    }
  };

  const propFirm = account.propFirmAccount || {};
  const currency = account.currency || 'USD';
  const isFunded = propFirm.accountStatus === 'FUNDED' || ['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(propFirm.evaluationType);

  const overall = compliance?.overallDrawdown || {};
  const daily = compliance?.dailyLoss || {};
  const progress = compliance?.challengeProgress || {};
  const days = compliance?.tradingDays || {};
  const consistency = compliance?.consistency || {};
  const freshness = compliance?.freshness || {};
  const overallBadge = getStatusBadge(overall.status);
  const dailyBadge = getStatusBadge(daily.status);

  const canAdvance = progress.isTargetReached && days.isMinimumMet && overall.status !== 'BREACH_DETECTED' && daily.status !== 'BREACH_DETECTED';

  return (
    <div className="space-y-6">
      {/* 1. Header Cockpit Bar */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground border border-border">
              {propFirm.customFirmName || propFirm.firmName || 'Prop Firm'}
            </span>
            <span className="rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted border border-border">
              {propFirm.programmeName || 'Challenge Program'}
            </span>
            <span className="rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted border border-border">
              Size: {formatMoney(account.startingBalance, currency)}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${
              isFunded ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-surface-muted text-foreground border-border'
            }`}>
              <Award size={14} />
              {isFunded ? 'FUNDED ACCOUNT' : compliance?.currentPhase?.name || `Phase ${propFirm.currentPhaseNumber || 1}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Freshness Badge */}
            <div className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              freshness.level === 'LIVE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            }`}>
              <CheckCircle2 size={13} />
              <span>{freshness.label || 'Journal Ledger Verified'}</span>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted/80 transition"
              title="Download evaluator-ready compliance audit report"
            >
              <Download size={13} />
              <span>Export PDF Report</span>
            </button>

            <button
              type="button"
              onClick={fetchCompliance}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted/80 transition"
              title="Recalculate compliance metrics"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Advisory Disclaimer */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-surface-muted/30 px-3.5 py-2 text-xs text-muted">
          <Info size={14} className="shrink-0 text-amber-400" />
          <span>
            <strong className="text-foreground">Advisory Journal Risk Guard:</strong> JahzJournals calculates compliance based on journaled trades and broker sync. JahzJournals warnings are advisory and never guarantee broker-side execution.
          </span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-border text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          <TrendingUp size={16} />
          <span>Risk & Challenge Cockpit</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-colors ${
            activeTab === 'rules'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          <ShieldAlert size={16} />
          <span>Rule Specification</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-colors ${
            activeTab === 'payouts'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          <DollarSign size={16} />
          <span>Payout Ledger {isFunded && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">Active</span>}</span>
        </button>
      </div>

      {/* 3. TAB 1: OVERVIEW COCKPIT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Phase Passed / Ready to Advance Banner */}
          {canAdvance && !isFunded && (
            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Trophy size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Phase Target & Minimum Days Achieved!</h4>
                  <p className="text-xs text-muted">You have met the profit target and trading day criteria for this evaluation phase.</p>
                </div>
              </div>
              <button
                type="button"
                disabled={advancing}
                onClick={handleAdvancePhase}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                {advancing ? <RefreshCw size={14} className="animate-spin" /> : <Award size={14} />}
                <span>Advance to Next Phase</span>
              </button>
            </div>
          )}

          {/* Primary Metric Grid: Balance, High Water Mark, Daily Reset Clock */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Current Balance */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Current Balance</p>
              <p className="mt-2 text-2xl font-black text-foreground font-mono">
                {formatMoney(compliance?.currentBalance ?? account.currentBalance, currency)}
              </p>
              <p className={`mt-1 text-xs font-semibold ${
                progress.currentProfitAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {progress.currentProfitAmount >= 0 ? '+' : ''}{formatMoney(progress.currentProfitAmount, currency)} net P&L
              </p>
            </div>

            {/* Peak High-Water Mark */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">High-Water Mark</p>
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-foreground font-mono">
                {formatMoney(overall.highWaterMark ?? account.startingBalance, currency)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {overall.drawdownType === 'TRAILING' ? 'Dynamic Trailing Reference' : 'Peak Balance Tracked'}
              </p>
            </div>

            {/* Daily Reset Countdown Clock */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Daily Reset Clock</p>
                <Clock size={14} className="text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-400 font-mono">
                {countdown || 'Calculating...'}
              </p>
              <p className="mt-1 text-xs text-muted truncate">
                Zone: {daily.resetBoundaries?.timezone || 'UTC'} ({daily.resetBoundaries?.resetTime || '00:00'})
              </p>
            </div>

            {/* Overall Status */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Compliance State</p>
                {React.createElement(overallBadge.icon, { size: 14, className: 'text-emerald-400' })}
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${overallBadge.bg}`}>
                  {compliance?.summaryStatus || 'EVALUATING'}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted truncate">
                {overall.drawdownType || 'STATIC'} Model
              </p>
            </div>
          </div>

          {/* Critical Risk Gauges: Daily Loss Buffer vs Overall Drawdown */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* 1. Daily Loss Guard */}
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted border border-border text-amber-400">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Daily Loss Allowance</h3>
                    <p className="text-xs text-muted">Resets daily based on broker reset boundary</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${dailyBadge.bg}`}>
                  {dailyBadge.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border/40">
                  <span className="text-muted block">Daily Limit</span>
                  <span className="font-bold text-foreground font-mono mt-1 block">
                    {formatMoney(daily.limitAmount, currency)}
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border/40">
                  <span className="text-muted block">Used Today</span>
                  <span className="font-bold text-rose-400 font-mono mt-1 block">
                    {formatMoney(daily.currentLossAmount, currency)}
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border/40">
                  <span className="text-muted block">Remaining Buffer</span>
                  <span className="font-bold text-emerald-400 font-mono mt-1 block">
                    {formatMoney(daily.remainingAllowanceAmount, currency)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Daily Loss Utilization</span>
                  <span className="font-bold text-foreground">{daily.utilizationPercent?.toFixed(1) || '0.0'}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      (daily.utilizationPercent || 0) >= 90
                        ? 'bg-rose-500'
                        : (daily.utilizationPercent || 0) >= 70
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, daily.utilizationPercent || 0))}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                {daily.explanation || 'Daily loss buffer is calculated strictly from trades closed since today\'s reset window.'}
              </p>
            </div>

            {/* 2. Overall Drawdown / Trailing Floor Guard */}
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted border border-border text-emerald-400">
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">
                      {overall.drawdownType === 'TRAILING' ? 'Dynamic Trailing Drawdown' : 'Maximum Overall Loss'}
                    </h3>
                    <p className="text-xs text-muted">
                      {overall.drawdownType === 'TRAILING'
                        ? 'Trails peak balance (Apex / Futures model)'
                        : 'Fixed static threshold from starting balance'}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${overallBadge.bg}`}>
                  {overallBadge.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border/40">
                  <span className="text-muted block">Liquidation Floor</span>
                  <span className="font-bold text-rose-400 font-mono mt-1 block">
                    {formatMoney(overall.liquidationFloor, currency)}
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border/40">
                  <span className="text-muted block">Current Drawdown</span>
                  <span className="font-bold text-foreground font-mono mt-1 block">
                    {formatMoney(overall.currentDrawdownAmount, currency)}
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3 border border-border/40">
                  <span className="text-muted block">Distance to Floor</span>
                  <span className="font-bold text-emerald-400 font-mono mt-1 block">
                    {formatMoney(overall.remainingAllowanceAmount, currency)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Drawdown Allowance Utilized</span>
                  <span className="font-bold text-foreground">{overall.utilizationPercent?.toFixed(1) || '0.0'}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      (overall.utilizationPercent || 0) >= 90
                        ? 'bg-rose-500'
                        : (overall.utilizationPercent || 0) >= 70
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, overall.utilizationPercent || 0))}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                {overall.explanation || 'Liquidation floor protects account integrity. Any equity dip to this floor causes account breach.'}
              </p>
            </div>
          </div>

          {/* 3. Challenge Progression, Trading Days & Best-Day Consistency */}
          {!isFunded && (
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-emerald-400" />
                  <h3 className="font-bold text-foreground">Phase Target & Consistency Requirements</h3>
                </div>
                <span className="text-xs font-semibold text-muted">
                  {compliance?.currentPhase?.name || `Phase ${propFirm.currentPhaseNumber || 1}`}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Profit Target */}
                <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Target Profit</span>
                    <span className="font-bold text-foreground font-mono">{formatMoney(progress.targetProfitAmount, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Current Profit</span>
                    <span className={`font-bold font-mono ${progress.currentProfitAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatMoney(progress.currentProfitAmount, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, progress.progressPercent || 0))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted text-right">
                    {progress.progressPercent?.toFixed(1) || '0.0'}% of target reached
                  </p>
                </div>

                {/* Minimum Trading Days */}
                <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Days Required</span>
                    <span className="font-bold text-foreground">{days.requiredDays ?? 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Days Completed</span>
                    <span className="font-bold text-emerald-400 font-mono">{days.completedDays ?? 0}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${days.requiredDays ? Math.min(100, (days.completedDays / days.requiredDays) * 100) : 100}%`
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted text-right">
                    {days.isMinimumMet ? 'Minimum days satisfied' : `${(days.requiredDays || 0) - (days.completedDays || 0)} days remaining`}
                  </p>
                </div>

                {/* Best-Day Consistency Rule */}
                <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Consistency Cap</span>
                    <span className="font-bold text-foreground">
                      {consistency.maximumBestDayPercent ? `${consistency.maximumBestDayPercent}% Max` : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Best Day %</span>
                    <span className="font-bold text-foreground font-mono">
                      {consistency.bestDayPercent?.toFixed(1) || '0.0'}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        consistency.maximumBestDayPercent && (consistency.bestDayPercent || 0) > consistency.maximumBestDayPercent
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${consistency.maximumBestDayPercent ? Math.min(100, ((consistency.bestDayPercent || 0) / consistency.maximumBestDayPercent) * 100) : 0}%`
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted text-right">
                    Peak day: {formatMoney(consistency.bestDayProfit, currency)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: ADVANCED RULE SPECIFICATION */}
      {activeTab === 'rules' && (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-6">
          <h3 className="font-bold text-foreground">Advanced Rule Profile & Trading Guidelines</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Evaluation Model</span>
              <p className="font-bold text-foreground text-sm">{propFirm.evaluationType?.replaceAll('_', ' ') || 'STANDARD'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Drawdown Calculation Basis</span>
              <p className="font-bold text-foreground text-sm">{propFirm.drawdownType || 'STATIC'} (Balance & Closed Trade Ledger)</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Daily Reset Clock</span>
              <p className="font-bold text-foreground text-sm">{propFirm.dailyResetTime || '00:00'} ({propFirm.dailyResetTimezone || 'UTC'})</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Max Risk Per Trade</span>
              <p className="font-bold text-foreground text-sm">{propFirm.maxRiskPerTradePercent ? `${propFirm.maxRiskPerTradePercent}%` : 'Unrestricted'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Max Open Positions</span>
              <p className="font-bold text-foreground text-sm">{propFirm.maxOpenPositions ?? 'Unrestricted'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Max Lot Size</span>
              <p className="font-bold text-foreground text-sm">{propFirm.maxLotSize ? `${propFirm.maxLotSize} lots` : 'Unrestricted'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">News Trading</span>
              <p className="font-bold text-foreground text-sm">{propFirm.newsTradingAllowed === false ? 'Prohibited Around High Impact News' : 'Allowed'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Weekend Holding</span>
              <p className="font-bold text-foreground text-sm">{propFirm.weekendHoldingAllowed === false ? 'Must Close Before Market Close' : 'Allowed'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4 space-y-1">
              <span className="text-muted">Profit Split (When Funded)</span>
              <p className="font-bold text-foreground text-sm">{propFirm.profitSplitPercent ?? 80}% Trader / {100 - (propFirm.profitSplitPercent ?? 80)}% Firm</p>
            </div>
          </div>

          {propFirm.customRules && (
            <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">Custom Firm Rules</span>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{propFirm.customRules}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: PAYOUT LEDGER */}
      {activeTab === 'payouts' && (
        <PropFirmPayoutLedger
          account={account}
          compliance={compliance}
          onPayoutUpdated={fetchCompliance}
        />
      )}
    </div>
  );
};

export default PropFirmCockpit;
