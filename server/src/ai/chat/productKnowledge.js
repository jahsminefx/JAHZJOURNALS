/**
 * Verified Product Knowledge Base & Deterministic Multi-Doc Retrieval
 * Used strictly by JAHZ AI App Support Mode (SUPPORT_ASSISTANT).
 * Do not inject user trade records or analytics metrics into this module.
 */

const PRODUCT_KNOWLEDGE_VERSION = '2026.11.v1';

const NO_VERIFIED_DOC_FALLBACK =
  'No verified JAHZJOURNALS documentation was found for this request. Do not guess or invent navigation. State that the feature could not be confirmed and direct the user to the relevant support path.';

const STOPWORDS = new Set([
  'what', 'is', 'are', 'was', 'were', 'how', 'do', 'does', 'did',
  'i', 'we', 'you', 'they', 'it', 'can', 'could', 'should', 'would',
  'will', 'to', 'the', 'a', 'an', 'my', 'your', 'our', 'their',
  'on', 'in', 'at', 'for', 'of', 'with', 'use', 'using', 'about',
  'me', 'tell', 'please', 'get', 'there', 'any', 'give', 'explain',
  'show', 'where', 'when', 'which', 'this', 'that', 'these', 'those',
  'and', 'or', 'be', 'by', 'from', 'as', 'into', 'via',
]);

const STEM_MAP = {
  jahzjournal: 'jahzjournals',
  jahzjournals: 'jahzjournals',
  trades: 'trade',
  logging: 'log',
  logged: 'log',
  logs: 'log',
  screenshots: 'screenshot',
  images: 'image',
  charts: 'chart',
  rules: 'rule',
  strategies: 'strategy',
  setups: 'setup',
  accounts: 'account',
  plans: 'plan',
  limits: 'limit',
  tiers: 'tier',
  pricing: 'price',
  prices: 'price',
  reviews: 'review',
  reviewing: 'review',
  emotions: 'emotion',
  themes: 'theme',
  settings: 'setting',
  notifications: 'notification',
  alerts: 'alert',
  reminders: 'reminder',
  metrics: 'metric',
  analytics: 'analytics',
  signals: 'signal',
  calculators: 'calculator',
  calendars: 'calendar',
  mentors: 'mentor',
  students: 'student',
  cohorts: 'cohort',
  academies: 'academy',
  evaluations: 'evaluation',
  challenges: 'challenge',
  drawdowns: 'drawdown',
  uploads: 'upload',
  uploading: 'upload',
  captured: 'capture',
  captures: 'capture',
  capturing: 'capture',
  phones: 'phone',
  mobiles: 'mobile',
};

const normalizeRawTokens = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

const stemToken = (token) => STEM_MAP[token] || token;

const tokenizeQuery = (text) => {
  const raw = normalizeRawTokens(text);
  const meaningfulRaw = raw.filter((t) => !STOPWORDS.has(t));
  const stemmed = meaningfulRaw.map(stemToken);
  return {
    rawAll: raw,
    meaningfulRaw,
    stemmed,
    paddedRaw: ` ${raw.join(' ')} `,
    paddedMeaningful: ` ${meaningfulRaw.join(' ')} `,
    paddedStemmed: ` ${stemmed.join(' ')} `,
  };
};

