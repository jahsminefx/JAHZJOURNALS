/**
 * JAHZJOURNALS — Canonical Prop Firm Compliance Engine
 * Authoritative, deterministic calculation of drawdown, high-water marks,
 * daily reset boundaries, consistency, and rule compliance.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COMPLIANCE_STATUS = {
  SAFE: 'SAFE',
  APPROACHING_LIMIT: 'APPROACHING_LIMIT', // >= 75% utilization
  CRITICAL: 'CRITICAL',                   // >= 90% utilization
  BREACH_DETECTED: 'BREACH_DETECTED',     // >= 100% utilization
  PASSED: 'PASSED',
  STALE_DATA: 'STALE_DATA',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

/**
 * Parses time string (e.g., "17:00", "00:00", "22:00") into hour and minute integers.
 */
const parseTimeString = (timeStr, defaultHour = 0, defaultMin = 0) => {
  if (!timeStr || typeof timeStr !== 'string') return { hour: defaultHour, minute: defaultMin };
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  return {
    hour: !isNaN(h) && h >= 0 && h < 24 ? h : defaultHour,
    minute: !isNaN(m) && m >= 0 && m < 60 ? m : defaultMin,
  };
};

/**
 * Calculates the current trading day's reset boundary and next reset time
 * based on the account's configured reset time and timezone.
 *
 * @param {string} resetTimeStr - e.g. "17:00" or "00:00"
 * @param {string} timezoneStr - e.g. "America/New_York", "UTC"
 * @param {Date} [referenceDate] - Current date/time (defaults to now)
 * @returns {{ currentDayResetUtc: Date, nextResetUtc: Date, secondsUntilReset: number }}
 */
const calculateDailyResetBoundaries = (resetTimeStr = '00:00', timezoneStr = 'UTC', referenceDate = new Date()) => {
  const { hour: resetHour, minute: resetMin } = parseTimeString(resetTimeStr, 0, 0);
  const tz = timezoneStr && timezoneStr.trim() ? timezoneStr.trim() : 'UTC';

  // Format the current reference date in the target timezone
  let parts;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    parts = formatter.formatToParts(referenceDate);
  } catch (_) {
    // Fallback to UTC if timezone is invalid
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    parts = formatter.formatToParts(referenceDate);
  }

  const partMap = {};
  for (const p of parts) {
    if (p.type !== 'literal') partMap[p.type] = parseInt(p.value, 10);
  }

  const tzYear = partMap.year;
  const tzMonth = partMap.month - 1; // 0-based
  const tzDay = partMap.day;
  const tzHour = partMap.hour === 24 ? 0 : partMap.hour;
  const tzMin = partMap.minute;

  // Determine if today's reset has already occurred in the local timezone
  const hasResetPassedToday = tzHour > resetHour || (tzHour === resetHour && tzMin >= resetMin);

  // Construct target local dates
  const currentResetLocal = new Date(Date.UTC(
    tzYear,
    tzMonth,
    hasResetPassedToday ? tzDay : tzDay - 1,
    resetHour,
    resetMin,
    0,
    0
  ));

  const nextResetLocal = new Date(Date.UTC(
    tzYear,
    tzMonth,
    hasResetPassedToday ? tzDay + 1 : tzDay,
    resetHour,
    resetMin,
    0,
    0
  ));

  // Offset difference between referenceDate and local representation
  const localRefMs = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMin, partMap.second || 0);
  const actualRefMs = referenceDate.getTime();
  const tzOffsetMs = actualRefMs - localRefMs;

  const currentDayResetUtc = new Date(currentResetLocal.getTime() + tzOffsetMs);
  const nextResetUtc = new Date(nextResetLocal.getTime() + tzOffsetMs);
  const secondsUntilReset = Math.max(0, Math.floor((nextResetUtc.getTime() - actualRefMs) / 1000));

  return {
    currentDayResetUtc,
    nextResetUtc,
    secondsUntilReset,
    timezone: tz,
    resetTime: resetTimeStr,
  };
};

/**
 * Calculates the High-Water Mark (peak balance) from historical closed trades and snapshots.
 *
 * @param {number} startingBalance
 * @param {Array<object>} trades - Chronological closed trades
 * @param {Array<object>} snapshots - Recorded progress snapshots
 * @returns {{ highWaterMark: number, balanceCurve: Array<{ date: string, balance: number }> }}
 */
