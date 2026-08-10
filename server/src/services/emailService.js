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

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSubscriptionConfirmationEmail,
  sendSubscriptionExpiryEmail,
  sendWeeklyReviewReminderEmail,
};
