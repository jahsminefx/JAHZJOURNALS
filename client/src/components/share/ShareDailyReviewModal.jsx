import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import ShareDailyReviewCard from './ShareDailyReviewCard';

export default function ShareDailyReviewModal({ isOpen, onClose, dailyReviewId, summaryData }) {
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [includeAiReview, setIncludeAiReview] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isOpen && dailyReviewId) {
      initShareLink({ includeAiReview, includeNotes, includeScreenshots });
    }
  }, [isOpen, dailyReviewId]);

  const initShareLink = async (opts) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/daily-reviews/${dailyReviewId}/share`, opts);
      if (res.data?.success) {
        setShareData(res.data.data);
      }
    } catch (err) {
      console.error('Error generating daily review share link:', err);
      setError('Could not generate share link for daily review.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key, val) => {
    const nextOpts = {
      includeAiReview: key === 'ai' ? val : includeAiReview,
      includeNotes: key === 'notes' ? val : includeNotes,
      includeScreenshots: key === 'screenshots' ? val : includeScreenshots,
    };
    if (key === 'ai') setIncludeAiReview(val);
    if (key === 'notes') setIncludeNotes(val);
    if (key === 'screenshots') setIncludeScreenshots(val);

    await initShareLink(nextOpts);
  };

  const getFullPublicUrl = () => {
    if (!shareData?.shareToken) return '';
    return `${window.location.origin}/shared/daily-review/${shareData.shareToken}`;
  };

  const getShareText = () => {
    if (!summaryData?.metrics) return '';
    const m = summaryData.metrics;
    const currencyStr = m.currency || 'USD';
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const pnlStr = `${m.netProfitLoss >= 0 ? '+' : ''}${symbol}${Math.abs(m.netProfitLoss).toLocaleString()} ${currencyStr}`;

    return `I just reviewed my trading day with JAHZJOURNALS 📊\n\n` +
      `${summaryData.dateStr || 'Trading Day'}\n` +
      `${m.totalTrades} trades | ${m.winRate}% win rate\n` +
      `Net P/L: ${pnlStr}\n` +
      `Total Pips: ${m.totalPips || 0}\n\n` +
      `View Review: ${getFullPublicUrl()}`;
  };

  const handleCopyLink = async () => {
    const url = getFullPublicUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleTelegramShare = () => {
    const url = encodeURIComponent(getFullPublicUrl());
    const text = encodeURIComponent(getShareText());
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    const url = getFullPublicUrl();
    if (navigator.share && url) {
      try {
        await navigator.share({
          title: `Daily Trading Review — JAHZJOURNALS`,
          text: getShareText(),
          url,
        });
      } catch (err) {
        console.log('Native share cancelled:', err);
      }
    }
  };

  const handleRevokeShare = async () => {
    try {
      setLoading(true);
      await api.delete(`/daily-reviews/${dailyReviewId}/share`);
      setShareData(null);
      onClose();
    } catch (err) {
      console.error('Revoke failed:', err);
      setError('Could not revoke share link.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !dailyReviewId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-white mb-1">Share Daily Review</h3>
        <p className="text-xs text-slate-400 mb-5">
          Share your daily trading report with fellow traders or mentors. You control which notes or AI insights are visible.
        </p>

        {/* Card Preview */}
        <div className="mb-6 flex justify-center">
          <ShareDailyReviewCard summary={summaryData} cardRef={cardRef} />
        </div>

        {/* Selective Privacy Controls */}
        <div className="space-y-2 mb-5 bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Include JAHZ AI Coaching Review</span>
            <input
              type="checkbox"
              checked={includeAiReview}
              onChange={(e) => handleToggle('ai', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
            <span className="text-slate-300 font-medium">Include Journal Reflection Notes</span>
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => handleToggle('notes', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
            <span className="text-slate-300 font-medium">Include Trade Screenshots</span>
            <input
              type="checkbox"
              checked={includeScreenshots}
              onChange={(e) => handleToggle('screenshots', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            onClick={handleCopyLink}
            disabled={loading || !shareData}
            className="flex flex-col items-center justify-center p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg"
          >
            <span className="text-base mb-1">📋</span>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            onClick={handleWhatsAppShare}
            disabled={loading || !shareData}
            className="flex flex-col items-center justify-center p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg"
          >
            <span className="text-base mb-1">💬</span>
            WhatsApp
          </button>

          <button
            onClick={handleTelegramShare}
            disabled={loading || !shareData}
            className="flex flex-col items-center justify-center p-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg"
          >
            <span className="text-base mb-1">✈️</span>
            Telegram
          </button>

          {navigator.share ? (
            <button
              onClick={handleNativeShare}
              disabled={loading || !shareData}
              className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition border border-slate-700"
            >
              <span className="text-base mb-1">📲</span>
              Share
            </button>
          ) : (
            <button
              onClick={handleCopyLink}
              disabled={loading || !shareData}
              className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition border border-slate-700"
            >
              <span className="text-base mb-1">🔗</span>
              Share URL
            </button>
          )}
        </div>

        {/* Public URL Box */}
        {shareData?.shareToken && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 mb-4 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-300 truncate pr-2">
              {getFullPublicUrl()}
            </span>
            <button
              onClick={handleCopyLink}
              className="text-xs text-indigo-400 font-semibold px-2 py-1 hover:bg-indigo-950/60 rounded"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        {/* Revoke link */}
        {shareData?.isActive && (
          <div className="flex justify-end pt-2 border-t border-slate-800/80">
            <button
              onClick={handleRevokeShare}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium py-1 px-3"
            >
              Revoke Share Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
