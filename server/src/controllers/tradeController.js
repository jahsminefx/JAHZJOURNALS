const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const buildTradeListWhere = (query, userId) => {
  const where = {
    tradingAccount: { userId }
  };

  if (query.accountId) {
    where.tradingAccountId = query.accountId;
  }
  if (query.pair) {
    where.pair = { contains: query.pair, mode: 'insensitive' };
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.result) {
    where.result = query.result;
  }
  if (query.startDate || query.endDate) {
    where.entryTime = {};
    if (query.startDate) where.entryTime.gte = new Date(query.startDate);
    if (query.endDate) where.entryTime.lte = new Date(query.endDate);
  }

  return where;
};

const getTrades = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: buildTradeListWhere(req.query, req.user.id),
      include: {
        tradingAccount: { select: { id: true, name: true, currency: true } },
        strategy: { select: { id: true, name: true } },
        setup: { select: { id: true, name: true } },
        screenshots: true,
      },
      orderBy: { entryTime: 'desc' },
    });
    res.json(trades);
  } catch (error) {
    console.error('Error in getTrades:', error);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
};

const createTrade = async (req, res) => {
  try {
    const {
      tradingAccountId,
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      lotSize,
      riskAmount,
      rewardAmount,
      profitLossAmount,
      profitLossPercent,
      riskRewardRatio,
      pips,
      result,
      status,
      session,
      strategyId,
      setupId,
      higherTimeframe,
      entryTimeframe,
      htfBias,
      entryReason,
      exitReason,
      notesBefore,
      notesAfter,
      followedPlan,
      isAPlusSetup,
      newsRelated,
      grade,
      entryTime,
      exitTime,
    } = req.body;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: tradingAccountId, userId: req.user.id }
    });

    if (!account) {
      return res.status(404).json({ message: 'Trading account not found' });
    }

    const trade = await prisma.trade.create({
      data: {
        tradingAccountId,
        pair: pair.toUpperCase().trim(),
        direction,
        entryPrice: entryPrice ? parseFloat(entryPrice) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        exitPrice: exitPrice ? parseFloat(exitPrice) : null,
        lotSize: lotSize ? parseFloat(lotSize) : null,
        riskAmount: riskAmount ? parseFloat(riskAmount) : null,
        rewardAmount: rewardAmount ? parseFloat(rewardAmount) : null,
        profitLossAmount: profitLossAmount ? parseFloat(profitLossAmount) : null,
        profitLossPercent: profitLossPercent ? parseFloat(profitLossPercent) : null,
        riskRewardRatio: riskRewardRatio ? parseFloat(riskRewardRatio) : null,
        pips: pips ? parseFloat(pips) : null,
        result: result || 'OPEN',
        status: status || 'ACTIVE',
        session: session || null,
        strategyId: strategyId || null,
        setupId: setupId || null,
        higherTimeframe: higherTimeframe || null,
        entryTimeframe: entryTimeframe || null,
        htfBias: htfBias || null,
        entryReason: entryReason || null,
        exitReason: exitReason || null,
        notesBefore: notesBefore || null,
        notesAfter: notesAfter || null,
        followedPlan: followedPlan !== undefined ? Boolean(followedPlan) : null,
        isAPlusSetup: isAPlusSetup !== undefined ? Boolean(isAPlusSetup) : null,
        newsRelated: newsRelated !== undefined ? Boolean(newsRelated) : null,
        grade: grade || null,
        entryTime: entryTime ? new Date(entryTime) : new Date(),
        exitTime: exitTime ? new Date(exitTime) : null,
      },
    });

    if (trade.status === 'CLOSED' && trade.profitLossAmount) {
      await prisma.tradingAccount.update({
        where: { id: tradingAccountId },
        data: { currentBalance: { increment: trade.profitLossAmount } }
      });
    }

    res.status(201).json(trade);
  } catch (error) {
    console.error('Error in createTrade:', error);
    res.status(500).json({ message: 'Failed to create trade' });
  }
};

const getTradeById = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      },
      include: {
        tradingAccount: true,
        strategy: true,
        setup: true,
        screenshots: true,
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    res.json(trade);
  } catch (error) {
    console.error('Error in getTradeById:', error);
    res.status(500).json({ message: 'Failed to fetch trade details' });
  }
};

