import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Camera,
  CheckCircle2,
  ClipboardList,
  Flame,
  LineChart,
  ShieldCheck,
  Target,
  Wallet,
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Button from '../components/Button';
import SectionHeader from '../components/SectionHeader';
import FeatureCard from '../components/FeatureCard';
import PricingCard from '../components/PricingCard';
import FAQItem from '../components/FAQItem';
import CTASection from '../components/CTASection';
import DashboardMockup from '../components/DashboardMockup';
import PropFirmMockup from '../components/PropFirmMockup';
import MentorMockup from '../components/MentorMockup';
import StatCard from '../components/StatCard';
import TestimonialCard from '../components/TestimonialCard';

const problems = [
  'Taking too many random trades',
  'Repeating the same mistakes',
  'Not knowing which setup works',
  'Poor risk management',
  'Emotional trading',
  'No proper review process',
];

const features = [
  ['Smart Trade Journal', ClipboardList, 'Log pair, direction, setup, risk, result, and before/after notes in one clean workflow.'],
  ['Screenshot-Based Review', Camera, 'Attach chart screenshots for before-entry, entry, exit, and marked post-analysis review.'],
  ['Rule Violation Tracker', ShieldCheck, 'Track the exact rules you break so you can stop repeating the same account-damaging errors.'],
  ['Emotion Tracking', Brain, 'Record mindset before, during, and after trades to identify emotional patterns.'],
  ['Forex Analytics Dashboard', BarChart3, 'See win rate, equity curve, pair performance, session quality, and execution trends.'],
  ['Risk Calculator', Target, 'Calculate risk and position size before execution so every trade starts with structure.'],
  ['Weekly Review', CheckCircle2, 'Turn each week into lessons, focus areas, and discipline improvements.'],
  ['Prop Firm Tracker', Wallet, 'Track challenge progress, drawdown pressure, trading days, and rule discipline.'],
  ['Automated Reviews', LineChart, 'Turn structured trade data into rule-based feedback and weekly review prompts.'],
];

const faqs = [
  ['Is JAHZJOURNALS a signal service?', 'No. JAHZJOURNALS does not provide signals or tell you what to trade. It helps you review your own trading with structure.'],
  ['Does it guarantee profit?', 'No trading journal can guarantee profit. The goal is to help you understand behavior, risk, mistakes, and repeatable edge.'],
  ['Can I upload screenshots?', 'Yes. The product is designed around screenshot-based trade review for chart-focused forex traders.'],
  ['Can I use it on mobile?', 'Yes. The interface is mobile-first for traders who journal from phones, tablets, and laptops.'],
  ['Is it good for prop firm traders?', 'Yes. Prop firm traders can track drawdown, profit target progress, and discipline around challenge rules.'],
  ['Will AI features be added?', 'Yes. The data model is AI-ready, with future reviews planned around structured journal data.'],
];

const pricing = [
  ['Free', '₦0', 'Start journaling without pressure.', ['Limited trades per month', 'Basic trade journal', 'Basic analytics', 'Limited screenshots', 'Risk calculator']],
  ['Pro', '₦8,000/mo', 'For traders serious about review.', ['Unlimited trades', 'Advanced analytics', 'Prop firm tracker', 'AI-ready reviews', 'PDF reports'], true],
  ['Mentor', 'Custom', 'For academies and coaching teams.', ['Student management', 'Mentor dashboard', 'Group analytics', 'Mentor feedback', 'Academy reporting']],
];

const disciplineData = {
  score: 84,
  metrics: [
    { label: 'Rules followed', value: '18/21' },
    { label: 'Risk respected', value: '92%' },
    { label: 'Journal completion', value: '86%' },
    { label: 'Emotional control', value: '78%' },
  ],
  trend: [72, 76, 75, 80, 82, 81, 84],
  weeklyChange: 8,
  streak: {
    days: 5,
    description: 'No revenge trades or risk violations.',
  },
  focusArea: {
    title: 'Overtrading',
    description: 'You exceeded your daily trade limit twice this week.',
  },
};

const DisciplineMetric = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-background/55 p-4">
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-emerald-300">{value}</p>
  </div>
);

const DisciplineTrend = ({ trend, weeklyChange }) => {
  const data = trend.map((score, index) => ({
    day: `Day ${index + 1}`,
    score,
  }));

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-background/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Discipline trend</h3>
          <p className="mt-1 text-sm text-gray-500">Last 7 trading days</p>
        </div>
        <p className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-300">
          +{weeklyChange} points this week
        </p>
      </div>
      <div className="mt-4 h-24" role="img" aria-label="Discipline trend for the last 7 trading days">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 6, right: 4, bottom: 6, left: 4 }}>
            <Tooltip
              cursor={{ stroke: 'rgba(52, 211, 153, 0.18)', strokeWidth: 2 }}
              contentStyle={{
                background: 'rgb(var(--surface))',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#f8fafc',
              }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#34d399"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: '#34d399', stroke: '#ecfdf5', strokeWidth: 2 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const DisciplineStreak = ({ days, description }) => (
  <div className="mt-5 flex gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
      <Flame size={22} aria-hidden="true" />
    </div>
    <div>
      <h3 className="font-semibold text-foreground">{days}-day discipline streak</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  </div>
);

