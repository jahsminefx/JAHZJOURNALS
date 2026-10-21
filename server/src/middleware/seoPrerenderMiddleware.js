const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

let prisma = null;
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

let cachedBlogPosts = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

function invalidateBlogCache() {
  cachedBlogPosts = null;
  lastCacheTime = 0;
}

function getFileBlogPosts() {
  if (process.env.NODE_ENV === 'production' && cachedBlogPosts && cachedBlogPosts.length > 0) {
    return cachedBlogPosts;
  }
  
  const candidatePaths = [
    path.resolve(__dirname, '../../../client/src/data/blogPosts.js'),
    path.resolve(process.cwd(), 'client/src/data/blogPosts.js'),
    path.resolve(process.cwd(), '../client/src/data/blogPosts.js'),
    path.resolve(__dirname, '../../client/src/data/blogPosts.js'),
  ];

  for (const blogPath of candidatePaths) {
    if (fs.existsSync(blogPath)) {
      try {
        const raw = fs.readFileSync(blogPath, 'utf8');
        const cleaned = raw.replace(/export\s+const\s+BLOG_POSTS\s*=\s*/, 'return ');
        const fn = new Function(cleaned);
        const posts = fn();
        if (Array.isArray(posts) && posts.length > 0) {
          cachedBlogPosts = posts;
          break;
        }
      } catch (err) {
        console.error(`[SEO Prerender] Error loading from ${blogPath}:`, err.message);
      }
    }
  }

  return [];
}

async function getBlogPosts() {
  const now = Date.now();
  const ttl = process.env.NODE_ENV === 'production' ? CACHE_TTL_MS : 3000;

  if (cachedBlogPosts && cachedBlogPosts.length > 0 && now - lastCacheTime < ttl) {
    return cachedBlogPosts;
  }

  try {
    const dbPosts = await getPrismaClient().blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
    });

    if (Array.isArray(dbPosts) && dbPosts.length > 0) {
      cachedBlogPosts = dbPosts.map((p) => ({
        ...p,
        author: {
          name: p.authorName || 'Jahsmine Aninta',
          title: p.authorTitle || 'Founder & Senior Architect, JAHZJOURNALS',
          avatar: p.authorAvatar || '/logo-mark.png',
        },
        publishedAt: p.publishedAt ? p.publishedAt.toISOString().split('T')[0] : '2026-08-01',
      }));
      lastCacheTime = now;
      return cachedBlogPosts;
    }
  } catch (err) {
    // DB query failed or offline, fallback to file
  }

  const filePosts = getFileBlogPosts();
  if (filePosts.length > 0) {
    cachedBlogPosts = filePosts;
    lastCacheTime = now;
    return cachedBlogPosts;
  }

  return cachedBlogPosts || [];
}

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const NAV_HTML = `
  <header style="max-width:1100px;margin:0 auto;padding:1.5rem 1rem;border-bottom:1px solid #1e293b;">
    <nav aria-label="Main Navigation" style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between;">
      <a href="/" style="font-weight:800;font-size:1.25rem;text-decoration:none;color:#10b981;">JAHZJOURNALS</a>
      <ul style="display:flex;flex-wrap:wrap;gap:1rem;list-style:none;margin:0;padding:0;">
        <li><a href="/">Home</a></li>
        <li><a href="/features">Features</a></li>
        <li><a href="/risk-calculator">Position Size Calculator</a></li>
        <li><a href="/prop-firm-traders">Prop Firm Tracker</a></li>
        <li><a href="/trading-psychology">Trading Psychology</a></li>
        <li><a href="/risk-management">Risk Management</a></li>
        <li><a href="/mentors">Mentors</a></li>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href="/blog">Trading Blog &amp; Guides</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  </header>
`;

