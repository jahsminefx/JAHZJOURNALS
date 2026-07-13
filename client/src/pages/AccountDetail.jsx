import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Briefcase, Settings, ShieldAlert, SlidersHorizontal, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const formatMoney = (value, currency = 'USD') => {
  const number = Number(value || 0);
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
};

const enumLabel = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const MetricCard = ({ label, value, tone = 'green' }) => (
  <div className="rounded-xl border border-border bg-surface-muted p-4">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
    <p className={`mt-2 text-xl font-black ${tone === 'red' ? 'text-red-300' : tone === 'yellow' ? 'text-yellow-300' : 'text-green-400'}`}>{value}</p>
  </div>
);

const ProgressBar = ({ label, value, tone = 'green' }) => {
  const safeValue = Math.min(Math.max(Number(value || 0), 0), 100);
  const color = tone === 'red' ? 'bg-red-400' : tone === 'yellow' ? 'bg-yellow-300' : 'bg-green-400';

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-foreground">{safeValue.toFixed(1)}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
};

const RegularAccountDetail = ({ account }) => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard label="Current balance" value={formatMoney(account.currentBalance, account.currency)} />
      <MetricCard label="Starting balance" value={formatMoney(account.startingBalance, account.currency)} />
      <MetricCard label="Default risk" value={`${account.riskPerTradePercent ?? account.defaultRiskPercent ?? 0}%`} />
      <MetricCard label="Max daily loss" value={`${account.maxDailyLossPercent ?? 0}%`} tone="yellow" />
    </div>
    <div className="rounded-xl border border-border bg-surface-muted p-6">
      <h3 className="text-lg font-bold text-foreground">Account details</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <p className="text-sm text-muted">Broker: <span className="font-semibold text-foreground">{account.brokerName || 'Not set'}</span></p>
        <p className="text-sm text-muted">Type: <span className="font-semibold text-foreground">{enumLabel(account.accountType) || 'Not set'}</span></p>
        <p className="text-sm text-muted">Platform: <span className="font-semibold text-foreground">{enumLabel(account.platform) || 'Not set'}</span></p>
        <p className="text-sm text-muted">Max trades/day: <span className="font-semibold text-foreground">{account.maxTradesPerDay ?? 'Not set'}</span></p>
        <p className="text-sm text-muted">Max losses/day: <span className="font-semibold text-foreground">{account.maxLossesPerDay ?? 'Not set'}</span></p>
      </div>
      {account.notes && <p className="mt-5 rounded-lg bg-surface p-4 text-sm leading-6 text-muted">{account.notes}</p>}
    </div>
  </div>
);

