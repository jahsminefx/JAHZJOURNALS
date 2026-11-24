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
      description: 'Market actuals, historical archive & live revision tracking',
      cacheTtl: '60 seconds',
    },
  },
  refreshPolicy: {
    scheduleInterval: 'Cached upstream and refreshed every ~20 minutes',
    actualsInterval: 'Polled upstream every 60 seconds, accelerating to every 2–5 seconds during active release windows',
    clientInterval: 'Instant Server-Sent Events (SSE) push when actuals arrive, with 120s background fallback sync and manual on-demand refresh',
  },
  timingNotice: 'Figures stream to open calendars as soon as upstream reporting agencies publish actual values, typically within seconds of release.',
  accuracyNotice: 'Event release times, actual figures, forecasts, and prior values may be delayed, revised, corrected, or unavailable from upstream data providers.',
  verificationNotice: 'Always verify important releases with the official issuing authority (e.g. Bureau of Labor Statistics, Federal Reserve, ECB, ONS) before making trading decisions.',
  financialDisclaimer: 'This calendar provides trade planning and journaling review information only — not financial, investment, or trading advice.',
};