const PRODUCT_DOCS = [
  {
    id: 'what-is-jahzjournals',
    title: 'About JAHZJOURNALS',
    routes: ['/', '/dashboard', '/about'],
    phrases: [
      'jahzjournals',
      'jahz journal',
      'jahz journals',
      'about jahzjournals',
      'what jahzjournals',
      'trading journal platform',
    ],
    tags: [
      'jahzjournals', 'overview', 'platform', 'journal', 'about',
      'execution', 'discipline', 'analytics', 'purpose',
    ],
    content:
      'JAHZJOURNALS is a dedicated trading journal and analytics platform built to help traders log trades, review chart screenshots, track execution discipline, rules, and emotions, analyse performance across accounts, and evaluate prop-firm compliance. JAHZJOURNALS is NOT a broker, trade signal service, financial adviser, or market prediction tool, and does not guarantee trading outcomes or challenge passes.',
  },
  {
    id: 'manual-trade-logging',
    title: 'Manual Trade Logging Workflow',
    routes: ['/trades/new', '/trades', '/trades/:id/review', '/trades/:id'],
    phrases: [
      'log trade',
      'add trade',
      'new trade',
      'enter trade',
      'record trade',
      'manual trade',
      'trade logging',
    ],
    tags: [
      'log', 'trade', 'manual', 'new', 'entry', 'record',
      'execution', 'exit', 'pair', 'lot', 'account',
    ],
    content:
      'To log a trade manually in JAHZJOURNALS: click "New Trade" (/trades/new) in the sidebar, or open "Trades" (/trades) and select New Trade. Select your trading account, enter pair/symbol, direction (BUY/SELL), entry price, stop loss, take profit, lot size, exit price/status, strategy/setup, and notes. If personal Risk Management rules are enabled, pre-trade rule checks warn you before saving. After logging, open any trade from "Trades" (/trades) to attach screenshots, rule violations, emotion logs, and full review details (/trades/:id/review).',
  },
  {
    id: 'log-trades-with-jahz-ai',
    title: 'Log Trades with JAHZ AI',
    routes: ['/trades', '/trades/new', '/ai/ask-jahz'],
    phrases: [
      'log with jahz ai',
      'log trade with ai',
      'jahz ai trade',
      'ai trade capture',
      'ai log',
      'capture trade',
      'screenshot trade capture',
    ],
    tags: [
      'ai', 'log', 'trade', 'capture', 'screenshot', 'draft',
      'confirm', 'duplicate', 'multimodal', 'batch', 'receipt',
    ],
    content:
      'To log trades faster with JAHZ AI: click "Log with JAHZ AI" in the sidebar (also available on the Trades page, Trade Form, and the "Log Trade with AI" button on Ask JAHZ /ai/ask-jahz). You can type a natural-language trade summary (e.g., pair, direction, entry, stop loss, exit, lot size, account) and/or upload up to 10 screenshots at once (including single broker receipts or MetaTrader History lists containing multiple closed trades). JAHZ AI extracts a candidate draft card for your review, checks for potential duplicates, and saves only after you click Confirm & Save. Post-save Journal Assist can also enrich entry/exit reflections. Plan access: available on Pro (300 AI trade captures/month), Starter Sync (unlimited), Pro Sync (unlimited), and Mentor/Academy (300/month on Private Cohort & Growth; unlimited on Mega Academy). Free and Starter users can log trades manually via "New Trade" or upgrade at /pricing.',
  },
  {
    id: 'screenshots-and-vision-ai',
    title: 'Chart Screenshots & Screenshot Vision AI',
    routes: ['/trades/:id', '/trades/:id/review', '/ai/screenshots', '/ai/usage'],
    phrases: [
      'screenshot limit',
      'vision ai',
      'chart screenshot',
      'upload screenshot',
      'analyze visually',
      'screenshot analysis',
    ],
    tags: [
      'screenshot', 'vision', 'chart', 'image', 'upload', 'analyze', 'visual',
    ],
    content:
      'You can attach chart screenshots when logging or reviewing a trade (/trades/:id or /trades/:id/review). Allowed screenshots per trade depend on your plan: Free includes 1 per trade, Starter includes 3 per trade, Pro / Starter Sync / Pro Sync include 10 per trade, and Mentor plans include unlimited screenshots. JAHZ AI Screenshot Vision runs inside an individual Trade Detail page (/trades/:id) to provide educational observations on support/resistance levels, market structure, and candlestick patterns (never trade signals). Screenshot Vision requires Pro, Starter Sync, Pro Sync, or Mentor and screenshot analysis consent enabled in JAHZ AI -> AI Privacy & Usage (/ai/usage) or Settings -> Journal Preferences.',
  },
  {
    id: 'rules-strategies-setups-emotions',
    title: 'Rules, Strategies, Setups & Emotions',
    routes: ['/rules', '/strategies', '/trades/:id/review'],
    phrases: [
      'trading rule',
      'rule checklist',
      'rule violation',
      'playbook',
      'emotion tracking',
      'psychology log',
    ],
    tags: [
      'rule', 'strategy', 'setup', 'emotion', 'checklist', 'discipline', 'violation', 'playbook',
    ],
    content:
      'Manage your personal trading rules in "Rules" (/rules)—you can create, edit, pause, or remove rules and flag broken rules during trade review or pre-trade checks. Build playbooks, entry setups, and per-setup checklists in "Strategies" (/strategies); unused historical strategies can be archived safely. Emotion tracking (logging pre-trade, in-trade, and post-trade emotional state such as Calm, FOMO, or Revenge Mindset) is unlocked on Starter, Pro, Sync, and Mentor plans during trade entry and review.',
  },
  {
    id: 'daily-and-weekly-reviews',
    title: 'Daily Review & Weekly Coach Reviews',
    routes: ['/daily-review', '/weekly-review', '/ai/weekly-coach'],
    phrases: [
      'daily review',
      'weekly review',
      'weekly coach',
      'pdf report',
      'coaching summary',
    ],
    tags: [
      'daily', 'weekly', 'review', 'coach', 'reflection', 'lesson', 'summary', 'pdf',
    ],
    content:
      'Use "Daily Review" (/daily-review) to inspect a day\'s deterministic trade metrics, log what went well or wrong, and generate an AI Daily Review (Starter plan and above). Use "Weekly Review" (/weekly-review) or "JAHZ AI -> Weekly Coach" (/ai/weekly-coach) to compile weekly trade statistics, record reflections, request an AI Weekly Coaching Summary (Starter and above), or export PDF performance reports (Pro and above).',
  },
  {
    id: 'analytics-and-edge-finder',
    title: 'Analytics & JAHZ Edge Finder',
    routes: ['/dashboard', '/analytics', '/ai/edge-finder'],
    phrases: [
      'edge finder',
      'analytics page',
      'win rate',
      'profit factor',
      'performance chart',
      'equity curve',
    ],
    tags: [
      'analytics', 'dashboard', 'edge', 'finder', 'metric', 'session', 'pair', 'statistic',
    ],
    content:
      'The "Dashboard" (/dashboard) and "Analytics" (/analytics) pages show net P&L, win rate, profit factor, maximum drawdown, performance/equity curves, session performance, and pair breakdowns filterable by account and date range. JAHZ Edge Finder is located in "JAHZ AI -> Edge Finder" (/ai/edge-finder) and on the Dashboard Edge Finder widget: it deterministically evaluates combinations of pair, session, and emotion to surface candidate edges and then asks JAHZ AI for an explanation. Edge Finder requires at least 10 closed trades and a Pro, Sync, or Mentor plan.',
  },
  {
    id: 'prop-firm-cockpit-and-risk-guard',
    title: 'Prop-Firm Cockpit & Risk Guard',
    routes: ['/accounts', '/accounts/prop-firm/new', '/accounts/:id'],
    phrases: [
      'prop firm',
      'prop firm account',
      'funding evaluation',
      'risk guard',
      'trailing drawdown',
      'daily loss limit',
      'payout ledger',
    ],
    tags: [
      'prop', 'firm', 'funded', 'challenge', 'evaluation', 'drawdown', 'compliance', 'payout', 'phase',
    ],
    content:
      'To track a prop-firm challenge or funded account, open "Accounts" (/accounts) and create a Prop-Firm Account (/accounts/prop-firm/new). Inside the account detail view (/accounts/:id), the Prop-Firm Cockpit monitors daily loss allowance (with reset countdown), static or trailing overall drawdown floor, profit target progress, minimum trading days, consistency rules, phase advancement, and payouts. Risk Guard checks proposed trade parameters against your firm limits. Prop-Firm tools require Pro, Starter Sync, Pro Sync, or Mentor. All compliance alerts are advisory self-tracking tools and do not guarantee challenge passage or broker execution.',
  },
  {
    id: 'economic-calendar',
    title: 'Economic Calendar & Volatility Planning',
    routes: ['/calendar'],
    phrases: [
      'economic calendar',
      'news calendar',
      'high impact',
      'cpi',
      'nfp',
      'news alert',
    ],
    tags: [
      'calendar', 'news', 'economic', 'event', 'volatility', 'timezone', 'cpi', 'nfp', 'macro',
    ],
    content:
      'Open "Calendar" (/calendar) in the sidebar to view scheduled macroeconomic events (such as USD CPI, NFP, and central bank releases) adjusted to your configured timezone, set personal event-reminder preferences, and review whether your trades were placed around high-impact news volatility. Calendar information is planning reference only—not financial advice—and actual figures can arrive after scheduled release times; always verify critical releases with official issuing authorities.',
  },
  {
    id: 'risk-calculator',
    title: 'Position Size & Risk Calculator',
    routes: ['/risk-calculator'],
    phrases: [
      'risk calculator',
      'position size',
      'lot size',
      'calculate lot',
      'broker cost',
    ],
    tags: [
      'calculator', 'risk', 'lot', 'size', 'position', 'pip', 'spread', 'commission', 'slippage',
    ],
    content:
      'Open "Calculator" (/risk-calculator) in the sidebar to compute deterministic position lot sizes from your account balance, risk percentage or cash risk, stop-loss distance, spread, slippage buffer, and commission per lot. It also shows a 5-scenario risk matrix and prop-firm combined open-risk safety checks.',
  },
  {
    id: 'pricing-and-plan-limits',
    title: 'Plans, Live NGN Pricing & AI Limits',
    routes: ['/pricing', '/pricing/mentor', '/ai/usage'],
    phrases: [
      'plan limit',
      'free plan',
      'starter plan',
      'pro plan',
      'starter sync',
      'pro sync',
      'mentor plan',
      'mega academy',
      'how much',
      'upgrade plan',
    ],
    tags: [
      'price', 'plan', 'limit', 'tier', 'free', 'starter', 'pro', 'sync', 'mentor', 'subscription', 'upgrade', 'quota', 'ngn',
    ],
    content:
      'Live JAHZJOURNALS plans (/pricing): (1) Free (₦0 forever, no card needed): up to 20 trades/month, 1 trading account, 1 screenshot/trade, basic analytics, trading rules, 2 shared monthly trial AI requests across Trade Review and Analytics Chat, plus App Support Chat guidance. (2) Starter (₦4,000/month): up to 100 trades/month, 3 accounts, 3 screenshots/trade, detailed analytics, emotion tracking, and monthly AI quotas (10 Trade Reviews, 5 Weekly Coach, 10 Analytics Chat, 20 Journal Assistant, 10 Daily Reviews, 50 App Support). (3) Pro (₦8,500/month): unlimited trades and accounts, 10 screenshots/trade, advanced analytics, Prop-Firm Cockpit, PDF reports, Log Trades with JAHZ AI (300/month), Edge Finder (10/mo), Trading Plan (5/mo), Screenshot Vision (20/mo), Trade Review (50/mo), Weekly Coach (20/mo), Analytics Chat (50/mo). (4) Starter Sync (₦38,000/month): Pro features + automated MT4/MT5 Cloud Sync for up to 2 accounts + unlimited AI trade captures. (5) Pro Sync (₦72,000/month): Pro features + automated MT4/MT5 Cloud Sync for up to 5 accounts + priority sync + unlimited AI trade captures. Mentor/Academy tiers (/pricing/mentor): Private Cohort (₦14,500/mo, 80 students, 2 cohorts), Growth Community (₦25,000/mo, 200 students, 5 cohorts), Mega Academy (₦85,000/mo, 1,000 students, unlimited cohorts, 2 MT sync accounts, unlimited AI captures), Mega Academy x Pro Sync (₦120,000/mo, 5 MT sync accounts).',
  },
  {
    id: 'mobile-themes-settings-support',
    title: 'Mobile Experience, Themes, AI Privacy & Support',
    routes: ['/settings', '/ai/usage', '/support', '/notifications'],
    phrases: [
      'dark mode',
      'light mode',
      'appearance setting',
      'privacy setting',
      'enable jahz ai',
      'human support',
      'support chat',
      'mt4',
      'mt5',
      'cloud sync',
      'clear ai history',
    ],
    tags: [
      'mobile', 'phone', 'tablet', 'theme', 'appearance', 'dark', 'light',
      'setting', 'profile', 'password', 'notification', 'privacy', 'support',
      'human', 'mentor', 'cohort', 'sync', 'metatrader',
    ],
    content:
      'JAHZJOURNALS is mobile-first and works across phones, tablets, and laptops. Under "Settings" (/settings): change Light, Dark, or System theme and table density in Appearance Settings; update name, timezone, currency, password, or export/delete data in Profile & Security Settings; set defaults and Weekly Dashboard Goals in Trading Preferences; configure drawdown and trade warnings in Risk Management; adjust required fields in Journal Preferences; manage email/push alerts in Notifications; control mentor trade sharing in Mentor Settings; manage MetaTrader (MT4/MT5) EA/Cloud Sync tokens inside Accounts (/accounts). To toggle JAHZ AI features or journal-data/screenshot consent ("enableJahzAi", "allowTradeDataAnalysis", "allowScreenshotAnalysis"), visit "JAHZ AI -> AI Privacy & Usage" (/ai/usage). For 1-on-1 help from JAHZJOURNALS support staff, switch to the "Support Chat" tab at the top of the assistant widget or open "Support" (/support).',
  },
];

