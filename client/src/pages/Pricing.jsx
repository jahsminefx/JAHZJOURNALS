import React from 'react';
import { Check, Minus } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import PricingCard from '../components/PricingCard';
import FAQItem from '../components/FAQItem';
import CTASection from '../components/CTASection';
import FoundingTraderBadge from '../components/FoundingTraderBadge';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const plans = [
  {
    name: 'Free',
    tagline: 'Build the habit.',
    price: '₦0',
    description: 'Designed for beginner traders who want to start journaling and understand their performance.',
    limits: ['50 trades / month', '1 trading account', '2 screenshots per trade'],
    features: [
      'Basic trade entry & journal',
      'Basic analytics & equity curve',
      'Overall profit / loss summary',
      'Position-size risk calculator',
      'Basic trade filtering & weekly review',
      'Full Mobile / PWA access',
    ],
  },
  {
    name: 'Starter',
    tagline: 'Build discipline.',
    price: '₦3,000',
    description: 'Designed for active traders who want to understand their emotions, mistakes, and execution patterns.',
    limits: ['300 trades / month', '3 trading accounts', '6 screenshots per trade'],
    features: [
      'All Free plan capabilities',
      'Trading psychology & emotion tracking',
      'Rule violation & mistake tracking',
      'Strategy & setup performance tracking',
      'Session analysis (London, NY, Asian)',
      'Detailed trade analytics & filters',
    ],
  },
  {
    name: 'Pro',
    tagline: 'Find your edge.',
    price: '₦8,000',
    description: 'The flagship individual trader plan for finding your edge and passing prop-firm challenges.',
    highlighted: true,
    limits: ['Unlimited trades / month', 'Unlimited trading accounts', '10 screenshots per trade'],
    features: [
      'All Starter plan capabilities',
      'AI Trade Review & AI Coach',
      'JAHZ Edge Finder analytics',
      'Prop-firm challenge tracker & drawdown guards',
      'Expectancy, profit factor & drawdown metrics',
      'Emotion vs profitability analysis',
      'PDF performance report exports',
      'Priority access to new features',
    ],
  },
  {
    name: 'Mentor / Academy',
    tagline: 'Build better traders.',
    price: 'Custom',
    description: 'Designed for mentors, trading coaches, and academies managing student performance.',
    limits: ['Custom student capacity', 'Dedicated mentor workspace', 'Custom screenshot limits'],
    features: [
      'Student portfolio management',
      'Student group invitations & access',
      'Direct mentor feedback & trade comments',
      'Feedback badges & rule warnings',
      'Group analytics & student discipline trends',
      'Academy reporting & aggregated summaries',
      'Privacy controls & feedback workflows',
    ],
  },
];

const featureMatrix = [
  { feature: 'Monthly Trade Log Limit', free: '50', starter: '300', pro: 'Unlimited', mentor: 'Custom' },
  { feature: 'Trading Accounts', free: '1', starter: '3', pro: 'Unlimited', mentor: 'Custom' },
  { feature: 'Screenshots per Trade', free: '2', starter: '6', pro: '10', mentor: 'Custom' },
  { feature: 'Basic Analytics & Equity Curve', free: true, starter: true, pro: true, mentor: true },
  { feature: 'Detailed Analytics & Sessions', free: false, starter: true, pro: true, mentor: true },
  { feature: 'Emotion & Psychology Tracking', free: false, starter: true, pro: true, mentor: true },
  { feature: 'Rule Violation Tracking', free: false, starter: true, pro: true, mentor: true },
  { feature: 'Position Size Risk Calculator', free: true, starter: true, pro: true, mentor: true },
  { feature: 'Weekly Review System', free: true, starter: true, pro: true, mentor: true },
  { feature: 'Prop-Firm Challenge Tracker', free: false, starter: false, pro: true, mentor: false },
  { feature: 'AI Trade Review & AI Coach', free: false, starter: false, pro: true, mentor: false },
  { feature: 'JAHZ Edge Finder Analytics', free: false, starter: false, pro: true, mentor: false },
  { feature: 'PDF Report Generation', free: false, starter: false, pro: true, mentor: true },
  { feature: 'Mentor Student Workspace', free: false, starter: false, pro: false, mentor: true },
  { feature: 'Trade Comments & Feedback Badges', free: false, starter: false, pro: false, mentor: true },
];

