const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { buildAudienceSafeTradeSnapshot } = require('../controllers/cohortSharingController');

async function main() {
  console.log('--- SEEDING COHORT BROADCASTS (TRADE SHARES & ANNOUNCEMENTS) ---');

  const mentor = await prisma.user.findUnique({
    where: { email: 'mentor@jahzjournals.com' },
  });

  if (!mentor) {
    console.error('Mentor not found.');
    return;
  }

  const student = await prisma.user.findUnique({
    where: { email: 'student@jahzjournals.com' },
  });

  if (!student) {
    console.error('Student not found.');
    return;
  }

  // Find mentor cohort where student is enrolled
  const cohort = await prisma.mentorGroup.findFirst({
    where: {
      mentorId: mentor.id,
      students: {
        some: {
          studentId: student.id,
        },
      },
    },
  });

  if (!cohort) {
    console.log('No shared cohort found between mentor and student. Looking for any mentor cohort...');
  }

  const targetCohort = cohort || (await prisma.mentorGroup.findFirst({ where: { mentorId: mentor.id } }));
  if (!targetCohort) {
    console.error('No mentor cohort found.');
    return;
  }

  console.log(`Targeting Cohort: "${targetCohort.name}" (ID: ${targetCohort.id})`);

  // Ensure student has ACTIVE membership
  const existingMembership = await prisma.mentorStudent.findUnique({
    where: {
      mentorGroupId_studentId: {
        mentorGroupId: targetCohort.id,
        studentId: student.id,
      },
    },
  });

  if (!existingMembership) {
    await prisma.mentorStudent.create({
      data: {
        mentorGroupId: targetCohort.id,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });
    console.log(`Enrolled student ${student.email} into cohort.`);
  }

  // Find 2 trades from mentor
  const mentorTrades = await prisma.trade.findMany({
    where: {
      tradingAccount: { userId: mentor.id },
      result: { in: ['WIN', 'LOSS', 'BREAKEVEN'] },
    },
    include: {
      tradingAccount: { select: { currency: true } },
      screenshots: true,
    },
    take: 2,
    orderBy: { createdAt: 'desc' },
  });

  if (mentorTrades.length > 0) {
    for (const trade of mentorTrades) {
      // Check if already shared
      const alreadyShared = await prisma.cohortTradeShare.findFirst({
        where: {
          mentorId: mentor.id,
          sourceTradeId: trade.id,
        },
      });

      if (!alreadyShared) {
        const snapshot = buildAudienceSafeTradeSnapshot(trade);
        const isWin = trade.result === 'WIN';

        const share = await prisma.cohortTradeShare.create({
          data: {
            mentorId: mentor.id,
            sourceTradeId: trade.id,
            tradeSnapshot: snapshot,
            title: isWin ? `High-Probability Liquidity Raid on ${trade.pair}` : `Execution Case Study: Session Boundaries on ${trade.pair}`,
            setupThesis: isWin
              ? `Clear liquidity sweep of the Asian session high on ${trade.pair}. Noticed institutional displacement lower creating a 15-minute Fair Value Gap that lined up with the 0.618 OTE discount level. Entered on the mitigation tap.`
              : `Anticipated a continuation leg on ${trade.pair} following London expansion, but news volatility caused an early stop run before resuming. Good reminder on session boundary timing.`,
            entryReasoning: `Confluence of 4H order block rejection + 5m change of character (CHoCH) with clean imbalance filling.`,
            riskRationale: `Risk strictly contained to 1.0% with invalidation set just above the swing high. Planned 3:1 R:R target.`,
            managementReasoning: isWin
              ? `Took 80% off at the key 1H swing low liquidity pool, trailed runner to break-even + 1R.`
              : `Stopped out cleanly at invalidation level with zero slippage. Rule discipline maintained.`,
            outcomeLessons: isWin
              ? `Patience pays: waiting for the full 15m candle close confirmed the false breakout instead of chasing the impulse.`
              : `Never widen a stop when an invalidation occurs. Take the defined loss with poise and review the higher-timeframe context.`,
            generalNotes: `Study this setup for this week's homework assignment! Pay attention to the session open timeline.`,
            isCaseStudy: true,
            attachments: trade.screenshots?.map((s) => ({
              id: s.id,
              imageUrl: s.imageUrl,
              screenshotType: s.screenshotType,
              caption: s.note || '',
            })) || [],
            status: 'PUBLISHED',
            pinned: isWin,
            publishedAt: new Date(),
            targets: {
              create: [
                {
                  mentorGroupId: targetCohort.id,
                },
              ],
            },
          },
        });
        console.log(`Created Cohort Trade Share: ${trade.pair} ${trade.result} (ID: ${share.id})`);
      } else {
        console.log(`Trade ${trade.pair} already shared.`);
      }
    }
  }

  // Seed 2 Cohort Announcements
  const existingAnnouncements = await prisma.cohortAnnouncement.findMany({
    where: { mentorGroupId: targetCohort.id },
  });

  if (existingAnnouncements.length === 0) {
    await prisma.cohortAnnouncement.create({
      data: {
        mentorId: mentor.id,
        mentorGroupId: targetCohort.id,
        title: 'Weekly Macro Outlook & High-Impact CPI Risk Protocol',
        content: `Team, welcome to this week's trading phase. We have US CPI dropping on Wednesday at 13:30 UTC. 

Please review the Academy Risk Guard rules:
1. Max 1.0% risk per trade setup.
2. Flatten or set all open swing runners to breakeven at least 15 minutes prior to tier-1 releases.
3. No new market orders during the initial 5-minute spread expansion.

Log all your trades with execution rationale in your journals so I can grade your execution discipline in this week's review queue.`,
        category: 'MARKET_UPDATE',
        isPinned: true,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    await prisma.cohortAnnouncement.create({
      data: {
        mentorId: mentor.id,
        mentorGroupId: targetCohort.id,
        title: 'Live Chart Breakdown & Q&A Session - Thursday 18:00 UTC',
        content: `We will be hosting a live Discord stream to analyze our shared trade setups, breakdown top student journal submissions, and review order flow mechanics on Gold & EURUSD.

Come prepared with questions and your top journal log from this week!`,
        category: 'WEBINAR',
        isPinned: false,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    console.log('Seeded 2 announcements for cohort.');
  } else {
    console.log(`Cohort already has ${existingAnnouncements.length} announcement(s).`);
  }

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
