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
  accountName: account.tradingAccount?.name || '',
  firmName: account.firmName || '',
  customFirmName: account.customFirmName || '',
  programmeName: account.programmeName || '',
  accountSize: account.tradingAccount?.startingBalance ?? '',
  currency: account.tradingAccount?.currency || 'USD',
  platform: account.platform || account.tradingAccount?.platform || 'MT5',
  startDate: toDateInput(account.startDate),
  evaluationType: account.evaluationType || 'TWO_STEP',
  phaseCount: (account.phases || []).length,
  phases: (account.phases || []).map((phase) => ({
    name: phase.name || '',
    profitTargetPercent: phase.profitTargetPercent ?? '',
    minimumTradingDays: phase.minimumTradingDays ?? '',
    timeLimitType: phase.timeLimitType || 'UNLIMITED',
    timeLimitDays: phase.timeLimitDays ?? '',
  })),
  dailyLossPercent: account.dailyLossPercent ?? '',
  maximumLossPercent: account.maximumLossPercent ?? '',
  drawdownType: account.drawdownType || 'STATIC',
});

const PropFirmAccountForm = ({ editSection = 'full' }) => {
  const [initialValues, setInitialValues] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasTrades, setHasTrades] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const wizardMode = !isEditMode ? 'full' : editSection;
  const pageTitle = !isEditMode
    ? 'Create Prop-Firm Account'
    : editSection === 'account'
      ? 'Edit Account Details'
      : editSection === 'challenge'
        ? 'Edit Challenge Rules'
        : 'Edit Prop-Firm Account';
  const submitLabel = !isEditMode
    ? 'Create Prop-Firm Account'
    : editSection === 'account'
      ? 'Update Account Details'
      : editSection === 'challenge'
        ? 'Update Challenge Rules'
        : 'Update Prop-Firm Account';

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
      <div className="mb-6 rounded-xl border border-border bg-surface-muted p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Prop-firm account</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">{pageTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isEditMode ? 'Update this section without reopening every advanced rule.' : 'Create the account quickly now. Advanced rules can be configured after creation.'}
        </p>
      </div>

      {isFetching ? (
        <div className="rounded-xl border border-border bg-surface-muted py-12 text-center text-muted">Loading prop-firm account...</div>
      ) : (
        <PropFirmAccountWizard
          initialValues={initialValues}
          isSaving={isSaving}
          mode={wizardMode}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
};

export default PropFirmAccountForm;
