const communicationsAnalyticsService = require('../../services/communications/communicationsAnalyticsService');

exports.getAnalytics = async (req, res) => {
  try {
    const metrics = await communicationsAnalyticsService.getAnalyticsMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching communications analytics:', error);
    res.status(500).json({ error: 'Failed to fetch communications analytics' });
  }
};
