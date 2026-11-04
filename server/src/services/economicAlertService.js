const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const calendarService = require('./calendarService');
const {
  cleanPairString,
  cleanCurrencyString,
  matchEventToUserPreferences,
  generateDeterministicEventId,
  buildAlertNotificationContent,
  buildDeduplicationKey,
  SUPPORTED_FOREX_PAIRS,
  SUPPORTED_CURRENCIES,
  TARGETING_MODES,
  normalizeImpact,
} = require('./currencyMatchingService');

const DEFAULT_PREFERENCE = {
  isEnabled: true,
  targetingMode: TARGETING_MODES.CURRENCIES_AND_PAIRS,
  currencies: ['USD', 'EUR', 'GBP'],
  pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
  impactLevels: ['HIGH'],
  leadTimesMinutes: [30],
};

/**
 * Retrieves or initializes alert preferences for a user
 */
async function getUserAlertPreferences(userId) {
  if (!userId) throw new Error('User ID is required');

  let preference = await prisma.economicNewsAlertPreference.findUnique({
    where: { userId },
  });

  if (!preference) {
    preference = await prisma.economicNewsAlertPreference.create({
      data: {
        userId,
        ...DEFAULT_PREFERENCE,
      },
    });
  }

  return preference;
}

/**
 * Toggles global alert switch without wiping out any saved configurations
 */
async function toggleGlobalAlerts(userId, isEnabled) {
  if (!userId) throw new Error('User ID is required');
  if (typeof isEnabled !== 'boolean') throw new Error('isEnabled boolean is required');

  return await prisma.economicNewsAlertPreference.upsert({
    where: { userId },
    update: { isEnabled },
    create: {
      userId,
      ...DEFAULT_PREFERENCE,
      isEnabled,
    },
  });
}

/**
 * Updates a user's alert preferences with input validation (V1.1: Supports Targeting Mode & Currencies)
 */
async function updateUserAlertPreferences(userId, updates = {}) {
  if (!userId) throw new Error('User ID is required');

  const dataToUpdate = {};

  if (typeof updates.isEnabled === 'boolean') {
    dataToUpdate.isEnabled = updates.isEnabled;
  }

  if (updates.targetingMode && Object.values(TARGETING_MODES).includes(updates.targetingMode)) {
    dataToUpdate.targetingMode = updates.targetingMode;
  }

  if (Array.isArray(updates.currencies)) {
    dataToUpdate.currencies = updates.currencies
      .map(c => cleanCurrencyString(c))
      .filter(Boolean);
  }

  if (Array.isArray(updates.pairs)) {
    dataToUpdate.pairs = updates.pairs
      .map(p => cleanPairString(p))
      .filter(Boolean);
  }

  if (Array.isArray(updates.impactLevels)) {
    dataToUpdate.impactLevels = updates.impactLevels
      .map(i => normalizeImpact(i))
      .filter(Boolean);
  }

  if (Array.isArray(updates.leadTimesMinutes)) {
    const validTimes = updates.leadTimesMinutes
      .map(m => Number.parseInt(m, 10))
      .filter(m => !Number.isNaN(m) && m > 0 && m <= 1440); // 1 min to 24h
    dataToUpdate.leadTimesMinutes = validTimes.length > 0 ? validTimes : [30];
  }

  return await prisma.economicNewsAlertPreference.upsert({
    where: { userId },
    update: dataToUpdate,
    create: {
      userId,
      ...DEFAULT_PREFERENCE,
      ...dataToUpdate,
    },
  });
}

/**
 * Formats a release date according to the user's timezone
 */
function formatReleaseTime(date, timezone) {
  try {
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(d);
  } catch (err) {
    return new Date(date).toTimeString().slice(0, 5) + ' UTC';
  }
}

/**
 * Formats lead time in a human-friendly string
 */
function formatLeadTimeString(leadMinutes) {
  if (leadMinutes >= 1440) return `${Math.round(leadMinutes / 1440)} hour(s)`;
  if (leadMinutes >= 60) return `${Math.round(leadMinutes / 60)} hour(s)`;
  return `${leadMinutes} minutes`;
}

/**
 * Dispatches an alert across enabled channels idempotently (V1.1: Context-aware content & set-based deduplication)
 */
