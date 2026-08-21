import React, { useState, useEffect } from 'react';
import { Gift, Zap, CheckCircle2, Clock, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
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
    <div className="space-y-8 text-foreground font-sans">
      <SEO title="Active Promotions & Offers | JAHZJOURNALS" description="Discover active promotional offers, founding trader discounts, and redeem exclusive tier access." />
      
      <div className="space-y-6">
        <Breadcrumbs />

        <PageHeader
          eyebrow="Exclusive Offers"
          title="Promotions & Trader Benefits"
          description="Discover live promotions, founding trader codes, and complimentary tier upgrades."
        />

        {/* Promo Code Input Section */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-sky-500/15 text-sky-500 dark:text-sky-400 rounded-xl shrink-0">
                <Tag size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Have an Official Promo Code?</h3>
                <p className="text-xs sm:text-sm text-muted mt-1">Enter your promo or voucher code below to activate complimentary tier access instantly.</p>
              </div>
            </div>

            <form onSubmit={handleRedeemByCodeSubmit} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0 min-w-[320px]">
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                placeholder="e.g. FOUNDING50"
                className="flex-1 bg-surface-muted border border-border px-4 py-3 rounded-xl text-sm font-mono font-bold text-sky-500 dark:text-sky-400 uppercase placeholder:text-muted outline-none focus:border-sky-500 transition-all text-foreground"
              />
              <button
                type="submit"
                disabled={redeemingCode || !promoCodeInput.trim()}
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-extrabold text-sm rounded-xl shadow-md disabled:opacity-50 transition-all shrink-0 text-center"
              >
                {redeemingCode ? 'Redeeming...' : 'Apply Code'}
              </button>
            </form>
          </div>
        </div>

        {/* Live Available Promotions */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="text-emerald-500 dark:text-emerald-400" size={20} />
            <h2 className="text-xl font-extrabold text-foreground">Live Promotional Offers</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted font-medium bg-surface rounded-2xl border border-border">Loading active offers...</div>
          ) : promotions.length === 0 ? (
            <div className="p-12 border border-dashed border-border bg-surface rounded-2xl text-center text-muted">
              <Gift size={40} className="mx-auto mb-3 opacity-30 text-emerald-500 dark:text-emerald-400" />
              <p className="font-bold text-base text-foreground">No active public promotions available right now.</p>
              <p className="text-xs text-muted mt-1">If you have a direct promo code, enter it in the code box above.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`relative overflow-hidden rounded-2xl border p-6 transition-all flex flex-col justify-between shadow-sm hover:shadow-md ${
                    promo.isRedeemed
                      ? 'border-border bg-surface-muted/60 opacity-85'
                      : 'border-border bg-surface hover:border-emerald-500/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {promo.planGranted} TIER BENEFIT
                      </span>
                      {promo.isRedeemed ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle2 size={14} /> Redeemed
                        </span>
                      ) : promo.endsAt ? (
                        <span className="text-xs text-muted flex items-center gap-1 font-medium">
                          <Clock size={12} /> Ends {format(new Date(promo.endsAt), 'MMM dd, yyyy')}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-xl font-black text-foreground">{promo.name}</h3>
                    <p className="text-xs text-muted mt-2 leading-relaxed">
                      {promo.description || `Unlock complimentary ${promo.planGranted} plan features on JAHZJOURNALS.`}
                    </p>

                    {promo.benefits && promo.benefits.length > 0 && (
                      <ul className="mt-4 space-y-2 border-t border-border pt-3">
                        {promo.benefits.map((b, idx) => (
                          <li key={idx} className="text-xs text-muted flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400 shrink-0" /> {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted block">PROMO CODE</span>
                      <span className="text-sm font-mono font-bold text-sky-500 dark:text-sky-400">{promo.slug.toUpperCase()}</span>
                    </div>

                    {promo.isRedeemed ? (
                      <button disabled className="px-5 py-2.5 bg-surface-muted text-muted text-xs font-bold rounded-xl cursor-default border border-border">
                        Active
                      </button>
                    ) : (
                      <button
                        disabled={redeemingId === promo.id}
                        onClick={() => handleRedeemById(promo.id)}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
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
              <ShieldCheck className="text-sky-500 dark:text-sky-400" size={20} />
              <h2 className="text-xl font-extrabold text-foreground">My Redeemed Promotions</h2>
            </div>

            <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
              <div className="divide-y divide-border">
                {redemptions.map((item) => (
                  <div key={item.historyId} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-muted/40 transition-colors">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{item.name}</h4>
                      <p className="text-xs text-muted mt-0.5">Code: <span className="font-mono text-sky-500 dark:text-sky-400 font-bold">{item.slug.toUpperCase()}</span> • Granted Tier: <strong className="text-emerald-500 dark:text-emerald-400">{item.planGranted}</strong></p>
                    </div>
                    <div className="text-xs text-muted sm:text-right">
                      <div>Redeemed: {format(new Date(item.redeemedAt), 'MMM dd, yyyy')}</div>
                      {item.autoExpire && item.expiresAt ? (
                        <div className="text-amber-500 dark:text-amber-400 font-medium mt-0.5">Expires: {format(new Date(item.expiresAt), 'MMM dd, yyyy')}</div>
                      ) : (
                        <div className="text-emerald-500 dark:text-emerald-400 font-medium mt-0.5">Permanent Grant</div>
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
