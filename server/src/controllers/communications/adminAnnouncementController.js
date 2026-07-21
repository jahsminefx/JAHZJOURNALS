const announcementService = require('../../services/communications/announcementService');

exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await announcementService.getAllAnnouncements();
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const adminId = req.user.id;
    const data = req.body;

    if (!data.title || !data.content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const announcement = await announcementService.createAnnouncement(data, adminId);
    res.status(201).json({ message: 'Announcement created', announcement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updated = await announcementService.updateAnnouncement(id, data);
    res.json({ message: 'Announcement updated', updated });
  } catch (error) {
    console.error('Error patching announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await announcementService.deleteAnnouncement(id);
    res.json({ message: 'Announcement successfully deleted' });
  } catch (error) {
    console.error('Error erasing annoucement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
};
