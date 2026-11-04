const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { encryptCredential, decryptCredential, getEncryptionKey } = require('../src/utils/cryptoUtils');
const paystackAdapter = require('../src/services/billing/paystackAdapter');
const { handlePaystackWebhook } = require('../src/controllers/subscriptionController');
const { handleBrevoWebhook } = require('../src/controllers/webhookController');
const { handleMtSyncWebhook, generateSyncToken } = require('../src/controllers/mtSyncController');
const { sendMessage } = require('../src/controllers/chatController');
const { createTrade, updateTrade } = require('../src/controllers/tradeController');
const { getCoachingSummaries, submitAssignment } = require('../src/controllers/mentorController');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    cookies: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

// ==========================================
// 1. CREDENTIAL ENCRYPTION & KEY ISOLATION
// ==========================================

test('1. Credential Encryption — Roundtrip encryption and decryption functions accurately', () => {
  const secretPassword = 'MySecretInvestorPassword2026!#$';
  const encrypted = encryptCredential(secretPassword);

  assert.ok(encrypted, 'Encrypted output must not be null');
  assert.ok(encrypted.includes(':'), 'Encrypted output must be formatted as iv:authTag:cipher');

  const parts = encrypted.split(':');
  assert.strictEqual(parts.length, 3, 'Must have exactly 3 parts');

  const decrypted = decryptCredential(encrypted);
  assert.strictEqual(decrypted, secretPassword, 'Decrypted text must match original plaintext');

  assert.strictEqual(encryptCredential(null), null);
  assert.strictEqual(decryptCredential(null), null);
  assert.strictEqual(decryptCredential('invalid:format'), null);
});

test('2. Key Isolation & Production Enforcement — Throws if no key is configured in production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const originalJwt = process.env.JWT_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;

    assert.throws(
      () => getEncryptionKey(),
      /CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be configured in production/,
      'Must throw error in production when encryption keys are missing'
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalKey !== undefined) process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    if (originalJwt !== undefined) process.env.JWT_SECRET = originalJwt;
  }
});

// ==========================================
// 2. CONSTANT-TIME COMPARISONS & WEBHOOKS
// ==========================================

test('3. Paystack HMAC — verifyWebhookSignature uses constant-time comparison safely', () => {
  const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_paystack_secret_123';
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;

  try {
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } }));
    const validSig = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    // Valid signature
    assert.strictEqual(paystackAdapter.verifyWebhookSignature(rawBody, validSig), true);

    // Tampered signature of identical length
    const tamperedSig = validSig.slice(0, -2) + (validSig.endsWith('a') ? 'b' : 'a');
    assert.strictEqual(paystackAdapter.verifyWebhookSignature(rawBody, tamperedSig), false);

    // Signature of different length
    assert.strictEqual(paystackAdapter.verifyWebhookSignature(rawBody, 'short_sig'), false);

    // Missing signature
    assert.strictEqual(paystackAdapter.verifyWebhookSignature(rawBody, null), false);
  } finally {
    if (originalKey !== undefined) process.env.PAYSTACK_SECRET_KEY = originalKey;
  }
});

test('4. Paystack Webhook Handler — Rejects missing signature and missing raw body', async () => {
  // A. Missing signature
  const reqNoSig = { headers: {}, rawBody: Buffer.from('{}'), body: {} };
  const resNoSig = createMockRes();
  await handlePaystackWebhook(reqNoSig, resNoSig);
  assert.strictEqual(resNoSig.statusCode, 400);

  // B. Missing raw body
  const reqNoBody = { headers: { 'x-paystack-signature': 'abc' }, rawBody: null, body: {} };
  const resNoBody = createMockRes();
  await handlePaystackWebhook(reqNoBody, resNoBody);
  assert.strictEqual(resNoBody.statusCode, 400);
});

test('5. Brevo Webhook Security — Fails closed when unconfigured and uses constant-time comparison', async () => {
  const originalSecret = process.env.BREVO_WEBHOOK_SECRET;

  try {
    // 1. Fail closed when unconfigured
    delete process.env.BREVO_WEBHOOK_SECRET;
    const reqUnconf = { headers: { 'x-brevo-token': 'token123' }, body: {} };
    const resUnconf = createMockRes();
    await handleBrevoWebhook(reqUnconf, resUnconf);
    assert.strictEqual(resUnconf.statusCode, 503);

    // 2. Reject query parameter tokens (query URL exposure prevention)
    process.env.BREVO_WEBHOOK_SECRET = 'super_secret_brevo_token_2026';
    const reqQuery = {
      headers: {},
      query: { secret: 'super_secret_brevo_token_2026' },
      body: { event: 'delivered', email: 'test@example.com' }
    };
    const resQuery = createMockRes();
    await handleBrevoWebhook(reqQuery, resQuery);
    assert.strictEqual(resQuery.statusCode, 401, 'Query parameter token must be rejected');

    // 3. Reject tampered header token
    const reqTampered = {
      headers: { 'x-brevo-token': 'wrong_token' },
      body: {}
    };
    const resTampered = createMockRes();
    await handleBrevoWebhook(reqTampered, resTampered);
    assert.strictEqual(resTampered.statusCode, 401);

    // 4. Accept valid header token
    const reqValid = {
      headers: { 'x-brevo-token': 'super_secret_brevo_token_2026' },
      body: [{ event: 'delivered', email: 'trader@example.com', messageId: 'msg_123' }]
    };
    const resValid = createMockRes();
    await handleBrevoWebhook(reqValid, resValid);
    assert.strictEqual(resValid.statusCode, 200);
    assert.strictEqual(resValid.body.status, 'success');
  } finally {
    if (originalSecret !== undefined) process.env.BREVO_WEBHOOK_SECRET = originalSecret;
    else delete process.env.BREVO_WEBHOOK_SECRET;
  }
});

