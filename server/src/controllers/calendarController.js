const calendarService = require('../services/calendarService');
const economicAlertService = require('../services/economicAlertService');
const {
  SUPPORTED_FOREX_PAIRS,
  SUPPORTED_CURRENCIES,
  TARGETING_MODES,
} = require('../services/currencyMatchingService');

/**
 * GET /api/calendar
 * Returns economic calendar events with filtering options
 */
const getCalendarEvents = async (req, res) => {
  try {
    const events = await calendarService.getEvents(req.query);
    const lastSyncedAt = calendarService.getLastFetchedAt();
    res.json({
      success: true,
      count: events.length,
      lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching economic calendar events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve economic calendar data.',
    });
  }
};

/**
 * GET /api/calendar/upcoming
 * Returns upcoming High and Medium impact events within window
 */
const getUpcomingEvents = async (req, res) => {
  try {
    const windowMinutes = Number.parseInt(req.query.window, 10) || 240;
    const events = await calendarService.getUpcomingHighImpactEvents(windowMinutes);
    res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching upcoming economic events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve upcoming economic events.',
    });
  }
};

/**
 * POST /api/calendar/check-trade-news
 * Evaluates whether a trade entry coincides with high-impact news
 */
const checkTradeNews = async (req, res) => {
  try {
    const { tradeTime, pair, windowMinutes = 15 } = req.body;
    if (!tradeTime || !pair) {
      return res.status(400).json({
        success: false,
        message: 'tradeTime and pair are required.',
      });
    }

    const correlation = await calendarService.correlateTradeWithNews(
      tradeTime,
      pair,
      Number.parseInt(windowMinutes, 10) || 15
    );

    res.json({
      success: true,
      ...correlation,
    });
  } catch (error) {
    console.error('Error checking trade news correlation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check trade news correlation.',
    });
  }
};

/**
 * GET /api/calendar/alerts/preferences
 * Returns user alert configuration
 */
const getAlertPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await economicAlertService.getUserAlertPreferences(userId);
    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Error fetching alert preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert preferences.',
    });
  }
};

/**
 * PUT /api/calendar/alerts/preferences
 * Updates user alert configuration
 */
const updateAlertPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const updated = await economicAlertService.updateUserAlertPreferences(userId, req.body);
    res.json({
      success: true,
      message: 'Alert preferences updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating alert preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert preferences.',
    });
  }
};

/**
 * GET /api/calendar/alerts/history
 * Returns user previous economic news alerts
 */
const getAlertHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30, offset = 0 } = req.query;
    const { logs, total } = await economicAlertService.getUserAlertHistory(userId, { limit, offset });
    res.json({
      success: true,
      total,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert history.',
    });
  }
};

/**
 * PATCH /api/calendar/alerts/toggle
 * Toggles global alert on/off switch while preserving all settings
 */
const toggleAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isEnabled } = req.body;
    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isEnabled boolean is required.',
      });
    }

    const updated = await economicAlertService.toggleGlobalAlerts(userId, isEnabled);
    res.json({
      success: true,
      message: `Economic news alerts ${isEnabled ? 'enabled' : 'disabled'} successfully.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error toggling alert status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle alert status.',
    });
  }
};

/**
 * GET /api/calendar/alerts/supported-pairs
 * Returns list of supported currency pairs
 */
const getSupportedPairs = (req, res) => {
  res.json({
    success: true,
    data: SUPPORTED_FOREX_PAIRS,
  });
};

/**
 * GET /api/calendar/alerts/supported-currencies
 * Returns list of supported individual currencies
 */
const getSupportedCurrencies = (req, res) => {
  res.json({
    success: true,
    data: SUPPORTED_CURRENCIES,
  });
};

module.exports = {
  getCalendarEvents,
  getUpcomingEvents,
  checkTradeNews,
  getAlertPreferences,
  updateAlertPreferences,
  toggleAlerts,
  getAlertHistory,
  getSupportedPairs,
  getSupportedCurrencies,
};
