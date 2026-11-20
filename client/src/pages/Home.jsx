import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
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
import SEO from '../components/SEO';
import { useAuth } from '../context/useAuth';

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
  ['Economic News Calendar', Calendar, 'Track high-impact macroeconomic releases, NFP, CPI, and central bank rate decisions in real-time.', '/calendar'],
  ['Risk Calculator', Target, 'Calculate risk and position size before execution so every trade starts with structure.', '/risk-calculator'],
  ['Weekly Review', CheckCircle2, 'Turn each week into lessons, focus areas, and discipline improvements.'],
  ['Prop Firm Tracker', Wallet, 'Track challenge progress, drawdown pressure, trading days, and rule discipline.'],
  ['Automated Reviews', LineChart, 'Turn structured trade data into rule-based feedback and weekly review prompts.'],
];

const faqs = [
  [
    'What is JAHZJOURNALS?',
    'JAHZJOURNALS is a trading journal and analytics platform that helps you log trades, review screenshots, track discipline, and identify recurring mistakes in your execution.',
  ],
  [
    'Is JAHZJOURNALS a signal service or financial adviser?',
    'No. JAHZJOURNALS does not provide trade signals, tell you what to trade, predict markets, or guarantee outcomes. It helps you review your own execution with structure.',
  ],
  [
    'Can I start free without a card?',
    'Yes. The Free plan is free forever and does not require a credit or debit card. You can log up to 20 trades per month, use one trading account, and upload one screenshot per trade.',
  ],
  [
    'Can I upload chart screenshots?',
    'Yes. JAHZJOURNALS is built for screenshot-based trade review. Your screenshot limit depends on your plan: Free includes 1 screenshot per trade, Starter includes 3, and Pro includes 10.',
  ],
  [
    'Can it help with prop-firm evaluations?',
    'Yes. You can track drawdown limits, profit-target progress, trading days, and rule discipline while preparing for prop-firm evaluations. JAHZJOURNALS cannot guarantee that you will pass.',
  ],
  [
    'Does it work on mobile?',
    'Yes. JAHZJOURNALS is mobile-first and works across phones, tablets, and laptops, so you can log and review trades wherever you trade.',
  ],
  [
    'How does JAHZ AI work?',
    'JAHZ AI analyses your journal data, submitted screenshots, rules, and trading behaviour to highlight patterns and possible mistakes. It is designed for self-review—not trade signals, market predictions, or financial advice.',
  ],
];

const pricing = [
  {
    name: 'Free',
    price: '₦0',
    description: 'Start journaling without pressure.',
    limits: ['20 trades / month', '1 trading account', '1 screenshot per trade'],
    features: [
      'Manual trade entry & execution notes',
      'Basic equity curve & P&L stats',
      'Position-size risk calculator',
      'Weekly review template',
    ],
    to: '/register',
    cta: 'Start Free',
  },
  {
    name: 'Starter',
    price: '₦4,000',
    period: '/month',
    description: 'Build disciplined execution & habits.',
    limits: ['100 trades / month', '3 trading accounts', '3 screenshots per trade'],
    features: [
      'All Free plan capabilities',
      'Weekly AI coaching summaries',
      'Trading psychology & emotion tracking',
      'Rule violation & mistake tagging',
      'Session analysis (London, NY, Asian)',
    ],
    to: '/register?plan=starter',
    cta: 'Choose Starter',
  },
  {
    name: 'Pro',
    price: '₦8,500',
    period: '/month',
    description: 'For serious traders & prop firm candidates.',
    highlighted: true,
    limits: ['Unlimited trades / month', 'Unlimited trading accounts', '10 screenshots per trade'],
    features: [
      'All Starter plan capabilities',
      'Prop-firm challenge tracker & drawdown guards',
      'AI Trade Review & Edge Finder analytics',
      'PDF performance report exports',
      'Priority review processing',
    ],
    to: '/register?plan=pro',
    cta: 'Choose Pro',
  },
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
  <div className="rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-background/55 p-4 shadow-sm dark:shadow-none">
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-300">{value}</p>
  </div>
);

