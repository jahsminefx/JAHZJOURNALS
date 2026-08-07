import React from 'react';
import { BarChart3, Brain, Camera, ClipboardList, FileText, ShieldCheck, Target, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import FeatureCard from '../components/FeatureCard';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const groups = [
  ['Trade Journaling', ClipboardList, ['Manual trade logging', 'Pair/instrument tracking', 'Entry/exit details', 'Risk/reward tracking', 'Notes before and after trade']],
  ['Screenshot Review', Camera, ['Before-entry screenshots', 'Entry screenshots', 'Exit screenshots', 'Marked chart screenshots', 'Cloudinary-powered image optimization']],
  ['Trading Psychology', Brain, ['Emotion tracking', 'Rule violation tracking', 'Discipline score', 'Revenge trading detection-ready structure']],
  ['Analytics', BarChart3, ['Win rate', 'Equity curve', 'Profit by pair', 'Setup performance', 'Session performance', 'Weekday performance', 'Emotion-based analytics']],
  ['Risk Management', Target, ['Risk calculator', 'Lot size guidance', 'Daily loss limit', 'Max trades per day', 'Risk-to-reward review']],
  ['Reviews and Reports', FileText, ['Weekly review', 'Monthly report structure', 'PDF export-ready', 'Automated review-ready']],
  ['Mentor and Academy Tools', Users, ['Student journals', 'Mentor feedback', 'Group dashboards', 'Performance tracking']],
  ['Discipline Systems', ShieldCheck, ['Rule clarity', 'Process review', 'Challenge tracking', 'Mistake reduction workflows']],
];

const Features = () => (
  <div className="min-h-screen bg-background text-foreground">
    <SEO />
    <Navbar />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <Breadcrumbs />
      <PageHeader
        eyebrow="Features"
        title="Everything You Need to Review, Refine, and Improve Your Trading."
        description="A complete journaling and analytics workspace for traders who want structure over guesswork."
        primaryCta={{ label: 'Start Journaling Free', to: '/register' }}
        secondaryCta={{ label: 'View Pricing', to: '/pricing' }}
        heroImage="/heroes/hero-features.png"
        heroAlt="JAHZJOURNALS trading features workspace"
        heroPosition={{ mobile: '72% top', tablet: '64% top', desktop: 'center top' }}
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {groups.map(([title, Icon, items]) => (
            <FeatureCard
              key={title}
              icon={Icon}
              title={title}
              description={items.join(' · ')}
            />
          ))}
        </div>
      </section>
      <CTASection title="Ready to understand your trading performance?" cta="Create Your Free Journal" />
    </main>
    <Footer />
  </div>
);

export default Features;
