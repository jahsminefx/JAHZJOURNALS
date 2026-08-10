const test = require('node:test');
const assert = require('node:assert');
const { hashRecipient, sendBrevoEmail } = require('../src/services/brevoClient');
const emailService = require('../src/services/emailService');
const {
  welcomeVerificationTemplate,
  verificationTemplate,
  passwordResetTemplate,
  subscriptionConfirmationTemplate,
  subscriptionExpiryTemplate,
  weeklyReviewReminderTemplate,
} = require('../src/templates/emailTemplates');

test('hashRecipient masks email addresses safely for logs', () => {
  const masked = hashRecipient('trader@example.com');
  assert.strictEqual(masked, 'tr***@example.com');
  assert.ok(!masked.includes('trader'));

  const shortMasked = hashRecipient('ab@domain.com');
  assert.strictEqual(shortMasked, 'ab***@domain.com');

  const emptyMasked = hashRecipient('');
  assert.strictEqual(emptyMasked, 'unknown');
});

test('sendBrevoEmail returns structured BREVO_NOT_CONFIGURED error when API key is missing', async () => {
  const originalKey = process.env.BREVO_API_KEY;
  delete process.env.BREVO_API_KEY;

  const result = await sendBrevoEmail({
    to: 'test@example.com',
    subject: 'Test Email',
    text: 'Hello world',
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.provider, 'brevo');
  assert.strictEqual(result.errorCode, 'BREVO_NOT_CONFIGURED');
  assert.strictEqual(result.messageId, null);

  process.env.BREVO_API_KEY = originalKey;
});

test('emailService respects EMAIL_PROVIDER=mock mode', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const result = await emailService.sendEmail({
    to: 'trader@example.com',
    subject: 'Unit Test',
    text: 'Mock email test',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.provider, 'mock');
  assert.ok(result.messageId.startsWith('mock-'));

  process.env.EMAIL_PROVIDER = originalProvider;
});

test('emailService respects EMAIL_ENABLED=false setting', async () => {
  const originalEnabled = process.env.EMAIL_ENABLED;
  process.env.EMAIL_ENABLED = 'false';

  const result = await emailService.sendEmail({
    to: 'trader@example.com',
    subject: 'Disabled Test',
    text: 'Disabled email test',
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.provider, 'disabled');
  assert.strictEqual(result.errorCode, 'EMAIL_DISABLED');

  process.env.EMAIL_ENABLED = originalEnabled;
});

test('email templates render HTML and plaintext correctly with user details', () => {
  const welcome = welcomeVerificationTemplate({ name: 'Alex Trader', verifyUrl: 'http://localhost:5173/verify?token=abc' });
  assert.ok(welcome.html.includes('Alex Trader'));
  assert.ok(welcome.html.includes('http://localhost:5173/verify?token=abc'));
  assert.ok(welcome.text.includes('Alex Trader'));

  const reset = passwordResetTemplate({ name: 'Jordan', resetUrl: 'http://localhost:5173/reset?token=xyz' });
  assert.ok(reset.html.includes('Reset your password'));
  assert.ok(reset.html.includes('http://localhost:5173/reset?token=xyz'));

  const subConf = subscriptionConfirmationTemplate({ name: 'Taylor', planName: 'PRO' });
  assert.ok(subConf.html.includes('PRO'));
  assert.ok(subConf.html.includes('Taylor'));

  const subExp = subscriptionExpiryTemplate({ name: 'Morgan', planName: 'STARTER' });
  assert.ok(subExp.html.includes('STARTER'));

  const weeklyRem = weeklyReviewReminderTemplate({ name: 'Sam', dashboardUrl: 'http://localhost:5173/weekly-review' });
  assert.ok(weeklyRem.html.includes('Weekly Review'));
});

test('high-level emailService helpers run without throwing exceptions in mock mode', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const mockUser = { id: 'u1', name: 'Test User', email: 'test@example.com' };

  const r1 = await emailService.sendWelcomeEmail(mockUser, 'http://localhost/verify');
  assert.strictEqual(r1.success, true);

  const r2 = await emailService.sendVerificationEmail(mockUser, 'http://localhost/verify');
  assert.strictEqual(r2.success, true);

  const r3 = await emailService.sendPasswordResetEmail(mockUser, 'http://localhost/reset');
  assert.strictEqual(r3.success, true);

  const r4 = await emailService.sendSubscriptionConfirmationEmail(mockUser, 'PRO');
  assert.strictEqual(r4.success, true);

  const r5 = await emailService.sendSubscriptionExpiryEmail(mockUser, 'PRO');
  assert.strictEqual(r5.success, true);

  const r6 = await emailService.sendWeeklyReviewReminderEmail(mockUser);
  assert.strictEqual(r6.success, true);

  process.env.EMAIL_PROVIDER = originalProvider;
});