const FOOTER_HTML = `
  <footer style="max-width:1100px;margin:3rem auto 0;padding:2rem 1rem;border-top:1px solid #1e293b;font-size:0.9rem;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;">
      <div>
        <h3>JAHZJOURNALS</h3>
        <p>Professional Forex, Gold (XAUUSD), Indices &amp; Prop Firm Trading Journal and Analytics Platform. Built for disciplined traders managing USD, NGN, GBP, and EUR accounts.</p>
      </div>
      <div>
        <h4>Platform &amp; Tools</h4>
        <ul>
          <li><a href="/features">Trading Journal Features</a></li>
          <li><a href="/risk-calculator">Free Lot Size &amp; Risk Calculator</a></li>
          <li><a href="/prop-firm-traders">Prop Firm Drawdown Tracker</a></li>
          <li><a href="/trading-psychology">Emotion &amp; Psychology Analytics</a></li>
          <li><a href="/risk-management">Risk Management Framework</a></li>
          <li><a href="/mentors">Mentor &amp; Cohort Portal</a></li>
          <li><a href="/pricing">Pricing Plans</a></li>
        </ul>
      </div>
      <div>
        <h4>Educational Guides</h4>
        <ul>
          <li><a href="/blog">All Forex Trading Articles</a></li>
          <li><a href="/blog/how-to-keep-a-forex-trading-journal">How to Keep a Forex Trading Journal</a></li>
          <li><a href="/blog/how-to-calculate-lot-size-in-forex-and-gold">How to Calculate Lot Size in Forex &amp; Gold</a></li>
          <li><a href="/blog/risk-management-strategies">Forex Risk Management Strategies</a></li>
          <li><a href="/blog/how-to-pass-a-prop-firm-challenge">How to Pass a Prop Firm Challenge</a></li>
          <li><a href="/blog/trading-psychology-guide">Complete Guide to Trading Psychology</a></li>
        </ul>
      </div>
      <div>
        <h4>Company &amp; Legal</h4>
        <ul>
          <li><a href="/about">About Us</a></li>
          <li><a href="/contact">Contact Support</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/disclaimer">Financial Disclaimer</a></li>
          <li><a href="/cookies">Cookie Policy</a></li>
        </ul>
      </div>
    </div>
    <p style="margin-top:1.5rem;">&copy; 2026 JAHZJOURNALS. All rights reserved. Trading foreign exchange, commodities, and CFDs carries a high level of risk and may not be suitable for all investors.</p>
  </footer>
`;