const DisciplineTrend = ({ trend, weeklyChange }) => {
  const data = trend.map((score, index) => ({
    day: `Day ${index + 1}`,
    score,
  }));

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-background/55 p-4 shadow-sm dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Discipline trend</h3>
          <p className="mt-1 text-sm text-gray-500">Last 7 trading days</p>
        </div>
        <p className="rounded-full border border-emerald-500/30 dark:border-emerald-400/20 bg-emerald-500/10 dark:bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          +{weeklyChange} points this week
        </p>
      </div>
      <div className="mt-4 h-24" role="img" aria-label="Discipline trend for the last 7 trading days">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 6, right: 4, bottom: 6, left: 4 }}>
            <Tooltip
              cursor={{ stroke: 'rgba(16, 185, 129, 0.25)', strokeWidth: 2 }}
              contentStyle={{
                background: 'rgb(var(--surface))',
                border: '1px solid rgb(var(--border))',
                borderRadius: '10px',
                color: 'rgb(var(--foreground))',
              }}
              labelStyle={{ color: 'rgb(var(--muted-foreground))' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: '#10b981', stroke: 'rgb(var(--surface))', strokeWidth: 2 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const DisciplineStreak = ({ days, description }) => (
  <div className="mt-5 flex gap-4 rounded-xl border border-emerald-500/30 dark:border-emerald-400/20 bg-emerald-500/10 dark:bg-emerald-400/10 p-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300">
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
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-200/80">Focus area</p>
    <h3 className="mt-2 text-xl font-black text-foreground">{focusArea.title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted">{focusArea.description}</p>
    <button
      type="button"
      onClick={onReviewViolations}
      className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 px-4 py-2 text-sm font-bold text-amber-700 transition hover:border-amber-500/50 hover:bg-amber-500/10 dark:border-amber-200/20 dark:text-amber-100 dark:hover:border-amber-200/40 dark:hover:bg-amber-200/10"
    >
      Review violations
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  </div>
);

const Home = () => {
  const { user } = useAuth();

  const handleReviewViolations = () => {
    // Route to a dedicated violations review page when it exists.
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO />
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
          <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.18),transparent_33%),linear-gradient(180deg,rgba(2,6,23,0.76),rgba(17,24,39,0.82)_70%,rgba(2,6,23,0.92))]" />
          <div className="relative z-20 mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="text-center lg:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-400">Forex journal and analytics</p>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl drop-shadow-sm">
                Stop Guessing. Start Journaling Like a Disciplined Forex Trader.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-200 lg:mx-0 font-medium">
                Track every trade, screenshot, emotion, mistake, and setup, then discover what actually makes you profitable.
              </p>
              <div className="mt-4 flex items-center justify-center lg:justify-start">
                <Link
                  to="/calendar"
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-xs font-bold transition-all shadow-sm group"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Economic News Calendar (Free)</span>
                  <ArrowRight size={13} className="text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              {user ? (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Button to="/dashboard" size="lg" className="w-full sm:w-auto">Go to Dashboard</Button>
                  <Button to="/trades/new" variant="secondary" size="lg" className="w-full sm:w-auto">Log New Trade</Button>
                </div>
              ) : (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Button to="/register" size="lg" className="w-full sm:w-auto">Start Journaling Free</Button>
                  <Button to="/features" variant="secondary" size="lg" className="w-full sm:w-auto">View Features</Button>
                </div>
              )}
              <p className="mt-5 text-sm font-medium text-slate-300">No signals. No hype. Built for structured review.</p>
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
                <div key={problem} className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 dark:border-red-400/20 dark:bg-red-400/[0.06]">
                  <AlertTriangle size={20} className="shrink-0 text-rose-500 dark:text-rose-400" />
                  <span className="text-sm font-semibold text-foreground">{problem}</span>
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
                  <div key={item} className="flex items-center gap-3 text-sm font-semibold text-foreground">
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-6 shadow-sm dark:shadow-none">
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
              {features.map(([title, Icon, description, to]) => (
                <FeatureCard key={title} icon={Icon} title={title} description={description} to={to} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="How it works" title="Five steps from execution to insight." />
            <div className="mt-10 grid gap-5 md:grid-cols-5">
              {['Log your trade', 'Upload screenshots', 'Track emotions and rules', 'Review analytics', 'Discover your edge'].map((step, index) => (
                <div key={step} className="rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-5 shadow-sm dark:shadow-none">
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-300">0{index + 1}</span>
                  <p className="mt-4 font-semibold text-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Economic News Calendar Acquisition Section */}
        <section className="px-4 py-16 sm:px-6 lg:px-8 bg-surface-muted/30 border-y border-border">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <div>
                <SectionHeader
                  align="left"
                  eyebrow="Economic event awareness"
                  title="Disciplined traders do not gamble through red folder news."
                  description="Plan your trading week around high-impact macroeconomic releases, and review how news volatility impacts your personal execution."
                />
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-500 mt-1 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Plan XAUUSD trades around high-impact USD events</p>
                      <p className="text-xs text-muted mt-0.5">Know exactly when NFP, CPI, and FOMC drop so you avoid holding blind exposure during spread expansion.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-500 mt-1 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Avoid revenge trading around CPI and NFP volatility</p>
                      <p className="text-xs text-muted mt-0.5">Configure safeguard buffers before and after major releases to enforce sitting on your hands when whipsaws occur.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-500 mt-1 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Review whether trade entries occurred during news volatility</p>
                      <p className="text-xs text-muted mt-0.5">Tag macroeconomic catalysts in your post-trade journal to verify whether a loss came from strategy or news slippage.</p>
                    </div>
                  </div>
                </div>
                <p className="mt-6 text-xs text-muted font-medium">For trade planning and structured review. Not trading advice or a promise of outcomes.</p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button to="/calendar" variant="secondary" size="md">
                    Explore Live Economic Calendar (Free)
                  </Button>
                  <Button to="/register" size="md">
                    Start Journaling Free
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-emerald-400" />
                    <span className="text-sm font-bold text-foreground">High-Impact Event Safeguard</span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    High Impact (USD)
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="p-3.5 rounded-xl border border-border bg-surface-muted/60">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-foreground">Non-Farm Employment Change (NFP)</p>
                        <p className="text-[11px] text-muted">Bureau of Labor Statistics • USD</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-foreground">13:30 UTC</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                        ±15m buffer recommended
                      </span>
                      <span>Spread expansion expected</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border bg-surface-muted/60">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-foreground">Consumer Price Index (CPI m/m)</p>
                        <p className="text-[11px] text-muted">Bureau of Labor Statistics • USD</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-foreground">13:30 UTC</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                        Journal news tag ready
                      </span>
                      <span>Catalyst review tracking</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                  <span>Synced with ForexFactory & TradingView</span>
                  <Link to="/calendar" className="text-emerald-400 font-semibold hover:underline">
                    View Live Calendar →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-8 shadow-sm dark:shadow-none">
              <SectionHeader
                align="left"
                eyebrow="Discipline"
                title="Your problem may not be your strategy. It may be your discipline."
                description="Use scores, rule tracking, and emotion logs to separate strategy problems from behavior problems."
              />
              <div className="mt-8 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Discipline score</span>
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-300">{disciplineData.score}/100</span>
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
              {pricing.map((plan) => (
                <PricingCard
                  key={plan.name}
                  name={plan.name}
                  price={plan.price}
                  period={plan.period}
                  description={plan.description}
                  limits={plan.limits}
                  features={plan.features}
                  highlighted={plan.highlighted}
                  to={plan.to}
                  cta={plan.cta}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionHeader eyebrow="FAQ" title="Responsible answers before you start." />
            <div className="mt-10 space-y-4">
              {faqs.map(([question, answer], index) => (
                <FAQItem
                  key={question}
                  question={question}
                  answer={answer}
                  defaultOpen={index === 0}
                />
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
