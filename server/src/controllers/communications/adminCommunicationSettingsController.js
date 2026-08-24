const adminCommunicationSettingsService = require('../../services/communications/adminCommunicationSettingsService');

exports.getSettings = async (req, res) => {
  try {
    const data = await adminCommunicationSettingsService.getSettings();
    res.json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch communication settings' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const updated = await adminCommunicationSettingsService.updateSettings(req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update communication settings' });
  }
};

exports.testBrevoConnection = async (req, res) => {
  try {
    const result = await adminCommunicationSettingsService.testBrevoConnection();
    if (result.success !== false) {
      res.json({ message: 'Test Email Sent via Brevo API', result });
    } else {
      res.status(400).json({ error: result.error || 'Test Email Failed', result });
    }
  } catch (error) {
    console.error('Error testing Brevo connection:', error);
    res.status(500).json({ error: 'Test Email Failed' });
  }
};
