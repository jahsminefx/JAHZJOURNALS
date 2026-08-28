import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import ShareTradeCard from './ShareTradeCard';

export default function ShareTradeModal({ isOpen, onClose, trade }) {
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isOpen && trade?.id) {
      initShareLink(false);
    }
  }, [isOpen, trade?.id]);

  const initShareLink = async (screenshotToggle) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/trades/${trade.id}/share`, {
        includeScreenshot: screenshotToggle,
      });

      if (res.data?.success) {
        setShareData(res.data.data);
      }
    } catch (err) {
      console.error('Error generating share link:', err);
      setError('Could not generate share link.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleScreenshot = async (e) => {
    const newVal = e.target.checked;
    setIncludeScreenshot(newVal);
    await initShareLink(newVal);
  };

  const getFullPublicUrl = () => {
    if (!shareData?.shareToken) return '';
    return `${window.location.origin}/shared/trade/${shareData.shareToken}`;
  };

  const getShareText = () => {
    if (!trade) return '';
    const currencyStr = trade.currency || 'USD';
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const pnlStr = `${trade.profitLossAmount >= 0 ? '+' : ''}${symbol}${Math.abs(trade.profitLossAmount).toLocaleString()} ${currencyStr}`;

    return `I just tracked a verified trade on JAHZJOURNALS 📊\n\n` +
      `${trade.pair} ${trade.direction} — ${trade.result}\n` +
      `P/L: ${pnlStr}\n` +
      `Pips: ${trade.pips || 0}\n` +
      `R:R: 1:${trade.riskRewardRatio || 0}\n\n` +
      `View Trade: ${getFullPublicUrl()}`;
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

  const handleNativeShare = async () => {
    const url = getFullPublicUrl();
    if (navigator.share && url) {
      try {
        await navigator.share({
          title: `${trade.pair} Trade Result — JAHZJOURNALS`,
          text: getShareText(),
          url,
        });
      } catch (err) {
        console.log('Share dismissed or failed:', err);
      }
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

  const handleRevokeShare = async () => {
    try {
      setLoading(true);
      await api.delete(`/trades/${trade.id}/share`);
      setShareData(null);
      onClose();
    } catch (err) {
      console.error('Revoke failed:', err);
      setError('Could not revoke link.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !trade) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-white mb-1">Share Trade Result</h3>
        <p className="text-xs text-slate-400 mb-5">
          Share your trade outcome securely. Private account details, broker logins, and email addresses are never exposed.
        </p>

        {/* Card Preview */}
        <div className="mb-6 flex justify-center">
          <ShareTradeCard
            trade={{
              pair: trade.pair,
              direction: trade.direction,
              result: trade.result,
              profitLossAmount: trade.profitLossAmount,
              currency: trade.tradingAccount?.currency || trade.currency || 'USD',
              pips: trade.pips,
              riskRewardRatio: trade.riskRewardRatio,
              session: trade.session,
              screenshotUrl: includeScreenshot && trade.screenshots?.[0]?.imageUrl ? trade.screenshots[0].imageUrl : null,
            }}
            cardRef={cardRef}
          />
        </div>

        {/* Toggle options */}
        {trade.screenshots?.length > 0 && (
          <div className="flex items-center space-x-3 mb-5 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <input
              type="checkbox"
              id="includeScreenshotToggle"
              checked={includeScreenshot}
              onChange={handleToggleScreenshot}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
            />
            <label htmlFor="includeScreenshotToggle" className="text-xs font-medium text-slate-300 cursor-pointer">
              Include chart screenshot in share preview
            </label>
          </div>
        )}

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

        {/* Revoke button */}
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
