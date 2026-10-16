const fs = require('fs');
const path = require('path');

let cachedBlogPosts = null;

function getBlogPosts() {
  if (cachedBlogPosts) return cachedBlogPosts;
  try {
    const blogPostsPath = path.resolve(__dirname, '../../../client/src/data/blogPosts.js');
    const raw = fs.readFileSync(blogPostsPath, 'utf8');
    const cleaned = raw.replace(/export\s+const\s+BLOG_POSTS\s*=\s*/, 'return ');
    const fn = new Function(cleaned);
    cachedBlogPosts = fn() || [];
  } catch (err) {
    console.error('[SEO Prerender] Failed to load blogPosts.js:', err.message);
    cachedBlogPosts = [];
  }
  return cachedBlogPosts;
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
    description: 'Log Forex, Gold (XAUUSD), and Indices trades, calculate accurate lot sizes, monitor Prop Firm daily and max drawdown rules, and master trading psychology with JAHZJOURNALS.',
    body: `
      <h1>Master Your Forex &amp; Prop Firm Trading Edge with Data-Driven Journaling</h1>
      <p>JAHZJOURNALS is an institutional-grade Forex trading journal, position size calculator, and performance analytics platform engineered for retail traders, Funded Prop Firm traders, and trading academies. Track every trade across USD, NGN, GBP, and EUR accounts with automated MT4/MT5 synchronization, emotion tracking, and AI-assisted performance diagnostics.</p>
      <section>
        <h2>Why Professional Traders Choose JAHZJOURNALS</h2>
        <ul>
          <li><strong>Multi-Currency Account Support:</strong> Log and analyze trades in US Dollar ($), Nigerian Naira (₦), British Pound (£), and Euro (€) without currency conversion distortion.</li>
          <li><strong>Prop Firm Challenge &amp; Drawdown Guardian:</strong> Monitor real-time daily drawdown limits, maximum trailing/static loss thresholds, minimum trading days, and profit targets for FTMO, FundedNext, Maven, and custom challenges.</li>
          <li><strong>Interactive Position Size &amp; Risk Calculator:</strong> Calculate exact standard, mini, and micro lot sizes for 30+ Forex pairs, Gold (XAUUSD), Silver (XAGUSD), US30, NAS100, and BTCUSD before executing a trade.</li>
          <li><strong>Trading Psychology &amp; Behavioral Analytics:</strong> Correlate pre-trade emotions (Calm, Confident, Anxious, FOMO, Revenge, Greedy) with actual win rate, profit factor, and expectancy.</li>
          <li><strong>AI Coach &amp; Edge Finder:</strong> Identify your highest-probability trading sessions (London, New York, Asian, London-NY Overlap), best-performing pairs, and costliest rule violations.</li>
        </ul>
      </section>
      <section>
        <h2>Explore Our Free Trading Tools &amp; Educational Library</h2>
        <p>Start with our <a href="/risk-calculator">Free Forex &amp; Gold Position Size Calculator</a> or read our in-depth trading guides on <a href="/blog">the JAHZJOURNALS Trading Blog</a>.</p>
      </section>
    `
  },
  '/features': {
    title: 'Platform Features — Automated MT4/MT5 Sync, Analytics & AI Coach | JAHZJOURNALS',
    description: 'Explore JAHZJOURNALS features: automated MetaTrader 4 & 5 cloud sync, multi-account equity curves, strategy playbook analytics, daily reviews, and AI trading coach.',
    body: `
      <h1>Complete Feature Suite Built for Serious Forex &amp; Prop Firm Traders</h1>
      <p>Every tool inside JAHZJOURNALS is designed to replace messy spreadsheets with institutional-grade execution tracking, visual trade replay, and quantitative performance metrics.</p>
      <h2>1. Automated MT4/MT5 Sync &amp; Fast Manual Logging</h2>
      <p>Connect your MetaTrader 4 or MetaTrader 5 trading accounts for hands-free trade imports, or log setups manually with custom strategy tags, entry/exit timestamps, pips, commissions, swap fees, and annotated TradingView chart screenshots.</p>
      <h2>2. Deep Quantitative Analytics &amp; Equity Curves</h2>
      <p>Filter your historical performance by individual trading account, currency pair, direction (Buy vs. Sell), market session, day of the week, and strategy playbook. Track Net P/L, Win Rate, Profit Factor, Expectancy per Trade, Average R-Multiple, and Maximum Drawdown.</p>
      <h2>3. Daily &amp; Weekly Structured Trading Reviews</h2>
      <p>Build daily accountability by grading your discipline, documenting market structure observations, and sharing verified performance cards with your trading mentor or community.</p>
      <h2>4. AI Trading Coach &amp; Edge Finder</h2>
      <p>Leverage AI diagnostics to uncover hidden behavioral leaks, revenge trading clusters, and session-specific edges from your own historical trade log.</p>
    `
  },
  '/risk-calculator': {
    title: 'Free Forex, Gold (XAUUSD) & Indices Position Size & Lot Calculator | JAHZJOURNALS',
    description: 'Calculate exact standard, mini, and micro lot sizes for Forex pairs, Gold (XAUUSD), Silver, US30, NAS100, and Crypto across USD, NGN, GBP, and EUR accounts.',
    body: `
      <h1>Forex, Gold (XAUUSD) &amp; Indices Position Size &amp; Risk Calculator</h1>
      <p>Use the free JAHZJOURNALS Position Size Calculator to determine the exact lot size required to keep your capital risk strictly aligned with your trading plan across USD ($), NGN (₦), GBP (£), and EUR (€) trading accounts.</p>
      <h2>How to Calculate Position Size in Forex, Gold &amp; Indices</h2>
      <p>Consistent profitability begins with mathematical position sizing. Whether you have a 10-pip stop loss on EUR/USD or a 45-pip stop loss on Gold (XAU/USD), risking a fixed percentage of equity (0.5% to 1.0% per trade) protects your account from catastrophic drawdown.</p>
      <h3>The Universal Lot Size Formula</h3>
      <p><code>Position Size (Lots) = Account Risk Amount ($) / (Stop Loss Distance in Pips × Pip Value per Standard Lot)</code></p>
      <h3>Contract Specifications by Asset Class</h3>
      <ul>
        <li><strong>Major &amp; Minor Forex Pairs (EURUSD, GBPUSD, AUDUSD):</strong> 1 Standard Lot = 100,000 units (~$10 per pip). 0.10 Mini Lot = ~$1 per pip. 0.01 Micro Lot = ~$0.10 per pip.</li>
        <li><strong>Gold (XAUUSD):</strong> 1 Standard Lot = 100 troy ounces. A $1.00 price move (10 pips) equals $100 per standard lot ($10 per pip).</li>
        <li><strong>US Indices (US30, NAS100, SPX500):</strong> Contract sizes vary between 1 and 10 contracts per lot depending on broker specifications. Always verify contract size before execution.</li>
      </ul>
      <h3>Prop Firm Drawdown Protection Rules</h3>
      <p>Most prop firms enforce a 4% to 5% maximum daily loss limit and an 8% to 10% maximum overall drawdown. Keeping per-trade risk between 0.25% and 0.75% ensures a normal losing streak never breaches your funded evaluation rules.</p>
    `
  },
  '/prop-firm-traders': {
    title: 'Prop Firm Challenge Tracker & Drawdown Monitor (FTMO, FundedNext, Maven) | JAHZJOURNALS',
    description: 'Track Phase 1, Phase 2, and Funded Prop Firm accounts. Monitor daily loss limits, maximum trailing or static drawdown, profit targets, and minimum trading days.',
    body: `
      <h1>Pass &amp; Protect Your Prop Firm Challenges with Real-Time Drawdown Tracking</h1>
      <p>Over 88% of prop firm challenge failures happen not because the trader lacks a winning setup, but because of accidental daily drawdown breaches or over-leveraging near the profit target. JAHZJOURNALS gives you a dedicated Prop Firm Command Center.</p>
      <h2>Supported Prop Firm Rules &amp; Evaluation Structures</h2>
      <ul>
        <li><strong>1-Step, 2-Step &amp; Instant Funding Tracking:</strong> Seamlessly progress accounts from Phase 1 Evaluation to Phase 2 Verification and Live Funded status while preserving full historical trade logs.</li>
        <li><strong>Daily Loss Limit Alerts:</strong> Monitor how close your realized and floating losses are to your firm's daily breach threshold.</li>
        <li><strong>Maximum Static &amp; Trailing Drawdown Visualization:</strong> Track your equity high-water mark and remaining drawdown buffer on every trade.</li>
        <li><strong>Consistency Rule &amp; Minimum Trading Days:</strong> Ensure your profit distribution complies with funded payout requirements.</li>
      </ul>
    `
  },
  '/trading-psychology': {
    title: 'Trading Psychology Analytics — Overcome FOMO, Revenge Trading & Tilt | JAHZJOURNALS',
    description: 'Quantify how your emotions impact your P/L. Track pre-trade and post-trade emotional states, rule adherence scores, and behavioral patterns with JAHZJOURNALS.',
    body: `
      <h1>Quantify Your Trading Psychology &amp; Eliminate Emotional Account Blowups</h1>
      <p>A profitable technical strategy cannot save an undisciplined mindset. JAHZJOURNALS turns subjective trading emotions into objective financial metrics so you can see the exact dollar cost of FOMO, impatience, and revenge trading.</p>
      <h2>How Behavioral Tagging Transforms Your Results</h2>
      <ul>
        <li><strong>Pre-Trade Emotional State Logging:</strong> Tag whether you entered a trade feeling Calm, Focused, Anxious, FOMO, Bored, or Revenge-driven.</li>
        <li><strong>Plan Adherence Scoring:</strong> Track what percentage of your trades followed 100% of your pre-trade checklist versus impulsive off-plan entries.</li>
        <li><strong>Tilt &amp; Overtrading Detection:</strong> Identify whether consecutive losses trigger oversized lot sizes or rapid-fire revenge trades within the same session.</li>
      </ul>
    `
  },
  '/risk-management': {
    title: 'Forex Risk Management System — Position Sizing, R-Multiples & Drawdown Control | JAHZJOURNALS',
    description: 'Master institutional risk management in Forex, Gold, and Indices. Track R-multiples, risk-to-reward ratios, expectancy, and drawdown recovery mathematics.',
    body: `
      <h1>Institutional Risk Management Tools for Retail &amp; Funded Traders</h1>
      <p>Professional traders do not think in raw dollar profits—they think in Risk Multiples (R-Multiples), mathematical expectancy, and asymmetric risk-to-reward profiles.</p>
      <h2>Core Risk Management Pillars in JAHZJOURNALS</h2>
      <ul>
        <li><strong>Asymmetric R:R Tracking:</strong> Measure planned vs. realized Risk-to-Reward ratios across every strategy in your playbook.</li>
        <li><strong>Drawdown Recovery Mathematics:</strong> A 10% loss requires an 11.1% gain to recover, while a 50% loss requires a 100% gain. JAHZJOURNALS alerts you when risk per trade creeps above your threshold.</li>
        <li><strong>Integrated Position Size Calculator:</strong> Calculate exact lot sizes for USD, NGN, GBP, and EUR accounts before placing an order.</li>
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

function buildSeoHtml(indexHtmlTemplate, reqPath) {
  const cleanPath = reqPath === '/' ? '/' : reqPath.replace(/\/+$/, '');
  const posts = getBlogPosts();

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
        dateModified: post.publishedAt,
        author: {
          '@type': 'Person',
          name: post.author?.name || 'Jahsmine Aninta',
        },
        publisher: {
          '@type': 'Organization',
          name: 'JAHZJOURNALS',
          url: 'https://jahzjournal.com',
        },
        mainEntityOfPage: canonicalUrl,
      };
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
  return html;
}

module.exports = { buildSeoHtml };
