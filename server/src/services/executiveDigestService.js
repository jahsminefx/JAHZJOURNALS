const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendEmail } = require('./emailService');
const { executiveDigestTemplate } = require('../templates/emailTemplates');

/**
 * Gathers system, trading, user, and financial metrics for the last 7 days.
 */
async function getExecutiveDigestMetrics() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Format date labels
  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const periodStart = sevenDaysAgo.toLocaleDateString('en-US', dateOptions);
  const periodEnd = now.toLocaleDateString('en-US', dateOptions);
  const dashboardUrl = (process.env.CLIENT_URL || 'https://jahzjournal.com').replace(/\/$/, '') + '/admin';

  // 1. Measure DB query latency
  const dbStart = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatencyMs = Date.now() - dbStart;

  // 2. Fetch Users & Plan distribution in parallel
  const [
    totalUsers,
    activeUsers,
    newUsersThisWeek,
    freeUsers,
    starterUsers,
    proUsers,
    mentorUsers,
    totalTradesAllTime,
    recentTrades,
    pendingSupportMessages,
    recentPayments,
    mentorStudentPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isDisabled: false } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { subscriptionPlan: 'FREE' } }),
    prisma.user.count({ where: { subscriptionPlan: 'STARTER' } }),
    prisma.user.count({ where: { subscriptionPlan: 'PRO' } }),
    prisma.user.count({ where: { subscriptionPlan: 'MENTOR' } }),
    prisma.trade.count(),
    prisma.trade.findMany({
      where: {
        OR: [
          { createdAt: { gte: sevenDaysAgo } },
          { entryTime: { gte: sevenDaysAgo } }
        ]
      },
      select: {
        id: true,
        pair: true,
        result: true,
        status: true,
        profitLossAmount: true,
        tradingAccountId: true
      }
    }),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: 'SUCCESS'
      },
      select: { amount: true, currency: true }
    }),
    prisma.mentorStudent.findMany({
      where: {
        paidAmount: { gt: 0 },
        OR: [
          { paidAt: { gte: sevenDaysAgo } },
          { createdAt: { gte: sevenDaysAgo } }
        ]
      },
      select: {
        paidAmount: true,
        platformFeeAmount: true,
        currency: true
      }
    })
  ]);

  // 3. Analyze Trade metrics for the week
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  const pairCounts = {};
  const activeAccountIds = new Set();

  for (const t of recentTrades) {
    if (t.tradingAccountId) activeAccountIds.add(t.tradingAccountId);
    if (t.pair) {
      pairCounts[t.pair] = (pairCounts[t.pair] || 0) + 1;
    }
    if (t.result === 'WIN') wins++;
    else if (t.result === 'LOSS') losses++;
    else if (t.result === 'BREAKEVEN') breakeven++;
  }

  const closedCount = wins + losses + breakeven;
  const winRate = closedCount > 0 ? ((wins / closedCount) * 100).toFixed(1) : '0.0';

  const topPairs = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair, count]) => ({ pair, count }));

  // 4. Calculate Financials
  let revenueUsd = 0;
  let revenueNgn = 0;
  let platformFeeUsd = 0;
  let platformFeeNgn = 0;

  for (const p of recentPayments) {
    if (p.currency === 'NGN') revenueNgn += (p.amount || 0);
    else revenueUsd += (p.amount || 0);
  }

  for (const m of mentorStudentPayments) {
    const gross = m.paidAmount || 0;
    const fee = m.platformFeeAmount || (gross * 0.015);
    if (m.currency === 'NGN') {
      revenueNgn += gross;
      platformFeeNgn += fee;
    } else {
      revenueUsd += gross;
      platformFeeUsd += fee;
    }
  }

  // 5. System Health & Process stats
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;

  return {
    periodStart,
    periodEnd,
    dashboardUrl,
    users: {
      total: totalUsers,
      active: activeUsers,
      newThisWeek: newUsersThisWeek,
      byTier: {
        FREE: freeUsers,
        STARTER: starterUsers,
        PRO: proUsers,
        MENTOR: mentorUsers
      }
    },
    trades: {
      totalThisWeek: recentTrades.length,
      totalAllTime: totalTradesAllTime,
      closedThisWeek: closedCount,
      wins,
      losses,
      breakeven,
      winRate,
      topPairs,
      activeAccountsCount: activeAccountIds.size
    },
    financials: {
      revenueUsd,
      revenueNgn,
      platformFeeUsd,
      platformFeeNgn,
      paidTransactionsCount: recentPayments.length + mentorStudentPayments.length
    },
    health: {
      status: dbLatencyMs < 250 ? 'OPTIMAL' : 'DEGRADED',
      dbLatencyMs,
      uptimeFormatted,
      memoryRssMb: Math.round(memory.rss / 1024 / 1024),
      pendingSupportMessages
    }
  };
}

/**
 * Compiles and sends the weekly executive digest to the configured Super Admin.
 *
 * @param {Object} options
 * @param {string} [options.targetEmail] - Override recipient email (defaults to ADMIN_EMAIL or jahzjournals@gmail.com)
 * @param {boolean} [options.isManual=false] - Whether this was triggered manually from admin dashboard
 */
async function sendWeeklyExecutiveDigest({ targetEmail = null, isManual = false } = {}) {
  const recipient = targetEmail || process.env.ADMIN_EMAIL || 'jahzjournals@gmail.com';
  console.log(`[Executive Digest] Preparing weekly briefing for Super Admin at ${recipient}...`);

  try {
    const metrics = await getExecutiveDigestMetrics();
    const template = executiveDigestTemplate(metrics);

    const subjectPrefix = isManual ? '[MANUAL TEST] ' : '';
    const subject = `${subjectPrefix}JAHZJOURNALS Weekly Executive Briefing: +${metrics.users.newThisWeek} Traders | ${metrics.trades.totalThisWeek} Trades (${metrics.periodStart} – ${metrics.periodEnd})`;

    const result = await sendEmail({
      to: recipient,
      subject,
      html: template.html,
      text: template.text
    });

    console.log(`[Executive Digest] Dispatched successfully to ${recipient} (Provider: ${result.provider || 'default'}, Status: ${result.success})`);
    return {
      success: result.success,
      recipient,
      period: `${metrics.periodStart} – ${metrics.periodEnd}`,
      metrics: {
        newUsers: metrics.users.newThisWeek,
        tradeVolume: metrics.trades.totalThisWeek,
        winRate: metrics.trades.winRate,
        dbLatency: metrics.health.dbLatencyMs
      },
      error: result.error || null
    };
  } catch (error) {
    console.error('[Executive Digest] Error generating or sending executive digest:', error);
    return {
      success: false,
      recipient,
      error: error.message
    };
  }
}

module.exports = {
  getExecutiveDigestMetrics,
  sendWeeklyExecutiveDigest
};
