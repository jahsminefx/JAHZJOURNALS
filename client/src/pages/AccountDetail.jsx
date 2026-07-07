import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, Settings, ShieldAlert, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const formatMoney = (value, currency = 'USD') => {
  const number = Number(value || 0);
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
};

const enumLabel = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const MetricCard = ({ label, value, tone = 'green' }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
    <p className={`mt-2 text-xl font-black ${tone === 'red' ? 'text-red-300' : tone === 'yellow' ? 'text-yellow-300' : 'text-green-400'}`}>{value}</p>
  </div>
);

const ProgressBar = ({ label, value, tone = 'green' }) => {
  const safeValue = Math.min(Math.max(Number(value || 0), 0), 100);
  const color = tone === 'red' ? 'bg-red-400' : tone === 'yellow' ? 'bg-yellow-300' : 'bg-green-400';

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-medium text-gray-200">{label}</span>
        <span className="font-bold text-gray-100">{safeValue.toFixed(1)}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-900">
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
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
      <h3 className="text-lg font-bold text-gray-100">Account details</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <p className="text-sm text-gray-400">Broker: <span className="font-semibold text-gray-100">{account.brokerName || 'Not set'}</span></p>
        <p className="text-sm text-gray-400">Type: <span className="font-semibold text-gray-100">{enumLabel(account.accountType) || 'Not set'}</span></p>
        <p className="text-sm text-gray-400">Platform: <span className="font-semibold text-gray-100">{enumLabel(account.platform) || 'Not set'}</span></p>
        <p className="text-sm text-gray-400">Max trades/day: <span className="font-semibold text-gray-100">{account.maxTradesPerDay ?? 'Not set'}</span></p>
        <p className="text-sm text-gray-400">Max losses/day: <span className="font-semibold text-gray-100">{account.maxLossesPerDay ?? 'Not set'}</span></p>
      </div>
      {account.notes && <p className="mt-5 rounded-lg bg-gray-900 p-4 text-sm leading-6 text-gray-300">{account.notes}</p>}
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

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h3 className="flex items-center gap-2 font-bold text-gray-100"><ShieldAlert size={18} className="text-yellow-300" /> Rule snapshot</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-400">
            <p>Maximum daily loss: <span className="font-semibold text-gray-100">{formatMoney(dailyLossLimit, account.currency)}</span></p>
            <p>Remaining daily-loss allowance: <span className="font-semibold text-gray-100">{formatMoney(dailyRemaining, account.currency)}</span></p>
            <p>Maximum overall loss: <span className="font-semibold text-gray-100">{formatMoney(overallLossLimit, account.currency)}</span></p>
            <p>Remaining overall drawdown: <span className="font-semibold text-gray-100">{formatMoney(overallRemaining, account.currency)}</span></p>
            <p>Trading days completed: <span className="font-semibold text-gray-100">{latestSnapshot?.completedTradingDays ?? 0}</span></p>
            <p>Minimum trading days required: <span className="font-semibold text-gray-100">{currentPhase?.minimumTradingDays ?? 'Not set'}</span></p>
            <p>Profitable days completed: <span className="font-semibold text-gray-100">{latestSnapshot?.profitableDays ?? 0}</span></p>
            <p>Best-day percentage: <span className="font-semibold text-gray-100">{bestDayPercentage.toFixed(1)}%</span></p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h3 className="font-bold text-gray-100">Trading restrictions</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['News trading', propFirm.newsTradingAllowed],
              ['Weekend holding', propFirm.weekendHoldingAllowed],
              ['Overnight holding', propFirm.overnightHoldingAllowed],
              ['Expert Advisors', propFirm.expertAdvisorsAllowed],
              ['Copy trading', propFirm.copyTradingAllowed],
              ['Hedging', propFirm.hedgingAllowed],
              ['Scalping', propFirm.scalpingAllowed],
              ['Crypto trading', propFirm.cryptoTradingAllowed],
            ].map(([label, allowed]) => (
              <div key={label} className="flex items-center gap-2 text-sm text-gray-300">
                {allowed ? <CheckCircle2 size={16} className="text-green-400" /> : <AlertTriangle size={16} className="text-yellow-300" />}
                {label}: {allowed ? 'Allowed' : 'Restricted'}
              </div>
            ))}
          </div>
          {propFirm.customRules && <p className="mt-4 rounded-lg bg-gray-900 p-3 text-sm leading-6 text-gray-400">{propFirm.customRules}</p>}
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h3 className="font-bold text-gray-100">Payout information</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-400">
            <p>Profit split: <span className="font-semibold text-gray-100">{propFirm.profitSplitPercent ?? 'Not set'}%</span></p>
            <p>First payout date: <span className="font-semibold text-gray-100">{propFirm.firstPayoutDate ? new Date(propFirm.firstPayoutDate).toLocaleDateString() : 'Not set'}</span></p>
            <p>Payout frequency: <span className="font-semibold text-gray-100">{enumLabel(propFirm.payoutFrequency) || 'Not set'}</span></p>
            <p>Minimum payout: <span className="font-semibold text-gray-100">{propFirm.minimumPayoutAmount ? formatMoney(propFirm.minimumPayoutAmount, account.currency) : 'Not set'}</span></p>
            <p>Scaling plan: <span className="font-semibold text-gray-100">{propFirm.scalingPlanEnabled ? 'Enabled' : 'Disabled'}</span></p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-100"><Trophy size={18} className="text-green-400" /> Phase cards</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {propFirm.phases.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-sm text-gray-500">No evaluation phases for this account.</div>
          ) : propFirm.phases.map((phase) => (
            <div key={phase.id} className="rounded-xl border border-gray-700 bg-gray-900 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Phase {phase.phaseNumber}</p>
              <h4 className="mt-2 font-bold text-gray-100">{phase.name}</h4>
              <p className="mt-2 text-sm text-gray-400">Target: {phase.profitTargetPercent ? `${phase.profitTargetPercent}%` : formatMoney(phase.profitTargetAmount, account.currency)}</p>
              <p className="mt-1 text-sm text-gray-400">Min days: {phase.minimumTradingDays ?? 'Not set'}</p>
              <p className="mt-3 rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-green-400">{enumLabel(phase.status)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-100"><Briefcase size={18} className="text-green-400" /> Recent trades</h3>
        {(account.trades || []).length === 0 ? (
          <p className="text-sm text-gray-500">No trades logged for this account yet.</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {account.trades.map((trade) => (
              <Link key={trade.id} to={`/trades/${trade.id}`} className="flex items-center justify-between py-3 text-sm hover:text-green-400">
                <span>{trade.pair} {trade.direction}</span>
                <span className="font-semibold text-gray-300">{trade.result}</span>
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
    return <div className="py-12 text-center text-gray-400">Loading account...</div>;
  }

  if (!account) return null;

  const isPropFirm = account.accountCategory === 'PROP_FIRM' || account.isPropFirmAccount;

  return (
    <div className="space-y-6 text-gray-100">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-700 bg-gray-800 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/accounts')} className="mb-3 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-green-400">
            <ArrowLeft size={16} /> Back to accounts
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">{isPropFirm ? 'Prop-firm account' : 'Regular account'}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{account.name}</h2>
          <p className="mt-1 text-sm text-gray-400">{account.brokerName || account.propFirmAccount?.firmName || 'No broker or firm set'}</p>
        </div>
        <Link to={isPropFirm ? `/accounts/${account.id}/prop-firm/edit` : `/accounts/${account.id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400">
          <Settings size={16} />
          Edit account
        </Link>
      </div>

      {isPropFirm && account.propFirmAccount ? <PropFirmAccountDetail account={account} /> : <RegularAccountDetail account={account} />}
    </div>
  );
};

export default AccountDetail;