const STATIC_ROUTES = {
  '/': {
    title: 'JAHZJOURNALS — Forex Trading Journal, Risk Calculator & Prop Firm Analytics',
    description: 'Track trades, eliminate revenge trading, calculate exact position sizes, monitor prop firm drawdowns, and discover your statistical edge with JAHZJOURNALS.',
    body: `
      <h1>Automated Forex Trading Journal &amp; AI Performance Analytics</h1>
      <p>JAHZJOURNALS is the institutional-grade trading journal built for serious currency, commodities, and prop firm traders. Connect multiple accounts in USD, NGN, GBP, and EUR, calculate position sizes with zero math errors, and build bulletproof execution discipline.</p>
      <h2>Core Platform Highlights</h2>
      <ul>
        <li><strong>Multi-Currency Trading Accounts:</strong> Native support for USD, NGN, GBP, EUR, and 12 other currencies.</li>
        <li><strong>Prop Firm Drawdown Guards:</strong> Real-time alerts for FTMO, FundedNext, and custom challenge evaluations.</li>
        <li><strong>AI Performance Coach:</strong> Actionable weekly reviews identifying your hidden statistical edge.</li>
        <li><strong>Position Size &amp; Risk Calculator:</strong> Exact pip and lot sizing with spread and commission accounting.</li>
      </ul>
      <p>Start with our <a href="/risk-calculator">Free Forex &amp; Gold Position Size Calculator</a> or read our in-depth trading guides on <a href="/blog">the JAHZJOURNALS Trading Blog</a>.</p>
    `
  },
  '/features': {
    title: 'Trading Journal Features — Analytics, AI Review & Drawdown Guards | JAHZJOURNALS',
    description: 'Explore JAHZJOURNALS features: automated MT4/MT5 trade sync, multi-currency P&L, trading psychology tracking, and prop firm risk management.',
    body: `
      <h1>Features Designed for Consistently Profitable Forex Traders</h1>
      <p>Every feature in JAHZJOURNALS is engineered to solve a real friction point in a trader's workflow—from calculating lot sizes across different account currencies to identifying post-loss revenge trading patterns.</p>
      <h2>What Makes JAHZJOURNALS Different</h2>
      <ul>
        <li><strong>Automated &amp; Manual Hybrid Logging:</strong> Import executions via MT4/MT5 cloud sync or log setups manually with multi-timeframe chart screenshots.</li>
        <li><strong>Psychology &amp; Discipline Scoring:</strong> Track FOMO, greed, fear, and rule adherence on every trade.</li>
        <li><strong>Dynamic Edge Detection:</strong> Breakdown win rate, profit factor, and expectancy by pair, session, setup, and hold time.</li>
      </ul>
    `
  },
  '/risk-calculator': {
    title: 'Free Forex & Gold Position Size Calculator | JAHZJOURNALS',
    description: 'Calculate exact lot size, monetary risk, pip value, and margin across 15 account currencies (USD, NGN, GBP, EUR) for Forex, Gold (XAUUSD), and Indices.',
    body: `
      <h1>Professional Forex, Gold &amp; Indices Position Size Calculator</h1>
      <p>Never guess your lot size again. The JAHZJOURNALS Position Size Calculator computes exact lot sizes, monetary risk, pip values, and required margin across standard, mini, and micro lots—accounting for broker spreads, slippage buffers, and commission costs.</p>
      <h2>Supported Instruments</h2>
      <p>Calculate lot sizes for all major Forex currency pairs (EUR/USD, GBP/USD, USD/JPY, AUD/USD), cross pairs, Spot Gold (XAU/USD), Silver (XAG/USD), and major stock indices (US30, NAS100, SPX500, GER40).</p>
      <h2>Why Position Sizing Matters</h2>
      <p>Risking a fixed percentage (such as 0.5% or 1%) per trade ensures that normal statistical losing streaks cannot trigger severe account drawdowns or breach prop firm challenge limits.</p>
    `
  },
  '/prop-firm-traders': {
    title: 'Prop Firm Challenge Tracker & Drawdown Monitor | JAHZJOURNALS',
    description: 'Pass your FTMO, FundedNext, and prop firm evaluations with real-time daily drawdown tracking, profit target calculators, and rule violation guards.',
    body: `
      <h1>Prop Firm Evaluation Management &amp; Drawdown Protection</h1>
      <p>Over 90% of prop firm challenges fail due to daily drawdown rule breaches. JAHZJOURNALS gives funded and evaluation traders an objective dashboard that monitors high-water mark equity, daily loss limits, and remaining profit targets in real time.</p>
      <h2>Supported Prop Firm Evaluation Frameworks</h2>
      <ul>
        <li><strong>FTMO &amp; Standard 2-Step Rules:</strong> 5% daily drawdown, 10% maximum drawdown, and 8%/5% profit milestones.</li>
        <li><strong>1-Step &amp; Trailing Drawdown Challenges:</strong> Dynamic trailing drawdown calculation based on closed and floating equity.</li>
        <li><strong>Multi-Account Portfolio Monitoring:</strong> Track multiple evaluations simultaneously without confusing credentials or rules.</li>
      </ul>
    `
  },
  '/trading-psychology': {
    title: 'Forex Trading Psychology & Emotional Discipline Journal | JAHZJOURNALS',
    description: 'Eliminate FOMO, revenge trading, and emotional tilt. Log emotional states, track rule compliance, and build mental fortitude in financial markets.',
    body: `
      <h1>Trading Psychology &amp; Behavioral Performance Tracking</h1>
      <p>Technical analysis gives you a map, but psychology controls the steering wheel. JAHZJOURNALS is the first trading journal designed from the ground up to quantify emotional states and calculate your personal Discipline Score.</p>
      <h2>Stop Emotional Capital Leaks</h2>
      <ul>
        <li><strong>Pre-Trade Emotional Audit:</strong> Categorize your mental state as Confident, Hesitant, FOMO, or Impatient before placing an order.</li>
        <li><strong>Rule Violation Dollar Cost:</strong> Measure exactly how much capital was lost to impulsive mistakes versus normal strategy losses.</li>
        <li><strong>Daily Mindset Reviews:</strong> End each trading day with a structured reflection routine to clear your head for tomorrow.</li>
      </ul>
    `
  },
  '/risk-management': {
    title: 'Forex Risk Management Framework & Capital Preservation | JAHZJOURNALS',
    description: 'Learn institutional risk management principles: fixed fractional sizing, asymmetric risk-to-reward ratios, portfolio heat, and drawdown circuits.',
    body: `
      <h1>Institutional Risk Management Architecture for Retail Traders</h1>
      <p>In financial trading, return on capital is secondary to return of capital. JAHZJOURNALS provides mathematical guardrails that protect your balance from tail-risk events, broker slippage, and consecutive losing streaks.</p>
      <h2>Core Risk Pillars</h2>
      <ul>
        <li><strong>Fixed Fractional Sizing:</strong> Keep risk uniform regardless of stop loss distance.</li>
        <li><strong>Asymmetric Risk:Reward Ratio:</strong> Aim for 1:2 and 1:3 minimums so high win rates are not required to generate consistent growth.</li>
        <li><strong>Hard Circuit Breakers:</strong> Cease trading automatically once daily loss limits are reached.</li>
      </ul>
    `
  },
  '/mentors': {
    title: 'Forex Mentor Portal & Trading Academy Cohort Management | JAHZJOURNALS',
    description: 'Run your Forex trading academy or mentorship cohort on JAHZJOURNALS. Review student trade logs, grade daily reviews, and verify student performance.',
    body: `
      <h1>The Complete Coaching &amp; Cohort Management Platform for Forex Mentors</h1>
      <p>Stop reviewing blurry screenshots in Telegram or Discord chats. The JAHZJOURNALS Mentor Portal lets trading educators organize student cohorts, inspect real student trade journals, leave structured feedback on executions, and monitor student consistency in one dashboard.</p>
      <h2>Key Capabilities for Trading Academies</h2>
      <ul>
        <li><strong>Cohort Invite Links &amp; Student Roster:</strong> Onboard students into structured mentorship cohorts with one click.</li>
        <li><strong>Direct Trade &amp; Daily Review Feedback:</strong> Inspect student entry/exit prices, stop loss placement, chart screenshots, and emotional notes.</li>
        <li><strong>Student Leaderboard &amp; Risk Compliance:</strong> Spot struggling students early when their drawdown or rule violations spike.</li>
      </ul>
    `
  },
  '/pricing': {
    title: 'Pricing Plans — Free & Pro Forex Trading Journal Subscriptions | JAHZJOURNALS',
    description: 'Compare JAHZJOURNALS Free, Pro, and Academy plans. Flexible USD and NGN billing for retail traders, prop firm traders, and mentors.',
    body: `
      <h1>Transparent Pricing for Every Stage of Your Trading Journey</h1>
      <p>Start journaling for free with core trade logging and our public Position Size Calculator, or upgrade to Pro for unlimited trading accounts, automated MT4/MT5 synchronization, Prop Firm challenge tracking, and AI performance coaching.</p>
      <ul>
        <li><strong>Starter (Free Plan):</strong> Core trade logging, basic performance dashboard, position size calculator, and educational resources.</li>
        <li><strong>Pro Trader Plan:</strong> Unlimited multi-currency accounts (USD, NGN, GBP, EUR), Prop Firm evaluation tracker, full analytics suite, AI Trading Coach, and PDF performance exports.</li>
      </ul>
    `
  },
  '/about': {
    title: 'About JAHZJOURNALS — Our Mission to Build Disciplined, Data-Driven Traders',
    description: 'Learn about JAHZJOURNALS, founded to equip Forex, Gold, and Prop Firm traders globally with institutional-grade journaling, multi-currency analytics, and risk tools.',
    body: `
      <h1>About JAHZJOURNALS</h1>
      <p>JAHZJOURNALS was built by active Forex and Prop Firm traders who experienced firsthand how difficult it was to track multi-currency accounts (USD, NGN, GBP, EUR), prop firm drawdown rules, and trading psychology in traditional spreadsheets.</p>
      <h2>Our Mission</h2>
      <p>Our mission is to democratize institutional-grade performance analytics and risk management tools so independent traders worldwide can replace emotional gambling with measurable, repeatable execution.</p>
      <h2>What Sets Us Apart</h2>
      <ul>
        <li>Native support for global and African traders using USD, NGN, GBP, and EUR accounts.</li>
        <li>Purpose-built Prop Firm drawdown and phase progression tracking.</li>
        <li>Free educational guides and position sizing tools accessible to the entire trading community.</li>
      </ul>
    `
  },
  '/contact': {
    title: 'Contact Us & Trader Support | JAHZJOURNALS',
    description: 'Get in touch with the JAHZJOURNALS support team for account assistance, billing inquiries, mentorship partnerships, or feature requests.',
    body: `
      <h1>Contact JAHZJOURNALS Support</h1>
      <p>Have a question about your trading journal, automated MT4/MT5 synchronization, Prop Firm account setup, or academy partnership? Our team is ready to help.</p>
      <ul>
        <li><strong>Support Email:</strong> support@jahzjournal.com</li>
        <li><strong>Response Time:</strong> Within 24 business hours (Monday – Friday)</li>
      </ul>
    `
  },
  '/terms': {
    title: 'Terms of Service | JAHZJOURNALS',
    description: 'Read the JAHZJOURNALS Terms of Service governing account usage, subscriptions, intellectual property, and financial disclaimers.',
    body: `
      <h1>Terms of Service</h1>
      <p>Welcome to JAHZJOURNALS. By accessing or using https://jahzjournal.com and our trading journal software, calculators, and educational content, you agree to be bound by these Terms of Service.</p>
      <h2>1. Educational &amp; Analytical Purpose Only</h2>
      <p>JAHZJOURNALS provides trade journaling, statistical analytics, and risk calculation software. We are not a broker, financial advisor, or investment manager, and nothing on this platform constitutes financial or investment advice.</p>
      <h2>2. User Accounts &amp; Data Integrity</h2>
      <p>Users are responsible for maintaining the confidentiality of their login credentials and for the accuracy of the trade data they log or synchronize.</p>
    `
  },
  '/privacy': {
    title: 'Privacy Policy & Data Protection | JAHZJOURNALS',
    description: 'Learn how JAHZJOURNALS collects, protects, and processes your personal data, cookies, and Google AdSense advertising preferences under GDPR and CCPA.',
    body: `
      <h1>Privacy Policy</h1>
      <p>At JAHZJOURNALS, we take the privacy and security of your trading data and personal information seriously. This Privacy Policy explains how we collect, use, store, and safeguard your information when you visit https://jahzjournal.com.</p>
      <h2>1. Information We Collect</h2>
      <p>We collect account registration details (name, email address), user-submitted trading logs and analytics data, and standard technical telemetry (browser type, IP address, and cookie consent preferences).</p>
      <h2>2. Advertising &amp; Google AdSense Cookies</h2>
      <p>We display advertisements on public informational pages via Google AdSense (Publisher ID: pub-6725573719511845). Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites. Users in the EEA, UK, and Switzerland can manage their consent via our Google Consent Mode v2 banner, or opt out of personalized advertising at <a href="https://www.google.com/settings/ads">Google Ads Settings</a>.</p>
    `
  },
  '/disclaimer': {
    title: 'Financial & Risk Disclaimer | JAHZJOURNALS',
    description: 'Important risk disclosure regarding foreign exchange (Forex), CFDs, commodities, and proprietary trading evaluations on JAHZJOURNALS.',
    body: `
      <h1>Financial &amp; Risk Disclaimer</h1>
      <p>Trading foreign exchange (Forex), contracts for difference (CFDs), precious metals (Gold/XAUUSD), indices, and cryptocurrencies on margin carries a high level of risk and may not be suitable for all investors. High leverage can work against you as well as for you.</p>
      <p>Before deciding to trade any financial instrument or participate in a proprietary trading firm evaluation, you should carefully consider your investment objectives, level of experience, and risk appetite. Past performance documented in any trading journal or educational article is not indicative of future results.</p>
    `
  },
  '/cookies': {
    title: 'Cookie Policy | JAHZJOURNALS',
    description: 'Understand how JAHZJOURNALS uses essential authentication cookies, analytics cookies, and Google AdSense advertising cookies.',
    body: `
      <h1>Cookie Policy</h1>
      <p>This Cookie Policy explains how JAHZJOURNALS uses cookies and similar storage technologies on https://jahzjournal.com to provide secure authentication, remember theme preferences, and support compliant advertising on public pages.</p>
    `
  }
};

