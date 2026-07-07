export const SETTINGS_STORAGE_KEY = 'jahzjournals.settings.v1';

export const defaultSettings = {
  profile: {
    preferredCurrency: 'USD',
    profilePhotoUrl: '',
  },
  trading: {
    defaultTradingAccountId: '',
    defaultRiskPercent: '1',
    minimumRiskRewardRatio: '2',
    maxTradesPerDay: '3',
    maxLossesPerDay: '2',
    dailyLossLimit: '3',
    preferredSession: 'LONDON',
    defaultEntryTimeframe: '15M',
    defaultHigherTimeframe: '4H',
    mainStrategy: '',
    mainPairs: 'XAUUSD, EURUSD, GBPUSD',
  },
  risk: {
    riskPerTrade: '1',
    dailyDrawdownLimit: '3',
    weeklyDrawdownLimit: '6',
    maximumOpenTrades: '2',
    stopAfterLosses: '2',
    warnRiskAboveLimit: true,
    warnRiskRewardBelowMinimum: true,
  },
  journal: {
    defaultTradeGrade: '',
    requiredTradeFields: ['pair', 'direction', 'entryPrice', 'stopLoss', 'takeProfit'],
    requireScreenshotBeforeCompletion: false,
    requirePostTradeNotes: true,
    requireEmotionTracking: true,
    requireRuleChecklist: true,
    showOpenTradesFirst: true,
    defaultTradeListView: 'table',
    defaultAnalyticsPeriod: '30d',
  },
  screenshot: {
    defaultScreenshotQuality: 'high',
    maximumScreenshotsPerTrade: '6',
    automaticallyCompressImages: true,
    keepOriginalImage: false,
    defaultScreenshotType: 'MARKED_CHART',
    deleteCloudinaryImagesWithTrade: true,
  },
  notifications: {
    weeklyReviewReminders: true,
    dailyJournalingReminders: false,
    tradeFollowUpReminders: true,
    riskLimitWarnings: true,
    propFirmDrawdownWarnings: true,
    mentorFeedbackNotifications: true,
    productUpdates: false,
    emailNotifications: true,
    inAppNotifications: true,
  },
  appearance: {
    theme: 'dark',
    dashboardDensity: 'comfortable',
    tradeTableDensity: 'comfortable',
    chartAnimations: true,
    preferredDateFormat: 'DD/MM/YYYY',
    preferredNumberFormat: '1,234.56',
  },
  security: {
    loginAlerts: true,
  },
  billing: {
    billingEmail: '',
    renewalReminders: true,
  },
  dataPrivacy: {
    allowAiUseOfJournalData: true,
  },
  ai: {
    enableAiTradeReviews: false,
    generateReviewAfterClose: false,
    coachingTone: 'analytical',
    includeEmotions: true,
    includeRuleViolations: true,
    includeScreenshots: false,
    weeklyAiSummary: false,
  },
  mentor: {
    assignedMentor: '',
    shareTradesWithMentor: false,
    shareScreenshots: false,
    shareEmotions: false,
    shareWeeklyReviews: false,
    allowMentorComments: true,
  },
};

const mergeSettings = (base, saved) => Object.entries(base).reduce((settings, [key, value]) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      ...settings,
      [key]: {
        ...value,
        ...(saved?.[key] || {}),
      },
    };
  }

  return {
    ...settings,
    [key]: saved?.[key] ?? value,
  };
}, {});

export const loadSettings = () => {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const savedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return mergeSettings(defaultSettings, savedSettings);
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};
