import api from './api';

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

export const mapApiToSettings = (apiData) => {
  const s = { ...defaultSettings };
  if (!apiData) return s;

  if (apiData.theme) {
    s.appearance.theme = apiData.theme;
    s.appearance.dashboardDensity = apiData.dashboardDensity;
    s.appearance.tradeTableDensity = apiData.tradeTableDensity;
    s.appearance.chartAnimations = apiData.chartAnimations;
    s.appearance.preferredDateFormat = apiData.preferredDateFormat;
    s.appearance.preferredNumberFormat = apiData.preferredNumberFormat;
  }
  
  if (apiData.defaultTradingAccountId !== undefined) {
    s.trading.defaultTradingAccountId = apiData.defaultTradingAccountId || '';
    s.trading.defaultRiskPercent = apiData.defaultRiskPercent?.toString() || '';
    s.trading.minimumRiskRewardRatio = apiData.minimumRiskRewardRatio?.toString() || '';
    s.trading.defaultHigherTimeframe = apiData.defaultHigherTimeframe || '';
    s.trading.defaultEntryTimeframe = apiData.defaultEntryTimeframe || '';
    s.trading.mainStrategy = apiData.mainStrategy || '';
    s.trading.mainPairs = apiData.mainPairs || '';
    s.trading.preferredSession = apiData.preferredSession || '';
    s.trading.maxTradesPerDay = apiData.maxTradesPerDay?.toString() || '';
    s.trading.maxLossesPerDay = apiData.maxLossesPerDay?.toString() || '';
    s.trading.dailyLossLimit = apiData.dailyLossLimit?.toString() || '';
  }

  if (apiData.riskPerTrade !== undefined) {
    s.risk.riskPerTrade = apiData.riskPerTrade?.toString() || '';
    s.risk.dailyDrawdownLimit = apiData.dailyDrawdownLimit?.toString() || '';
    s.risk.weeklyDrawdownLimit = apiData.weeklyDrawdownLimit?.toString() || '';
    s.risk.maximumOpenTrades = apiData.maximumOpenTrades?.toString() || '';
    s.risk.stopAfterLosses = apiData.stopAfterLosses?.toString() || '';
    s.risk.warnRiskAboveLimit = apiData.warnRiskAboveLimit ?? false;
    s.risk.warnRiskRewardBelowMinimum = apiData.warnRiskRewardBelowMinimum ?? false;
  }

  if (apiData.defaultTradeGrade !== undefined) {
    s.journal.defaultTradeGrade = apiData.defaultTradeGrade || '';
    s.journal.requireScreenshotBeforeCompletion = apiData.requireScreenshotBeforeCompletion ?? false;
    s.journal.requirePostTradeNotes = apiData.requirePostTradeNotes ?? false;
    s.journal.requireEmotionTracking = apiData.requireEmotionTracking ?? false;
    s.journal.requireRuleChecklist = apiData.requireRuleChecklist ?? false;
    s.journal.showOpenTradesFirst = apiData.showOpenTradesFirst ?? true;
    s.journal.defaultTradeListView = apiData.defaultTradeListView || 'table';
    s.journal.defaultAnalyticsPeriod = apiData.defaultAnalyticsPeriod || '30d';
    s.journal.requiredTradeFields = apiData.requiredTradeFields || [];
  }

  if (apiData.defaultScreenshotType !== undefined) {
    s.screenshot.defaultScreenshotType = apiData.defaultScreenshotType || 'MARKED_CHART';
    s.screenshot.defaultScreenshotQuality = apiData.defaultScreenshotQuality || 'high';
    s.screenshot.maximumScreenshotsPerTrade = apiData.maximumScreenshotsPerTrade?.toString() || '6';
    s.screenshot.automaticallyCompressImages = apiData.automaticallyCompressImages ?? true;
    s.screenshot.keepOriginalImage = apiData.keepOriginalImage ?? false;
    s.screenshot.deleteCloudinaryImagesWithTrade = apiData.deleteCloudinaryImagesWithTrade ?? true;
  }

  if (apiData.enableAiTradeReviews !== undefined) {
    s.ai.enableAiTradeReviews = apiData.enableAiTradeReviews ?? false;
    s.ai.generateReviewAfterClose = apiData.generateReviewAfterClose ?? false;
    s.ai.includeEmotions = apiData.includeEmotions ?? true;
    s.ai.includeRuleViolations = apiData.includeRuleViolations ?? true;
    s.ai.includeScreenshots = apiData.includeScreenshots ?? false;
    s.ai.weeklyAiSummary = apiData.weeklyAiSummary ?? false;
    s.ai.coachingTone = apiData.coachingTone || 'analytical';
  }

  if (apiData.assignedMentor !== undefined) {
    s.mentor.assignedMentor = apiData.assignedMentor || '';
    s.mentor.shareTradesWithMentor = apiData.shareTradesWithMentor ?? false;
    s.mentor.shareScreenshots = apiData.shareScreenshots ?? false;
    s.mentor.shareEmotions = apiData.shareEmotions ?? false;
    s.mentor.shareWeeklyReviews = apiData.shareWeeklyReviews ?? false;
    s.mentor.allowMentorComments = apiData.allowMentorComments ?? true;
  }

  if (apiData.weeklyReviewReminders !== undefined) {
    s.notifications.weeklyReviewReminders = apiData.weeklyReviewReminders ?? false;
    s.notifications.dailyJournalingReminders = apiData.dailyJournalingReminders ?? false;
    s.notifications.tradeFollowUpReminders = apiData.tradeFollowUpReminders ?? false;
    s.notifications.riskLimitWarnings = apiData.riskLimitWarnings ?? false;
    s.notifications.propFirmDrawdownWarnings = apiData.propFirmDrawdownWarnings ?? false;
    s.notifications.mentorFeedbackNotifications = apiData.mentorFeedbackNotifications ?? false;
    s.notifications.productUpdates = apiData.productUpdates ?? false;
    s.notifications.emailNotifications = apiData.emailNotifications ?? false;
    s.notifications.inAppNotifications = apiData.inAppNotifications ?? true;
  }

  if (apiData.billingEmail !== undefined) {
    s.billing.billingEmail = apiData.billingEmail || '';
    s.billing.renewalReminders = apiData.renewalReminders ?? false;
  }

  if (apiData.allowAiUseOfJournalData !== undefined) {
    s.dataPrivacy.allowAiUseOfJournalData = apiData.allowAiUseOfJournalData ?? false;
  }

  return mergeSettings(defaultSettings, s);
};

export const fetchAndSyncSettings = async () => {
  try {
    const { data } = await api.get('/users/settings');
    const flatSettings = mapApiToSettings(data);
    saveSettings(flatSettings);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('theme-sync', { detail: flatSettings.appearance.theme }));
    }
    
    return flatSettings;
  } catch (error) {
    console.error('Failed to sync settings from server:', error);
    return loadSettings();
  }
};
