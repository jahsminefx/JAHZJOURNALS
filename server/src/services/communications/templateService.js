const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templateService = {
  async getTemplates(category) {
    const where = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }
    return prisma.communicationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  },

  async createTemplate(data) {
    const { name, category = 'SUPPORT', subject, content, variables = [], createdById } = data;
    return prisma.communicationTemplate.create({
      data: {
        name,
        category,
        subject: subject || null,
        content,
        variables,
        createdById: createdById || null
      }
    });
  },

  async updateTemplate(id, data) {
    const { name, category, subject, content, variables } = data;
    return prisma.communicationTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(subject !== undefined && { subject }),
        ...(content && { content }),
        ...(variables && { variables })
      }
    });
  },

  async deleteTemplate(id) {
    return prisma.communicationTemplate.delete({ where: { id } });
  }
};

module.exports = templateService;
