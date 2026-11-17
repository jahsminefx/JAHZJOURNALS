import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/useAuth';
import { SEO_DEFAULTS } from '../seo/defaults';

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
      ['Economic News Calendar', '/calendar'],
      ['Position Size Calculator', '/risk-calculator'],
      ['Trading Psychology', '/trading-psychology'],
      ['Risk Management', '/risk-management'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About Us', '/about'],
      ['Contact', '/contact'],
      ['Login', '/login'],
      ['Register Free', '/register'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Terms of Service', '/terms'],
      ['Privacy Policy', '/privacy'],
      ['Cookie Policy', '/cookies'],
      ['Risk Disclaimer', '/disclaimer'],
      ['Refund Policy', '/refund'],
    ],
  },
];

// Verified social channels configuration.
// Items without a valid http(s) URL will be omitted completely.
const SOCIAL_CHANNELS = [
  {
    name: 'Twitter/X',
    url: SEO_DEFAULTS?.ORGANIZATION?.sameAs?.find((u) => /twitter\.com|x\.com/i.test(u)) || 'https://twitter.com/jahzjournals',
  },
  {
    name: 'LinkedIn',
    url: SEO_DEFAULTS?.ORGANIZATION?.sameAs?.find((u) => /linkedin\.com/i.test(u)) || 'https://www.linkedin.com/company/jahzjournals',
  },
  {
    name: 'Instagram',
    url: null, // Omitted until official verified URL is supplied
  },
];

const Footer = () => {
  const { user } = useAuth();
  if (user) return null;

  const validSocialLinks = SOCIAL_CHANNELS.filter(
    (item) => typeof item.url === 'string' && /^https?:\/\//i.test(item.url.trim())
  );

  return (
    <footer className="border-t border-border dark:border-white/10 bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            A mobile-first forex trading journal for traders who want structure, review, and discipline without hype.
          </p>
          {validSocialLinks.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500">
              {validSocialLinks.map((item) => (
                <a
                  key={item.name}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-emerald-400 transition-colors"
                  aria-label={`Follow JAHZJOURNALS on ${item.name}`}
                >
                  {item.name}
                </a>
              ))}
            </div>
          )}
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
      <div className="mx-auto mt-10 max-w-7xl border-t border-border dark:border-white/10 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500">
        <span>© 2026 JAHZJOURNALS. Built for disciplined trading review. Not financial advice.</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('jahzjournals:open-privacy-settings'))}
          className="text-sm text-muted hover:text-emerald-300 transition-colors text-left sm:text-right"
        >
          Privacy Settings
        </button>
      </div>
    </footer>
  );
};

export default Footer;
