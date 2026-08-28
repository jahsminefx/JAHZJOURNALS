import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import BrandLogo from '../../components/BrandLogo';
import ShareDailyReviewCard from '../../components/share/ShareDailyReviewCard';

export default function SharedDailyReviewPage() {
  const { shareToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSharedDailyReview = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/shared/daily-review/${shareToken}`);
        if (res.data?.success) {
          setReviewData(res.data.data);
        }
      } catch (err) {
        console.error('Fetch shared daily review error:', err);
        setError(err.response?.data?.message || 'This shared daily review link is invalid or has been revoked.');
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      fetchSharedDailyReview();
    }
  }, [shareToken]);

  const formatCurrency = (amount, currencyStr) => {
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const num = Number(amount || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${symbol}${Math.abs(num).toLocaleString()} ${currencyStr || 'USD'}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 md:p-10 font-sans">
      {/* Top Navbar Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-800/80 mb-8">
        <BrandLogo size="md" />

        <Link
          to="/register"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
        >
          Start Free Journal
        </Link>
      </header>

      {/* Main Public Content */}
      <main className="w-full max-w-3xl flex flex-col items-center justify-center space-y-8 my-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-400 animate-pulse text-sm">
            Loading shared daily review...
          </div>
        ) : error ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-md space-y-4">
            <span className="text-4xl block">🔒</span>
            <h3 className="text-lg font-bold text-white">Share Link Unavailable</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-bold rounded-xl transition border border-slate-700"
            >
              Go to JAHZJOURNALS
            </Link>
          </div>
        ) : (
          <>
            {/* Visual Performance Summary Card */}
            <ShareDailyReviewCard summary={reviewData} />

            {/* Optional AI Review Section */}
            {reviewData?.aiReview && (
              <div className="w-full bg-slate-900 border border-indigo-900/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
                  <span>🤖</span>
                  <span>JAHZ AI Daily Coaching Analysis</span>
                </h3>
                
                {reviewData.aiReview.summary && (
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-indigo-950/40 border border-indigo-900/40 rounded-xl p-4 font-medium">
                    {reviewData.aiReview.summary}
                  </p>
                )}

                {reviewData.aiReview.structured?.keyLesson && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs">
                    <span className="font-bold text-indigo-300 uppercase tracking-wider block mb-1">Key Takeaway Lesson</span>
                    <p className="text-slate-300 font-medium">{reviewData.aiReview.structured.keyLesson}</p>
                  </div>
                )}
              </div>
            )}

            {/* Optional Journal Notes Section */}
            {reviewData?.notes && (
              <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl text-xs">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <span>📝</span>
                  <span>Trader Reflections</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviewData.notes.whatWentWell && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="font-bold text-emerald-400 block mb-1">What Went Well</span>
                      <p className="text-slate-300">{reviewData.notes.whatWentWell}</p>
                    </div>
                  )}

                  {reviewData.notes.whatWentWrong && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="font-bold text-rose-400 block mb-1">What Went Wrong</span>
                      <p className="text-slate-300">{reviewData.notes.whatWentWrong}</p>
                    </div>
                  )}

                  {reviewData.notes.lessonsLearned && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="font-bold text-indigo-300 block mb-1">Lessons Learned</span>
                      <p className="text-slate-300">{reviewData.notes.lessonsLearned}</p>
                    </div>
                  )}

                  {reviewData.notes.tomorrowFocus && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="font-bold text-indigo-300 block mb-1">Tomorrow's Focus</span>
                      <p className="text-slate-300">{reviewData.notes.tomorrowFocus}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trades Summary List */}
            {reviewData?.trades?.length > 0 && (
              <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Executed Trades ({reviewData.trades.length})
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Pair</th>
                        <th className="py-2.5 px-3">Dir</th>
                        <th className="py-2.5 px-3">Result</th>
                        <th className="py-2.5 px-3">P/L</th>
                        <th className="py-2.5 px-3">Pips</th>
                        <th className="py-2.5 px-3">R:R</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {reviewData.trades.map((t, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-bold text-white">{t.pair}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.result === 'WIN' ? 'text-emerald-400' : t.result === 'LOSS' ? 'text-rose-400' : 'text-slate-400'
                            }`}>
                              {t.result}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 font-bold ${
                            t.pnl > 0 ? 'text-emerald-400' : t.pnl < 0 ? 'text-rose-400' : 'text-slate-300'
                          }`}>
                            {formatCurrency(t.pnl, t.currency)}
                          </td>
                          <td className="py-2.5 px-3">{t.pips !== null && t.pips !== undefined ? `${t.pips > 0 ? '+' : ''}${t.pips}` : '—'}</td>
                          <td className="py-2.5 px-3">{t.rr ? `1:${t.rr}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Public CTA Banner */}
            <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-900/50 rounded-2xl p-6 text-center space-y-4 shadow-xl">
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Track your own trading performance with JAHZJOURNALS
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Build disciplined trading habits, track multi-currency accounts, and receive JAHZ AI performance reviews.
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
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
                >
                  Explore JAHZJOURNALS
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center border-t border-slate-800/80 pt-6 mt-12 text-[11px] text-slate-500 space-y-1">
        <p>© {new Date().getFullYear()} JAHZJOURNALS. All rights reserved.</p>
        <p>Verified public daily review page. Shared voluntarily by trader.</p>
      </footer>
    </div>
  );
}
