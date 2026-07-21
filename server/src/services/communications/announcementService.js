const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const announcementService = {
  async getAllAnnouncements() {
    return prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async createAnnouncement(data, adminId) {
    return prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        targetAudiences: data.targetAudiences || ['ALL'],
        displayLocations: data.displayLocations || ['DASHBOARD'],
        priority: data.priority || 'NORMAL',
        status: data.status || 'DRAFT',
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdBy: adminId,
      }
    });
  },

  async updateAnnouncement(id, data) {
    const updatePayload = { ...data };
    if (updatePayload.startsAt) updatePayload.startsAt = new Date(updatePayload.startsAt);
    if (updatePayload.endsAt) updatePayload.endsAt = new Date(updatePayload.endsAt);

    return prisma.announcement.update({
      where: { id },
      data: updatePayload
    });
  },

  async deleteAnnouncement(id) {
    return prisma.announcement.delete({
      where: { id }
    });
  },

  async getActiveAnnouncementsForUser(userId) {
    // Fetches active, published announcements targetted at the user's role/subscription
    // (Simplification for MVP: returning all PUBLISHED announcements)
    return prisma.announcement.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { startsAt: null },
          { startsAt: { lte: new Date() } }
        ],
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: new Date() } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  }
};

module.exports = announcementService;
