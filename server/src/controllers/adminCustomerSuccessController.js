const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../services/auditService');

// Dashboard KPIs
const getSupportDashboard = async (req, res) => {
  try {
    const totalOpenTickets = await prisma.supportTicket.count({ where: { status: 'OPEN' } });
    const waitingAdmin = await prisma.supportTicket.count({ where: { status: 'PENDING' } });
    const waitingUser = await prisma.supportTicket.count({ where: { status: 'WAITING_ON_USER' } });
    const resolved = await prisma.supportTicket.count({ where: { status: 'RESOLVED' } });

    const newContacts = await prisma.contactMessage.count({ where: { status: 'NEW' } });
    const newBugs = await prisma.bugReport.count({ where: { status: 'NEW' } });
    const newFeatures = await prisma.featureRequest.count({ where: { status: 'UNDER_REVIEW' } });

    // Aggregate Ratings natively
    const ratedTickets = await prisma.supportTicket.aggregate({
      where: { rating: { not: null } },
      _avg: { rating: true }
    });

    res.json({
      kpis: {
        totalOpenTickets, waitingAdmin, waitingUser, resolved,
        newContacts, newBugs, newFeatures,
        averageSatisfaction: ratedTickets._avg.rating || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Dashboard generation failed' });
  }
};

// Ticket Management
const getSupportTickets = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (search) {
       where.OR = [
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } }
       ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where, skip: parseInt(skip), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, subscriptionPlan: true } } }
      }),
      prisma.supportTicket.count({ where })
    ]);

    res.json({ tickets, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Tickets retrieval failed' });
  }
};

const updateSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, rating, feedback } = req.body;

    const oldTicket = await prisma.supportTicket.findUnique({ where: { id } });
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status, priority, assignedTo, rating, feedback }
    });

    await logAudit({
      adminId: req.user.id,
      action: 'UPDATE_SUPPORT_TICKET',
      resource: 'SupportTicket',
      resourceId: id,
      oldValue: oldTicket.status,
      newValue: status,
      ipAddress: req.ip
    });

    res.json(ticket);
  } catch (e) {
    res.status(500).json({ message: 'Ticket update failed' });
  }
};

// Bug Reports
const getBugReports = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const where = status ? { status } : {};
    
    const [bugs, total] = await Promise.all([
      prisma.bugReport.findMany({
        where, skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { id: true, name: true, email: true } } }
      }),
      prisma.bugReport.count({ where })
    ]);
    res.json({ bugs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ message: 'Failed fetching bug reports' });
  }
};

const updateBugReport = async (req, res) => {
  try {
    const updated = await prisma.bugReport.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    await logAudit({
      adminId: req.user.id,
      action: 'UPDATE_BUG_REPORT',
      resource: 'BugReport',
      resourceId: req.params.id,
      newValue: req.body.status,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch(e) {
     res.status(500).json({ message: 'Failed mutating bug report' });
  }
};

// Feature Requests
const getFeatureRequests = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const where = status ? { status } : {};
    const [features, total] = await Promise.all([
      prisma.featureRequest.findMany({
        where, skip: (page - 1) * limit, take: parseInt(limit), orderBy: { votes: 'desc' },
        include: { user: { select: { name: true, email: true } } }
      }),
      prisma.featureRequest.count({ where })
    ]);
    res.json({ features, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ message: 'Failed fetching feature requests' });
  }
};

const updateFeatureRequest = async (req, res) => {
  try {
    const updated = await prisma.featureRequest.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    await logAudit({
      adminId: req.user.id,
      action: 'UPDATE_FEATURE_REQUEST',
      resource: 'FeatureRequest',
      resourceId: req.params.id,
      newValue: req.body.status,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch(e) {
     res.status(500).json({ message: 'Failed mutating feature request' });
  }
};

// Contact Messages mapped securely
const getContactMessages = async (req, res) => {
   try {
     const { page = 1, limit = 50 } = req.query;
     const [messages, total] = await Promise.all([
        prisma.contactMessage.findMany({ skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
        prisma.contactMessage.count()
     ]);
     res.json({ messages, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
   } catch (e) {
      res.status(500).json({ message: 'Failed tracking contact nodes' });
   }
};

// Internal Timelines & Notes
const getInternalUserTimeline = async (req, res) => {
   try {
      const { email } = req.query;
      const user = await prisma.user.findUnique({
         where: { email },
         include: {
            internalNotes: { orderBy: { createdAt: 'desc' } },
            supportTickets: { orderBy: { createdAt: 'desc' }, take: 15 },
            subscriptionHistories: { orderBy: { createdAt: 'desc' }, take: 10 }
         }
      });
      if (!user) return res.status(404).json({ message: 'Target not found' });
      res.json(user);
   } catch(e) {
      res.status(500).json({ message: 'Timeline parsing crashed' });
   }
};

const createInternalNote = async (req, res) => {
   try {
      const { userId, content } = req.body;
      const note = await prisma.internalNote.create({
         data: {
            userId,
            content,
            authorId: req.user.id
         }
      });
      res.json(note);
   } catch(e) {
      res.status(500).json({ message: 'Internal Note isolation rejected' });
   }
};

module.exports = {
  getSupportDashboard,
  getSupportTickets,
  updateSupportTicket,
  getBugReports,
  updateBugReport,
  getFeatureRequests,
  updateFeatureRequest,
  getContactMessages,
  getInternalUserTimeline,
  createInternalNote
};
