const test = require('node:test');
const assert = require('node:assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireMentorPlan } = require('../src/middleware/subscriptionGate');
const {
  createTradeShare,
  updateTradeShare,
  deleteTradeShare,
  createAnnouncement,
  getStudentFeed,
  getTradeShareDetail,
  markFeedItemRead,
  getMyStudentReviews,
  buildAudienceSafeTradeSnapshot,
  logSharedTradeToStudentJournal,
  getDirectChatThreads,
  getDirectMessages,
  sendDirectMessage,
} = require('../src/controllers/cohortSharingController');

// Mock helper for Express req/res
const createMockHttp = ({ user = null, params = {}, query = {}, body = {} } = {}) => {
  const req = { user, params, query, body };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
};

test('Cohort Sharing Suite: audience-safe trade snapshot stripping test', () => {
  const rawTrade = {
    id: 'tr-123',
    pair: 'EURUSD',
    direction: 'BUY',
    entryPrice: 1.085,
    stopLoss: 1.082,
    takeProfit: 1.091,
    exitPrice: 1.091,
    lotSize: 5.0,
    riskAmount: 1500,
    rewardAmount: 4500,
    profitLossAmount: 4500,
    profitLossPercent: 3.0,
    riskRewardRatio: 3.0,
    pips: 60,
    result: 'WIN',
    status: 'CLOSED',
    session: 'LONDON',
    higherTimeframe: '4H',
    entryTimeframe: '15m',
    htfBias: 'BULLISH',
    entryTime: new Date('2026-10-15T08:00:00Z'),
    exitTime: new Date('2026-10-15T13:00:00Z'),
    // Sensitive account & internal fields that must NEVER leak to students
    tradingAccountId: 'acc-secret-999',
    externalId: 'ext-meta-secret',
    syncToken: 'sync-xyz-secret',
    tradingAccount: {
      id: 'acc-secret-999',
      brokerName: 'Secret Broker',
      accountCategory: 'PROP_FIRM',
      startingBalance: 100000,
      currentBalance: 115000,
      cloudLogin: '9999999',
      cloudInvestorPassword: 'password-secret',
      currency: 'USD',
    },
  };

  const safeSnapshot = buildAudienceSafeTradeSnapshot(rawTrade);

  // Safe trading fields must be present
  assert.strictEqual(safeSnapshot.pair, 'EURUSD');
  assert.strictEqual(safeSnapshot.direction, 'BUY');
  assert.strictEqual(safeSnapshot.entryPrice, 1.085);
  assert.strictEqual(safeSnapshot.stopLoss, 1.082);
  assert.strictEqual(safeSnapshot.takeProfit, 1.091);
  assert.strictEqual(safeSnapshot.exitPrice, 1.091);
  assert.strictEqual(safeSnapshot.pips, 60);
  assert.strictEqual(safeSnapshot.riskRewardRatio, 3.0);
  assert.strictEqual(safeSnapshot.profitLossPercent, 3.0);
  assert.strictEqual(safeSnapshot.result, 'WIN');
  assert.strictEqual(safeSnapshot.status, 'CLOSED');
  assert.strictEqual(safeSnapshot.session, 'LONDON');
  assert.strictEqual(safeSnapshot.currency, 'USD');

  // Sensitive account fields must be completely undefined
  assert.strictEqual(safeSnapshot.tradingAccountId, undefined);
  assert.strictEqual(safeSnapshot.tradingAccount, undefined);
  assert.strictEqual(safeSnapshot.startingBalance, undefined);
  assert.strictEqual(safeSnapshot.currentBalance, undefined);
  assert.strictEqual(safeSnapshot.brokerName, undefined);
  assert.strictEqual(safeSnapshot.cloudLogin, undefined);
  assert.strictEqual(safeSnapshot.cloudInvestorPassword, undefined);
  assert.strictEqual(safeSnapshot.externalId, undefined);
  assert.strictEqual(safeSnapshot.syncToken, undefined);
});

test('Cohort Sharing End-to-End: Sharing, Scoping, Feed, and IDOR protection', async () => {
  const timestamp = Date.now();

  // 1. Create Mentor
  const mentor = await prisma.user.create({
    data: {
      email: `mentor_share_${timestamp}@jahztest.com`,
      name: 'Dr. Mentor Share',
      passwordHash: 'dummyhash',
      role: 'MENTOR',
      subscriptionPlan: 'MENTOR',
      subscriptionStatus: 'ACTIVE',
    },
  });

  // 2. Create Two Cohorts for Mentor
  const cohortA = await prisma.mentorGroup.create({
    data: {
      mentorId: mentor.id,
      name: `Academy Cohort A ${timestamp}`,
      academyName: 'Apex FX Academy',
    },
  });

  const cohortB = await prisma.mentorGroup.create({
    data: {
      mentorId: mentor.id,
      name: `Academy Cohort B ${timestamp}`,
      academyName: 'Apex FX Academy',
    },
  });

  // 3. Create Another Unrelated Mentor & Cohort
  const otherMentor = await prisma.user.create({
    data: {
      email: `other_mentor_${timestamp}@jahztest.com`,
      name: 'Other Mentor',
      passwordHash: 'dummyhash',
      role: 'MENTOR',
      subscriptionPlan: 'MENTOR',
      subscriptionStatus: 'ACTIVE',
    },
  });

  const otherCohort = await prisma.mentorGroup.create({
    data: {
      mentorId: otherMentor.id,
      name: `Rival Academy ${timestamp}`,
    },
  });

  // 4. Create Students
  // Student 1: Enrolled in Cohort A only
  const student1 = await prisma.user.create({
    data: {
      email: `student1_${timestamp}@jahztest.com`,
      name: 'Alice Student',
      passwordHash: 'dummyhash',
      role: 'TRADER',
    },
  });

  await prisma.mentorStudent.create({
    data: {
      mentorGroupId: cohortA.id,
      studentId: student1.id,
      status: 'ACTIVE',
    },
  });

  // Student 2: Enrolled in Cohort B only
  const student2 = await prisma.user.create({
    data: {
      email: `student2_${timestamp}@jahztest.com`,
      name: 'Bob Student',
      passwordHash: 'dummyhash',
      role: 'TRADER',
    },
  });

  await prisma.mentorStudent.create({
    data: {
      mentorGroupId: cohortB.id,
      studentId: student2.id,
      status: 'ACTIVE',
    },
  });

  // Student 3: Inactive / Removed from Cohort A
  const student3 = await prisma.user.create({
    data: {
      email: `student3_${timestamp}@jahztest.com`,
      name: 'Charlie Ex-Student',
      passwordHash: 'dummyhash',
      role: 'TRADER',
    },
  });

  await prisma.mentorStudent.create({
    data: {
      mentorGroupId: cohortA.id,
      studentId: student3.id,
      status: 'INACTIVE',
    },
  });

  // 5. Create a Trading Account & Trade for Mentor
  const mentorAccount = await prisma.tradingAccount.create({
    data: {
      userId: mentor.id,
      name: 'Mentor Pro Account',
      startingBalance: 100000,
      currentBalance: 104500,
      currency: 'USD',
    },
  });

  const mentorTrade = await prisma.trade.create({
    data: {
      tradingAccountId: mentorAccount.id,
      pair: 'GBPUSD',
      direction: 'SELL',
      entryPrice: 1.295,
      stopLoss: 1.298,
      takeProfit: 1.286,
      exitPrice: 1.286,
      pips: 90,
      result: 'WIN',
      status: 'CLOSED',
      riskRewardRatio: 3.0,
      profitLossPercent: 2.7,
      profitLossAmount: 2700,
    },
  });

  try {
    // --- TEST A: Unauthorized Mentor Sharing to Other Mentor's Cohort (IDOR) ---
    const unauthorizedMock = createMockHttp({
      user: { id: mentor.id, role: 'MENTOR' },
      body: {
        targetCohortIds: [otherCohort.id], // Cohort belongs to otherMentor!
        sourceTradeId: mentorTrade.id,
        title: 'Malicious Share Attempt',
      },
    });

    await createTradeShare(unauthorizedMock.req, unauthorizedMock.res);
    assert.strictEqual(unauthorizedMock.getStatus(), 403);
    assert.match(unauthorizedMock.getData().message, /not authorized/i);

    // --- TEST B: Mentor Shares Trade with Cohort A Only ---
    const shareMock = createMockHttp({
      user: { id: mentor.id, role: 'MENTOR' },
      body: {
        targetCohortIds: [cohortA.id],
        sourceTradeId: mentorTrade.id,
        title: 'GBPUSD London Breakdown',
        setupThesis: 'Bearish market structure shift on 15m.',
        entryReasoning: 'Liquidity sweep above previous day high.',
        riskRationale: 'Risking 0.9% above London high.',
        isCaseStudy: true,
        pinned: true,
        status: 'PUBLISHED',
      },
    });

    await createTradeShare(shareMock.req, shareMock.res);
    assert.strictEqual(shareMock.getStatus(), 201);
    const createdShare = shareMock.getData().tradeShare;
    assert.ok(createdShare.id);
    assert.strictEqual(createdShare.title, 'GBPUSD London Breakdown');
    assert.strictEqual(createdShare.tradeSnapshot.pair, 'GBPUSD');
    assert.strictEqual(createdShare.tradeSnapshot.result, 'WIN');
    assert.strictEqual(createdShare.tradeSnapshot.tradingAccountId, undefined);

    // --- TEST C: Mentor Creates Announcement in Cohort A ---
    const announceMock = createMockHttp({
      user: { id: mentor.id, role: 'MENTOR' },
      body: {
        mentorGroupId: cohortA.id,
        title: 'Weekly Market Outlook Webinar',
        content: 'Join us live on Zoom this Thursday at 7 PM UTC.',
        category: 'WEBINAR',
        isPinned: true,
        status: 'PUBLISHED',
      },
    });

    await createAnnouncement(announceMock.req, announceMock.res);
    assert.strictEqual(announceMock.getStatus(), 201);
    const createdAnnouncement = announceMock.getData().announcement;
    assert.strictEqual(createdAnnouncement.title, 'Weekly Market Outlook Webinar');

    // --- TEST D: Student 1 (Enrolled in Cohort A) Sees Feed Items ---
    const student1FeedMock = createMockHttp({
      user: { id: student1.id, role: 'TRADER' },
      query: {},
    });

    await getStudentFeed(student1FeedMock.req, student1FeedMock.res);
    assert.strictEqual(student1FeedMock.getStatus(), 200);
    const student1Feed = student1FeedMock.getData().feed;
    assert.strictEqual(student1Feed.length, 2); // 1 Trade Share + 1 Announcement
    assert.strictEqual(student1Feed[0].isPinned, true);
    assert.strictEqual(student1Feed[0].isRead, false);

    // --- TEST E: Student 2 (Enrolled in Cohort B only) CANNOT See Cohort A's Content ---
    const student2FeedMock = createMockHttp({
      user: { id: student2.id, role: 'TRADER' },
      query: {},
    });

    await getStudentFeed(student2FeedMock.req, student2FeedMock.res);
    assert.strictEqual(student2FeedMock.getStatus(), 200);
    const student2Feed = student2FeedMock.getData().feed;
    assert.strictEqual(student2Feed.length, 0); // No items shared to Cohort B

    // --- TEST F: Student 2 Direct IDOR Attempt on Cohort A Trade Share ---
    const student2DetailMock = createMockHttp({
      user: { id: student2.id, role: 'TRADER' },
      params: { id: createdShare.id },
    });

    await getTradeShareDetail(student2DetailMock.req, student2DetailMock.res);
    assert.strictEqual(student2DetailMock.getStatus(), 403);
    assert.match(student2DetailMock.getData().message, /active membership/i);

    // --- TEST G: Student 3 (Inactive/Removed) CANNOT Access Trade Share ---
    const student3DetailMock = createMockHttp({
      user: { id: student3.id, role: 'TRADER' },
      params: { id: createdShare.id },
    });

    await getTradeShareDetail(student3DetailMock.req, student3DetailMock.res);
    assert.strictEqual(student3DetailMock.getStatus(), 403);
    assert.match(student3DetailMock.getData().message, /active membership/i);

    // --- TEST H: Student 1 Reads Trade Share and Updates Read State ---
    const student1DetailMock = createMockHttp({
      user: { id: student1.id, role: 'TRADER' },
      params: { id: createdShare.id },
    });

    await getTradeShareDetail(student1DetailMock.req, student1DetailMock.res);
    assert.strictEqual(student1DetailMock.getStatus(), 200);
    assert.strictEqual(student1DetailMock.getData().title, 'GBPUSD London Breakdown');

    // Confirm read state is reflected in feed
    const student1UpdatedFeedMock = createMockHttp({
      user: { id: student1.id, role: 'TRADER' },
      query: {},
    });

    await getStudentFeed(student1UpdatedFeedMock.req, student1UpdatedFeedMock.res);
    const updatedFeed = student1UpdatedFeedMock.getData().feed;
    const tradeItem = updatedFeed.find((i) => i.id === createdShare.id);
    assert.strictEqual(tradeItem.isRead, true);

    // --- TEST I: Student Reviews Feed (`getMyStudentReviews`) ---
    // Create a student trade and mentor feedback
    const studentAccount = await prisma.tradingAccount.create({
      data: {
        userId: student1.id,
        name: 'Student Demo Account',
        startingBalance: 10000,
        currentBalance: 10250,
      },
    });

    const studentTrade = await prisma.trade.create({
      data: {
        tradingAccountId: studentAccount.id,
        pair: 'EURUSD',
        direction: 'BUY',
        result: 'WIN',
        status: 'CLOSED',
        profitLossAmount: 250,
      },
    });

    await prisma.mentorFeedback.create({
      data: {
        mentorId: mentor.id,
        tradeId: studentTrade.id,
        feedback: 'Great patience on the retest. Solid 1R execution.',
        grade: 'A',
        recommendation: 'Keep managing risk consistently.',
      },
    });

    const studentReviewsMock = createMockHttp({
      user: { id: student1.id, role: 'TRADER' },
    });

    await getMyStudentReviews(studentReviewsMock.req, studentReviewsMock.res);
    assert.strictEqual(studentReviewsMock.getStatus(), 200);
    const reviews = studentReviewsMock.getData().feedbacks;
    assert.strictEqual(reviews.length, 1);
    assert.strictEqual(reviews[0].grade, 'A');
    assert.strictEqual(reviews[0].mentor.name, 'Dr. Mentor Share');
    assert.strictEqual(reviews[0].trade.pair, 'EURUSD');

    // --- TEST J: Granular Visibility Options & Direct Academy Setup Sharing ---
    const directSetupMock = createMockHttp({
      user: { id: mentor.id, role: 'MENTOR' },
      body: {
        targetCohortIds: [cohortA.id, cohortB.id],
        title: 'XAUUSD NY Session Signal & Case Study',
        setupThesis: 'Liquidity sweep of London low into 4H OB.',
        visibilityOptions: {
          showPrices: true,
          showRR: true,
          showResult: true,
          showPnLPercent: true,
          showPnLDollar: true,
          showPips: true,
          showLotSize: false,
          showSession: true,
        },
        customTradeSetup: {
          pair: 'XAUUSD',
          direction: 'BUY',
          entryPrice: 2650.0,
          stopLoss: 2642.0,
          takeProfit: 2674.0,
          exitPrice: 2674.0,
          riskRewardRatio: 3.0,
          profitLossPercent: 3.2,
          profitLoss: 1600,
          pips: 240,
          result: 'WIN',
          session: 'NEW_YORK',
        },
      },
    });

    await createTradeShare(directSetupMock.req, directSetupMock.res);
    assert.strictEqual(directSetupMock.getStatus(), 201);
    const directShare = directSetupMock.getData().tradeShare;
    assert.strictEqual(directShare.tradeSnapshot.pair, 'XAUUSD');
    assert.strictEqual(directShare.tradeSnapshot.riskRewardRatio, 3.0);
    assert.strictEqual(directShare.tradeSnapshot.profitLoss, 1600);
    assert.strictEqual(directShare.tradeSnapshot.lotSize, null);

    // --- TEST K: Student 1 Logs Shared Setup to Personal Journal ---
    const logSetupMock = createMockHttp({
      user: { id: student1.id, role: 'TRADER' },
      params: { id: directShare.id },
      body: { tradingAccountId: studentAccount.id, status: 'PLANNED' },
    });

    await logSharedTradeToStudentJournal(logSetupMock.req, logSetupMock.res);
    assert.strictEqual(logSetupMock.getStatus(), 201);
    assert.strictEqual(logSetupMock.getData().trade.pair, 'XAUUSD');
    assert.strictEqual(logSetupMock.getData().trade.entryPrice, 2650.0);

    // --- TEST L: Multi-Cohort Announcement Broadcast with ASSIGNMENT Category ---
    const multiAnnounceMock = createMockHttp({
      user: { id: mentor.id, role: 'MENTOR' },
      body: {
        targetCohortIds: [cohortA.id, cohortB.id],
        title: 'Weekend Chart Markup Assignment',
        content: 'Mark up 3 liquidity sweeps on GBPUSD and XAUUSD before Monday.',
        category: 'ASSIGNMENT',
        isPinned: false,
        status: 'PUBLISHED',
      },
    });

    await createAnnouncement(multiAnnounceMock.req, multiAnnounceMock.res);
    assert.strictEqual(multiAnnounceMock.getStatus(), 201);
    assert.strictEqual(multiAnnounceMock.getData().announcements.length, 2);

    // --- TEST M: 1-on-1 Direct Mentor <-> Student Chat & IDOR Protection ---
    const mentorSendMsgMock = createMockHttp({
      user: { id: mentor.id, role: 'MENTOR' },
      params: { groupId: cohortA.id, studentId: student1.id },
      body: {
        content: 'Hey Alice, check out the XAUUSD NY setup I just shared!',
        tradeShareId: directShare.id,
      },
    });

    await sendDirectMessage(mentorSendMsgMock.req, mentorSendMsgMock.res);
    assert.strictEqual(mentorSendMsgMock.getStatus(), 201);
    assert.strictEqual(
      mentorSendMsgMock.getData().directMessage.content,
      'Hey Alice, check out the XAUUSD NY setup I just shared!'
    );

    // Student 2 (not Alice) attempts IDOR to read Alice's 1-on-1 messages -> 403
    const student2IdorChatMock = createMockHttp({
      user: { id: student2.id, role: 'TRADER' },
      params: { groupId: cohortA.id, studentId: student1.id },
    });
    await getDirectMessages(student2IdorChatMock.req, student2IdorChatMock.res);
    assert.strictEqual(student2IdorChatMock.getStatus(), 403);

    // Student 1 (Alice) reads her 1-on-1 messages -> 200
    const student1ReadChatMock = createMockHttp({
      user: { id: student1.id, role: 'TRADER' },
      params: { groupId: cohortA.id, studentId: student1.id },
    });
    await getDirectMessages(student1ReadChatMock.req, student1ReadChatMock.res);
    assert.strictEqual(student1ReadChatMock.getStatus(), 200);
    assert.strictEqual(student1ReadChatMock.getData().messages.length, 1);

  } finally {
    // Cleanup created test records
    await prisma.mentorDirectMessage.deleteMany({
      where: { mentorGroupId: { in: [cohortA.id, cohortB.id, otherCohort.id] } },
    });
    await prisma.cohortFeedReadState.deleteMany({
      where: { userId: { in: [student1.id, student2.id, student3.id] } },
    });
    await prisma.cohortTradeShareTarget.deleteMany({
      where: { mentorGroupId: { in: [cohortA.id, cohortB.id, otherCohort.id] } },
    });
    await prisma.cohortTradeShare.deleteMany({
      where: { mentorId: { in: [mentor.id, otherMentor.id] } },
    });
    await prisma.cohortAnnouncement.deleteMany({
      where: { mentorGroupId: { in: [cohortA.id, cohortB.id, otherCohort.id] } },
    });
    await prisma.mentorFeedback.deleteMany({
      where: { mentorId: mentor.id },
    });
    await prisma.trade.deleteMany({
      where: { tradingAccount: { userId: { in: [mentor.id, student1.id] } } },
    });
    await prisma.tradingAccount.deleteMany({
      where: { userId: { in: [mentor.id, student1.id] } },
    });
    await prisma.mentorStudent.deleteMany({
      where: { mentorGroupId: { in: [cohortA.id, cohortB.id, otherCohort.id] } },
    });
    await prisma.mentorGroup.deleteMany({
      where: { id: { in: [cohortA.id, cohortB.id, otherCohort.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [mentor.id, otherMentor.id, student1.id, student2.id, student3.id] } },
    });
  }
});

test('Cohort Sharing Plan Gating: requireMentorPlan blocks Free and Expired users', async () => {
  // Free trader
  const freeMock = createMockHttp({
    user: { id: 'u-free', role: 'TRADER', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' },
  });
  let nextCalled = false;
  await requireMentorPlan(freeMock.req, freeMock.res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(freeMock.getStatus(), 403);
  assert.strictEqual(freeMock.getData().error, 'PLAN_LIMIT_REACHED');

  // Expired mentor
  const expiredMock = createMockHttp({
    user: { id: 'u-exp', role: 'MENTOR', subscriptionPlan: 'MENTOR', subscriptionStatus: 'EXPIRED' },
  });
  nextCalled = false;
  await requireMentorPlan(expiredMock.req, expiredMock.res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(expiredMock.getStatus(), 403);
  assert.strictEqual(expiredMock.getData().error, 'PLAN_LIMIT_REACHED');
});
