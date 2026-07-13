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

const mapCsvRowToTrade = (row, accountId) => {
  // Normalize row keys
  const normalizedRow = Object.keys(row).reduce((acc, key) => {
    acc[key.trim().toLowerCase()] = row[key];
    return acc;
  }, {});

  // Different platforms use different headings. Example headers:
  // Pair: Item, Symbol, Pair
  // Direction: Type, Action, Direction
  // Entry Time: Open Time, Time, Entry
  // Exit Time: Close Time, Exit
  // Profit: Profit, Net Profit
  
  const pair = normalizedRow['item'] || normalizedRow['symbol'] || normalizedRow['pair'];
  if (!pair) return null;

  const rawDirection = String(normalizedRow['type'] || normalizedRow['action'] || normalizedRow['direction'] || '').toLowerCase();
  const direction = rawDirection.includes('buy') ? 'BUY' : rawDirection.includes('sell') ? 'SELL' : null;
  if (!direction) return null;

  const entryTimeStr = normalizedRow['open time'] || normalizedRow['time'] || normalizedRow['entry time'];
  const exitTimeStr = normalizedRow['close time'] || normalizedRow['exit time'];
  
  const profitStr = normalizedRow['profit'] || normalizedRow['net profit'] || 0;

  return {
    tradingAccountId: accountId,
    pair: pair.toUpperCase().trim(),
    direction,
    entryTime: entryTimeStr ? new Date(entryTimeStr) : new Date(),
    exitTime: exitTimeStr ? new Date(exitTimeStr) : null,
    entryPrice: Number(normalizedRow['open price'] || normalizedRow['price'] || 0) || null,
    exitPrice: Number(normalizedRow['close price'] || 0) || null,
    stopLoss: Number(normalizedRow['s / l'] || normalizedRow['sl'] || 0) || null,
    takeProfit: Number(normalizedRow['t / p'] || normalizedRow['tp'] || 0) || null,
    lotSize: Number(normalizedRow['size'] || normalizedRow['volume'] || 0) || null,
    profitLossAmount: Number(profitStr),
    status: exitTimeStr ? 'CLOSED' : 'ACTIVE',
    result: Number(profitStr) > 0 ? 'WIN' : Number(profitStr) < 0 ? 'LOSS' : 'BREAKEVEN',
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
      return res.status(404).json({ message: 'Account not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
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
    console.error(error);
    res.status(500).json({ message: 'An error occurred during trade import.' });
  }
};

module.exports = {
  importTrades,
};
