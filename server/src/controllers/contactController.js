const crypto = require('crypto');
const contactService = require('../services/communications/contactService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanString = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const hashIp = (ip) => {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(`${ip}:${process.env.CONTACT_IP_HASH_SECRET || process.env.JWT_SECRET || 'jahzjournals'}`)
    .digest('hex');
};

// Create new contact message / support inquiry
const createContactMessage = async (req, res) => {
  try {
    const name = cleanString(req.body.name, 120);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const subject = cleanString(req.body.subject, 160);
    const message = cleanString(req.body.message, 5000);
    const website = cleanString(req.body.website, 200);
    const category = cleanString(req.body.category, 50) || 'GENERAL';
    const priority = cleanString(req.body.priority, 50) || 'NORMAL';
    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];

    // Honeypot check
    if (website) {
      return res.status(202).json({ message: 'Your message was received safely.' });
    }

    const errors = [];
    if (!name) errors.push({ field: 'name', message: 'Please tell us your name.' });
    if (!emailPattern.test(email)) errors.push({ field: 'email', message: 'A valid email helps us reply.' });
    if (!subject) errors.push({ field: 'subject', message: 'Please include a subject.' });
    if (message.length < 5) errors.push({ field: 'message', message: 'Please provide a bit more detail.' });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'We couldn\'t submit your message.',
        errors,
      });
    }

    const contactMessage = await contactService.createMessage({
      name,
      email,
      subject,
      message,
      category,
      priority,
      attachments,
      userId: req.user?.id || null,
      ipHash: hashIp(req.ip),
    });

    res.status(201).json({
      success: true,
      message: 'Thank you. Your message has been received.',
      id: contactMessage.id,
      thread: contactMessage,
    });
  } catch (error) {
    console.error('Error creating contact message:', error);
    res.status(500).json({ message: 'We hit a snag sending your message.' });
  }
};

// Get support threads for current logged-in user
const getUserSupportThreads = async (req, res) => {
  try {
    const userId = req.user.id;
    const threads = await contactService.getUserMessages(userId);
    res.json(threads);
  } catch (error) {
    console.error('Error fetching user support threads:', error);
    res.status(500).json({ message: 'Failed to fetch support threads' });
  }
};

// Get single user support thread detail
const getUserSupportThreadById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const thread = await contactService.getMessageThread(id);
    if (!thread) {
      return res.status(404).json({ message: 'Support thread not found' });
    }

    // Verify ownership (unless user is admin)
    if (thread.userId && thread.userId !== userId && !['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized to view this support thread' });
    }

    // Clear unread counter for user
    await contactService.markThreadAsRead(id, 'USER');

    res.json(thread);
  } catch (error) {
    console.error('Error fetching support thread details:', error);
    res.status(500).json({ message: 'Failed to fetch support thread details' });
  }
};

// User replies to an existing thread
const postUserReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Reply message cannot be empty' });
    }

    const reply = await contactService.addUserReply(id, userId, message.trim(), attachments || []);
    res.json({ success: true, message: 'Reply sent', data: reply });
  } catch (error) {
    console.error('Error posting user reply:', error);
    res.status(500).json({ message: error.message || 'Failed to post reply' });
  }
};

module.exports = {
  createContactMessage,
  getUserSupportThreads,
  getUserSupportThreadById,
  postUserReply,
};
