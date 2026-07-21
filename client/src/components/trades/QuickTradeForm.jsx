import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import TradeSetupSection from './quick/TradeSetupSection';
import TradePriceRiskSection from './quick/TradePriceRiskSection';
import CalculatedTradeSummary from './quick/CalculatedTradeSummary';
import TradeQuickContextSection from './quick/TradeQuickContextSection';

const compactPayload = (data) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value === '' ? null : value]),
);

const QuickTradeForm = ({ initialData, accounts, strategies, isEditMode, tradeId }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const navigate = useNavigate();

  const { register, handleSubmit, watch, control } = useForm({ defaultValues: initialData });

  const status = watch('status');

  const uploadScreenshots = async (targetTradeId) => {
    for (const screenshot of screenshotFiles) {
      const formData = new FormData();
      formData.append('image', screenshot.file);
      formData.append('screenshotType', screenshot.screenshotType);
      formData.append('note', screenshot.note || '');
      await api.post(`/trades/${targetTradeId}/screenshots`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
  };

  const onSubmit = async (data, actionType) => {
    setIsSaving(true);
    try {
      const payload = compactPayload(data);
      let newOrUpdateTradeId = tradeId;

      // 1. Pre-trade rule evaluation check (only on creation)
      if (!isEditMode) {
        try {
          const evalRes = await api.post('/trades/pre-trade-check', payload);
          const evaluation = evalRes.data;
          
          if (!evaluation.allowed) {
            toast.error(`Trade Blocked: ${evaluation.hardBlocks.join(' ')}`, { duration: 6000 });
            setIsSaving(false);
            return;
          }
          
          if (evaluation.warnings?.length > 0) {
            const proceed = window.confirm(`Rule Warnings:\n\n${evaluation.warnings.join('\n')}\n\nDo you want to overrule these warnings and save anyway?`);
            if (!proceed) {
              setIsSaving(false);
              return;
            }
          }
        } catch (e) {
          console.error('Pre-trade check failed, proceeding anyway', e);
        }
      }

      if (isEditMode) {
        await api.put(`/trades/${tradeId}`, payload);
      } else {
        const response = await api.post('/trades', payload);
        newOrUpdateTradeId = response.data.id;
      }

      if (screenshotFiles.length > 0) {
        await uploadScreenshots(newOrUpdateTradeId);
      }

      toast.success(isEditMode ? 'Trade updated — nice work.' : 'Trade logged. Keep building the record.');
      
      if (actionType === 'REVIEW') {
        navigate(`/trades/${newOrUpdateTradeId}/review`);
      } else {
        navigate(`/trades/${newOrUpdateTradeId}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong saving your trade. Let\'s try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface-muted p-6 sm:p-8 rounded-xl shadow-lg border border-border">
      <form className="space-y-8">
        <TradeSetupSection register={register} control={control} accounts={accounts} status={status} />
        <TradePriceRiskSection register={register} status={status} />
        <CalculatedTradeSummary watch={watch} status={status} />
        <TradeQuickContextSection register={register} watch={watch} strategies={strategies} screenshotFiles={screenshotFiles} setScreenshotFiles={setScreenshotFiles} />

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-border">
          <button type="button" onClick={() => navigate(-1)} className="w-full sm:w-auto px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-surface-muted transition">Go Back</button>
          <button 
            type="button" 
            onClick={handleSubmit((data) => onSubmit(data, 'SAVE'))} 
            disabled={isSaving} 
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white dark:bg-gray-700 dark:text-foreground rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 dark:hover:bg-gray-600 transition disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Trade')}
          </button>
          <button 
            type="button" 
            onClick={handleSubmit((data) => onSubmit(data, 'REVIEW'))} 
            disabled={isSaving} 
            className="w-full sm:w-auto px-5 py-2.5 bg-green-500 text-gray-900 rounded-lg text-sm font-bold shadow-md hover:bg-green-400 transition disabled:opacity-70"
          >
            Save & Begin Review
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickTradeForm;
