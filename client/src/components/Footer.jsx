import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const groups = [
  {
    title: 'Product',
    links: [
      ['Features', '/features'],
      ['Pricing', '/pricing'],
      ['Prop Firm Traders', '/prop-firm-traders'],
      ['Mentors & Academies', '/mentors'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Trading Blog', '/blog'],
      ['Trading Psychology', '/trading-psychology'],
      ['Risk Management', '/risk-management'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About Us', '/about'],
      ['Contact Support', '/contact'],
      ['Login', '/login'],
      ['Register Free', '/register'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Terms of Service', '/terms'],
      ['Privacy Policy', '/privacy'],
      ['Risk Disclaimer', '/disclaimer'],
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-border dark:border-white/10 bg-background px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_2fr]">
      <div>
        <BrandLogo />
        <p className="mt-4 max-w-md text-sm leading-6 text-muted">
          A mobile-first forex trading journal for traders who want structure, review, and discipline without hype.
        </p>
        <div className="mt-5 flex gap-3 text-sm text-gray-500">
          <span>Instagram</span>
          <span>Twitter/X</span>
          <span>LinkedIn</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="font-semibold text-foreground">{group.title}</h3>
            <ul className="mt-4 space-y-3">
              {group.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-muted transition-colors hover:text-emerald-300">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
    <div className="mx-auto mt-10 max-w-7xl border-t border-border dark:border-white/10 pt-6 text-sm text-gray-500">
      © 2026 JAHZJOURNALS. Built for disciplined trading review. Not financial advice.
    </div>
  </footer>
);

export default Footer;