// Precompute normalized token sets per document for fast deterministic retrieval
const INDEXED_DOCS = PRODUCT_DOCS.map((doc) => {
  const titleTokens = new Set(normalizeRawTokens(doc.title).map(stemToken));
  const tagTokens = new Set(doc.tags.map((t) => stemToken(t.toLowerCase())));
  const bodyTokens = new Set(
    normalizeRawTokens(doc.content)
      .filter((t) => !STOPWORDS.has(t))
      .map(stemToken)
  );
  const normalizedPhrases = doc.phrases.map((p) => ({
    raw: p.toLowerCase(),
    stemmed: normalizeRawTokens(p).filter((t) => !STOPWORDS.has(t)).map(stemToken).join(' '),
  }));

  return {
    ...doc,
    titleTokens,
    tagTokens,
    bodyTokens,
    normalizedPhrases,
  };
});

/**
 * Deterministic multi-document product support search.
 * Never performs arbitrary substring matches across word boundaries
 * (so "jahzjournals" never triggers "journal").
 */
const searchProductKnowledge = (query, maxResults = 3) => {
  const tokens = tokenizeQuery(query);
  if (tokens.rawAll.length === 0) {
    return {
      matched: false,
      docs: [],
      formattedResult: NO_VERIFIED_DOC_FALLBACK,
    };
  }

  const uniqueStemmed = [...new Set(tokens.stemmed)];
  const hasToken = (tok) => uniqueStemmed.includes(tok);

  const scored = INDEXED_DOCS.map((doc) => {
    let score = 0;

    // 1. Exact phrase matches (padded by word boundaries)
    for (const phrase of doc.normalizedPhrases) {
      if (phrase.raw && tokens.paddedRaw.includes(` ${phrase.raw} `)) {
        score += 12;
      } else if (phrase.stemmed && tokens.paddedStemmed.includes(` ${phrase.stemmed} `)) {
        score += 10;
      }
    }

    // 2. Exact token matches against tags, title, and body
    for (const tok of uniqueStemmed) {
      if (doc.tagTokens.has(tok)) score += 5;
      if (doc.titleTokens.has(tok)) score += 4;
      if (doc.bodyTokens.has(tok)) score += 1;
    }

    // 3. Domain disambiguation boosts
    if (doc.id === 'what-is-jahzjournals' && hasToken('jahzjournals')) {
      score += 10;
    }

    if (
      doc.id === 'log-trades-with-jahz-ai' &&
      hasToken('ai') &&
      (hasToken('log') || hasToken('trade') || hasToken('capture') || hasToken('screenshot'))
    ) {
      score += 14;
    }

    if (
      doc.id === 'manual-trade-logging' &&
      hasToken('log') &&
      hasToken('trade') &&
      !hasToken('ai')
    ) {
      score += 8;
    }

    return { doc, score };
  })
    .filter((entry) => entry.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  if (scored.length === 0) {
    return {
      matched: false,
      docs: [],
      formattedResult: NO_VERIFIED_DOC_FALLBACK,
    };
  }

  const docs = scored.map(({ doc }) => ({
    id: doc.id,
    title: doc.title,
    routes: doc.routes,
    content: doc.content,
  }));

  const formattedResult = docs
    .map(
      (d, idx) =>
        `[${idx + 1}] ${d.title} (Verified routes: ${d.routes.join(', ')})\n${d.content}`
    )
    .join('\n\n');

  return {
    matched: true,
    docs,
    formattedResult,
  };
};

module.exports = {
  PRODUCT_KNOWLEDGE_VERSION,
  NO_VERIFIED_DOC_FALLBACK,
  PRODUCT_DOCS,
  searchProductKnowledge,
  normalizeRawTokens,
  stemToken,
  tokenizeQuery,
};