async function buildSeoHtml(indexHtmlTemplate, reqPath) {
  const cleanPath = reqPath === '/' ? '/' : reqPath.replace(/\/+$/, '');
  const posts = await getBlogPosts();
  let isNotFound = false;

  let pageTitle = 'JAHZJOURNALS — Forex Trading Journal & Analytics Platform';
  let pageDescription = 'Log trades, calculate position sizes, track emotions, analyze performance, and discover your trading edge with JAHZJOURNALS.';
  let canonicalUrl = `https://jahzjournal.com${cleanPath === '/' ? '/' : cleanPath}`;
  let ogType = 'website';
  let mainContentHtml = '';
  let jsonLd = null;

  if (cleanPath === '/blog') {
    pageTitle = 'Forex Trading Blog, Risk Management & Prop Firm Guides | JAHZJOURNALS';
    pageDescription = 'In-depth educational articles on Forex trade journaling, lot size calculation, Gold (XAUUSD) trading, prop firm drawdown rules, and trading psychology.';
    const articlesListHtml = posts.map((post) => `
      <article style="margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid #1e293b;">
        <h2><a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h2>
        <p><strong>Category:</strong> ${escapeHtml(post.category)} | <strong>Read Time:</strong> ${escapeHtml(post.readTime)} | <strong>Published:</strong> ${escapeHtml(post.publishedAt)}</p>
        <p>${escapeHtml(post.summary || post.excerpt)}</p>
        <p><a href="/blog/${escapeHtml(post.slug)}">Read Full Guide &rarr;</a></p>
      </article>
    `).join('\n');

    mainContentHtml = `
      <h1>JAHZJOURNALS Forex Trading Education &amp; Research Library</h1>
      <p>Explore our comprehensive library of institutional trading guides covering Forex position sizing, Gold (XAUUSD) contract math, Prop Firm challenge management, ICT/Smart Money journaling, and behavioral psychology.</p>
      <div>${articlesListHtml}</div>
    `;

    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      publisher: {
        '@type': 'Organization',
        name: 'JAHZJOURNALS',
        url: 'https://jahzjournal.com',
      },
    };
  } else if (cleanPath.startsWith('/blog/')) {
    const slug = cleanPath.replace('/blog/', '');
    const post = posts.find((p) => p.slug === slug);
    if (post) {
      pageTitle = `${post.title} | JAHZJOURNALS`;
      pageDescription = post.summary || post.excerpt || pageDescription;
      ogType = 'article';
      const articleBody = String(post.content || '').replace(/className=/g, 'class=');
      const relatedLinks = posts
        .filter((p) => p.slug !== post.slug)
        .slice(0, 5)
        .map((p) => `<li><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></li>`)
        .join('');

      mainContentHtml = `
        <article>
          <header>
            <p><a href="/blog">&larr; Back to Trading Blog</a> | <span>${escapeHtml(post.category)}</span> | <span>${escapeHtml(post.readTime)}</span></p>
            <h1>${escapeHtml(post.title)}</h1>
            <p>By <strong>${escapeHtml(post.author?.name || 'Jahsmine Aninta')}</strong> (${escapeHtml(post.author?.title || 'Founder, JAHZJOURNALS')}) &bull; Published <time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(post.publishedAt)}</time></p>
          </header>
          <div>${articleBody}</div>
          <hr />
          <section>
            <h2>Related Forex Trading Guides</h2>
            <ul>${relatedLinks}</ul>
          </section>
        </article>
      `;

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: pageDescription,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        author: {
          '@type': 'Person',
          name: post.author?.name || 'Jahsmine Aninta',
          jobTitle: post.author?.title || 'Founder, JAHZJOURNALS',
        },
        publisher: {
          '@type': 'Organization',
          name: 'JAHZJOURNALS',
          url: 'https://jahzjournal.com',
          logo: {
            '@type': 'ImageObject',
            url: 'https://jahzjournal.com/logo-mark.png'
          }
        },
        mainEntityOfPage: canonicalUrl,
        articleSection: post.category || 'Trading Education',
        keywords: post.keywords || 'Forex Trading, Risk Management, Trading Journal',
      };
    } else {
      // 404 for unknown article slug
      isNotFound = true;
      pageTitle = 'Trading Guide Not Found | JAHZJOURNALS';
      pageDescription = 'The requested forex trading guide could not be found. Browse our complete library of trading guides and tutorials.';
      mainContentHtml = `
        <article style="text-align:center;padding:3rem 1rem;">
          <h1>Trading Guide Not Found</h1>
          <p>The article you are looking for does not exist or may have been updated.</p>
          <p style="margin-top:2rem;">
            <a href="/blog" style="color:#10b981;font-weight:bold;text-decoration:none;">&larr; Browse All Trading Guides</a>
          </p>
        </article>
      `;
    }
  } else if (STATIC_ROUTES[cleanPath]) {
    const routeMeta = STATIC_ROUTES[cleanPath];
    pageTitle = routeMeta.title;
    pageDescription = routeMeta.description;
    mainContentHtml = routeMeta.body;
  }

  if (!mainContentHtml) {
    mainContentHtml = STATIC_ROUTES['/'].body;
  }

  if (!jsonLd) {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      publisher: {
        '@type': 'Organization',
        name: 'JAHZJOURNALS',
        url: 'https://jahzjournal.com',
      },
    };
  }

  const headTags = `
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="JAHZJOURNALS" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `;

  let html = indexHtmlTemplate
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(pageDescription)}" />`
    )
    .replace('</head>', `${headTags}\n  </head>`);

  const prerenderedRoot = `<div id="root">${NAV_HTML}<main style="max-width:960px;margin:0 auto;padding:2rem 1rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">${mainContentHtml}</main>${FOOTER_HTML}</div>`;

  html = html.replace('<div id="root"></div>', prerenderedRoot);
  return { html, isNotFound };
}

module.exports = { buildSeoHtml, getBlogPosts, invalidateBlogCache };
