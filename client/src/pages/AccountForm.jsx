import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import RegularAccountForm from '../components/accounts/RegularAccountForm';

const regularAccountTypes = new Set(['DEMO', 'PERSONAL_LIVE', 'PRACTICE', 'BROKER_FUNDED', 'OTHER']);

const mapAccountToForm = (account) => ({
  name: account.name || '',
  brokerName: account.brokerName || '',
  accountType: regularAccountTypes.has(account.accountType) ? account.accountType : 'OTHER',
  startingBalance: account.startingBalance ?? '',
  currentBalance: account.currentBalance ?? '',
  currency: account.currency || 'USD',
  platform: account.platform || '',
  riskPerTradePercent: account.riskPerTradePercent ?? account.defaultRiskPercent ?? '',
  maxDailyLossPercent: account.maxDailyLossPercent ?? '',
  maxTradesPerDay: account.maxTradesPerDay ?? '',
  maxLossesPerDay: account.maxLossesPerDay ?? '',
  notes: account.notes || '',
});

const AccountForm = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  useEffect(() => {
    if (!isEditMode) return;

    const fetchAccount = async () => {
      setIsFetching(true);
      try {
        const { data } = await api.get(`/accounts/${id}`);
        if (data.accountCategory === 'PROP_FIRM' || data.isPropFirmAccount) {
          navigate(`/accounts/${id}/prop-firm/edit`, { replace: true });
          return;
        }
        setInitialValues(mapAccountToForm(data));
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load account');
        navigate('/accounts', { replace: true });
      } finally {
        setIsFetching(false);
      }
    };

    fetchAccount();
  }, [id, isEditMode, navigate]);

  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/accounts/${id}`, data);
        toast.success('Regular account updated');
      } else {
        await api.post('/accounts', data);
        toast.success('Regular account created');
      }
      navigate('/accounts');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save account');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 rounded-xl border border-border bg-surface-muted p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Regular trading account</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">{isEditMode ? 'Edit Regular Account' : 'Create Regular Account'}</h2>
        <p className="mt-2 text-sm text-muted">Track a personal, demo, broker, or live trading account.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-6 shadow-lg">
        {isFetching ? (
          <div className="py-12 text-center text-muted">Loading account...</div>
        ) : (
          <RegularAccountForm
            initialValues={initialValues}
            isSaving={isSaving}
            onSubmit={onSubmit}
            onCancel={() => navigate(-1)}
            submitLabel={isEditMode ? 'Update Account' : 'Create Account'}
          />
        )}
      </div>
    </div>
  );
};

export default AccountForm;
