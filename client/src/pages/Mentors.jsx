import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  MessageSquareWarning, 
  ShieldCheck, 
  AlertTriangle, 
  GraduationCap, 
  Award, 
  Building, 
  Users, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  BarChart3, 
  FileText, 
  Check, 
  Zap, 
  TrendingUp, 
  MessageCircle,
  HelpCircle,
  Sliders,
  DollarSign,
  EyeOff
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import MentorMockup from '../components/MentorMockup';
import FAQItem from '../components/FAQItem';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/useAuth';

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
      'Strategy Risk Guard rules (e.g. 1% max risk, required SL)',
      'Direct trade comments & feedback grading (A/B/C/F)',
      'Student replies and resolution threads',
      'Full Pro trading features included for the mentor',
    ],
    ctaText: 'Start Private Cohort',
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
      'Review assignments and homework submissions',
      'Paid student cohort checkouts (1.5% platform commission)',
      '1-on-1 private coaching summaries & action items',
      'Custom academy branding & logo display',
    ],
    ctaText: 'Launch Growth Academy',
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
      'Aggregated academy risk & performance analytics',
      'Multi-currency cohort performance tracking',
      'Priority mentor onboarding & dedicated VIP support',
    ],
    ctaText: 'Get Mega Academy',
  },
];

const mentorFaqs = [
  [
    'Why use JAHZJOURNALS alongside my Telegram channel?',
    'Telegram is great for chat, signals, and market announcements, but it gets chaotic when dozens of students send chart screenshots. JAHZJOURNALS gives your community a structured trading journal where you can verify their real execution, inspect their before/after screenshots, and prove whether they followed your risk rules.',
  ],
  [
    'What is the Student Strategy Risk Guard feature?',
    'You set your academy risk rules (e.g. Max 1.0% risk per trade, required stop-loss, allowed currency pairs). When a student logs a trade with 12% risk on Gold, the system automatically flags it in red with clear proof: "⚠️ Exceeded Mentor Rule by +11.0%". This protects your reputation when students over-leverage.',
  ],
  [
    'How does the 1.5% registration fee work for paid cohorts?',
    'If you sell mentorship access, you can set your cohort price in NGN. JAHZJOURNALS handles student card payments via Paystack and collects only a modest 1.5% platform fee, with the net 98.5% credited directly to your payout balance.',
  ],
  [
    'Do my students need to pay for their own Starter or Pro accounts?',
    'No! Your Mentor plan covers your students so they can log trades, attach chart screenshots, and receive your reviews inside your academy workspace without paying individually.',
  ],
  [
    'Can a student keep personal trades private from the mentor?',
    'Yes. Student trust is paramount. Students can explicitly designate which trading accounts are shared with your academy. Unshared accounts and private emotional notes remain strictly invisible to the mentor.',
  ],
  [
    'Can I upgrade my student capacity as my channel grows?',
    'Yes, absolutely. You can upgrade or adjust your student tier at any time directly from your billing settings. Your capacity updates instantly without interrupting your students\' access.',
  ],
];

const comparisonPoints = [
  {
    telegram: 'Screenshots scattered across hundreds of noisy chat messages',
    jahz: 'Centralized student trade journal with before & after chart attachments',
  },
  {
    telegram: 'Students cherrypick wins and hide catastrophic 10% risk losses',
    jahz: 'Automated Strategy Risk Guard instantly flags rule violations in red',
  },
  {
    telegram: 'No proof when a student blows an account and blames your strategy',
    jahz: 'Complete execution audit trail with exact lot sizes, entries, and SL data',
  },
  {
    telegram: 'Mentor burns out answering the same questions in messy DMs',
    jahz: 'Two-way trade feedback cards with grades (A/B/C/F) and student replies',
  },
  {
    telegram: 'No way to assign homework drills or track structured completion',
    jahz: 'Review assignments with due dates and submission grading',
  },
];

