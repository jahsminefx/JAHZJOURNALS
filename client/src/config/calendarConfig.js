/**
 * Economic Calendar Integration & Disclosure Configuration
 * 
 * Accurately documents upstream feeds, refresh intervals, and user disclosures.
 */
export const CALENDAR_CONFIG = {
  sources: {
    schedule: {
      name: 'ForexFactory',
      description: 'Weekly schedule & consensus forecasts',
      cacheTtl: '20 minutes',
    },
    actuals: {
      name: 'TradingView',
      description: 'Market actuals & live revision tracking',
      cacheTtl: '60 seconds',
    },
  },
  refreshPolicy: {
    scheduleInterval: 'Cached upstream and refreshed every ~20 minutes',
    actualsInterval: 'Polled every 60 seconds (accelerating to 4s–15s during active release windows)',
    clientInterval: '120 seconds standard background refresh; manual on-demand sync available anytime',
  },
  timingNotice: 'Figures can appear shortly after their scheduled release time as reporting statistical agencies publish and confirm figures.',
  accuracyNotice: 'Event release times, actual figures, forecasts, and prior values may be delayed, revised, corrected, or unavailable from upstream data providers.',
  verificationNotice: 'Always verify important releases with the official issuing authority (e.g. Bureau of Labor Statistics, Federal Reserve, ECB, ONS) before making trading decisions.',
  financialDisclaimer: 'This calendar provides trade planning and journaling review information only — not financial, investment, or trading advice.',
};
