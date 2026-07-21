import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';

import TradeContextReview from './review/TradeContextReview';
import ProcessQualityReview from './review/ProcessQualityReview';
import TradeReflectionReview from './review/TradeReflectionReview';
import RuleViolationEditor from './review/RuleViolationEditor';
import EmotionLogEditor from './review/EmotionLogEditor';
import ScreenshotManager from './review/ScreenshotManager';

const booleanOrEmpty = (value) => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
};

const buildReviewPayload = (data, ruleViolations, emotionLogs) => {
  const payload = { ...data };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') payload[key] = null;
  });
  
  // Transform boolean strings back to booleans explicitly
  if (payload.followedPlan === 'true') payload.followedPlan = true;
  if (payload.followedPlan === 'false') payload.followedPlan = false;
  if (payload.isAPlusSetup === 'true') payload.isAPlusSetup = true;
  if (payload.isAPlusSetup === 'false') payload.isAPlusSetup = false;
  if (payload.newsRelated === 'true') payload.newsRelated = true;
  if (payload.newsRelated === 'false') payload.newsRelated = false;

  return {
    ...payload,
    ruleViolations,
    emotionLogs,
  };
};

const TradeReviewForm = ({ trade, activeRules }) => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [ruleViolations, setRuleViolations] = useState(
    (trade.ruleViolations || []).map((v) => ({ ...v, note: v.note || '' }))
  );
  const [emotionLogs, setEmotionLogs] = useState(
    (trade.emotionLogs || []).map((log) => ({ ...log, note: log.note || '' }))
  );
  const [existingScreenshots, setExistingScreenshots] = useState(trade.screenshots || []);
  const [screenshotFiles, setScreenshotFiles] = useState([]);

  const { register, handleSubmit, watch, getValues, setValue } = useForm({
    defaultValues: {
      session: trade.session || '',
      higherTimeframe: trade.higherTimeframe || '',
      entryTimeframe: trade.entryTimeframe || '',
      htfBias: trade.htfBias || '',
      followedPlan: booleanOrEmpty(trade.followedPlan),
      isAPlusSetup: booleanOrEmpty(trade.isAPlusSetup),
      newsRelated: booleanOrEmpty(trade.newsRelated),
      grade: trade.grade || '',
      entryReason: trade.entryReason || '',
      exitReason: trade.exitReason || '',
      notesBefore: trade.notesBefore || '',
      notesAfter: trade.notesAfter || '',
    }
  });

  const uploadScreenshots = async (tradeId) => {
    for (const screenshot of screenshotFiles) {
      const formData = new FormData();
      formData.append('image', screenshot.file);
      formData.append('screenshotType', screenshot.screenshotType);
      formData.append('note', screenshot.note || '');
      await api.post(`/trades/${tradeId}/screenshots`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
  };

  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      const payload = buildReviewPayload(data, ruleViolations, emotionLogs);
      
      await api.put(`/trades/${trade.id}/review`, payload);

      if (screenshotFiles.length > 0) {
        await uploadScreenshots(trade.id);
      }

      toast.success('Review saved — another step toward clarity.');
      navigate(`/trades/${trade.id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t save your review right now. Let\'s try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <TradeContextReview register={register} />
      <ProcessQualityReview register={register} watch={watch} />
      <TradeReflectionReview register={register} getValues={getValues} setValue={setValue} />
      <RuleViolationEditor ruleViolations={ruleViolations} setRuleViolations={setRuleViolations} activeRules={activeRules} />
      <EmotionLogEditor emotionLogs={emotionLogs} setEmotionLogs={setEmotionLogs} />
      <ScreenshotManager 
        tradeId={trade.id} 
        existingScreenshots={existingScreenshots} 
        setExistingScreenshots={setExistingScreenshots} 
        screenshotFiles={screenshotFiles} 
        setScreenshotFiles={setScreenshotFiles} 
      />

      <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-border">
        <button type="button" onClick={() => navigate(-1)} className="w-full sm:w-auto px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-surface-muted transition">Go Back</button>
        <button type="submit" disabled={isSaving} className="w-full sm:w-auto px-6 py-2.5 bg-green-500 text-gray-900 rounded-lg text-sm font-bold shadow-md hover:bg-green-400 transition disabled:opacity-70">
          {isSaving ? 'Saving Review...' : 'Save My Review'}
        </button>
      </div>
    </form>
  );
};

export default TradeReviewForm;
