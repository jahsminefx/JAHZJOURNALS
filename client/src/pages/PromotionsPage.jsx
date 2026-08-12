import React, { useState, useEffect } from 'react';
import { Gift, Zap, CheckCircle2, Clock, ArrowRight, Tag, Lock, ShieldCheck } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import PageHeader from '../components/PageHeader';
import Breadcrumbs from '../components/Breadcrumbs';
import SEO from '../components/SEO';

const PromotionsPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [redeemingId, setRedeemingId] = useState(null);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const [availRes, myRedemptionsRes] = await Promise.all([
        api.get('/promotions/available'),
        api.get('/promotions/my-redemptions')
      ]);

      setPromotions(availRes.data.promotions || []);
      setRedemptions(myRedemptionsRes.data.redemptions || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('Failed to load active promotions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleRedeemById = async (promoId) => {
    try {
      setRedeemingId(promoId);
      const { data } = await api.post(`/promotions/${promoId}/redeem`);
      toast.success(data.message || 'Promotion unlocked successfully!');
      fetchPromotions();
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Redemption failed.');
    } finally {
      setRedeemingId(null);
    }
  };

  const handleRedeemByCodeSubmit = async (e) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) {
      return toast.error('Please enter a promo code.');
    }

    try {
      setRedeemingCode(true);
      const { data } = await api.post('/promotions/redeem-code', { code: promoCodeInput.trim() });
      toast.success(data.message || 'Promo code redeemed!');
      setPromoCodeInput('');
      fetchPromotions();
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid or expired promo code.');
    } finally {
      setRedeemingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-20">
      <SEO title="Active Promotions & Offers | JAHZJOURNALS" description="Discover active promotional offers, founding trader discounts, and redeem exclusive tier access." />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Breadcrumbs />

        <PageHeader
          eyebrow="Exclusive Offers"
          title="Promotions & Trader Benefits"
          description="Discover live promotions, founding trader codes, and complimentary tier upgrades."
        />

        {/* Promo Code Input Section */}
        <div className="mt-8 mb-12">
          <div className="max-w-xl bg-gray-900/80 border border-gray-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
                <Tag size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Have a Promo Code?</h3>
                <p className="text-xs text-gray-400">Enter your official promotion code below for instant activation.</p>
              </div>
            </div>

            <form onSubmit={handleRedeemByCodeSubmit} className="flex gap-3 mt-4">
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                placeholder="e.g. FOUNDING50"
                className="flex-1 bg-gray-950 border border-gray-700/80 px-4 py-3 rounded-xl text-sm font-mono font-bold text-sky-400 uppercase placeholder-gray-600 outline-none focus:border-sky-500 transition-all"
              />
              <button
                type="submit"
                disabled={redeemingCode || !promoCodeInput.trim()}
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-extrabold text-sm rounded-xl hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] disabled:opacity-50 transition-all shrink-0"
              >
                {redeemingCode ? 'Redeeming...' : 'Apply Code'}
              </button>
            </form>
          </div>
        </div>

        {/* Live Available Promotions */}
        <section className="space-y-6 mb-16">
          <div className="flex items-center gap-2">
            <Zap className="text-emerald-400" size={20} />
            <h2 className="text-xl font-extrabold text-white">Live Promotional Offers</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium">Loading active offers...</div>
          ) : promotions.length === 0 ? (
            <div className="p-12 border border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
              <Gift size={40} className="mx-auto mb-3 opacity-30 text-emerald-400" />
              <p className="font-bold text-base text-gray-300">No active public promotions available right now.</p>
              <p className="text-xs text-gray-500 mt-1">If you have a direct promo code, enter it in the code box above.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`relative overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all flex flex-col justify-between ${
                    promo.isRedeemed
                      ? 'border-gray-800 bg-gray-900/40 opacity-80'
                      : 'border-emerald-500/30 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/20 hover:border-emerald-500/60 shadow-xl'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-black text-emerald-400 uppercase tracking-wider">
                        {promo.planGranted} TIER BENEFIT
                      </span>
                      {promo.isRedeemed ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle2 size={14} /> Already Redeemed
                        </span>
                      ) : promo.endsAt ? (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={12} /> Ends {format(new Date(promo.endsAt), 'MMM dd, yyyy')}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-xl font-black text-white">{promo.name}</h3>
                    <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                      {promo.description || `Unlock complimentary ${promo.planGranted} plan features on JAHZJOURNALS.`}
                    </p>

                    {promo.benefits && promo.benefits.length > 0 && (
                      <ul className="mt-4 space-y-1.5 border-t border-gray-800 pt-3">
                        {promo.benefits.map((b, idx) => (
                          <li key={idx} className="text-xs text-gray-300 flex items-center gap-2">
                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">PROMO CODE</span>
                      <span className="text-sm font-mono font-bold text-sky-400">{promo.slug.toUpperCase()}</span>
                    </div>

                    {promo.isRedeemed ? (
                      <button disabled className="px-5 py-2.5 bg-gray-800 text-gray-400 text-xs font-bold rounded-xl cursor-default">
                        Redeemed
                      </button>
                    ) : (
                      <button
                        disabled={redeemingId === promo.id}
                        onClick={() => handleRedeemById(promo.id)}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 text-xs font-black rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {redeemingId === promo.id ? 'Unlocking...' : 'Redeem Offer'} <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Redeemed Offers History */}
        {redemptions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-sky-400" size={20} />
              <h2 className="text-xl font-extrabold text-white">My Redeemed Promotions</h2>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
              <div className="divide-y divide-gray-800">
                {redemptions.map((item) => (
                  <div key={item.historyId} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-800/40 transition-colors">
                    <div>
                      <h4 className="font-bold text-base text-white">{item.name}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Code: <span className="font-mono text-sky-400 font-bold">{item.slug.toUpperCase()}</span> • Granted Tier: <strong className="text-emerald-400">{item.planGranted}</strong></p>
                    </div>
                    <div className="text-xs text-gray-400 sm:text-right">
                      <div>Redeemed: {format(new Date(item.redeemedAt), 'MMM dd, yyyy')}</div>
                      {item.autoExpire && item.expiresAt ? (
                        <div className="text-amber-400 font-medium mt-0.5">Expires: {format(new Date(item.expiresAt), 'MMM dd, yyyy')}</div>
                      ) : (
                        <div className="text-emerald-400 font-medium mt-0.5">Permanent Grant</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default PromotionsPage;