async function dispatchAlertToUser({ user, preference, event, matchResult, leadMinutes }) {
  // Enforce server-side global switch
  if (!preference || preference.isEnabled === false) {
    return [];
  }

  const eventId = generateDeterministicEventId(event);
  const eventDate = new Date(event.date);
  const releaseTimeStr = formatReleaseTime(eventDate, user.timezone);
  const timeRemainingStr = formatLeadTimeString(leadMinutes);

  const { title, message } = buildAlertNotificationContent({
    event,
    matchResult,
    releaseTimeStr,
    timeRemainingStr,
  });

  const matchedCurrencies = matchResult.matchedCurrencies || [];
  const matchedPairs = matchResult.matchedPairs || [];
  const pairLabel = matchedPairs.length > 0 ? matchedPairs.join(', ') : matchResult.eventCurrency;

  const results = [];

  // Exclusively In-App Notification Center
  try {
    const existingLog = await prisma.economicNewsAlertLog.findUnique({
      where: {
        user_event_lead_channel: {
          userId: user.id,
          eventId,
          leadMinutes,
          channel: 'IN_APP',
        },
      },
    });

    if (!existingLog) {
      // Create in-app Notification record
      const notification = await prisma.notification.create({
        data: {
          type: 'ECONOMIC_NEWS',
          category: 'ECONOMIC_ALERT',
          title,
          message,
          actionUrl: '/calendar',
          isGlobal: false,
          senderId: 'SYSTEM',
          targetUsers: [user.id],
        },
      });

      await prisma.notificationRecipient.create({
        data: {
          notificationId: notification.id,
          userId: user.id,
          status: 'UNREAD',
        },
      });

      // Record delivery log with V1.1 matched context
      await prisma.economicNewsAlertLog.create({
        data: {
          userId: user.id,
          eventId,
          leadMinutes,
          channel: 'IN_APP',
          pair: pairLabel,
          matchedCurrencies,
          matchedPairs,
          impact: matchResult.eventImpact,
          eventTitle: event.title,
          eventCountry: matchResult.eventCurrency,
          eventDate,
          notificationId: notification.id,
          status: 'DELIVERED',
        },
      });

      results.push({ channel: 'IN_APP', success: true });
    }
  } catch (err) {
    if (err.code === 'P2002') {
      results.push({ channel: 'IN_APP', skipped: true, reason: 'ALREADY_DELIVERED' });
    } else {
      console.error(`[EconomicAlerts] Failed in-app dispatch to user ${user.id}:`, err);
      results.push({ channel: 'IN_APP', success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Core alert processing engine
 * Sweeps upcoming economic events and dispatches notifications for matching user preferences
 */
async function processEconomicAlerts(referenceTime = new Date()) {
  const now = referenceTime.getTime();
  
  // 1. Fetch all active user alert configurations (Server-side Global ON/OFF enforced)
  const activePreferences = await prisma.economicNewsAlertPreference.findMany({
    where: { isEnabled: true },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          timezone: true,
          isDisabled: true,
        },
      },
    },
  });

  if (activePreferences.length === 0) {
    return { evaluatedUsers: 0, dispatchedAlerts: 0 };
  }

  // 2. Fetch upcoming events (next 25 hours to cover 24h lead time)
  const events = await calendarService.getEvents();
  if (!events || events.length === 0) {
    return { evaluatedUsers: activePreferences.length, dispatchedAlerts: 0 };
  }

  let totalDispatches = 0;

  // Filter events within future window: up to 25 hours
  const futureEvents = events.filter((e) => {
    if (!e.date) return false;
    const eventTime = new Date(e.date).getTime();
    return eventTime > now && eventTime <= now + 25 * 60 * 60 * 1000;
  });

  for (const pref of activePreferences) {
    const user = pref.user;
    if (!user || user.isDisabled) continue;

    const userLeadTimes = Array.isArray(pref.leadTimesMinutes) && pref.leadTimesMinutes.length > 0
      ? pref.leadTimesMinutes
      : [30];

    for (const event of futureEvents) {
      const eventTime = new Date(event.date).getTime();
      const diffMinutes = Math.floor((eventTime - now) / 60000);

      if (diffMinutes <= 0) continue; // Event already passed or currently live

      // Check if this event qualifies for any configured lead times
      // Trigger alert window: within 4 minutes of lead threshold
      for (const leadTime of userLeadTimes) {
        const isWithinWindow = diffMinutes <= leadTime && diffMinutes >= Math.max(0, leadTime - 4);

        if (isWithinWindow) {
          const matchResult = matchEventToUserPreferences(event, pref);
          if (matchResult.matched) {
            const dispatchResults = await dispatchAlertToUser({
              user,
              preference: pref,
              event,
              matchResult,
              leadMinutes: leadTime,
            });

            const successCount = dispatchResults.filter(r => r.success).length;
            totalDispatches += successCount;
          }
        }
      }
    }
  }

  return {
    evaluatedUsers: activePreferences.length,
    evaluatedEvents: futureEvents.length,
    dispatchedAlerts: totalDispatches,
  };
}

/**
 * Retrieves past economic news alert history for a user
 */
async function getUserAlertHistory(userId, { limit = 30, offset = 0 } = {}) {
  if (!userId) throw new Error('User ID is required');

  const [logs, total] = await Promise.all([
    prisma.economicNewsAlertLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 30, 100),
      skip: Number(offset) || 0,
    }),
    prisma.economicNewsAlertLog.count({
      where: { userId },
    }),
  ]);

  return { logs, total };
}

module.exports = {
  DEFAULT_PREFERENCE,
  getUserAlertPreferences,
  updateUserAlertPreferences,
  toggleGlobalAlerts,
  dispatchAlertToUser,
  processEconomicAlerts,
  getUserAlertHistory,
  formatReleaseTime,
  formatLeadTimeString,
};
