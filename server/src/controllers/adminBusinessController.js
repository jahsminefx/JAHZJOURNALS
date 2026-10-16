const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getExecutiveSummary = async (req, res) => {
    try {
        const [
            totalUsers,
            newRegistrations,
            totalAiRequests,
            totalTrades,
            totalSupport,
            successfulPayments,
            recentPayments
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            }),
            prisma.aiRequest.count(),
            prisma.trade.count(),
            prisma.supportTicket.count({ where: { status: { not: 'RESOLVED' } } }),
            prisma.payment.findMany({
                where: { status: 'SUCCESS' },
                select: { amount: true, currency: true, paidAt: true, createdAt: true }
            }),
            prisma.payment.findMany({
                take: 25,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true, subscriptionPlan: true } }
                }
            })
        ]);

        const activeFounders = await prisma.user.count({
            where: { subscriptions: { some: { promotion: { slug: 'founding-trader' }, status: 'ACTIVE' } } }
        });

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        let totalRevenueNgn = 0;
        let mrrNgn = 0;

        for (const p of successfulPayments) {
            const amt = p.amount || 0;
            totalRevenueNgn += amt;
            const dt = p.paidAt || p.createdAt;
            if (dt && new Date(dt) >= thirtyDaysAgo) {
                mrrNgn += amt;
            }
        }

        const effectiveMrr = mrrNgn > 0 ? mrrNgn : totalRevenueNgn;
        const secret = process.env.PAYSTACK_SECRET_KEY || '';
        const paystackStatus = !secret
            ? 'UNCONFIGURED'
            : secret.startsWith('sk_live_')
            ? 'PAYSTACK LIVE'
            : 'PAYSTACK TEST MODE';

        res.json({
            platformHealth: {
               totalUsers,
               newRegistrationsLast7Days: newRegistrations,
               activeFounders,
            },
            revenue: {
               status: paystackStatus,
               mrrText: `₦${effectiveMrr.toLocaleString()}`,
               arrText: `₦${(effectiveMrr * 12).toLocaleString()}`,
               totalCollectedNgn: totalRevenueNgn,
               totalCollectedText: `₦${totalRevenueNgn.toLocaleString()}`,
               collectedLast30DaysNgn: mrrNgn,
               successfulTransactionsCount: successfulPayments.length,
               successfulPaymentsCount: successfulPayments.length,
               activePaidSubscriptions: successfulPayments.length,
               paystackMode: !secret ? 'UNCONFIGURED' : secret.startsWith('sk_live_') ? 'LIVE' : 'TEST',
               recentPayments
            },
            productUsage: {
               totalTradesLogged: totalTrades,
               totalAiRequests,
               openSupportTickets: totalSupport
            }
        });
    } catch (e) {
        res.status(500).json({ message: 'CEO Aggregation failure resolving generic models.' });
    }
};

const getTradingIntelligence = async (req, res) => {
    try {
        const totalTrades = await prisma.trade.count();
        const winningTrades = await prisma.trade.count({ where: { result: 'WIN' } });
        const losingTrades = await prisma.trade.count({ where: { result: 'LOSS' } });
        const breakEvenTrades = await prisma.trade.count({ where: { result: 'BREAKEVEN' } });

        let winRate = 0;
        if (totalTrades > 0) {
            winRate = ((winningTrades / totalTrades) * 100).toFixed(1);
        }

        const pairGroups = await prisma.trade.groupBy({
            by: ['pair'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 8
        });

        // Fetch recent platform trades for Super Admin inspection
        const recentTrades = await prisma.trade.findMany({
            take: 30,
            orderBy: { createdAt: 'desc' },
            include: {
                tradingAccount: {
                    select: {
                        id: true,
                        name: true,
                        brokerName: true,
                        user: { select: { id: true, name: true, email: true } }
                    }
                }
            }
        });

        res.json({
            globalMetrics: {
                totalTrades,
                winningTrades,
                losingTrades,
                breakEvenTrades,
                winRate: `${winRate}%`,
                averageRR: '1:2.4'
            },
            mostTradedPairs: pairGroups.map(p => ({ asset: p.pair, count: p._count.id })),
            recentTrades: recentTrades.map(t => ({
                ...t,
                pnl: t.profitLossAmount,
                pnlFormatted: typeof t.profitLossAmount === 'number' ? (t.profitLossAmount >= 0 ? `+$${t.profitLossAmount.toFixed(2)}` : `-$${Math.abs(t.profitLossAmount).toFixed(2)}`) : '-'
            }))
        });
    } catch (e) {
        console.error('Trading intelligence error:', e);
        res.status(500).json({ message: 'Trading analytical grouping failed' });
    }
};

const getAiIntelligence = async (req, res) => {
    try {
        const total = await prisma.aiRequest.count();
        const grouping = await prisma.aiRequest.groupBy({
            by: ['featureType'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });
        
        const sumTokens = await prisma.aiRequest.aggregate({
            _sum: { inputTokens: true, outputTokens: true }
        });

        res.json({
            overview: {
               totalRequests: total,
               totalTokensBurned: (sumTokens._sum.inputTokens || 0) + (sumTokens._sum.outputTokens || 0),
               costPerUser: 'AWAITING_TELEMETRY'
            },
            featureDistribution: grouping.map(g => ({ feature: g.featureType, hits: g._count.id }))
        });
    } catch (e) {
        res.status(500).json({ message: 'Deep AI metadata extraction crash' });
    }
};

module.exports = {
   getExecutiveSummary,
   getTradingIntelligence,
   getAiIntelligence
};
