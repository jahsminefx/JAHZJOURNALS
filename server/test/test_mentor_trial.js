const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000';
const ORIGIN = 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || '749091e7a13b0fc9a5f019f49325a4c15de625cf0d10017acdf938e6030cdb01c72e1740a668a6087e3782832aeaebad77819660ca2851f0b65ce74c5ad5ad3c';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Origin': ORIGIN,
    'Referer': `${ORIGIN}/`,
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  let data;
  try {
    data = await response.json();
  } catch (_) {
    data = await response.text();
  }
  return { status: response.status, data };
}

function createAuthToken(user) {
  return jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

async function run() {
  console.log('Testing 14-Day Mentor Free Trial Activation Workflow...\n');
  const timestamp = Date.now();
  const testEmail = `trial_trader_${timestamp}@jahztest.com`;
  let testUser;

  try {
    // 1. Create registered trader on FREE plan
    testUser = await prisma.user.create({
      data: {
        name: 'Existing Registered Trader',
        email: testEmail,
        passwordHash: 'dummy_hash',
        role: 'TRADER',
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'ACTIVE',
      }
    });
    const token = createAuthToken(testUser);
    console.log('✓ Created registered trader user on FREE plan.');

    // 2. Check trial status before activation
    const statusBefore = await request('/api/subscriptions/mentor-trial/status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status before:', statusBefore.data);
    if (!statusBefore.data.canActivateTrial) throw new Error('Expected canActivateTrial to be true');

    // 3. Activate 14-Day Mentor Free Trial
    const activateRes = await request('/api/subscriptions/mentor-trial/activate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Activate response:', activateRes.status, activateRes.data);
    if (activateRes.status !== 200) throw new Error('Activation failed');

    // 4. Verify user upgraded to MENTOR with 14-day expiration
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log('Updated user in DB:', {
      role: updatedUser.role,
      subscriptionPlan: updatedUser.subscriptionPlan,
      subscriptionStatus: updatedUser.subscriptionStatus,
      mentorTier: updatedUser.mentorTier,
      mentorMaxStudents: updatedUser.mentorMaxStudents,
      hasUsedMentorTrial: updatedUser.hasUsedMentorTrial,
      mentorTrialExpiresAt: updatedUser.mentorTrialExpiresAt
    });

    const trialDurationDays = (new Date(updatedUser.mentorTrialExpiresAt) - new Date()) / (24 * 60 * 60 * 1000);
    console.log(`✓ Trial duration calculated: ~${trialDurationDays.toFixed(2)} days (Target: 14.00 days).`);

    if (updatedUser.role !== 'MENTOR' || updatedUser.subscriptionPlan !== 'MENTOR' || !updatedUser.hasUsedMentorTrial) {
      throw new Error('User was not upgraded correctly to MENTOR');
    }

    // 5. Verify user CANNOT activate trial again
    const secondTry = await request('/api/subscriptions/mentor-trial/activate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Second activation attempt:', secondTry.status, secondTry.data);
    if (secondTry.status !== 403) throw new Error('Expected 403 for duplicate trial activation');
    console.log('✓ Prevented duplicate trial activation successfully.');

    // 6. Test 12-Hour Grace Period Behavior
    console.log('\n--- Testing 12-Hour Grace Period Retention ---');
    // Set expiresAt to 2 hours ago (within 12h grace window)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.subscription.updateMany({
      where: { userId: testUser.id },
      data: { expiresAt: twoHoursAgo }
    });
    await prisma.user.update({
      where: { id: testUser.id },
      data: { mentorTrialExpiresAt: twoHoursAgo }
    });

    const { sweepAndDowngradeExpiredPromotions } = require('../src/services/subscriptionCron');
    const graceSweepResult = await sweepAndDowngradeExpiredPromotions();
    console.log('Sweeper result during grace period:', graceSweepResult);

    const graceUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log('User status during grace period:', {
      role: graceUser.role,
      subscriptionPlan: graceUser.subscriptionPlan,
      subscriptionStatus: graceUser.subscriptionStatus
    });

    if (graceUser.role !== 'MENTOR' || graceUser.subscriptionPlan !== 'MENTOR') {
      throw new Error('User was incorrectly downgraded during the 12-hour grace window!');
    }
    console.log('✓ User retained MENTOR access during the 12-hour grace period.');

    // Check trial status API response during grace period
    const statusDuringGrace = await request('/api/subscriptions/mentor-trial/status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status API during grace:', statusDuringGrace.data);
    if (!statusDuringGrace.data.isInGracePeriod || statusDuringGrace.data.isTrialActive || statusDuringGrace.data.canActivateTrial) {
      throw new Error('Trial status API did not report isInGracePeriod=true during grace period');
    }
    console.log(`✓ Trial status API correctly reports isInGracePeriod=true (~${statusDuringGrace.data.graceHoursRemaining} hours left).`);

    // 7. Test Downgrade AFTER 12-Hour Grace Period Elapses
    console.log('\n--- Testing Downgrade After 12-Hour Grace Period Elapses ---');
    // Set expiresAt to 13 hours ago (past 12h grace window)
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000);
    await prisma.subscription.updateMany({
      where: { userId: testUser.id },
      data: { expiresAt: thirteenHoursAgo }
    });
    await prisma.user.update({
      where: { id: testUser.id },
      data: { mentorTrialExpiresAt: thirteenHoursAgo }
    });

    const postGraceSweepResult = await sweepAndDowngradeExpiredPromotions();
    console.log('Sweeper result after grace period:', postGraceSweepResult);

    const postGraceUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log('Post-grace user in DB:', {
      role: postGraceUser.role,
      subscriptionPlan: postGraceUser.subscriptionPlan,
      subscriptionStatus: postGraceUser.subscriptionStatus,
      hasUsedMentorTrial: postGraceUser.hasUsedMentorTrial
    });

    if (postGraceUser.role !== 'TRADER' || postGraceUser.subscriptionPlan !== 'FREE') {
      throw new Error('User was not cleanly downgraded back to TRADER/FREE after grace period elapsed');
    }
    if (!postGraceUser.hasUsedMentorTrial) {
      throw new Error('hasUsedMentorTrial must stay true forever');
    }
    console.log('✓ User safely reverted to TRADER role and FREE plan after grace period expired.');

    // 8. Test Strict Single-Use Rule: Attempting to Re-Activate Trial
    console.log('\n--- Testing Strict Single-Use Rule After Downgrade ---');
    const thirdTry = await request('/api/subscriptions/mentor-trial/activate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Re-activation attempt response:', thirdTry.status, thirdTry.data);
    if (thirdTry.status !== 403 || thirdTry.data.code !== 'TRIAL_ALREADY_USED') {
      throw new Error('Expected 403 TRIAL_ALREADY_USED for re-activation attempt');
    }
    console.log('✓ Successfully blocked re-activation attempt! Strict single-use rule enforced.');

    console.log('\nALL 14-DAY MENTOR TRIAL & 12-HOUR GRACE PERIOD TESTS PASSED! ✅');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    if (testUser?.id) {
      await prisma.notificationRecipient.deleteMany({ where: { userId: testUser.id } });
      await prisma.subscriptionHistory.deleteMany({ where: { userId: testUser.id } });
      await prisma.subscription.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      console.log('Cleaned up test user.');
    }
    await prisma.$disconnect();
  }
}

run();
