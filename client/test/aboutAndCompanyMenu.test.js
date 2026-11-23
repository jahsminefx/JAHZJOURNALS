import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOUNDER_CONFIG } from '../src/config/founderConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

describe('Company Dropdown & About Page Contracts', () => {
  it('1. Navbar Company dropdown keeps all existing links and shows non-truncated "Our mission and story"', async () => {
    const navbarSrc = await readFile(path.join(clientRoot, 'src/components/Navbar.jsx'), 'utf8');

    // Keep all 3 Company links
    assert.ok(navbarSrc.includes("id: 'company'"));
    assert.ok(navbarSrc.includes("label: 'About'") && navbarSrc.includes("to: '/about'"));
    assert.ok(navbarSrc.includes("label: 'Pricing'") && navbarSrc.includes("to: '/pricing'"));
    assert.ok(navbarSrc.includes("label: 'Contact'") && navbarSrc.includes("to: '/contact'"));

    // Exact new About description without old text
    assert.ok(navbarSrc.includes("description: 'Our mission and story'"));
    assert.equal(navbarSrc.includes('disciplined trader sanctuary'), false);

    // Dropdown item descriptions must wrap without ellipsis truncation
    assert.equal(navbarSrc.includes('line-clamp-1'), false);
    assert.equal(
      navbarSrc.includes('<div className="text-[10px] text-muted truncate mt-0.5">'),
      false
    );
  });

  it('2. About page uses approved hero, section heading, body copy, 5 value cards, and /register CTA', async () => {
    const aboutSrc = await readFile(path.join(clientRoot, 'src/pages/About.jsx'), 'utf8');
    const ctaSrc = await readFile(path.join(clientRoot, 'src/components/CTASection.jsx'), 'utf8');

    // Hero copy & existing asset
    assert.ok(aboutSrc.includes('title="A trading journal for disciplined review."'));
    assert.ok(
      aboutSrc.includes(
        'description="The goal is simple: help traders stop repeating mistakes blindly and start reviewing with structure."'
      )
    );
    assert.ok(aboutSrc.includes('heroImage="/heroes/hero-about.png"'));

    // Section heading & no founder-led claim
    assert.ok(aboutSrc.includes('eyebrow="WHY WE BUILT JAHZJOURNALS"'));
    assert.ok(aboutSrc.includes('title="Serious traders need evidence, not hype."'));
    assert.equal(/founder-led/i.test(aboutSrc), false);

    // Left-column supporting copy, label & 4 review questions
    assert.ok(
      aboutSrc.includes(
        'A trading journal should do more than store results. It should help you see the decisions and habits behind them.'
      )
    );
    assert.ok(aboutSrc.includes('REVIEW WHAT MATTERS'));
    const expectedQuestions = [
      'Which setups are actually working for me?',
      'Where do I break my rules most often?',
      'Did news volatility affect my entry?',
      'What should I improve before next week?',
    ];
    for (const q of expectedQuestions) {
      assert.ok(aboutSrc.includes(`'${q}'`), `Missing review question: ${q}`);
    }

    // Body copy
    assert.ok(
      aboutSrc.includes(
        'Trading decisions are often scattered across broker history, chart screenshots, notes, and memory. JAHZJOURNALS brings them into one review process.'
      )
    );
    assert.ok(
      aboutSrc.includes(
        'Log trades with context, attach screenshots, track rules, risk, and emotions, then use your own data to identify repeated mistakes and stronger habits.'
      )
    );
    assert.ok(
      aboutSrc.includes(
        'It is built for forex, gold, indices, and prop-firm traders who want to review their execution honestly—not rely on hype, signals, or promises.'
      )
    );

    // Exact 5 value cards
    const expectedCards = [
      'Log trades with context',
      'Review screenshots and mistakes',
      'Track rules, risk, and emotions',
      'Measure performance over time',
      'Prepare for prop-firm evaluations',
    ];
    for (const card of expectedCards) {
      assert.ok(aboutSrc.includes(`'${card}'`), `Missing value card: ${card}`);
    }
    assert.equal(aboutSrc.includes('Built for real traders'), false);

    // CTA resolves to /register without environment-specific/localhost URLs
    assert.ok(aboutSrc.includes('cta="Start Free Today"'));
    assert.ok(aboutSrc.includes('to="/register"'));
    assert.equal(/localhost/i.test(aboutSrc), false);
    assert.ok(ctaSrc.includes('!to && user'));

    // No unverified founder/identity content published
    assert.equal(FOUNDER_CONFIG.isPublished, false);
    assert.equal(FOUNDER_CONFIG.bio, null);
    assert.equal(FOUNDER_CONFIG.avatarUrl, null);
  });
});
