const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
  // In a real production app, ensure SMTP credentials exist
  // We use Mailtrap or a genuine SMTP service defined in .env
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Email Mocked] To: ${to} | Subject: ${subject}`);
      console.warn(text);
      return;
    }
    throw new Error('Email configuration is missing');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Sanctuary <noreply@jahzjournals.com>',
    to,
    subject,
    text,
    html: html || text,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
