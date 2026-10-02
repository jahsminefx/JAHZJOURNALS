const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Dedicated Demo Mentor & Student Accounts...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create or Update Demo Mentor
  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@jahzjournals.com' },
    update: {
      name: 'Demo Master Mentor',
      passwordHash,
      role: 'MENTOR',
      subscriptionPlan: 'MENTOR',
      subscriptionStatus: 'ACTIVE',
      onboardingCompleted: true,
      emailVerified: true,
    },
    create: {
      name: 'Demo Master Mentor',
      email: 'mentor@jahzjournals.com',
      passwordHash,
      role: 'MENTOR',
      subscriptionPlan: 'MENTOR',
      subscriptionStatus: 'ACTIVE',
      onboardingCompleted: true,
      emailVerified: true,
    },
  });

  // 2. Create or Update Demo Student
  const student = await prisma.user.upsert({
    where: { email: 'student@jahzjournals.com' },
    update: {
      name: 'Alex Student',
      passwordHash,
      role: 'TRADER',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      onboardingCompleted: true,
      emailVerified: true,
    },
    create: {
      name: 'Alex Student',
      email: 'student@jahzjournals.com',
      passwordHash,
      role: 'TRADER',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      onboardingCompleted: true,
      emailVerified: true,
    },
  });

  // Ensure student has shareTradesWithMentor set to true
  await prisma.userSettings.upsert({
    where: { userId: student.id },
    update: { shareTradesWithMentor: true },
    create: { userId: student.id, shareTradesWithMentor: true },
  });

  // 3. Create or find Mentor Cohort
  let group = await prisma.mentorGroup.findFirst({
    where: { mentorId: mentor.id, name: 'Alpha FX Academy' },
  });

  if (!group) {
    group = await prisma.mentorGroup.create({
      data: {
        mentorId: mentor.id,
        name: 'Alpha FX Academy',
        description: 'Elite price-action & smart money concept cohort for Q4 2026.',
      },
    });
  }

  // 4. Enroll Student in Group
  const existingMembership = await prisma.mentorStudent.findFirst({
    where: { mentorGroupId: group.id, studentId: student.id },
  });

  if (!existingMembership) {
    await prisma.mentorStudent.create({
      data: {
        mentorGroupId: group.id,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });
  }

  // 5. Create Trading Account for Student
  let studentAccount = await prisma.tradingAccount.findFirst({
    where: { userId: student.id },
  });

  if (!studentAccount) {
    studentAccount = await prisma.tradingAccount.create({
      data: {
        userId: student.id,
        name: 'Evaluation 50K Challenge',
        brokerName: 'FTMO',
        startingBalance: 50000,
        currentBalance: 51850,
        currency: 'USD',
        riskPerTradePercent: 1.0,
        isPropFirmAccount: true,
      },
    });
  }

  // 6. Create realistic trades for Student
  const existingTradesCount = await prisma.trade.count({
    where: { tradingAccountId: studentAccount.id },
  });

  if (existingTradesCount === 0) {
    const tradesData = [
      {
        pair: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0845,
        stopLoss: 1.0825,
        takeProfit: 1.0905,
        exitPrice: 1.0905,
        lotSize: 2.5,
        riskAmount: 500,
        rewardAmount: 1500,
        profitLossAmount: 1500,
        profitLossPercent: 3.0,
        riskRewardRatio: 3.0,
        result: 'WIN',
        status: 'CLOSED',
        session: 'LONDON',
        htfBias: 'BULLISH',
        entryReason: '4H FVG mitigation followed by 15m Change of Character at London Open.',
        notesBefore: 'Risking 1% for 3R target at Asian high liquidity pool.',
        notesAfter: 'Clean expansion to take profit target during London session.',
        followedPlan: true,
        isAPlusSetup: true,
        grade: 'A_PLUS',
        entryTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        exitTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      },
      {
        pair: 'GBPUSD',
        direction: 'SELL',
        entryPrice: 1.2720,
        stopLoss: 1.2750,
        takeProfit: 1.2630,
        exitPrice: 1.2750,
        lotSize: 1.8,
        riskAmount: 540,
        rewardAmount: 1620,
        profitLossAmount: -540,
        profitLossPercent: -1.08,
        riskRewardRatio: 3.0,
        result: 'LOSS',
        status: 'CLOSED',
        session: 'NEW_YORK',
        htfBias: 'BEARISH',
        entryReason: 'New York morning continuation sweep of PDH.',
        notesBefore: 'Entered slightly early before 5m displacement confirmed.',
        notesAfter: 'Stopped out. Premature entry without wait for candle close.',
        followedPlan: false,
        isAPlusSetup: false,
        grade: 'C',
        entryTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        exitTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      },
      {
        pair: 'XAUUSD',
        direction: 'BUY',
        entryPrice: 2650.50,
        stopLoss: 2642.00,
        takeProfit: 2676.00,
        exitPrice: 2676.00,
        lotSize: 1.0,
        riskAmount: 850,
        rewardAmount: 2550,
        profitLossAmount: 2550,
        profitLossPercent: 5.1,
        riskRewardRatio: 3.0,
        result: 'WIN',
        status: 'CLOSED',
        session: 'NEW_YORK',
        htfBias: 'BULLISH',
        entryReason: 'Gold liquidity sweep below Asian low with clean Fair Value Gap entry on 5m.',
        notesBefore: 'Waited for rejection wick on 15m. Clean setup.',
        notesAfter: 'Full target reached before NY close.',
        followedPlan: true,
        isAPlusSetup: true,
        grade: 'A',
        entryTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        exitTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      },
      {
        pair: 'NAS100',
        direction: 'SELL',
        entryPrice: 20150,
        stopLoss: 20210,
        takeProfit: 19970,
        exitPrice: 20210,
        lotSize: 1.5,
        riskAmount: 900,
        rewardAmount: 2700,
        profitLossAmount: -900,
        profitLossPercent: -1.8,
        riskRewardRatio: 3.0,
        result: 'LOSS',
        status: 'CLOSED',
        session: 'NEW_YORK',
        htfBias: 'BEARISH',
        entryReason: 'Impulse entry during high impact CPI release.',
        notesBefore: 'Felt FOMO looking at fast volatility candles.',
        notesAfter: 'News spike hit stop loss instantly. Violated news trading rule.',
        followedPlan: false,
        isAPlusSetup: false,
        grade: 'MISTAKE',
        entryTime: new Date(Date.now() - 12 * 60 * 60 * 1000),
        exitTime: new Date(Date.now() - 11 * 60 * 60 * 1000),
      },
    ];

    for (const td of tradesData) {
      const createdTrade = await prisma.trade.create({
        data: {
          tradingAccountId: studentAccount.id,
          ...td,
        },
      });

      // Add mentor feedback to the EURUSD win
      if (td.pair === 'EURUSD') {
        await prisma.mentorFeedback.create({
          data: {
            mentorId: mentor.id,
            tradeId: createdTrade.id,
            feedback: 'Excellent execution on the 4H FVG retest. Patience on waiting for the 15m CHoCH was textbook.',
            grade: 'A+',
            recommendation: 'Keep maintaining this standard of patience on EURUSD.',
          },
        });
      }
    }
  }

  console.log('--- SEED COMPLETE ---');
  console.log('Demo Mentor Account: mentor@jahzjournals.com | Password: password123');
  console.log('Demo Student Account: student@jahzjournals.com | Password: password123');
  console.log('Cohort: Alpha FX Academy with 1 enrolled student and 4 logged trades.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
