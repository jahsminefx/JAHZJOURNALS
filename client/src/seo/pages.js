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
          answer: 'JAHZJOURNALS is an AI-powered Forex and financial market trading journal designed to help traders log trades, track emotions, enforce risk management rules, and analyze performance with institutional-grade metrics.'
        },
        {
          question: 'How does the AI Trade Review work?',
          answer: 'JAHZJOURNALS AI analyzes entry/exit prices, risk-to-reward ratios, drawdown percentages, trade screenshots, and discipline rules to give traders personalized coaching recommendations.'
        },
        {
          question: 'Does JAHZJOURNALS support Prop Firm accounts?',
          answer: 'Yes! JAHZJOURNALS has built-in prop firm challenge rules tracking max daily drawdown, overall trailing drawdown, profit targets, and minimum trading days for FTMO, FundedNext, MyForexFunds, and custom prop firm challenges.'
        }
      ])
    ]
  },
  '/features': {
    title: 'Features | AI Trade Reviews, Edge Finder & Performance Analytics',
    description: 'Explore JAHZJOURNALS features: AI trade review, edge finder, trade screenshot analysis, weekly coach, risk calculator, and prop firm rule monitors.',
    keywords: 'AI Trade Review, Forex Edge Finder, Trade Screenshot Analyzer, Weekly Trading Coach, Prop Firm Rule Monitor',
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
    title: 'Pricing & Plans | Free, Pro & Founding Trader Lifetime Access',
    description: 'Simple, transparent pricing for every trader. Start free or upgrade to Pro and Founding Trader lifetime tiers with unlimited AI trade reviews.',
    keywords: 'Forex Trading Journal Pricing, Free Trading Journal, Founding Trader Lifetime Plan, JAHZJOURNALS Subscription',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Pricing', path: '/pricing' }
    ],
    schemas: [
      getProductSchema(),
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Pricing', path: '/pricing' }
      ]),
      getFaqSchema([
        {
          question: 'Can I use JAHZJOURNALS for free?',
          answer: 'Yes, our Free Trader plan allows you to log unlimited trades, track performance metrics, and access core analytics without a credit card.'
        },
        {
          question: 'What is the Founding Trader tier?',
          answer: 'The Founding Trader tier offers a one-time payment for lifetime access to all current and future AI features, unlimited screenshot reviews, and priority support.'
        }
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
    title: 'About JAHZJOURNALS | Empowering Traders with AI Intelligence',
    description: 'Learn how JAHZJOURNALS was built by traders for traders to eliminate emotional mistakes, quantify edge, and accelerate trader profitability with AI.',
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
    title: 'Contact Support & Inquiries | JAHZJOURNALS',
    description: 'Get in touch with the JAHZJOURNALS support team for technical assistance, partnership opportunities, or mentor onboarding.',
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