const calculateHighWaterMark = (startingBalance = 0, trades = [], snapshots = []) => {
  let runningBalance = Number(startingBalance) || 0;
  let peak = runningBalance;
  const balanceCurve = [{ date: new Date().toISOString(), balance: runningBalance }];

  // 1. Process chronological trades
  const sortedTrades = [...trades].sort((a, b) => new Date(a.entryTime || a.createdAt) - new Date(b.entryTime || b.createdAt));

  for (const t of sortedTrades) {
    const netPnl = Number(t.profitLossAmount) || 0;
    runningBalance += netPnl;
    if (runningBalance > peak) {
      peak = runningBalance;
    }
    balanceCurve.push({
      date: (t.exitTime || t.entryTime || t.createdAt).toString(),
      balance: Number(runningBalance.toFixed(2)),
    });
  }

  // 2. Cross-check against any snapshot balance/equity that may have recorded an even higher peak
  for (const s of snapshots) {
    const snapBal = Number(s.balance) || 0;
    const snapEq = Number(s.equity) || snapBal;
    const higherSnap = Math.max(snapBal, snapEq);
    if (higherSnap > peak) {
      peak = higherSnap;
    }
  }

  return {
    highWaterMark: Number(peak.toFixed(2)),
    currentCalculatedBalance: Number(runningBalance.toFixed(2)),
    balanceCurve,
  };
};

/**
 * Evaluates compliance metrics deterministically for a single prop firm account.
 *
 * @param {object} account - TradingAccount with propFirmAccount, phases, trades, progressSnapshots
 * @param {Date} [referenceDate] - Timestamp for evaluation
 * @returns {object} Standardized compliance report
 */
