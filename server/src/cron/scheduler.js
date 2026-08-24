const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendWeeklyReviewReminderEmail } = require('../services/emailService');
const { cleanupStalledAiRequests } = require('../controllers/aiController');

// Schedulers & Background Sweepers
const startSchedulers = () => {
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
};

module.exports = { startSchedulers };
