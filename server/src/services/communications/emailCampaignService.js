const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendBrevoEmail } = require('../brevoClient');

const emailCampaignService = {
  async getCampaigns() {
    return prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async createCampaign(data) {
    const { title, subject, contentHtml, segment = 'ALL' } = data;
    return prisma.emailCampaign.create({
      data: {
        title,
        subject,
        contentHtml,
        segment,
        status: 'DRAFT'
      }
    });
  },

  async sendCampaign(id) {
    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status === 'SENT') throw new Error('Campaign already sent');

    // Fetch target recipients based on segment and marketing consent
    const whereUser = {
      isDisabled: false,
      OR: [
        { userSettings: { productUpdates: true } },
        { userSettings: { is: null } }
      ]
    };

    if (campaign.segment === 'PRO') {
      whereUser.subscriptionPlan = 'PRO';
    } else if (campaign.segment === 'STARTER') {
      whereUser.subscriptionPlan = 'STARTER';
    } else if (campaign.segment === 'FREE') {
      whereUser.subscriptionPlan = 'FREE';
    }

    const recipients = await prisma.user.findMany({
      where: whereUser,
      select: { email: true, name: true }
    });

    // Mark status as SENDING
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'SENDING', recipientCount: recipients.length }
    });

    let sentCount = 0;
    for (const recipient of recipients) {
      try {
        const personalizedHtml = campaign.contentHtml.replace(/\{\{user\.name\}\}/g, recipient.name || 'Trader');
        await sendBrevoEmail({
          to: recipient.email,
          subject: campaign.subject,
          html: personalizedHtml
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send campaign email to ${recipient.email}:`, err);
      }
    }

    return prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        recipientCount: sentCount
      }
    });
  },

  async deleteCampaign(id) {
    return prisma.emailCampaign.delete({ where: { id } });
  }
};

module.exports = emailCampaignService;