const Mentors = () => {
  const { user } = useAuth();

  const scrollToPricing = (e) => {
    e.preventDefault();
    const el = document.getElementById('pricing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO 
        title="Mentor & Academy Workspace | JAHZJOURNALS"
        description="Manage student trading journals, enforce Strategy Risk Guards, grade executions, and run professional forex cohorts without chasing screenshots on Telegram."
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumbs />

        {/* Hero Section */}
        <PageHeader
          eyebrow="Mentors & Trading Academies"
          title="Turn Your Trading Channel Into a High-Accountability Forex Academy."
          description="Give your students a structured place to log real trades, upload chart screenshots, and receive organized feedback. Enforce risk rules automatically and prove who actually follows your edge."
          primaryCta={{ 
            label: 'View Mentor Plans & Capacity', 
            to: '#pricing',
            onClick: scrollToPricing
          }}
          secondaryCta={user ? {
            label: 'Go to Workspace',
            to: user.role === 'MENTOR' ? '/mentors/groups' : '/student-cohorts'
          } : {
            label: 'Start Academy Trial',
            to: '/register'
          }}
          heroImage="/heroes/hero-mentors.png"
          heroAlt="Mentor reviewing student trading journals"
          heroPosition={{ mobile: '72% top', tablet: '64% top', desktop: 'center top' }}
        />

        {/* Telegram vs JAHZJOURNALS Comparison Section */}
        <section className="py-16 sm:py-20 border-b border-border">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                The Coaching Evolution
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-foreground">
                Why Top Forex Mentors Leave Telegram for JAHZJOURNALS
              </h2>
              <p className="mt-3 text-sm text-muted max-w-2xl mx-auto">
                Telegram and WhatsApp are great for signals and hype. But when it comes to teaching real execution discipline, chat apps fail mentors and students alike.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Old Way Card */}
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                    <MessageSquareWarning size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">Telegram & WhatsApp Coaching</h3>
                    <p className="text-xs text-red-400 font-medium">Unstructured, noisy, and unverified</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {comparisonPoints.map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-muted">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                        ✕
                      </span>
                      <span>{pt.telegram}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* JAHZJOURNALS Way Card */}
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.04] p-6 sm:p-8 shadow-lg shadow-emerald-950/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">JAHZJOURNALS Academy System</h3>
                    <p className="text-xs text-emerald-400 font-medium">Verified, disciplined, and automated</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {comparisonPoints.map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-gray-200">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        ✓
                      </span>
                      <span className="font-medium text-foreground">{pt.jahz}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Workspace Preview / Mockup Section */}
        <section className="py-16 sm:py-20 border-b border-border">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <SectionHeader 
                align="left" 
                eyebrow="Real-Time Workspace" 
                title="Review student execution with zero guesswork." 
                description="Your mentor dashboard gives you an instant birds-eye view of who is trading, who is respecting your risk rules, and who needs corrective feedback today."
              />

              <div className="mt-8 space-y-4">
                <div className="flex gap-4 p-4 rounded-xl border border-border bg-surface">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Black-and-White Strategy Risk Guard</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      If a student risks 12% on Gold instead of your specified 1% limit, JAHZJOURNALS flags it in bold red before excuses can be made.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-xl border border-border bg-surface">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Two-Way Trade Review & Grade Cards</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Leave comments and assign letter grades (A+, B, C, F) directly on student trades. Students view your review on their trade detail page and can submit follow-up replies.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-xl border border-border bg-surface">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Student Privacy & Respect</h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Students maintain complete control over their personal journals. Unshared personal accounts stay private, preserving trader trust.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <MentorMockup />
            </div>
          </div>
        </section>

        {/* Feature Grid / Core Specifications */}
        <section className="py-16 sm:py-20 border-b border-border">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Complete Academy Toolset
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black text-foreground">
              Everything You Need to Scale Your Forex Mentorship
            </h2>
            <p className="mt-3 text-sm text-muted max-w-2xl mx-auto">
              Engineered specifically for African trading academies, coaching masterminds, and prop firm preparation groups.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: AlertTriangle,
                title: 'Strategy Risk Guard',
                description: 'Lock in max risk percentage, required stop loss, and allowed pairs. Instantly audit who breaks rules.',
                color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              },
              {
                icon: FileText,
                title: 'Review Assignments',
                description: 'Issue weekly homework drills (e.g. "Log 3 A+ liquidity sweep trades") and grade student submissions.',
                color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
              },
              {
                icon: Users,
                title: 'Private Cohorts & Hub',
                description: 'Organize students by intake cohort with unique invitation tokens. Students access an enrolled academy hub.',
                color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              },
              {
                icon: MessageCircle,
                title: '1-on-1 Coaching Summaries',
                description: 'Document private mentor observations, action items, and weekly progress reflections for individual traders.',
                color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
              },
              {
                icon: DollarSign,
                title: 'Paid Cohort Checkouts',
                description: 'Monetize paid mentorships via Paystack. Platform fee is only 1.5%, crediting 98.5% straight to your account.',
                color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              },
              {
                icon: BarChart3,
                title: 'Aggregated Performance',
                description: 'Track community win rates, profit factors, and execution discipline across all students in one glance.',
                color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="rounded-2xl border border-border bg-surface p-6 hover:border-emerald-500/30 transition-all duration-200">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${f.color} mb-4`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-foreground text-base">{f.title}</h3>
                  <p className="mt-2 text-xs text-muted leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MENTOR & ACADEMY PRICING PLANS SECTION (DIRECTLY ON THIS PAGE)             */}
        {/* ========================================================================= */}
        <section id="pricing" className="py-16 sm:py-24 border-b border-border scroll-mt-12">
          <div className="text-center mb-12 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Clear, Tiered Capacity
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Mentor & Academy Account Pricing
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mx-auto">
              Flat, bracketed pricing based on your active student community. No hidden fees or per-trade charges. All plans include full Pro trading tools for the mentor.
            </p>
          </div>

          {/* Complimentary Trial Announcement */}
          <div className="mb-10 max-w-4xl mx-auto rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-surface to-slate-950 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg text-left">
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-bold text-lg border border-blue-500/30">
                ⏳
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-400">
                    Complimentary 14-Day Trial + 12h Grace
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground mt-0.5">
                  Test the Mentor Workspace with up to 50 students risk-free
                </h4>
                <p className="text-xs text-muted">
                  Includes full Private Cohort access, 2 cohorts, and Strategy Risk Guards. Strictly one trial per user.
                </p>
              </div>
            </div>
            <Link
              to="/pricing/mentor"
              className="shrink-0 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold py-2.5 px-4 text-xs transition shadow-md whitespace-nowrap"
            >
              Start 14-Day Trial →
            </Link>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            {PRESET_TIERS.map((tier) => {
              const Icon = tier.icon;

              return (
                <div
                  key={tier.name}
                  className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all duration-200 hover:-translate-y-1 ${
                    tier.highlighted
                      ? 'border-emerald-400/60 bg-emerald-500/[0.08] shadow-2xl ring-1 ring-emerald-400/50'
                      : 'border-border bg-surface shadow-sm'
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3.5 right-6 rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-black text-slate-950 uppercase tracking-wider shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted border border-border text-emerald-400">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-foreground tracking-tight">{tier.name}</h3>
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                        {tier.studentRange}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-muted leading-relaxed min-h-[36px]">
                    {tier.tagline}
                  </p>

                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-foreground">
                      ₦{tier.priceNgn.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted font-medium">/month</span>
                  </div>

                  <ul className="mt-6 flex-1 space-y-3 pt-6 border-t border-border">
                    {tier.features.map((feat, idx) => (
                      <li key={idx} className="flex gap-2.5 text-xs text-muted">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 pt-4">
                    <Link
                      to={user ? '/pricing/mentor' : '/register'}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold transition-all ${
                        tier.highlighted
                          ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20'
                          : 'border border-border bg-surface-muted text-foreground hover:bg-surface hover:border-emerald-500/40'
                      }`}
                    >
                      <span>{tier.ctaText}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <p className="text-xs text-muted">
              Need a custom community setup or 2,000+ students?{' '}
              <Link to="/contact" className="text-emerald-400 font-semibold underline underline-offset-4 hover:text-emerald-300">
                Contact our academy team
              </Link>{' '}
              for enterprise arrangements.
            </p>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="py-16 sm:py-20 border-b border-border">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Got Questions?
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black text-foreground">
              Frequently Asked Questions for Mentors
            </h2>
            <p className="mt-3 text-sm text-muted max-w-2xl mx-auto">
              Everything you need to know about setting up your trading academy on JAHZJOURNALS.
            </p>
          </div>

          <div className="max-w-3xl mx-auto divide-y divide-border">
            {mentorFaqs.map(([question, answer], idx) => (
              <FAQItem key={idx} question={question} answer={answer} />
            ))}
          </div>
        </section>

        {/* Final CTA Banner */}
        <CTASection 
          title="Create a verified review culture for your students today." 
          cta="Start Your Academy On JAHZJOURNALS" 
          to={user ? '/pricing/mentor' : '/register'}
        />
      </main>

      <Footer />
    </div>
  );
};

export default Mentors;
