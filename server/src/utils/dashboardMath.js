const { normalizeTradeResult } = require('./tradeCalculations');

const closedResults = new Set(['WIN', 'LOSS', 'BREAKEVEN']);

const round = (value, places = 2) => Number((Number(value) || 0).toFixed(places));
const safeDivide = (numerator, denominator) => (denominator ? numerator / denominator : 0);
const isClosedTrade = (trade) => closedResults.has(normalizeTradeResult(trade));
const getTradeTimestamp = (trade) => trade.exitTime || trade.entryTime || trade.createdAt;
const getClosedTradeTimestamp = (trade) => trade.exitTime || trade.updatedAt || trade.entryTime || trade.createdAt;

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateKey = (date) => {
  const value = new Date(date);
  return value.toISOString().slice(0, 10);
};

const calculateProfitFactor = (grossProfit, grossLoss) => {
  if (!grossLoss) return null;
  return round(grossProfit / grossLoss, 2);
};

const calculateSummary = (trades = [], startingBalance = 0) => {
  const closedTrades = trades.filter(isClosedTrade);
  const wins = closedTrades.filter((trade) => normalizeTradeResult(trade) === 'WIN');
  const losses = closedTrades.filter((trade) => normalizeTradeResult(trade) === 'LOSS');
  const breakevens = closedTrades.filter((trade) => normalizeTradeResult(trade) === 'BREAKEVEN');
  const values = closedTrades.map((trade) => Number(trade.profitLossAmount || 0));
  const grossProfit = values.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const grossLoss = Math.abs(values.filter((value) => value < 0).reduce((total, value) => total + value, 0));
  const netProfitLoss = grossProfit - grossLoss;
  const winRate = safeDivide(wins.length, closedTrades.length) * 100;
  const lossRate = safeDivide(losses.length, closedTrades.length) * 100;
  const breakEvenRate = safeDivide(breakevens.length, closedTrades.length) * 100;
  const beProtectedTrades = trades.filter((t) => t.breakEvenActivated === true).length;

  return {
    netProfitLoss: round(netProfitLoss),
    returnPercentage: startingBalance ? round((netProfitLoss / startingBalance) * 100, 2) : 0,
    winRate: round(winRate, 1),
    lossRate: round(lossRate, 1),
    breakEvenRate: round(breakEvenRate, 1),
    beProtectedTrades,
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    averageWin: round(safeDivide(grossProfit, wins.length)),
    averageLoss: round(safeDivide(grossLoss, losses.length)),
    profitFactor: calculateProfitFactor(grossProfit, grossLoss),
  };
};

const calculateEquityCurve = (trades = [], startingBalance = 0) => {
  let cumulativeProfitLoss = 0;
  const points = [{
    date: null,
    label: 'Start',
    equity: round(startingBalance),
    cumulativeProfitLoss: 0,
    profitLoss: 0,
  }];

  [...trades]
    .filter(isClosedTrade)
    .sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
    .forEach((trade) => {
      const timestamp = getTradeTimestamp(trade);
      const profitLoss = Number(trade.profitLossAmount || 0);
      cumulativeProfitLoss += profitLoss;
      points.push({
        tradeId: trade.id,
        date: timestamp.toISOString(),
        label: timestamp.toISOString().slice(0, 10),
        equity: round(startingBalance + cumulativeProfitLoss),
        cumulativeProfitLoss: round(cumulativeProfitLoss),
        profitLoss: round(profitLoss),
      });
    });

  return points;
};

const calculateDrawdown = (equityCurve = [], startingBalance = 0) => {
  let runningPeak = startingBalance;
  let maximumDrawdown = 0;
  let maximumDrawdownPercentage = 0;

  const data = equityCurve.map((point) => {
    const equity = Number(point.equity || 0);
    runningPeak = Math.max(runningPeak, equity);
    const drawdownAmount = Math.max(0, runningPeak - equity);
    const drawdownPercentage = runningPeak > 0 ? (drawdownAmount / runningPeak) * 100 : 0;
    maximumDrawdown = Math.max(maximumDrawdown, drawdownAmount);
    maximumDrawdownPercentage = Math.max(maximumDrawdownPercentage, drawdownPercentage);

    return {
      ...point,
      runningPeak: round(runningPeak),
      drawdownAmount: round(drawdownAmount),
      drawdownPercentage: round(drawdownPercentage, 2),
    };
  });

  return {
    maximumDrawdown: round(maximumDrawdown),
    maximumDrawdownPercentage: round(maximumDrawdownPercentage, 2),
    data,
  };
};

