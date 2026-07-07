import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import PropFirmAccountWizard from '../components/accounts/PropFirmAccountWizard';

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const mapPropFirmToForm = (account) => ({
  name: account.tradingAccount?.name || '',
  firmName: account.firmName || '',
  customFirmName: account.customFirmName || '',
  programmeName: account.programmeName || '',
  marketType: account.marketType || 'FOREX_CFD',
  accountSize: account.tradingAccount?.startingBalance ?? '',
  currentBalance: account.tradingAccount?.currentBalance ?? '',
  currency: account.tradingAccount?.currency || 'USD',
  platform: account.platform || account.tradingAccount?.platform || 'MT5',
  brokerServer: account.brokerServer || account.tradingAccount?.brokerName || '',
  challengeFee: account.challengeFee ?? '',
  startDate: toDateInput(account.startDate),
  accountType: account.tradingAccount?.accountType || '',
  evaluationType: account.evaluationType || 'TWO_STEP',
  accountStatus: account.accountStatus || 'NOT_STARTED',
  currentPhaseNumber: account.currentPhaseNumber ?? '',
  phases: (account.phases || []).map((phase) => ({
    phaseNumber: phase.phaseNumber,
    name: phase.name || '',
    profitTargetPercent: phase.profitTargetPercent ?? '',
    profitTargetAmount: phase.profitTargetAmount ?? '',
    minimumTradingDays: phase.minimumTradingDays ?? '',
    minimumProfitableDays: phase.minimumProfitableDays ?? '',
    maximumTradingDays: phase.maximumTradingDays ?? '',
    timeLimitType: phase.timeLimitType || 'UNLIMITED',
    timeLimitDays: phase.timeLimitDays ?? '',
    status: phase.status || 'NOT_STARTED',
  })),
  dailyLossEnabled: account.dailyLossEnabled,
  dailyLossPercent: account.dailyLossPercent ?? '',
  dailyLossAmount: account.dailyLossAmount ?? '',
  maximumLossPercent: account.maximumLossPercent ?? '',
  maximumLossAmount: account.maximumLossAmount ?? '',
  drawdownType: account.drawdownType || 'STATIC',
  dailyLossCalculationBasis: account.dailyLossCalculationBasis || 'INITIAL_BALANCE',
  overallLossCalculationBasis: account.overallLossCalculationBasis || 'INITIAL_BALANCE',
  includeFloatingPnl: account.includeFloatingPnl,
  includeCommissions: account.includeCommissions,
  includeSwaps: account.includeSwaps,
  dailyResetTime: account.dailyResetTime || '',
  dailyResetTimezone: account.dailyResetTimezone || 'UTC',
  maxRiskPerTradePercent: account.maxRiskPerTradePercent ?? '',
  maxRiskPerTradeIdea: account.maxRiskPerTradeIdea ?? '',
  maxOpenPositions: account.maxOpenPositions ?? '',
  maxLotSize: account.maxLotSize ?? '',
  stopAfterLosses: account.stopAfterLosses ?? '',
  consistencyRuleEnabled: account.consistencyRuleEnabled,
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
  scalingPlanEnabled: account.scalingPlanEnabled,
  nextScalingTarget: account.nextScalingTarget ?? '',
  maximumAllocation: account.maximumAllocation ?? '',
});

const PropFirmAccountForm = () => {
  const [initialValues, setInitialValues] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasTrades, setHasTrades] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  useEffect(() => {
    if (!isEditMode) return;

    const fetchAccount = async () => {
      setIsFetching(true);
      try {
        const { data } = await api.get(`/accounts/prop-firm/${id}`);
        setInitialValues(mapPropFirmToForm(data));
        setHasTrades((data.tradingAccount?.trades || []).length > 0);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load prop-firm account');
        navigate('/accounts', { replace: true });
      } finally {
        setIsFetching(false);
      }
    };

    fetchAccount();
  }, [id, isEditMode, navigate]);

  const onSubmit = async (payload) => {
    if (isEditMode && hasTrades && !window.confirm('This account already has trades. Rule changes will not delete trades, but they may change challenge tracking interpretation. Continue?')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = isEditMode
        ? await api.put(`/accounts/prop-firm/${id}`, payload)
        : await api.post('/accounts/prop-firm', payload);

      toast.success(isEditMode ? 'Prop-firm account updated' : 'Prop-firm account created');
      navigate(`/accounts/${response.data.tradingAccountId}`);
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.message;
      toast.error(validationMessage || error.response?.data?.message || 'Failed to save prop-firm account');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Prop-firm account</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-100">{isEditMode ? 'Edit Prop-Firm Account' : 'Create Prop-Firm Account'}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">Track a prop-firm evaluation, challenge, instant-funded, or funded account with dedicated rules.</p>
      </div>

      {isFetching ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 py-12 text-center text-gray-400">Loading prop-firm account...</div>
      ) : (
        <PropFirmAccountWizard
          initialValues={initialValues}
          isSaving={isSaving}
          onSubmit={onSubmit}
          submitLabel={isEditMode ? 'Update Prop-Firm Account' : 'Create Prop-Firm Account'}
        />
      )}
    </div>
  );
};

export default PropFirmAccountForm;
