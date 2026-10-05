const cron = require('node-cron');
const { sendPushToAll } = require('./pushNotificationService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Dispatches daily push notification reminders to all traders with active browser push subscriptions.
 * Enforces database idempotency so it only executes once per calendar day.
 */
async function triggerDailyRemindersNow(customTitle, customMessage) {
    try {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setUTCHours(23, 59, 59, 999);

        // For automated runs, skip if daily reminder was already dispatched today
        if (!customTitle && !customMessage) {
            const alreadySentToday = await prisma.notification.findFirst({
                where: {
                    type: 'DAILY_REMINDER',
                    createdAt: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
            });

            if (alreadySentToday) {
                console.log('[Daily Reminder Scheduler] Daily reminder already dispatched today. Skipping.');
                return { count: 0, sent: 0, skipped: true };
            }
        }

        const title = customTitle || '📈 Daily Trading Sanctuary Check-in';
        const message = customMessage || 'Good morning, Trader! Plan your trades, execute with discipline, and log your setups on JahzJournal today.';
        const url = '/daily-review';

        console.log('[Daily Reminder Scheduler] Dispatching daily trading discipline push reminders...');
        const result = await sendPushToAll({
            title,
            message,
            url,
            category: 'DAILY_REMINDER',
            timestamp: new Date().toISOString()
        });

        // Record reminder broadcast as an in-app notification in DB
        try {
            const notif = await prisma.notification.create({
                data: {
                    type: 'DAILY_REMINDER',
                    category: 'REMINDER',
                    title,
                    message,
                    actionUrl: url,
                    isGlobal: true
                }
            });
            console.log(`[Daily Reminder Scheduler] Created DB notification #${notif.id}`);
        } catch (e) {
            console.error('Failed logging daily reminder to DB:', e);
        }

        console.log(`[Daily Reminder Scheduler] Dispatched to ${result.sent} active device subscriptions.`);
        return result;
    } catch (err) {
        console.error('[Daily Reminder Scheduler Error]:', err);
        return { count: 0, sent: 0, error: err.message };
    }
}

/**
 * Initializes the automated background cron job (Runs once daily at 08:00 AM UTC)
 */
function initDailyReminderScheduler() {
    console.log('Initializing Daily Trading Reminder Scheduler (Cron: 0 8 * * * - Daily at 08:00 AM)...');

    // Cron schedule at 08:00 AM UTC
    cron.schedule('0 8 * * *', async () => {
        await triggerDailyRemindersNow();
    });
}

module.exports = {
    triggerDailyRemindersNow,
    initDailyReminderScheduler
};

