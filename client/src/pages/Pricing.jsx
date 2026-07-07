import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import PricingCard from '../components/PricingCard';
import FAQItem from '../components/FAQItem';
import CTASection from '../components/CTASection';

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

const Pricing = () => (
  <div className="min-h-screen bg-gray-950 text-gray-100">
    <Navbar />
    <main>
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
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PricingCard
              key={plan.name}
              {...plan}
              cta={plan.name === 'Mentor/Academy' ? 'Contact Us' : 'Start Free'}
              to={plan.name === 'Mentor/Academy' ? '/contact' : '/register'}
            />
          ))}
        </div>
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

export default Pricing;
