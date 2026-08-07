import { SEO_DEFAULTS } from './defaults';

/**
 * Constructs absolute canonical URL given a path or pathname
 */
export const getCanonicalUrl = (pathname = '/') => {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  // Strip trailing slashes except for root '/'
  const normalizedPath = cleanPath.length > 1 && cleanPath.endsWith('/') 
    ? cleanPath.slice(0, -1) 
    : cleanPath;

  return `${SEO_DEFAULTS.SITE_URL}${normalizedPath}`;
};

/**
 * Formats clean document title
 */
export const formatTitle = (title) => {
  if (!title) return SEO_DEFAULTS.DEFAULT_TITLE;
  if (title.includes('JAHZJOURNALS')) return title;
  return `JAHZJOURNALS | ${title}`;
};
