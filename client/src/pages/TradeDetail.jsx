import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Image as ImageIcon, Trash2, Brain } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DeleteTradeDialog from '../components/trades/DeleteTradeDialog';

const TradeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trade, setTrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingTrade, setDeletingTrade] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  const fetchTrade = useCallback(async () => {
    try {
      const { data } = await api.get(`/trades/${id}`);
      setTrade(data);
      if (data.aiReviews && data.aiReviews.length > 0) {
        setAiInsight(data.aiReviews[0].structuredOutput || {
          strengths: data.aiReviews[0].strengths?.split(',') || [],
          weaknesses: data.aiReviews[0].mistakes?.split(',') || [],
          actionableAdvice: data.aiReviews[0].recommendation || '',
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t load this trade. Let\'s try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrade();
  }, [fetchTrade]);

  const requestAiReview = async () => {
    setIsGeneratingAi(true);
    toast.loading('Analyzing trade execution data...', { id: 'aiToast' });
    try {
      const { data } = await api.post(`/ai/trade-insight/${id}`);
      setAiInsight(data.insight);
      toast.success('AI Mentor analysis complete!', { id: 'aiToast' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate AI insight.', { id: 'aiToast' });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const deleteTrade = async () => {
    if (!trade || deletingTrade) return;

    setDeletingTrade(true);
    try {
      await api.delete(`/trades/${id}`);
      toast.success('Trade removed from your journal.');
      navigate('/trades');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t remove that trade right now.');
    } finally {
      setDeletingTrade(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-muted">Loading your trade...</div>;
  if (!trade) return <div className="text-center py-12 text-red-400">We couldn't find that trade.</div>;

  const screenshots = trade.screenshots || [];
  const emotionLogs = trade.emotionLogs || [];
  const ruleViolations = trade.ruleViolations || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/trades" className="p-2 bg-surface-muted text-muted rounded-lg hover:bg-surface-muted hover:text-gray-900 dark:hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              {trade.pair}
              <span className={`text-sm px-3 py-1 rounded-full ${trade.direction === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {trade.direction}
              </span>
            </h2>
            <p className="text-sm text-muted">{new Date(trade.entryTime || trade.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!aiInsight && (
            <button
              onClick={requestAiReview}
              disabled={isGeneratingAi}
              className="hidden sm:inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
            >
              <Brain size={18} />
              {isGeneratingAi ? 'Analyzing...' : 'AI Mentor'}
            </button>
          )}
          <Link to={`/trades/${id}/review`} className="hidden sm:inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400 hover:bg-green-500/20">
            Deep Review
          </Link>
          <Link to={`/trades/${id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400">
            <Edit3 size={18} />
            Quick Edit
          </Link>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deletingTrade}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={18} />
            {deletingTrade ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>

      <DeleteTradeDialog
        trade={trade}
        isOpen={showDeleteDialog}
        isDeleting={deletingTrade}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={deleteTrade}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {aiInsight && (
            <div className="bg-purple-500/10 p-6 rounded-xl border border-purple-500/30 shadow-lg">
              <h3 className="text-lg font-bold text-purple-400 border-b border-purple-500/30 pb-2 mb-4 flex items-center gap-2">
                <Brain size={20} /> AI Mentor Breakdown
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-muted mb-2">Strengths</h4>
                  <ul className="list-disc list-inside text-sm text-muted space-y-1">
                    {aiInsight.strengths?.map((str, idx) => <li key={idx}>{str}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-muted mb-2">Weaknesses</h4>
                  <ul className="list-disc list-inside text-sm text-muted space-y-1">
                    {aiInsight.weaknesses?.map((wk, idx) => <li key={idx}>{wk}</li>)}
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <h4 className="font-semibold text-purple-300 mb-2">Actionable Advice</h4>
                <p className="text-sm text-purple-200/80 italic">"{aiInsight.actionableAdvice}"</p>
              </div>
            </div>
          )}

          <div className="bg-surface-muted p-6 rounded-xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-border pb-2 mb-4">Trade Context</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="block text-muted">Setup</span><span className="font-medium text-foreground">{trade.setupType || 'N/A'}</span></div>
              <div><span className="block text-muted">Strategy</span><span className="font-medium text-foreground">{trade.strategyName || 'N/A'}</span></div>
              <div><span className="block text-muted">Session</span><span className="font-medium text-foreground">{trade.session || 'N/A'}</span></div>
              <div><span className="block text-muted">Timeframe</span><span className="font-medium text-foreground">{trade.entryTimeframe || 'N/A'}</span></div>
              <div><span className="block text-muted">Followed Plan</span><span className="font-medium text-foreground">{trade.followedPlan === null ? 'N/A' : trade.followedPlan ? 'Yes' : 'No'}</span></div>
              <div><span className="block text-muted">A+ Setup</span><span className="font-medium text-foreground">{trade.isAPlusSetup === null ? 'N/A' : trade.isAPlusSetup ? 'Yes' : 'No'}</span></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <span className="block text-muted mb-1">Thoughts Before</span>
                <p className="text-muted leading-relaxed bg-surface p-3 rounded-lg min-h-24">{trade.notesBefore || 'No thoughts recorded yet.'}</p>
              </div>
              <div>
                <span className="block text-muted mb-1">Reflections After</span>
                <p className="text-muted leading-relaxed bg-surface p-3 rounded-lg min-h-24">{trade.notesAfter || 'No reflections recorded yet.'}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-muted p-6 rounded-xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-border pb-2 mb-4">Chart Screenshots</h3>
            {screenshots.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon size={48} className="mx-auto text-gray-600 mb-3" />
                <p className="text-muted">No charts attached yet. Add them in the review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {screenshots.map((screenshot) => (
                  <div key={screenshot.id} className="rounded-lg border border-border bg-surface p-3">
                    <img src={screenshot.imageUrl} alt={screenshot.note || screenshot.screenshotType} className="w-full rounded-lg border border-gray-600" />
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-muted">{screenshot.screenshotType}</p>
                      {screenshot.note && <p className="text-xs text-muted">{screenshot.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-muted p-6 rounded-xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-border pb-2 mb-4">How You Felt</h3>
            {emotionLogs.length === 0 ? (
              <p className="text-sm text-muted">No emotions logged yet. Reflect on how you felt during the review.</p>
            ) : (
              <div className="space-y-3">
                {emotionLogs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{log.emotion} <span className="text-sm text-muted">at {log.stage}</span></p>
                      <p className="text-sm text-muted">Intensity {log.intensity}/10{log.note ? ` - ${log.note}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-muted p-6 rounded-xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-border pb-2 mb-4">Outcome</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-muted">Status</span><span className="font-medium text-foreground">{trade.status}</span></div>
              <div className="flex justify-between"><span className="text-muted">Result</span><span className={`font-bold ${trade.result === 'WIN' ? 'text-green-400' : trade.result === 'LOSS' ? 'text-red-400' : 'text-muted'}`}>{trade.result}</span></div>
              <div className="flex justify-between"><span className="text-muted">P/L</span><span className={`font-bold ${trade.profitLossAmount > 0 ? 'text-green-400' : trade.profitLossAmount < 0 ? 'text-red-400' : 'text-muted'}`}>{trade.profitLossAmount > 0 ? '+$' : '$'}{trade.profitLossAmount || 0}</span></div>
              <div className="flex justify-between"><span className="text-muted">Risk/Reward</span><span className="font-medium text-foreground">{trade.riskRewardRatio || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted">Risk</span><span className="font-medium text-foreground">{trade.riskAmount || 'N/A'}</span></div>
            </div>
          </div>

          <div className="bg-surface-muted p-6 rounded-xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-border pb-2 mb-4">Rules Broken</h3>
            {ruleViolations.length === 0 ? (
              <p className="text-sm text-muted">No rules broken — well done.</p>
            ) : (
              <div className="space-y-3">
                {ruleViolations.map((violation) => (
                  <div key={violation.id} className="rounded-lg border border-border bg-surface p-3">
                    <p className="font-medium text-foreground">{violation.tradeRule?.name || 'Rule'}</p>
                    <p className="text-xs text-muted">{violation.severity}{violation.note ? ` - ${violation.note}` : ''}</p>
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
