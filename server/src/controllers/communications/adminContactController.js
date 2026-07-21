const contactService = require('../../services/communications/contactService');

exports.getContactMessages = async (req, res) => {
  try {
    const { status, search, assignedToId } = req.query;
    const messages = await contactService.getMessages({ status, search, assignedToId });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({ error: 'Failed to fetch contact messages' });
  }
};

exports.getContactThread = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await contactService.getMessageThread(id);
    if (!details) return res.status(404).json({ error: 'Message not found' });
    res.json(details);
  } catch (error) {
    console.error('Error fetching contact thread:', error);
    res.status(500).json({ error: 'Failed to fetch contact thread' });
  }
};

exports.replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.user.id;

    if (!message) return res.status(400).json({ error: 'Reply text is required' });

    const thread = await contactService.addReply(id, adminId, message);
    res.json({ message: 'Reply sent successfully', thread });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
};

exports.updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const updated = await contactService.updateStatus(id, status);
    res.json({ message: 'Status updated', data: updated });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

exports.assignMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const assigned = await contactService.assignStaff(id, adminId);
    res.json({ message: 'Message assigned contextually', data: assigned });
  } catch (error) {
    console.error('Error mapping staff:', error);
    res.status(500).json({ error: 'Failed to assign staff' });
  }
};

exports.bulkAction = async (req, res) => {
  try {
    const { messageIds, action, payload } = req.body;
    await contactService.bulkAction(messageIds, action, payload);
    res.json({ message: 'Bulk action performed' });
  } catch (error) {
    console.error('Bulk processing error:', error);
    res.status(500).json({ error: 'Failed to process bulk action' });
  }
};
