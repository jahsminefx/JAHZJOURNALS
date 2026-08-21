import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, Zap, CheckCircle2, Clock, ArrowRight, ArrowLeft, ShieldAlert } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Breadcrumbs from '../components/Breadcrumbs';
import SEO from '../components/SEO';

const PromotionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [promo, setPromo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/promotions/${id}`);
      setPromo(data);
    } catch (error) {
      console.error('Error fetching promotion detail:', error);
      toast.error('Failed to load promotion details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleRedeem = async () => {
    if (!promo) return;
    try {
      setRedeeming(true);
      const { data } = await api.post(`/promotions/${promo.id}/redeem`);
      toast.success(data.message || 'Promotion redeemed successfully!');
      fetchDetails();
      setTimeout(() => {
        navigate('/pricing');
      }, 1200);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to redeem promotion.');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted">
        Loading offer details...
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-muted">
        <ShieldAlert size={48} className="text-amber-500 dark:text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Promotion Not Found</h2>
        <p className="text-sm mt-1 max-w-md">The promotion you requested is unavailable or has expired.</p>
        <button
          onClick={() => navigate('/pricing')}
          className="mt-6 px-6 py-2.5 bg-surface-muted hover:bg-surface-muted/80 text-foreground text-xs font-bold rounded-xl border border-border"
        >
          Return to Pricing
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <SEO title={`${promo.name} | JAHZJOURNALS`} description={promo.description} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-bold text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Offers
        </button>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-10 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">
              {promo.planGranted} TIER BENEFIT
            </span>

            {promo.status === 'ALREADY_REDEEMED' ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={16} /> Already Redeemed
              </span>
            ) : promo.status === 'EXPIRED' ? (
              <span className="text-xs font-bold text-red-500 dark:text-red-400 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20">
                Expired Offer
              </span>
            ) : promo.endsAt ? (
              <span className="text-xs text-muted flex items-center gap-1.5 font-medium">
                <Clock size={14} /> Offer Ends: {format(new Date(promo.endsAt), 'MMMM dd, yyyy')}
              </span>
            ) : null}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{promo.name}</h1>
          
          <div className="mt-3 inline-flex items-center gap-2 bg-surface-muted border border-border px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-sky-500 dark:text-sky-400">
            PROMO CODE: <span className="text-foreground">{promo.slug.toUpperCase()}</span>
          </div>

          <p className="text-sm text-muted mt-5 leading-relaxed">
            {promo.description || `Unlock complimentary ${promo.planGranted} tier access and features on your JAHZJOURNALS account.`}
          </p>

          {promo.benefits && promo.benefits.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">Included Plan Benefits</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {promo.benefits.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted/60 border border-border text-xs text-foreground font-medium">
                    <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-xs text-muted">
              {promo.autoExpire && promo.durationDays ? (
                <span>Duration: <strong>{promo.durationDays} Days Access</strong></span>
              ) : (
                <span>Duration: <strong className="text-emerald-500 dark:text-emerald-400">Permanent Grant</strong></span>
              )}
            </div>

            {promo.status === 'ALREADY_REDEEMED' ? (
              <button disabled className="w-full sm:w-auto px-8 py-3 bg-surface-muted text-muted text-sm font-bold rounded-xl cursor-default border border-border">
                Already Active on Account
              </button>
            ) : promo.status === 'EXPIRED' ? (
              <button disabled className="w-full sm:w-auto px-8 py-3 bg-surface-muted text-muted text-sm font-bold rounded-xl cursor-default border border-border">
                Promotion Expired
              </button>
            ) : (
              <button
                disabled={redeeming}
                onClick={handleRedeem}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-sm font-black rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {redeeming ? 'Redeeming Offer...' : 'Redeem & Upgrade Now'} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionDetailPage;
