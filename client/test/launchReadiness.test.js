import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrc = path.join(__dirname, '..', 'src');

test('1. Homepage has no placeholder testimonials or early feedback section', () => {
  const homeContent = fs.readFileSync(path.join(clientSrc, 'pages', 'Home.jsx'), 'utf8');
  assert.equal(homeContent.includes('Early feedback'), false, 'Early feedback section should not exist');
  assert.equal(homeContent.includes('Academy founder placeholder'), false, 'Academy founder placeholder should not exist');
  assert.equal(homeContent.includes('XAUUSD trader placeholder'), false, 'XAUUSD trader placeholder should not exist');
  assert.equal(homeContent.includes('Funded account placeholder'), false, 'Funded account placeholder should not exist');
});

test('2. Homepage pricing buttons are active links to correct registration paths', () => {
  const homeContent = fs.readFileSync(path.join(clientSrc, 'pages', 'Home.jsx'), 'utf8');
  assert.ok(homeContent.includes("to: '/register'"), 'Free plan routes to /register');
  assert.ok(homeContent.includes("to: '/register?plan=starter'"), 'Starter plan routes to /register?plan=starter');
  assert.ok(homeContent.includes("to: '/register?plan=pro'"), 'Pro plan routes to /register?plan=pro');
  assert.ok(homeContent.includes("cta: 'Start Free'"), 'Free CTA label is Start Free');
  assert.ok(homeContent.includes("cta: 'Choose Starter'"), 'Starter CTA label is Choose Starter');
  assert.ok(homeContent.includes("cta: 'Choose Pro'"), 'Pro CTA label is Choose Pro');
});

test('3. Pricing structured data accurately reflects live NGN plans without stale claims', async () => {
  const schemasContent = fs.readFileSync(path.join(clientSrc, 'seo', 'schemas.js'), 'utf8');
  const pagesContent = fs.readFileSync(path.join(clientSrc, 'seo', 'pages.js'), 'utf8');
  const pricingContent = fs.readFileSync(path.join(clientSrc, 'pages', 'Pricing.jsx'), 'utf8');

  // Verify no stale $19 or $49 claims
  assert.equal(schemasContent.includes('19.00'), false, 'No 19.00 price in schemas');
  assert.equal(schemasContent.includes('49.00'), false, 'No 49.00 price in schemas');
  assert.equal(pagesContent.includes('Founding Trader'), false, 'No Founding Trader in SEO metadata');
  assert.equal(schemasContent.includes('Founding Trader'), false, 'No Founding Trader in schemas');

  // Verify live NGN values
  assert.ok(pricingContent.includes("priceCurrency: 'NGN'"), 'Pricing.jsx uses NGN');
  assert.ok(pricingContent.includes("price: '4000'"), 'Pricing.jsx has 4000 for Starter');
  assert.ok(pricingContent.includes("price: '8500'"), 'Pricing.jsx has 8500 for Pro');
  assert.ok(schemasContent.includes("priceCurrency: 'NGN'"), 'schemas.js uses NGN');
  assert.ok(schemasContent.includes("highPrice: '8500'"), 'schemas.js high price is 8500');

  // Verify plan limits
  assert.ok(pricingContent.includes('20 trades/month; 1 trading account; 1 screenshot/trade'));
  assert.ok(pricingContent.includes('100 trades/month; 3 accounts; 3 screenshots/trade'));
  assert.ok(pricingContent.includes('unlimited trades/accounts; 10 screenshots/trade'));
});

test('4. Registration page includes reassurance points and sequence', () => {
  const registerContent = fs.readFileSync(path.join(clientSrc, 'pages', 'Register.jsx'), 'utf8');

  // Exact reassurance points
  assert.ok(registerContent.includes('Free forever · no card required'));
  assert.ok(registerContent.includes('Log up to 20 trades/month'));
  assert.ok(registerContent.includes('Takes about 2 minutes'));

  // What happens next sequence
  assert.ok(registerContent.includes('What happens next'));
  assert.ok(registerContent.includes('Create your account'));
  assert.ok(registerContent.includes('Log your first trade'));
  assert.ok(registerContent.includes('Get your first review'));
});

