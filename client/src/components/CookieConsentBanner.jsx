import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, Shield, BarChart3, Megaphone, X, Settings2 } from 'lucide-react';
import { useConsent } from '../context/ConsentProvider';

const CookieConsentBanner = () => {
  const { 
    showBanner, 
    acceptAll, 
    rejectNonEssential, 
    savePreferences, 
    preferencesOpen, 
    openPreferences, 
    closePreferences,
    consent
  } = useConsent();

  const [toggles, setToggles] = useState({
    preferences: false,
    analytics: false,
    advertising: false
  });

  const modalRef = useRef(null);
  
  // Sync local toggles with actual consent if it exists
  useEffect(() => {
    if (consent && consent.categories) {
      setToggles({
        preferences: !!consent.categories.preferences,
        analytics: !!consent.categories.analytics,
        advertising: !!consent.categories.advertising,
      });
    }
  }, [consent, preferencesOpen]);

  // Accessibility: Focus trap and escape key
  useEffect(() => {
    if (!preferencesOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePreferences();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [preferencesOpen, closePreferences]);

  const handleToggle = (category) => {
    setToggles(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSavePreferences = () => {
    savePreferences(toggles);
  };

  if (!showBanner && !preferencesOpen) return null;

  return (
    <>
      {/* Main Banner */}
      {showBanner && !preferencesOpen && (
        <div 
          role="region" 
          aria-label="Cookie consent"
          className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none flex justify-center animate-in slide-in-from-bottom-8 duration-500 ease-out"
        >
          <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/50 shadow-2xl rounded-2xl p-5 sm:p-6 max-w-4xl w-full pointer-events-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Cookie className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-white">Your Privacy Choices</h2>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  JAHZJOURNALS uses cookies and similar technologies to operate the platform, understand usage, and, where permitted, deliver relevant advertising. You can accept all cookies, reject non-essential cookies, or customise your preferences.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 shrink-0">
                <button
                  onClick={openPreferences}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none flex-1 text-center"
                >
                  Manage Preferences
                </button>
                <button
                  onClick={rejectNonEssential}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none flex-1 text-center"
                >
                  Reject Non-Essential
                </button>
                <button
                  onClick={acceptAll}
                  className="px-4 py-2 text-sm font-medium text-gray-900 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none flex-1 text-center"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {preferencesOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            ref={modalRef}
            role="dialog" 
            aria-modal="true"
            aria-labelledby="preferences-modal-title"
            className="bg-gray-900 border border-gray-700 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-500" />
                <h2 id="preferences-modal-title" className="text-xl font-semibold text-white">Privacy Preferences</h2>
              </div>
              <button 
                onClick={closePreferences}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none"
                aria-label="Close preferences"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Necessary */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 bg-gray-800/30">
                <Shield className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-medium text-white">Strictly Necessary</h3>
                    <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded">Always On</span>
                  </div>
                  <p className="text-sm text-gray-400">Essential for the platform to function securely. Includes authentication, security features, and saving your privacy preferences.</p>
                </div>
              </div>

              {/* Preferences */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <Settings2 className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-medium text-white">Functionality & Preferences</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={toggles.preferences}
                        onChange={() => handleToggle('preferences')}
                        aria-label="Enable Functionality and Preferences cookies"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-400">Allows the platform to remember choices you make (such as your theme or sidebar layout) to provide enhanced, personalised features.</p>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <BarChart3 className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-medium text-white">Performance & Analytics</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={toggles.analytics}
                        onChange={() => handleToggle('analytics')}
                        aria-label="Enable Performance and Analytics cookies"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-400">Helps us understand how visitors interact with the platform by collecting and reporting information anonymously, allowing us to improve user experience.</p>
                </div>
              </div>

              {/* Advertising */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <Megaphone className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-medium text-white">Targeted Advertising</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={toggles.advertising}
                        onChange={() => handleToggle('advertising')}
                        aria-label="Enable Targeted Advertising cookies"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-400">Used to deliver advertisements more relevant to you and your interests on our public pages. Our advertising partners do not have access to your private trading data.</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-800 bg-gray-800/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-400 flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                <Link to="/privacy" className="hover:text-emerald-400 underline underline-offset-2 transition-colors">Privacy Policy</Link>
                <span>•</span>
                <Link to="/cookies" className="hover:text-emerald-400 underline underline-offset-2 transition-colors">Cookie Policy</Link>
              </div>
              
              <button
                onClick={handleSavePreferences}
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-gray-900 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsentBanner;
