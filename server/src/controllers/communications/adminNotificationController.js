const notificationService = require('../../services/communications/notificationService');

exports.getAdminNotifications = async (req, res) => {
  try {
    // Gets internal system alerts and admin broadcast definitions
    const alerts = await notificationService.getAdminNotifications();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { title, message, category, userIds } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notification = await notificationService.sendManualNotification(title, message, userIds || [], category, adminId);
    res.status(201).json({ message: 'Notification scheduled explicitly', notification });
  } catch (error) {
    console.error('Failed pushing manual notification', error);
    res.status(500).json({ error: 'Failed dispatching notification' });
  }
};
