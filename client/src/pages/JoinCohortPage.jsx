import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  GraduationCap, Users, ShieldCheck, CheckCircle2, ArrowRight, RefreshCw, 
  UserCheck, DollarSign, CreditCard, Lock, Sparkles, Award, HelpCircle,
  Clock, Target, Layers, Send, MessageSquare, ExternalLink
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/useAuth';
import Button from '../components/Button';
import BrandLogo from '../components/BrandLogo';

const defaultBenefits = [
  'Direct mentor reviews & execution grading on your journal logs',
  'Private cohort trade sharing & accountability',
  'Automated JAHZ AI weekly performance coaching summaries',
];

const JoinCohortPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('PAYSTACK');
  const [error, setError] = useState(null);
  const [paymentSuccessReceipt, setPaymentSuccessReceipt] = useState(null);

  useEffect(() => {
    const fetchCohortInfo = async () => {
      try {
        const { data } = await api.get(`/mentors/groups/${groupId}/public-info`);
        setCohort(data);
      } catch (err) {
        setError(err.response?.data?.message || 'This invitation link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      fetchCohortInfo();
    }
  }, [groupId]);

  const handleEnrollment = async () => {
    if (!token) {
      navigate(`/login?redirect=/join/cohort/${groupId}`);
      return;
    }

    setJoining(true);
    try {
      if (cohort.isPaid && cohort.price > 0) {
        // Paid Cohort Checkout
        const { data } = await api.post(`/mentors/groups/${groupId}/checkout`, {
          paymentMethod,
        });

        if (data.alreadyEnrolled) {
          toast.success(data.message);
          navigate('/dashboard', { replace: true });
          return;
        }

        setPaymentSuccessReceipt(data.receipt);
        toast.success(data.message || 'Payment confirmed and enrollment active!');
      } else {
        // Free Cohort Join
        const { data } = await api.post(`/mentors/groups/${groupId}/join`);
        toast.success(data.message || 'Enrolled in cohort successfully!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete cohort enrollment.');
    } finally {
      setJoining(false);
    }
  };

  const formattedPrice = (price, currency = 'USD') => {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${Number(price).toLocaleString()}`;
  };

  const displayBenefits = cohort?.benefits && cohort.benefits.length > 0
    ? cohort.benefits
    : defaultBenefits;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-muted gap-3">
        <RefreshCw size={28} className="animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Loading cohort enrollment details...</p>
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-2">
            <GraduationCap size={28} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Invitation Unavailable</h2>
          <p className="text-xs text-muted leading-relaxed">{error || 'This cohort link is no longer valid.'}</p>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment Confirmation View
  if (paymentSuccessReceipt) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="mb-6">
          <BrandLogo to="/" size="md" />
        </div>
        <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center shadow-2xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-foreground">Enrollment Confirmed!</h2>
            <p className="text-xs text-muted mt-1.5">
              You are now an active student in <span className="font-bold text-foreground">{cohort.name}</span>.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/40 p-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">Payment Reference</span>
              <span className="font-mono text-foreground font-semibold">{paymentSuccessReceipt.paymentReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Amount Paid</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formattedPrice(paymentSuccessReceipt.paidAmount, paymentSuccessReceipt.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cohort Mentor</span>
              <span className="font-semibold text-foreground">{cohort.mentor?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Trade Journal Sharing</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Enabled</span>
            </div>
          </div>

          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-sm"
          >
            Enter Dashboard & Start Journaling
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-3 sm:p-6 py-6 sm:py-10">
      <div className="mb-4 sm:mb-6 flex items-center gap-2.5 sm:gap-3">
        <BrandLogo to="/" size="md" />
        {cohort.academyName && (
          <span className="text-xs font-bold text-muted border-l border-border pl-2.5 sm:pl-3 truncate max-w-[200px] sm:max-w-xs">
            {cohort.academyName}
          </span>
        )}
      </div>

      <div className="max-w-lg w-full rounded-2xl border border-border bg-surface p-4 sm:p-7 shadow-xl space-y-5 sm:space-y-6">
        {/* Custom Academy Logo / Top Branding */}
        {cohort.logoUrl ? (
          <div className="flex justify-center mb-0.5 sm:mb-1">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl border border-border bg-surface-muted/50 p-1.5 sm:p-2 overflow-hidden flex items-center justify-center shadow-xs">
              <img src={cohort.logoUrl} alt="Academy Logo" className="h-full w-full object-contain" />
            </div>
          </div>
        ) : null}

        {/* Header & Badges */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] sm:text-xs font-bold">
            <GraduationCap size={13} className="sm:w-3.5 sm:h-3.5" />
            {cohort.customBadge || 'Academy Cohort Enrollment'}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground leading-tight break-words px-1">
            {cohort.name}
          </h1>
          
          {cohort.description && (
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed">{cohort.description}</p>
          )}

          {/* Metadata Highlights: Markets, Skill, Duration */}
          {(cohort.targetMarkets || cohort.skillLevel || cohort.duration) && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1">
              {cohort.targetMarkets && (
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 rounded-md bg-surface-muted text-foreground border border-border flex items-center gap-1">
                  <Target size={12} className="text-emerald-500" /> {cohort.targetMarkets}
                </span>
              )}
              {cohort.skillLevel && (
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 rounded-md bg-surface-muted text-foreground border border-border flex items-center gap-1">
                  <Layers size={12} className="text-emerald-500" /> {cohort.skillLevel}
                </span>
              )}
              {cohort.duration && (
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 rounded-md bg-surface-muted text-foreground border border-border flex items-center gap-1">
                  <Clock size={12} className="text-emerald-500" /> {cohort.duration}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mentor Profile Card */}
        <div className="rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm sm:text-base shrink-0 ring-2 ring-emerald-500/30 overflow-hidden">
              {cohort.mentor?.avatarUrl ? (
                <img src={cohort.mentor.avatarUrl} alt="Avatar" className="h-full w-full object-cover rounded-full" />
              ) : cohort.mentor?.name ? (
                cohort.mentor.name.charAt(0).toUpperCase()
              ) : (
                'M'
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted block truncate">
                {cohort.academyName ? `${cohort.academyName} Mentor` : 'Cohort Mentor'}
              </span>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate">{cohort.mentor?.name || 'Trading Mentor'}</p>
              {cohort.mentor?.tradingStyle && (
                <p className="text-[11px] sm:text-xs text-muted truncate">{cohort.mentor.tradingStyle}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
              <Users size={12} /> {cohort._count?.students || 0} Traders
            </span>
          </div>
        </div>

        {/* Pricing Card if Paid */}
        {cohort.isPaid && cohort.price > 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 sm:p-4.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Mentorship Fee</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-3xl font-black text-foreground">
                    {formattedPrice(cohort.price, cohort.currency)}
                  </span>
                  <span className="text-xs text-muted font-medium">
                    {cohort.billingCycle === 'MONTHLY' ? '/ month' : 'one-time'}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] sm:text-xs font-bold flex items-center gap-1 shrink-0">
                <ShieldCheck size={13} /> Verified
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2 border-t border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">Select Payment Method:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PAYSTACK')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'PAYSTACK'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-border bg-surface text-muted hover:text-foreground'
                  }`}
                >
                  <CreditCard size={14} /> Local Card / Bank
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'CARD'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'border-border bg-surface text-muted hover:text-foreground'
                  }`}
                >
                  <Lock size={14} /> International Card
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-muted/30 p-3 sm:p-3.5 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-muted uppercase tracking-wider">Cohort Access:</span>
            <span className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 sm:px-3 py-1 rounded-full border border-emerald-500/20">
              Free Community Access
            </span>
          </div>
        )}

        {/* Custom "What You Will Learn & Receive" Benefits List */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted">What You'll Learn & Receive:</p>
          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-foreground">
            {displayBenefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5 sm:mt-1" />
                <span className="leading-snug text-xs sm:text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Community Channel Badges if provided */}
        {(cohort.telegramLink || cohort.discordLink) && (
          <div className="pt-1 flex flex-wrap gap-1.5 sm:gap-2">
            {cohort.telegramLink && (
              <span className="text-[10px] sm:text-[11px] font-medium px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center gap-1.5">
                <Send size={12} /> VIP Telegram Channel
              </span>
            )}
            {cohort.discordLink && (
              <span className="text-[10px] sm:text-[11px] font-medium px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center gap-1.5">
                <MessageSquare size={12} /> VIP Discord Server
              </span>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 border-t border-border space-y-3">
          {token ? (
            <div>
              <Button
                onClick={handleEnrollment}
                disabled={joining}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 sm:py-3 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                {cohort.isPaid && cohort.price > 0 ? (
                  <>
                    <CreditCard size={16} className="sm:w-4.5 sm:h-4.5" />
                    {joining ? 'Processing Enrollment...' : `Pay ${formattedPrice(cohort.price, cohort.currency)} & Enroll`}
                  </>
                ) : (
                  <>
                    <UserCheck size={16} className="sm:w-4.5 sm:h-4.5" />
                    {joining ? 'Enrolling...' : `Join Cohort as ${user?.name || 'Student'}`}
                  </>
                )}
              </Button>
              <p className="text-[10px] sm:text-[11px] text-muted text-center mt-2 truncate">
                Logged in as <span className="font-semibold text-foreground">{user?.email}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-2.5">
              <Button
                onClick={() => navigate(`/register?redirect=/join/cohort/${groupId}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 sm:py-3 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                {cohort.isPaid && cohort.price > 0
                  ? `Create Account & Pay ${formattedPrice(cohort.price, cohort.currency)}`
                  : 'Create Account & Join Cohort'}
                <ArrowRight size={15} />
              </Button>
              <Link
                to={`/login?redirect=/join/cohort/${groupId}`}
                className="w-full inline-flex items-center justify-center py-2 sm:py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold transition text-center px-2"
              >
                Already have an account? Log In to Enroll
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinCohortPage;
