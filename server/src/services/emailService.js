const { sendBrevoEmail, hashRecipient } = require('./brevoClient');
const sendLegacyNodemailer = require('../utils/sendEmail');
const {
  welcomeVerificationTemplate,
  verificationTemplate,
  passwordResetTemplate,
  subscriptionConfirmationTemplate,
  subscriptionExpiryTemplate,
  weeklyReviewReminderTemplate,
} = require('../templates/emailTemplates');

/**
 * Centralized Email Service for JAHZJOURNALS
 */
const sendEmail = async ({ to, subject, html, text, templateId, params }) => {
  const isEnabled = process.env.EMAIL_ENABLED !== 'false';
  if (!isEnabled) {
    console.log(`[Email Service Disabled] Skipping email to ${hashRecipient(to)}`);
    return { success: false, provider: 'disabled', messageId: null, errorCode: 'EMAIL_DISABLED' };
  }

  const provider = (process.env.EMAIL_PROVIDER || 'brevo').toLowerCase();

  if (provider === 'mock') {
    console.log(`[Email Mock Log] To: ${hashRecipient(to)} | Subject: "${subject}"`);
    return { success: true, provider: 'mock', messageId: `mock-${Date.now()}`, errorCode: null };
  }

  if (provider === 'smtp') {
    try {
      await sendLegacyNodemailer({ to, subject, text, html });
      return { success: true, provider: 'smtp', messageId: `smtp-${Date.now()}`, errorCode: null };
    } catch (err) {
      console.error(`[SMTP Error] Delivery failed to ${hashRecipient(to)}:`, err.message);
      return { success: false, provider: 'smtp', messageId: null, errorCode: 'SMTP_FAILURE', error: err.message };
    }
  }

  // Default provider: Brevo API
  return await sendBrevoEmail({ to, subject, html, text, templateId, params });
};

/**
 * High-level Transactional Email Triggers
 */
const sendWelcomeEmail = async (user, verifyUrl) => {
  const template = welcomeVerificationTemplate({ name: user.name, verifyUrl });
  return await sendEmail({
    to: user.email,
    subject: 'Welcome to JAHZJOURNALS - Verify Your Account',
    html: template.html,
    text: template.text,
  });
};

const sendVerificationEmail = async (user, verifyUrl) => {
  const template = verificationTemplate({ name: user.name, verifyUrl });
  return await sendEmail({
    to: user.email,
    subject: 'Verify Your JAHZJOURNALS Account',
    html: template.html,
    text: template.text,
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  const template = passwordResetTemplate({ name: user.name, resetUrl });
  return await sendEmail({
    to: user.email,
    subject: 'Reset Your JAHZJOURNALS Password',
    html: template.html,
    text: template.text,
  });
};

const sendSubscriptionConfirmationEmail = async (user, planName) => {
  const template = subscriptionConfirmationTemplate({ name: user.name, planName });
  return await sendEmail({
    to: user.email,
    subject: `Subscription Confirmed: Welcome to JAHZJOURNALS ${planName}`,
    html: template.html,
    text: template.text,
  });
};

const sendSubscriptionExpiryEmail = async (user, planName) => {
  const template = subscriptionExpiryTemplate({ name: user.name, planName });
  return await sendEmail({
    to: user.email,
    subject: `Your JAHZJOURNALS ${planName} Subscription Has Ended`,
    html: template.html,
    text: template.text,
  });
};

const sendWeeklyReviewReminderEmail = async (user, dashboardUrl) => {
  const template = weeklyReviewReminderTemplate({ name: user.name, dashboardUrl });
  return await sendEmail({
    to: user.email,
    subject: 'Weekly Review Reminder - JAHZJOURNALS',
    html: template.html,
    text: template.text,
  });
};

const sendPromotionNotificationEmail = async (user, promotion) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const promoUrl = `${clientUrl}/pricing`;
  const subject = `🎉 New JAHZJOURNALS Promotion: ${promotion.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #111827; color: #f3f4f6; padding: 32px; border-radius: 16px;">
      <h2 style="color: #10b981;">🎉 Special Promotion Live!</h2>
      <h1 style="color: #ffffff; font-size: 24px;">${promotion.name}</h1>
      <p style="color: #9ca3af; font-size: 16px;">${promotion.description || 'Unlock exclusive tier access on JAHZJOURNALS.'}</p>
      <div style="background-color: #1f2937; padding: 16px; border-radius: 12px; margin: 24px 0; border: 1px solid #374151;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">PROMO CODE</p>
        <p style="margin: 4px 0 0 0; color: #38bdf8; font-size: 20px; font-weight: bold; font-family: monospace;">${promotion.slug.toUpperCase()}</p>
        <p style="margin: 8px 0 0 0; color: #34d399; font-size: 14px;"><strong>Benefit:</strong> ${promotion.planGranted} Tier Access</p>
      </div>
      <a href="${promoUrl}" style="display: inline-block; background: linear-gradient(to right, #10b981, #14b8a6); color: #030712; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 16px;">Redeem Promotion Now →</a>
    </div>
  `;
  const text = `🎉 New JAHZJOURNALS Promotion: ${promotion.name}\n\n${promotion.description || ''}\nCode: ${promotion.slug.toUpperCase()}\nBenefit: ${promotion.planGranted}\n\nRedeem now: ${promoUrl}`;

  return await sendEmail({ to: user.email, subject, html, text });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSubscriptionConfirmationEmail,
  sendSubscriptionExpiryEmail,
  sendWeeklyReviewReminderEmail,
  sendPromotionNotificationEmail,
};
