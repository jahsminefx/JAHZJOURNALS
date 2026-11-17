import { 
  getOrganizationSchema, 
  getWebSiteSchema, 
  getSoftwareApplicationSchema, 
  getProductSchema, 
  getFaqSchema,
  getBreadcrumbSchema 
} from './schemas';

export const PAGE_SEO = {
  '/': {
    title: 'JAHZJOURNALS | AI Forex Trading Journal & Analytics Platform',
    description: 'Track trades, analyze performance, improve consistency, and discover your trading edge using AI-powered analytics, prop firm challenge tracking, and psychological coaching.',
    keywords: 'AI Forex Trading Journal, Prop Firm Challenge Tracker, Trading Analytics, Trading Psychology Coach, Forex Journaling App',
    schemas: [
      getOrganizationSchema(),
      getWebSiteSchema(),
      getSoftwareApplicationSchema(),
      getFaqSchema([
        {
          question: 'What is JAHZJOURNALS?',
          answer: 'JAHZJOURNALS is a trading journal and analytics platform that helps you log trades, review screenshots, track discipline, and identify recurring mistakes in your execution.'
        },
        {
          question: 'Is JAHZJOURNALS a signal service or financial adviser?',
          answer: 'No. JAHZJOURNALS does not provide trade signals, tell you what to trade, predict markets, or guarantee outcomes. It helps you review your own execution with structure.'
        },
        {
          question: 'Can I start free without a card?',
          answer: 'Yes. The Free plan is free forever and does not require a credit or debit card. You can log up to 20 trades per month, use one trading account, and upload one screenshot per trade.'
        },
        {
          question: 'Can I upload chart screenshots?',
          answer: 'Yes. JAHZJOURNALS is built for screenshot-based trade review. Your screenshot limit depends on your plan: Free includes 1 screenshot per trade, Starter includes 3, and Pro includes 10.'
        },
        {
          question: 'Can it help with prop-firm evaluations?',
          answer: 'Yes. You can track drawdown limits, profit-target progress, trading days, and rule discipline while preparing for prop-firm evaluations. JAHZJOURNALS cannot guarantee that you will pass.'
        },
        {
          question: 'Does it work on mobile?',
          answer: 'Yes. JAHZJOURNALS is mobile-first and works across phones, tablets, and laptops, so you can log and review trades wherever you trade.'
        },
        {
          question: 'How does JAHZ AI work?',
          answer: 'JAHZ AI analyses your journal data, submitted screenshots, rules, and trading behaviour to highlight patterns and possible mistakes. It is designed for self-review—not trade signals, market predictions, or financial advice.'
        }
      ])
    ]
  },
  '/features': {
    title: 'Features | Trade Reviews, Edge Finder & Performance Analytics',
    description: 'Explore JAHZJOURNALS features: trade review, edge finder, trade screenshot analysis, weekly coach, risk calculator, and prop firm rule monitors.',
    keywords: 'Trade Review, Forex Edge Finder, Trade Screenshot Analyzer, Weekly Trading Coach, Prop Firm Rule Monitor',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Features', path: '/features' }
    ],
    schemas: [
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Features', path: '/features' }
      ])
    ]
  },
  '/pricing': {
    title: 'Pricing & Plans | Free, Starter & Pro Forex Journaling — JAHZJOURNALS',
    description: 'Simple, transparent pricing for disciplined forex traders. Start free with 20 trades/month, or upgrade to Starter (₦4,000/mo) and Pro (₦8,500/mo) for psychology tracking, prop-firm guards, and AI reviews.',
    keywords: 'Forex Trading Journal Pricing, Free Trading Journal, Starter Plan, Pro Plan, JAHZJOURNALS Subscription',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Pricing', path: '/pricing' }
    ],
    schemas: [
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Pricing', path: '/pricing' }
      ])
    ]
  },
  '/prop-firm-traders': {
    title: 'Prop Firm Trading Journal | Pass Challenges & Protect Equity',
    description: 'Master your prop firm challenge with automated daily drawdown safeguards, profit target tracking, and strict breach warnings for FTMO, FundedNext, and custom evaluations.',
    keywords: 'Prop Firm Trading Journal, FTMO Challenge Tracker, Daily Drawdown Protection, Funded Trader Analytics',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Prop Firm Traders', path: '/prop-firm-traders' }
    ],
    schemas: [
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Prop Firm Traders', path: '/prop-firm-traders' }
      ])
    ]
  },
  '/mentors': {
    title: 'Trading Mentors & Academies | Student Performance Oversight',
    description: 'Empower your trading academy or mentorship program. Monitor student performance, review trade executions, and enforce discipline across your trading community.',
    keywords: 'Trading Mentor Portal, Academy Trade Tracker, Student Trading Oversight, Forex Coaching Platform',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Mentors', path: '/mentors' }
    ],
    schemas: [
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Mentors', path: '/mentors' }
      ])
    ]
  },
  '/about': {
    title: 'About JAHZJOURNALS | Empowering Traders with Structured Intelligence',
    description: 'Learn how JAHZJOURNALS was built by traders for traders to eliminate emotional mistakes, quantify edge, and accelerate trader consistency.',
    keywords: 'About JAHZJOURNALS, Trading Journal Story, Forex Analytics Vision, Jahsmine Aninta Founder',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' }
    ],
    schemas: [
      getOrganizationSchema(),
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'About', path: '/about' }
      ])
    ]
  },
  '/contact': {
    title: 'Contact | JAHZJOURNALS',
    description: 'Get in touch with the JAHZJOURNALS team for technical assistance, partnership opportunities, or mentor onboarding.',
    keywords: 'Contact JAHZJOURNALS, Support Inquiry, Trading Journal Help, Customer Success',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Contact', path: '/contact' }
    ],
    schemas: [
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Contact', path: '/contact' }
      ])
    ]
  },
  '/terms': {
    title: 'Terms of Service | JAHZJOURNALS',
    description: 'Read the official Terms of Service and user agreement for JAHZJOURNALS platform and services.',
    keywords: 'JAHZJOURNALS Terms of Service, Legal Agreement, User Terms',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Terms of Service', path: '/terms' }
    ]
  },
  '/privacy': {
    title: 'Privacy Policy | JAHZJOURNALS',
    description: 'Review the JAHZJOURNALS Privacy Policy to understand how your data, account details, and trade records are secured.',
    keywords: 'JAHZJOURNALS Privacy Policy, Data Protection, Security',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Privacy Policy', path: '/privacy' }
    ]
  },
  '/disclaimer': {
    title: 'Risk Disclaimer | JAHZJOURNALS',
    description: 'Important risk disclosure regarding Forex, CFD, and financial market trading.',
    keywords: 'Trading Risk Disclaimer, Financial Market Disclosure',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Risk Disclaimer', path: '/disclaimer' }
    ]
  }
};