const eventPriority = {
  account_start: 0,
  opening_balance: 0,
  period_start: 0,
  deposit: 1,
  withdrawal: 2,
  payout: 2,
  fee: 2,
  trade: 3,
  trade_win: 3,
  trade_loss: 3,
  trade_breakeven: 3,
  trade_day: 3,
  balance_adjustment: 4,
  period_end: 9,
};

const sortCurveEvents = (events = []) => [...events].sort((a, b) => {
  const dateDiff = toDate(a.date) - toDate(b.date);
  if (dateDiff) return dateDiff;
  const priorityDiff = (eventPriority[a.eventType] ?? 5) - (eventPriority[b.eventType] ?? 5);
  if (priorityDiff) return priorityDiff;
  return (a.sequence ?? 0) - (b.sequence ?? 0);
});

const isWithinPeriod = (date, startDate, endDate) => {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

const getAccountStartDate = (account) => (
  toDate(account.createdAt) || toDate(account.updatedAt) || new Date(0)
);

const getCurveStartDate = ({ accounts = [], events = [], startDate = null, endDate = null, now = new Date() }) => {
  if (startDate) return startDate;

  const candidates = [
    ...accounts.map(getAccountStartDate),
    ...events.map((event) => toDate(event.date)),
  ].filter((date) => date && (!endDate || date <= endDate));

  if (!candidates.length) return now;
  return new Date(Math.min(...candidates.map((date) => date.getTime())));
};

const getCurveEndDate = ({ startDate, endDate, events = [], now = new Date() }) => {
  if (endDate && endDate > startDate) return endDate;
  const latestEvent = events
    .map((event) => toDate(event.date))
    .filter((date) => date && date > startDate)
    .sort((a, b) => b - a)[0];
  if (latestEvent) return latestEvent;
  if (now > startDate) return now;
  return new Date(startDate.getTime() + 1);
};

const buildInitialDepositEvents = (accounts = [], normalizedFundingEvents = []) => {
  const accountsWithOpening = new Set(
    normalizedFundingEvents
      .filter((event) => event.eventType === 'opening_balance' && event.accountId)
      .map((event) => event.accountId),
  );

  return accounts
    .map((account, index) => {
      if (accountsWithOpening.has(account.id)) return null;
      const amount = Number(account.startingBalance || 0);
      if (!amount) return null;
      const date = getAccountStartDate(account);
      return {
        accountId: account.id,
        accountName: account.name,
        date: date.toISOString(),
        eventType: 'deposit',
        label: 'Deposit',
        change: round(Math.abs(amount)),
        source: 'startingBalance',
        sequence: index,
      };
    })
    .filter(Boolean);
};

const normalizeFundingEvents = (fundingEvents = []) => fundingEvents
  .map((event, index) => {
    if (!event || event.archivedAt) return null;
    const date = toDate(event.occurredAt || event.date || event.createdAt || event.recordedAt);
    const hasSignedAmount = event.signedAmount !== undefined && event.signedAmount !== null;
    const rawSigned = hasSignedAmount
      ? Number(event.signedAmount)
      : Number(event.amount ?? event.change ?? 0);
    const rawAmount = Number(event.amount ?? event.change ?? rawSigned);
    if (!date || (!rawAmount && !rawSigned)) return null;

    const rawType = String(event.eventType || event.type || '').trim();
    const upperType = rawType.toUpperCase();
    const dir = String(event.direction || '').toUpperCase();

    let eventType = 'deposit';
    let label = 'Deposit';
    let change = round(Math.abs(rawAmount));

    if (upperType === 'OPENING_BALANCE') {
      eventType = 'opening_balance';
      label = 'Opening balance';
      change = hasSignedAmount
        ? round(rawSigned)
        : round(dir === 'OUTFLOW' || rawAmount < 0 ? -Math.abs(rawAmount) : Math.abs(rawAmount));
    } else if (upperType === 'WITHDRAWAL') {
      eventType = 'withdrawal';
      label = 'Withdrawal';
      change = round(-Math.abs(rawAmount));
    } else if (upperType === 'PAYOUT') {
      eventType = 'payout';
      label = 'Payout';
      change = round(-Math.abs(rawAmount));
    } else if (upperType === 'FEE') {
      eventType = 'fee';
      label = 'Fee';
      change = round(-Math.abs(rawAmount));
    } else if (upperType === 'ADJUSTMENT' || rawType === 'balance_adjustment') {
      eventType = 'balance_adjustment';
      label = 'Balance adjustment';
      change = hasSignedAmount
        ? round(rawSigned)
        : round(dir === 'OUTFLOW' || rawAmount < 0 ? -Math.abs(rawAmount) : Math.abs(rawAmount));
    } else if (upperType === 'DEPOSIT' || (!rawType && rawAmount > 0)) {
      eventType = 'deposit';
      label = 'Deposit';
      change = round(Math.abs(rawAmount));
    } else if (rawAmount < 0) {
      eventType = 'withdrawal';
      label = 'Withdrawal';
      change = round(-Math.abs(rawAmount));
    }

    return {
      transactionId: event.id || event.transactionId || null,
      accountId: event.accountId || event.tradingAccountId || null,
      accountName: event.accountName || event.tradingAccount?.name || null,
      date: date.toISOString(),
      eventType,
      label,
      change,
      note: event.note || null,
      source: event.source || (event.id ? 'accountTransaction' : 'fundingEvent'),
      sequence: index,
    };
  })
  .filter(Boolean);

const getClosedTradeEvents = (trades = []) => trades
  .filter(isClosedTrade)
  .map((trade, index) => {
    const date = toDate(getClosedTradeTimestamp(trade));
    if (!date) return null;
    const tradePnl = Number(trade.profitLossAmount || 0);
    const result = normalizeTradeResult(trade);
    const eventType = result === 'WIN'
      ? 'trade_win'
      : result === 'LOSS'
        ? 'trade_loss'
        : 'trade_breakeven';
    return {
      accountId: trade.tradingAccountId,
      accountName: trade.tradingAccount?.name,
      tradeId: trade.id,
      date: date.toISOString(),
      eventType,
      label: 'Closed trade',
      tradePnl: round(tradePnl),
      change: round(tradePnl),
      result,
      sequence: index,
    };
  })
  .filter(Boolean);

const sumEventChangesForAccount = (events = [], accountId) => events
  .filter((event) => event.accountId === accountId)
  .reduce((total, event) => total + Number(event.change || 0), 0);

const buildBalanceAdjustmentEvents = ({ accounts = [], fundingEvents = [], tradeEvents = [], now = new Date() }) => accounts
  .map((account, index) => {
    const currentBalance = Number(account.currentBalance);
    if (!Number.isFinite(currentBalance)) return null;

    const startingBalance = Number(account.startingBalance || 0);
    if (round(currentBalance - startingBalance) === 0) return null;

    const knownBalance = sumEventChangesForAccount(fundingEvents, account.id)
      + sumEventChangesForAccount(tradeEvents, account.id);
    const adjustment = round(currentBalance - knownBalance);
    if (adjustment === 0) return null;

    const date = toDate(account.updatedAt) || toDate(account.createdAt) || now;
    return {
      accountId: account.id,
      accountName: account.name,
      date: date.toISOString(),
      eventType: 'balance_adjustment',
      label: 'Balance adjustment',
      change: adjustment,
      source: 'currentBalance',
      sequence: index,
    };
  })
  .filter(Boolean);

const groupTradeEventsByDay = (tradeEvents) => {
  const buckets = new Map();

  tradeEvents.forEach((event) => {
    const key = formatDateKey(event.date);
    if (!buckets.has(key)) {
      buckets.set(key, {
        date: event.date,
        eventType: 'trade_day',
        label: 'Trading day',
        tradePnl: 0,
        change: 0,
        tradeCount: 0,
        tradeIds: [],
        sequence: event.sequence,
      });
    }

    const bucket = buckets.get(key);
    bucket.date = event.date;
    bucket.tradePnl += Number(event.tradePnl || 0);
    bucket.change += Number(event.change || 0);
    bucket.tradeCount += 1;
    bucket.tradeIds.push(event.tradeId);
    bucket.sequence = Math.min(bucket.sequence, event.sequence);
  });

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    tradePnl: round(bucket.tradePnl),
    change: round(bucket.change),
  }));
};

