import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import PropFirmAdvancedSettings from '../components/accounts/PropFirmAdvancedSettings';

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const mapAccountToAdvancedSettings = (account) => ({
  brokerServer: account.brokerServer || account.tradingAccount?.brokerName || '',
  challengeFee: account.challengeFee ?? '',
  accountStatus: account.accountStatus || 'ACTIVE',
  currentPhaseNumber: account.currentPhaseNumber ?? '',
  dailyLossCalculationBasis: account.dailyLossCalculationBasis || 'INITIAL_BALANCE',
  overallLossCalculationBasis: account.overallLossCalculationBasis || 'INITIAL_BALANCE',
  includeFloatingPnl: account.includeFloatingPnl ?? true,
  includeCommissions: account.includeCommissions ?? true,
  includeSwaps: account.includeSwaps ?? true,
  dailyResetTime: account.dailyResetTime || '',
  dailyResetTimezone: account.dailyResetTimezone || 'UTC',
  maxRiskPerTradePercent: account.maxRiskPerTradePercent ?? '',
  maxRiskPerTradeIdea: account.maxRiskPerTradeIdea ?? '',
  maxOpenPositions: account.maxOpenPositions ?? '',
  maxLotSize: account.maxLotSize ?? '',
  stopAfterLosses: account.stopAfterLosses ?? '',
  consistencyRuleEnabled: account.consistencyRuleEnabled ?? false,
  consistencyRuleType: account.consistencyRuleType || '',
  consistencyThreshold: account.consistencyThreshold ?? '',
  maximumBestDayPercent: account.maximumBestDayPercent ?? '',
  minimumProfitableDays: account.minimumProfitableDays ?? '',
  profitableDayMinimum: account.profitableDayMinimum ?? '',
  newsTradingAllowed: account.newsTradingAllowed ?? true,
  weekendHoldingAllowed: account.weekendHoldingAllowed ?? false,
  overnightHoldingAllowed: account.overnightHoldingAllowed ?? true,
  expertAdvisorsAllowed: account.expertAdvisorsAllowed ?? false,
  copyTradingAllowed: account.copyTradingAllowed ?? false,
  hedgingAllowed: account.hedgingAllowed ?? true,
  scalpingAllowed: account.scalpingAllowed ?? true,
  cryptoTradingAllowed: account.cryptoTradingAllowed ?? false,
  restrictedSymbols: (account.restrictedSymbols || []).join(', '),
  restrictedNewsBeforeMinutes: account.restrictedNewsBeforeMinutes ?? '',
  restrictedNewsAfterMinutes: account.restrictedNewsAfterMinutes ?? '',
  maximumInactivityDays: account.maximumInactivityDays ?? '',
  prohibitedStrategies: account.prohibitedStrategies || '',
  customRules: account.customRules || '',
  profitSplitPercent: account.profitSplitPercent ?? '',
  firstPayoutDate: toDateInput(account.firstPayoutDate),
  payoutFrequency: account.payoutFrequency || '',
  minimumPayoutAmount: account.minimumPayoutAmount ?? '',
  payoutCycleStartDate: toDateInput(account.payoutCycleStartDate),
  scalingPlanEnabled: account.scalingPlanEnabled ?? false,
  nextScalingTarget: account.nextScalingTarget ?? '',
  maximumAllocation: account.maximumAllocation ?? '',
});

const PropFirmAdvancedSettingsPage = () => {
  const [account, setAccount] = useState(null);
  const [initialValues, setInitialValues] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAccount = async () => {
      setIsFetching(true);
      try {
        const { data } = await api.get(`/accounts/prop-firm/${id}`);
        setAccount(data);
        setInitialValues(mapAccountToAdvancedSettings(data));
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load advanced settings');
        navigate('/accounts', { replace: true });
      } finally {
        setIsFetching(false);
      }
    };

    fetchAccount();
  }, [id, navigate]);

  const submit = async (payload) => {
    setIsSaving(true);
    try {
      await api.put(`/accounts/prop-firm/${id}/advanced-settings`, payload);
      toast.success('Advanced settings updated');
      navigate(`/accounts/${id}`);
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.message;
      toast.error(validationMessage || error.response?.data?.message || 'Failed to update advanced settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <button type="button" onClick={() => navigate(`/accounts/${id}`)} className="mb-3 inline-flex items-center gap-2 text-sm text-muted hover:text-green-400">
          <ArrowLeft size={16} /> Back to account
        </button>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Prop-firm account</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Advanced Settings</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Fine-tune rules after the account has been created.</p>
      </div>

      {isFetching ? (
        <div className="rounded-xl border border-border bg-surface-muted py-12 text-center text-muted">Loading advanced settings...</div>
      ) : (
        <PropFirmAdvancedSettings
          account={account}
          initialValues={initialValues}
          isSaving={isSaving}
          onCancel={() => navigate(`/accounts/${id}`)}
          onSubmit={submit}
        />
      )}
    </div>
  );
};

export default PropFirmAdvancedSettingsPage;
