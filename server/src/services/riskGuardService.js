const prisma = require('../config/prisma');

/**
 * Pure evaluation function: checks a trade against cohort Strategy Risk Guard rules.
 * 
 * Rules checked:
 * 1. EXCESSIVE_RISK (e.g. Risked > maxRiskPerTradePercent)
 * 2. NO_STOP_LOSS (requireStopLoss && !trade.stopLoss)
 * 3. UNAUTHORIZED_PAIR (allowedPairs focus list)
 * 4. OVERTRADING (daily trade count > maxDailyTrades)
 * 
 * @param {Object} trade - The trade object including tradingAccount
 * @param {Object} cohortRules - The MentorGroup object / rules configuration
 * @param {Object} tradesByDay - Map of dayKey -> tradeCount for overtrading check
 * @returns {Array} List of violations
 */
const evaluateTradeRiskGuard = (trade, cohortRules, tradesByDay = {}) => {
  const violations = [];
  if (!cohortRules || cohortRules.enforceRiskGuard === false) {
    return violations;
  }

  const maxRisk = cohortRules.maxRiskPerTradePercent !== null && cohortRules.maxRiskPerTradePercent !== undefined
    ? Number(cohortRules.maxRiskPerTradePercent)
    : 1.0;
  const maxDailyTrades = cohortRules.maxDailyTrades !== null && cohortRules.maxDailyTrades !== undefined
    ? Number(cohortRules.maxDailyTrades)
    : 5;
  const allowedPairsList = (cohortRules.allowedPairs || []).map(p => p.trim().toUpperCase()).filter(Boolean);
  const requireSL = cohortRules.requireStopLoss ?? true;

  const balance = trade.tradingAccount?.startingBalance || trade.tradingAccount?.currentBalance || 0;

  let calculatedRiskPercent = null;
  if (trade.riskAmount && balance > 0) {
    calculatedRiskPercent = Number(((trade.riskAmount / balance) * 100).toFixed(2));
  } else if (trade.profitLossPercent !== null && trade.profitLossPercent !== undefined) {
    calculatedRiskPercent = trade.profitLossPercent < 0 ? Math.abs(Number(trade.profitLossPercent.toFixed(2))) : null;
  }

  // 1. Excessive risk per trade
  if (calculatedRiskPercent !== null && maxRisk > 0 && calculatedRiskPercent > maxRisk) {
    const excess = Number((calculatedRiskPercent - maxRisk).toFixed(2));
    violations.push({
      type: 'EXCESSIVE_RISK',
      severity: 'CRITICAL',
      title: 'Excessive Risk Breach',
      ruleLimit: `${maxRisk}%`,
      actualValue: `${calculatedRiskPercent}%`,
      message: `Risked ${calculatedRiskPercent}% on ${trade.pair || 'trade'} — Exceeded academy rule of ${maxRisk}% by +${excess}%!`,
      evidence: trade.riskAmount
        ? `$${Number(trade.riskAmount).toLocaleString()} risked on $${balance.toLocaleString()} balance`
        : `${calculatedRiskPercent}% drawdown on single trade`
    });
  }

  // 2. Missing stop loss
  if (requireSL && (trade.stopLoss === null || trade.stopLoss === undefined)) {
    violations.push({
      type: 'NO_STOP_LOSS',
      severity: 'HIGH',
      title: 'No Stop Loss Attached',
      ruleLimit: 'Mandatory Stop Loss',
      actualValue: 'None',
      message: 'Trade executed without a Stop Loss (Direct breach of Academy Capital Protection Policy).',
      evidence: 'Stop Loss field not set'
    });
  }

  // 3. Unauthorized pair
  if (allowedPairsList.length > 0 && trade.pair) {
    const cleanPair = trade.pair.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const isAllowed = allowedPairsList.some(p => {
      const cleanAllowed = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return cleanPair.includes(cleanAllowed) || cleanAllowed.includes(cleanPair);
    });
    if (!isAllowed) {
      violations.push({
        type: 'UNAUTHORIZED_PAIR',
        severity: 'MEDIUM',
        title: 'Unauthorized Focus Pair',
        ruleLimit: allowedPairsList.join(', '),
        actualValue: trade.pair,
        message: `Traded ${trade.pair} which is outside academy approved focus list (${allowedPairsList.join(', ')}).`,
        evidence: `Pair ${trade.pair} not in cohort focus list`
      });
    }
  }

  // 4. Overtrading
  const dayKey = trade.entryTime ? new Date(trade.entryTime).toISOString().split('T')[0] : null;
  if (maxDailyTrades > 0 && dayKey && (tradesByDay[dayKey] || 0) > maxDailyTrades) {
    violations.push({
      type: 'OVERTRADING',
      severity: 'MEDIUM',
      title: 'Daily Trade Limit Exceeded',
      ruleLimit: `${maxDailyTrades} trades/day`,
      actualValue: `${tradesByDay[dayKey]} trades logged`,
      message: `Overtrading: ${tradesByDay[dayKey]} trades logged on this date (Exceeded academy limit of ${maxDailyTrades} trades/day).`,
      evidence: `${tradesByDay[dayKey]} executions in 24 hours`
    });
  }

  return violations;
};

