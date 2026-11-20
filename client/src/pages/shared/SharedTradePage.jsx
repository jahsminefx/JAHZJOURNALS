import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import BrandLogo from '../../components/BrandLogo';
import ShareTradeCard from '../../components/share/ShareTradeCard';

export default function SharedTradePage() {
  const { shareToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [tradeData, setTradeData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSharedTrade = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/shared/trade/${shareToken}`);
        if (res.data?.success) {
          setTradeData(res.data.data);
        }
      } catch (err) {
        console.error('Fetch shared trade error:', err);
        setError(err.response?.data?.message || 'This shared trade link is invalid or has been revoked.');
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      fetchSharedTrade();
    }
  }, [shareToken]);

  const formatCurrency = (amount, currencyStr) => {
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const num = Number(amount || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${symbol}${Math.abs(num).toLocaleString()} ${currencyStr || 'USD'}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-between p-4 sm:p-6 md:p-10 font-sans">
      {/* Top Navbar Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-border/80 mb-8">
        <BrandLogo size="md" />

        <Link
          to="/register"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
        >
          Start Free Journal
        </Link>
      </header>

      {/* Main Public Content */}
      <main className="w-full max-w-2xl flex flex-col items-center justify-center space-y-8 my-auto">
        {loading ? (
          <div className="py-20 text-center text-muted animate-pulse text-sm">
            Loading shared trade result...
          </div>
        ) : error ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center max-w-md space-y-4 shadow-xl dark:shadow-2xl">
            <span className="text-4xl block">🔒</span>
            <h3 className="text-lg font-bold text-foreground">Share Link Unavailable</h3>
            <p className="text-xs text-muted leading-relaxed">{error}</p>
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-surface-muted hover:bg-surface-elevated text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition border border-border"
            >
              Go to JAHZJOURNALS
            </Link>
          </div>
        ) : (
          <>
            {/* Visual Trade Card */}
            <ShareTradeCard trade={tradeData} />

            {/* Detailed Execution Breakdown Card */}
            <div className="w-full bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-md dark:shadow-xl">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted border-b border-border pb-3">
                Execution Breakdown
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {tradeData?.entryPrice !== undefined && tradeData?.entryPrice !== null && (
                  <div>
                    <span className="text-[10px] text-muted uppercase block font-medium">Entry Price</span>
                    <span className="font-bold text-foreground">{tradeData.entryPrice}</span>
                  </div>
                )}

                {tradeData?.exitPrice !== undefined && tradeData?.exitPrice !== null && (
                  <div>
                    <span className="text-[10px] text-muted uppercase block font-medium">Exit Price</span>
                    <span className="font-bold text-foreground">{tradeData.exitPrice}</span>
                  </div>
                )}

                {tradeData?.stopLoss !== undefined && tradeData?.stopLoss !== null && (
                  <div>
                    <span className="text-[10px] text-muted uppercase block font-medium">Stop Loss</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{tradeData.stopLoss}</span>
                  </div>
                )}

                {tradeData?.takeProfit !== undefined && tradeData?.takeProfit !== null && (
                  <div>
                    <span className="text-[10px] text-muted uppercase block font-medium">Take Profit</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{tradeData.takeProfit}</span>
                  </div>
                )}

                {tradeData?.strategyName && (
                  <div>
                    <span className="text-[10px] text-muted uppercase block font-medium">Strategy</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">{tradeData.strategyName}</span>
                  </div>
                )}

                {tradeData?.setupName && (
                  <div>
                    <span className="text-[10px] text-muted uppercase block font-medium">Setup</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">{tradeData.setupName}</span>
                  </div>
                )}

                {tradeData?.entryTime && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted uppercase block font-medium">Date & Time</span>
                    <span className="font-medium text-foreground">
                      {new Date(tradeData.entryTime).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Public CTA Banner */}
            <div className="w-full bg-gradient-to-r from-surface via-indigo-500/10 to-surface dark:from-slate-900 dark:via-indigo-950/60 dark:to-slate-900 border border-indigo-500/30 dark:border-indigo-900/50 rounded-2xl p-6 text-center space-y-4 shadow-md dark:shadow-xl">
              <h3 className="text-base sm:text-lg font-extrabold text-foreground">
                Track your own trading performance with JAHZJOURNALS
              </h3>
              <p className="text-xs text-muted max-w-lg mx-auto">
                Join elite traders using automated analytics, multi-currency tracking, discipline scoring, and JAHZ AI performance coaching.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <Link
                  to="/register"
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition"
                >
                  Start Your Journal Free
                </Link>
                <Link
                  to="/"
                  className="px-6 py-2.5 bg-surface-muted hover:bg-surface text-foreground text-xs font-bold rounded-xl border border-border transition"
                >
                  Explore JAHZJOURNALS
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center border-t border-border/80 pt-6 mt-12 text-[11px] text-muted space-y-1">
        <p>© {new Date().getFullYear()} JAHZJOURNALS. All rights reserved.</p>
        <p>Verified public trade result page. Shared voluntarily by trader.</p>
      </footer>
    </div>
  );
}
