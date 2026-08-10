import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import api from '../utils/api';
import { loadSettings } from '../utils/settings';
import AiDraftHelper from '../components/trades/review/AiDraftHelper';
import DirectionSelect from '../components/trades/DirectionSelect';
import SignedNumericInput from '../components/common/SignedNumericInput';

const emotionOptions = ['CALM', 'CONFIDENT', 'ANXIOUS', 'GREEDY', 'FEARFUL', 'ANGRY', 'FOMO', 'REVENGE_MINDSET', 'DISCIPLINED', 'REGRETFUL', 'FRUSTRATED'];
const stageOptions = ['BEFORE_TRADE', 'DURING_TRADE', 'AFTER_TRADE'];
const severityOptions = ['MINOR', 'MODERATE', 'MAJOR'];
const screenshotTypeOptions = ['HIGHER_TIMEFRAME_ANALYSIS', 'BEFORE_ENTRY', 'ENTRY', 'DURING_TRADE', 'EXIT', 'POST_ANALYSIS', 'MARKED_CHART'];

const defaultValues = {
  direction: 'BUY',
  session: 'LONDON',
  result: 'OPEN',
  status: 'PLANNED',
  followedPlan: '',
  isAPlusSetup: '',
  newsRelated: '',
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const booleanOrEmpty = (value) => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
};

const compactPayload = (data) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value === '' ? null : value]),
);

const emptyEmotion = () => ({
  stage: 'BEFORE_TRADE',
  emotion: 'CALM',
  intensity: 5,
  note: '',
});

const getFirstInstrument = (value) => String(value || '').split(',')[0]?.trim().toUpperCase() || '';

const getNewTradeDefaults = (settings, accounts) => {
  const defaultAccount = accounts.find((account) => account.id === settings.trading.defaultTradingAccountId) || accounts[0];

  return {
    ...defaultValues,
    tradingAccountId: defaultAccount?.id || '',
    pair: getFirstInstrument(settings.trading.mainPairs),
    strategyId: '',
    session: settings.trading.preferredSession || defaultValues.session,
    higherTimeframe: settings.trading.defaultHigherTimeframe || '',
    entryTimeframe: settings.trading.defaultEntryTimeframe || '',
    riskRewardRatio: settings.trading.minimumRiskRewardRatio || '',
    grade: settings.journal.defaultTradeGrade || '',
  };
};

