const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const notificationService = {
  async getAdminNotifications() {
    // Specifically returning system/manual notifications that track globally
    return prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { recipients: true }
        }
      }
    });
  },

  async sendManualNotification(title, message, userIds = [], category = 'INFO', senderId = null) {
    // 1. Create the base notification
    const notification = await prisma.notification.create({
      data: {
        type: 'MANUAL',
        category,
        title,
        message,
        isGlobal: userIds.length === 0,
        senderId,
      }
    });

    // 2. Attach target recipients
    if (userIds.length > 0) {
      const recipientData = userIds.map(uid => ({
        notificationId: notification.id,
        userId: uid,
        status: 'UNREAD'
      }));
      
      await prisma.notificationRecipient.createMany({
        data: recipientData
      });
    } else {
      // Global push to all users
      // Note: For 100k users, this should be done in a background job via BullMQ
      // Doing synchronously here as an MVP representation limits
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      const globalRecipients = allUsers.map(u => ({
        notificationId: notification.id,
        userId: u.id,
        status: 'UNREAD'
      }));

      await prisma.notificationRecipient.createMany({
        data: globalRecipients
      });
    }

    return notification;
  },

  async systemAlert(title, message, category = 'SYSTEM_ALERT') {
    // System alerts specifically sent to ADMINs
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true }
    });

    return this.sendManualNotification(title, message, admins.map(a => a.id), category, 'SYSTEM');
  }
};

module.exports = notificationService;
