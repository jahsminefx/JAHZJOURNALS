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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading offer details...
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-gray-400">
        <ShieldAlert size={48} className="text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-white">Promotion Not Found</h2>
        <p className="text-sm mt-1 max-w-md">The promotion you requested is unavailable or has expired.</p>
        <button
          onClick={() => navigate('/pricing')}
          className="mt-6 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl"
        >
          Return to Pricing
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-20">
      <SEO title={`${promo.name} | JAHZJOURNALS`} description={promo.description} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Offers
        </button>

        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/30 p-8 sm:p-10 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-black text-emerald-400 uppercase tracking-widest">
              {promo.planGranted} TIER BENEFIT
            </span>

            {promo.status === 'ALREADY_REDEEMED' ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={16} /> Already Redeemed
              </span>
            ) : promo.status === 'EXPIRED' ? (
              <span className="text-xs font-bold text-red-400 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20">
                Expired Offer
              </span>
            ) : promo.endsAt ? (
              <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                <Clock size={14} /> Ends {format(new Date(promo.endsAt), 'MMMM dd, yyyy')}
              </span>
            ) : null}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white">{promo.name}</h1>
          
          <p className="text-sm text-gray-300 mt-4 leading-relaxed max-w-2xl">
            {promo.description || `Unlock complimentary ${promo.planGranted} tier capabilities on JAHZJOURNALS.`}
          </p>

          {/* Code Box */}
          <div className="mt-8 p-6 bg-black/40 border border-gray-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">OFFICIAL PROMO CODE</span>
              <span className="text-2xl font-mono font-black text-sky-400 tracking-wider">{promo.slug.toUpperCase()}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">GRANT TARGET</span>
              <span className="text-lg font-bold text-emerald-400">{promo.planGranted} Plan</span>
            </div>
          </div>

          {/* Benefits List */}
          {promo.benefits && promo.benefits.length > 0 && (
            <div className="mt-8 border-t border-gray-800/80 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Included Plan Capabilities</h3>
              <ul className="grid sm:grid-cols-2 gap-3">
                {promo.benefits.map((b, idx) => (
                  <li key={idx} className="text-sm text-gray-200 flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-10 border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-500">
              {promo.remainingRedemptions !== null ? `${promo.remainingRedemptions} redemptions remaining` : 'Unlimited availability'}
            </span>

            {promo.status === 'ALREADY_REDEEMED' ? (
              <button disabled className="w-full sm:w-auto px-8 py-3 bg-gray-800 text-gray-400 font-bold rounded-xl cursor-default text-sm">
                Already Redeemed
              </button>
            ) : promo.status !== 'ACTIVE' ? (
              <button disabled className="w-full sm:w-auto px-8 py-3 bg-gray-800 text-gray-500 font-bold rounded-xl cursor-default text-sm">
                Offer {promo.status}
              </button>
            ) : (
              <button
                disabled={redeeming}
                onClick={handleRedeem}
                className="w-full sm:w-auto px-10 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 font-black rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {redeeming ? 'Redeeming...' : 'Unlock Promotion Now'} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionDetailPage;