const evaluatePropFirmCompliance = (account, referenceDate = new Date()) => {
  if (!account || !account.propFirmAccount) {
    throw new Error('Invalid account payload: account must have propFirmAccount associated.');
  }

  const propFirm = account.propFirmAccount;
  const startingBalance = Number(account.startingBalance) || 0;
  const recordedBalance = Number(account.currentBalance) ?? startingBalance;

  // Active Phase Resolution
  const phases = propFirm.phases || [];
  const activePhase = phases.find((p) => p.phaseNumber === propFirm.currentPhaseNumber) ||
    phases.find((p) => p.status === 'ACTIVE') ||
    phases[0] || {
      phaseNumber: 1,
      name: 'Phase 1',
      profitTargetPercent: 10,
      minimumTradingDays: 5,
    };

  const isFunded = ['INSTANT_FUNDED', 'ALREADY_FUNDED'].includes(propFirm.evaluationType) ||
    propFirm.accountStatus === 'FUNDED';

  // 1. Daily Reset Boundaries & Timezone
  const resetConfig = calculateDailyResetBoundaries(
    propFirm.dailyResetTime || '00:00',
    propFirm.dailyResetTimezone || 'UTC',
    referenceDate
  );

  // 2. High-Water Mark & Closed Trades Analysis
  const trades = account.trades || [];
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');

  const { highWaterMark, currentCalculatedBalance } = calculateHighWaterMark(
    startingBalance,
    closedTrades,
    propFirm.progressSnapshots || []
  );

  // Effective current balance: preference to live recorded balance if available
  const effectiveBalance = recordedBalance || currentCalculatedBalance;
  const latestSnapshot = (propFirm.progressSnapshots && propFirm.progressSnapshots[0]) || null;
  const effectiveEquity = (latestSnapshot && latestSnapshot.equity) ? Number(latestSnapshot.equity) : effectiveBalance;

  // 3. Overall Drawdown Calculation (Static vs Trailing)
  const isTrailing = String(propFirm.drawdownType).toUpperCase() === 'TRAILING';
  const overallLossPercent = Number(propFirm.maximumLossPercent) || 10;
  const overallLimitAmount = propFirm.maximumLossAmount !== null && propFirm.maximumLossAmount !== undefined
    ? Number(propFirm.maximumLossAmount)
    : Number((startingBalance * (overallLossPercent / 100)).toFixed(2));

  let overallFloor;
  let overallLossUsed;
  let remainingOverallAllowance;
  let overallUtilizationPct;

  if (isTrailing) {
    // Trailing: Floor trails up with highWaterMark
    let trailingFloor = highWaterMark - overallLimitAmount;
    
    // Stop-at-balance condition: Many firms stop trailing once the floor reaches starting balance
    if (propFirm.trailingStopAtBalance && trailingFloor > startingBalance) {
      trailingFloor = startingBalance;
    }

    overallFloor = Number(trailingFloor.toFixed(2));
    overallLossUsed = Math.max(0, Number((highWaterMark - effectiveBalance).toFixed(2)));
    remainingOverallAllowance = Math.max(0, Number((effectiveBalance - overallFloor).toFixed(2)));
    overallUtilizationPct = overallLimitAmount > 0
      ? Number(((overallLossUsed / overallLimitAmount) * 100).toFixed(2))
      : 0;
  } else {
    // Static: Floor is fixed at startingBalance - overallLimitAmount
    overallFloor = Number((startingBalance - overallLimitAmount).toFixed(2));
    overallLossUsed = Math.max(0, Number((startingBalance - effectiveBalance).toFixed(2)));
    remainingOverallAllowance = Math.max(0, Number((effectiveBalance - overallFloor).toFixed(2)));
    overallUtilizationPct = overallLimitAmount > 0
      ? Number(((overallLossUsed / overallLimitAmount) * 100).toFixed(2))
      : 0;
  }

  // 4. Daily Loss Calculation (Since currentDayResetUtc)
  const dailyLossPercent = Number(propFirm.dailyLossPercent) || 5;
  const dailyLossLimitAmount = propFirm.dailyLossAmount !== null && propFirm.dailyLossAmount !== undefined
    ? Number(propFirm.dailyLossAmount)
    : Number((startingBalance * (dailyLossPercent / 100)).toFixed(2));

  // Filter trades closed strictly since the start of today's reset boundary
  const todayTrades = closedTrades.filter((t) => {
    const exitTime = new Date(t.exitTime || t.entryTime || t.createdAt);
    return exitTime >= resetConfig.currentDayResetUtc;
  });

  const todayNetProfitLoss = todayTrades.reduce((sum, t) => sum + (Number(t.profitLossAmount) || 0), 0);
  const dailyLossUsed = Math.max(0, Number((-todayNetProfitLoss).toFixed(2)));
  const remainingDailyAllowance = Math.max(0, Number((dailyLossLimitAmount - dailyLossUsed).toFixed(2)));
  const dailyUtilizationPct = dailyLossLimitAmount > 0
    ? Number(((dailyLossUsed / dailyLossLimitAmount) * 100).toFixed(2))
    : 0;

  // 5. Profit Target & Challenge Progress
  const currentTotalProfit = Number((effectiveBalance - startingBalance).toFixed(2));
  const targetPercent = Number(activePhase.profitTargetPercent) || 0;
  const targetAmount = activePhase.profitTargetAmount !== null && activePhase.profitTargetAmount !== undefined
    ? Number(activePhase.profitTargetAmount)
    : Number((startingBalance * (targetPercent / 100)).toFixed(2));

  const remainingProfitRequired = Math.max(0, Number((targetAmount - currentTotalProfit).toFixed(2)));
  const challengeProgressPct = targetAmount > 0
    ? Number((Math.min(Math.max((currentTotalProfit / targetAmount) * 100, 0), 100)).toFixed(2))
    : (isFunded ? 100 : 0);

  // 6. Active Trading Days & Consistency
  // Determine unique trading days from closed trades
  const uniqueTradingDays = new Set(
    closedTrades.map((t) => {
      const d = new Date(t.entryTime || t.createdAt);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    })
  );

  const completedTradingDays = Math.max(uniqueTradingDays.size, latestSnapshot?.completedTradingDays || 0);
  const minimumTradingDays = activePhase.minimumTradingDays || 0;
  const daysProgressPct = minimumTradingDays > 0
    ? Math.min(100, Number(((completedTradingDays / minimumTradingDays) * 100).toFixed(1)))
    : 100;

  // Best Day Profit calculation
  const dailyPnlMap = {};
  for (const t of closedTrades) {
    const d = new Date(t.entryTime || t.createdAt);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    dailyPnlMap[key] = (dailyPnlMap[key] || 0) + (Number(t.profitLossAmount) || 0);
  }

  let bestDayProfit = latestSnapshot?.bestDayProfit || 0;
  let profitableDaysCount = 0;
  for (const dayPnl of Object.values(dailyPnlMap)) {
    if (dayPnl > 0) profitableDaysCount++;
    if (dayPnl > bestDayProfit) bestDayProfit = dayPnl;
  }

  const bestDayPercentage = (currentTotalProfit > 0 && bestDayProfit > 0)
    ? Number(((bestDayProfit / currentTotalProfit) * 100).toFixed(1))
    : 0;

  // 7. Overall Compliance & Warning Status
  let overallStatus = COMPLIANCE_STATUS.SAFE;
  const warnings = [];

  // Check Daily Loss Breach / Critical
  if (dailyUtilizationPct >= 100) {
    overallStatus = COMPLIANCE_STATUS.BREACH_DETECTED;
    warnings.push(`Daily loss limit breached! Used $${dailyLossUsed} of $${dailyLossLimitAmount} maximum daily allowance.`);
  } else if (dailyUtilizationPct >= 90) {
    if (overallStatus !== COMPLIANCE_STATUS.BREACH_DETECTED) overallStatus = COMPLIANCE_STATUS.CRITICAL;
    warnings.push(`Critical: Daily loss is at ${dailyUtilizationPct}% of limit ($${remainingDailyAllowance} buffer remaining).`);
  } else if (dailyUtilizationPct >= 75) {
    if (overallStatus === COMPLIANCE_STATUS.SAFE) overallStatus = COMPLIANCE_STATUS.APPROACHING_LIMIT;
    warnings.push(`Warning: Daily loss is at ${dailyUtilizationPct}% of allowed limit.`);
  }

  // Check Overall Drawdown Breach / Critical
  if (overallUtilizationPct >= 100) {
    overallStatus = COMPLIANCE_STATUS.BREACH_DETECTED;
    warnings.push(`Maximum drawdown breached! Current balance $${effectiveBalance} has fallen to or below the floor of $${overallFloor}.`);
  } else if (overallUtilizationPct >= 90) {
    if (overallStatus !== COMPLIANCE_STATUS.BREACH_DETECTED) overallStatus = COMPLIANCE_STATUS.CRITICAL;
    warnings.push(`Critical: Overall drawdown is at ${overallUtilizationPct}% of limit ($${remainingOverallAllowance} buffer remaining).`);
  } else if (overallUtilizationPct >= 75) {
    if (overallStatus === COMPLIANCE_STATUS.SAFE) overallStatus = COMPLIANCE_STATUS.APPROACHING_LIMIT;
    warnings.push(`Warning: Overall drawdown utilization reached ${overallUtilizationPct}%.`);
  }

  // Check Consistency / Best-Day Cap
  if (propFirm.consistencyRuleEnabled && propFirm.maximumBestDayPercent) {
    if (bestDayPercentage > propFirm.maximumBestDayPercent) {
      warnings.push(`Consistency warning: Best day accounts for ${bestDayPercentage}% of profit (allowed: ${propFirm.maximumBestDayPercent}%).`);
    }
  }

  // Check Phase Target Qualification
  const isPhasePassed = !isFunded &&
    overallStatus !== COMPLIANCE_STATUS.BREACH_DETECTED &&
    currentTotalProfit >= targetAmount &&
    completedTradingDays >= minimumTradingDays;

  if (isPhasePassed && overallStatus === COMPLIANCE_STATUS.SAFE) {
    overallStatus = COMPLIANCE_STATUS.PASSED;
  }

  // Source Freshness & Verification
  const rawSyncAt = account.lastSyncedAt || account.cloudLastSyncedAt || (closedTrades[0]?.createdAt) || account.updatedAt;
  const syncDate = rawSyncAt && !isNaN(new Date(rawSyncAt).getTime()) ? new Date(rawSyncAt) : referenceDate;
  const minutesSinceUpdate = Math.max(0, Math.floor((referenceDate.getTime() - syncDate.getTime()) / (1000 * 60)));
  const isStale = minutesSinceUpdate > (60 * 24); // > 24 hours without updates

  return {
    accountId: account.id,
    tradingAccountId: account.id,
    accountName: account.name,
    firmName: propFirm.customFirmName || propFirm.firmName,
    programmeName: propFirm.programmeName,
    currency: account.currency || 'USD',
    marketType: propFirm.marketType,
    evaluationType: propFirm.evaluationType,
    accountStatus: propFirm.accountStatus,
    isFunded,
    
    // Financial State
    startingBalance,
    currentBalance: effectiveBalance,
    equity: effectiveEquity,
    currentTotalProfit,
    highWaterMark,
    
    // Phase & Targets
    phase: {
      phaseNumber: activePhase.phaseNumber,
      name: activePhase.name,
      targetPercent,
      targetAmount,
      remainingProfitRequired,
      progressPercentage: challengeProgressPct,
      minimumTradingDays,
      completedTradingDays,
      daysProgressPercentage: daysProgressPct,
      isQualified: isPhasePassed,
    },

    // Daily Loss Rules
    dailyLoss: {
      enabled: propFirm.dailyLossEnabled !== false,
      limitPercent: dailyLossPercent,
      limitAmount: dailyLossLimitAmount,
      lossUsedToday: dailyLossUsed,
      currentLossAmount: dailyLossUsed,
      remainingAllowance: remainingDailyAllowance,
      remainingAllowanceAmount: remainingDailyAllowance,
      utilizationPercentage: dailyUtilizationPct,
      utilizationPercent: dailyUtilizationPct,
      todayNetPnl: Number(todayNetProfitLoss.toFixed(2)),
      todayTradeCount: todayTrades.length,
      explanation: 'Daily loss buffer is calculated strictly from trades closed since today\'s reset window.',
      resetConfig: {
        currentDayResetUtc: resetConfig.currentDayResetUtc.toISOString(),
        nextResetUtc: resetConfig.nextResetUtc.toISOString(),
        secondsUntilReset: resetConfig.secondsUntilReset,
        resetTime: resetConfig.resetTime,
        timezone: resetConfig.timezone,
      },
      resetBoundaries: {
        currentDayResetUtc: resetConfig.currentDayResetUtc.toISOString(),
        nextResetUtc: resetConfig.nextResetUtc.toISOString(),
        secondsUntilReset: resetConfig.secondsUntilReset,
        resetTime: resetConfig.resetTime,
        timezone: resetConfig.timezone,
      },
      status: dailyUtilizationPct >= 100 ? COMPLIANCE_STATUS.BREACH_DETECTED : (dailyUtilizationPct >= 75 ? COMPLIANCE_STATUS.APPROACHING_LIMIT : COMPLIANCE_STATUS.SAFE),
    },

    // Overall / Trailing Drawdown Rules
    drawdown: {
      type: isTrailing ? 'TRAILING' : 'STATIC',
      drawdownType: isTrailing ? 'TRAILING' : 'STATIC',
      limitPercent: overallLossPercent,
      limitAmount: overallLimitAmount,
      liquidationFloor: overallFloor,
      drawdownUsed: overallLossUsed,
      currentDrawdownAmount: overallLossUsed,
      remainingAllowance: remainingOverallAllowance,
      remainingAllowanceAmount: remainingOverallAllowance,
      utilizationPercentage: overallUtilizationPct,
      utilizationPercent: overallUtilizationPct,
      highWaterMark,
      explanation: isTrailing
        ? 'Dynamic trailing drawdown floor moves upward as peak account balance increases.'
        : 'Liquidation floor protects account integrity. Any equity dip to this floor causes account breach.',
      status: overallUtilizationPct >= 100 ? COMPLIANCE_STATUS.BREACH_DETECTED : (overallUtilizationPct >= 75 ? COMPLIANCE_STATUS.APPROACHING_LIMIT : COMPLIANCE_STATUS.SAFE),
    },

    overallDrawdown: {
      type: isTrailing ? 'TRAILING' : 'STATIC',
      drawdownType: isTrailing ? 'TRAILING' : 'STATIC',
      limitPercent: overallLossPercent,
      limitAmount: overallLimitAmount,
      liquidationFloor: overallFloor,
      drawdownUsed: overallLossUsed,
      currentDrawdownAmount: overallLossUsed,
      remainingAllowance: remainingOverallAllowance,
      remainingAllowanceAmount: remainingOverallAllowance,
      utilizationPercentage: overallUtilizationPct,
      utilizationPercent: overallUtilizationPct,
      highWaterMark,
      explanation: isTrailing
        ? 'Dynamic trailing drawdown floor moves upward as peak account balance increases.'
        : 'Liquidation floor protects account integrity. Any equity dip to this floor causes account breach.',
      status: overallUtilizationPct >= 100 ? COMPLIANCE_STATUS.BREACH_DETECTED : (overallUtilizationPct >= 75 ? COMPLIANCE_STATUS.APPROACHING_LIMIT : COMPLIANCE_STATUS.SAFE),
    },

    // Challenge Progression & Trading Days Aliases
    challengeProgress: {
      phaseNumber: activePhase.phaseNumber,
      name: activePhase.name,
      targetPercent,
      targetProfitAmount: targetAmount,
      currentProfitAmount: currentTotalProfit,
      remainingProfitRequired,
      progressPercent: challengeProgressPct,
      progressPercentage: challengeProgressPct,
      isTargetReached: currentTotalProfit >= targetAmount,
    },

    tradingDays: {
      requiredDays: minimumTradingDays,
      completedDays: completedTradingDays,
      isMinimumMet: completedTradingDays >= minimumTradingDays,
      progressPercentage: daysProgressPct,
    },

    // Consistency & Disciplines
    consistency: {
      ruleEnabled: Boolean(propFirm.consistencyRuleEnabled),
      maxAllowedBestDayPercent: propFirm.maximumBestDayPercent || null,
      maximumBestDayPercent: propFirm.maximumBestDayPercent || null,
      currentBestDayProfit: Number(bestDayProfit.toFixed(2)),
      bestDayProfit: Number(bestDayProfit.toFixed(2)),
      currentBestDayPercentage: bestDayPercentage,
      bestDayPercent: bestDayPercentage,
      profitableDaysCount,
      completedTradingDays,
      isCompliant: !propFirm.consistencyRuleEnabled || !propFirm.maximumBestDayPercent || (bestDayPercentage <= propFirm.maximumBestDayPercent),
    },

    // Freshness & State Summary
    freshness: {
      level: isStale ? 'STALE' : 'LIVE',
      label: account.cloudSyncEnabled ? 'Live Broker Sync' : (trades.length > 0 ? 'Journal Ledger Verified' : 'Manual Entry'),
      lastUpdatedAt: syncDate.toISOString(),
      minutesSinceUpdate,
      isStale,
    },
    summaryStatus: overallStatus,

    // Overall Compliance Result
    compliance: {
      status: overallStatus,
      isBreached: overallStatus === COMPLIANCE_STATUS.BREACH_DETECTED,
      isPassing: isPhasePassed,
      warnings,
      evaluatedAt: referenceDate.toISOString(),
      dataFreshness: {
        lastUpdatedAt: syncDate.toISOString(),
        minutesSinceUpdate,
        isStale,
        dataSource: account.cloudSyncEnabled ? 'BROKER_SYNC' : (trades.length > 0 ? 'JOURNAL_LEDGER' : 'MANUAL_ENTRY'),
      },
    },
  };
};

/**
 * Retrieves an account with all associated relations and evaluates compliance.
 */
const getPropFirmComplianceReport = async (arg1, arg2, referenceDate = new Date()) => {
  const account = await prisma.tradingAccount.findFirst({
    where: {
      OR: [
        { id: arg2, userId: arg1 },
        { id: arg1, userId: arg2 },
      ],
    },
    include: {
      propFirmAccount: {
        include: {
          phases: { orderBy: { phaseNumber: 'asc' } },
          progressSnapshots: { orderBy: { recordedAt: 'desc' }, take: 10 },
        },
      },
      trades: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!account || !account.propFirmAccount) {
    return null;
  }

  return evaluatePropFirmCompliance(account, referenceDate);
};

module.exports = {
  COMPLIANCE_STATUS,
  parseTimeString,
  calculateDailyResetBoundaries,
  calculateHighWaterMark,
  evaluatePropFirmCompliance,
  getPropFirmComplianceReport,
};
