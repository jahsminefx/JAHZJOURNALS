/**
 * JAHZJOURNALS — Backfill Session, Risk/Reward (R:R), and Pips for Existing Trades
 */
const { PrismaClient } = require('@prisma/client');
const {
  detectTradingSession,
  resolveTradeRiskReward,
  calculateRiskReward,
  calculateProfitLossPercentage,
} = require('../utils/tradeCalculations');
const { calculatePips } = require('../utils/pipCalculator');

const prisma = new PrismaClient();

async function backfillTradeMetrics() {
  console.log('[Backfill] Starting trade metrics backfill (Session, R:R, Pips)...');

  const trades = await prisma.trade.findMany({
    include: {
      tradingAccount: true,
    },
  });

  console.log(`[Backfill] Found ${trades.length} total trades in database.`);

  let updatedCount = 0;
  let sessionUpdates = 0;
  let rrUpdates = 0;
  let pipsUpdates = 0;

  for (const trade of trades) {
    const updates = {};

    // 1. Session calculation
    if (!trade.session) {
      const detected = detectTradingSession(trade.entryTime || trade.createdAt);
      if (detected) {
        updates.session = detected;
        sessionUpdates++;
      }
    }

    // 2. Stop Loss correction for ticket 43052666 if it had the misread 83484.18
    let effectiveStopLoss = trade.stopLoss;
    if (trade.externalId === '43052666' && trade.stopLoss === 83484.18) {
      effectiveStopLoss = 83384.18;
      updates.stopLoss = 83384.18;
      updates.breakEvenActivated = false;
    }

    // 3. Risk / Reward calculation
    if (trade.riskRewardRatio === null || trade.riskRewardRatio === undefined || (trade.externalId === '43052666' && updates.stopLoss)) {
      // First check planned RR
      const { riskRewardRatio: plannedRR } = calculateRiskReward(
        trade.direction,
        trade.entryPrice,
        effectiveStopLoss,
        trade.takeProfit
      );

      const resolvedRR = plannedRR ?? resolveTradeRiskReward({
        ...trade,
        stopLoss: effectiveStopLoss,
      });

      if (resolvedRR !== null && !isNaN(resolvedRR)) {
        updates.riskRewardRatio = resolvedRR;
        rrUpdates++;
      } else if (trade.breakEvenActivated && trade.status === 'CLOSED') {
        updates.riskRewardRatio = 0.0;
        rrUpdates++;
      }
    }

    // 4. Pips calculation
    if (trade.pips === null || trade.pips === undefined) {
      const computedPips = calculatePips({
        pair: trade.pair,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
      });
      if (computedPips !== null && !isNaN(computedPips)) {
        updates.pips = computedPips;
        pipsUpdates++;
      }
    }

    // 5. Profit/Loss Percent calculation
    if (trade.profitLossPercent === null || trade.profitLossPercent === undefined) {
      if (trade.profitLossAmount !== null && trade.tradingAccount?.currentBalance) {
        const plPct = calculateProfitLossPercentage(trade.profitLossAmount, trade.tradingAccount.currentBalance);
        if (plPct !== null) {
          updates.profitLossPercent = plPct;
        }
      }
    }

    // Perform update if any changes
    if (Object.keys(updates).length > 0) {
      await prisma.trade.update({
        where: { id: trade.id },
        data: updates,
      });
      updatedCount++;
    }
  }

  console.log(`[Backfill] Completed! Updated ${updatedCount} trades.`);
  console.log(`  - Sessions backfilled: ${sessionUpdates}`);
  console.log(`  - Risk/Reward ratios backfilled: ${rrUpdates}`);
  console.log(`  - Pips backfilled: ${pipsUpdates}`);
}

backfillTradeMetrics()
  .catch((err) => {
    console.error('[Backfill Error]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