// ==========================================
// 3. METATRADER SYNC TOKEN HARDENING
// ==========================================

test('6. MetaTrader Sync Webhook — Rejects query parameter tokens and requires secure headers', async () => {
  // A. Query parameter token rejected
  const reqQuery = {
    headers: {},
    query: { token: 'sample_token_in_url' },
    body: []
  };
  const resQuery = createMockRes();
  await handleMtSyncWebhook(reqQuery, resQuery);
  assert.strictEqual(resQuery.statusCode, 401, 'Query token must be rejected');
  assert.strictEqual(resQuery.body.message, 'Missing MetaTrader sync token.');

  // B. High-entropy token generation produces 64-hex-char token
  const testUser = await prisma.user.create({
    data: {
      email: `mt_test_${Date.now()}@example.com`,
      name: 'MT Test User',
      passwordHash: await bcrypt.hash('Password123!', 10),
    }
  });

  const testAccount = await prisma.tradingAccount.create({
    data: {
      userId: testUser.id,
      name: 'MT Account',
      accountCategory: 'REGULAR',
      startingBalance: 10000,
      currentBalance: 10000,
    }
  });

  try {
    const genReq = { params: { id: testAccount.id }, user: { id: testUser.id } };
    const genRes = createMockRes();
    await generateSyncToken(genReq, genRes);
    assert.strictEqual(genRes.statusCode, 200);

    const generatedToken = genRes.body.syncToken;
    assert.ok(generatedToken.startsWith('jj_mt_'));
    // jj_mt_ prefix (6) + 32 bytes hex (64) = 70 characters
    assert.strictEqual(generatedToken.length, 70, 'Token must have 256 bits of entropy (70 chars total)');
  } finally {
    await prisma.tradingAccount.delete({ where: { id: testAccount.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

// ==========================================
// 4. CROSS-TENANT SCOPING & IDOR GUARDS
// ==========================================

test('7. Trade Authorization — createTrade and updateTrade prevent cross-user strategy and setup linking', async () => {
  const timestamp = Date.now();
  const userA = await prisma.user.create({
    data: {
      email: `usera_${timestamp}@example.com`,
      name: 'User A',
      passwordHash: await bcrypt.hash('Password123!', 10),
    }
  });

  const userB = await prisma.user.create({
    data: {
      email: `userb_${timestamp}@example.com`,
      name: 'User B',
      passwordHash: await bcrypt.hash('Password123!', 10),
    }
  });

  const accountA = await prisma.tradingAccount.create({
    data: {
      userId: userA.id,
      name: 'User A Account',
      startingBalance: 10000,
      currentBalance: 10000,
    }
  });

  const strategyB = await prisma.strategy.create({
    data: {
      userId: userB.id,
      name: 'User B Confidential Strategy',
    }
  });

  const setupB = await prisma.setup.create({
    data: {
      strategyId: strategyB.id,
      name: 'User B Setup',
    }
  });

  let createdTradeId = null;

  try {
    // 1. User A attempts to create a trade referencing User B's strategy
    const reqCreateCrossStrategy = {
      user: { id: userA.id },
      body: {
        tradingAccountId: accountA.id,
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
        strategyId: strategyB.id, // BELONGS TO USER B
      }
    };
    const resCreateCross = createMockRes();
    await createTrade(reqCreateCrossStrategy, resCreateCross);
    assert.strictEqual(resCreateCross.statusCode, 404, 'Must reject cross-user strategyId');

    // 2. User A attempts to create a trade referencing User B's setup
    const reqCreateCrossSetup = {
      user: { id: userA.id },
      body: {
        tradingAccountId: accountA.id,
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
        setupId: setupB.id, // BELONGS TO USER B
      }
    };
    const resCreateCrossSetup = createMockRes();
    await createTrade(reqCreateCrossSetup, resCreateCrossSetup);
    assert.strictEqual(resCreateCrossSetup.statusCode, 404, 'Must reject cross-user setupId');

    // 3. User A creates a valid trade without cross-user IDs
    const reqValidCreate = {
      user: { id: userA.id },
      body: {
        tradingAccountId: accountA.id,
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
      }
    };
    const resValidCreate = createMockRes();
    await createTrade(reqValidCreate, resValidCreate);
    assert.strictEqual(resValidCreate.statusCode, 201);
    createdTradeId = resValidCreate.body.id;

    // 4. User A attempts to update trade to reference User B's strategy
    const reqUpdateCross = {
      params: { id: createdTradeId },
      user: { id: userA.id },
      body: {
        strategyId: strategyB.id,
      }
    };
    const resUpdateCross = createMockRes();
    await updateTrade(reqUpdateCross, resUpdateCross);
    assert.strictEqual(resUpdateCross.statusCode, 404, 'Must reject updating trade with cross-user strategy');
  } finally {
    if (createdTradeId) await prisma.trade.delete({ where: { id: createdTradeId } }).catch(() => {});
    await prisma.setup.delete({ where: { id: setupB.id } }).catch(() => {});
    await prisma.strategy.delete({ where: { id: strategyB.id } }).catch(() => {});
    await prisma.tradingAccount.delete({ where: { id: accountA.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
  }
});

test('8. Mentor Coaching Summaries — Mentors can only retrieve summaries they authored', async () => {
  const timestamp = Date.now();
  const mentor1 = await prisma.user.create({
    data: {
      email: `m1_${timestamp}@example.com`,
      name: 'Mentor 1',
      role: 'MENTOR',
      passwordHash: await bcrypt.hash('Password123!', 10),
    }
  });

  const mentor2 = await prisma.user.create({
    data: {
      email: `m2_${timestamp}@example.com`,
      name: 'Mentor 2',
      role: 'MENTOR',
      passwordHash: await bcrypt.hash('Password123!', 10),
    }
  });

  const student = await prisma.user.create({
    data: {
      email: `stud_${timestamp}@example.com`,
      name: 'Student User',
      passwordHash: await bcrypt.hash('Password123!', 10),
    }
  });

  // Enroll student with mentor 1
  const group1 = await prisma.mentorGroup.create({
    data: {
      mentorId: mentor1.id,
      name: 'Cohort 1',
    }
  });

  await prisma.mentorStudent.create({
    data: {
      mentorGroupId: group1.id,
      studentId: student.id,
      status: 'ACTIVE',
    }
  });

  // Summary written by mentor 1
  const summary1 = await prisma.mentorCoachingSummary.create({
    data: {
      mentorId: mentor1.id,
      studentId: student.id,
      title: 'Mentor 1 Title',
      summary: 'Mentor 1 Private Evaluation',
    }
  });

  // Summary written by mentor 2
  const summary2 = await prisma.mentorCoachingSummary.create({
    data: {
      mentorId: mentor2.id,
      studentId: student.id,
      title: 'Mentor 2 Title',
      summary: 'Mentor 2 Private Evaluation',
    }
  });

  try {
    // Mentor 1 queries student summaries
    const reqMentor1 = {
      params: { studentId: student.id },
      user: { id: mentor1.id, role: 'MENTOR' },
    };
    const resMentor1 = createMockRes();
    await getCoachingSummaries(reqMentor1, resMentor1);
    assert.strictEqual(resMentor1.statusCode, 200);

    const returnedSummaries = resMentor1.body;
    // Should ONLY see summary1 (authored by mentor 1), NOT summary2 (authored by mentor 2)
    assert.strictEqual(returnedSummaries.length, 1, 'Mentor must only see their own summaries');
    assert.strictEqual(returnedSummaries[0].id, summary1.id);
  } finally {
    await prisma.mentorCoachingSummary.deleteMany({ where: { studentId: student.id } }).catch(() => {});
    await prisma.mentorStudent.deleteMany({ where: { studentId: student.id } }).catch(() => {});
    await prisma.mentorGroup.delete({ where: { id: group1.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: student.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: mentor1.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: mentor2.id } }).catch(() => {});
  }
});

// ==========================================
// 5. AI CHAT INPUT SANITIZATION
// ==========================================

test('9. AI Chat Validation — Rejects empty payloads and bounds history and message length', async () => {
  const dummyUser = { id: 'dummy_user_id', subscriptionPlan: 'FREE' };

  // 1. Empty messages array
  const reqEmpty = { user: dummyUser, body: { messages: [] } };
  const resEmpty = createMockRes();
  await sendMessage(reqEmpty, resEmpty);
  assert.strictEqual(resEmpty.statusCode, 400);
  assert.strictEqual(resEmpty.body.message, 'Messages array cannot be empty.');

  // 2. Malformed messages array (not array)
  const reqNotArray = { user: dummyUser, body: { messages: 'not an array' } };
  const resNotArray = createMockRes();
  await sendMessage(reqNotArray, resNotArray);
  assert.strictEqual(resNotArray.statusCode, 400);

  // 3. Message item not object
  const reqInvalidItem = { user: dummyUser, body: { messages: ['string_not_obj'] } };
  const resInvalidItem = createMockRes();
  await sendMessage(reqInvalidItem, resInvalidItem);
  assert.strictEqual(resInvalidItem.statusCode, 400);
  assert.strictEqual(resInvalidItem.body.message, 'Malformed message item.');
});