const TradeForm = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [rules, setRules] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [checklistData, setChecklistData] = useState([]);
  const [existingScreenshots, setExistingScreenshots] = useState([]);
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [ruleViolations, setRuleViolations] = useState([]);
  const [emotionLogs, setEmotionLogs] = useState([]);
  const [deletingScreenshotId, setDeletingScreenshotId] = useState(null);
  const navigate = useNavigate();
  const appSettings = useMemo(() => loadSettings(), []);
  const { register, handleSubmit, reset, getValues, setValue, control, watch } = useForm({ defaultValues });

  const activeRules = useMemo(() => rules.filter((rule) => rule.active), [rules]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [accountsResponse, rulesResponse, strategiesResponse, tradeResponse] = await Promise.all([
          api.get('/accounts'),
          api.get('/rules'),
          api.get('/strategies'),
          isEditMode ? api.get(`/trades/${id}`) : Promise.resolve({ data: null }),
        ]);

        setAccounts(accountsResponse.data);
        setRules(rulesResponse.data);
        setStrategies(strategiesResponse.data);

        if (tradeResponse.data) {
          const trade = tradeResponse.data;
          reset({
            tradingAccountId: trade.tradingAccountId,
            pair: trade.pair || '',
            direction: trade.direction || 'BUY',
            strategyId: trade.strategyId || '',
            setupId: trade.setupId || '',
            session: trade.session || '',
            higherTimeframe: trade.higherTimeframe || '',
            entryTimeframe: trade.entryTimeframe || '',
            entryPrice: trade.entryPrice ?? '',
            exitPrice: trade.exitPrice ?? '',
            stopLoss: trade.stopLoss ?? '',
            takeProfit: trade.takeProfit ?? '',
            lotSize: trade.lotSize ?? '',
            riskAmount: trade.riskAmount ?? '',
            rewardAmount: trade.rewardAmount ?? '',
            riskRewardRatio: trade.riskRewardRatio ?? '',
            pips: trade.pips ?? '',
            entryTime: toDateTimeLocal(trade.entryTime),
            exitTime: toDateTimeLocal(trade.exitTime),
            result: trade.result || 'OPEN',
            status: trade.status || 'PLANNED',
            profitLossAmount: trade.profitLossAmount ?? '',
            profitLossPercent: trade.profitLossPercent ?? '',
            entryReason: trade.entryReason || '',
            exitReason: trade.exitReason || '',
            notesBefore: trade.notesBefore || '',
            notesAfter: trade.notesAfter || '',
            htfBias: trade.htfBias || '',
            grade: trade.grade || '',
            followedPlan: booleanOrEmpty(trade.followedPlan),
            isAPlusSetup: booleanOrEmpty(trade.isAPlusSetup),
            newsRelated: booleanOrEmpty(trade.newsRelated),
          });
          setExistingScreenshots(trade.screenshots || []);
          setRuleViolations((trade.ruleViolations || []).map((violation) => ({
            tradeRuleId: violation.tradeRuleId,
            severity: violation.severity || 'MINOR',
            note: violation.note || '',
          })));
          setEmotionLogs((trade.emotionLogs || []).map((log) => ({
            stage: log.stage,
            emotion: log.emotion,
            intensity: log.intensity,
            note: log.note || '',
          })));
          setChecklistData(trade.checklistResponses || []);
        } else if (accountsResponse.data.length > 0) {
          reset(getNewTradeDefaults(appSettings, accountsResponse.data));
          if (appSettings.journal.requireEmotionTracking) {
            setEmotionLogs([emptyEmotion()]);
          }
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'We couldn\'t load this trade for you.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [appSettings, id, isEditMode, reset]);

  useEffect(() => {
    const activeSetupId = watch('setupId');
    if (!activeSetupId || strategies.length === 0) return;

    let targetSetup = null;
    for (const strat of strategies) {
      const found = strat.setups.find((su) => su.id === activeSetupId);
      if (found) { targetSetup = found; break; }
    }

    if (targetSetup && targetSetup.checklistItems) {
      setChecklistData((current) => {
        return targetSetup.checklistItems.map((item) => {
          const existing = current.find((c) => c.checklistItemId === item.id);
          return {
            checklistItemId: item.id,
            title: item.title,
            sortOrder: item.sortOrder,
            checked: existing ? existing.checked : false,
          };
        }).sort((a, b) => a.sortOrder - b.sortOrder);
      });
    }
  }, [watch('setupId'), strategies]);

  const toggleChecklist = (checklistItemId) => {
    setChecklistData(current => current.map(item =>
      item.checklistItemId === checklistItemId ? { ...item, checked: !item.checked } : item
    ));
  };

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
      const payload = {
        ...compactPayload(data),
        ruleViolations,
        emotionLogs,
        checklistResponses: checklistData,
      };

      let tradeId = id;
      if (isEditMode) {
        await api.put(`/trades/${id}`, payload);
      } else {
        const response = await api.post('/trades', payload);
        tradeId = response.data.id;
        if (ruleViolations.length > 0 || emotionLogs.length > 0) {
          await api.put(`/trades/${tradeId}`, { ruleViolations, emotionLogs });
        }
      }

      if (screenshotFiles.length > 0) {
        await uploadScreenshots(tradeId);
      }

      toast.success(isEditMode ? 'Trade safely updated in your journal' : 'Trade safely logged in your journal');
      navigate(`/trades/${tradeId}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'We hit a snag saving this trade.');
    } finally {
      setIsSaving(false);
    }
  };

  const addRuleViolation = () => {
    if (activeRules.length === 0) {
      toast.error('Create an active trading rule before adding violations');
      return;
    }

    setRuleViolations((current) => [
      ...current,
      { tradeRuleId: activeRules[0].id, severity: 'MINOR', note: '' },
    ]);
  };

  const updateRuleViolation = (index, field, value) => {
    setRuleViolations((current) => current.map((violation, itemIndex) => (
      itemIndex === index ? { ...violation, [field]: value } : violation
    )));
  };

  const updateEmotion = (index, field, value) => {
    setEmotionLogs((current) => current.map((emotion, itemIndex) => (
      itemIndex === index ? { ...emotion, [field]: value } : emotion
    )));
  };

  const addScreenshotFile = (event) => {
    const files = Array.from(event.target.files || []);
    setScreenshotFiles((current) => [
      ...current,
      ...files.map((file) => ({ file, screenshotType: appSettings.screenshot.defaultScreenshotType || 'MARKED_CHART', note: '' })),
    ]);
    event.target.value = '';
  };

  const updateScreenshotFile = (index, field, value) => {
    setScreenshotFiles((current) => current.map((screenshot, itemIndex) => (
      itemIndex === index ? { ...screenshot, [field]: value } : screenshot
    )));
  };

  const deleteExistingScreenshot = async (screenshotId) => {
    if (!window.confirm('Are you sure you want to remove this piece of visual proof?')) return;

    setDeletingScreenshotId(screenshotId);
    try {
      await api.delete(`/screenshots/${screenshotId}`);
      setExistingScreenshots((current) => current.filter((screenshot) => screenshot.id !== screenshotId));
      toast.success('Visual proof removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t remove that screenshot.');
    } finally {
      setDeletingScreenshotId(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted">Preparing your journaling space...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto font-sans text-foreground">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{isEditMode ? 'Refine This Trade' : 'Log a New Trade'}</h2>
          <p className="text-sm text-muted">Capture the setup, psychology, and lessons from this session.</p>
        </div>
        {isEditMode && (
          <Link to={`/trades/${id}`} className="text-sm text-green-400 hover:text-green-300">Back to details</Link>
        )}
      </div>

      <div className="bg-surface-muted p-6 sm:p-8 rounded-xl shadow-lg border border-border">
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted mb-4">You'll need a trading account before logging your first trade.</p>
            <Link to="/accounts/new" className="inline-flex px-4 py-2 bg-green-500 text-gray-900 rounded-lg font-medium hover:bg-green-400 transition-colors">
              Set Up an Account
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <section>
              <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">The Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <label className="text-sm text-muted">
                  Account
                  <select required {...register('tradingAccountId')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Pair / Instrument
                  <input required {...register('pair')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 uppercase" placeholder="EURUSD" />
                </label>
                <label className="text-sm text-muted">
                  Direction
                  <Controller
                    name="direction"
                    control={control}
                    render={({ field }) => (
                      <DirectionSelect 
                        value={field.value} 
                        onChange={field.onChange} 
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </label>
                <label className="text-sm text-muted">
                  Strategy
                  <select {...register('strategyId')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                    <option value="">No Strategy</option>
                    {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Setup
                  <select {...register('setupId')} disabled={!watch('strategyId')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 disabled:opacity-50">
                    <option value="">No Setup</option>
                    {strategies.find(s => s.id === watch('strategyId'))?.setups.map(su => (
                      <option key={su.id} value={su.id}>{su.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Session
                  <select {...register('session')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                    <option value="">Unspecified</option>
                    <option value="ASIAN">Asian</option>
                    <option value="LONDON">London</option>
                    <option value="NEW_YORK">New York</option>
                    <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Higher Timeframe
                  <input {...register('higherTimeframe')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" placeholder="4H" />
                </label>
                <label className="text-sm text-muted">
                  Entry Timeframe
                  <input {...register('entryTimeframe')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" placeholder="15M" />
                </label>
                <label className="text-sm text-muted">
                  Grade
                  <select {...register('grade')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                    <option value="">Ungraded</option>
                    <option value="A_PLUS">A+</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="MISTAKE">Mistake</option>
                  </select>
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">Risk & Outcome</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {[
                  ['entryPrice', 'Entry Price', '0.00001'],
                  ['exitPrice', 'Exit Price', '0.00001'],
                  ['stopLoss', 'Stop Loss', '0.00001'],
                  ['takeProfit', 'Take Profit', '0.00001'],
                  ['lotSize', 'Position Size', '0.01'],
                  ['riskAmount', 'Risk Amount', '0.01'],
                  ['rewardAmount', 'Reward Amount', '0.01'],
                  ['riskRewardRatio', 'Risk/Reward', '0.01'],
                  ['pips', 'Pips', '0.1'],
                ].map(([name, label, step]) => (
                  <label key={name} className="text-sm text-muted">
                    {label}
                    <input type="number" step={step} inputMode="decimal" min="0" {...register(name)} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
                  </label>
                ))}
                <SignedNumericInput
                  label="Realised P/L ($)"
                  name="profitLossAmount"
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  step="0.01"
                  placeholder="0.00"
                />
                <SignedNumericInput
                  label="P/L %"
                  name="profitLossPercent"
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  step="0.01"
                  placeholder="0.00"
                />
                <label className="text-sm text-muted">
                  Result
                  <select {...register('result')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                    <option value="OPEN">Open</option>
                    <option value="WIN">Win</option>
                    <option value="LOSS">Loss</option>
                    <option value="BREAKEVEN">Break-even</option>
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Status
                  <select {...register('status')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                    <option value="PLANNED">Planned</option>
                    <option value="ACTIVE">Active</option>
                    <option value="CLOSED">Closed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
                <label className="text-sm text-muted">
                  Entry Time
                  <input type="datetime-local" {...register('entryTime')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
                </label>
                <label className="text-sm text-muted">
                  Exit Time
                  <input type="datetime-local" {...register('exitTime')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
                </label>
              </div>
            </section>

            {checklistData.length > 0 && (
              <section>
                <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">Execution Checklist</h3>
                <div className="space-y-3 max-w-xl">
                  {checklistData.map(item => (
                    <label key={item.checklistItemId} className="flex cursor-pointer items-start gap-4 rounded-xl border border-border bg-surface p-4 transition hover:bg-surface-muted hover:border-foreground/20">
                      <input 
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklist(item.checklistItemId)}
                        className="mt-0.5 h-5 w-5 rounded border-border text-green-500 bg-background"
                      />
                      <span className={`text-sm leading-6 ${item.checked ? 'text-muted line-through' : 'text-foreground font-medium'}`}>{item.title}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">Process & Discipline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  ['followedPlan', 'Followed Plan'],
                  ['isAPlusSetup', 'A+ Setup'],
                  ['newsRelated', 'News Related'],
                ].map(([name, label]) => (
                  <label key={name} className="text-sm text-muted">
                    {label}
                    <select {...register(name)} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
                      <option value="">Unspecified</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">Reflections</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="text-sm text-muted">
                  Entry Reason
                  <textarea rows="4" {...register('entryReason')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
                </label>
                <label className="text-sm text-muted">
                  Exit Details
                  <textarea rows="4" {...register('exitReason')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
                </label>
                <label className="text-sm text-muted">
                  Pre-Trade Notes
                  <textarea rows="4" {...register('notesBefore')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
                  <AiDraftHelper getValues={getValues} setValue={setValue} fieldName="notesBefore" draftType="BEFORE" />
                </label>
                <label className="text-sm text-muted">
                  Post-Trade Notes
                  <textarea rows="4" {...register('notesAfter')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
                  <AiDraftHelper getValues={getValues} setValue={setValue} fieldName="notesAfter" draftType="AFTER" />
                </label>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
                <h3 className="text-lg font-medium text-green-400">Rules & Deviations</h3>
                <button type="button" onClick={addRuleViolation} className="px-3 py-1.5 rounded-lg bg-gray-700 text-sm hover:bg-gray-600">Log Rule Event</button>
              </div>
              {ruleViolations.length === 0 ? (
                <p className="text-sm text-muted">Your discipline was solid here.</p>
              ) : (
                <div className="space-y-3">
                  {ruleViolations.map((violation, index) => (
                    <div key={`${violation.tradeRuleId}-${index}`} className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.4fr_auto] gap-3 rounded-lg border border-border bg-surface p-3">
                      <select value={violation.tradeRuleId} onChange={(event) => updateRuleViolation(index, 'tradeRuleId', event.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm">
                        {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}{rule.active ? '' : ' (inactive)'}</option>)}
                      </select>
                      <select value={violation.severity} onChange={(event) => updateRuleViolation(index, 'severity', event.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm">
                        {severityOptions.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                      </select>
                      <input value={violation.note} onChange={(event) => updateRuleViolation(index, 'note', event.target.value)} placeholder="Note" className="bg-background border border-border rounded-md py-2 px-3 text-sm" />
                      <button type="button" onClick={() => setRuleViolations((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400 hover:text-red-300 justify-self-start">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
                <h3 className="text-lg font-medium text-green-400">Emotional State</h3>
                <button type="button" onClick={() => setEmotionLogs((current) => [...current, emptyEmotion()])} className="px-3 py-1.5 rounded-lg bg-gray-700 text-sm hover:bg-gray-600">Log Emotion</button>
              </div>
              {emotionLogs.length === 0 ? (
                <p className="text-sm text-muted">The mind was quiet.</p>
              ) : (
                <div className="space-y-3">
                  {emotionLogs.map((emotion, index) => (
                    <div key={`${emotion.emotion}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.7fr_1.4fr_auto] gap-3 rounded-lg border border-border bg-surface p-3">
                      <select value={emotion.stage} onChange={(event) => updateEmotion(index, 'stage', event.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm">
                        {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                      </select>
                      <select value={emotion.emotion} onChange={(event) => updateEmotion(index, 'emotion', event.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm">
                        {emotionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <input type="number" min="1" max="10" value={emotion.intensity} onChange={(event) => updateEmotion(index, 'intensity', event.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm" />
                      <input value={emotion.note} onChange={(event) => updateEmotion(index, 'note', event.target.value)} placeholder="Note" className="bg-background border border-border rounded-md py-2 px-3 text-sm" />
                      <button type="button" onClick={() => setEmotionLogs((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400 hover:text-red-300 justify-self-start">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">Visual Proof</h3>
              {existingScreenshots.length > 0 && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {existingScreenshots.map((screenshot) => (
                    <div key={screenshot.id} className="rounded-lg border border-border bg-surface p-3">
                      <img src={screenshot.imageUrl} alt={screenshot.note || screenshot.screenshotType} className="aspect-video w-full rounded-md object-cover border border-border" />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted">{screenshot.screenshotType}</p>
                        <button type="button" disabled={deletingScreenshotId === screenshot.id} onClick={() => deleteExistingScreenshot(screenshot.id)} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60">
                          {deletingScreenshotId === screenshot.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input type="file" accept="image/*" multiple onChange={addScreenshotFile} className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-green-500 file:px-4 file:py-2 file:font-medium file:text-gray-900" />
              {screenshotFiles.length > 0 && (
                <div className="mt-4 space-y-3">
                  {screenshotFiles.map((screenshot, index) => (
                    <div key={`${screenshot.file.name}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 rounded-lg border border-border bg-surface p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{screenshot.file.name}</p>
                        <p className="text-xs text-muted">{Math.round(screenshot.file.size / 1024)} KB</p>
                      </div>
                      <select value={screenshot.screenshotType} onChange={(event) => updateScreenshotFile(index, 'screenshotType', event.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm">
                        {screenshotTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <button type="button" onClick={() => setScreenshotFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400 hover:text-red-300 justify-self-start">
                        <Trash2 size={18} />
                      </button>
                      <input value={screenshot.note} onChange={(event) => updateScreenshotFile(index, 'note', event.target.value)} placeholder="Screenshot note" className="md:col-span-3 bg-background border border-border rounded-md py-2 px-3 text-sm" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-border">
              <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 border border-gray-600 rounded-lg text-sm font-medium text-muted hover:bg-surface-muted transition">Go Back</button>
              <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-green-500 text-gray-900 rounded-lg text-sm font-bold shadow-md hover:bg-green-400 transition disabled:opacity-70">
                {isSaving ? 'Saving...' : isEditMode ? 'Update Journal' : 'Save to Journal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TradeForm;