const updateTrade = async (req, res) => {
  try {
    const existingTrade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      }
    });

    if (!existingTrade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const {
      pair,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      lotSize,
      riskAmount,
      rewardAmount,
      profitLossAmount,
      profitLossPercent,
      riskRewardRatio,
      pips,
      result,
      status,
      session,
      strategyId,
      setupId,
      higherTimeframe,
      entryTimeframe,
      htfBias,
      entryReason,
      exitReason,
      notesBefore,
      notesAfter,
      followedPlan,
      isAPlusSetup,
      newsRelated,
      grade,
      entryTime,
      exitTime,
    } = req.body;

    const updatedTrade = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        pair: pair ? pair.toUpperCase().trim() : undefined,
        direction: direction || undefined,
        entryPrice: entryPrice !== undefined ? (entryPrice ? parseFloat(entryPrice) : null) : undefined,
        stopLoss: stopLoss !== undefined ? (stopLoss ? parseFloat(stopLoss) : null) : undefined,
        takeProfit: takeProfit !== undefined ? (takeProfit ? parseFloat(takeProfit) : null) : undefined,
        exitPrice: exitPrice !== undefined ? (exitPrice ? parseFloat(exitPrice) : null) : undefined,
        lotSize: lotSize !== undefined ? (lotSize ? parseFloat(lotSize) : null) : undefined,
        riskAmount: riskAmount !== undefined ? (riskAmount ? parseFloat(riskAmount) : null) : undefined,
        rewardAmount: rewardAmount !== undefined ? (rewardAmount ? parseFloat(rewardAmount) : null) : undefined,
        profitLossAmount: profitLossAmount !== undefined ? (profitLossAmount ? parseFloat(profitLossAmount) : null) : undefined,
        profitLossPercent: profitLossPercent !== undefined ? (profitLossPercent ? parseFloat(profitLossPercent) : null) : undefined,
        riskRewardRatio: riskRewardRatio !== undefined ? (riskRewardRatio ? parseFloat(riskRewardRatio) : null) : undefined,
        pips: pips !== undefined ? (pips ? parseFloat(pips) : null) : undefined,
        result: result || undefined,
        status: status || undefined,
        session: session !== undefined ? session : undefined,
        strategyId: strategyId !== undefined ? strategyId : undefined,
        setupId: setupId !== undefined ? setupId : undefined,
        higherTimeframe: higherTimeframe !== undefined ? higherTimeframe : undefined,
        entryTimeframe: entryTimeframe !== undefined ? entryTimeframe : undefined,
        htfBias: htfBias !== undefined ? htfBias : undefined,
        entryReason: entryReason !== undefined ? entryReason : undefined,
        exitReason: exitReason !== undefined ? exitReason : undefined,
        notesBefore: notesBefore !== undefined ? notesBefore : undefined,
        notesAfter: notesAfter !== undefined ? notesAfter : undefined,
        followedPlan: followedPlan !== undefined ? Boolean(followedPlan) : undefined,
        isAPlusSetup: isAPlusSetup !== undefined ? Boolean(isAPlusSetup) : undefined,
        newsRelated: newsRelated !== undefined ? Boolean(newsRelated) : undefined,
        grade: grade !== undefined ? grade : undefined,
        entryTime: entryTime ? new Date(entryTime) : undefined,
        exitTime: exitTime !== undefined ? (exitTime ? new Date(exitTime) : null) : undefined,
      }
    });

    res.json(updatedTrade);
  } catch (error) {
    console.error('Error in updateTrade:', error);
    res.status(500).json({ message: 'Failed to update trade' });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    await prisma.trade.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Trade removed successfully' });
  } catch (error) {
    console.error('Error in deleteTrade:', error);
    res.status(500).json({ message: 'Failed to delete trade' });
  }
};

const updateTradeReview = async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        tradingAccount: { userId: req.user.id }
      }
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    const { notesAfter, grade, followedPlan, isAPlusSetup, newsRelated } = req.body;

    const updated = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        notesAfter: notesAfter !== undefined ? notesAfter : undefined,
        grade: grade !== undefined ? grade : undefined,
        followedPlan: followedPlan !== undefined ? Boolean(followedPlan) : undefined,
        isAPlusSetup: isAPlusSetup !== undefined ? Boolean(isAPlusSetup) : undefined,
        newsRelated: newsRelated !== undefined ? Boolean(newsRelated) : undefined,
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error in updateTradeReview:', error);
    res.status(500).json({ message: 'Failed to update trade review' });
  }
};

const exportTradesCsv = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: buildTradeListWhere(req.query, req.user.id),
      include: { tradingAccount: { select: { name: true } } },
      orderBy: { entryTime: 'desc' },
    });

    if (trades.length === 0) {
      return res.status(404).json({ message: 'No trades found to export.' });
    }

    const headers = [
      'id', 'account', 'pair', 'direction', 'entryPrice', 'stopLoss', 
      'takeProfit', 'exitPrice', 'lotSize', 'riskAmount', 'rewardAmount',
      'profitLossAmount', 'profitLossPercent', 'riskRewardRatio', 'pips',
      'status', 'result', 'session', 'higherTimeframe', 'entryTimeframe',
      'htfBias', 'entryReason', 'exitReason', 'notesBefore', 'notesAfter',
      'followedPlan', 'isAPlusSetup', 'newsRelated', 'grade', 'entryTime', 'exitTime'
    ];

    const escapeCsvField = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];

    trades.forEach(t => {
      const row = [
        t.id,
        t.tradingAccount?.name || '',
        t.pair || '',
        t.direction || '',
        t.entryPrice ?? '',
        t.stopLoss ?? '',
        t.takeProfit ?? '',
        t.exitPrice ?? '',
        t.lotSize ?? '',
        t.riskAmount ?? '',
        t.rewardAmount ?? '',
        t.profitLossAmount ?? '',
        t.profitLossPercent ?? '',
        t.riskRewardRatio ?? '',
        t.pips ?? '',
        t.status || '',
        t.result || '',
        t.session || '',
        t.higherTimeframe || '',
        t.entryTimeframe || '',
        t.htfBias || '',
        t.entryReason || '',
        t.exitReason || '',
        t.notesBefore || '',
        t.notesAfter || '',
        t.followedPlan ?? '',
        t.isAPlusSetup ?? '',
        t.newsRelated ?? '',
        t.grade || '',
        t.entryTime ? new Date(t.entryTime).toISOString() : '',
        t.exitTime ? new Date(t.exitTime).toISOString() : '',
      ];
      csvLines.push(row.map(escapeCsvField).join(','));
    });

    res.setHeader('Content-disposition', 'attachment; filename=jahzjournals_trades.csv');
    res.setHeader('Content-type', 'text/csv');
    res.status(200).send(csvLines.join('\n'));
  } catch (error) {
    console.error('Error exporting trades CSV:', error);
    res.status(500).json({ message: 'Could not export trades at this time.' });
  }
};

module.exports = {
  getTrades,
  createTrade,
  getTradeById,
  updateTrade,
  deleteTrade,
  updateTradeReview,
  exportTradesCsv
};