const buildCumulativePnlCurve = ({ accounts, tradeEvents, fundingEvents, startDate, endDate, now }) => {
  const periodTradeEvents = sortCurveEvents(tradeEvents.filter((event) => isWithinPeriod(toDate(event.date), startDate, endDate)));
  const shouldGroupByDay = periodTradeEvents.length > 60;
  const visibleTradeEvents = shouldGroupByDay ? groupTradeEventsByDay(periodTradeEvents) : periodTradeEvents;
  const start = getCurveStartDate({
    accounts,
    events: [...periodTradeEvents, ...fundingEvents],
    startDate,
    endDate,
    now,
  });
  let cumulative = 0;
  const points = [{
    date: start.toISOString(),
    value: 0,
    tradePnl: 0,
    eventType: startDate ? 'period_start' : 'account_start',
    label: startDate ? 'Period start' : 'Account created',
  }];

  visibleTradeEvents.forEach((event) => {
    const tradePnl = Number(event.tradePnl || event.change || 0);
    cumulative += tradePnl;
    points.push({
      ...event,
      value: round(cumulative),
      tradePnl: round(tradePnl),
      change: round(tradePnl),
    });
  });

  const hasFundingActivity = fundingEvents.some((event) => isWithinPeriod(toDate(event.date), startDate, endDate));
  if (points.length === 1 && hasFundingActivity) {
    points.push({
      date: getCurveEndDate({ startDate: start, endDate, events: fundingEvents, now }).toISOString(),
      value: 0,
      tradePnl: 0,
      change: 0,
      eventType: 'period_end',
      label: 'Period end',
    });
  }

  return points;
};

