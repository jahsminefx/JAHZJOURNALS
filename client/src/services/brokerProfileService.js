/**
 * Broker Profiles Management Service for JAHZJOURNALS Risk Calculator V3
 * Manages trader-facing broker profiles with custom instrument contract sizes,
 * lot steps, min/max lot sizes, commissions, spreads, and slippage assumptions.
 */

const STORAGE_KEY = 'jahzjournals-broker-profiles-v3';

const memoryStorage = {};

const isLocalStorageAvailable = () => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const testKey = '__jahz_test_storage__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
};

const storage = {
  getItem: (key) => {
    if (isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  },
  setItem: (key, val) => {
    if (isLocalStorageAvailable()) {
      localStorage.setItem(key, val);
    }
    memoryStorage[key] = String(val);
  },
};

export const DEFAULT_BROKER_PROFILE = {
  id: 'default_standard_profile',
  name: 'Standard Broker Profile',
  accountCurrency: 'USD',
  commissionPerLot: 0,
  commissionType: 'ROUND_TRIP',
  defaultSpreadPips: 0,
  defaultSlippagePips: 0,
  instrumentOverrides: {},
};

/**
 * Returns saved broker profiles
 */
export const getSavedBrokerProfiles = () => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_BROKER_PROFILE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_BROKER_PROFILE];
  } catch (_) {
    return [DEFAULT_BROKER_PROFILE];
  }
};

/**
 * Saves or updates a broker profile
 */
export const saveBrokerProfile = (profile) => {
  if (!profile || !profile.name) return false;
  const profiles = getSavedBrokerProfiles();
  const existingIdx = profiles.findIndex((p) => p.id === profile.id);

  const updatedProfile = {
    ...profile,
    id: profile.id || `broker_profile_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };

  let updatedList = [];
  if (existingIdx >= 0) {
    updatedList = [...profiles];
    updatedList[existingIdx] = updatedProfile;
  } else {
    updatedList = [updatedProfile, ...profiles];
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    return updatedProfile;
  } catch (_) {
    return false;
  }
};

/**
 * Deletes a broker profile
 */
export const deleteBrokerProfile = (profileId) => {
  if (!profileId || profileId === DEFAULT_BROKER_PROFILE.id) return false;
  const profiles = getSavedBrokerProfiles();
  const updatedList = profiles.filter((p) => p.id !== profileId);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    return true;
  } catch (_) {
    return false;
  }
};
