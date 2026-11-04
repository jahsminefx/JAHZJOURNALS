const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  generatePasswordResetOtp,
} = require('../src/controllers/authController');
const { protect, optionalProtect } = require('../src/middleware/authMiddleware');
const generateToken = require('../src/utils/generateToken');
const { hashRecipient } = require('../src/services/brevoClient');

// Helper to create mock response object
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

// Helper to capture console output
async function captureConsoleOutput(fn) {
  let output = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  const append = (chunk) => {
    output += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  };

  process.stdout.write = append;
  process.stderr.write = append;
  console.log = (...args) => { output += args.map(String).join(' ') + '\n'; };
  console.info = (...args) => { output += args.map(String).join(' ') + '\n'; };
  console.warn = (...args) => { output += args.map(String).join(' ') + '\n'; };
  console.error = (...args) => { output += args.map(String).join(' ') + '\n'; };

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }

  return output;
}

// Helper to mock next() middleware callback
function createMockNext() {
  let called = false;
  let error = null;
  const next = (err) => {
    called = true;
    error = err || null;
  };
  next.isCalled = () => called;
  next.getError = () => error;
  return next;
}

// ==========================================
// PHASE 1 AUTHENTICATION SECURITY HARDENING
// ==========================================

test('1. OTP Generation — Produces cryptographically secure six-digit values in valid range', () => {
  const iterations = 500;
  const samples = new Set();

  for (let i = 0; i < iterations; i++) {
    const otp = generatePasswordResetOtp();

    assert.strictEqual(typeof otp, 'string', 'OTP must be a string');
    assert.strictEqual(otp.length, 6, `OTP length must be exactly 6, got ${otp.length} (${otp})`);
    assert.ok(/^\d{6}$/.test(otp), `OTP must contain only 6 digits, got ${otp}`);

    const numericVal = parseInt(otp, 10);
    assert.ok(numericVal >= 100000, `OTP numeric value must be >= 100000, got ${numericVal}`);
    assert.ok(numericVal <= 999999, `OTP numeric value must be <= 999999, got ${numericVal}`);

    samples.add(otp);
  }

  // Confirm strong randomness distribution across 500 generations
  assert.ok(
    samples.size >= 475,
    `Expected high uniqueness across 500 samples, got ${samples.size} unique values`
  );
});

test('2. OTP Lifecycle — Token hashing and expiry window are correctly established in database', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const uniqueTag = `sec_hash_${Date.now()}`;
  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Hashing Test User',
      passwordHash: await bcrypt.hash('Password123!', 10),
    },
  });

  try {
    const req = { body: { email: testUser.email } };
    const res = createMockRes();

    await requestPasswordReset(req, res);
    assert.strictEqual(res.statusCode, 200);

    const refreshedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.ok(refreshedUser.passwordResetTokenHash, 'Hash must be populated');
    assert.strictEqual(refreshedUser.passwordResetTokenHash.length, 64, 'SHA-256 hash must be 64 characters');
    assert.ok(/^[a-f0-9]{64}$/.test(refreshedUser.passwordResetTokenHash), 'Must be valid hex SHA-256 string');

    assert.ok(refreshedUser.passwordResetExpiresAt, 'Expiration timestamp must be set');
    const remainingMs = refreshedUser.passwordResetExpiresAt.getTime() - Date.now();
    // Expiry is 10 minutes: verify between 9 and 10.5 minutes
    assert.ok(remainingMs > 9 * 60 * 1000, 'Expiration must be at least 9 minutes in the future');
    assert.ok(remainingMs <= 10.5 * 60 * 1000, 'Expiration must not exceed 10.5 minutes');
    assert.strictEqual(refreshedUser.passwordResetUsedAt, null, 'passwordResetUsedAt must be null on request');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    process.env.EMAIL_PROVIDER = originalProvider;
  }
});

