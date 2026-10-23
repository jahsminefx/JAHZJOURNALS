/**
 * Idempotent Historical Backfill & Classification Script
 * JAHZJOURNALS — Break-Even (BE) Recognition & Classification
 *
 * Usage:
 *   Dry run (default, non-destructive):
 *     node src/scripts/backfillBreakEvenClassifications.js --dry-run
 *
 *   Apply changes:
 *     node src/scripts/backfillBreakEvenClassifications.js --apply
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  classifyTrade,
  isStopAtOrPastEntry,
  OUTCOMES,
  CLASSIFICATION_SOURCES,
} = require('../services/tradeClassificationService');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;
  return { isApply, isDryRun };
};

const run = async () => {
  const { isApply, isDryRun } = parseArgs();
  console.log(`\n=============================================================`);
  console.log(`=== JAHZJOURNALS Break-Even Classification Backfill Tool ===`);
  console.log(`=== Mode: ${isApply ? 'APPLY (Live DB Updates)' : 'DRY RUN (No changes written)'} ===`);
  console.log(`=============================================================\n`);

  const startTime = Date.now();

  try {
    // 1. Load user settings for per-user thresholds
    const userSettings = await prisma.userSettings.findMany({
      select: { userId: true, breakEvenThresholdAmount: true },
    });
    const userThresholdMap = new Map();
    userSettings.forEach((s) => {
      userThresholdMap.set(s.userId, s.breakEvenThresholdAmount ?? null);
    });

    // 2. Fetch all closed trades
    const trades = await prisma.trade.findMany({
      include: {
        tradingAccount: { select: { userId: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${trades.length} total trades in database.\n`);

    const stats = {
      totalInspected: 0,
      openSkipped: 0,
      manualOverrideSkipped: 0,
      unchanged: 0,
      reclassifiedToBreakEven: 0,
      reclassifiedToWin: 0,
      reclassifiedToLoss: 0,
      beProtectionFlagsUpdated: 0,
      appliedUpdates: 0,
    };

    const updates = [];

    for (const trade of trades) {
      stats.totalInspected++;

      if (trade.status !== 'CLOSED' && trade.result === 'OPEN') {
        stats.openSkipped++;
        continue;
      }

      if (trade.isManualResultOverride) {
        stats.manualOverrideSkipped++;
        continue;
      }

      const userId = trade.tradingAccount?.userId;
      const threshold = userThresholdMap.get(userId) ?? null;

      // Check if trade already had stop loss at or past entry
      const wasStopAtBe = (trade.stopLoss !== null && trade.entryPrice !== null && trade.direction)
        ? isStopAtOrPastEntry({
            direction: trade.direction,
            entryPrice: trade.entryPrice,
            stopLoss: trade.stopLoss,
            pair: trade.pair,
          })
        : false;

      const classification = classifyTrade({
        status: trade.status,
        direction: trade.direction,
        pair: trade.pair,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: trade.stopLoss,
        initialStopLoss: trade.initialStopLoss,
        lotSize: trade.lotSize,
        grossProfit: trade.grossProfit,
        commission: trade.commission,
        swap: trade.swap,
        fees: trade.fees,
        profitLossAmount: trade.profitLossAmount,
        slTpHistory: trade.slTpHistory,
        breakEvenActivated: trade.breakEvenActivated || wasStopAtBe,
        breakEvenPrice: trade.breakEvenPrice || (wasStopAtBe ? trade.stopLoss : null),
        breakEvenEvidenceSource: trade.breakEvenEvidenceSource,
        breakEvenEvidenceStatus: trade.breakEvenEvidenceStatus,
        userThresholdAmount: threshold,
      });

      const outcomeChanged = trade.result !== classification.result;
      const beFlagChanged = trade.breakEvenActivated !== classification.breakEvenActivated;

      if (!outcomeChanged && !beFlagChanged) {
        stats.unchanged++;
        continue;
      }

      if (outcomeChanged) {
        if (classification.result === OUTCOMES.BREAKEVEN) {
          stats.reclassifiedToBreakEven++;
        } else if (classification.result === OUTCOMES.WIN) {
          stats.reclassifiedToWin++;
        } else if (classification.result === OUTCOMES.LOSS) {
          stats.reclassifiedToLoss++;
        }
      }

      if (beFlagChanged) {
        stats.beProtectionFlagsUpdated++;
      }

      updates.push({
        tradeId: trade.id,
        pair: trade.pair,
        pnl: trade.profitLossAmount,
        oldResult: trade.result,
        newResult: classification.result,
        oldBeFlag: trade.breakEvenActivated,
        newBeFlag: classification.breakEvenActivated,
        badgeLabel: classification.badgeLabel,
        updateData: {
          result: classification.result,
          breakEvenActivated: classification.breakEvenActivated,
          breakEvenPrice: classification.breakEvenPrice,
          breakEvenActivatedAt: classification.breakEvenActivatedAt || trade.breakEvenActivatedAt,
          breakEvenEvidenceSource: classification.breakEvenEvidenceSource || trade.breakEvenEvidenceSource,
          breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus || trade.breakEvenEvidenceStatus,
          classificationSource: CLASSIFICATION_SOURCES.DETERMINISTIC_CALCULATION,
          resultCalculatedAt: new Date(),
        },
      });
    }

    // Print sample of modifications
    if (updates.length > 0) {
      console.log(`Sample of trades requiring classification updates (showing up to 10):`);
      updates.slice(0, 10).forEach((u, i) => {
        console.log(`  [${i + 1}] ID: ${u.tradeId} | ${u.pair} | Net: $${u.pnl} | ${u.oldResult} -> ${u.newResult} | BE Protected: ${u.newBeFlag} (${u.badgeLabel})`);
      });
      console.log(`\nTotal trades needing updates: ${updates.length}`);
    } else {
      console.log(`All trades are already correctly classified. Zero updates needed.`);
    }

    // Apply updates if requested
    if (isApply && updates.length > 0) {
      console.log(`\nWriting updates to database...`);
      for (const u of updates) {
        await prisma.trade.update({
          where: { id: u.tradeId },
          data: u.updateData,
        });
        stats.appliedUpdates++;
      }
      console.log(`Successfully applied ${stats.appliedUpdates} trade updates!`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n=================== Backfill Summary ===================`);
    console.log(`Total Inspected:               ${stats.totalInspected}`);
    console.log(`Open Trades Skipped:           ${stats.openSkipped}`);
    console.log(`Manual Overrides Skipped:      ${stats.manualOverrideSkipped}`);
    console.log(`Already Correct (Unchanged):   ${stats.unchanged}`);
    console.log(`Reclassified to BREAKEVEN:     ${stats.reclassifiedToBreakEven}`);
    console.log(`Reclassified to WIN:           ${stats.reclassifiedToWin}`);
    console.log(`Reclassified to LOSS:          ${stats.reclassifiedToLoss}`);
    console.log(`BE Protection Flags Updated:   ${stats.beProtectionFlagsUpdated}`);
    console.log(`Database Updates Applied:      ${stats.appliedUpdates} (${isApply ? 'APPLIED' : 'DRY RUN'})`);
    console.log(`Execution Time:                ${duration}s`);
    console.log(`========================================================\n`);

  } catch (error) {
    console.error('Error running backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  run();
}

module.exports = { run };
