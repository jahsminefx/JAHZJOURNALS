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

const values = [
  'Log trades with context',
  'Review screenshots and mistakes',
  'Track rules, risk, and emotions',
  'Measure performance over time',
  'Prepare for prop-firm evaluations',
];

const reviewQuestions = [
  'Which setups are actually working for me?',
  'Where do I break my rules most often?',
  'Did news volatility affect my entry?',
  'What should I improve before next week?',
];

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
          title="A trading journal for disciplined review."
          description="The goal is simple: help traders stop repeating mistakes blindly and start reviewing with structure."
          heroImage="/heroes/hero-about.png"
          heroAlt="Trader reviewing journal analytics"
          heroPosition={{ mobile: '76% 28%', tablet: '68% 30%', desktop: '62% 32%', xl: '60% 30%' }}
          contentClassName="max-w-lg lg:max-w-[33rem]"
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8 lg:space-y-10">
            <div>
              <SectionHeader
                align="left"
                eyebrow="WHY WE BUILT JAHZJOURNALS"
                title="Serious traders need evidence, not hype."
              />
            </div>

            <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
              <Reveal direction="up" delay={60} className="min-w-0">
                <p className="max-w-md text-base leading-7 text-muted">
                  A trading journal should do more than store results. It should help you see the decisions and habits behind them.
                </p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                  REVIEW WHAT MATTERS
                </p>
                <ul className="mt-3 space-y-2.5">
                  {reviewQuestions.map((question) => (
                    <li
                      key={question}
                      className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400"
                      />
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal direction="up" delay={100} className="min-w-0">
                <div className="max-w-[520px] space-y-5 text-base leading-8 text-muted">
                  <p>
                    Trading decisions are often scattered across broker history, chart screenshots, notes, and memory. JAHZJOURNALS brings them into one review process.
                  </p>
                  <p>
                    Log trades with context, attach screenshots, track rules, risk, and emotions, then use your own data to identify repeated mistakes and stronger habits.
                  </p>
                  <p>
                    It is built for forex, gold, indices, and prop-firm traders who want to review their execution honestly—not rely on hype, signals, or promises.
                  </p>
                </div>
              </Reveal>
            </div>
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
          <StaggerContainer className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {values.map((value, index) => (
              <StaggerItem key={value} index={index} className="flex">
                <div className="motion-card-hover motion-card-glow flex w-full items-center rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-5 text-sm font-semibold leading-snug text-foreground shadow-sm dark:shadow-none">
                  {value}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
        <CTASection
          title="Trade with structure. Review with honesty. Improve with evidence."
          cta="Start Free Today"
          to="/register"
        />
      </main>
      <Footer />
    </div>
  );
};

export default About;
