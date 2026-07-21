const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');

const _defaultConfigs = {
   LAUNCH_SETTINGS: {
      launchMode: false,
      maintenanceMode: false,
      registrationEnabled: true
   },
   AUTH_SETTINGS: {
      emailVerificationRequired: true,
      twoFactorRequired: false,
      sessionTimeout: '24h',
      maxLoginAttempts: 5
   },
   SECURITY_SETTINGS: {
      rateLimits: true,
      auditLogRetentionDays: 90,
      ipLockoutThreshold: 10
   },
   INTEGRATIONS_CONFIG: {
      cloudinaryConnected: !!process.env.CLOUDINARY_URL,
      openrouterConnected: !!process.env.OPENROUTER_API_KEY,
      paystackConnected: !!process.env.PAYSTACK_SECRET_KEY,
      redisActive: true
   }
};

const getPlatformConfig = async (req, res) => {
    try {
        const configs = await prisma.systemConfig.findMany();
        const configMap = {};
        
        configs.forEach(c => {
           configMap[c.key] = c.value;
        });

        // Ensure defaults are populated if not initialized
        Object.keys(_defaultConfigs).forEach(key => {
            if (!configMap[key]) {
                configMap[key] = _defaultConfigs[key];
            }
        });

        res.json(configMap);
    } catch (e) {
        res.status(500).json({ message: 'Failed fetching platform config trees' });
    }
};

const updatePlatformConfig = async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || !value) return res.status(400).json({ message: 'Key and Value arrays required natively' });

        const oldNode = await prisma.systemConfig.findUnique({ where: { key } });

        const updated = await prisma.systemConfig.upsert({
            where: { key },
            update: { value, updatedBy: req.user.id },
            create: { key, value, updatedBy: req.user.id }
        });

        await logAudit({
            adminId: req.user.id,
            action: 'PLATFORM_CONFIG_UPSERT',
            resource: 'SystemConfig',
            resourceId: key,
            oldValue: oldNode ? JSON.stringify(oldNode.value) : 'NEW_ALLOCATION',
            newValue: JSON.stringify(value),
            ipAddress: req.ip
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ message: 'Config mutation crashed explicitly' });
    }
};

const getPlatformDashboard = async (req, res) => {
    try {
        const configs = await prisma.systemConfig.findMany({
           where: { key: { in: ['LAUNCH_SETTINGS', 'AUTH_SETTINGS'] } }
        });

        let launch = _defaultConfigs.LAUNCH_SETTINGS;
        let auth = _defaultConfigs.AUTH_SETTINGS;

        configs.forEach(c => {
           if (c.key === 'LAUNCH_SETTINGS') launch = c.value;
           if (c.key === 'AUTH_SETTINGS') auth = c.value;
        });

        const userCount = await prisma.user.count();
        const queueStatus = "ACTIVE"; // BullMQ abstract map over

        res.json({
            launchModeEnabled: launch.launchMode,
            maintenanceMode: launch.maintenanceMode,
            registrationEnabled: launch.registrationEnabled,
            authStrictness: auth.emailVerificationRequired ? 'STRICT' : 'PERMISSIVE',
            userCount,
            queueStatus
        });
    } catch (e) {
        res.status(500).json({ message: 'Platform dashboard compilation yielded errors' });
    }
};

const exportConfig = async (req, res) => {
    try {
        const configs = await prisma.systemConfig.findMany();
        await logAudit({
            adminId: req.user.id,
            action: 'PLATFORM_EXPORT_CONFIG',
            resource: 'SystemConfig',
            ipAddress: req.ip
        });
        res.json({ exportedAt: new Date().toISOString(), configs });
    } catch (e) {
        res.status(500).json({ message: 'JSON export array failure' });
    }
};

const getConfigHistory = async (req, res) => {
    try {
        const history = await prisma.auditLog.findMany({
            where: { action: 'PLATFORM_CONFIG_UPSERT' },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(history);
    } catch (e) {
        res.status(500).json({ message: 'History retrieval crashed' });
    }
};

module.exports = {
   getPlatformConfig,
   updatePlatformConfig,
   getPlatformDashboard,
   exportConfig,
   getConfigHistory
};
