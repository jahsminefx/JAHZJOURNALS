import { SEO_DEFAULTS } from './defaults';

/**
 * Organization Schema (Google Knowledge Panel)
 */
export const getOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SEO_DEFAULTS.SITE_URL}/#organization`,
  name: SEO_DEFAULTS.ORGANIZATION.name,
  legalName: SEO_DEFAULTS.ORGANIZATION.legalName,
  url: SEO_DEFAULTS.SITE_URL,
  logo: SEO_DEFAULTS.ORGANIZATION.logo,
  founder: {
    '@type': 'Person',
    name: SEO_DEFAULTS.ORGANIZATION.founder,
  },
  foundingDate: SEO_DEFAULTS.ORGANIZATION.foundingDate,
  sameAs: SEO_DEFAULTS.ORGANIZATION.sameAs,
  contactPoint: {
    '@type': 'ContactPoint',
    email: SEO_DEFAULTS.ORGANIZATION.email,
    contactType: 'customer support',
    availableLanguage: ['English'],
  },
});

/**
 * WebSite Schema with SearchAction (User Directive #8)
 */
export const getWebSiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SEO_DEFAULTS.SITE_URL}/#website`,
  url: SEO_DEFAULTS.SITE_URL,
  name: SEO_DEFAULTS.SITE_NAME,
  description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
  publisher: {
    '@id': `${SEO_DEFAULTS.SITE_URL}/#organization`,
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SEO_DEFAULTS.SITE_URL}/features?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
});

/**
 * SoftwareApplication Schema for SaaS Product
 */
export const getSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'JAHZJOURNALS',
  operatingSystem: 'Web, iOS, Android, Windows, macOS',
  applicationCategory: 'FinanceApplication',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '0',
    highPrice: '49',
    offerCount: '3',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '1250',
    bestRating: '5',
    worstRating: '1',
  },
  description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
});

/**
 * Product Schema for Pricing Tier Offers
 */
export const getProductSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'JAHZJOURNALS Trader Subscription',
  description: 'AI-powered trading journal, automated analytics, and prop firm risk management suite.',
  brand: {
    '@type': 'Brand',
    name: 'JAHZJOURNALS',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Trader',
      price: '0.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Pro Trader',
      price: '19.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Founding Trader Lifetime',
      price: '49.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  ],
});

/**
 * FAQPage Schema generator for AI Search Engine & Google AI Overview indexing
 */
export const getFaqSchema = (faqList = []) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqList.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

/**
 * BreadcrumbList Schema generator
 */
export const getBreadcrumbSchema = (items = []) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${SEO_DEFAULTS.SITE_URL}${item.path}`,
  })),
});
