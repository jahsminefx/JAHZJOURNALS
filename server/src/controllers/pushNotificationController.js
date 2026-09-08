const pushNotificationService = require('../services/pushNotificationService');
const reminderSchedulerService = require('../services/reminderSchedulerService');

exports.getPublicKey = async (req, res) => {
    try {
        const publicKey = pushNotificationService.getVapidPublicKey();
        if (!publicKey) {
            return res.status(500).json({ error: 'Push notification VAPID keys not configured.' });
        }
        res.json({ publicKey });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve public key', message: err.message });
    }
};

exports.subscribe = async (req, res) => {
    try {
        const userId = req.user.id;
        const subscriptionData = req.body;
        const userAgent = req.headers['user-agent'] || '';

        if (!subscriptionData || !subscriptionData.endpoint || !subscriptionData.keys) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid push subscription payload.' });
        }

        const record = await pushNotificationService.subscribeUser(userId, subscriptionData, userAgent);
        res.status(201).json({ message: 'Push notification subscription active.', subscription: record });
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.unsubscribe = async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ error: 'Bad Request', message: 'Endpoint is required.' });
        }

        await pushNotificationService.unsubscribeUser(endpoint);
        res.json({ message: 'Push subscription removed successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.sendTest = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pushNotificationService.sendPushToUser(userId, {
            title: '🎉 Web Push Notifications Active!',
            message: 'Your browser is successfully configured to receive instant trade alerts and market updates from JahzJournal.',
            url: '/dashboard',
            category: 'TEST'
        });

        if (result.sent === 0) {
            return res.status(400).json({
                error: 'No Active Subscription',
                message: 'No active push subscriptions found for your account. Please enable push notifications on your browser first.'
            });
        }

        res.json({ message: 'Test push notification dispatched successfully!', result });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.triggerDailyReminders = async (req, res) => {
    try {
        const { title, message } = req.body;
        const result = await reminderSchedulerService.triggerDailyRemindersNow(title, message);
        res.json({ message: 'Daily trading reminders dispatched successfully.', result });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
