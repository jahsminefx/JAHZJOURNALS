const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/notifications - Get all notifications for current logged-in user
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user recipients with full notification details
    const recipients = await prisma.notificationRecipient.findMany({
      where: { userId },
      include: {
        notification: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Also fetch global notifications that might not have recipient rows yet
    const globalNotifications = await prisma.notification.findMany({
      where: {
        isGlobal: true,
        recipients: {
          none: { userId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Create recipient records for any newly discovered global notifications
    if (globalNotifications.length > 0) {
      await prisma.notificationRecipient.createMany({
        data: globalNotifications.map(n => ({
          notificationId: n.id,
          userId,
          status: 'UNREAD',
        })),
        skipDuplicates: true,
      });

      // Refetch
      const updatedRecipients = await prisma.notificationRecipient.findMany({
        where: { userId },
        include: {
          notification: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const unreadCount = updatedRecipients.filter(r => r.status === 'UNREAD').length;
      return res.json({ notifications: updatedRecipients, unreadCount });
    }

    const unreadCount = recipients.filter(r => r.status === 'UNREAD').length;
    res.json({ notifications: recipients, unreadCount });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// PUT /api/notifications/:id/read - Mark single notification as read
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const recipient = await prisma.notificationRecipient.findFirst({
      where: { id, userId }
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const updated = await prisma.notificationRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
      include: { notification: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
};

// PUT /api/notifications/read-all - Mark all user notifications as read
const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notificationRecipient.updateMany({
      where: { userId, status: 'UNREAD' },
      data: {
        status: 'READ',
        readAt: new Date(),
      }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
};

// DELETE /api/notifications/:id - Delete a notification recipient record
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const recipient = await prisma.notificationRecipient.findFirst({
      where: { id, userId }
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await prisma.notificationRecipient.delete({
      where: { id: recipient.id }
    });

    res.json({ message: 'Notification removed successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};

module.exports = {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