const buildAccountBalanceCurve = ({ accounts, tradeEvents, fundingEvents, balanceAdjustmentEvents = [], startDate, endDate, now }) => {
  const accountStartEvents = accounts.map((account, index) => ({
    accountId: account.id,
    accountName: account.name,
    date: getAccountStartDate(account).toISOString(),
    eventType: 'account_start',
    label: 'Account created',
    change: 0,
    sequence: index,
  }));
  const allEvents = sortCurveEvents([...accountStartEvents, ...fundingEvents, ...tradeEvents, ...balanceAdjustmentEvents]);
  const openingBalance = startDate
    ? allEvents
      .filter((event) => toDate(event.date) < startDate)
      .reduce((total, event) => total + Number(event.change || 0), 0)
    : 0;
  const periodEvents = allEvents.filter((event) => isWithinPeriod(toDate(event.date), startDate, endDate));
  const start = getCurveStartDate({
    accounts,
    events: periodEvents.length ? periodEvents : allEvents,
    startDate,
    endDate,
    now,
  });
  let balance = openingBalance;
  const points = [{
    date: start.toISOString(),
    value: round(balance),
    change: 0,
    eventType: startDate ? 'period_start' : 'account_start',
    label: startDate ? 'Period start' : 'Account created',
  }];

  periodEvents.forEach((event) => {
    if (!startDate && event.eventType === 'account_start' && toDate(event.date).getTime() === start.getTime()) return;
    const change = Number(event.change || 0);
    balance += change;
    points.push({
      ...event,
      value: round(balance),
      change: round(change),
    });
  });

  if (points.length === 1 && (fundingEvents.length || tradeEvents.length || balanceAdjustmentEvents.length)) {
    points.push({
      date: getCurveEndDate({ startDate: start, endDate, events: allEvents, now }).toISOString(),
      value: round(balance),
      change: 0,
      eventType: 'period_end',
      label: 'Period end',
    });
  }

  return points;
};

const summarizeFunding = (fundingEvents = [], startDate = null, endDate = null) => fundingEvents
  .filter((event) => isWithinPeriod(toDate(event.date), startDate, endDate))
  .reduce((totals, event) => {
    const change = Number(event.change || 0);
    const type = event.eventType;
    if (type === 'opening_balance') {
      totals.openingBalance += change;
      if (change > 0) totals.totalDeposits += change;
    } else if (type === 'deposit') {
      if (event.source === 'startingBalance') {
        totals.openingBalance += Math.abs(change);
      } else {
        totals.deposits += Math.abs(change);
      }
      totals.totalDeposits += Math.abs(change);
    } else if (type === 'withdrawal') {
      totals.withdrawals += Math.abs(change);
      totals.totalWithdrawals += Math.abs(change);
    } else if (type === 'payout') {
      totals.payouts += Math.abs(change);
    } else if (type === 'fee') {
      totals.fees += Math.abs(change);
    } else if (type === 'balance_adjustment') {
      totals.adjustments += change;
    }
    return totals;
  }, {
    openingBalance: 0,
    deposits: 0,
    withdrawals: 0,
    payouts: 0,
    fees: 0,
    adjustments: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
  });