/**
 * Automatically evaluates a trade against any active cohort rules for this user,
 * and records any detected rule breaches into Prisma TradeRuleViolation.
 * 
 * Works for manual trades, AI capture, and MT4/MT5 cloud sync.
 * Available to ALL account tiers (FREE to PRO_SYNC).
 * 
 * @param {string} tradeId 
 * @param {string} userId 
 * @returns {Promise<Array>} The detected violations
 */
const evaluateAndRecordTradeRules = async (tradeId, userId) => {
  try {
    if (!tradeId || !userId) return [];

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        tradingAccount: {
          select: {
            id: true,
            userId: true,
            startingBalance: true,
            currentBalance: true,
            currency: true
          }
        }
      }
    });

    if (!trade) return [];

    // Find active cohort memberships for this user
    const memberships = await prisma.mentorStudent.findMany({
      where: {
        studentId: userId,
        status: 'ACTIVE'
      },
      include: {
        mentorGroup: true
      }
    });

    if (memberships.length === 0) {
      return [];
    }

    // Prepare daily trade counts for overtrading rule
    const entryDate = trade.entryTime ? new Date(trade.entryTime) : new Date();
    const startOfDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
    const endOfDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate(), 23, 59, 59, 999);

    const dailyCount = await prisma.trade.count({
      where: {
        tradingAccount: { userId },
        entryTime: { gte: startOfDay, lte: endOfDay }
      }
    });

    const dayKey = entryDate.toISOString().split('T')[0];
    const tradesByDay = { [dayKey]: dailyCount };

    const allViolations = [];

    for (const membership of memberships) {
      const group = membership.mentorGroup;
      if (!group || !group.enforceRiskGuard) continue;

      const violations = evaluateTradeRiskGuard(trade, group, tradesByDay);
      allViolations.push(...violations);
    }

    // Persist violations as TradeRuleViolation records
    for (const v of allViolations) {
      try {
        let rule = await prisma.tradeRule.findFirst({
          where: {
            userId,
            name: v.title
          }
        });

        if (!rule) {
          rule = await prisma.tradeRule.create({
            data: {
              userId,
              name: v.title,
              description: `Academy Risk Guard preset: ${v.ruleLimit}`,
              active: true
            }
          });
        }

        const existingViolation = await prisma.tradeRuleViolation.findFirst({
          where: {
            tradeId: trade.id,
            tradeRuleId: rule.id
          }
        });

        if (!existingViolation) {
          await prisma.tradeRuleViolation.create({
            data: {
              tradeId: trade.id,
              tradeRuleId: rule.id,
              severity: v.severity === 'CRITICAL' || v.severity === 'HIGH' ? 'MAJOR' : 'MODERATE',
              note: v.message
            }
          });
        }
      } catch (innerErr) {
        console.error('[riskGuardService] Error recording violation:', innerErr.message);
      }
    }

    return allViolations;
  } catch (error) {
    console.error('[riskGuardService] evaluateAndRecordTradeRules error:', error);
    return [];
  }
};

module.exports = {
  evaluateTradeRiskGuard,
  evaluateAndRecordTradeRules
};
