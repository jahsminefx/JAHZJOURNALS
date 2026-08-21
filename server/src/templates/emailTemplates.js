/**
 * JAHZJOURNALS HTML & Text Email Templates
 * Premium dark design consistent with JAHZJOURNALS design system.
 */

const baseHeader = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JAHZJOURNALS</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f17;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f17;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #131926;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 32px 24px 32px;
      text-align: center;
      border-bottom: 1px solid #1e293b;
      background: linear-gradient(180deg, #182235 0%, #131926 100%);
    }
    .logo {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #ffffff;
      text-transform: uppercase;
      text-decoration: none;
    }
    .logo span {
      color: #10b981;
    }
    .content {
      padding: 32px;
    }
    .h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .p {
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .btn-container {
      margin: 28px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background-color: #10b981;
      color: #064e3b;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    }
    .btn:hover {
      background-color: #059669;
      color: #ffffff;
    }
    .fallback-box {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
      margin-top: 24px;
      font-size: 13px;
      color: #64748b;
      word-break: break-all;
    }
    .footer {
      padding: 24px 32px;
      background-color: #0f172a;
      border-top: 1px solid #1e293b;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <a href="https://jahzjournal.com" class="logo">JAHZ<span>JOURNALS</span></a>
      </div>
      <div class="content">
`;

const baseFooter = `
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} JAHZJOURNALS. All rights reserved.</p>
        <p style="margin: 0 0 8px 0;">The institutional trading journal & analytics workspace for disciplined traders.</p>
        <p style="margin: 0;">Questions? Contact <a href="mailto:support@jahzjournal.com">support@jahzjournal.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Welcome & Email Verification Template
 */
const welcomeVerificationTemplate = ({ name, verifyUrl }) => {
  const safeName = name ? name.trim() : 'Trader';
  const html = `
${baseHeader}
  <span class="badge">Welcome to JAHZJOURNALS</span>
  <h1 class="h1">Welcome aboard, ${safeName}!</h1>
  <p class="p">You've taken the first step toward building institutional trading discipline and finding your true statistical edge.</p>
  <p class="p">Please verify your email address to secure your account and activate your full journal features.</p>
  <div class="btn-container">
    <a href="${verifyUrl}" target="_blank" class="btn">Verify My Email Address</a>
  </div>
  <p class="p" style="font-size: 13px;">This verification link will expire in 24 hours.</p>
  <div class="fallback-box">
    If the button above does not work, copy and paste this URL into your browser:<br>
    <a href="${verifyUrl}" style="color: #38bdf8;">${verifyUrl}</a>
  </div>
${baseFooter}
  `;

  const text = `Welcome to JAHZJOURNALS, ${safeName}!\n\nPlease verify your email address by clicking or visiting this link:\n${verifyUrl}\n\nThis link will expire in 24 hours.`;
  return { html, text };
};

/**
 * Email Verification Template
 */
const verificationTemplate = ({ name, verifyUrl }) => {
  const safeName = name ? name.trim() : 'Trader';
  const html = `
${baseHeader}
  <span class="badge">Email Verification</span>
  <h1 class="h1">Verify your email address</h1>
  <p class="p">Hello ${safeName},</p>
  <p class="p">You requested a verification link for your JAHZJOURNALS account. Click below to verify your email address:</p>
  <div class="btn-container">
    <a href="${verifyUrl}" target="_blank" class="btn">Verify Email Address</a>
  </div>
  <p class="p" style="font-size: 13px;">This link will expire in 24 hours. If you did not request this, you can safely ignore this email.</p>
  <div class="fallback-box">
    Or copy and paste this link:<br>
    <a href="${verifyUrl}" style="color: #38bdf8;">${verifyUrl}</a>
  </div>
${baseFooter}
  `;

  const text = `Hello ${safeName},\n\nPlease verify your JAHZJOURNALS email address:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  return { html, text };
};

/**
 * Password Reset Template
 */
const passwordResetTemplate = ({ name, resetUrl, otpCode }) => {
  const safeName = name ? name.trim() : 'Trader';
  const displayCode = otpCode ? String(otpCode).trim() : '';
  const html = `
${baseHeader}
  <span class="badge" style="background-color: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #34d399;">Security Code</span>
  <h1 class="h1">Reset Your Password</h1>
  <p class="p">Hello ${safeName},</p>
  <p class="p">We received a request to reset your JAHZJOURNALS password. Here is your 6-digit verification code:</p>
  
  <div style="background-color: #0f172a; border: 2px solid #1e293b; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
    <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #10b981;">
      ${displayCode || '------'}
    </div>
    <p style="font-size: 12px; color: #64748b; margin-top: 10px; margin-bottom: 0; font-weight: 600;">Code expires in 10 minutes</p>
  </div>

  <div class="btn-container">
    <a href="${resetUrl}" target="_blank" class="btn" style="background-color: #10b981; color: #064e3b;">Reset My Password</a>
  </div>
  <p class="p" style="font-size: 13px;">If you did not request a password reset, your account is safe and no action is required.</p>
${baseFooter}
  `;

  const text = `Hello ${safeName},\n\nYou requested a password reset for your JAHZJOURNALS account.\n\nYour 6-Digit Password Reset Code is: ${displayCode}\n\nReset your password here:\n${resetUrl}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`;
  return { html, text };
};

/**
 * Subscription Confirmation Template
 */
const subscriptionConfirmationTemplate = ({ name, planName }) => {
  const safeName = name ? name.trim() : 'Trader';
  const html = `
${baseHeader}
  <span class="badge">Subscription Confirmed</span>
  <h1 class="h1">You're now on ${planName}!</h1>
  <p class="p">Hello ${safeName},</p>
  <p class="p">Your subscription to the <strong>${planName}</strong> plan has been confirmed and activated.</p>
  <p class="p">Your enhanced features, expanded trade logging capacity, advanced analytics, and priority access are now active on your account.</p>
  <div class="btn-container">
    <a href="https://jahzjournal.com/dashboard" target="_blank" class="btn">Go to Dashboard</a>
  </div>
${baseFooter}
  `;

  const text = `Hello ${safeName},\n\nYour subscription to the ${planName} plan on JAHZJOURNALS has been activated successfully!\n\nAccess your dashboard here: https://jahzjournal.com/dashboard`;
  return { html, text };
};

/**
 * Subscription Expiry Template
 */
const subscriptionExpiryTemplate = ({ name, planName }) => {
  const safeName = name ? name.trim() : 'Trader';
  const html = `
${baseHeader}
  <span class="badge" style="background-color: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); color: #fbbf24;">Plan Notice</span>
  <h1 class="h1">Your ${planName} subscription has ended</h1>
  <p class="p">Hello ${safeName},</p>
  <p class="p">Your access to the <strong>${planName}</strong> plan has expired, and your account has reverted to the Free plan.</p>
  <p class="p">All your trade history, accounts, and rules remain completely safe. Upgrade anytime to resume unlimited journaling, AI reviews, and prop firm challenge tracking.</p>
  <div class="btn-container">
    <a href="https://jahzjournal.com/pricing" target="_blank" class="btn">View Plans & Upgrade</a>
  </div>
${baseFooter}
  `;

  const text = `Hello ${safeName},\n\nYour ${planName} subscription on JAHZJOURNALS has ended. Your account has returned to the Free plan. All your trade data remains intact.\n\nUpgrade anytime at: https://jahzjournal.com/pricing`;
  return { html, text };
};

/**
 * Weekly Review Reminder Template
 */
const weeklyReviewReminderTemplate = ({ name, dashboardUrl }) => {
  const safeName = name ? name.trim() : 'Trader';
  const url = dashboardUrl || 'https://jahzjournal.com/weekly-review';
  const html = `
${baseHeader}
  <span class="badge">Weekly Review</span>
  <h1 class="h1">Time for your weekly review</h1>
  <p class="p">Hi ${safeName},</p>
  <p class="p">The trading week is coming to a close. Take a few minutes to log your reflections, evaluate your rule adherence, and analyze your execution patterns.</p>
  <p class="p">Reviewing your performance weekly is what separates professional traders from gamblers.</p>
  <div class="btn-container">
    <a href="${url}" target="_blank" class="btn">Execute Weekly Review</a>
  </div>
${baseFooter}
  `;

  const text = `Hi ${safeName},\n\nThe markets are closing. Time to execute your weekly trade review on JAHZJOURNALS:\n${url}`;
  return { html, text };
};

module.exports = {
  welcomeVerificationTemplate,
  verificationTemplate,
  passwordResetTemplate,
  subscriptionConfirmationTemplate,
  subscriptionExpiryTemplate,
  weeklyReviewReminderTemplate,
};
