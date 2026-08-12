import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getConsent,
  hasValidConsent,
  acceptAll as serviceAcceptAll,
  rejectNonEssential as serviceRejectNonEssential,
  saveConsent as serviceSaveConsent,
  resetConsent as serviceResetConsent,
  initializeConsentDefaults,
  updateGoogleConsent,
} from '../utils/consentService';
import { loadAdSense, unloadAdSense, isAdvertisingEligiblePage } from '../utils/advertisingService';

const ConsentContext = createContext(null);

export const ConsentProvider = ({ children }) => {
  const [consent, setConsent] = useState(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Initial load
  useEffect(() => {
    // Set up Google Consent Mode defaults early
    initializeConsentDefaults();

    const validConsentExists = hasValidConsent();
    setHasConsent(validConsentExists);
    setShowBanner(!validConsentExists);

    if (validConsentExists) {
      const currentConsent = getConsent();
      setConsent(currentConsent);
      
      // Update Google with existing consent
      if (currentConsent && currentConsent.categories) {
        updateGoogleConsent(currentConsent.categories);
        
        // Load AdSense if applicable
        if (currentConsent.categories.advertising && isAdvertisingEligiblePage()) {
          loadAdSense();
        }
      }
    }
  }, []);

  // Listen for external 'open privacy settings' events (e.g. from Footer)
  useEffect(() => {
    const handleOpenPrivacy = () => setPreferencesOpen(true);
    window.addEventListener('jahzjournals:open-privacy-settings', handleOpenPrivacy);
    return () => window.removeEventListener('jahzjournals:open-privacy-settings', handleOpenPrivacy);
  }, []);

  const acceptAll = () => {
    serviceAcceptAll();
    updateStateAndServices();
  };

  const rejectNonEssential = () => {
    serviceRejectNonEssential();
    updateStateAndServices();
  };

  const savePreferences = (categories) => {
    serviceSaveConsent(categories);
    updateStateAndServices();
  };

  const resetConsent = () => {
    serviceResetConsent();
    setConsent(null);
    setHasConsent(false);
    setShowBanner(true);
    unloadAdSense();
    // Default back to denied for Google Consent Mode
    initializeConsentDefaults(); 
  };

  const openPreferences = () => setPreferencesOpen(true);
  const closePreferences = () => setPreferencesOpen(false);

  // Helper to sync state and trigger side effects
  const updateStateAndServices = () => {
    const updatedConsent = getConsent();
    setConsent(updatedConsent);
    setHasConsent(true);
    setShowBanner(false);
    setPreferencesOpen(false);

    if (updatedConsent && updatedConsent.categories) {
      updateGoogleConsent(updatedConsent.categories);
      
      if (updatedConsent.categories.advertising) {
        loadAdSense();
      } else {
        unloadAdSense();
      }
    }
  };

  const value = {
    consent,
    hasConsent,
    showBanner,
    preferencesOpen,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    resetConsent,
    openPreferences,
    closePreferences,
  };

  return (
    <ConsentContext.Provider value={value}>
      {children}
    </ConsentContext.Provider>
  );
};

export const useConsent = () => {
  const context = useContext(ConsentContext);
  if (context === undefined || context === null) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
};
