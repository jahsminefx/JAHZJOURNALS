const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendWeeklyReviewReminderEmail } = require('../services/emailService');

// Weekly Journal Reminder Trigger
const startSchedulers = () => {
  // Fire every Friday at 4PM GMT
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
