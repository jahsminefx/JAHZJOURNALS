const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const contactService = {
  async getMessages(filters = {}) {
    const { status, search, assignedToId } = filters;
    
    let whereClause = {};
    if (status) whereClause.status = status;
    if (assignedToId) whereClause.assignedToId = assignedToId;
    if (search) {
      whereClause.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    return prisma.contactMessage.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getMessageThread(id) {
    return prisma.contactMessage.findUnique({
      where: { id },
      include: {
        threads: { orderBy: { createdAt: 'asc' } },
        internalNotes: {
          include: { author: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' }
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });
  },

  async updateStatus(id, status) {
    return prisma.contactMessage.update({
      where: { id },
      data: { status }
    });
  },

  async assignStaff(id, adminId) {
    return prisma.contactMessage.update({
      where: { id },
      data: { assignedToId: adminId }
    });
  },

  async addReply(contactMessageId, adminId, message) {
    // 1. Create the thread
    const thread = await prisma.contactThread.create({
      data: {
        contactMessageId,
        senderType: 'ADMIN',
        senderId: adminId,
        message
      }
    });

    // 2. Automatically update status to REPLIED if it was NEW or WAITING
    const contact = await prisma.contactMessage.findUnique({ where: { id: contactMessageId } });
    if (['NEW', 'OPEN', 'WAITING'].includes(contact.status)) {
      await this.updateStatus(contactMessageId, 'REPLIED');
    }

    // 3. (In real life we would dispatch an email here, omitted for MVP)
    
    return thread;
  },

  async bulkAction(ids, actionType, payload) {
    if (actionType === 'UPDATE_STATUS') {
      return prisma.contactMessage.updateMany({
        where: { id: { in: ids } },
        data: { status: payload.status }
      });
    }
  }
};

module.exports = contactService;
