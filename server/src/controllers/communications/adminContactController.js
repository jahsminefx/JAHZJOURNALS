const contactService = require('../../services/communications/contactService');

exports.getContactMessages = async (req, res) => {
  try {
    const { status, search, assignedToId, priority, category } = req.query;
    const messages = await contactService.getMessages({ status, search, assignedToId, priority, category });
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
    
    // Clear unread counter for admin when thread is opened
    await contactService.markThreadAsRead(id, 'ADMIN');

    res.json(details);
  } catch (error) {
    console.error('Error fetching contact thread:', error);
    res.status(500).json({ error: 'Failed to fetch contact thread' });
  }
};

exports.replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments, isInternal } = req.body;
    const adminId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    const result = await contactService.addReply(
      id, 
      adminId, 
      message.trim(), 
      attachments || [], 
      Boolean(isInternal)
    );

    res.json({ message: isInternal ? 'Internal note added' : 'Reply sent successfully', data: result });
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
    res.json({ message: 'Status updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

exports.updateMessagePriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority) return res.status(400).json({ error: 'Priority is required' });

    const updated = await contactService.updatePriority(id, priority);
    res.json({ message: 'Priority updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
};

exports.updateMessageCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    if (!category) return res.status(400).json({ error: 'Category is required' });

    const updated = await contactService.updateCategory(id, category);
    res.json({ message: 'Category updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

exports.assignMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const assigned = await contactService.assignStaff(id, adminId);
    res.json({ message: 'Staff assigned successfully', data: assigned });
  } catch (error) {
    console.error('Error assigning staff:', error);
    res.status(500).json({ error: 'Failed to assign staff' });
  }
};

exports.bulkAction = async (req, res) => {
  try {
    const { messageIds, action, payload } = req.body;
    await contactService.bulkAction(messageIds, action, payload);
    res.json({ message: 'Bulk action performed successfully' });
  } catch (error) {
    console.error('Bulk processing error:', error);
    res.status(500).json({ error: 'Failed to process bulk action' });
  }
};
