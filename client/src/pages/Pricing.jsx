import React from 'react';
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
    price: '₦0',
    description: 'For traders starting a structured review habit.',
    features: ['Limited trades per month', 'Basic trade journal', 'Basic analytics', 'Limited screenshots', 'Risk calculator'],
  },
  {
    name: 'Starter',
    price: '₦3,000/mo',
    description: 'For active traders who want deeper review.',
    features: ['More trades', 'More screenshots', 'Weekly reviews', 'Rule tracking', 'Emotion tracking', 'Advanced filters'],
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '₦8,000/mo',
    description: 'For serious traders and prop firm challenges.',
    features: ['Unlimited trades', 'Advanced analytics', 'Prop firm tracker', 'AI-ready reviews', 'PDF reports', 'Priority features'],
  },
  {
    name: 'Mentor/Academy',
    price: 'Custom',
    description: 'For mentors who manage student progress.',
    features: ['Student management', 'Mentor dashboard', 'Group analytics', 'Mentor feedback', 'Academy reporting'],
  },
];

const faqs = [
  ['Can I start free?', 'Yes. The free plan is designed to help you build the journaling habit before upgrading.'],
  ['Can I cancel anytime?', 'Yes. Subscription controls will be simple and transparent when paid plans launch.'],
  ['Is there a mentor plan?', 'Yes. Mentor and academy workspaces are planned for student review and group analytics.'],
  ['Will Paystack be supported?', 'Paystack support is planned for Nigerian and African traders.'],
  ['Are AI features included?', 'AI-ready review structure is part of the product direction, with feature availability depending on plan.'],
];

const Pricing = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = async (planName) => {
    const apiPlanMapping = { 'Starter': 'STARTER', 'Pro': 'PRO' };
    const planKey = apiPlanMapping[planName];
    if (!planKey) return;
    try {
      const { data } = await api.post('/subscriptions/initialize', { plan: planKey });
      await refreshUser();
      toast.success(data.message || `Upgraded to ${planName} successfully!`);
      navigate('/dashboard');
    } catch (e) {
      toast.error('Upgrade failed.');
    }
  };

  const getCta = (planName) => {
    if (planName === 'Mentor/Academy') return 'Contact Us';
    if (user) {
      if (planName === 'Free') return 'Current Plan';
      if (import.meta.env.VITE_LAUNCH_MODE === 'true') return 'Activate Founding Trader Access';
      return `Upgrade to ${planName}`;
    }
    return 'Start Free';
  };

  const getTo = (planName) => {
    if (planName === 'Mentor/Academy') return '/contact';
    if (!user) return '/register';
    if (planName === 'Free') return '/dashboard';
    return undefined;
  };

  const getOnClick = (planName) => {
    if (planName === 'Mentor/Academy' || planName === 'Free' || !user) return undefined;
    return () => handleUpgrade(planName);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumbs />
        <PageHeader
          eyebrow="Pricing"
          title="Simple plans for disciplined traders and trading teams."
          description="Prices are placeholders and may change before official launch."
          primaryCta={{ label: 'Start Free', to: '/register' }}
          heroImage="/heroes/hero-pricing.png"
          heroAlt="Trading journal pricing plans"
          heroPosition={{ mobile: '68% top', tablet: '60% top', desktop: 'center top' }}
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          {import.meta.env.VITE_LAUNCH_MODE === 'true' && user?.subscriptions?.[0]?.source === 'PROMOTION' ? (
            <div className="mx-auto max-w-3xl rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8 sm:p-12 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />
               <div className="absolute bottom-0 left-0 h-40 w-40 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
               
               <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                 <span className="text-3xl">🏅</span>
               </div>
               
               <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                 Founding Trader
               </h2>
               
               <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
                 You currently enjoy complimentary <strong>PRO access</strong> as part of our launch program.
               </p>
               
               {user.subscriptions[0].expiresAt && (
                 <p className="mt-3 text-base text-muted">
                   Your access expires on: <strong className="text-foreground">{new Date(user.subscriptions[0].expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                 </p>
               )}
               
               <div className="mt-8 flex justify-center">
                 <FoundingTraderBadge subscription={user.subscriptions[0]} variant="button" />
               </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <PricingCard
                  key={plan.name}
                  {...plan}
                  cta={getCta(plan.name)}
                  onClick={getOnClick(plan.name)}
                  to={getTo(plan.name)}
                />
              ))}
            </div>
          )}
        </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          {faqs.map(([question, answer]) => (
            <FAQItem key={question} question={question} answer={answer} />
          ))}
        </div>
      </section>
      <CTASection />
    </main>
    <Footer />
  </div>
  );
};

export default Pricing;
