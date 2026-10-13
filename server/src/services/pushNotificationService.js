const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Load VAPID keys securely from environment variables or local gitignored config file
const keyFilePath = path.join(__dirname, '../../config/vapid_keys.json');

let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    if (fs.existsSync(keyFilePath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
            if (saved.publicKey && saved.privateKey) {
                vapidKeys.publicKey = saved.publicKey;
                vapidKeys.privateKey = saved.privateKey;
            }
        } catch (e) {
            console.error('Failed to read saved VAPID keys:', e);
        }
    }
}

// Fallback: If neither env nor saved file exists (e.g. initial dev setup), generate dynamically
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    try {
        const generated = webpush.generateVAPIDKeys();
        vapidKeys.publicKey = generated.publicKey;
        vapidKeys.privateKey = generated.privateKey;
        const configDir = path.dirname(keyFilePath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(keyFilePath, JSON.stringify(vapidKeys, null, 2), 'utf8');
        console.log('Generated and saved new VAPID keys to local config');
    } catch (e) {
        console.error('Failed to generate fallback VAPID keys:', e);
    }
}

const contactEmail = process.env.CONTACT_EMAIL || 'support@jahzjournal.com';
if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webpush.setVapidDetails(
        `mailto:${contactEmail}`,
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
}

function getVapidPublicKey() {
    return vapidKeys.publicKey;
}

async function subscribeUser(userId, subscriptionData, userAgent = '') {
    if (!subscriptionData || !subscriptionData.endpoint || !subscriptionData.keys) {
        throw new Error('Invalid push subscription format');
    }

    const { endpoint, keys } = subscriptionData;
    const { p256dh, auth } = keys;

    if (!p256dh || !auth) {
        throw new Error('Missing encryption keys (p256dh or auth)');
    }

    return await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: {
            userId,
            p256dh,
            auth,
            userAgent: userAgent || null,
            updatedAt: new Date()
        },
        create: {
            userId,
            endpoint,
            p256dh,
            auth,
            userAgent: userAgent || null
        }
    });
}

async function unsubscribeUser(endpoint) {
    if (!endpoint) return;
    try {
        await prisma.pushSubscription.deleteMany({
            where: { endpoint }
        });
    } catch (e) {
        console.error('Error removing push subscription:', e);
    }
}

async function sendPushToUser(userId, payload) {
    if (!userId) return { count: 0, sent: 0 };

    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        if (!subscriptions || subscriptions.length === 0) {
            return { count: 0, sent: 0 };
        }

        const pushData = typeof payload === 'string' ? payload : JSON.stringify(payload);
        let sentCount = 0;
        let lastError = null;

        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, pushData);
                sentCount++;
            } catch (err) {
                lastError = err.message || 'Push gateway rejected notification';
                console.error(`Web Push error for user ${userId} (status ${err.statusCode}):`, err.message);
                // If subscription expired, unregistered, or invalid key/signature (400, 401, 404, 410), delete stale record
                if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 400 || err.statusCode === 401) {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                }
            }
        }

        return { count: subscriptions.length, sent: sentCount, error: lastError };
    } catch (err) {
        console.error('Error sending push to user:', err);
        return { count: 0, sent: 0, error: err.message };
    }
}

async function sendPushToAll(payload, targetUserIds = []) {
    try {
        let subscriptions = [];
        if (targetUserIds && targetUserIds.length > 0) {
            subscriptions = await prisma.pushSubscription.findMany({
                where: { userId: { in: targetUserIds } }
            });
        } else {
            subscriptions = await prisma.pushSubscription.findMany({});
        }

        if (subscriptions.length === 0) return { count: 0, sent: 0 };

        const pushData = typeof payload === 'string' ? payload : JSON.stringify(payload);
        let sentCount = 0;
        let lastError = null;

        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, pushData);
                sentCount++;
            } catch (err) {
                lastError = err.message || 'Push gateway rejected notification';
                if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 400 || err.statusCode === 401) {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                }
            }
        }

        return { count: subscriptions.length, sent: sentCount, error: lastError };
    } catch (err) {
        console.error('Error sending push broadcast:', err);
        return { count: 0, sent: 0, error: err.message };
    }
}

module.exports = {
    getVapidPublicKey,
    subscribeUser,
    unsubscribeUser,
    sendPushToUser,
    sendPushToAll
};