test('5. Footer renders valid configured social links and omits unconfigured ones', () => {
  const footerContent = fs.readFileSync(path.join(clientSrc, 'components', 'Footer.jsx'), 'utf8');
  
  // Make sure static non-clickable network spans are replaced
  assert.equal(footerContent.includes('<span>Instagram</span>'), false, 'Static Instagram span is removed');
  assert.equal(footerContent.includes('<span>Twitter/X</span>'), false, 'Static Twitter/X span is removed');
  assert.equal(footerContent.includes('<span>LinkedIn</span>'), false, 'Static LinkedIn span is removed');

  // Make sure Twitter/X and LinkedIn are generated as links and unconfigured (Instagram) is filtered out
  assert.ok(footerContent.includes('validSocialLinks'), 'Filters for valid social links');
  assert.ok(footerContent.includes('href={item.url}'), 'Renders active <a> tags');
});

test('6. Economic calendar data disclosure communicates sources, refresh, and disclaimers', () => {
  const disclosureContent = fs.readFileSync(path.join(clientSrc, 'components', 'calendar', 'CalendarDataDisclosure.jsx'), 'utf8');
  const configContent = fs.readFileSync(path.join(clientSrc, 'config', 'calendarConfig.js'), 'utf8');
  const calendarPageContent = fs.readFileSync(path.join(clientSrc, 'pages', 'EconomicCalendarPage.jsx'), 'utf8');

  // Verify disclosure is imported and rendered near the top
  assert.ok(calendarPageContent.includes('<CalendarDataDisclosure />'), 'CalendarDataDisclosure is rendered');

  // Verify data sources and policies
  assert.ok(configContent.includes('ForexFactory'), 'ForexFactory source documented');
  assert.ok(configContent.includes('TradingView'), 'TradingView source documented');
  assert.ok(disclosureContent.includes('Data Sources'), 'Data sources displayed');
  assert.ok(disclosureContent.includes('Refresh Policy'), 'Refresh policy displayed');
  assert.ok(disclosureContent.includes('Delays & Revisions'), 'Delays notice displayed');
  assert.ok(configContent.includes('official issuing authority') || disclosureContent.includes('official issuing authority'), 'Official authority verification included');
  assert.ok(disclosureContent.includes('not financial advice') || configContent.includes('not financial'), 'Not financial advice included');
});

test('7. Calendar acquisition positioning copy connects calendar to disciplined journaling', () => {
  const homeContent = fs.readFileSync(path.join(clientSrc, 'pages', 'Home.jsx'), 'utf8');
  const calendarContent = fs.readFileSync(path.join(clientSrc, 'pages', 'EconomicCalendarPage.jsx'), 'utf8');

  // Check required copy on homepage
  assert.ok(homeContent.includes('Plan XAUUSD trades around high-impact USD events'));
  assert.ok(homeContent.includes('Avoid revenge trading around CPI and NFP volatility'));
  assert.ok(homeContent.includes('Review whether trade entries occurred during news volatility'));

  // Check required copy on calendar page
  assert.ok(calendarContent.includes('Plan XAUUSD trades around high-impact USD events'));
  assert.ok(calendarContent.includes('Avoid revenge trading around CPI and NFP volatility'));
  assert.ok(calendarContent.includes('Review whether trade entries occurred during news volatility'));
});

