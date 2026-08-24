const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendBrevoEmail } = require('../brevoClient');

const adminCommunicationSettingsService = {
  async getSettings() {
    let settings = await prisma.communicationSetting.findFirst();
    if (!settings) {
      settings = await prisma.communicationSetting.create({
        data: {
          autoArchiveDays: 30,
          autoDeleteAnnouncementsMonths: 6
        }
      });
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    const isBrevoConfigured = Boolean(brevoApiKey && brevoApiKey.trim().length > 0);

    return {
      settings,
      brevo: {
        isConfigured: isBrevoConfigured,
        status: isBrevoConfigured ? 'Brevo API Connected' : 'Brevo API Not Configured',
        senderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@jahzjournal.com',
        senderName: process.env.BREVO_SENDER_NAME || 'JAHZJOURNALS'
      }
    };
  },

  async updateSettings(data) {
    const { autoArchiveDays, autoDeleteAnnouncementsMonths } = data;
    let settings = await prisma.communicationSetting.findFirst();
    if (!settings) {
      return prisma.communicationSetting.create({
        data: {
          autoArchiveDays: autoArchiveDays || 30,
          autoDeleteAnnouncementsMonths: autoDeleteAnnouncementsMonths || 6
        }
      });
    }

    return prisma.communicationSetting.update({
      where: { id: settings.id },
      data: {
        ...(autoArchiveDays !== undefined && { autoArchiveDays }),
        ...(autoDeleteAnnouncementsMonths !== undefined && { autoDeleteAnnouncementsMonths })
      }
    });
  },

  async testBrevoConnection() {
    const emailToUse = process.env.COMMUNICATION_TEST_EMAIL || 'anintajahsmine954@gmail.com';
    return sendBrevoEmail({
      to: emailToUse,
      subject: 'JAHZJOURNALS Brevo API Delivery Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
          <h2 style="color: #34d399; margin-top: 0;">JAHZJOURNALS Brevo API Delivery Test</h2>
          <p>This diagnostic message confirms that your Brevo API integration is active and capable of delivering real emails from <strong>noreply@jahzjournal.com</strong> to your inbox.</p>
          <div style="background-color: #1e293b; padding: 12px 16px; border-radius: 8px; font-size: 12px; margin-top: 16px;">
            <strong>Test Details:</strong><br>
            • Sender: ${process.env.BREVO_SENDER_EMAIL || 'noreply@jahzjournal.com'}<br>
            • Recipient: ${emailToUse}<br>
            • Dispatch Time: ${new Date().toISOString()}
          </div>
        </div>
      `,
      text: `JAHZJOURNALS Brevo API Delivery Test\n\nThis diagnostic message confirms that your Brevo API integration is active and delivering emails to ${emailToUse}.`
    });
  }
};

module.exports = adminCommunicationSettingsService;
