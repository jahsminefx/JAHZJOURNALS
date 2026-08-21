import React, { useState, useEffect } from 'react';
import { Gift, Zap, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DashboardPromotionBanner = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState(null);
  const navigate = useNavigate();

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/promotions/available');
      // Show unredeemed active offers
      const activeUnredeemed = (data.promotions || []).filter(p => !p.isRedeemed);
      setPromotions(activeUnredeemed);
    } catch (error) {
      console.error('Error fetching dashboard promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleRedeem = async (promo) => {
    try {
      setRedeemingId(promo.id);
      const { data } = await api.post(`/promotions/${promo.id}/redeem`);
      toast.success(data.message || 'Promotion redeemed successfully!');
      fetchPromotions();
      // Reload user auth state / redirect to pricing or dashboard
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to redeem promotion.');
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading || promotions.length === 0) return null;

  // Show top promotion in carousel/banner
  const topPromo = promotions[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-gray-900 via-emerald-950/40 to-gray-900 p-5 sm:p-6 backdrop-blur-xl shadow-lg transition-all mb-6 group">
      {/* Background Ambient Glow */}
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Zap size={24} className="animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] uppercase font-black tracking-widest text-emerald-400">
                🎉 Exclusive Offer
              </span>
              {topPromo.endsAt && (
                <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                  <Clock size={12} /> Ends {format(new Date(topPromo.endsAt), 'MMM dd')}
                </span>
              )}
            </div>

            <h3 className="text-lg font-black text-foreground mt-1 tracking-tight">
              {topPromo.name}
            </h3>
            
            <p className="text-xs text-muted mt-1 max-w-xl line-clamp-2">
              {topPromo.description || `Unlock complimentary ${topPromo.planGranted} access during this limited launch promotion.`}
            </p>

            <div className="flex items-center gap-3 mt-3">
              <div className="bg-surface-muted border border-border px-3 py-1 rounded-lg text-xs font-mono font-bold text-sky-500 dark:text-sky-400">
                CODE: {topPromo.slug.toUpperCase()}
              </div>
              <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">
                Yields {topPromo.planGranted} Tier
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-none border-border">
          <button
            onClick={() => navigate(`/promotions/${topPromo.id}`)}
            className="px-4 py-2.5 bg-surface-muted hover:bg-surface-muted/80 text-foreground text-xs font-bold rounded-xl border border-border transition-all flex-1 sm:flex-none text-center"
          >
            View Details
          </button>
          
          <button
            disabled={redeemingId === topPromo.id}
            onClick={() => handleRedeem(topPromo)}
            className="relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 text-xs font-black rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none disabled:opacity-50"
          >
            {redeemingId === topPromo.id ? (
              'Redeeming...'
            ) : (
              <>
                Redeem Offer <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPromotionBanner;
