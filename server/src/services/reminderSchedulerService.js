const { sendPushToAll } = require('./pushNotificationService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let lastRunDate = null;

/**
 * Dispatches daily push notification reminders to all traders with active browser push subscriptions.
 */
async function triggerDailyRemindersNow(customTitle, customMessage) {
    try {
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
 * Initializes the automated background timer that checks daily at 08:00 AM
 */
function initDailyReminderScheduler() {
    console.log('Initializing Daily Trading Reminder Scheduler (Runs daily at 08:00 AM)...');

    // Run interval check every 30 minutes
    setInterval(async () => {
        const now = new Date();
        const currentDateStr = now.toISOString().split('T')[0];
        const currentHour = now.getHours();

        // Trigger once per day around 8 AM
        if (currentHour >= 8 && lastRunDate !== currentDateStr) {
            lastRunDate = currentDateStr;
            await triggerDailyRemindersNow();
        }
    }, 30 * 60 * 1000);
}

module.exports = {
    triggerDailyRemindersNow,
    initDailyReminderScheduler
};
