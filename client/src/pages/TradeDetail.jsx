import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Image as ImageIcon, Trash2, Brain, Maximize2, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { resolveImageUrl } from '../utils/api';
import DeleteTradeDialog from '../components/trades/DeleteTradeDialog';
import ImageModal from '../components/common/ImageModal';
import ShareTradeModal from '../components/share/ShareTradeModal';

const TradeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trade, setTrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingTrade, setDeletingTrade] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [analyzingScreenshotId, setAnalyzingScreenshotId] = useState(null);
  const [visionInsights, setVisionInsights] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [activeModalImage, setActiveModalImage] = useState(null);

  const fetchTrade = useCallback(async () => {
    try {
      const { data } = await api.get(`/trades/${id}`);
      setTrade(data);
      if (data.aiReviews && data.aiReviews.length > 0) {
        const review = data.aiReviews[0];
        const output = review.structuredOutput || {};
        const strengthsList = Array.isArray(output.strengths) ? output.strengths : (review.strengths ? review.strengths.split(',').filter(Boolean) : []);
        const weaknessesList = Array.isArray(output.weaknesses) ? output.weaknesses : (Array.isArray(output.mistakes) ? output.mistakes : (review.mistakes ? review.mistakes.split(',').filter(Boolean) : []));
        const advice = output.actionableAdvice || output.recommendedAction || output.summary || review.recommendation || '';

        if (strengthsList.length > 0 || weaknessesList.length > 0 || advice) {
          setAiInsight({
            strengths: strengthsList,
            weaknesses: weaknessesList,
            actionableAdvice: advice,
            ruleFeedback: output.ruleFeedback || [],
            psychologyFeedback: output.psychologyFeedback || [],
            disciplineScore: output.disciplineScore ?? review.disciplineScore,
            disclaimer: output.educationalDisclaimer || output.disclaimer || null
          });
        } else {
          setAiInsight(null);
        }
      } else {
        setAiInsight(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t load this trade. Let\'s try again.');
    }

    try {
      const visionRes = await api.get(`/ai/vision-insights/trade/${id}`);
      const insightsMap = {};
      visionRes.data.forEach(req => {
         if (req.inputSnapshot?.screenshotId && !insightsMap[req.inputSnapshot.screenshotId]) {
             insightsMap[req.inputSnapshot.screenshotId] = req;
         }
      });
      setVisionInsights(insightsMap);
    } catch (error) {
      console.error(error);
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
      await api.post(`/ai/trade-insight/${id}`);
      toast.loading('Analysis queued. Please wait...', { id: 'aiToast' });
      // The poll effect will catch it and refresh automatically
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to queue AI insight.', { id: 'aiToast' });
      setIsGeneratingAi(false);
    }
  };

  // Poll for completion if a review is processing
  useEffect(() => {
    let intervalId;
    const activeReview = trade?.aiReviews?.[0];
    const isTradeAiProcessing = activeReview && (activeReview.reviewStatus === 'PROCESSING' || activeReview.reviewStatus === 'QUEUED');
    const isVisionProcessing = Object.values(visionInsights).some(v => v.status === 'QUEUED' || v.status === 'PROCESSING');

    if (isTradeAiProcessing || isVisionProcessing) {
      if (isTradeAiProcessing) setIsGeneratingAi(true);
      
      intervalId = setInterval(async () => {
        try {
           await fetchTrade();
           
           // Toast conditions manually inside effect scope could be complex, relying on fetchTrade state updating
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    } else {
      setIsGeneratingAi(false);
      setAnalyzingScreenshotId(null);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [trade?.aiReviews, visionInsights, fetchTrade]);

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

  const analyzeScreenshotImage = async (screenshotId) => {
    setAnalyzingScreenshotId(screenshotId);
    toast.loading('Queueing chart for AI analysis...', { id: 'visionAiToast' });
    try {
      await api.post(`/ai/vision-analysis`, { screenshotId });
      toast.success('Vision AI Analysis queued!', { id: 'visionAiToast' });
      fetchTrade(); // Refresh to show processing status
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process chart vision.', { id: 'visionAiToast' });
      setAnalyzingScreenshotId(null);
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
          <button
            onClick={requestAiReview}
            disabled={isGeneratingAi}
            className="hidden sm:inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
          >
            <Brain size={18} />
            {isGeneratingAi ? 'Analyzing...' : aiInsight ? 'Re-analyze' : 'AI Mentor'}
          </button>
          <Link to={`/trades/${id}/review`} className="hidden sm:inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400 hover:bg-green-500/20">
            Deep Review
          </Link>
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-bold text-indigo-300 hover:bg-indigo-500/20"
          >
            <Share2 size={18} />
            Share Trade
          </button>
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
                    {aiInsight.weaknesses?.map((wk, idx) => <li key={idx}>{wk}</li>) || aiInsight.mistakes?.map((wk, idx) => <li key={idx}>{wk}</li>) || <li>None recorded</li>}
                  </ul>
                </div>
              </div>
              
              {(aiInsight.ruleFeedback?.length > 0 || aiInsight.psychologyFeedback?.length > 0) && (
                <div className="grid md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-purple-500/30">
                  {aiInsight.ruleFeedback?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-muted mb-2">Discipline & Rules</h4>
                      <ul className="list-disc list-inside text-sm text-muted space-y-1">
                        {aiInsight.ruleFeedback.map((fb, idx) => <li key={idx}>{fb}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiInsight.psychologyFeedback?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-muted mb-2">Psychology</h4>
                      <ul className="list-disc list-inside text-sm text-muted space-y-1">
                        {aiInsight.psychologyFeedback.map((fb, idx) => <li key={idx}>{fb}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <h4 className="font-semibold text-purple-300 mb-2 flex justify-between">
                  <span>Actionable Advice</span>
                  {aiInsight.disciplineScore !== undefined && (
                    <span className="text-sm font-normal">Discipline Score: {aiInsight.disciplineScore}/100</span>
                  )}
                </h4>
                <p className="text-sm text-purple-200/80 italic">"{aiInsight.actionableAdvice || aiInsight.recommendedAction}"</p>
                {aiInsight.disclaimer && (
                  <p className="text-xs text-muted mt-2 opacity-70">Disclaimer: {aiInsight.disclaimer}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-surface-muted p-6 rounded-xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-green-400 border-b border-border pb-2 mb-4">Trade Context</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="block text-muted">Setup</span><span className="font-medium text-foreground">{trade.setup?.name || 'N/A'}</span></div>
              <div><span className="block text-muted">Strategy</span><span className="font-medium text-foreground">{trade.strategy?.name || 'N/A'}</span></div>
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
                {screenshots.map((screenshot) => {
                  const visionData = visionInsights[screenshot.id];
                  const isProcessing = visionData?.status === 'QUEUED' || visionData?.status === 'PROCESSING' || analyzingScreenshotId === screenshot.id;
                  
                  return (
                    <div key={screenshot.id} className="rounded-lg border border-border bg-surface p-3">
                      <div
                        className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/60"
                        onClick={() => setActiveModalImage(screenshot)}
                        title="Click to view full screen chart"
                      >
                        <img
                          src={resolveImageUrl(screenshot.imageUrl)}
                          alt={screenshot.note || screenshot.screenshotType}
                          className="w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg">
                            <Maximize2 size={14} /> View Full Chart
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                           <p className="text-xs font-semibold text-muted">{screenshot.screenshotType}</p>
                           <button 
                             onClick={() => analyzeScreenshotImage(screenshot.id)}
                             disabled={isProcessing}
                             className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 disabled:opacity-50"
                           >
                              <Brain size={12} /> {isProcessing ? 'Analyzing...' : 'Analyze with AI'}
                           </button>
                        </div>
                        {screenshot.note && <p className="text-xs text-muted whitespace-pre-wrap mb-2">User Note: {screenshot.note}</p>}
                        
                        {visionData && (
                           <div className="mt-2 p-3 bg-purple-500/10 rounded-md border border-purple-500/20 text-xs">
                             <div className="flex justify-between items-center mb-1">
                               <p className="font-bold text-purple-400">AI Observation</p>
                               {visionData.status === 'FAILED' && <span className="text-red-400">Failed</span>}
                               {visionData.status === 'COMPLETED' && <span className="text-green-400 text-[10px]">Confidence: {visionData.structuredOutput?.confidenceLevel}</span>}
                             </div>
                             {visionData.status === 'COMPLETED' && visionData.structuredOutput && (
                               <div className="space-y-2 mt-2">
                                  <ul className="list-disc list-inside text-purple-200/90 leading-relaxed space-y-1">
                                    {visionData.structuredOutput.observations.map((obs, i) => {
                                      let text = obs;
                                      if (typeof obs === 'string' && (obs.startsWith('{') || obs.startsWith('['))) {
                                        try {
                                          const parsed = JSON.parse(obs);
                                          text = typeof parsed === 'object' ? Object.values(parsed).filter(Boolean).join(' ') : parsed;
                                        } catch (_) {}
                                      }
                                      return <li key={i}>{text}</li>;
                                    })}
                                  </ul>
                                  {visionData.structuredOutput.patterns?.length > 0 && (
                                    <p className="text-purple-300"><span className="font-semibold">Patterns:</span> {visionData.structuredOutput.patterns.join(', ')}</p>
                                  )}
                                  <p className="text-muted opacity-75 mt-2 italic border-l-2 border-purple-500/30 pl-2">
                                    {visionData.structuredOutput.educationalDisclaimer} {visionData.structuredOutput.uncertaintyNotice}
                                  </p>
                               </div>
                             )}
                           </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      <ImageModal
        isOpen={!!activeModalImage}
        onClose={() => setActiveModalImage(null)}
        imageUrl={activeModalImage?.imageUrl}
        title={activeModalImage?.screenshotType}
        note={activeModalImage?.note}
      />

      <ShareTradeModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        trade={trade}
      />
    </div>
  );
};

export default TradeDetail;
