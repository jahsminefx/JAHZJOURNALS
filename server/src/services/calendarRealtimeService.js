const calendarService = require('./calendarService');

const MAX_SSE_CLIENTS = 500;
const HEARTBEAT_INTERVAL_MS = 25000;
const clients = new Set();

let watcherTimer = null;
let watcherErrorCount = 0;
let watcherInFlight = false;

/**
 * Computes how frequently the shared server-side watcher checks for fresh actuals:
 * - High-impact window [-10s, +5m] without actual: 2s
 * - Medium-impact window [-10s, +5m] without actual: 5s
 * - Otherwise: 60s (or wakes sooner right when an upcoming event reaches -10s)
 */
function computeWatcherIntervalMs(events = [], nowMs = Date.now(), errorCount = 0) {
  let hasHighWindow = false;
  let hasMediumWindow = false;
  let nearestUpcomingLeadMs = Infinity;

  for (const ev of events) {
    if (!ev || !ev.date || ev.impact === 'Holiday') continue;
    const hasActual = Boolean(ev.actual && String(ev.actual).trim() !== '');
    if (hasActual) continue;

    const scheduledMs = new Date(ev.date).getTime();
    if (Number.isNaN(scheduledMs)) continue;

    const diffFromScheduled = nowMs - scheduledMs;
    const inReleaseWindow = diffFromScheduled >= -10 * 1000 && diffFromScheduled <= 5 * 60 * 1000;

    if (inReleaseWindow) {
      if (ev.impact === 'High') {
        hasHighWindow = true;
        break;
      }
      if (ev.impact === 'Medium') {
        hasMediumWindow = true;
      }
    } else if (diffFromScheduled < -10 * 1000 && (ev.impact === 'High' || ev.impact === 'Medium')) {
      const msUntilWindowStart = scheduledMs - 10 * 1000 - nowMs;
      if (msUntilWindowStart > 0 && msUntilWindowStart < nearestUpcomingLeadMs) {
        nearestUpcomingLeadMs = msUntilWindowStart;
      }
    }
  }

  const mult = Math.min(8, Math.pow(2, Math.max(0, errorCount)));

  if (hasHighWindow) {
    return Math.min(60000, 2000 * mult);
  }

  if (hasMediumWindow) {
    return Math.min(60000, 5000 * mult);
  }

  const normalInterval = Math.min(300000, 60000 * mult);
  if (errorCount === 0 && nearestUpcomingLeadMs < normalInterval) {
    return Math.max(1000, nearestUpcomingLeadMs);
  }

  return normalInterval;
}

function stopReleaseWatcher() {
  if (watcherTimer) {
    clearTimeout(watcherTimer);
    watcherTimer = null;
  }
  watcherErrorCount = 0;
}

function broadcastActualUpdates(payload, targetClients = clients) {
  if (!payload || !targetClients || targetClients.size === 0) {
    return 0;
  }

  const frame = `event: actuals_updated\ndata: ${JSON.stringify(payload)}\n\n`;
  let delivered = 0;

  for (const res of Array.from(targetClients)) {
    if (!res || res.writableEnded || res.destroyed) {
      targetClients.delete(res);
      continue;
    }
    try {
      res.write(frame);
      delivered += 1;
    } catch {
      targetClients.delete(res);
    }
  }

  if (targetClients === clients && clients.size === 0) {
    stopReleaseWatcher();
  }

  return delivered;
}

function scheduleNextWatcherTick() {
  if (clients.size === 0) {
    stopReleaseWatcher();
    return;
  }

  if (watcherTimer) {
    clearTimeout(watcherTimer);
    watcherTimer = null;
  }

  const snapshot = calendarService.getCachedEventsSnapshot();
  const delay = computeWatcherIntervalMs(snapshot, Date.now(), watcherErrorCount);

  watcherTimer = setTimeout(async () => {
    watcherTimer = null;
    if (clients.size === 0 || watcherInFlight) {
      if (clients.size > 0) scheduleNextWatcherTick();
      return;
    }

    watcherInFlight = true;
    try {
      await calendarService.fetchCalendarEvents(true);
      watcherErrorCount = 0;
    } catch {
      watcherErrorCount += 1;
    } finally {
      watcherInFlight = false;
      if (clients.size > 0) {
        scheduleNextWatcherTick();
      }
    }
  }, delay);

  watcherTimer.unref?.();
}

function ensureWatcherRunning() {
  if (clients.size > 0 && !watcherTimer && !watcherInFlight) {
    scheduleNextWatcherTick();
  }
}

// Subscribe once to shared calendar actual-update notifications
calendarService.subscribeToActualUpdates((payload) => {
  broadcastActualUpdates(payload);
});

function handleCalendarStream(req, res) {
  if (clients.size >= MAX_SSE_CLIENTS) {
    return res.status(503).json({
      success: false,
      message: 'Calendar live stream capacity reached. Please retry shortly.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  clients.add(res);

  const lastFetched = calendarService.getLastFetchedAt();
  try {
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        syncedAt: lastFetched ? new Date(lastFetched).toISOString() : new Date().toISOString(),
        activeClients: clients.size,
      })}\n\n`
    );
  } catch {
    clients.delete(res);
    return;
  }

  const heartbeatTimer = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      cleanup();
      return;
    }
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeatTimer);
    clients.delete(res);
    if (clients.size === 0) {
      stopReleaseWatcher();
    }
  }

  req.on('close', cleanup);
  res.on?.('close', cleanup);

  ensureWatcherRunning();
}

function getRealtimeStats() {
  return {
    activeClients: clients.size,
    watcherActive: Boolean(watcherTimer),
    watcherErrorCount,
  };
}

module.exports = {
  MAX_SSE_CLIENTS,
  computeWatcherIntervalMs,
  broadcastActualUpdates,
  handleCalendarStream,
  stopReleaseWatcher,
  getRealtimeStats,
};
