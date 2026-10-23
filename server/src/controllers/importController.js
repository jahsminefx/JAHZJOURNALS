const csv = require('csv-parser');
const streamifier = require('streamifier');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  classifyTrade,
  isStopAtOrPastEntry,
  CLASSIFICATION_SOURCES,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS,
} = require('../services/tradeClassificationService');

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

const mapCsvRowToTrade = (row, accountId, userThresholdAmount = null) => {
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

  const commission = getNum(
    normalizedRow['commission'] ||
    normalizedRow['comm'] ||
    normalizedRow['fee'] ||
    normalizedRow['fees']
  ) || 0;

  const swap = getNum(
    normalizedRow['swap'] ||
    normalizedRow['rollover']
  ) || 0;

  const rawGross = getNum(
    normalizedRow['grossprofit'] ||
    normalizedRow['gross profit'] ||
    normalizedRow['gross_profit'] ||
    normalizedRow['gross']
  );

  const rawNet = getNum(
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
  );

  const grossProfit = rawGross !== null ? rawGross : (rawNet !== null ? rawNet - commission - swap : null);
  const profitLossAmount = rawNet !== null ? rawNet : (rawGross !== null ? rawGross + commission + swap : 0);

  const rawResult = getStr(normalizedRow['result']);
  const breakEvenFlag = parseBool(
    normalizedRow['breakeven'] ||
    normalizedRow['break even'] ||
    normalizedRow['be'] ||
    normalizedRow['be_protected'] ||
    normalizedRow['beprotected']
  );

  const rawStatus = getStr(normalizedRow['status']);
  const status = rawStatus
    ? (['PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED'].includes(rawStatus.toUpperCase()) ? rawStatus.toUpperCase() : (exitTime ? 'CLOSED' : 'ACTIVE'))
    : (exitTime ? 'CLOSED' : 'ACTIVE');

  const isClosed = status === 'CLOSED';

  const entryPrice = getNum(normalizedRow['entryprice'] || normalizedRow['entry price'] || normalizedRow['open price'] || normalizedRow['price']);
  const exitPrice = getNum(normalizedRow['exitprice'] || normalizedRow['exit price'] || normalizedRow['close price']);
  const stopLoss = getNum(normalizedRow['stoploss'] || normalizedRow['stop loss'] || normalizedRow['s / l'] || normalizedRow['sl']);
  const takeProfit = getNum(normalizedRow['takeprofit'] || normalizedRow['take profit'] || normalizedRow['t / p'] || normalizedRow['tp']);
  const lotSize = getNum(normalizedRow['lotsize'] || normalizedRow['lot size'] || normalizedRow['size'] || normalizedRow['volume'] || normalizedRow['lots']);

  const isStopBe = (stopLoss !== null && entryPrice !== null && direction)
    ? isStopAtOrPastEntry({ direction, entryPrice, stopLoss, pair: String(pair).toUpperCase().trim() })
    : false;

  const classification = classifyTrade({
    status,
    direction,
    pair: String(pair).toUpperCase().trim(),
    entryPrice,
    exitPrice,
    stopLoss,
    initialStopLoss: stopLoss,
    lotSize,
    grossProfit,
    commission,
    swap,
    fees: 0,
    profitLossAmount: isClosed ? profitLossAmount : null,
    breakEvenActivated: breakEvenFlag === true || isStopBe,
    breakEvenPrice: isStopBe ? stopLoss : null,
    breakEvenEvidenceSource: breakEvenFlag === true ? EVIDENCE_SOURCES.USER_MANUAL : (isStopBe ? EVIDENCE_SOURCES.CSV_IMPORT : null),
    breakEvenEvidenceStatus: breakEvenFlag === true ? EVIDENCE_STATUS.USER_CONFIRMED : (isStopBe ? EVIDENCE_STATUS.CONFIRMED : EVIDENCE_STATUS.UNKNOWN),
    userConfirmedBe: breakEvenFlag === true,
    manualResultOverride: rawResult && ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawResult.toUpperCase()) ? rawResult.toUpperCase() : null,
    userThresholdAmount,
  });

  return {
    tradingAccountId: accountId,
    pair: String(pair).toUpperCase().trim(),
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    exitPrice,
    lotSize,
    grossProfit,
    commission,
    swap,
    fees: 0,
    riskAmount: getNum(normalizedRow['riskamount'] || normalizedRow['risk amount']),
    rewardAmount: getNum(normalizedRow['rewardamount'] || normalizedRow['reward amount']),
    profitLossAmount: isClosed ? profitLossAmount : null,
    profitLossPercent: getNum(normalizedRow['profitlosspercent'] || normalizedRow['profit loss percent']),
    riskRewardRatio: getNum(normalizedRow['riskrewardratio'] || normalizedRow['risk reward ratio']),
    pips: getNum(normalizedRow['pips']),
    status,
    result: classification.result,
    breakEvenActivated: classification.breakEvenActivated,
    breakEvenPrice: classification.breakEvenPrice,
    breakEvenActivatedAt: classification.breakEvenActivatedAt,
    breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
    breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
    classificationSource: classification.classificationSource,
    resultCalculatedAt: classification.resultCalculatedAt || new Date(),
    isManualResultOverride: classification.isManualResultOverride,
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

const parseMtHtml = (htmlContent, accountId, userThresholdAmount = null) => {
  const trades = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let match;

  const getNumLocal = (val) => {
    if (val === null || val === undefined || val === '' || val === 'null') return null;
    const n = Number(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? null : n;
  };

  while ((match = trRegex.exec(htmlContent)) !== null) {
    const trContent = match[1];
    const cells = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      const text = tdMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim();
      cells.push(text);
    }

    if (cells.length < 8) continue;

    // Detect MT4 / MT5 trade row format
    // MT4 Standard: [0] Ticket, [1] Open Time, [2] Type (buy/sell), [3] Size, [4] Item/Symbol, [5] Price, [6] S/L, [7] T/P, [8] Close Time, [9] Price, [10] Commission, [11] Taxes, [12] Swap, [13] Profit
    let ticket = cells[0];
    let openTimeStr = cells[1];
    let rawType = (cells[2] || '').toLowerCase();
    let lotSize = getNumLocal(cells[3]);
    let pair = String(cells[4] || '').toUpperCase().trim();
    let entryPrice = getNumLocal(cells[5]);
    let stopLoss = getNumLocal(cells[6]);
    let takeProfit = getNumLocal(cells[7]);
    let exitTimeStr = cells[8];
    let exitPrice = getNumLocal(cells[9]);
    let commission = 0;
    let swap = 0;
    let profit = 0;

    // If cell[1] is buy/sell, shifts occur
    if (rawType !== 'buy' && rawType !== 'sell') {
      rawType = (cells[1] || '').toLowerCase();
      if (rawType === 'buy' || rawType === 'sell') {
        openTimeStr = cells[0];
        lotSize = getNumLocal(cells[2]);
        pair = String(cells[3] || '').toUpperCase().trim();
        entryPrice = getNumLocal(cells[4]);
        stopLoss = getNumLocal(cells[5]);
        takeProfit = getNumLocal(cells[6]);
        exitTimeStr = cells[7];
        exitPrice = getNumLocal(cells[8]);
      } else {
        continue;
      }
    }

    if (rawType !== 'buy' && rawType !== 'sell') continue;
    if (!pair || pair.length < 3 || pair.includes('TOTAL') || pair.includes('BALANCE')) continue;

    if (cells.length >= 14) {
      commission = getNumLocal(cells[10]) || 0;
      swap = getNumLocal(cells[12]) || 0;
      profit = getNumLocal(cells[13]) || 0;
    } else if (cells.length >= 10) {
      profit = getNumLocal(cells[cells.length - 1]) || 0;
    }

    const direction = rawType === 'buy' ? 'BUY' : 'SELL';
    const entryTime = new Date(openTimeStr);
    const exitTime = exitTimeStr ? new Date(exitTimeStr) : null;
    const netProfit = profit + swap + commission;
    const isClosed = Boolean(exitTime && !isNaN(exitTime.getTime()));
    const status = isClosed ? 'CLOSED' : 'ACTIVE';

    const isStopBe = (stopLoss !== null && entryPrice !== null && direction)
      ? isStopAtOrPastEntry({ direction, entryPrice, stopLoss, pair })
      : false;

    const classification = classifyTrade({
      status,
      direction,
      pair,
      entryPrice,
      exitPrice,
      stopLoss,
      initialStopLoss: stopLoss,
      lotSize,
      grossProfit: profit,
      commission,
      swap,
      fees: 0,
      profitLossAmount: isClosed ? netProfit : null,
      breakEvenActivated: isStopBe,
      breakEvenPrice: isStopBe ? stopLoss : null,
      breakEvenEvidenceSource: isStopBe ? EVIDENCE_SOURCES.MT_TRAILING_STOP : null,
      breakEvenEvidenceStatus: isStopBe ? EVIDENCE_STATUS.CONFIRMED : EVIDENCE_STATUS.UNKNOWN,
      userThresholdAmount,
    });

    trades.push({
      tradingAccountId: accountId,
      externalId: ticket && !isNaN(Number(ticket)) ? ticket : null,
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      initialStopLoss: stopLoss,
      initialTakeProfit: takeProfit,
      exitPrice,
      lotSize,
      grossProfit: profit,
      commission,
      swap,
      fees: 0,
      profitLossAmount: isClosed ? netProfit : null,
      status,
      result: classification.result,
      breakEvenActivated: classification.breakEvenActivated,
      breakEvenPrice: classification.breakEvenPrice,
      breakEvenActivatedAt: classification.breakEvenActivatedAt,
      breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
      breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
      classificationSource: CLASSIFICATION_SOURCES.BROKER_IMPORT,
      resultCalculatedAt: classification.resultCalculatedAt || new Date(),
      isManualResultOverride: false,
      entryTime: !isNaN(entryTime.getTime()) ? entryTime : new Date(),
      exitTime: exitTime && !isNaN(exitTime.getTime()) ? exitTime : null,
      notesBefore: 'Imported from MetaTrader HTML Report',
    });
  }

  return trades;
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
      return res.status(400).json({ message: 'No file uploaded or file is empty.' });
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
    });
    const userThresholdAmount = userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null;

    const fileContentStr = req.file.buffer.toString('utf-8');
    const isHtml = fileContentStr.includes('<html') || fileContentStr.includes('<table') || fileContentStr.includes('<!DOCTYPE') || req.file.originalname?.endsWith('.htm') || req.file.originalname?.endsWith('.html');

    let pendingTrades = [];

    if (isHtml) {
      pendingTrades = parseMtHtml(fileContentStr, account.id, userThresholdAmount);
    } else {
      const rows = await parseTradeCsv(req.file.buffer);
      pendingTrades = rows
        .map((row) => mapCsvRowToTrade(row, account.id, userThresholdAmount))
        .filter((t) => t !== null && !isNaN(t.entryTime?.getTime()));
    }

    if (pendingTrades.length === 0) {
      return res.status(400).json({ message: 'No valid trades found in file. Please check your CSV or MetaTrader HTML format.' });
    }

    // Fetch existing trades to cross-check
    const existingTrades = await prisma.trade.findMany({
      where: { tradingAccountId: account.id },
    });

    const { findMatchingTrade } = require('./mtCloudSyncController');

    const newTrades = [];
    const tradesToEnrich = [];
    let skippedCount = 0;

    for (const t of pendingTrades) {
      const match = findMatchingTrade(t, existingTrades);
      if (match) {
        skippedCount++;
        const needsUpdate = (!match.externalId && t.externalId) ||
          (t.exitPrice !== null && match.exitPrice === null) ||
          (t.profitLossAmount !== null && match.profitLossAmount === null);

        if (needsUpdate) {
          tradesToEnrich.push({
            id: match.id,
            data: {
              ...(t.externalId && { externalId: t.externalId }),
              ...(t.exitPrice !== null && { exitPrice: t.exitPrice }),
              ...(t.profitLossAmount !== null && {
                profitLossAmount: t.profitLossAmount,
                grossProfit: t.grossProfit ?? match.grossProfit,
                commission: t.commission ?? match.commission,
                swap: t.swap ?? match.swap,
                result: match.isManualResultOverride ? match.result : t.result,
                breakEvenActivated: match.breakEvenActivated || t.breakEvenActivated,
                breakEvenPrice: match.breakEvenPrice || t.breakEvenPrice,
                breakEvenEvidenceSource: match.breakEvenEvidenceSource || t.breakEvenEvidenceSource,
                breakEvenEvidenceStatus: match.breakEvenEvidenceStatus || t.breakEvenEvidenceStatus,
                status: t.status,
                resultCalculatedAt: new Date(),
              }),
              ...(t.exitTime && { exitTime: t.exitTime }),
            },
            pnlDelta: (t.profitLossAmount || 0) - (match.profitLossAmount || 0),
          });
        }
      } else {
        newTrades.push(t);
      }
    }

    if (newTrades.length === 0 && tradesToEnrich.length === 0) {
      return res.status(200).json({ message: 'All trades in this file have already been matched and imported.' });
    }

    await prisma.$transaction(async (tx) => {
      if (newTrades.length > 0) {
        await tx.trade.createMany({
          data: newTrades,
        });
      }

      let netProfitLoss = newTrades.reduce((sum, t) => {
        if (t.status === 'CLOSED' && typeof t.profitLossAmount === 'number') {
          return sum + t.profitLossAmount;
        }
        return sum;
      }, 0);

      for (const enrich of tradesToEnrich) {
        await tx.trade.update({
          where: { id: enrich.id },
          data: enrich.data,
        });
        if (enrich.pnlDelta !== 0) {
          netProfitLoss += enrich.pnlDelta;
        }
      }

      if (netProfitLoss !== 0) {
        await tx.tradingAccount.update({
          where: { id: account.id },
          data: { currentBalance: { increment: netProfitLoss } }
        });
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${newTrades.length} new trades${tradesToEnrich.length > 0 ? `, ${tradesToEnrich.length} existing trades updated` : ''} (${skippedCount} duplicates matched).`,
      importedCount: newTrades.length,
      enrichedCount: tradesToEnrich.length,
      skippedCount: skippedCount,
    });
  } catch (error) {
    console.error('Error during trade import:', error);
    res.status(500).json({ message: 'An error occurred during trade import.' });
  }
};

module.exports = {
  importTrades,
};
