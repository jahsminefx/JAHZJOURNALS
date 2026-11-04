/**
 * JAHZJOURNALS — Phase 0 Critical Security Fixes Verification Test Suite
 *
 * Verifies:
 * 1. JAHZ-SEC-001: Fail-closed Stripe webhook configuration and mandatory signature verification.
 * 2. JAHZ-SEC-002: Elimination of plaintext password-reset OTPs, reset URLs, and tokens from logs.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  handleStripeWebhook,
  handlePaystackWebhook,
} = require('../src/controllers/subscriptionController');
const {
  requestPasswordReset,
  resetPassword,
} = require('../src/controllers/authController');
const emailService = require('../src/services/emailService');
const { sendBrevoEmail, hashRecipient } = require('../src/services/brevoClient');
const { passwordResetTemplate } = require('../src/templates/emailTemplates');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
  };
  return res;
};

// Helper to capture stdout/stderr output during execution
const captureConsoleOutput = async (fn) => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  let captured = '';

  const collector = (...args) => {
    captured += args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
  };

  console.log = collector;
  console.warn = collector;
  console.error = collector;
  process.stdout.write = (chunk, ...args) => {
    captured += chunk.toString();
    return true;
  };
  process.stderr.write = (chunk, ...args) => {
    captured += chunk.toString();
    return true;
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return captured;
};

// ==========================================
// 1. STRIPE WEBHOOK SECURITY TESTS (JAHZ-SEC-001)
// ==========================================

test('1. Stripe Webhook — Unconfigured Stripe returns HTTP 503 fail-closed', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;

  try {
    const req = {
      headers: { 'stripe-signature': 't=123,v1=abc' },
      body: { type: 'checkout.session.completed' },
      rawBody: Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })),
    };
    const res = createMockRes();

    await handleStripeWebhook(req, res);

    assert.strictEqual(res.statusCode, 503);
    assert.ok(res.body?.message?.includes('unconfigured'));
  } finally {
    if (originalKey !== undefined) process.env.STRIPE_SECRET_KEY = originalKey;
  }
});

test('2. Stripe Webhook — Rejected webhook requests cause zero database mutations', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;

  // Create a clean temporary user
  const uniqueTag = `sec_test_${Date.now()}`;
  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Security Test User',
      passwordHash: await bcrypt.hash('Password123!', 10),
      subscriptionPlan: 'FREE',
      subscriptionStatus: 'ACTIVE',
    },
  });

  try {
    const initialWebhookCount = await prisma.webhookEvent.count();

    const forgedPayload = {
      id: `evt_forged_${Date.now()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_forged_${Date.now()}`,
          customer_email: testUser.email,
          metadata: { plan: 'MENTOR', userId: testUser.id },
          amount_total: 65000,
          currency: 'usd',
        },
      },
    };

    const req = {
      headers: {},
      body: forgedPayload,
      rawBody: Buffer.from(JSON.stringify(forgedPayload)),
    };
    const res = createMockRes();

    await handleStripeWebhook(req, res);

    // Assert 503 rejection
    assert.strictEqual(res.statusCode, 503);

    // Assert no WebhookEvent record created
    const finalWebhookCount = await prisma.webhookEvent.count();
    assert.strictEqual(finalWebhookCount, initialWebhookCount);

    // Assert user subscription unchanged
    const refreshedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(refreshedUser.subscriptionPlan, 'FREE');
    assert.strictEqual(refreshedUser.role, 'TRADER');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    if (originalKey !== undefined) process.env.STRIPE_SECRET_KEY = originalKey;
  }
});

test('3. Stripe Webhook — Missing signature header is rejected with HTTP 400', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_secret_key_12345';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret_12345';

  try {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    const req = {
      headers: {}, // No stripe-signature
      body: { type: 'checkout.session.completed' },
      rawBody: Buffer.from(payload),
    };
    const res = createMockRes();

    await handleStripeWebhook(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(String(res.body).includes('Missing stripe-signature header'));
  } finally {
    if (originalKey !== undefined) process.env.STRIPE_SECRET_KEY = originalKey; else delete process.env.STRIPE_SECRET_KEY;
    if (originalSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = originalSecret; else delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('4. Stripe Webhook — Missing or empty raw body is rejected with HTTP 400', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_secret_key_12345';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret_12345';

  try {
    const req = {
      headers: { 'stripe-signature': 't=123,v1=mock_signature' },
      body: { type: 'checkout.session.completed' },
      rawBody: null, // Missing rawBody
    };
    const res = createMockRes();

    await handleStripeWebhook(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(String(res.body).includes('Missing raw request body'));
  } finally {
    if (originalKey !== undefined) process.env.STRIPE_SECRET_KEY = originalKey; else delete process.env.STRIPE_SECRET_KEY;
    if (originalSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = originalSecret; else delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('5. Stripe Webhook — Invalid or tampered signature is rejected with HTTP 400', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_secret_key_12345';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret_12345';

  try {
    const payload = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_123' });
    const timestamp = Math.floor(Date.now() / 1000);
    const validHmac = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex');

    // Tampered payload
    const tamperedPayload = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_999' });
    const req = {
      headers: { 'stripe-signature': `t=${timestamp},v1=${validHmac}` },
      body: JSON.parse(tamperedPayload),
      rawBody: Buffer.from(tamperedPayload),
    };
    const res = createMockRes();

    await handleStripeWebhook(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body, 'Invalid signature');
  } finally {
    if (originalKey !== undefined) process.env.STRIPE_SECRET_KEY = originalKey; else delete process.env.STRIPE_SECRET_KEY;
    if (originalSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = originalSecret; else delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('6. Stripe Webhook — Valid signature is accepted and deduplicated idempotently', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_secret_key_12345';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret_12345';

  const uniqueTag = `sec_valid_${Date.now()}`;
  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Valid Webhook User',
      passwordHash: await bcrypt.hash('Password123!', 10),
      subscriptionPlan: 'FREE',
      subscriptionStatus: 'ACTIVE',
    },
  });

  const eventId = `evt_valid_${Date.now()}`;

  try {
    const eventPayload = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_valid_${Date.now()}`,
          customer_email: testUser.email,
          metadata: { plan: 'PRO', userId: testUser.id },
          amount_total: 2700,
          currency: 'usd',
        },
      },
    };

    const rawBodyStr = JSON.stringify(eventPayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const validHmac = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${rawBodyStr}`).digest('hex');
    const validHeader = `t=${timestamp},v1=${validHmac}`;

    const req = {
      headers: { 'stripe-signature': validHeader },
      body: eventPayload,
      rawBody: Buffer.from(rawBodyStr),
    };
    const res = createMockRes();

    // First arrival
    await handleStripeWebhook(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.received, true);

    // Verify database update
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(updatedUser.subscriptionPlan, 'PRO');

    // Duplicate arrival (idempotency check)
    const res2 = createMockRes();
    await handleStripeWebhook(req, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.body.deduplicated, true);
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { eventId } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    if (originalKey !== undefined) process.env.STRIPE_SECRET_KEY = originalKey; else delete process.env.STRIPE_SECRET_KEY;
    if (originalSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = originalSecret; else delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('7. Paystack Webhook — Paystack valid signature flow remains fully functional', async () => {
  const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_paystack_secret_123';
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;

  const eventPayload = {
    event: 'charge.success',
    data: {
      reference: `ref_paystack_test_${Date.now()}`,
      amount: 850000,
      currency: 'NGN',
      paid_at: new Date().toISOString(),
      metadata: { plan: 'PRO' },
    },
  };

  const rawBodyStr = JSON.stringify(eventPayload);
  const hash = crypto.createHmac('sha512', secret).update(Buffer.from(rawBodyStr)).digest('hex');

  const req = {
    headers: { 'x-paystack-signature': hash },
    body: eventPayload,
    rawBody: Buffer.from(rawBodyStr),
  };
  const res = createMockRes();

  try {
    await handlePaystackWebhook(req, res);
    assert.strictEqual(res.statusCode, 200);
  } finally {
    if (originalKey !== undefined) process.env.PAYSTACK_SECRET_KEY = originalKey;
    await prisma.webhookEvent.deleteMany({ where: { eventId: `paystack_charge.success_${eventPayload.data.reference}` } }).catch(() => {});
  }
});

// ==========================================
// 2. PASSWORD RESET LOGGING TESTS (JAHZ-SEC-002)
// ==========================================

test('8. Password Reset Logging — Captured stdout/stderr output contains NO OTP code, reset URL, or raw email', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const uniqueTag = `sec_reset_${Date.now()}`;
  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Secret Leak Test User',
      passwordHash: await bcrypt.hash('Password123!', 10),
    },
  });

  try {
    const req = { body: { email: testUser.email } };
    const res = createMockRes();

    let capturedLogs = '';
    await captureConsoleOutput(async () => {
      await requestPasswordReset(req, res);
    }).then((logs) => {
      capturedLogs = logs;
    });

    assert.strictEqual(res.statusCode, 200);

    // Fetch generated OTP hash from DB to get the actual user record
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.ok(updatedUser.passwordResetTokenHash, 'Password reset token hash must be set in database');

    // 1. Assert full raw email does not appear in stdout logs
    assert.strictEqual(
      capturedLogs.includes(testUser.email),
      false,
      'Raw email address must NOT appear in output logs'
    );

    // 2. Assert reset URL with code parameter does not appear in stdout logs
    assert.strictEqual(
      capturedLogs.includes('reset-password?code='),
      false,
      'Reset link with code parameter must NOT appear in output logs'
    );

    // 3. Assert no 6-digit numeric OTP appears in output logs
    const sixDigitMatches = capturedLogs.match(/\b\d{6}\b/g) || [];
    assert.strictEqual(
      sixDigitMatches.length,
      0,
      `No 6-digit OTP code should be logged! Found: ${sixDigitMatches.join(', ')}`
    );

    // 4. Assert masked recipient is present in structured log
    const masked = hashRecipient(testUser.email);
    assert.ok(capturedLogs.includes(masked), 'Masked recipient should be recorded in diagnostic log');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    process.env.EMAIL_PROVIDER = originalProvider;
  }
});

test('9. Password Reset Email — Email subject is static and never contains OTP', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const testUser = { name: 'Alex', email: 'alex@example.com' };
  const mockCode = '948201';
  const mockResetUrl = 'https://jahzjournal.com/reset-password?code=948201';

  let captured = '';
  await captureConsoleOutput(async () => {
    const result = await emailService.sendPasswordResetEmail(testUser, mockResetUrl, mockCode);
    assert.strictEqual(result.success, true);
  }).then((logs) => {
    captured = logs;
  });

  // Verify log contains static subject and no raw code
  assert.ok(captured.includes('Your JAHZJOURNALS Password Reset Code'));
  assert.strictEqual(captured.includes(mockCode), false, 'Subject in logs must not contain raw OTP');

  process.env.EMAIL_PROVIDER = originalProvider;
});

test('10. Password Reset Template — Email body preserves OTP badge and reset URL for recipient', () => {
  const mockUser = { name: 'Jordan', email: 'jordan@example.com' };
  const mockCode = '654321';
  const mockResetUrl = 'https://jahzjournal.com/reset-password?code=654321&email=jordan%40example.com';

  const template = passwordResetTemplate({
    name: mockUser.name,
    resetUrl: mockResetUrl,
    otpCode: mockCode,
  });

  // HTML content
  assert.ok(template.html.includes(mockCode), 'HTML email body must contain the OTP code for the recipient');
  assert.ok(template.html.includes(mockResetUrl), 'HTML email body must contain the reset URL');

  // Plaintext content
  assert.ok(template.text.includes(mockCode), 'Plaintext email body must contain the OTP code');
  assert.ok(template.text.includes(mockResetUrl), 'Plaintext email body must contain the reset URL');
});

test('11. Password Reset Lifecycle — Valid OTP confirmation and password update still succeed', async () => {
  const uniqueTag = `sec_confirm_${Date.now()}`;
  const testPassword = 'OldPassword123!';
  const newPassword = 'NewSecurePassword2026!';
  const testOtp = '817263';
  const passwordResetTokenHash = crypto.createHash('sha256').update(testOtp).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Reset Confirm User',
      passwordHash: await bcrypt.hash(testPassword, 10),
      passwordResetTokenHash,
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min in future
      passwordResetUsedAt: null,
    },
  });

  try {
    const req = {
      body: {
        code: testOtp,
        password: newPassword,
      },
    };
    const res = createMockRes();

    await resetPassword(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, 'Your password has been securely reset.');

    // Verify DB state
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(updatedUser.passwordResetTokenHash, null);
    assert.strictEqual(updatedUser.passwordResetExpiresAt, null);
    assert.ok(updatedUser.passwordResetUsedAt);

    // Verify new password hashes match
    const passwordMatches = await bcrypt.compare(newPassword, updatedUser.passwordHash);
    assert.strictEqual(passwordMatches, true);
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('12. Password Reset Lifecycle — Expired or invalid OTPs are rejected with HTTP 400', async () => {
  const uniqueTag = `sec_expired_${Date.now()}`;
  const testOtp = '112233';
  const passwordResetTokenHash = crypto.createHash('sha256').update(testOtp).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Expired OTP User',
      passwordHash: await bcrypt.hash('OldPassword123!', 10),
      passwordResetTokenHash,
      passwordResetExpiresAt: new Date(Date.now() - 60 * 1000), // 1 minute in PAST (expired)
      passwordResetUsedAt: null,
    },
  });

  try {
    // 1. Attempt with expired OTP
    const reqExpired = { body: { code: testOtp, password: 'NewPassword123!' } };
    const resExpired = createMockRes();
    await resetPassword(reqExpired, resExpired);
    assert.strictEqual(resExpired.statusCode, 400);

    // 2. Attempt with wrong OTP
    const reqWrong = { body: { code: '999999', password: 'NewPassword123!' } };
    const resWrong = createMockRes();
    await resetPassword(reqWrong, resWrong);
    assert.strictEqual(resWrong.statusCode, 400);
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});
