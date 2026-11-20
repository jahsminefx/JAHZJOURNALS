import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import PropFirmMockup from '../components/PropFirmMockup';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { StaggerContainer, StaggerItem } from '../components/motion/MotionSystem';

const pains = ['Daily drawdown mistakes', 'Overtrading', 'Revenge trading', 'Poor risk control', 'Breaking challenge rules', 'Not tracking progress properly'];
const helps = ['Track daily performance', 'Track max drawdown', 'Track profit target', 'Track trading days', 'Track rule violations', 'Review challenge discipline'];

const PropFirmTraders = () => (
  <div className="min-h-screen bg-background text-foreground">
    <SEO />
    <Navbar />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <Breadcrumbs />
      <PageHeader
        eyebrow="Prop firm traders"
        title="Protect Your Challenge With Better Discipline."
        description="Prop firm challenges are won by process, restraint, and risk control. Track the behavior that keeps your account alive."
        primaryCta={{ label: 'Start Tracking Your Challenge', to: '/register' }}
        heroImage="/heroes/hero-propfirmtraders.png"
        heroAlt="Prop firm trader reviewing challenge discipline"
        heroPosition={{ mobile: '70% 32%', tablet: '64% 35%', desktop: '58% 38%', xl: '56% 36%' }}
        contentClassName="max-w-lg lg:max-w-[33rem]"
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div>
            <SectionHeader align="left" eyebrow="Challenge pain points" title="Most challenge failures start before the trade is placed." />
            <StaggerContainer className="mt-8 grid gap-3">
              {pains.map((pain, index) => (
                <StaggerItem key={pain} index={index}>
                  <div className="motion-card-hover flex gap-3 rounded-xl border border-red-400/20 bg-red-500/[0.06] dark:bg-red-400/[0.04] p-4 text-sm text-foreground hover:border-red-400/35">
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-300 shrink-0" />
                    {pain}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
          <PropFirmMockup />
        </div>
      </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="How it helps" title="Make your rules visible before pressure makes them expensive." />
          <StaggerContainer className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {helps.map((item, index) => (
              <StaggerItem key={item} index={index}>
                <div className="motion-card-hover motion-card-glow flex gap-3 rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-4 shadow-sm dark:shadow-none">
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-300 shrink-0" />
                  <span className="text-sm text-muted">{item}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
      <CTASection title="Protect your challenge with structured review." cta="Start Tracking Your Challenge" />
    </main>
    <Footer />
  </div>
);

export default PropFirmTraders;
