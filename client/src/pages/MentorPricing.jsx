import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Sliders, 
  HelpCircle,
  Building,
  GraduationCap,
  Award,
  Zap,
  MessageCircle,
  AlertTriangle,
  Flame,
  Check,
  X
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import FAQItem from '../components/FAQItem';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/useAuth';
import api from '../utils/api';
import toast from 'react-hot-toast';

const PRESET_TIERS = [
  {
    name: 'Private Cohort',
    studentRange: '25 – 50 Students',
    studentsDefault: 50,
    priceNgn: 8000,
    tagline: 'Ideal for private masterminds & small coaching cohorts',
    icon: GraduationCap,
    features: [
      '25 to 50 active student trading journals',
      '2 private trading cohorts with invite links',
      'Black-and-white strategy risk violation guards (e.g. 1% max risk)',
      'Direct trade comments & feedback grading',
      'Telegram/WhatsApp link attachment for welcome receipt',
      'Full Pro trading features for the mentor',
    ],
  },
  {
    name: 'Growth Community',
    studentRange: '100 – 150 Students',
    studentsDefault: 150,
    priceNgn: 25000,
    tagline: 'Most popular for active trading coaches & communities',
    icon: Award,
    highlighted: true,
    features: [
      '100 to 150 active student trading journals',
      '5 private trading cohorts',
      'Everything in Private Cohort',
      'Automated cohort risk adherence & violation reports',
      'AI-powered student performance summaries',
      'Paid student cohort checkouts (JahzJournal 1.5% commission fee)',
      'Custom academy branding & student badges',
    ],
  },
  {
    name: 'Mega Academy',
    studentRange: '500 – 1,000+ Students',
    studentsDefault: 1000,
    priceNgn: 65000,
    tagline: 'Flat rate for large Telegram communities & institutional academies',
    icon: Building,
    features: [
      '500 to 1,000+ active student trading journals (Capped flat rate)',
      'Unlimited trading cohorts',
      'Everything in Growth Community',
      'Bulk student invite links & CSV data exports',
      'Aggregated academy risk & performance audit reports',
      'Priority mentor onboarding & dedicated VIP support',
    ],
  },
];

const mentorFaqs = [
  [
    'Why use JAHZJOURNALS alongside my Telegram channel?',
    'Telegram is great for chat, signals, and market announcements, but it gets chaotic when 200+ students send chart screenshots. JAHZJOURNALS gives your community a structured trading journal where you can verify their real execution, inspect their before/after screenshots, and prove if they followed your risk rules.',
  ],
  [
    'What is the Student Strategy Risk Guard feature?',
    'You set your academy risk rules (e.g. Max 1.0% risk per trade, allowed pairs, session times). When a student logs a trade with 12% risk on Gold, the system automatically flags it in red with irrefutable proof: "⚠️ Exceeded Mentor Rule by +11.0%". This protects your reputation when students over-leverage.',
  ],
  [
    'How does the 1.5% registration fee work for paid cohorts?',
    'If you sell mentorship access, you can connect your Nigerian bank account and set a price. JahzJournal processes the student card payments via Paystack and takes only a modest 1.5% platform commission, transferring the rest directly to your bank account.',
  ],
  [
    'Do my students need to pay for their own Starter or Pro accounts?',
    'No! Your Mentor plan covers your students so they can log trades, attach chart screenshots, and receive your feedback inside your academy workspace without paying individually.',
  ],
  [
    'Can I upgrade my student capacity as my channel grows?',
    'Yes, absolutely. You can upgrade or adjust your student tier at any time directly from this page or your billing settings. Your capacity updates instantly.',
  ],
];

