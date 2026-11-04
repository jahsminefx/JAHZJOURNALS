const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendWeeklyReviewReminderEmail } = require('../services/emailService');
const { cleanupStalledAiRequests } = require('../controllers/aiController');
const { syncAllCloudAccounts } = require('../controllers/mtCloudSyncController');
const { startSubscriptionCron } = require('../services/subscriptionCron');
const { sendWeeklyExecutiveDigest } = require('../services/executiveDigestService');
const { triggerAlertSweepJob } = require('../jobs/queues/economicAlertQueue');

// Schedulers & Background Sweepers
const startSchedulers = () => {
  // Start automated promotion & subscription expiration sweeper
  startSubscriptionCron();

  // Initial sweep on server startup for orphan requests left in QUEUED/PROCESSING
  cleanupStalledAiRequests(null, 60000).catch(err => {
    console.warn('[CRON] Initial AI cleanup warning:', err?.message || err);
  });

  // Stalled AI Request Auto-Sweeper - Runs every minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      const count = await cleanupStalledAiRequests(null, 60000);
      if (count > 0) {
        console.log(`[CRON] Swept and expired ${count} stalled AI generation request(s).`);
      }
    } catch (error) {
      console.error('[CRON] Error during stalled AI request cleanup:', error);
    }
  });

  // ── MetaTrader Cloud Auto-Sync ── Runs every 5 minutes ──
  // Automatically syncs new trades from all connected MT4/MT5 accounts
  // Picks up new trades, closed trades, and open positions
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await syncAllCloudAccounts();
      if (result.totalAccounts > 0 && (result.totalImported > 0 || result.totalEnriched > 0)) {
        console.log(`[CRON] MT Auto-Sync: ${result.totalImported} imported, ${result.totalEnriched} enriched across ${result.totalAccounts} accounts`);
      }
    } catch (error) {
      console.error('[CRON] Error during MT cloud auto-sync:', error);
    }
  });

  // ── Economic News Alert Sweeper ── Runs every 2 minutes ──
  // Evaluates upcoming high/medium impact releases against user alert preferences
  cron.schedule('*/2 * * * *', async () => {
    try {
      const summary = await triggerAlertSweepJob();
      if (summary && summary.dispatchedAlerts > 0) {
        console.log(`[CRON] Dispatched ${summary.dispatchedAlerts} economic news alert(s) across ${summary.evaluatedUsers} active user preferences.`);
      }
    } catch (error) {
      console.error('[CRON] Error during economic alerts sweep:', error);
    }
  });

  // Weekly Journal Reminder Trigger - Friday 4PM GMT
  cron.schedule('0 16 * * 5', async () => {
    console.log('[CRON] Executing Weekly Review Dispatcher');
    try {
      const activeUsers = await prisma.user.findMany({
        where: { isDisabled: false, emailVerified: true },
        select: { id: true, email: true, name: true }
      });

      for (const user of activeUsers) {
        await sendWeeklyReviewReminderEmail(user).catch(err => {
          console.warn(`Failed to send reminder to ${user.email}:`, err?.message || err);
        });
      }

      console.log(`[CRON] Dispatched reminders to ${activeUsers.length} traders.`);
    } catch (error) {
      console.error('[CRON] Error during weekly review dispatch:', error);
    }
  });

  // ── Weekly Automated Executive Digest ── Monday 08:00 AM UTC ──
  // Dispatches platform briefing (signups, trade volume, revenue, health) to Super Admin
  cron.schedule('0 8 * * 1', async () => {
    console.log('[CRON] Executing Weekly Automated Executive Digest Dispatcher');
    try {
      const result = await sendWeeklyExecutiveDigest();
      console.log(`[CRON] Weekly Executive Digest completed. Recipient: ${result.recipient}, Success: ${result.success}`);
    } catch (error) {
      console.error('[CRON] Error during weekly executive digest dispatch:', error);
    }
  });
};

module.exports = { startSchedulers };