const faqs = [
  ['Can I start for free?', 'Yes! The Free plan allows you to log up to 50 trades per month with basic analytics so you can build the journaling habit.'],
  ['How does the monthly trade limit work?', 'The monthly trade limit counts trades created within the current calendar month. Once reached, you can upgrade to Starter or Pro to continue logging.'],
  ['Is Paystack supported for payment?', 'Yes. Paystack is integrated for seamless payments in Naira (NGN) and card transactions across Africa.'],
  ['What is the Founding Trader Program?', 'During launch mode, early users receive complimentary Pro access to test advanced AI reviews and prop-firm tracking.'],
  ['Can I cancel or upgrade anytime?', 'Yes. You can upgrade, downgrade, or cancel your subscription at any time directly from your account settings.'],
];

const Pricing = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [promoCode, setPromoCode] = React.useState('');
  const [redeemingPromo, setRedeemingPromo] = React.useState(false);

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    if (!promoCode.trim()) return toast.error('Please enter a promo code');
    if (!user) return navigate('/login');

    try {
      setRedeemingPromo(true);
      const { data } = await api.post('/promotions/redeem-code', { code: promoCode.trim() });
      toast.success(data.message || 'Promo code redeemed!');
      setPromoCode('');
      await refreshUser();
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid or expired promo code.');
    } finally {
      setRedeemingPromo(false);
    }
  };

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (reference) {
      api.get(`/subscriptions/verify/${encodeURIComponent(reference)}`)
        .then(async ({ data }) => {
          await refreshUser();
          toast.success(data.message || 'Subscription activated successfully!');
          navigate('/dashboard', { replace: true });
        })
        .catch((err) => {
          console.error('Verification error:', err);
          toast.error(err.response?.data?.message || 'Payment verification failed.');
        });
    }
  }, []);

  const handleUpgrade = async (planName) => {
    const apiPlanMapping = { 'Starter': 'STARTER', 'Pro': 'PRO' };
    const planKey = apiPlanMapping[planName];
    if (!planKey) return;
    try {
      const { data } = await api.post('/subscriptions/initialize', { plan: planKey });
      await refreshUser();
      
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.success(data.message || `Upgraded to ${planName} successfully!`);
        navigate('/dashboard');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upgrade failed.');
    }
  };

  const planRank = {
    'FREE': 1,
    'STARTER': 2,
    'PRO': 3,
    'MENTOR': 4,
  };

  const planKeyMap = {
    'Free': 'FREE',
    'Starter': 'STARTER',
    'Pro': 'PRO',
    'Mentor / Academy': 'MENTOR',
  };

  const userPlanKey = (user?.subscriptionPlan || 'FREE').toUpperCase();
  const userRank = planRank[userPlanKey] || 1;

  const getPlanStatus = (planName) => {
    if (planName === 'Mentor / Academy') {
      return { cta: 'Contact Support', to: '/contact', onClick: undefined, highlighted: false };
    }

    if (!user) {
      return {
        cta: planName === 'Free' ? 'Start Free' : `Get ${planName}`,
        to: '/register',
        onClick: undefined,
        highlighted: planName === 'Pro'
      };
    }

    const targetKey = planKeyMap[planName] || 'FREE';
    const targetRank = planRank[targetKey] || 1;

    if (userRank === targetRank) {
      return {
        cta: 'Current Plan',
        to: '/dashboard',
        onClick: undefined,
        highlighted: true
      };
    }

    if (userRank > targetRank) {
      return {
        cta: 'Included in Your Plan',
        to: '/dashboard',
        onClick: undefined,
        highlighted: false
      };
    }

    return {
      cta: `Upgrade to ${planName}`,
      to: undefined,
      onClick: () => handleUpgrade(planName),
      highlighted: targetKey === 'PRO'
    };
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Pricing Plans | JAHZJOURNALS Forex Journal"
        description="Simple, transparent pricing for disciplined traders. Choose Free, Starter, or Pro with AI reviews and prop firm challenge tracking."
        canonical="https://jahzjournal.com/pricing"
      />
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
        <Breadcrumbs />
        
        <PageHeader
          eyebrow="Pricing & Plans"
          title="Simple plans for disciplined traders and trading teams."
          description="Build the habit free, build discipline with Starter, or find your edge with Pro."
          primaryCta={user ? { label: 'Go to Dashboard', to: '/dashboard' } : { label: 'Start Free Today', to: '/register' }}
          heroImage="/heroes/hero-pricing.png"
          heroAlt="JAHZJOURNALS pricing plans for traders"
          heroPosition={{ mobile: '70% top', tablet: '62% top', desktop: 'center top' }}
        />

        {/* Founding Trader Launch Banner */}
        {import.meta.env.VITE_LAUNCH_MODE === 'true' && user?.subscriptions?.[0]?.source === 'PROMOTION' ? (
          <section className="px-4 py-8">
            <div className="mx-auto max-w-3xl rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-center relative overflow-hidden shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 dark:text-amber-400 text-2xl">
                🏅
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Founding Trader Active</h2>
              <p className="mt-2 text-sm text-muted">
                You currently enjoy complimentary <strong>PRO access</strong> as part of our launch program.
              </p>
              <div className="mt-6 flex justify-center">
                <FoundingTraderBadge subscription={user.subscriptions[0]} variant="button" />
              </div>
            </div>
          </section>
        ) : null}

        {/* Pricing Cards Grid */}
        <section className="py-12">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const status = getPlanStatus(plan.name);
              return (
                <PricingCard
                  key={plan.name}
                  {...plan}
                  highlighted={status.highlighted}
                  cta={status.cta}
                  onClick={status.onClick}
                  to={status.to}
                />
              );
            })}
          </div>

          {/* Promo Code Section */}
          <div className="mt-8 max-w-2xl mx-auto rounded-2xl border border-border bg-surface p-6 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                🏷️ Have an official promo code?
              </h3>
              <p className="text-xs text-muted mt-1">
                Enter your code to unlock complimentary tier access or discounts.
              </p>
            </div>
            <form onSubmit={handleRedeemCode} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. FOUNDING50"
                className="bg-surface-muted border border-border px-3 py-2 rounded-xl text-xs font-mono font-bold text-sky-500 dark:text-sky-400 uppercase placeholder:text-muted outline-none focus:border-sky-500 w-full sm:w-36 text-foreground"
              />
              <button
                type="submit"
                disabled={redeemingPromo || !promoCode.trim()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md disabled:opacity-50 transition-all shrink-0"
              >
                {redeemingPromo ? 'Applying...' : 'Apply'}
              </button>
            </form>
          </div>
        </section>

        {/* Interactive Feature Comparison Table */}
        <section className="py-12 border-t border-border">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">Compare Plan Features</h2>
            <p className="mt-2 text-sm text-muted">Detailed breakdown of features across all JAHZJOURNALS plans</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-muted text-muted uppercase tracking-wider border-b border-border font-bold">
                <tr>
                  <th className="p-4 border-r border-border">Feature</th>
                  <th className="p-4 text-center border-r border-border">Free</th>
                  <th className="p-4 text-center border-r border-border">Starter</th>
                  <th className="p-4 text-center border-r border-border text-emerald-500 dark:text-emerald-400 font-extrabold">Pro</th>
                  <th className="p-4 text-center">Mentor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted">
                {featureMatrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="p-4 font-semibold text-foreground border-r border-border">{row.feature}</td>
                    
                    {['free', 'starter', 'pro', 'mentor'].map((tierKey) => {
                      const val = row[tierKey];
                      return (
                        <td key={tierKey} className="p-4 text-center border-r border-border">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <Check size={16} className="mx-auto text-emerald-500 dark:text-emerald-400 font-bold" />
                            ) : (
                              <Minus size={16} className="mx-auto text-muted/40" />
                            )
                          ) : (
                            <span className={`font-bold ${tierKey === 'pro' ? 'text-emerald-500 dark:text-emerald-400' : 'text-foreground'}`}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-12 border-t border-border">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
          </div>
          <div className="mx-auto max-w-4xl space-y-4">
            {faqs.map(([question, answer]) => (
              <FAQItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </section>

        <CTASection 
          title="Start building your trading discipline today." 
          cta={user ? "Go to Dashboard" : "Start Journaling Free"} 
        />
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