const calculateTimeWeightedReturn = ({
  tradeEvents = [],
  fundingEvents = [],
  startDate = null,
  endDate = null,
}) => {
  const periodTrades = tradeEvents.filter((event) => isWithinPeriod(toDate(event.date), startDate, endDate));
  const combined = sortCurveEvents([
    ...fundingEvents,
    ...tradeEvents,
  ]).filter((event) => !endDate || toDate(event.date) <= endDate);

  const isNonOpeningCashFlow = (event) => (
    event.eventType === 'deposit' && event.source !== 'startingBalance'
  )
    || event.eventType === 'withdrawal'
    || event.eventType === 'payout'
    || event.eventType === 'fee'
    || event.eventType === 'balance_adjustment';

  const hasMidPeriodCashFlow = combined.some(
    (event) => isNonOpeningCashFlow(event) && isWithinPeriod(toDate(event.date), startDate, endDate),
  );

  if (periodTrades.length === 0) {
    return {
      value: 0,
      method: hasMidPeriodCashFlow ? 'TWR' : 'SIMPLE',
    };
  }

  let runningCapital = 0;
  let subPeriodStartCapital = 0;
  let subPeriodTradePnl = 0;
  let subPeriodHasTrades = false;
  let compoundFactor = 1;
  let unavailable = false;

  for (const event of combined) {
    const evDate = toDate(event.date);
    const inPeriod = isWithinPeriod(evDate, startDate, endDate);
    const change = Number(event.change || 0);
    const isTrade = String(event.eventType || '').startsWith('trade');

    if (!inPeriod) {
      // Strictly before startDate (already filtered > endDate out above)
      runningCapital += change;
      subPeriodStartCapital = runningCapital;
      continue;
    }

    if (isTrade) {
      runningCapital += change;
      subPeriodTradePnl += change;
      subPeriodHasTrades = true;
      continue;
    }

    // Capital/funding event inside period: close any active sub-period before updating capital
    if (subPeriodHasTrades) {
      if (subPeriodStartCapital <= 0) {
        unavailable = true;
        break;
      }
      compoundFactor *= 1 + (subPeriodTradePnl / subPeriodStartCapital);
      subPeriodTradePnl = 0;
      subPeriodHasTrades = false;
    }

    runningCapital += change;
    subPeriodStartCapital = runningCapital;
  }

  if (!unavailable && subPeriodHasTrades) {
    if (subPeriodStartCapital <= 0) {
      unavailable = true;
    } else {
      compoundFactor *= 1 + (subPeriodTradePnl / subPeriodStartCapital);
    }
  }

  if (unavailable || !Number.isFinite(compoundFactor)) {
    return { value: null, method: 'UNAVAILABLE' };
  }

  return {
    value: round((compoundFactor - 1) * 100, 2),
    method: hasMidPeriodCashFlow ? 'TWR' : 'SIMPLE',
  };
};

