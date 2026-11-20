import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { FOUNDER_CONFIG } from '../config/founderConfig';
import { Reveal, StaggerContainer, StaggerItem } from '../components/motion/MotionSystem';

const values = ['Built for real traders', 'Built for discipline', 'Built for screenshots and review', 'Built for mobile-first traders', 'Built for African and global forex communities'];

const About = () => {
  const showFounderSection = Boolean(
    FOUNDER_CONFIG.isPublished &&
    FOUNDER_CONFIG.name &&
    FOUNDER_CONFIG.bio &&
    FOUNDER_CONFIG.avatarUrl
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumbs />
        <PageHeader
          eyebrow="About JAHZJOURNALS"
          title="A trading journal built from trading experience and software discipline."
          description="The goal is simple: help traders stop repeating mistakes blindly and start reviewing with structure."
          heroImage="/heroes/hero-about.png"
          heroAlt="Trader reviewing journal analytics"
          heroPosition={{ mobile: '76% 28%', tablet: '68% 30%', desktop: '62% 32%', xl: '60% 30%' }}
          contentClassName="max-w-lg lg:max-w-[33rem]"
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHeader align="left" eyebrow="Founder-led focus" title="Serious traders need evidence, not hype." />
            <Reveal direction="up" delay={100}>
              <div className="space-y-5 text-base leading-8 text-muted">
                <p>
                  JAHZJOURNALS was created from the combination of forex trading experience and software development skill. It is built for traders who want to review their process honestly instead of guessing why an account is growing or shrinking.
                </p>
                <p>
                  The platform focuses on trade logs, screenshots, emotions, rule violations, risk, and analytics. It avoids unrealistic profit claims because consistency is not built from promises. It is built from structure, review, and discipline.
                </p>
                <p>
                  JAHZJOURNALS is especially mindful of African and Nigerian traders who need affordable, mobile-first tools that respect the way real forex communities learn, trade, and review.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {showFounderSection && (
          <section className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
            <Reveal direction="up">
              <div className="motion-card-hover motion-card-glow mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <img
                    src={FOUNDER_CONFIG.avatarUrl}
                    alt={FOUNDER_CONFIG.name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500/30"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{FOUNDER_CONFIG.name}</h2>
                    <p className="text-xs font-semibold text-emerald-500">{FOUNDER_CONFIG.role}</p>
                    <p className="mt-3 text-sm text-muted leading-relaxed">{FOUNDER_CONFIG.bio}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        )}

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <StaggerContainer className="mx-auto grid max-w-7xl gap-4 md:grid-cols-5">
            {values.map((value, index) => (
              <StaggerItem key={value} index={index} className="flex">
                <div className="motion-card-hover motion-card-glow w-full rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-5 text-sm font-semibold text-foreground shadow-sm dark:shadow-none">
                  {value}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
        <CTASection title="Trade with structure. Review with honesty. Improve with evidence." />
      </main>
      <Footer />
    </div>
  );
};

export default About;