test('8. Homepage FAQ items match required 7 questions, order, copy, accessibility, and JSON-LD schema', async () => {
  const homeContent = fs.readFileSync(path.join(clientSrc, 'pages', 'Home.jsx'), 'utf8');
  const pagesContent = fs.readFileSync(path.join(clientSrc, 'seo', 'pages.js'), 'utf8');
  const faqItemContent = fs.readFileSync(path.join(clientSrc, 'components', 'FAQItem.jsx'), 'utf8');

  const expectedFaqs = [
    {
      q: 'What is JAHZJOURNALS?',
      a: 'JAHZJOURNALS is a trading journal and analytics platform that helps you log trades, review screenshots, track discipline, and identify recurring mistakes in your execution.',
    },
    {
      q: 'Is JAHZJOURNALS a signal service or financial adviser?',
      a: 'No. JAHZJOURNALS does not provide trade signals, tell you what to trade, predict markets, or guarantee outcomes. It helps you review your own execution with structure.',
    },
    {
      q: 'Can I start free without a card?',
      a: 'Yes. The Free plan is free forever and does not require a credit or debit card. You can log up to 20 trades per month, use one trading account, and upload one screenshot per trade.',
    },
    {
      q: 'Can I upload chart screenshots?',
      a: 'Yes. JAHZJOURNALS is built for screenshot-based trade review. Your screenshot limit depends on your plan: Free includes 1 screenshot per trade, Starter includes 3, and Pro includes 10.',
    },
    {
      q: 'Can it help with prop-firm evaluations?',
      a: 'Yes. You can track drawdown limits, profit-target progress, trading days, and rule discipline while preparing for prop-firm evaluations. JAHZJOURNALS cannot guarantee that you will pass.',
    },
    {
      q: 'Does it work on mobile?',
      a: 'Yes. JAHZJOURNALS is mobile-first and works across phones, tablets, and laptops, so you can log and review trades wherever you trade.',
    },
    {
      q: 'How does JAHZ AI work?',
      a: 'JAHZ AI analyses your journal data, submitted screenshots, rules, and trading behaviour to highlight patterns and possible mistakes. It is designed for self-review—not trade signals, market predictions, or financial advice.',
    },
  ];

  // Verify all 7 in exact order in Home.jsx
  let lastIndexHome = 0;
  for (const { q, a } of expectedFaqs) {
    const qIndex = homeContent.indexOf(q, lastIndexHome);
    assert.ok(qIndex > -1, `Question "${q}" should exist in Home.jsx in order`);
    const aIndex = homeContent.indexOf(a, qIndex);
    assert.ok(aIndex > -1, `Answer for "${q}" should exist in Home.jsx`);
    lastIndexHome = aIndex;
  }

  // Verify all 7 in exact order in pages.js schema
  let lastIndexSeo = 0;
  for (const { q, a } of expectedFaqs) {
    const qIndex = pagesContent.indexOf(q, lastIndexSeo);
    assert.ok(qIndex > -1, `Question "${q}" should exist in pages.js schema in order`);
    const aIndex = pagesContent.indexOf(a, qIndex);
    assert.ok(aIndex > -1, `Answer for "${q}" should exist in pages.js schema`);
    lastIndexSeo = aIndex;
  }

  // Verify old questions are removed
  assert.equal(homeContent.includes('Does it guarantee profit?'), false, 'Old question removed');
  assert.equal(homeContent.includes('Is it good for prop firm traders?'), false, 'Old question removed');
  assert.equal(homeContent.includes('Will AI features be added?'), false, 'Old question removed');

  // Verify defaultOpen is only true for the first item
  assert.ok(homeContent.includes('defaultOpen={index === 0}'), 'Only first FAQ item expands by default');

  // Verify FAQItem accessibility semantics
  assert.ok(faqItemContent.includes('aria-expanded={open}'), 'FAQItem button has aria-expanded');
  assert.ok(faqItemContent.includes('aria-controls='), 'FAQItem button has aria-controls');
  assert.ok(faqItemContent.includes('role="region"'), 'FAQItem answer panel has role="region"');
  assert.ok(faqItemContent.includes('aria-labelledby='), 'FAQItem answer panel has aria-labelledby');
  assert.ok(faqItemContent.includes('focus-visible:'), 'FAQItem button has keyboard focus style');
});
