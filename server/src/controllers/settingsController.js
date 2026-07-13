const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getSettings = async (req, res) => {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ message: "We couldn't retrieve your settings." });
  }
};

const floatFields = [
  'defaultRiskPercent', 'minimumRiskRewardRatio', 'dailyLossLimit', 
  'riskPerTrade', 'dailyDrawdownLimit', 'weeklyDrawdownLimit'
];
const intFields = [
  'maxTradesPerDay', 'maxLossesPerDay', 'maximumOpenTrades', 
  'stopAfterLosses', 'maximumScreenshotsPerTrade'
];

const updateSettingsSection = async (req, res, sectionFields) => {
  try {
    const dataToUpdate = {};
    for (const field of sectionFields) {
      if (req.body[field] !== undefined) {
        let val = req.body[field];
        if (val === '') {
          val = null;
        } else if (floatFields.includes(field)) {
          val = parseFloat(val);
          if (isNaN(val)) val = null;
        } else if (intFields.includes(field)) {
          val = parseInt(val, 10);
          if (isNaN(val)) val = null;
        }
        dataToUpdate[field] = val;
      }
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: 'No valid settings provided to update.' });
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: dataToUpdate,
      create: { userId: req.user.id, ...dataToUpdate },
    });

    res.json(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ message: 'We hit a snag updating your settings.' });
  }
};

const updateTradingPreferences = (req, res) => updateSettingsSection(req, res, [
  'defaultTradingAccountId',
  'defaultRiskPercent',
  'minimumRiskRewardRatio',
  'defaultHigherTimeframe',
  'defaultEntryTimeframe',
  'mainStrategy',
  'mainPairs',
  'preferredSession',
  'maxTradesPerDay',
  'maxLossesPerDay',
  'dailyLossLimit',
]);

const updateRiskSettings = (req, res) => updateSettingsSection(req, res, [
  'riskPerTrade',
  'dailyDrawdownLimit',
  'weeklyDrawdownLimit',
  'maximumOpenTrades',
  'stopAfterLosses',
  'warnRiskAboveLimit',
  'warnRiskRewardBelowMinimum',
]);

const updateJournalPreferences = (req, res) => updateSettingsSection(req, res, [
  'defaultTradeGrade',
  'requireScreenshotBeforeCompletion',
  'requirePostTradeNotes',
  'requireEmotionTracking',
  'requireRuleChecklist',
  'showOpenTradesFirst',
  'defaultTradeListView',
  'defaultAnalyticsPeriod',
  'requiredTradeFields',
  'defaultScreenshotType',
  'defaultScreenshotQuality',
  'maximumScreenshotsPerTrade',
  'automaticallyCompressImages',
  'keepOriginalImage',
  'deleteCloudinaryImagesWithTrade',
  'enableAiTradeReviews',
  'generateReviewAfterClose',
  'includeEmotions',
  'includeRuleViolations',
  'includeScreenshots',
  'weeklyAiSummary',
  'coachingTone',
  'assignedMentor',
  'shareTradesWithMentor',
  'shareScreenshots',
  'shareEmotions',
  'shareWeeklyReviews',
  'allowMentorComments',
]);

const updateNotifications = (req, res) => updateSettingsSection(req, res, [
  'weeklyReviewReminders',
  'dailyJournalingReminders',
  'tradeFollowUpReminders',
  'riskLimitWarnings',
  'propFirmDrawdownWarnings',
  'mentorFeedbackNotifications',
  'productUpdates',
  'emailNotifications',
  'inAppNotifications',
]);

const updateAppearance = (req, res) => updateSettingsSection(req, res, [
  'theme',
  'dashboardDensity',
  'tradeTableDensity',
  'chartAnimations',
  'preferredDateFormat',
  'preferredNumberFormat',
]);

const updateDataPrivacy = (req, res) => updateSettingsSection(req, res, [
  'allowAiUseOfJournalData',
]);

module.exports = {
  getSettings,
  updateTradingPreferences,
  updateRiskSettings,
  updateJournalPreferences,
  updateNotifications,
  updateAppearance,
  updateDataPrivacy,
};
