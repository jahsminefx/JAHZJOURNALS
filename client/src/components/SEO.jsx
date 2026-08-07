import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SEO_DEFAULTS } from '../seo/defaults';
import { getCanonicalUrl, formatTitle } from '../seo/helpers';
import { PAGE_SEO } from '../seo/pages';

const SEO = ({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  schemas = [],
}) => {
  const location = useLocation();
  const pageConfig = PAGE_SEO[location.pathname] || {};

  const metaTitle = formatTitle(title || pageConfig.title || SEO_DEFAULTS.DEFAULT_TITLE);
  const metaDescription = description || pageConfig.description || SEO_DEFAULTS.DEFAULT_DESCRIPTION;
  const metaKeywords = keywords || pageConfig.keywords || SEO_DEFAULTS.DEFAULT_KEYWORDS;
  const metaCanonical = canonical || getCanonicalUrl(location.pathname);
  const metaOgImage = ogImage || pageConfig.ogImage || SEO_DEFAULTS.DEFAULT_OG_IMAGE;

  // Combine route schemas with explicit custom schemas
  const activeSchemas = [
    ...(pageConfig.schemas || []),
    ...(Array.isArray(schemas) ? schemas : [schemas]),
  ].filter(Boolean);

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      <link rel="canonical" href={metaCanonical} />
      
      {/* Robots Directive */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}

      {/* Open Graph Tags */}
      <meta property="og:site_name" content={SEO_DEFAULTS.SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={metaCanonical} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaOgImage} />

      {/* Twitter Cards Tags */}
      <meta name="twitter:card" content={SEO_DEFAULTS.TWITTER_CARD_TYPE} />
      <meta name="twitter:site" content={SEO_DEFAULTS.TWITTER_HANDLE} />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaOgImage} />

      {/* Theme Color */}
      <meta name="theme-color" content={SEO_DEFAULTS.THEME_COLOR} />

      {/* JSON-LD Structured Data */}
      {activeSchemas.map((schemaObj, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(schemaObj)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