const DisciplineFocusArea = ({ focusArea, onReviewViolations }) => (
  <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/80">Focus area</p>
    <h3 className="mt-2 text-xl font-black text-foreground">{focusArea.title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted">{focusArea.description}</p>
    <button
      type="button"
      onClick={onReviewViolations}
      className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200/20 px-4 py-2 text-sm font-bold text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-200/10"
    >
      Review violations
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  </div>
);

const Home = () => {
  const handleReviewViolations = () => {
    // TODO: Route to a dedicated violations review page when it exists.
  };

  return (
  <div className="min-h-screen bg-background text-foreground">
    <Navbar />

    <main>
      <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <img
          src="/heroes/hero-home.png"
          alt="JAHZJOURNALS forex journal dashboard"
          className="hero-media absolute inset-0 z-0 h-full w-full object-cover brightness-[1.6]"
          style={{
            '--hero-position-mobile': '64% top',
            '--hero-position-tablet': '58% top',
            '--hero-position-desktop': 'center top',
          }}
        />
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.22),transparent_33%),linear-gradient(180deg,rgba(2,6,23,0.78),rgba(17,24,39,0.84)_70%,rgba(2,6,23,0.95))]" />
        <div className="relative z-20 mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">Forex journal and analytics</p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-foreground sm:text-6xl">
              Stop Guessing. Start Journaling Like a Disciplined Forex Trader.
            </h1>
            <p className="mt-6 text-base leading-8 text-muted sm:text-lg">
              Track every trade, screenshot, emotion, mistake, and setup, then discover what actually makes you profitable.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button to="/register" size="lg" className="w-full sm:w-auto">Start Journaling Free</Button>
              <Button to="/features" variant="secondary" size="lg" className="w-full sm:w-auto">View Features</Button>
            </div>
            <p className="mt-5 text-sm text-gray-500">No signals. No hype. Built for structured review.</p>
          </div>
          <DashboardMockup />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="The trader problem"
            title="Most traders do not need more noise. They need better review."
            description="If you cannot see your patterns, your journal cannot help you improve them."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((problem) => (
              <div key={problem} className="flex items-center gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.04] p-4">
                <AlertTriangle size={20} className="shrink-0 text-red-300" />
                <span className="text-sm font-medium text-gray-200">{problem}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeader
              align="left"
              eyebrow="The solution"
              title="A disciplined trading review system in one place."
              description="JAHZJOURNALS brings your trade log, screenshots, rules, emotions, performance metrics, and review process into one clean workflow."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {['Log trades', 'Upload chart screenshots', 'Track rules', 'Track emotions', 'Analyze performance', 'Prepare smart reviews'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-muted">
                  <CheckCircle2 size={18} className="text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Best pair" value="GBPUSD" />
              <StatCard label="Worst pair" value="XAUUSD" tone="red" />
              <StatCard label="Best session" value="London" tone="cyan" />
              <StatCard label="Most broken rule" value="Early entry" tone="white" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Core features"
            title="Everything serious traders need to know what works and what hurts."
            description="Built for forex, gold, indices, prop firm challenges, and screenshot-heavy smart money review."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, Icon, description]) => (
              <FeatureCard key={title} icon={Icon} title={title} description={description} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="How it works" title="Five steps from execution to insight." />
          <div className="mt-10 grid gap-5 md:grid-cols-5">
            {['Log your trade', 'Upload screenshots', 'Track emotions and rules', 'Review analytics', 'Discover your edge'].map((step, index) => (
              <div key={step} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <span className="text-3xl font-black text-emerald-300">0{index + 1}</span>
                <p className="mt-4 font-semibold text-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8">
            <SectionHeader
              align="left"
              eyebrow="Discipline"
              title="Your problem may not be your strategy. It may be your discipline."
              description="Use scores, rule tracking, and emotion logs to separate strategy problems from behavior problems."
            />
            <div className="mt-8 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Discipline score</span>
                <span className="text-3xl font-black text-emerald-300">{disciplineData.score}/100</span>
              </div>
              <div
                className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-label="Discipline score"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={disciplineData.score}
              >
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${disciplineData.score}%` }} />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {disciplineData.metrics.map((metric) => (
                <DisciplineMetric key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>
            <DisciplineTrend trend={disciplineData.trend} weeklyChange={disciplineData.weeklyChange} />
            <DisciplineStreak days={disciplineData.streak.days} description={disciplineData.streak.description} />
            <DisciplineFocusArea focusArea={disciplineData.focusArea} onReviewViolations={handleReviewViolations} />
          </div>
          <div className="space-y-5">
            <PropFirmMockup />
            <MentorMockup />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Pricing preview" title="Start free. Upgrade when your review process grows." />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {pricing.map(([name, price, description, planFeatures, highlighted]) => (
              <PricingCard key={name} name={name} price={price} description={description} features={planFeatures} highlighted={highlighted} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Early feedback" title="Built for traders who care about process." />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <TestimonialCard quote="This is the kind of structure beginners need before they start blaming the market." name="Forex mentor" role="Academy founder placeholder" />
            <TestimonialCard quote="The screenshot workflow makes review feel serious, not scattered." name="Gold trader" role="XAUUSD trader placeholder" />
            <TestimonialCard quote="Prop challenge tracking is exactly where discipline matters most." name="Challenge trader" role="Funded account placeholder" />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SectionHeader eyebrow="FAQ" title="Responsible answers before you start." />
          <div className="mt-10 space-y-4">
            {faqs.map(([question, answer]) => (
              <FAQItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </main>

    <Footer />
  </div>
  );
};

export default Home;