test('3. Password Reset — Succeeds with a valid OTP and updates password hash', async () => {
  const uniqueTag = `sec_success_${Date.now()}`;
  const oldPassword = 'OldPassword123!';
  const newPassword = 'BrandNewPassword2026!';
  const validOtp = '736291';
  const passwordResetTokenHash = crypto.createHash('sha256').update(validOtp).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Valid Reset User',
      passwordHash: await bcrypt.hash(oldPassword, 10),
      passwordResetTokenHash,
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      passwordResetUsedAt: null,
      tokenVersion: 0,
    },
  });

  try {
    const req = { body: { code: validOtp, password: newPassword } };
    const res = createMockRes();

    await resetPassword(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, 'Your password has been securely reset.');

    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(updatedUser.passwordResetTokenHash, null, 'Reset token hash must be cleared');
    assert.strictEqual(updatedUser.passwordResetExpiresAt, null, 'Reset expiry must be cleared');
    assert.ok(updatedUser.passwordResetUsedAt, 'passwordResetUsedAt must be stamped');

    const newPasswordValid = await bcrypt.compare(newPassword, updatedUser.passwordHash);
    assert.strictEqual(newPasswordValid, true, 'New password hash must match');

    const oldPasswordValid = await bcrypt.compare(oldPassword, updatedUser.passwordHash);
    assert.strictEqual(oldPasswordValid, false, 'Old password must no longer match');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('4. Password Reset — Invalid, expired, already-used, and malformed OTPs are strictly rejected', async () => {
  const uniqueTag = `sec_invalid_${Date.now()}`;
  const validOtp = '482019';
  const validHash = crypto.createHash('sha256').update(validOtp).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Invalid Test User',
      passwordHash: await bcrypt.hash('Password123!', 10),
      passwordResetTokenHash: validHash,
      passwordResetExpiresAt: new Date(Date.now() - 60 * 1000), // EXPIRED: 1 minute in the past
      passwordResetUsedAt: null,
      tokenVersion: 1,
    },
  });

  try {
    // A. Expired OTP
    const reqExpired = { body: { code: validOtp, password: 'NewPassword123!' } };
    const resExpired = createMockRes();
    await resetPassword(reqExpired, resExpired);
    assert.strictEqual(resExpired.statusCode, 400);

    // B. Wrong OTP code
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });
    const reqWrong = { body: { code: '000000', password: 'NewPassword123!' } };
    const resWrong = createMockRes();
    await resetPassword(reqWrong, resWrong);
    assert.strictEqual(resWrong.statusCode, 400);

    // C. Already used OTP
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordResetUsedAt: new Date() },
    });
    const reqUsed = { body: { code: validOtp, password: 'NewPassword123!' } };
    const resUsed = createMockRes();
    await resetPassword(reqUsed, resUsed);
    assert.strictEqual(resUsed.statusCode, 400);

    // D. Password too short (< 8 chars)
    const reqShortPwd = { body: { code: validOtp, password: 'short' } };
    const resShortPwd = createMockRes();
    await resetPassword(reqShortPwd, resShortPwd);
    assert.strictEqual(resShortPwd.statusCode, 400);

    // E. Missing code
    const reqEmpty = { body: { code: '', password: 'ValidPassword123!' } };
    const resEmpty = createMockRes();
    await resetPassword(reqEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 400);
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('5. Session Invalidation — Successful password reset increments tokenVersion atomically', async () => {
  const uniqueTag = `sec_version_${Date.now()}`;
  const otp1 = '123456';
  const hash1 = crypto.createHash('sha256').update(otp1).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Token Version User',
      passwordHash: await bcrypt.hash('Password123!', 10),
      passwordResetTokenHash: hash1,
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      passwordResetUsedAt: null,
      tokenVersion: 0,
    },
  });

  try {
    // First reset: 0 -> 1
    const req1 = { body: { code: otp1, password: 'NewPasswordOne123!' } };
    const res1 = createMockRes();
    await resetPassword(req1, res1);
    assert.strictEqual(res1.statusCode, 200);

    let refreshed = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(refreshed.tokenVersion, 1, 'tokenVersion must increment from 0 to 1');

    // Second reset: 1 -> 2
    const otp2 = '654321';
    const hash2 = crypto.createHash('sha256').update(otp2).digest('hex');
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        passwordResetTokenHash: hash2,
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        passwordResetUsedAt: null,
      },
    });

    const req2 = { body: { code: otp2, password: 'NewPasswordTwo123!' } };
    const res2 = createMockRes();
    await resetPassword(req2, res2);
    assert.strictEqual(res2.statusCode, 200);

    refreshed = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(refreshed.tokenVersion, 2, 'tokenVersion must increment from 1 to 2');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('6. Session Revocation — Previously issued JWTs are rejected by protected and optional routes', async () => {
  const uniqueTag = `sec_revoke_${Date.now()}`;
  const validOtp = '556677';
  const hash = crypto.createHash('sha256').update(validOtp).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Revocation User',
      passwordHash: await bcrypt.hash('InitialPassword123!', 10),
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      tokenVersion: 0,
    },
  });

  try {
    // Issue token while tokenVersion is 0
    const staleToken = jwt.sign(
      { userId: testUser.id, tokenVersion: 0 },
      process.env.JWT_SECRET || 'test_jwt_secret',
      { expiresIn: '7d' }
    );

    // Verify token works before reset
    const preReq = { cookies: { jwt: staleToken }, headers: {} };
    const preRes = createMockRes();
    const preNext = createMockNext();
    await protect(preReq, preRes, preNext);
    assert.strictEqual(preNext.isCalled(), true, 'Pre-reset token should pass protect middleware');
    assert.strictEqual(preReq.user.id, testUser.id);

    // Reset password (increments tokenVersion to 1)
    const resetReq = { body: { code: validOtp, password: 'UpdatedSecurePass123!' } };
    const resetRes = createMockRes();
    await resetPassword(resetReq, resetRes);
    assert.strictEqual(resetRes.statusCode, 200);

    // A. Attempt protected route with stale token -> HTTP 401
    const postReq = { cookies: { jwt: staleToken }, headers: {} };
    const postRes = createMockRes();
    const postNext = createMockNext();
    await protect(postReq, postRes, postNext);
    assert.strictEqual(postNext.isCalled(), false, 'Protected route must NOT call next() with stale token');
    assert.strictEqual(postRes.statusCode, 401);
    assert.strictEqual(
      postRes.body.message,
      'Your session has been invalidated from another device. Please log in again.'
    );

    // B. Attempt optional-auth route with stale token -> req.user set to null
    const optReq = { cookies: { jwt: staleToken }, headers: {} };
    const optRes = createMockRes();
    const optNext = createMockNext();
    await optionalProtect(optReq, optRes, optNext);
    assert.strictEqual(optNext.isCalled(), true, 'Optional route calls next()');
    assert.strictEqual(optReq.user, null, 'Stale token must result in req.user = null in optional route');

    // C. Also verify Bearer header variant of stale token is rejected
    const headerReq = { cookies: {}, headers: { authorization: `Bearer ${staleToken}` } };
    const headerRes = createMockRes();
    const headerNext = createMockNext();
    await protect(headerReq, headerRes, headerNext);
    assert.strictEqual(headerRes.statusCode, 401);
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('7. New Session — Newly issued JWTs after password reset authenticate normally', async () => {
  const uniqueTag = `sec_new_session_${Date.now()}`;
  const newPassword = 'FreshPassword2026!';
  const validOtp = '991122';
  const hash = crypto.createHash('sha256').update(validOtp).digest('hex');

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'New Session User',
      passwordHash: await bcrypt.hash('OldPassword123!', 10),
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      tokenVersion: 0,
    },
  });

  try {
    // Reset password -> tokenVersion becomes 1
    const resetReq = { body: { code: validOtp, password: newPassword } };
    const resetRes = createMockRes();
    await resetPassword(resetReq, resetRes);
    assert.strictEqual(resetRes.statusCode, 200);

    // Login with new password
    const loginReq = { body: { email: testUser.email, password: newPassword } };
    const loginRes = createMockRes();
    await loginUser(loginReq, loginRes);
    assert.strictEqual(loginRes.statusCode, 200);
    assert.ok(loginRes.cookies.jwt, 'Login response must set jwt cookie');

    const newToken = loginRes.cookies.jwt.value;
    const decoded = jwt.decode(newToken);
    assert.strictEqual(decoded.tokenVersion, 1, 'New JWT payload must contain updated tokenVersion (1)');

    // Access protected route with new token
    const authReq = { cookies: { jwt: newToken }, headers: {} };
    const authRes = createMockRes();
    const authNext = createMockNext();
    await protect(authReq, authRes, authNext);
    assert.strictEqual(authNext.isCalled(), true, 'New token must authenticate successfully');
    assert.strictEqual(authReq.user.id, testUser.id);
    assert.strictEqual(authReq.user.tokenVersion, 1);

    // Access optional-auth route with new token
    const optReq = { cookies: { jwt: newToken }, headers: {} };
    const optRes = createMockRes();
    const optNext = createMockNext();
    await optionalProtect(optReq, optRes, optNext);
    assert.strictEqual(optNext.isCalled(), true);
    assert.ok(optReq.user, 'req.user must be populated on optional-auth with new token');
    assert.strictEqual(optReq.user.id, testUser.id);
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('8. Failure Invariant — Failed password reset attempts NEVER increment tokenVersion', async () => {
  const uniqueTag = `sec_fail_invariant_${Date.now()}`;
  const initialPassword = 'StartingPassword123!';
  const initialTokenVersion = 5;

  const testUser = await prisma.user.create({
    data: {
      email: `${uniqueTag}@example.com`,
      name: 'Invariant Test User',
      passwordHash: await bcrypt.hash(initialPassword, 10),
      passwordResetTokenHash: crypto.createHash('sha256').update('111222').digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      tokenVersion: initialTokenVersion,
    },
  });

  try {
    // 1. Wrong OTP attempt
    const reqWrong = { body: { code: '999999', password: 'AttemptedPassword1!' } };
    const resWrong = createMockRes();
    await resetPassword(reqWrong, resWrong);
    assert.strictEqual(resWrong.statusCode, 400);

    let userAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(userAfter.tokenVersion, initialTokenVersion, 'tokenVersion must not change on wrong OTP');

    // 2. Short password attempt
    const reqShort = { body: { code: '111222', password: 'short' } };
    const resShort = createMockRes();
    await resetPassword(reqShort, resShort);
    assert.strictEqual(resShort.statusCode, 400);

    userAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(userAfter.tokenVersion, initialTokenVersion, 'tokenVersion must not change on short password');

    // 3. Expired OTP attempt
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordResetExpiresAt: new Date(Date.now() - 1000) },
    });
    const reqExpired = { body: { code: '111222', password: 'AttemptedPassword1!' } };
    const resExpired = createMockRes();
    await resetPassword(reqExpired, resExpired);
    assert.strictEqual(resExpired.statusCode, 400);

    userAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(userAfter.tokenVersion, initialTokenVersion, 'tokenVersion must not change on expired OTP');

    // Confirm original password remains intact
    const originalPasswordMatches = await bcrypt.compare(initialPassword, userAfter.passwordHash);
    assert.strictEqual(originalPasswordMatches, true, 'Original password must remain active');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

test('9. Full Auth Workflow — Registration, login, reset, re-login, and logout remain fully functional', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const uniqueTag = `sec_e2e_${Date.now()}`;
  const userEmail = `${uniqueTag}@example.com`;
  const initialPassword = 'InitialPass123!';
  const updatedPassword = 'BrandNewPass2026!';
  let createdUserId = null;

  try {
    // A. Register
    const regReq = {
      body: {
        name: 'E2E Workflow User',
        email: userEmail,
        password: initialPassword,
      },
    };
    const regRes = createMockRes();
    await registerUser(regReq, regRes);
    assert.strictEqual(regRes.statusCode, 201);
    assert.ok(regRes.body.id);
    createdUserId = regRes.body.id;
    assert.ok(regRes.cookies.jwt, 'Register must set jwt cookie');

    // B. Login
    const loginReq = { body: { email: userEmail, password: initialPassword } };
    const loginRes = createMockRes();
    await loginUser(loginReq, loginRes);
    assert.strictEqual(loginRes.statusCode, 200);
    assert.ok(loginRes.cookies.jwt, 'Login must set jwt cookie');

    // C. Request password reset
    const resetReqReq = { body: { email: userEmail } };
    const resetReqRes = createMockRes();
    await requestPasswordReset(resetReqReq, resetReqRes);
    assert.strictEqual(resetReqRes.statusCode, 200);

    // Extract generated hash and simulate user possessing OTP
    const userWithHash = await prisma.user.findUnique({ where: { id: createdUserId } });
    assert.ok(userWithHash.passwordResetTokenHash);

    // To reset deterministically, we can update to a known OTP hash
    const testOtp = '882244';
    const knownHash = crypto.createHash('sha256').update(testOtp).digest('hex');
    await prisma.user.update({
      where: { id: createdUserId },
      data: { passwordResetTokenHash: knownHash },
    });

    // D. Confirm password reset
    const confirmReq = { body: { code: testOtp, password: updatedPassword } };
    const confirmRes = createMockRes();
    await resetPassword(confirmReq, confirmRes);
    assert.strictEqual(confirmRes.statusCode, 200);

    // E. Re-login with updated password
    const reLoginReq = { body: { email: userEmail, password: updatedPassword } };
    const reLoginRes = createMockRes();
    await loginUser(reLoginReq, reLoginRes);
    assert.strictEqual(reLoginRes.statusCode, 200);

    // F. Logout
    const logoutReq = {};
    const logoutRes = createMockRes();
    logoutUser(logoutReq, logoutRes);
    assert.strictEqual(logoutRes.statusCode, 200);
    assert.strictEqual(logoutRes.cookies.jwt.value, '', 'Logout must clear jwt cookie');
  } finally {
    if (createdUserId) {
      await prisma.subscription.deleteMany({ where: { userId: createdUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    process.env.EMAIL_PROVIDER = originalProvider;
  }
});

test('10. Log Hygiene — No reset OTPs, reset URLs, or raw emails exposed during reset lifecycle', async () => {
  const originalProvider = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'mock';

  const uniqueTag = `sec_hygiene_${Date.now()}`;
  const userEmail = `${uniqueTag}@example.com`;
  const testUser = await prisma.user.create({
    data: {
      email: userEmail,
      name: 'Log Hygiene User',
      passwordHash: await bcrypt.hash('Password123!', 10),
    },
  });

  try {
    let capturedLogs = '';

    await captureConsoleOutput(async () => {
      // 1. Request reset
      const req1 = { body: { email: userEmail } };
      const res1 = createMockRes();
      await requestPasswordReset(req1, res1);

      // 2. Confirm reset with sample OTP
      const testOtp = '349281';
      const hash = crypto.createHash('sha256').update(testOtp).digest('hex');
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          passwordResetTokenHash: hash,
          passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const req2 = { body: { code: testOtp, password: 'NewSecurePassword2026!' } };
      const res2 = createMockRes();
      await resetPassword(req2, res2);
    }).then((logs) => {
      capturedLogs = logs;
    });

    // Check no raw email leaked
    assert.strictEqual(
      capturedLogs.includes(userEmail),
      false,
      'Raw email must NOT appear in application logs'
    );

    // Check no query parameter reset URL leaked
    assert.strictEqual(
      capturedLogs.includes('reset-password?code='),
      false,
      'Reset link with code parameter must NOT appear in logs'
    );

    // Check no 6-digit numeric sequences leaked in logs
    const sixDigitMatches = capturedLogs.match(/\b\d{6}\b/g) || [];
    assert.strictEqual(
      sixDigitMatches.length,
      0,
      `No 6-digit OTP code should be logged! Found: ${sixDigitMatches.join(', ')}`
    );

    // Check masked recipient is recorded
    const masked = hashRecipient(userEmail);
    assert.ok(capturedLogs.includes(masked), 'Masked recipient hash should appear in audit log');
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    process.env.EMAIL_PROVIDER = originalProvider;
  }
});
