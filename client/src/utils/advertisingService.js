import { isConsentCategory } from './consentService.js';

export const ADSENSE_SCRIPT_ID = 'jahzjournals-adsense-script';

/**
 * Checks if the current page is eligible for advertising.
 * Ads are only allowed on public pages.
 * 
 * @param {string} [pathname] - The path to check. Defaults to window.location.pathname.
 * @returns {boolean} True if eligible for advertising, false otherwise.
 */
export const isAdvertisingEligiblePage = (pathname = window.location.pathname) => {
  // Use exact matches for root and specific public routes
  const exactEligibleRoutes = new Set([
    '/',
    '/features',
    '/pricing',
    '/about',
    '/contact',
    '/blog',
    '/prop-firm-traders',
    '/mentors',
    '/trading-psychology',
    '/risk-management',
    '/terms',
    '/privacy',
    '/cookies',
    '/disclaimer'
  ]);

  if (exactEligibleRoutes.has(pathname)) {
    return true;
  }

  // Handle dynamic/nested public routes (e.g. /blog/some-post)
  if (pathname.startsWith('/blog/')) {
    return true;
  }

  // All other routes (especially authenticated ones like /dashboard, /trades, etc.) are FALSE
  return false;
};

/**
 * Loads the AdSense script if consent is granted and the page is eligible.
 * @returns {boolean} True if loaded or already present, false if not loaded.
 */
export const loadAdSense = () => {
  try {
    // 1. Check if user consented to advertising
    if (!isConsentCategory('advertising')) {
      return false;
    }

    // 2. Check if current page is eligible for ads (no private app pages)
    if (!isAdvertisingEligiblePage()) {
      return false;
    }

    // 3. Check if script is already injected
    if (document.getElementById(ADSENSE_SCRIPT_ID)) {
      return true; // Already loaded
    }

    // 4. Check for publisher ID
    const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID || 'ca-pub-6725573719511845';

    // 5. Inject the script safely
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.crossOrigin = 'anonymous';

    document.head.appendChild(script);
    return true;
  } catch (error) {
    // Never crash the app due to advertising failures
    console.error('Failed to load AdSense script gracefully:', error);
    return false;
  }
};

/**
 * Removes the AdSense script from the document.
 * Note: This does not remove cookies already set by Google.
 */
export const unloadAdSense = () => {
  try {
    const script = document.getElementById(ADSENSE_SCRIPT_ID);
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
    }
  } catch (error) {
    console.error('Failed to unload AdSense script:', error);
  }
};
