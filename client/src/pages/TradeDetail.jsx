import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Image as ImageIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const emotionOptions = ['CALM', 'CONFIDENT', 'ANXIOUS', 'GREEDY', 'FEARFUL', 'ANGRY', 'FOMO', 'REVENGE_MINDSET', 'DISCIPLINED', 'REGRETFUL', 'FRUSTRATED'];
const stageOptions = ['BEFORE_TRADE', 'DURING_TRADE', 'AFTER_TRADE'];
const screenshotTypeOptions = ['HIGHER_TIMEFRAME_ANALYSIS', 'BEFORE_ENTRY', 'ENTRY', 'DURING_TRADE', 'EXIT', 'POST_ANALYSIS', 'MARKED_CHART'];

const emptyEmotion = {
  stage: 'BEFORE_TRADE',
  emotion: 'CALM',
  intensity: 5,
  note: '',
};

const TradeDetail = () => {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screenshotForm, setScreenshotForm] = useState({ image: null, screenshotType: 'MARKED_CHART', note: '' });
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [deletingScreenshotId, setDeletingScreenshotId] = useState(null);
  const [emotionForm, setEmotionForm] = useState(emptyEmotion);
  const [editingEmotionId, setEditingEmotionId] = useState(null);
  const [savingEmotion, setSavingEmotion] = useState(false);
  const [deletingEmotionId, setDeletingEmotionId] = useState(null);

  const fetchTrade = useCallback(async () => {
    try {
      const { data } = await api.get(`/trades/${id}`);
      setTrade(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrade();
  }, [fetchTrade]);

  const handleScreenshotUpload = async (event) => {
    event.preventDefault();
    if (!screenshotForm.image) {
      toast.error('Choose an image first');
      return;
    }

    setUploadingScreenshot(true);
    try {
      const formData = new FormData();
      formData.append('image', screenshotForm.image);
      formData.append('screenshotType', screenshotForm.screenshotType);
      formData.append('note', screenshotForm.note);
      await api.post(`/trades/${id}/screenshots`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setScreenshotForm({ image: null, screenshotType: 'MARKED_CHART', note: '' });
      event.target.reset();
      toast.success('Screenshot uploaded');
      await fetchTrade();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload screenshot');
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const deleteScreenshot = async (screenshotId) => {
    if (!window.confirm('Delete this screenshot from the trade and Cloudinary?')) return;

    setDeletingScreenshotId(screenshotId);
    try {
      await api.delete(`/screenshots/${screenshotId}`);
      toast.success('Screenshot deleted');
      await fetchTrade();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete screenshot');
    } finally {
      setDeletingScreenshotId(null);
    }
  };

  const submitEmotion = async (event) => {
    event.preventDefault();
    setSavingEmotion(true);
    try {
      if (editingEmotionId) {
        await api.put(`/emotions/${editingEmotionId}`, emotionForm);
        toast.success('Emotion updated');
      } else {
        await api.post(`/trades/${id}/emotions`, emotionForm);
        toast.success('Emotion added');
      }
      setEmotionForm(emptyEmotion);
      setEditingEmotionId(null);
      await fetchTrade();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save emotion');
    } finally {
      setSavingEmotion(false);
    }
  };

  const startEditingEmotion = (emotionLog) => {
    setEditingEmotionId(emotionLog.id);
    setEmotionForm({
      stage: emotionLog.stage,
      emotion: emotionLog.emotion,
      intensity: emotionLog.intensity,
      note: emotionLog.note || '',
    });
  };

  const deleteEmotion = async (emotionId) => {
    if (!window.confirm('Delete this emotion log?')) return;

    setDeletingEmotionId(emotionId);
    try {
      await api.delete(`/emotions/${emotionId}`);
      toast.success('Emotion deleted');
      await fetchTrade();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete emotion');
    } finally {
      setDeletingEmotionId(null);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading trade details...</div>;
  if (!trade) return <div className="text-center py-12 text-red-400">Trade not found</div>;

  const screenshots = trade.screenshots || [];
  const emotionLogs = trade.emotionLogs || [];
  const ruleViolations = trade.ruleViolations || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/trades" className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              {trade.pair}
              <span className={`text-sm px-3 py-1 rounded-full ${trade.direction === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {trade.direction}
              </span>
            </h2>
            <p className="text-sm text-gray-400">{new Date(trade.entryTime || trade.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <Link to={`/trades/${id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400">
          <Edit3 size={18} />
          Edit Trade
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2 mb-4">Structural Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="block text-gray-500">Setup</span><span className="font-medium text-gray-200">{trade.setupType || 'N/A'}</span></div>
              <div><span className="block text-gray-500">Strategy</span><span className="font-medium text-gray-200">{trade.strategyName || 'N/A'}</span></div>
              <div><span className="block text-gray-500">Session</span><span className="font-medium text-gray-200">{trade.session || 'N/A'}</span></div>
              <div><span className="block text-gray-500">Timeframe</span><span className="font-medium text-gray-200">{trade.entryTimeframe || 'N/A'}</span></div>
              <div><span className="block text-gray-500">Followed Plan</span><span className="font-medium text-gray-200">{trade.followedPlan === null ? 'N/A' : trade.followedPlan ? 'Yes' : 'No'}</span></div>
              <div><span className="block text-gray-500">A+ Setup</span><span className="font-medium text-gray-200">{trade.isAPlusSetup === null ? 'N/A' : trade.isAPlusSetup ? 'Yes' : 'No'}</span></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <span className="block text-gray-500 mb-1">Pre-Trade Notes</span>
                <p className="text-gray-300 leading-relaxed bg-gray-900 p-3 rounded-lg min-h-24">{trade.notesBefore || 'No notes provided.'}</p>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Post-Trade Notes</span>
                <p className="text-gray-300 leading-relaxed bg-gray-900 p-3 rounded-lg min-h-24">{trade.notesAfter || 'No notes provided.'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2 mb-4">Screenshots & Charts</h3>
            <form onSubmit={handleScreenshotUpload} className="mb-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <input type="file" accept="image/*" onChange={(event) => setScreenshotForm((current) => ({ ...current, image: event.target.files?.[0] || null }))} className="text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-2 file:text-gray-100" />
              <select value={screenshotForm.screenshotType} onChange={(event) => setScreenshotForm((current) => ({ ...current, screenshotType: event.target.value }))} className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm">
                {screenshotTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <button type="submit" disabled={uploadingScreenshot} className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-60">
                {uploadingScreenshot ? 'Uploading...' : 'Upload'}
              </button>
              <input value={screenshotForm.note} onChange={(event) => setScreenshotForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" className="md:col-span-3 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm" />
            </form>
            {screenshots.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon size={48} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500">No charts attached to this trade.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {screenshots.map((screenshot) => (
                  <div key={screenshot.id} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <img src={screenshot.imageUrl} alt={screenshot.note || screenshot.screenshotType} className="w-full rounded-lg border border-gray-600" />
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-300">{screenshot.screenshotType}</p>
                        {screenshot.note && <p className="text-xs text-gray-500">{screenshot.note}</p>}
                      </div>
                      <button type="button" disabled={deletingScreenshotId === screenshot.id} onClick={() => deleteScreenshot(screenshot.id)} className="text-red-400 hover:text-red-300 disabled:opacity-60">
                        {deletingScreenshotId === screenshot.id ? 'Deleting...' : <Trash2 size={18} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2 mb-4">Emotion Logs</h3>
            <form onSubmit={submitEmotion} className="mb-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_0.7fr_auto] gap-3">
              <select value={emotionForm.stage} onChange={(event) => setEmotionForm((current) => ({ ...current, stage: event.target.value }))} className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm">
                {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
              <select value={emotionForm.emotion} onChange={(event) => setEmotionForm((current) => ({ ...current, emotion: event.target.value }))} className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm">
                {emotionOptions.map((emotion) => <option key={emotion} value={emotion}>{emotion}</option>)}
              </select>
              <input type="number" min="1" max="10" value={emotionForm.intensity} onChange={(event) => setEmotionForm((current) => ({ ...current, intensity: event.target.value }))} className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm" />
              <button type="submit" disabled={savingEmotion} className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-60">
                {savingEmotion ? 'Saving...' : editingEmotionId ? 'Update' : 'Add'}
              </button>
              <input value={emotionForm.note} onChange={(event) => setEmotionForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" className="md:col-span-4 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm" />
            </form>
            {emotionLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No emotion logs yet.</p>
            ) : (
              <div className="space-y-3">
                {emotionLogs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-200">{log.emotion} <span className="text-sm text-gray-500">at {log.stage}</span></p>
                      <p className="text-sm text-gray-400">Intensity {log.intensity}/10{log.note ? ` - ${log.note}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => startEditingEmotion(log)} className="text-sm text-blue-400 hover:text-blue-300">Edit</button>
                      <button type="button" disabled={deletingEmotionId === log.id} onClick={() => deleteEmotion(log.id)} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-60">
                        {deletingEmotionId === log.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2 mb-4">Execution Results</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-gray-200">{trade.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Result</span><span className={`font-bold ${trade.result === 'WIN' ? 'text-green-400' : trade.result === 'LOSS' ? 'text-red-400' : 'text-gray-300'}`}>{trade.result}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">P/L</span><span className={`font-bold ${trade.profitLossAmount > 0 ? 'text-green-400' : trade.profitLossAmount < 0 ? 'text-red-400' : 'text-gray-300'}`}>{trade.profitLossAmount > 0 ? '+$' : '$'}{trade.profitLossAmount || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk/Reward</span><span className="font-medium text-gray-200">{trade.riskRewardRatio || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Risk</span><span className="font-medium text-gray-200">{trade.riskAmount || 'N/A'}</span></div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2 mb-4">Rule Violations</h3>
            {ruleViolations.length === 0 ? (
              <p className="text-sm text-gray-500">No rule violations logged.</p>
            ) : (
              <div className="space-y-3">
                {ruleViolations.map((violation) => (
                  <div key={violation.id} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <p className="font-medium text-gray-200">{violation.tradeRule?.name || 'Rule'}</p>
                    <p className="text-xs text-gray-500">{violation.severity}{violation.note ? ` - ${violation.note}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeDetail;
