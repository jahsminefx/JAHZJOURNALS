const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');

// Weekly Journal Reminder Trigger
const startSchedulers = () => {
  // Fire every Friday at 4PM GMT
  cron.schedule('0 16 * * 5', async () => {
    console.log('[CRON] Executing Weekly Review Dispatcher');
    try {
      const activeUsers = await prisma.user.findMany({
        where: { isDisabled: false, emailVerified: true },
        select: { email: true, name: true }
      });

      for (const user of activeUsers) {
        // Enact asynchronous email delivery pipeline
        await sendEmail({
          email: user.email,
          subject: 'Weekly Review Reminder - JahzJournals',
          message: `Hi ${user.name}, the markets are closing. Time to run your weekly trade reflections to secure your statistical edge for next week. Log into your dashboard to execute your review.`
        }).catch(err => console.warn(`Failed to send reminder to ${user.email}:`, err));
      }

      console.log(`[CRON] Dispatched reminders to ${activeUsers.length} traders.`);
    } catch (error) {
      console.error('[CRON] Error during weekly review dispatch:', error);
    }
  });
};

module.exports = { startSchedulers };