const MentorPricing = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [studentCount, setStudentCount] = useState(50);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [activePublicPromo, setActivePublicPromo] = useState(null);

  // Fetch active promo & URL query params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const promoParam = searchParams.get('promo') || searchParams.get('code');
    const studentsParam = parseInt(searchParams.get('students'), 10);
    if (!isNaN(studentsParam) && studentsParam >= 25) {
      setStudentCount(studentsParam);
    }

    api.get('/promotions/public-active')
      .then(({ data }) => {
        if (data && data.active && data.promotion) {
          setActivePublicPromo(data.promotion);
          if (!promoParam) {
            setAppliedPromo({
              code: data.promotion.slug,
              discountPercent: data.promotion.discountPercent || 50,
              promotion: data.promotion,
            });
          }
        }
      })
      .catch(() => {});

    if (promoParam) {
      api.get(`/promotions/${encodeURIComponent(promoParam)}`)
        .then(({ data }) => {
          if (data && (data.discountType === 'PERCENTAGE_DISCOUNT' || data.discountPercent)) {
            setAppliedPromo({
              code: data.slug || promoParam,
              discountPercent: data.discountPercent || 50,
              promotion: data,
            });
          }
        })
        .catch(() => {});
    }
  }, [location.search]);

  // Scaled bracket pricing:
  // 25 - 50 students: ₦8,000/mo
  // 51 - 150 students: ₦25,000/mo
  // 151 - 1,000+ students: Flat ₦65,000/mo
  const calculateMentorPrice = (count) => {
    const safeCount = Math.max(25, count || 25);
    let rawTotal = 8000;
    let tierName = 'Private Cohort (25 – 50 Students)';

    if (safeCount <= 50) {
      rawTotal = 8000;
      tierName = 'Private Cohort (25 – 50 Students)';
    } else if (safeCount <= 150) {
      rawTotal = 25000;
      tierName = 'Growth Community (100 – 150 Students)';
    } else {
      rawTotal = 65000;
      tierName = 'Mega Academy (500 – 1,000+ Students Flat Cap)';
    }

    let finalPrice = rawTotal;
    let originalPrice = null;

    if (appliedPromo && appliedPromo.discountPercent) {
      originalPrice = rawTotal;
      finalPrice = Math.round(rawTotal * (1 - appliedPromo.discountPercent / 100));
    }

    return {
      rawTotal,
      finalPrice,
      originalPrice,
      tierName,
      perStudentEffective: Math.round(finalPrice / safeCount),
    };
  };

  const currentPricing = calculateMentorPrice(studentCount);

  const handleCheckout = async (targetCount) => {
    const countToUse = targetCount || studentCount;
    const safeCount = Math.max(25, countToUse);

    if (!user) {
      const registerUrl = appliedPromo
        ? `/register?promo=${encodeURIComponent(appliedPromo.code)}&plan=mentor&students=${safeCount}`
        : `/register?plan=mentor&students=${safeCount}`;
      navigate(registerUrl);
      return;
    }

    try {
      setLoadingCheckout(true);
      const payload = {
        plan: 'MENTOR',
        studentCount: safeCount,
      };
      if (appliedPromo?.code) {
        payload.promoCode = appliedPromo.code;
      }

      const { data } = await api.post('/subscriptions/initialize', payload);
      await refreshUser();

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.success(data.message || 'Mentor subscription activated!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize Mentor plan checkout.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const [activatingTrial, setActivatingTrial] = useState(false);

  const handleStartTrial = async () => {
    if (!user) {
      navigate('/register?plan=mentor&trial=true');
      return;
    }

    try {
      setActivatingTrial(true);
      const { data } = await api.post('/subscriptions/mentor-trial/activate');
      await refreshUser();
      toast.success(data.message || '14-Day Mentor Free Trial activated!');
      navigate('/mentors/groups');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate 14-day Mentor trial.');
    } finally {
      setActivatingTrial(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Mentor & Academy Pricing | JAHZJOURNALS"
        description="Scalable mentor and academy plans built around your student capacity. Real-time student calculator and dedicated coaching workspace."
        canonical="https://jahzjournal.com/pricing/mentor"
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
        <Breadcrumbs />

        <PageHeader
          eyebrow="Mentor & Academy Plans"
          title="Plans Built Around Your Student Capacity"
          description="Mentor and Academy pricing scales based on the number of active students each plan handles—from private 1-on-1 coaching cohorts to large trading academies."
          primaryCta={user ? { label: 'Go to Dashboard', to: '/dashboard' } : { label: 'Start Free Today', to: '/register' }}
          heroImage="/heroes/hero-mentors.png"
          heroAlt="Forex mentor workspace pricing"
          heroPosition={{ mobile: '72% top', tablet: '64% top', desktop: 'center top' }}
        />

        {/* 14-Day Mentor Free Trial Banner for unregistered or eligible non-mentor users */}
        {(!user || (!user.hasUsedMentorTrial && user.role !== 'MENTOR')) && (
          <div className="mt-6 mb-8 max-w-5xl mx-auto rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-surface to-slate-950 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 font-bold text-xl border border-blue-500/30">
                ⏳
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-400">
                    Two Weeks Complimentary + 12h Grace
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-foreground mt-1">
                  Try the Mentor Workspace Free for 14 Days
                </h3>
                <p className="text-xs text-muted max-w-xl mt-0.5 leading-relaxed">
                  Already registered as a trader? You can activate a 14-day full Private Cohort trial (manage up to 50 students, create 2 cohorts, and test Strategy Risk Guards) with a 12-hour grace buffer. No credit card required. Strictly one trial per user.
                </p>
              </div>
            </div>
            <button
              onClick={handleStartTrial}
              disabled={activatingTrial}
              className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white py-3 px-6 text-xs font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {activatingTrial ? (
                <span>Activating Trial...</span>
              ) : (
                <>
                  <span>{user ? 'Activate 14-Day Free Trial' : 'Sign Up for 14-Day Trial'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        )}

        {/* Active Trial Notice if currently in 14-day window */}
        {user?.mentorTrialExpiresAt && new Date(user.mentorTrialExpiresAt) > new Date() && user?.role === 'MENTOR' && (
          <div className="mt-6 mb-8 max-w-5xl mx-auto rounded-2xl border border-blue-500/30 bg-blue-500/[0.05] p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                  Active 14-Day Mentor Trial
                </p>
                <p className="text-xs text-muted">
                  Your trial ends on {new Date(user.mentorTrialExpiresAt).toLocaleDateString()} (about {Math.max(1, Math.ceil((new Date(user.mentorTrialExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} day(s) remaining, plus a 12-hour grace period). Choose a plan below to keep cohort access uninterrupted.
                </p>
              </div>
            </div>
            <Link
              to="/mentors/groups"
              className="shrink-0 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/20"
            >
              Go to Cohorts →
            </Link>
          </div>
        )}

        {/* 12-Hour Grace Period Notice */}
        {user?.mentorTrialExpiresAt && 
          new Date(user.mentorTrialExpiresAt) <= new Date() && 
          new Date() <= new Date(new Date(user.mentorTrialExpiresAt).getTime() + 12 * 60 * 60 * 1000) && 
          user?.role === 'MENTOR' && (
          <div className="mt-6 mb-8 max-w-5xl mx-auto rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-surface to-surface p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl ring-1 ring-amber-500/30">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold text-xl border border-amber-500/30">
                ⚠️
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
                    12-Hour Grace Period Active
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    ~{Math.max(1, Math.ceil((new Date(new Date(user.mentorTrialExpiresAt).getTime() + 12 * 60 * 60 * 1000).getTime() - Date.now()) / (60 * 60 * 1000)))} hour(s) left
                  </span>
                </div>
                <h3 className="text-base font-black text-foreground mt-1">
                  Your 14-day trial period has ended
                </h3>
                <p className="text-xs text-muted max-w-xl mt-0.5 leading-relaxed">
                  You are currently in your 12-hour grace period before mentor privileges are revoked. Upgrade to one of the plans below to keep your student cohorts, risk guard rules, and reviews uninterrupted.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCheckout(50)}
              className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-5 text-xs transition-all shadow-md cursor-pointer"
            >
              Upgrade Now
            </button>
          </div>
        )}

        {/* Free Trial Already Claimed / Expired Notice */}
        {user?.hasUsedMentorTrial && 
          (!user?.mentorTrialExpiresAt || new Date() > new Date(new Date(user.mentorTrialExpiresAt).getTime() + 12 * 60 * 60 * 1000) || user.role !== 'MENTOR') && (
          <div className="mt-6 mb-8 max-w-5xl mx-auto rounded-2xl border border-border bg-surface-muted/50 p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div>
                <p className="text-xs font-bold text-foreground">
                  One-Time 14-Day Free Trial Already Used
                </p>
                <p className="text-xs text-muted">
                  Each account is eligible for one complimentary 14-day trial. Select a package below to subscribe and start managing student cohorts.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-[11px] font-bold text-muted bg-surface border border-border px-3 py-1 rounded-lg">
              Trial Claimed
            </span>
          </div>
        )}

        {/* Promo Banner if Active */}
        {(activePublicPromo || appliedPromo) && (
          <div className="mt-6 mb-8 max-w-5xl mx-auto rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-surface to-slate-950 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-sm">
                🎉
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  {appliedPromo?.discountPercent || 50}% Launch Discount Active
                </p>
                <p className="text-xs text-muted">
                  Your Mentor plan rate automatically includes your {appliedPromo?.discountPercent || 50}% discount at checkout.
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
              CODE: {(appliedPromo?.code || 'LAUNCH50').toUpperCase()}
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PRESET MENTOR TIERS (PLACED ON TOP AS REQUESTED)                          */}
        {/* ========================================================================= */}
        <section className="py-8">
          <div className="text-center mb-8 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Defined Mentor Packages
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Choose Your Student Capacity Tier
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mx-auto">
              Fair, bracketed pricing designed for African forex communities. Includes unlimited trade review comments, strategy risk guards, and subaccount payouts.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {PRESET_TIERS.map((tier) => {
              let finalPrice = tier.priceNgn;
              let origPrice = null;
              if (appliedPromo?.discountPercent) {
                origPrice = tier.priceNgn;
                finalPrice = Math.round(tier.priceNgn * (1 - appliedPromo.discountPercent / 100));
              }
              const Icon = tier.icon;

              return (
                <div
                  key={tier.name}
                  className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 ${
                    tier.highlighted
                      ? 'border-emerald-400/60 bg-emerald-500/10 shadow-xl ring-1 ring-emerald-400/50'
                      : 'border-border bg-surface shadow-sm'
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3.5 right-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950 shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted border border-border text-emerald-400">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-foreground tracking-tight">{tier.name}</h3>
                      <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                        {tier.studentRange}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted leading-relaxed min-h-[34px]">
                    {tier.tagline}
                  </p>

                  <div className="mt-5 flex items-baseline gap-2">
                    {origPrice && (
                      <span className="text-base line-through text-muted/70 font-semibold">
                        ₦{origPrice.toLocaleString()}
                      </span>
                    )}
                    <span className="text-3xl font-black text-foreground">
                      ₦{finalPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted font-medium">/month</span>
                  </div>

                  <ul className="mt-6 flex-1 space-y-3 pt-4 border-t border-border">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex gap-2.5 text-xs text-muted">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    disabled={loadingCheckout}
                    onClick={() => {
                      setStudentCount(tier.studentsDefault);
                      handleCheckout(tier.studentsDefault);
                    }}
                    className={`mt-7 w-full py-2.5 px-4 rounded-xl text-xs font-black transition shadow-sm ${
                      tier.highlighted
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-surface-muted hover:bg-surface border border-border text-foreground'
                    }`}
                  >
                    Select {tier.name} ({tier.studentRange})
                  </button>
                </div>
              );
            })}
          </div>

          {/* 1.5% Platform Fee Highlight Note */}
          <div className="mt-6 max-w-5xl mx-auto rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-emerald-400 shrink-0" />
              <p className="text-muted leading-relaxed">
                <strong>Hosting Paid Cohorts on JahzJournal?</strong> JahzJournal only charges a modest <strong>1.5% platform fee</strong> on paid student registrations. Student fees are processed seamlessly via Paystack and settled directly to your Nigerian bank account.
              </p>
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-400 bg-surface px-2.5 py-1 rounded border border-border whitespace-nowrap">
              1.5% Commission Fee
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE STUDENT-CAPACITY PRICING CALCULATOR (BELOW PRESETS)           */}
        {/* ========================================================================= */}
        <section className="my-10 border-t border-border pt-12">
          <div className="max-w-4xl mx-auto rounded-3xl border border-emerald-500/30 bg-surface/90 backdrop-blur-xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-8">
              {/* Calculator Header */}
              <div className="text-center space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  <Sliders size={13} /> Custom Capacity Estimator
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  How Many Students Do You Manage?
                </h2>
                <p className="text-xs sm:text-sm text-muted max-w-xl mx-auto">
                  Type or slide your approximate student count below. Your price automatically adjusts to the nearest bracket tier with an unlimited flat cap for 500+ students.
                </p>
              </div>

              {/* Student Input & Slider Controls */}
              <div className="bg-surface-muted/50 border border-border rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <label htmlFor="student-input" className="text-xs font-bold uppercase tracking-wider text-muted">
                      Active Student Capacity
                    </label>
                    <p className="text-xs text-muted">Students who can submit trade journals to your workspace</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="student-input"
                      type="number"
                      min="25"
                      max="2000"
                      value={studentCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setStudentCount(isNaN(val) ? 25 : Math.max(25, Math.min(2000, val)));
                      }}
                      className="w-28 px-3 py-2 text-center text-xl font-black font-mono rounded-xl border border-emerald-500/50 bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <span className="text-sm font-bold text-muted">Students</span>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min="25"
                    max="1000"
                    step="25"
                    value={Math.min(1000, studentCount)}
                    onChange={(e) => setStudentCount(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[11px] font-semibold text-muted font-mono">
                    <span>25 - 50 (₦8k)</span>
                    <span>100 - 150 (₦25k)</span>
                    <span>500 - 1,000+ (₦65k Flat)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-muted mr-1">Quick Select:</span>
                  {[25, 50, 100, 150, 250, 500, 1000].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setStudentCount(num)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        studentCount === num
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                          : 'bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-muted'
                      }`}
                    >
                      {num} Students
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Calculation Output Card */}
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-surface to-emerald-950/20 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                      Matching Tier
                    </span>
                    <span className="text-xs font-bold text-muted">
                      {currentPricing.tierName}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-foreground">
                    Mentor Plan for {studentCount} Students
                  </h3>
                  <div className="text-xs text-muted space-y-1">
                    <p className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>Includes student trade journals, strategy risk guards & reviews</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>Effective rate: <strong>₦{currentPricing.perStudentEffective.toLocaleString()} / student per month</strong></span>
                    </p>
                  </div>
                </div>

                {/* Price & Action */}
                <div className="text-right flex flex-col md:items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                  {currentPricing.originalPrice && (
                    <span className="text-sm line-through text-muted/70 font-semibold">
                      ₦{currentPricing.originalPrice.toLocaleString()} / month
                    </span>
                  )}
                  <div className="flex items-baseline gap-1 md:justify-end">
                    <span className="text-3xl sm:text-4xl font-black text-foreground">
                      ₦{currentPricing.finalPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted font-medium">/month</span>
                  </div>

                  <button
                    type="button"
                    disabled={loadingCheckout}
                    onClick={() => handleCheckout()}
                    className="mt-4 w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-sm font-black text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-60"
                  >
                    {loadingCheckout ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        <span>Initializing Checkout...</span>
                      </>
                    ) : (
                      <>
                        <span>Activate for {studentCount} Students</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  <span className="text-[10px] text-muted mt-1.5 text-center md:text-right">
                    Instant Paystack authorization • Cancel anytime
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* TELEGRAM VS JAHZJOURNALS FEATURE HIGHLIGHT SECTION                        */}
        {/* ========================================================================= */}
        <section className="py-12 border-t border-border">
          <div className="text-center mb-10 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Why Mentors Upgrade
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Telegram Chat vs. JAHZJOURNALS Academy
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-xl mx-auto">
              Keep your Telegram channel for community chat and announcements. Use JAHZJOURNALS to review real trades, verify risk discipline, and protect your reputation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Telegram Column */}
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-rose-400 font-black text-sm uppercase tracking-wider">
                <MessageCircle size={18} /> Managing on Telegram Only
              </div>
              <ul className="space-y-3 text-xs text-muted leading-relaxed">
                <li className="flex items-start gap-2">
                  <X size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span><strong>Messy chat threads:</strong> 500 students sending screenshots in one endless feed where questions get lost.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span><strong>Mentors get blamed for blown accounts:</strong> When a student gambles with 12% risk on Gold, you have zero proof of what they actually did.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span><strong>Exhausting DMs:</strong> Mentors burn out reviewing screenshots scattered across WhatsApp and Telegram.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span><strong>Manual payment checking:</strong> Verifying bank transfer receipts manually before adding students to private links.</span>
                </li>
              </ul>
            </div>

            {/* JahzJournal Column */}
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-4 shadow-lg">
              <div className="flex items-center gap-2.5 text-emerald-400 font-black text-sm uppercase tracking-wider">
                <ShieldCheck size={18} /> Telegram + JAHZJOURNALS Academy
              </div>
              <ul className="space-y-3 text-xs text-muted leading-relaxed">
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Organized student portfolios:</strong> Click any student's name to view their complete trade log, win rate, and equity curve.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Automatic Strategy Risk Violation Guard:</strong> The system automatically flags trades where a student exceeded your taught 1.0% risk rule.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Direct trade grading:</strong> Leave timestamped comments and grades directly on the student's entry/exit chart screenshot.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Automated Paystack student enrollments:</strong> Students pay to join and funds land in your Nigerian bank account with just a 1.5% platform fee.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS FOR MENTORS                                    */}
        {/* ========================================================================= */}
        <section className="py-12 border-t border-border">
          <div className="text-center mb-8 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Clear Answers
            </span>
            <h2 className="text-2xl font-bold text-foreground">
              Frequently Asked Questions About Mentor Plans
            </h2>
          </div>
          <div className="mx-auto max-w-4xl space-y-4">
            {mentorFaqs.map(([question, answer]) => (
              <FAQItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </section>

        <CTASection
          title="Transform your trading students into disciplined traders."
          cta={user ? "Go to Dashboard" : "Start Journaling Free"}
        />
      </main>

      <Footer />
    </div>
  );
};

export default MentorPricing;
