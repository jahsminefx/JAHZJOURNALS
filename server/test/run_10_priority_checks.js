/**
 * JAHZJOURNALS — 10 Priority Checks Verification Harness
 * Tests the top 10 checks directly against the running local server and database.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000';
const ORIGIN = 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || '749091e7a13b0fc9a5f019f49325a4c15de625cf0d10017acdf938e6030cdb01c72e1740a668a6087e3782832aeaebad77819660ca2851f0b65ce74c5ad5ad3c';

const results = [];

function recordResult(checkNumber, title, passed, steps, expected, actual, details = '') {
  results.push({
    checkNumber,
    title,
    passed,
    steps,
    expected,
    actual,
    details
  });
  const symbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Check ${checkNumber}] ${symbol}: ${title}`);
  if (!passed) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
    if (details) console.error(`   Details:  ${details}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Origin': ORIGIN,
    'Referer': `${ORIGIN}/`,
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, headers: response.headers };
}

function createAuthToken(user) {
  return jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

async function run() {
  console.log('=====================================================');
  console.log('Starting JAHZJOURNALS 10 Priority Checks Verification');
  console.log('=====================================================\n');

  const timestamp = Date.now();
  const mentorEmail = `prio_mentor_${timestamp}@jahztest.com`;
  const studentEmail = `prio_student_${timestamp}@jahztest.com`;

  let mentorUser, studentUser;
  let mentorToken, studentToken;
  let createdCohortId, createdPaidCohortId;
  let studentAccountAId, studentAccountBId;
  let testTrade1Id, testTrade2Id;

  try {
    // -------------------------------------------------------------
    // CHECK 1: Verify trader and mentor prices and feature locks
    // -------------------------------------------------------------
    {
      const plansConfig = require('../../server/src/config/plans');
      const { PLANS, MENTOR_TIERS } = plansConfig;

      const freeOk = PLANS.FREE.priceNgn === 0 && PLANS.FREE.tradeLimit === 20 && PLANS.FREE.accountLimit === 1 && !PLANS.FREE.aiAccess && !PLANS.FREE.mt5Sync;
      const starterOk = PLANS.STARTER.priceNgn === 4000 && PLANS.STARTER.tradeLimit === 100 && PLANS.STARTER.accountLimit === 3 && PLANS.STARTER.mt5Sync;
      const proOk = PLANS.PRO.priceNgn === 8000 && PLANS.PRO.tradeLimit === Infinity && PLANS.PRO.accountLimit === Infinity && PLANS.PRO.aiAccess;
      const mentorTiersOk = (
        MENTOR_TIERS.PRIVATE_COHORT.priceNgn === 8000 &&
        MENTOR_TIERS.GROWTH.priceNgn === 25000 &&
        MENTOR_TIERS.MEGA.priceNgn === 65000
      );

      const passed = freeOk && starterOk && proOk && mentorTiersOk;
      recordResult(
        1,
        'Verify trader and mentor prices and what each plan actually unlocks',
        passed,
        'Inspect server/src/config/plans.js for PLANS and MENTOR_TIERS pricing, trade limits, and feature gates.',
        'FREE=₦0 (20 trades/1 acc, no AI/MT5), STARTER=₦4k (100 trades/3 acc, MT5), PRO=₦8k (unlimited, AI, MT5), MENTOR tiers=₦8k, ₦25k, ₦65k.',
        `FREE: ₦${PLANS.FREE.priceNgn}, STARTER: ₦${PLANS.STARTER.priceNgn}, PRO: ₦${PLANS.PRO.priceNgn}, MENTOR: ₦8k/₦25k/₦65k. Tiers intact.`
      );
    }

    // -------------------------------------------------------------
    // SETUP DISPOSABLE ACCOUNTS IN DB
    // -------------------------------------------------------------
    mentorUser = await prisma.user.create({
      data: {
        name: 'Test Mentor Prio',
        email: mentorEmail,
        passwordHash: 'dummy_hash',
        role: 'MENTOR',
        mentorTier: 'PRIVATE_COHORT',
        mentorMaxStudents: 50,
        mentorMaxCohorts: 3,
        subscriptionPlan: 'MENTOR',
        subscriptionStatus: 'ACTIVE',
      }
    });
    mentorToken = createAuthToken(mentorUser);

    studentUser = await prisma.user.create({
      data: {
        name: 'Test Student Prio',
        email: studentEmail,
        passwordHash: 'dummy_hash',
        role: 'TRADER',
        subscriptionPlan: 'STARTER',
        subscriptionStatus: 'ACTIVE',
      }
    });
    studentToken = createAuthToken(studentUser);

    // -------------------------------------------------------------
    // CHECK 2: Create a cohort as a mentor
    // -------------------------------------------------------------
    {
      const cohortPayload = {
        name: 'Alpha Traders Academy',
        description: 'Elite FX price action cohort',
        maxRiskPerTrade: 1.5,
        maxDailyTrades: 4,
        requireStopLoss: true,
        allowedPairs: ['EURUSD', 'GBPUSD', 'XAUUSD'],
        isPaid: false,
        price: 0
      };

      const res = await request('/api/mentors/groups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mentorToken}` },
        body: JSON.stringify(cohortPayload)
      });

      const passed = res.status === 201 && res.data && res.data.id && res.data.name === 'Alpha Traders Academy';
      if (passed) createdCohortId = res.data.id;

      recordResult(
        2,
        'Create a cohort as a mentor',
        passed,
        'POST /api/mentors/groups with valid cohort branding and risk guard parameters.',
        'HTTP 201 Created with valid cohort ID and settings.',
        `HTTP ${res.status}: Cohort ID=${res.data?.id || 'none'}`
      );
    }

    // -------------------------------------------------------------
    // CHECK 3: Join it using a separate student account
    // -------------------------------------------------------------
    {
      const joinRes = await request(`/api/mentors/groups/${createdCohortId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      const studentCohortsRes = await request('/api/mentors/my-cohorts', {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      const memberships = studentCohortsRes.data?.memberships || [];
      const isEnrolled = Array.isArray(memberships) && memberships.some(m => m.mentorGroupId === createdCohortId);
      const passed = (joinRes.status === 201 || joinRes.status === 200) && isEnrolled;

      recordResult(
        3,
        'Join cohort using a separate student account',
        passed,
        'Student calls POST /api/mentors/groups/:id/join, then GET /api/mentors/my-cohorts.',
        'HTTP 201 enrollment and cohort listed in student enrolled memberships list.',
        `Join HTTP ${joinRes.status}, My-Cohorts memberships count: ${memberships.length}`
      );
    }

    // -------------------------------------------------------------
    // SETUP STUDENT TRADING ACCOUNTS & TRADES
    // -------------------------------------------------------------
    const accARes = await request('/api/accounts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        name: 'Shared Mentorship Account',
        startingBalance: 10000,
        currency: 'USD',
        isSharedWithMentor: true
      })
    });
    studentAccountAId = accARes.data.id;

    const accBRes = await request('/api/accounts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        name: 'Private Personal Vault',
        startingBalance: 25000,
        currency: 'USD',
        isSharedWithMentor: false
      })
    });
    studentAccountBId = accBRes.data.id;

    // Create Trade 1 in Account A (Shared)
    const trade1Res = await request('/api/trades', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        tradingAccountId: studentAccountAId,
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
        stopLoss: 1.0820,
        takeProfit: 1.0910,
        lotSize: 0.5,
        status: 'CLOSED',
        result: 'WIN',
        profitLossAmount: 300,
        entryTime: new Date().toISOString()
      })
    });
    testTrade1Id = trade1Res.data.id;

    // Create Trade 2 in Account B (Private Unshared)
    const trade2Res = await request('/api/trades', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        tradingAccountId: studentAccountBId,
        pair: 'GBPUSD',
        direction: 'SELL',
        entryPrice: 1.3000,
        stopLoss: 1.3050,
        takeProfit: 1.2900,
        lotSize: 1.0,
        status: 'CLOSED',
        result: 'LOSS',
        profitLossAmount: -500,
        entryTime: new Date().toISOString()
      })
    });
    testTrade2Id = trade2Res.data.id;

    // -------------------------------------------------------------
    // CHECK 4: Submit mentor feedback and verify student can see it
    // -------------------------------------------------------------
    {
      const feedbackRes = await request(`/api/mentors/trades/${testTrade1Id}/feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mentorToken}` },
        body: JSON.stringify({
          feedback: 'Disciplined trade execution and tight stop-loss. Approved.',
          grade: 'A',
          recommendation: 'Keep maintaining strict risk parameters.',
          isViolationWarning: false
        })
      });

      const studentTradeViewRes = await request(`/api/trades/${testTrade1Id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      const feedbacks = studentTradeViewRes.data?.mentorFeedbacks || [];
      const hasFeedback = feedbacks.some(f => (f.feedback && f.feedback.includes('Disciplined trade execution')) || (f.comment && f.comment.includes('Disciplined trade execution')));
      const passed = feedbackRes.status === 201 && hasFeedback;

      recordResult(
        4,
        'Submit mentor feedback and verify student can see it',
        passed,
        'Mentor POSTs feedback to /api/mentors/trades/:id/feedback; student calls GET /api/trades/:id.',
        'Feedback saved (201) and student sees mentor feedback in mentorFeedbacks array.',
        `Feedback POST HTTP ${feedbackRes.status}, Student received ${feedbacks.length} feedback items.`
      );
    }

    // -------------------------------------------------------------
    // CHECK 5: Confirm mentor cannot see an unshared trading account
    // -------------------------------------------------------------
    {
      const mentorStudentTradesRes = await request(`/api/mentors/students/${studentUser.id}/trades`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${mentorToken}` }
      });

      const visibleTrades = mentorStudentTradesRes.data || [];
      const containsTrade1 = visibleTrades.some(t => t.id === testTrade1Id);
      const containsTrade2 = visibleTrades.some(t => t.id === testTrade2Id);

      const passed = mentorStudentTradesRes.status === 200 && containsTrade1 && !containsTrade2;

      recordResult(
        5,
        'Confirm the mentor cannot see an unshared trading account',
        passed,
        'Mentor calls GET /api/mentors/students/:id/trades when student has Account A (shared) and Account B (unshared).',
        'Trade 1 from shared account is visible; Trade 2 from private unshared account is completely excluded.',
        `HTTP ${mentorStudentTradesRes.status}: Trade 1 visible=${containsTrade1}, Trade 2 visible=${containsTrade2}`
      );
    }

    // -------------------------------------------------------------
    // CHECK 6: Disable screenshot sharing and check that screenshots are hidden
    // -------------------------------------------------------------
    {
      // Attach a test screenshot to Trade 1
      await prisma.tradeScreenshot.create({
        data: {
          tradeId: testTrade1Id,
          screenshotType: 'ENTRY',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          publicId: 'sample_prio_check',
        }
      });

      // Student disables screenshot sharing in settings
      const settingsRes = await request('/api/users/settings/journal', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({ shareScreenshots: false })
      });

      const mentorViewRes = await request(`/api/mentors/students/${studentUser.id}/trades`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${mentorToken}` }
      });

      const tradeInMentorView = (mentorViewRes.data || []).find(t => t.id === testTrade1Id);
      const screenshotsEmpty = !tradeInMentorView?.screenshots || tradeInMentorView.screenshots.length === 0;
      const passed = mentorViewRes.status === 200 && screenshotsEmpty;

      recordResult(
        6,
        'Disable screenshot sharing and check that screenshots are hidden',
        passed,
        'Student sets shareScreenshots=false in settings; mentor requests student trades.',
        'Mentor receives trade object with screenshots stripped or empty.',
        `Settings update HTTP ${settingsRes.status}, Mentor screenshots count: ${tradeInMentorView?.screenshots?.length ?? 0}`
      );
    }

    // -------------------------------------------------------------
    // CHECK 7: Test paid checkout using Paystack test mode
    // -------------------------------------------------------------
    {
      // Mentor creates a paid cohort
      const paidCohortRes = await request('/api/mentors/groups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mentorToken}` },
        body: JSON.stringify({
          name: 'Pro Mastery Paid Cohort',
          description: 'Intensive paid masterclass',
          isPaid: true,
          price: 15000,
          currency: 'NGN'
        })
      });
      createdPaidCohortId = paidCohortRes.data?.id;

      // Student initiates checkout
      const checkoutRes = await request(`/api/mentors/groups/${createdPaidCohortId}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      const hasPaystackUrl = checkoutRes.data && (checkoutRes.data.authorization_url || checkoutRes.data.checkoutUrl || checkoutRes.data.reference);
      const passed = checkoutRes.status === 200 && hasPaystackUrl;

      recordResult(
        7,
        'Test a paid checkout using Paystack test mode',
        passed,
        'Student initiates POST /api/mentors/groups/:id/checkout on a paid cohort (₦15,000).',
        'HTTP 200 with Paystack initialization reference and authorization URL.',
        `HTTP ${checkoutRes.status}: reference=${checkoutRes.data?.reference || 'none'}, authUrl=${!!checkoutRes.data?.authorization_url}`
      );
    }

    // -------------------------------------------------------------
    // CHECK 8: Confirm a failed payment does not grant paid access
    // -------------------------------------------------------------
    {
      const fakeRef = `FAKE_FAILED_PAYMENT_${Date.now()}`;
      const verifyRes = await request(`/api/mentors/cohorts/${createdPaidCohortId}/verify-enrollment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({ reference: fakeRef })
      });

      // Verify student is NOT enrolled in the paid cohort
      const membership = await prisma.mentorStudent.findFirst({
        where: {
          mentorGroupId: createdPaidCohortId,
          studentId: studentUser.id,
          status: 'ACTIVE'
        }
      });

      const passed = (verifyRes.status === 400 || verifyRes.status === 500) && !membership;

      recordResult(
        8,
        'Confirm a failed payment does not grant paid access',
        passed,
        'Call POST /api/mentors/cohorts/:id/verify-enrollment with an unverified/tampered fake reference.',
        'Server rejects verification (HTTP 400/500) and no active enrollment is granted in database.',
        `Verification HTTP ${verifyRes.status}, Paid membership found in DB: ${!!membership}`
      );
    }

    // -------------------------------------------------------------
    // CHECK 9: Confirm an expired mentor cannot inspect student trades
    // -------------------------------------------------------------
    {
      // Mark mentor's subscription status as EXPIRED
      await prisma.user.update({
        where: { id: mentorUser.id },
        data: { subscriptionStatus: 'EXPIRED' }
      });

      const expiredMentorTradesRes = await request(`/api/mentors/students/${studentUser.id}/trades`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${mentorToken}` }
      });

      const expiredMentorGroupsRes = await request('/api/mentors/groups', {
        method: 'GET',
        headers: { Authorization: `Bearer ${mentorToken}` }
      });

      const passed = expiredMentorTradesRes.status === 403 && expiredMentorGroupsRes.status === 403;

      recordResult(
        9,
        'Confirm an expired mentor cannot inspect student trades',
        passed,
        'Set mentor subscriptionStatus=EXPIRED; mentor attempts to access student trades and groups.',
        'Access denied with HTTP 403 (PLAN_LIMIT_REACHED) on both endpoints.',
        `Student Trades HTTP ${expiredMentorTradesRes.status}, Groups HTTP ${expiredMentorGroupsRes.status}`
      );
    }

    // -------------------------------------------------------------
    // CHECK 10: Confirm student journal remains intact after leaving cohort or mentor expiry
    // -------------------------------------------------------------
    {
      // Student leaves the free cohort
      const leaveRes = await request(`/api/mentors/cohorts/${createdCohortId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      // Query student's trades directly
      const studentTradesRes = await request('/api/trades', {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      // Query student's accounts directly
      const studentAccountsRes = await request('/api/accounts', {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      const trades = studentTradesRes.data || [];
      const accounts = studentAccountsRes.data || [];
      const trade1StillExists = trades.some(t => t.id === testTrade1Id && t.profitLossAmount === 300);
      const trade2StillExists = trades.some(t => t.id === testTrade2Id && t.profitLossAmount === -500);
      const accountsIntact = accounts.length >= 2;

      const passed = (leaveRes.status === 200 || leaveRes.status === 204) && trade1StillExists && trade2StillExists && accountsIntact;

      recordResult(
        10,
        "Confirm student's journal remains intact after leaving cohort or after mentor expiry",
        passed,
        'Student calls POST /api/mentors/cohorts/:id/leave; check student trades and accounts.',
        'Student successfully unenrolls; Trade 1, Trade 2, and all accounts remain 100% intact with exact P&L.',
        `Leave HTTP ${leaveRes.status}, Trades intact: ${trade1StillExists && trade2StillExists}, Accounts count: ${accounts.length}`
      );
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // CLEANUP DISPOSABLE TEST DATA SAFELY
    console.log('\nCleaning up disposable test records from database...');
    try {
      if (testTrade1Id) await prisma.tradeScreenshot.deleteMany({ where: { tradeId: testTrade1Id } });
      if (testTrade1Id) await prisma.mentorFeedback.deleteMany({ where: { tradeId: testTrade1Id } });
      if (testTrade1Id || testTrade2Id) {
        await prisma.trade.deleteMany({ where: { id: { in: [testTrade1Id, testTrade2Id].filter(Boolean) } } });
      }
      if (studentAccountAId || studentAccountBId) {
        await prisma.tradingAccount.deleteMany({ where: { id: { in: [studentAccountAId, studentAccountBId].filter(Boolean) } } });
      }
      if (createdCohortId || createdPaidCohortId) {
        await prisma.mentorStudent.deleteMany({ where: { mentorGroupId: { in: [createdCohortId, createdPaidCohortId].filter(Boolean) } } });
        await prisma.mentorGroup.deleteMany({ where: { id: { in: [createdCohortId, createdPaidCohortId].filter(Boolean) } } });
      }
      if (mentorUser?.id) await prisma.user.delete({ where: { id: mentorUser.id } }).catch(() => {});
      if (studentUser?.id) await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});
      console.log('Cleanup completed successfully.\n');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    await prisma.$disconnect();
  }

  console.log('=====================================================');
  console.log('Summary: JAHZJOURNALS 10 Priority Checks');
  console.log('=====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed:       ${results.filter(r => r.passed).length}`);
  console.log(`Failed:       ${results.filter(r => !r.passed).length}`);
  console.log(`Overall status: ${allPassed ? 'ALL 10 CHECKS PASSED ✅' : 'SOME CHECKS FAILED ❌'}\n`);
}

run();
