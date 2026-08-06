const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const contactService = {
  // Query threads for Admin Portal with filters & search
  async getMessages(filters = {}) {
    const { status, search, assignedToId, priority, category } = filters;
    
    const whereClause = {};

    if (status && status !== 'ALL') {
      if (status === 'UNASSIGNED') {
        whereClause.assignedToId = null;
      } else {
        whereClause.status = status;
      }
    }

    if (assignedToId) {
      whereClause.assignedToId = assignedToId;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (category) {
      whereClause.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.contactMessage.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { threads: true, internalNotes: true } }
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  },

  // Query threads submitted by a specific user
  async getUserMessages(userId) {
    return prisma.contactMessage.findMany({
      where: { userId },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        threads: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });
  },

  // Get full thread conversation & internal staff notes
  async getMessageThread(id) {
    const message = await prisma.contactMessage.findUnique({
      where: { id },
      include: {
        threads: { 
          orderBy: { createdAt: 'asc' } 
        },
        internalNotes: {
          include: { 
            author: { select: { id: true, name: true, email: true, role: true } } 
          },
          orderBy: { createdAt: 'asc' }
        },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    if (!message) return null;

    // Self-healing check: If initial thread record wasn't created yet, create it automatically
    if (message.threads.length === 0 && message.message) {
      const initialThread = await prisma.contactThread.create({
        data: {
          contactMessageId: message.id,
          senderType: 'USER',
          senderId: message.userId || null,
          senderName: message.name,
          senderEmail: message.email,
          message: message.message,
          createdAt: message.createdAt
        }
      });
      message.threads = [initialThread];
    }

    return message;
  },

  // Create new contact / support thread (from Contact Page or Floating Widget)
  async createMessage(data) {
    const { name, email, subject, message, userId, category = 'GENERAL', priority = 'NORMAL', attachments = [] } = data;

    const contact = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        category,
        priority,
        userId: userId || null,
        status: 'OPEN',
        unreadForAdmin: 1,
        unreadForUser: 0,
        lastMessageAt: new Date(),
      }
    });

    // Create the initial thread message record
    await prisma.contactThread.create({
      data: {
        contactMessageId: contact.id,
        senderType: 'USER',
        senderId: userId || null,
        senderName: name,
        senderEmail: email,
        message,
        attachments: Array.isArray(attachments) ? attachments : [],
      }
    });

    // Notify admins / support staff about new inquiry
    try {
      const supportStaff = await prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR'] } },
        select: { id: true }
      });

      if (supportStaff.length > 0) {
        const notif = await prisma.notification.create({
          data: {
            type: 'SUPPORT_NEW',
            category: 'INFO',
            title: `New Support Inquiry: ${subject}`,
            message: `From ${name} (${email}): "${message.substring(0, 100)}..."`,
            actionUrl: `/admin/communications/contact`,
          }
        });

        await prisma.notificationRecipient.createMany({
          data: supportStaff.map(s => ({
            notificationId: notif.id,
            userId: s.id,
            status: 'UNREAD'
          })),
          skipDuplicates: true
        });
      }
    } catch (err) {
      console.error('Error dispatching new support thread notification:', err);
    }

    return contact;
  },

  // Add Admin response OR Internal Staff Note
  async addReply(contactMessageId, adminId, message, attachments = [], isInternal = false) {
    const contact = await prisma.contactMessage.findUnique({
      where: { id: contactMessageId },
      include: { user: { select: { id: true, email: true, name: true } } }
    });

    if (!contact) {
      throw new Error('Contact thread not found');
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { name: true, email: true }
    });

    // Handle Internal Staff Note
    if (isInternal) {
      const note = await prisma.contactInternalNote.create({
        data: {
          contactMessageId,
          authorId: adminId,
          content: message,
        },
        include: {
          author: { select: { id: true, name: true, email: true, role: true } }
        }
      });
      return { type: 'NOTE', data: note };
    }

    // Public response to customer
    const thread = await prisma.contactThread.create({
      data: {
        contactMessageId,
        senderType: 'ADMIN',
        senderId: adminId,
        senderName: adminUser?.name || 'Support Team',
        senderEmail: adminUser?.email || '',
        message,
        attachments: Array.isArray(attachments) ? attachments : [],
        isInternal: false,
      }
    });

    // Update conversation metadata
    await prisma.contactMessage.update({
      where: { id: contactMessageId },
      data: {
        status: 'WAITING_FOR_USER',
        unreadForUser: { increment: 1 },
        lastMessageAt: new Date(),
      }
    });

    // Dispatch In-App Notification to User
    try {
      let targetUserId = contact.userId;
      if (!targetUserId && contact.email) {
        const matchingUser = await prisma.user.findUnique({ where: { email: contact.email } });
        if (matchingUser) targetUserId = matchingUser.id;
      }

      if (targetUserId) {
        const notif = await prisma.notification.create({
          data: {
            type: 'SUPPORT_REPLY',
            category: 'INFO',
            title: `Reply to: ${contact.subject}`,
            message: message.length > 150 ? message.substring(0, 150) + '...' : message,
            actionUrl: '/notifications',
            senderId: adminId,
          }
        });

        await prisma.notificationRecipient.create({
          data: {
            notificationId: notif.id,
            userId: targetUserId,
            status: 'UNREAD',
          }
        });
      }
    } catch (notifErr) {
      console.error('Error generating notification for contact reply:', notifErr);
    }

    return { type: 'THREAD', data: thread };
  },

  // User replies to an existing thread
  async addUserReply(contactMessageId, userId, message, attachments = []) {
    const contact = await prisma.contactMessage.findUnique({
      where: { id: contactMessageId }
    });

    if (!contact) {
      throw new Error('Contact thread not found');
    }

    if (contact.userId && contact.userId !== userId) {
      throw new Error('Unauthorized to reply to this thread');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });

    const thread = await prisma.contactThread.create({
      data: {
        contactMessageId,
        senderType: 'USER',
        senderId: userId,
        senderName: user?.name || contact.name,
        senderEmail: user?.email || contact.email,
        message,
        attachments: Array.isArray(attachments) ? attachments : [],
      }
    });

    // Reopen thread if it was resolved/closed & increment unread counter for admin
    await prisma.contactMessage.update({
      where: { id: contactMessageId },
      data: {
        status: 'OPEN',
        unreadForAdmin: { increment: 1 },
        lastMessageAt: new Date(),
        closedAt: null,
      }
    });

    return thread;
  },

  // Clear unread counter when opening thread
  async markThreadAsRead(contactMessageId, readerType = 'ADMIN') {
    if (readerType === 'ADMIN') {
      return prisma.contactMessage.update({
        where: { id: contactMessageId },
        data: { unreadForAdmin: 0 }
      });
    } else {
      return prisma.contactMessage.update({
        where: { id: contactMessageId },
        data: { unreadForUser: 0 }
      });
    }
  },

  // Update status (OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED)
  async updateStatus(id, status) {
    const isClosed = status === 'RESOLVED' || status === 'CLOSED';
    return prisma.contactMessage.update({
      where: { id },
      data: { 
        status,
        closedAt: isClosed ? new Date() : null,
      }
    });
  },

  // Assign thread to support staff member
  async assignStaff(id, adminId) {
    return prisma.contactMessage.update({
      where: { id },
      data: { assignedToId: adminId || null }
    });
  },

  // Update priority (LOW, NORMAL, HIGH, URGENT)
  async updatePriority(id, priority) {
    return prisma.contactMessage.update({
      where: { id },
      data: { priority }
    });
  },

  // Update category (GENERAL, TECHNICAL, BILLING, FEATURE_REQUEST, BUG_REPORT)
  async updateCategory(id, category) {
    return prisma.contactMessage.update({
      where: { id },
      data: { category }
    });
  },

  // Perform bulk status or assignment actions
  async bulkAction(ids, actionType, payload) {
    if (!Array.isArray(ids) || ids.length === 0) return;

    if (actionType === 'UPDATE_STATUS') {
      return prisma.contactMessage.updateMany({
        where: { id: { in: ids } },
        data: { 
          status: payload.status,
          closedAt: (payload.status === 'RESOLVED' || payload.status === 'CLOSED') ? new Date() : null,
        }
      });
    }

    if (actionType === 'ASSIGN_STAFF') {
      return prisma.contactMessage.updateMany({
        where: { id: { in: ids } },
        data: { assignedToId: payload.assignedToId || null }
      });
    }

    if (actionType === 'UPDATE_PRIORITY') {
      return prisma.contactMessage.updateMany({
        where: { id: { in: ids } },
        data: { priority: payload.priority }
      });
    }
  }
};

module.exports = contactService;
