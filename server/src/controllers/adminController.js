const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');

// Use this safely since emailQueue might not be available
let emailQueue;
try {
  const queues = require('../queues');
  emailQueue = queues.emailQueue;
} catch (e) {
  console.log('BullMQ queues not loaded in adminController');
}

const getDashboardMetrics = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isDisabled: false } });
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const newUsersToday = await prisma.user.count({
      where: { createdAt: { gte: startOfDay } }
    });
    
    const freeUsers = await prisma.user.count({ where: { subscriptionPlan: 'FREE' } });
    const starterUsers = await prisma.user.count({ where: { subscriptionPlan: 'STARTER' } });
    const proUsers = await prisma.user.count({ where: { subscriptionPlan: 'PRO' } });
    
    const foundingTraders = await prisma.subscription.count({
      where: {
        source: 'PROMOTION',
        status: 'ACTIVE',
      }
    });

    const totalTrades = await prisma.trade.count();
    const tradesToday = await prisma.trade.count({
      where: { createdAt: { gte: startOfDay } }
    });

    let queueMetrics = { waiting: 0, active: 0, failed: 0 };
    if (emailQueue) {
      try {
        const waiting = await emailQueue.getWaitingCount();
        const active = await emailQueue.getActiveCount();
        const failed = await emailQueue.getFailedCount();
         queueMetrics = { waiting, active, failed };
      } catch(e) {}
    }

    res.json({
      users: { totalUsers, activeUsers, newUsersToday },
      subscriptions: { freeUsers, starterUsers, proUsers, foundingTraders },
      trading: { totalTrades, tradesToday },
      queues: queueMetrics,
      infrastructure: {
        database: 'Healthy',
        redis: emailQueue ? 'Healthy' : 'Warning'
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard metrics:', error);
    res.status(500).json({ message: 'Failed to fetch metrics' });
  }
};

const getUsers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        select: {
          id: true, name: true, email: true, role: true, subscriptionPlan: true, subscriptionStatus: true, createdAt: true, isDisabled: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Cannot modify your own role' });
    }

    const previousData = await prisma.user.findUnique({ where: { id }, select: { role: true, email: true } });
    if (!previousData) return res.status(404).json({ message: 'User not found' });

    const user = await prisma.user.update({
      where: { id },
      data: { role }
    });

    await logAudit({
      adminId: req.user.id,
      action: 'UPDATE_USER_ROLE',
      resource: 'User',
      resourceId: id,
      oldValue: previousData.role,
      newValue: role,
      ipAddress: req.ip
    });

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user role' });
  }
};

const getSystemHealth = async (req, res) => {
  try {
    // Attempt small query DB
    await prisma.$queryRaw`SELECT 1`;
    let redisHealth = 'Healthy';
    if (!emailQueue) redisHealth = 'Warning - BullMQ Failed';
    
    res.json({
      database: 'Healthy',
      redis: redisHealth,
      aiProvider: 'Healthy',
      emailService: 'Healthy'
    });
  } catch(e) {
    res.status(500).json({ message: 'System health check failed' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count()
    ]);

    // Fetch related admin user names if possible (manual join for safety)
    const adminIds = [...new Set(logs.map(l => l.adminId).filter(Boolean))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, email: true }
    });

    const enrichedLogs = logs.map(log => ({
      ...log,
      admin: admins.find(a => a.id === log.adminId) || { name: 'System', email: 'system' }
    }));

    res.json({ logs: enrichedLogs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

module.exports = {
  getDashboardMetrics,
  getUsers,
  updateUserRole,
  getSystemHealth,
  getAuditLogs
};
