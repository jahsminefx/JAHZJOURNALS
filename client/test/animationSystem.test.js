import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('MotionSystem exports all unified animation primitives and respects reduced motion', async () => {
  const source = await read('../src/components/motion/MotionSystem.jsx');

  const expectedExports = [
    'useReducedMotion',
    'FadeIn',
    'Reveal',
    'StaggerContainer',
    'StaggerItem',
    'AnimatedSection',
    'MotionCard',
    'FloatingVisual',
    'CountUpNumber',
  ];

  for (const symbol of expectedExports) {
    assert.match(source, new RegExp(`export const ${symbol}`), `MotionSystem should export ${symbol}`);
  }

  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /aria-label=\{rawValue\}/);
  assert.match(source, /translate3d/);
});

test('index.css defines GPU-accelerated keyframes, pointer-scoped card hover, and reduced-motion overrides', async () => {
  const css = await read('../src/index.css');

  assert.match(css, /@keyframes heroKenBurns/);
  assert.match(css, /@keyframes heroKenBurnsMobile/);
  assert.match(css, /@keyframes subtleFloat/);
  assert.match(css, /@keyframes navDropdownEnter/);
  assert.match(css, /@keyframes navBackdropEnter/);
  assert.match(css, /@keyframes navDrawerEnter/);
  assert.match(css, /@keyframes faqAnswerEnter/);
  assert.match(css, /\.hero-ken-burns/);
  assert.match(css, /\.motion-float-subtle/);
  assert.match(css, /\.motion-card-hover/);
  assert.match(css, /\.motion-card-glow/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('shared public components integrate motion enhancements without breaking accessibility', async () => {
  const [
    pageHeader,
    sectionHeader,
    button,
    featureCard,
    pricingCard,
    testimonialCard,
    faqItem,
    statCard,
    dashboardMockup,
    propFirmMockup,
    mentorMockup,
    ctaSection,
    navbar,
    footer,
  ] = await Promise.all([
    read('../src/components/PageHeader.jsx'),
    read('../src/components/SectionHeader.jsx'),
    read('../src/components/Button.jsx'),
    read('../src/components/FeatureCard.jsx'),
    read('../src/components/PricingCard.jsx'),
    read('../src/components/TestimonialCard.jsx'),
    read('../src/components/FAQItem.jsx'),
    read('../src/components/StatCard.jsx'),
    read('../src/components/DashboardMockup.jsx'),
    read('../src/components/PropFirmMockup.jsx'),
    read('../src/components/MentorMockup.jsx'),
    read('../src/components/CTASection.jsx'),
    read('../src/components/Navbar.jsx'),
    read('../src/components/Footer.jsx'),
  ]);

  assert.match(pageHeader, /hero-ken-burns/);
  assert.match(pageHeader, /FadeIn/);
  assert.match(sectionHeader, /Reveal/);
  assert.match(button, /motion-reduce:transform-none/);
  assert.match(featureCard, /motion-card-hover/);
  assert.match(pricingCard, /motion-card-hover/);
  assert.match(testimonialCard, /motion-card-hover/);
  assert.match(faqItem, /faq-answer-enter/);
  assert.match(statCard, /CountUpNumber/);
  assert.match(dashboardMockup, /FloatingVisual/);
  assert.match(propFirmMockup, /FloatingVisual/);
  assert.match(mentorMockup, /FloatingVisual/);
  assert.match(ctaSection, /Reveal/);
  assert.match(navbar, /nav-dropdown-enter/);
  assert.match(navbar, /nav-backdrop-enter/);
  assert.match(navbar, /nav-drawer-enter/);
  assert.match(footer, /Reveal/);
});

test('all public pages integrate the unified motion system', async () => {
  const pages = [
    '../src/pages/Home.jsx',
    '../src/pages/Features.jsx',
    '../src/pages/Pricing.jsx',
    '../src/pages/MentorPricing.jsx',
    '../src/pages/PropFirmTraders.jsx',
    '../src/pages/Mentors.jsx',
    '../src/pages/About.jsx',
    '../src/pages/Contact.jsx',
    '../src/pages/TradingPsychology.jsx',
    '../src/pages/RiskManagementPage.jsx',
    '../src/pages/BlogList.jsx',
    '../src/pages/BlogPost.jsx',
    '../src/pages/Legal.jsx',
    '../src/pages/RiskCalculator.jsx',
    '../src/pages/EconomicCalendarPage.jsx',
  ];

  const contents = await Promise.all(pages.map((p) => read(p)));

  contents.forEach((source, index) => {
    assert.match(
      source,
      /components\/motion\/MotionSystem/,
      `${pages[index]} should import from MotionSystem`
    );
  });

  const home = contents[0];
  assert.match(home, /hero-ken-burns/);
  assert.match(home, /CountUpNumber/);
});
