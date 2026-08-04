const csv = require('csv-parser');
const streamifier = require('streamifier');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const parseTradeCsv = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    streamifier.createReadStream(buffer)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

const parseBool = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).toLowerCase().trim();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return null;
};

const mapCsvRowToTrade = (row, accountId) => {
  // Normalize row keys to lower-case trimmed strings
  const normalizedRow = Object.keys(row).reduce((acc, key) => {
    acc[key.trim().toLowerCase()] = row[key];
    return acc;
  }, {});

  // Pair mapping
  const pair = 
    normalizedRow['item'] || 
    normalizedRow['symbol'] || 
    normalizedRow['pair'] || 
    normalizedRow['instrument'] || 
    normalizedRow['currency'] || 
    normalizedRow['ticker'] || 
    normalizedRow['asset'] || 
    normalizedRow['market'];

  if (!pair) return null;

  // Direction mapping
  const rawDirection = String(
    normalizedRow['type'] || 
    normalizedRow['action'] || 
    normalizedRow['direction'] || 
    normalizedRow['side'] || 
    normalizedRow['trade type'] || 
    normalizedRow['b/s'] || 
    normalizedRow['order type'] || ''
  ).toLowerCase();

  const direction = rawDirection.includes('buy') || rawDirection.includes('long')
    ? 'BUY'
    : rawDirection.includes('sell') || rawDirection.includes('short')
    ? 'SELL'
    : null;

  if (!direction) return null;

  // Time mapping
  const entryTimeStr = 
    normalizedRow['entrytime'] ||
    normalizedRow['entry time'] || 
    normalizedRow['entry_time'] || 
    normalizedRow['open time'] || 
    normalizedRow['time'] || 
    normalizedRow['date'] || 
    normalizedRow['open_time'] || 
    normalizedRow['date/time'] || 
    normalizedRow['created_at'] || 
    normalizedRow['timestamp'];

  const exitTimeStr = 
    normalizedRow['exittime'] ||
    normalizedRow['exit time'] || 
    normalizedRow['exit_time'] || 
    normalizedRow['close time'] || 
    normalizedRow['close_time'];
  
  // Numeric mapping helpers
  const getNum = (val) => {
    if (val === null || val === undefined || val === '' || val === 'null') return null;
    const n = Number(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? null : n;
  };

  const getStr = (val) => {
    if (val === null || val === undefined || val === 'null' || val === 'undefined') return null;
    const s = String(val).trim();
    return s.length > 0 ? s : null;
  };

  const entryTime = entryTimeStr ? new Date(entryTimeStr) : new Date();
  const exitTime = exitTimeStr && exitTimeStr !== 'null' && exitTimeStr !== 'undefined' ? new Date(exitTimeStr) : null;
  
  const profitLossAmount = getNum(
    normalizedRow['profitlossamount'] ||
    normalizedRow['profit loss amount'] ||
    normalizedRow['profit'] || 
    normalizedRow['net profit'] || 
    normalizedRow['p/l'] || 
    normalizedRow['pl'] || 
    normalizedRow['pnl'] || 
    normalizedRow['profit/loss'] || 
    normalizedRow['net_profit'] || 
    normalizedRow['realized p&l'] || 
    normalizedRow['realized pnl']
  ) || 0;

  const rawResult = getStr(normalizedRow['result']);
  const result = rawResult 
    ? (rawResult.toUpperCase() === 'WIN' || rawResult.toUpperCase() === 'LOSS' || rawResult.toUpperCase() === 'BREAKEVEN' ? rawResult.toUpperCase() : (profitLossAmount > 0 ? 'WIN' : profitLossAmount < 0 ? 'LOSS' : 'BREAKEVEN'))
    : (profitLossAmount > 0 ? 'WIN' : profitLossAmount < 0 ? 'LOSS' : 'BREAKEVEN');

  const rawStatus = getStr(normalizedRow['status']);
  const status = rawStatus
    ? (['PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED'].includes(rawStatus.toUpperCase()) ? rawStatus.toUpperCase() : (exitTime ? 'CLOSED' : 'ACTIVE'))
    : (exitTime ? 'CLOSED' : 'ACTIVE');

  return {
    tradingAccountId: accountId,
    pair: String(pair).toUpperCase().trim(),
    direction,
    entryPrice: getNum(normalizedRow['entryprice'] || normalizedRow['entry price'] || normalizedRow['open price'] || normalizedRow['price']),
    stopLoss: getNum(normalizedRow['stoploss'] || normalizedRow['stop loss'] || normalizedRow['s / l'] || normalizedRow['sl']),
    takeProfit: getNum(normalizedRow['takeprofit'] || normalizedRow['take profit'] || normalizedRow['t / p'] || normalizedRow['tp']),
    exitPrice: getNum(normalizedRow['exitprice'] || normalizedRow['exit price'] || normalizedRow['close price']),
    lotSize: getNum(normalizedRow['lotsize'] || normalizedRow['lot size'] || normalizedRow['size'] || normalizedRow['volume'] || normalizedRow['lots']),
    riskAmount: getNum(normalizedRow['riskamount'] || normalizedRow['risk amount']),
    rewardAmount: getNum(normalizedRow['rewardamount'] || normalizedRow['reward amount']),
    profitLossAmount,
    profitLossPercent: getNum(normalizedRow['profitlosspercent'] || normalizedRow['profit loss percent']),
    riskRewardRatio: getNum(normalizedRow['riskrewardratio'] || normalizedRow['risk reward ratio']),
    pips: getNum(normalizedRow['pips']),
    status,
    result,
    session: getStr(normalizedRow['session']) ? getStr(normalizedRow['session']).toUpperCase() : null,
    higherTimeframe: getStr(normalizedRow['highertimeframe'] || normalizedRow['higher timeframe'] || normalizedRow['htf']),
    entryTimeframe: getStr(normalizedRow['entrytimeframe'] || normalizedRow['entry timeframe'] || normalizedRow['ltf']),
    htfBias: getStr(normalizedRow['htfbias'] || normalizedRow['htf bias'] || normalizedRow['bias']),
    entryReason: getStr(normalizedRow['entryreason'] || normalizedRow['entry reason']),
    exitReason: getStr(normalizedRow['exitreason'] || normalizedRow['exit reason']),
    notesBefore: getStr(normalizedRow['notesbefore'] || normalizedRow['notes before'] || normalizedRow['notes']),
    notesAfter: getStr(normalizedRow['notesafter'] || normalizedRow['notes after']),
    followedPlan: parseBool(normalizedRow['followedplan'] || normalizedRow['followed plan']),
    isAPlusSetup: parseBool(normalizedRow['isaplussetup'] || normalizedRow['is a+ setup'] || normalizedRow['a+ setup']),
    newsRelated: parseBool(normalizedRow['newsrelated'] || normalizedRow['news related']),
    grade: getStr(normalizedRow['grade']),
    entryTime: !isNaN(entryTime.getTime()) ? entryTime : new Date(),
    exitTime: exitTime && !isNaN(exitTime.getTime()) ? exitTime : null,
  };
};

const importTrades = async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: 'Target trading account is required' });
    }

    // Verify account ownership
    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId: req.user.id },
    });

    if (!account) {
      return res.status(404).json({ message: 'Target trading account not found' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No CSV file uploaded or file is empty.' });
    }

    const rows = await parseTradeCsv(req.file.buffer);
    
    // Map valid rows
    const pendingTrades = rows
      .map((row) => mapCsvRowToTrade(row, account.id))
      .filter((t) => t !== null && !isNaN(t.entryTime?.getTime()));

    if (pendingTrades.length === 0) {
      return res.status(400).json({ message: 'No valid trades found to import. Please check your CSV format.' });
    }

    // Fetch existing trades to deduplicate based on (pair + entryTime)
    const existingTrades = await prisma.trade.findMany({
      where: { tradingAccountId: account.id },
      select: { pair: true, entryTime: true },
    });

    const existingKeys = new Set(
      existingTrades.map(t => `${t.pair}_${t.entryTime?.getTime()}`)
    );

    const newTrades = pendingTrades.filter(
      (t) => !existingKeys.has(`${t.pair}_${t.entryTime?.getTime()}`)
    );

    if (newTrades.length === 0) {
      return res.status(200).json({ message: 'All trades in this file have already been imported.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.trade.createMany({
        data: newTrades,
      });

      const netProfitLoss = newTrades.reduce((sum, t) => {
        if (t.status === 'CLOSED' && typeof t.profitLossAmount === 'number') {
          return sum + t.profitLossAmount;
        }
        return sum;
      }, 0);

      if (netProfitLoss !== 0) {
        await tx.tradingAccount.update({
          where: { id: account.id },
          data: { currentBalance: { increment: netProfitLoss } }
        });
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${newTrades.length} trades (${pendingTrades.length - newTrades.length} skipped as duplicates).`,
      importedCount: newTrades.length,
      skippedCount: pendingTrades.length - newTrades.length,
    });
  } catch (error) {
    console.error('Error during trade CSV import:', error);
    res.status(500).json({ message: 'An error occurred during trade import.' });
  }
};

module.exports = {
  importTrades,
};
