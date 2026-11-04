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

// Get or create active support conversation for current logged-in user
const getMySupportThread = async (req, res) => {
  try {
    const userId = req.user.id;
    const thread = await contactService.getOrCreateUserSupportThread(userId);

    // If caller is user, mark as read for user
    if (thread.unreadForUser > 0) {
      await contactService.markThreadAsRead(thread.id, 'USER');
      thread.unreadForUser = 0;
    }

    res.json(thread);
  } catch (error) {
    console.error('Error fetching/creating user support thread:', error);
    res.status(500).json({ message: 'Failed to access support conversation' });
  }
};

// Get support threads for current logged-in user (or all threads if Super Admin / Admin)
const getUserSupportThreads = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role);

    if (isAdmin && (req.query.all === 'true' || req.query.adminView === 'true')) {
      const { status, search, priority, category } = req.query;
      const threads = await contactService.getMessages({ status, search, priority, category });
      return res.json(threads);
    }

    const threads = await contactService.getUserMessages(userId);
    res.json(threads);
  } catch (error) {
    console.error('Error fetching user support threads:', error);
    res.status(500).json({ message: 'Failed to fetch support threads' });
  }
};

// Get single support thread detail
const getUserSupportThreadById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role);

    const thread = await contactService.getMessageThread(id);
    if (!thread) {
      return res.status(404).json({ message: 'Support thread not found' });
    }

    // Verify ownership (unless user is admin)
    if (thread.userId && thread.userId !== userId && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to view this support thread' });
    }

    // Clear unread counter appropriately
    if (isAdmin) {
      await contactService.markThreadAsRead(id, 'ADMIN');
      thread.unreadForAdmin = 0;
    } else {
      await contactService.markThreadAsRead(id, 'USER');
      thread.unreadForUser = 0;
    }

    res.json(thread);
  } catch (error) {
    console.error('Error fetching support thread details:', error);
    res.status(500).json({ message: 'Failed to fetch support thread details' });
  }
};

// Post reply to a specific thread (handles both user messages and admin replies seamlessly)
const postUserReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments, isInternal } = req.body;
    const userId = req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role);

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Reply message cannot be empty' });
    }

    let result;
    if (isAdmin) {
      result = await contactService.addReply(id, userId, message.trim(), attachments || [], Boolean(isInternal));
    } else {
      result = await contactService.addUserReply(id, userId, message.trim(), attachments || []);
    }

    res.json({ success: true, message: 'Reply sent', data: result?.data || result });
  } catch (error) {
    console.error('Error posting support reply:', error);
    res.status(500).json({ message: error.message || 'Failed to post reply' });
  }
};

// Post support message (convenience endpoint: auto-locates or creates thread if threadId not provided)
const postSupportMessage = async (req, res) => {
  try {
    const { message, threadId, attachments } = req.body;
    const userId = req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(req.user.role);

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    let targetThreadId = threadId;
    if (!targetThreadId) {
      const active = await contactService.getOrCreateUserSupportThread(userId);
      targetThreadId = active.id;
    }

    let result;
    if (isAdmin) {
      result = await contactService.addReply(targetThreadId, userId, message.trim(), attachments || [], false);
    } else {
      result = await contactService.addUserReply(targetThreadId, userId, message.trim(), attachments || []);
    }

    res.json({ success: true, message: 'Message delivered', data: result?.data || result, threadId: targetThreadId });
  } catch (error) {
    console.error('Error delivering support message:', error);
    res.status(500).json({ message: error.message || 'Failed to deliver message' });
  }
};


// Trader-facing ticket submission
const createSupportTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, description, category = 'GENERAL', priority = 'NORMAL', attachments = [] } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Please provide a subject for your ticket.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Please provide a detailed description of the issue.' });
    }

    const ticketCount = await prisma.supportTicket.count();
    const ticketNumber = `TK-${1000 + ticketCount + 1}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        ticketNumber,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true, email: true, subscriptionPlan: true } }
      }
    });

    // Bridge directly to active user support thread
    try {
      const thread = await contactService.getOrCreateUserSupportThread(userId);
      await contactService.addUserReply(
        thread.id,
        userId,
        `🎫 **[Formal Ticket #${ticketNumber}]**\n**Subject:** ${subject.trim()}\n**Category:** ${category} | **Priority:** ${priority}\n\n${description.trim()}`,
        attachments || []
      );
    } catch (bridgeErr) {
      console.warn('Could not bridge ticket to chat thread:', bridgeErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Formal Support Ticket #${ticketNumber} created successfully.`,
      ticket,
      ticketNumber,
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ message: 'Failed to create support ticket' });
  }
};

const getMySupportTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error('Error loading my support tickets:', error);
    res.status(500).json({ message: 'Failed to load tickets' });
  }
};

module.exports = {
  createSupportTicket,
  getMySupportTickets,
  createContactMessage,
  getMySupportThread,
  getUserSupportThreads,
  getUserSupportThreadById,
  postUserReply,
  postSupportMessage,
};
