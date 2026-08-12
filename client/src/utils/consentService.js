const CONSENT_KEY = 'jahzjournals-consent';
export const CONSENT_VERSION = '1.0';
const EXPIRY_MONTHS = 13;

/**
 * Helper to push to Google dataLayer
 */
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

/**
 * Gets the current consent object if it exists, is the correct version, and is not expired.
 * @returns {Object|null}
 */
export const getConsent = () => {
  try {
    const item = localStorage.getItem(CONSENT_KEY);
    if (!item) return null;

    const parsed = JSON.parse(item);
    
    // Check version
    if (parsed.version !== CONSENT_VERSION) return null;
    
    // Check expiry
    const consentDate = new Date(parsed.timestamp);
    const expiryDate = new Date(consentDate.setMonth(consentDate.getMonth() + EXPIRY_MONTHS));
    if (new Date() > expiryDate) return null;

    return parsed;
  } catch (error) {
    console.error('Error parsing consent data:', error);
    return null;
  }
};

/**
 * Checks if there is a valid, unexpired consent object for the current version.
 * @returns {boolean}
 */
export const hasValidConsent = () => {
  return getConsent() !== null;
};

/**
 * Saves consent categories with current timestamp and version.
 * @param {Object} categories - The consent categories to save
 */
export const saveConsent = (categories) => {
  try {
    const consentData = {
      categories: {
        necessary: true, // always true
        preferences: !!categories.preferences,
        analytics: !!categories.analytics,
        advertising: !!categories.advertising,
      },
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
  } catch (error) {
    console.error('Error saving consent data:', error);
  }
};

/**
 * Accepts all consent categories.
 */
export const acceptAll = () => {
  saveConsent({
    preferences: true,
    analytics: true,
    advertising: true,
  });
};

/**
 * Rejects all non-essential consent categories.
 */
export const rejectNonEssential = () => {
  saveConsent({
    preferences: false,
    analytics: false,
    advertising: false,
  });
};

/**
 * Removes the consent data from localStorage.
 */
export const resetConsent = () => {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch (error) {
    console.error('Error resetting consent data:', error);
  }
};

/**
 * Gets the timestamp of when consent was granted.
 * @returns {string|null} ISO string timestamp or null
 */
export const getConsentTimestamp = () => {
  const consent = getConsent();
  return consent ? consent.timestamp : null;
};

/**
 * Checks if a specific consent category has been granted.
 * @param {string} category 
 * @returns {boolean}
 */
export const isConsentCategory = (category) => {
  if (category === 'necessary') return true;
  const consent = getConsent();
  return consent ? !!consent.categories[category] : false;
};

/**
 * Initializes default consent state for Google Consent Mode v2.
 * Should be called early before Google scripts load.
 */
export const initializeConsentDefaults = () => {
  try {
    window.dataLayer = window.dataLayer || [];
    
    // Set default consent to denied for all non-essential categories
    gtag('consent', 'default', {
      'ad_storage': 'denied',
      'analytics_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied',
      'personalization_storage': 'denied',
      'functionality_storage': 'denied',
      'security_storage': 'granted', // Necessary
      'wait_for_update': 500
    });
  } catch (error) {
    console.error('Error initializing consent defaults:', error);
  }
};

/**
 * Updates Google Consent Mode based on user choices.
 * @param {Object} categories 
 */
export const updateGoogleConsent = (categories) => {
  try {
    window.dataLayer = window.dataLayer || [];
    
    gtag('consent', 'update', {
      'ad_storage': categories.advertising ? 'granted' : 'denied',
      'analytics_storage': categories.analytics ? 'granted' : 'denied',
      'ad_user_data': categories.advertising ? 'granted' : 'denied',
      'ad_personalization': categories.advertising ? 'granted' : 'denied',
      'personalization_storage': categories.preferences ? 'granted' : 'denied',
      'functionality_storage': categories.preferences ? 'granted' : 'denied',
      'security_storage': 'granted'
    });
  } catch (error) {
    console.error('Error updating Google consent:', error);
  }
};
