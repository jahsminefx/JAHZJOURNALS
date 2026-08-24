const emailCampaignService = require('../../services/communications/emailCampaignService');

exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await emailCampaignService.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch email campaigns' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const { title, subject, contentHtml, segment } = req.body;
    if (!title || !subject || !contentHtml) {
      return res.status(400).json({ error: 'Title, subject, and content are required' });
    }
    const campaign = await emailCampaignService.createCampaign({ title, subject, contentHtml, segment });
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create email campaign' });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await emailCampaignService.sendCampaign(id);
    res.json({ message: 'Campaign dispatched successfully', campaign });
  } catch (error) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ error: error.message || 'Failed to send campaign' });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    await emailCampaignService.deleteCampaign(id);
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
};
