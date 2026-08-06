const announcementService = require('../services/communications/announcementService');

// GET /api/announcements - Get active published announcements for current user
const getUserAnnouncements = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const announcements = await announcementService.getActiveAnnouncementsForUser(userId);
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching user announcements:', error);
    res.status(500).json({ message: 'Failed to fetch announcements' });
  }
};

module.exports = {
  getUserAnnouncements,
};