const buildPerformanceCurve = ({
  accounts = [],
  trades = [],
  fundingEvents = [],
  startDate = null,
  endDate = null,
  now = new Date(),
} = {}) => {
  const normalizedStartDate = toDate(startDate);
  const normalizedEndDate = toDate(endDate);
  const normalizedIncomingFunding = normalizeFundingEvents(fundingEvents);
  const knownFundingEvents = sortCurveEvents([
    ...buildInitialDepositEvents(accounts, normalizedIncomingFunding),
    ...normalizedIncomingFunding,
  ]);
  const tradeEvents = sortCurveEvents(getClosedTradeEvents(trades));
  const balanceAdjustmentEvents = sortCurveEvents(buildBalanceAdjustmentEvents({
    accounts,
    fundingEvents: knownFundingEvents,
    tradeEvents,
    now,
  }));
  const cumulativePnl = buildCumulativePnlCurve({
    accounts,
    tradeEvents,
    fundingEvents: knownFundingEvents,
    balanceAdjustmentEvents,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    now,
  });
  const accountBalance = buildAccountBalanceCurve({
    accounts,
    tradeEvents,
    fundingEvents: knownFundingEvents,
    balanceAdjustmentEvents,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    now,
  });
  const periodTradeEvents = tradeEvents.filter((event) => isWithinPeriod(toDate(event.date), normalizedStartDate, normalizedEndDate));
  const netTradingPnl = periodTradeEvents.reduce((total, event) => total + Number(event.tradePnl || 0), 0);
  const fundingSummary = summarizeFunding(knownFundingEvents, null, normalizedEndDate);
  const syntheticAdjustments = balanceAdjustmentEvents
    .filter((event) => isWithinPeriod(toDate(event.date), null, normalizedEndDate))
    .reduce((total, event) => total + Number(event.change || 0), 0);
  const totalAdjustments = fundingSummary.adjustments + syntheticAdjustments;
  const netCashFlow = round(
    fundingSummary.deposits
    - fundingSummary.withdrawals
    - fundingSummary.payouts
    - fundingSummary.fees
    + totalAdjustments,
  );
  const netDeposits = fundingSummary.totalDeposits - fundingSummary.totalWithdrawals;
  const currentBalance = accountBalance[accountBalance.length - 1]?.value || 0;
  const netAccountChange = round(netTradingPnl + netCashFlow);
  const twr = calculateTimeWeightedReturn({
    tradeEvents,
    fundingEvents: knownFundingEvents,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  });
  const simpleReturnPct = netDeposits > 0 ? round((netTradingPnl / netDeposits) * 100, 2) : 0;

  return {
    cumulativePnl,
    accountBalance,
    summary: {
      netTradingPnl: round(netTradingPnl),
      tradingReturnPercentage: twr.method === 'TWR' ? twr.value : simpleReturnPct,
      timeWeightedReturnPercentage: twr.value,
      returnMethod: twr.method,
      closedTrades: periodTradeEvents.length,
      openingBalance: round(fundingSummary.openingBalance),
      deposits: round(fundingSummary.deposits),
      withdrawals: round(fundingSummary.withdrawals),
      payouts: round(fundingSummary.payouts),
      fees: round(fundingSummary.fees),
      adjustments: round(totalAdjustments),
      netCashFlow,
      netAccountChange,
      totalDeposits: round(fundingSummary.totalDeposits),
      totalWithdrawals: round(fundingSummary.totalWithdrawals),
      currentBalance: round(currentBalance),
      netDeposits: round(netDeposits),
      balanceAdjustments: round(totalAdjustments),
      hasCashFlowEvents: normalizedIncomingFunding.some((event) => event.eventType !== 'opening_balance'),
    },
    metadata: {
      usesStartingBalanceAsInitialDeposit: true,
      usesCurrentBalanceReconciliation: balanceAdjustmentEvents.length > 0,
      hasTransactionHistory: fundingEvents.length > 0,
      withdrawalHistoryAvailable: normalizedIncomingFunding.some((event) => (
        event.eventType === 'withdrawal' || event.eventType === 'payout' || event.eventType === 'fee'
      )),
    },
  };
};

const calculatePeriodComparison = (current, previous) => ({
  netProfitLossChange: round(current.netProfitLoss - previous.netProfitLoss),
  winRateChange: round(current.winRate - previous.winRate, 1),
  totalTradesChange: current.totalTrades - previous.totalTrades,
  profitFactorChange: (current.profitFactor == null || previous.profitFactor == null)
    ? null
    : round(current.profitFactor - previous.profitFactor, 2),
  drawdownChange: round((current.maximumDrawdownPercentage || 0) - (previous.maximumDrawdownPercentage || 0), 2),
});

const bucketByDate = (trades = []) => {
  const buckets = new Map();

  trades.filter(isClosedTrade).forEach((trade) => {
    const key = formatDateKey(getTradeTimestamp(trade));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(trade);
  });

  return buckets;
};

module.exports = {
  closedResults,
  round,
  safeDivide,
  isClosedTrade,
  getTradeTimestamp,
  getClosedTradeTimestamp,
  formatDateKey,
  calculateProfitFactor,
  normalizeTradeResult,
  calculateSummary,
  calculateEquityCurve,
  calculateDrawdown,
  buildPerformanceCurve,
  calculatePeriodComparison,
  calculateTimeWeightedReturn,
  normalizeFundingEvents,
  bucketByDate,
};