const PropFirmAccountDetail = ({ account }) => {
  const propFirm = account.propFirmAccount;
  const currentPhase = propFirm.phases.find((phase) => phase.phaseNumber === propFirm.currentPhaseNumber) || propFirm.phases[0];
  const latestSnapshot = propFirm.progressSnapshots?.[0];
  const currentBalance = latestSnapshot?.balance ?? account.currentBalance;
  const equity = latestSnapshot?.equity ?? currentBalance;
  const currentProfit = Number(currentBalance || 0) - Number(account.startingBalance || 0);
  const targetAmount = currentPhase?.profitTargetAmount ?? (currentPhase?.profitTargetPercent ? account.startingBalance * (currentPhase.profitTargetPercent / 100) : 0);
  const remainingProfit = Math.max(targetAmount - currentProfit, 0);
  const challengeProgress = targetAmount > 0 ? (currentProfit / targetAmount) * 100 : 0;
  const dailyLossLimit = propFirm.dailyLossAmount ?? (propFirm.dailyLossPercent ? account.startingBalance * (propFirm.dailyLossPercent / 100) : 0);
  const overallLossLimit = propFirm.maximumLossAmount ?? (propFirm.maximumLossPercent ? account.startingBalance * (propFirm.maximumLossPercent / 100) : 0);
  const dailyLossUsed = Math.max(-(latestSnapshot?.dailyProfitLoss || 0), 0);
  const overallLossUsed = Math.max(-currentProfit, 0);
  const dailyRemaining = Math.max(dailyLossLimit - dailyLossUsed, 0);
  const overallRemaining = Math.max(overallLossLimit - overallLossUsed, 0);
  const bestDayPercentage = latestSnapshot?.bestDayProfit && currentProfit > 0 ? (latestSnapshot.bestDayProfit / currentProfit) * 100 : 0;
  const funded = ['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(propFirm.evaluationType) || propFirm.accountStatus === 'FUNDED';
  const enabledRestrictions = [
    ['News trading', propFirm.newsTradingAllowed],
    ['Weekend holding', propFirm.weekendHoldingAllowed],
    ['Overnight holding', propFirm.overnightHoldingAllowed],
    ['Expert Advisors', propFirm.expertAdvisorsAllowed],
    ['Copy trading', propFirm.copyTradingAllowed],
    ['Hedging', propFirm.hedgingAllowed],
    ['Scalping', propFirm.scalpingAllowed],
    ['Crypto trading', propFirm.cryptoTradingAllowed],
  ].filter(([, allowed]) => allowed === false);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Firm" value={propFirm.customFirmName || propFirm.firmName} />
        <MetricCard label="Programme" value={propFirm.programmeName} />
        <MetricCard label="Account size" value={formatMoney(account.startingBalance, account.currency)} />
        <MetricCard label="Status" value={enumLabel(propFirm.accountStatus)} tone={['FAILED', 'BREACHED', 'SUSPENDED'].includes(propFirm.accountStatus) ? 'red' : 'green'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Current phase" value={currentPhase?.name || 'No phase'} />
            <MetricCard label="Current balance" value={formatMoney(currentBalance, account.currency)} />
            <MetricCard label="Current equity" value={formatMoney(equity, account.currency)} />
            <MetricCard label="Current profit" value={formatMoney(currentProfit, account.currency)} tone={currentProfit < 0 ? 'red' : 'green'} />
            <MetricCard label="Profit target" value={formatMoney(targetAmount, account.currency)} />
            <MetricCard label="Remaining profit required" value={formatMoney(remainingProfit, account.currency)} tone="yellow" />
          </div>
          <ProgressBar label="Challenge progress" value={challengeProgress} />
          <ProgressBar label="Daily-loss allowance used" value={dailyLossLimit > 0 ? (dailyLossUsed / dailyLossLimit) * 100 : 0} tone={dailyRemaining <= 0 ? 'red' : 'yellow'} />
          <ProgressBar label="Overall drawdown used" value={overallLossLimit > 0 ? (overallLossUsed / overallLossLimit) * 100 : 0} tone={overallRemaining <= 0 ? 'red' : 'yellow'} />
        </div>

        <div className="rounded-xl border border-border bg-surface-muted p-5">
          <h3 className="flex items-center gap-2 font-bold text-foreground"><ShieldAlert size={18} className="text-yellow-300" /> Rule snapshot</h3>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>Maximum daily loss: <span className="font-semibold text-foreground">{formatMoney(dailyLossLimit, account.currency)}</span></p>
            <p>Remaining daily-loss allowance: <span className="font-semibold text-foreground">{formatMoney(dailyRemaining, account.currency)}</span></p>
            <p>Maximum overall loss: <span className="font-semibold text-foreground">{formatMoney(overallLossLimit, account.currency)}</span></p>
            <p>Remaining overall drawdown: <span className="font-semibold text-foreground">{formatMoney(overallRemaining, account.currency)}</span></p>
            <p>Trading days completed: <span className="font-semibold text-foreground">{latestSnapshot?.completedTradingDays ?? 0}</span></p>
            <p>Minimum trading days required: <span className="font-semibold text-foreground">{currentPhase?.minimumTradingDays ?? 'Not set'}</span></p>
            <p>Profitable days completed: <span className="font-semibold text-foreground">{latestSnapshot?.profitableDays ?? 0}</span></p>
            <p>Best-day percentage: <span className="font-semibold text-foreground">{bestDayPercentage.toFixed(1)}%</span></p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-muted p-5">
          <h3 className="font-bold text-foreground">Challenge rules</h3>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>Evaluation type: <span className="font-semibold text-foreground">{enumLabel(propFirm.evaluationType)}</span></p>
            <p>Drawdown type: <span className="font-semibold text-foreground">{enumLabel(propFirm.drawdownType)}</span></p>
            <p>Daily loss: <span className="font-semibold text-foreground">{propFirm.dailyLossPercent ?? 'Not set'}%</span></p>
            <p>Maximum loss: <span className="font-semibold text-foreground">{propFirm.maximumLossPercent ?? 'Not set'}%</span></p>
            <p>Phases: <span className="font-semibold text-foreground">{propFirm.phases.length || 'No evaluation phase'}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted p-5">
          <h3 className="font-bold text-foreground">Advanced rules</h3>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>Max risk per trade: <span className="font-semibold text-foreground">{propFirm.maxRiskPerTradePercent ?? 'Not set'}%</span></p>
            <p>Max open positions: <span className="font-semibold text-foreground">{propFirm.maxOpenPositions ?? 'Not set'}</span></p>
            <p>Daily reset: <span className="font-semibold text-foreground">{propFirm.dailyResetTime || 'Not set'} {propFirm.dailyResetTimezone || ''}</span></p>
            <p>Consistency rules: <span className="font-semibold text-foreground">{propFirm.consistencyRuleEnabled ? 'Enabled' : 'Disabled'}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted p-5">
          <h3 className="font-bold text-foreground">Trading restrictions</h3>
          <div className="mt-4 space-y-3">
            {enabledRestrictions.length === 0 && !propFirm.restrictedSymbols?.length && !propFirm.customRules ? (
              <p className="text-sm text-muted">No advanced restrictions configured.</p>
            ) : (
              <>
                {enabledRestrictions.map(([label]) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-muted">
                    <AlertTriangle size={16} className="text-yellow-300" />
                    {label}: Restricted
                  </div>
                ))}
                {propFirm.restrictedSymbols?.length > 0 && <p className="text-sm text-muted">Restricted symbols: <span className="font-semibold text-foreground">{propFirm.restrictedSymbols.join(', ')}</span></p>}
                {propFirm.customRules && <p className="rounded-lg bg-surface p-3 text-sm leading-6 text-muted">{propFirm.customRules}</p>}
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted p-5">
          <h3 className="font-bold text-foreground">Payout settings</h3>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {funded ? (
              <>
                <p>Profit split: <span className="font-semibold text-foreground">{propFirm.profitSplitPercent ?? 'Not set'}%</span></p>
                <p>First payout date: <span className="font-semibold text-foreground">{propFirm.firstPayoutDate ? new Date(propFirm.firstPayoutDate).toLocaleDateString() : 'Not set'}</span></p>
                <p>Payout frequency: <span className="font-semibold text-foreground">{enumLabel(propFirm.payoutFrequency) || 'Not set'}</span></p>
                <p>Scaling plan: <span className="font-semibold text-foreground">{propFirm.scalingPlanEnabled ? 'Enabled' : 'Disabled'}</span></p>
              </>
            ) : (
              <p className="text-muted">Payout settings are available for funded accounts.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-foreground"><Trophy size={18} className="text-green-400" /> Phase cards</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {propFirm.phases.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No evaluation phases for this account.</div>
          ) : propFirm.phases.map((phase) => (
            <div key={phase.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Phase {phase.phaseNumber}</p>
              <h4 className="mt-2 font-bold text-foreground">{phase.name}</h4>
              <p className="mt-2 text-sm text-muted">Target: {phase.profitTargetPercent ? `${phase.profitTargetPercent}%` : formatMoney(phase.profitTargetAmount, account.currency)}</p>
              <p className="mt-1 text-sm text-muted">Min days: {phase.minimumTradingDays ?? 'Not set'}</p>
              <p className="mt-3 rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-green-400">{enumLabel(phase.status)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-foreground"><Briefcase size={18} className="text-green-400" /> Recent trades</h3>
        {(account.trades || []).length === 0 ? (
          <p className="text-sm text-muted">No trades logged for this account yet.</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {account.trades.map((trade) => (
              <Link key={trade.id} to={`/trades/${trade.id}`} className="flex items-center justify-between py-3 text-sm hover:text-green-400">
                <span>{trade.pair} {trade.direction}</span>
                <span className="font-semibold text-muted">{trade.result}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AccountDetail = () => {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAccount = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/accounts/${id}`);
        setAccount(data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load account');
        navigate('/accounts', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [id, navigate]);

  if (loading) {
    return <div className="py-12 text-center text-muted">Loading account...</div>;
  }

  if (!account) return null;

  const isPropFirm = account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount;

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/accounts')} className="mb-3 inline-flex items-center gap-2 text-sm text-muted hover:text-green-400">
            <ArrowLeft size={16} /> Back to accounts
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">{isPropFirm ? 'Prop-firm account' : 'Regular account'}</p>
          <h2 className="mt-2 text-2xl font-black text-foreground">{account.name}</h2>
          <p className="mt-1 text-sm text-muted">{account.brokerName || account.propFirmAccount?.firmName || 'No broker or firm set'}</p>
        </div>
        {isPropFirm ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={`/accounts/${account.id}/prop-firm/edit-account`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted">
              <Settings size={16} />
              Edit Account
            </Link>
            <Link to={`/accounts/${account.id}/prop-firm/edit-challenge-rules`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400">
              <ShieldAlert size={16} />
              Edit Challenge Rules
            </Link>
            <Link to={`/accounts/${account.id}/prop-firm/advanced-settings`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/50 px-4 py-2 text-sm font-bold text-green-300 hover:bg-green-500/10">
              <SlidersHorizontal size={16} />
              Advanced Settings
            </Link>
          </div>
        ) : (
          <Link to={`/accounts/${account.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400">
            <Settings size={16} />
            Edit account
          </Link>
        )}
      </div>

      {isPropFirm && account.propFirmAccount ? <PropFirmAccountDetail account={account} /> : <RegularAccountDetail account={account} />}
    </div>
  );
};

export default AccountDetail;
