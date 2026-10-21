const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('../services/communications/notificationService');
const {
  createTradeShareSchema,
  updateTradeShareSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  sendDirectMessageSchema,
} = require('../validation/cohortSharingSchemas');

const DEFAULT_VISIBILITY = {
  showPrices: true,
  showRR: true,
  showResult: true,
  showPnLPercent: true,
  showPnLDollar: false,
  showPips: true,
  showLotSize: false,
  showSession: true,
};

const toNumOrNull = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

/**
 * Builds an immutable, audience-safe snapshot of a trade for students.
 * Strictly strips account credentials, balances, broker details, and internal IDs.
 * Respects mentor's granular visibility choices (RR, PnL $, PnL %, Pips, Prices, Lot Size, etc.).
 */
const buildAudienceSafeTradeSnapshot = (trade, visibilityOptions = null, customSetup = null) => {
  if (!trade && !customSetup) return {};

  const visibility = {
    ...DEFAULT_VISIBILITY,
    ...(trade?.tradeSnapshot?.visibility || {}),
    ...(visibilityOptions || {}),
  };

  // Normalize booleans
  Object.keys(DEFAULT_VISIBILITY).forEach((k) => {
    visibility[k] = visibility[k] !== undefined && visibility[k] !== null ? Boolean(visibility[k]) : DEFAULT_VISIBILITY[k];
  });

  const pair = String(customSetup?.pair || trade?.pair || 'EURUSD').trim().toUpperCase();
  const direction = String(customSetup?.direction || trade?.direction || 'BUY').trim().toUpperCase();

  const rawEntry = toNumOrNull(customSetup?.entryPrice !== undefined ? customSetup.entryPrice : trade?.entryPrice);
  const rawSL = toNumOrNull(customSetup?.stopLoss !== undefined ? customSetup.stopLoss : trade?.stopLoss);
  const rawTP = toNumOrNull(customSetup?.takeProfit !== undefined ? customSetup.takeProfit : trade?.takeProfit);
  const rawExit = toNumOrNull(customSetup?.exitPrice !== undefined ? customSetup.exitPrice : trade?.exitPrice);

  // Calculate fallback R:R, Pips, P&L ($), Return (%), and Result from Exit Price if not explicitly supplied
  let computedPlannedRR = null;
  if (rawEntry !== null && rawSL !== null && rawTP !== null && Math.abs(rawEntry - rawSL) > 0) {
    computedPlannedRR = Number((Math.abs(rawTP - rawEntry) / Math.abs(rawEntry - rawSL)).toFixed(2));
  }

  const isBuy = direction.includes('BUY');
  const priceMove = rawEntry !== null && rawExit !== null ? (isBuy ? rawExit - rawEntry : rawEntry - rawExit) : null;

  let computedRealizedRR = null;
  if (priceMove !== null && rawSL !== null && Math.abs(rawEntry - rawSL) > 0) {
    computedRealizedRR = Number((priceMove / Math.abs(rawEntry - rawSL)).toFixed(2));
  }

  let pipSize = 0.0001;
  let pipValuePerLotUSD = 10;
  if (pair.includes('JPY')) {
    pipSize = 0.01;
    pipValuePerLotUSD = rawExit && rawExit > 0 ? 1000 / rawExit : 6.7;
  } else if (pair.startsWith('XAU') || pair.includes('GOLD')) {
    pipSize = 0.1;
    pipValuePerLotUSD = 10;
  } else if (pair.startsWith('XAG') || pair.includes('SILVER')) {
    pipSize = 0.01;
    pipValuePerLotUSD = 50;
  } else if (
    pair.includes('BTC') ||
    pair.includes('ETH') ||
    pair.includes('US30') ||
    pair.includes('NAS') ||
    pair.includes('SPX') ||
    pair.includes('GER') ||
    pair.includes('DE30') ||
    pair.includes('UK100') ||
    pair.includes('US500')
  ) {
    pipSize = 1.0;
    pipValuePerLotUSD = 1.0;
  }

  const rawLotSize = toNumOrNull(
    customSetup?.lotSize !== undefined ? customSetup.lotSize : trade?.lotSize
  );
  const effectiveLots = rawLotSize && rawLotSize > 0 ? rawLotSize : 1.0;

  const computedPips = priceMove !== null ? Math.round((priceMove / pipSize) * 10) / 10 : null;
  const computedPnLDollar =
    computedPips !== null ? Math.round(computedPips * pipValuePerLotUSD * effectiveLots * 100) / 100 : null;
  const computedPnLPercent =
    computedRealizedRR !== null
      ? Number(computedRealizedRR.toFixed(2))
      : computedPnLDollar !== null
      ? Number(((computedPnLDollar / 100000) * 100).toFixed(2))
      : null;

  const rawRR =
    toNumOrNull(
      customSetup?.riskRewardRatio !== undefined ? customSetup.riskRewardRatio : trade?.riskRewardRatio
    ) ??
    (computedRealizedRR !== null ? Math.abs(computedRealizedRR) : computedPlannedRR);

  const rawPips =
    toNumOrNull(customSetup?.pips !== undefined ? customSetup.pips : trade?.pips) ?? computedPips;
  const rawPnLPercent =
    toNumOrNull(
      customSetup?.profitLossPercent !== undefined ? customSetup.profitLossPercent : trade?.profitLossPercent
    ) ?? computedPnLPercent;
  const rawPnLDollar =
    toNumOrNull(
      customSetup?.profitLoss !== undefined ? customSetup.profitLoss : trade?.profitLossAmount
    ) ?? computedPnLDollar;

  let rawResult = String(customSetup?.result || trade?.result || 'OPEN').toUpperCase();
  if ((rawResult === 'OPEN' || rawResult === 'SHARED') && priceMove !== null) {
    rawResult = Math.abs(priceMove) < 1e-8 ? 'BREAKEVEN' : priceMove > 0 ? 'WIN' : 'LOSS';
  }
  const rawStatus =
    ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawResult)
      ? 'CLOSED'
      : String(customSetup?.status || trade?.status || 'ACTIVE').toUpperCase();
  const rawSession = customSetup?.session !== undefined ? customSetup.session : (trade?.session || null);
  const rawHTF = customSetup?.higherTimeframe !== undefined ? customSetup.higherTimeframe : (trade?.higherTimeframe || null);
  const rawETF = customSetup?.entryTimeframe !== undefined ? customSetup.entryTimeframe : (trade?.entryTimeframe || null);
  const rawBias = customSetup?.htfBias !== undefined ? customSetup.htfBias : (trade?.htfBias || null);
  const currency = customSetup?.currency || trade?.tradingAccount?.currency || 'USD';
  const shareMode = customSetup?.shareMode || (trade ? 'JOURNAL_TRADE' : 'DIRECT_SETUP');

  return {
    pair,
    direction,
    shareMode,
    entryPrice: visibility.showPrices ? rawEntry : null,
    stopLoss: visibility.showPrices ? rawSL : null,
    takeProfit: visibility.showPrices ? rawTP : null,
    exitPrice: visibility.showPrices ? rawExit : null,
    pips: visibility.showPips ? rawPips : null,
    riskRewardRatio: visibility.showRR ? rawRR : null,
    plannedRR: visibility.showRR ? (rawRR ?? computedPlannedRR) : null,
    realizedRR: visibility.showRR ? computedRealizedRR : null,
    profitLossPercent: visibility.showPnLPercent ? rawPnLPercent : null,
    profitLoss: visibility.showPnLDollar ? rawPnLDollar : null,
    lotSize: visibility.showLotSize ? rawLotSize : null,
    result: visibility.showResult ? rawResult : 'SHARED',
    outcome: visibility.showResult ? rawResult : 'SHARED',
    status: rawStatus,
    session: visibility.showSession ? rawSession : null,
    higherTimeframe: visibility.showSession ? rawHTF : null,
    entryTimeframe: visibility.showSession ? rawETF : null,
    htfBias: visibility.showSession ? rawBias : null,
    entryTime: trade?.entryTime ? new Date(trade.entryTime).toISOString() : new Date().toISOString(),
    exitTime: trade?.exitTime ? new Date(trade.exitTime).toISOString() : null,
    currency,
    visibility,
    visibilityOptions: visibility,
  };
};

/**
 * Verifies mentor owns all supplied cohort IDs (or is platform admin).
 */
const verifyMentorCohorts = async (userId, userRole, cohortIds) => {
  if (!cohortIds || cohortIds.length === 0) return false;
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return true;
  }
  const uniqueIds = [...new Set(cohortIds)];
  const groups = await prisma.mentorGroup.findMany({
    where: {
      id: { in: uniqueIds },
      mentorId: userId,
    },
    select: { id: true },
  });

  return groups.length === uniqueIds.length;
};

/**
 * Helper to notify active students in target cohorts
 */
const notifyCohortStudents = async (cohortIds, title, message, senderId, actionUrl = '/student-cohorts') => {
  try {
    const enrollments = await prisma.mentorStudent.findMany({
      where: {
        mentorGroupId: { in: cohortIds },
        status: 'ACTIVE',
      },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))].filter((id) => id !== senderId);
    if (studentIds.length > 0) {
      await notificationService.sendManualNotification(
        title,
        message,
        studentIds,
        'MENTOR_UPDATE',
        senderId,
        actionUrl
      );
    }
  } catch (err) {
    console.warn('Cohort notification warning:', err?.message);
  }
};

// ==========================================
// 1. MENTOR TRADE SHARING (MENTOR ACTIONS)
// ==========================================

/**
 * Share a trade or direct setup with one or more academy cohorts
 * POST /api/mentors/cohort-trade-shares
 */
const createTradeShare = async (req, res) => {
  try {
    const parseResult = createTradeShareSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      targetCohortIds,
      sourceTradeId,
      title,
      setupThesis,
      entryReasoning,
      riskRationale,
      managementReasoning,
      outcomeLessons,
      generalNotes,
      isCaseStudy,
      pinned,
      status,
      attachmentIds,
      visibilityOptions,
      customTradeSetup,
    } = parseResult.data;

    // Verify mentor owns all target cohorts
    const authorized = await verifyMentorCohorts(req.user.id, req.user.role, targetCohortIds);
    if (!authorized) {
      return res.status(403).json({
        message: 'You are not authorized to publish to one or more of the selected cohorts.',
      });
    }

    let sourceTrade = null;
    let safeAttachments = [];
    let resolvedSourceTradeId = sourceTradeId || null;

    if (resolvedSourceTradeId) {
      // Find source trade and ensure it belongs to the mentor
      const tradeWhere = { id: resolvedSourceTradeId };
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        tradeWhere.tradingAccount = { userId: req.user.id };
      }

      sourceTrade = await prisma.trade.findFirst({
        where: tradeWhere,
        include: {
          tradingAccount: {
            select: { currency: true },
          },
          screenshots: true,
        },
      });

      if (!sourceTrade) {
        return res.status(404).json({
          message: 'The selected trade could not be found or does not belong to your account.',
        });
      }

      // Filter attachments to only safe screenshots from this trade
      if (attachmentIds && attachmentIds.length > 0 && sourceTrade.screenshots) {
        safeAttachments = sourceTrade.screenshots
          .filter((s) => attachmentIds.includes(s.id))
          .map((s) => ({
            id: s.id,
            imageUrl: s.imageUrl,
            screenshotType: s.screenshotType,
            caption: s.note || '',
          }));
      }
    } else if (parseResult.data.logToMentorAccount && customTradeSetup) {
      // Mentor chose to also log this direct signal/setup into their own trading account
      let mentorAccount = null;
      if (parseResult.data.mentorTradingAccountId) {
        mentorAccount = await prisma.tradingAccount.findFirst({
          where: { id: parseResult.data.mentorTradingAccountId, userId: req.user.id },
        });
      }
      if (!mentorAccount) {
        mentorAccount = await prisma.tradingAccount.findFirst({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!mentorAccount) {
        mentorAccount = await prisma.tradingAccount.create({
          data: {
            userId: req.user.id,
            name: 'Mentor Primary Account',
            broker: 'Institutional Feed',
            accountType: 'LIVE',
            currency: 'USD',
            initialBalance: 100000,
            currentBalance: 100000,
          },
        });
      }

      const rawResult = String(customTradeSetup.result || 'OPEN').toUpperCase();
      const isClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawResult);
      const rawEntry = toNumOrNull(customTradeSetup.entryPrice);
      const rawSL = toNumOrNull(customTradeSetup.stopLoss);
      const rawTP = toNumOrNull(customTradeSetup.takeProfit);
      let computedRR = toNumOrNull(customTradeSetup.riskRewardRatio);
      if (computedRR === null && rawEntry !== null && rawSL !== null && rawTP !== null && Math.abs(rawEntry - rawSL) > 0) {
        computedRR = Number((Math.abs(rawTP - rawEntry) / Math.abs(rawEntry - rawSL)).toFixed(2));
      }

      sourceTrade = await prisma.trade.create({
        data: {
          tradingAccountId: mentorAccount.id,
          pair: String(customTradeSetup.pair || 'XAUUSD').trim().toUpperCase(),
          direction: String(customTradeSetup.direction || 'BUY').trim().toUpperCase(),
          entryPrice: rawEntry ?? 0,
          stopLoss: rawSL,
          takeProfit: rawTP,
          exitPrice: toNumOrNull(customTradeSetup.exitPrice),
          lotSize: toNumOrNull(customTradeSetup.lotSize) ?? 1.0,
          profitLossAmount: toNumOrNull(customTradeSetup.profitLoss),
          profitLossPercent: toNumOrNull(customTradeSetup.profitLossPercent),
          riskRewardRatio: computedRR,
          pips: toNumOrNull(customTradeSetup.pips),
          result: rawResult,
          status: isClosed ? 'CLOSED' : 'ACTIVE',
          session: customTradeSetup.session || null,
          higherTimeframe: customTradeSetup.higherTimeframe || null,
          entryTimeframe: customTradeSetup.entryTimeframe || null,
          htfBias: customTradeSetup.htfBias || null,
          notesBefore: setupThesis || entryReasoning || null,
          notesAfter: outcomeLessons || generalNotes || null,
          entryTime: new Date(),
          exitTime: isClosed ? new Date() : null,
        },
        include: {
          tradingAccount: { select: { currency: true } },
          screenshots: true,
        },
      });
      resolvedSourceTradeId = sourceTrade.id;

      if (isClosed) {
        try {
          const { reconcileAccountBalance } = require('../services/accountBalanceService');
          await reconcileAccountBalance(mentorAccount.id);
        } catch (e) {
          console.warn('Balance reconcile warning:', e?.message);
        }
      }
    }

    const tradeSnapshot = buildAudienceSafeTradeSnapshot(sourceTrade, visibilityOptions, customTradeSetup);

    // Create share and link targets in a transaction
    const tradeShare = await prisma.$transaction(async (tx) => {
      const share = await tx.cohortTradeShare.create({
        data: {
          mentorId: req.user.id,
          sourceTradeId: resolvedSourceTradeId,
          status,
          title: title || (tradeSnapshot.pair ? `${tradeSnapshot.pair} ${tradeSnapshot.direction} Setup Breakdown` : 'Trade Setup Breakdown'),
          tradeSnapshot,
          setupThesis: setupThesis || null,
          entryReasoning: entryReasoning || null,
          riskRationale: riskRationale || null,
          managementReasoning: managementReasoning || null,
          outcomeLessons: outcomeLessons || null,
          generalNotes: generalNotes || null,
          attachments: safeAttachments,
          isCaseStudy: Boolean(isCaseStudy),
          pinned: Boolean(pinned),
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
        },
      });

      await tx.cohortTradeShareTarget.createMany({
        data: targetCohortIds.map((mentorGroupId) => ({
          tradeShareId: share.id,
          mentorGroupId,
        })),
        skipDuplicates: true,
      });

      return share;
    });

    const result = await prisma.cohortTradeShare.findUnique({
      where: { id: tradeShare.id },
      include: {
        targets: {
          include: {
            mentorGroup: {
              select: { id: true, name: true, academyName: true },
            },
          },
        },
        mentor: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { readReceipts: true },
        },
      },
    });

    if (status === 'PUBLISHED') {
      notifyCohortStudents(
        targetCohortIds,
        `New Mentor Trade Shared: ${tradeSnapshot.pair || 'Setup'}`,
        `${req.user.name || 'Your mentor'} shared a ${tradeSnapshot.pair || ''} ${tradeSnapshot.direction || ''} breakdown with your academy cohort.`,
        req.user.id,
        `/student-cohorts?tab=trade_shares&shareId=${tradeShare.id}`
      );
    }

    res.status(201).json({
      message: status === 'PUBLISHED' ? 'Trade successfully shared with your academy cohort!' : 'Trade share draft saved.',
      tradeShare: result,
    });
  } catch (error) {
    console.error('createTradeShare error:', error);
    res.status(500).json({ message: 'Failed to share trade with cohort.' });
  }
};

/**
 * Update a cohort trade share (commentary, visibility options, or setup outcome)
 * PUT /api/mentors/cohort-trade-shares/:id
 */
const updateTradeShare = async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = updateTradeShareSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const shareWhere = { id };
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      shareWhere.mentorId = req.user.id;
    }

    const existing = await prisma.cohortTradeShare.findFirst({
      where: shareWhere,
      include: {
        targets: true,
        sourceTrade: {
          include: {
            tradingAccount: { select: { currency: true } },
            screenshots: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Trade share not found or access denied.' });
    }

    const data = parseResult.data;

    // If target cohorts changed, verify ownership
    if (data.targetCohortIds && data.targetCohortIds.length > 0) {
      const authorized = await verifyMentorCohorts(req.user.id, req.user.role, data.targetCohortIds);
      if (!authorized) {
        return res.status(403).json({ message: 'Unauthorized for one or more target cohorts.' });
      }
    }

    // Rebuild snapshot if visibilityOptions or customTradeSetup updated
    let updatedSnapshot = existing.tradeSnapshot || {};
    let linkedSourceTradeId = existing.sourceTradeId || null;

    if (data.visibilityOptions || data.customTradeSetup) {
      const baseTrade = existing.sourceTrade || {
        pair: updatedSnapshot.pair,
        direction: updatedSnapshot.direction,
        entryPrice: updatedSnapshot.entryPrice,
        stopLoss: updatedSnapshot.stopLoss,
        takeProfit: updatedSnapshot.takeProfit,
        exitPrice: updatedSnapshot.exitPrice,
        pips: updatedSnapshot.pips,
        riskRewardRatio: updatedSnapshot.riskRewardRatio,
        profitLossPercent: updatedSnapshot.profitLossPercent,
        profitLossAmount: updatedSnapshot.profitLoss,
        lotSize: updatedSnapshot.lotSize,
        result: updatedSnapshot.result,
        status: updatedSnapshot.status,
        session: updatedSnapshot.session,
        higherTimeframe: updatedSnapshot.higherTimeframe,
        entryTimeframe: updatedSnapshot.entryTimeframe,
        htfBias: updatedSnapshot.htfBias,
        tradeSnapshot: updatedSnapshot,
      };
      updatedSnapshot = buildAudienceSafeTradeSnapshot(
        baseTrade,
        data.visibilityOptions || updatedSnapshot.visibility,
        data.customTradeSetup
      );
    }

    // If mentor concludes/updates the trade and wants it synced/logged to their personal trading account
    if (data.customTradeSetup && (data.logToMentorAccount || existing.sourceTradeId)) {
      const setup = data.customTradeSetup;
      const rawResult = String(setup.result || updatedSnapshot.result || 'OPEN').toUpperCase();
      const isClosed = ['WIN', 'LOSS', 'BREAKEVEN'].includes(rawResult);
      const rawEntry = toNumOrNull(setup.entryPrice !== undefined ? setup.entryPrice : updatedSnapshot.entryPrice);
      const rawSL = toNumOrNull(setup.stopLoss !== undefined ? setup.stopLoss : updatedSnapshot.stopLoss);
      const rawTP = toNumOrNull(setup.takeProfit !== undefined ? setup.takeProfit : updatedSnapshot.takeProfit);
      const rawExit = toNumOrNull(setup.exitPrice !== undefined ? setup.exitPrice : updatedSnapshot.exitPrice);
      const rawPips = toNumOrNull(setup.pips !== undefined ? setup.pips : updatedSnapshot.pips);
      const rawPnL = toNumOrNull(setup.profitLoss !== undefined ? setup.profitLoss : updatedSnapshot.profitLoss);
      const rawPnLPct = toNumOrNull(setup.profitLossPercent !== undefined ? setup.profitLossPercent : updatedSnapshot.profitLossPercent);
      const rawRR = toNumOrNull(setup.riskRewardRatio !== undefined ? setup.riskRewardRatio : updatedSnapshot.riskRewardRatio);

      if (existing.sourceTradeId && existing.sourceTrade) {
        const updatedMentorTrade = await prisma.trade.update({
          where: { id: existing.sourceTradeId },
          data: {
            pair: String(setup.pair || existing.sourceTrade.pair || 'XAUUSD').trim().toUpperCase(),
            direction: String(setup.direction || existing.sourceTrade.direction || 'BUY').trim().toUpperCase(),
            ...(rawEntry !== null && { entryPrice: rawEntry }),
            ...(rawSL !== null && { stopLoss: rawSL }),
            ...(rawTP !== null && { takeProfit: rawTP }),
            ...(rawExit !== null && { exitPrice: rawExit }),
            ...(rawPips !== null && { pips: rawPips }),
            ...(rawPnL !== null && { profitLossAmount: rawPnL }),
            ...(rawPnLPct !== null && { profitLossPercent: rawPnLPct }),
            ...(rawRR !== null && { riskRewardRatio: rawRR }),
            result: rawResult,
            status: isClosed ? 'CLOSED' : 'ACTIVE',
            ...(isClosed && !existing.sourceTrade.exitTime && { exitTime: new Date() }),
            ...(data.outcomeLessons && { notesAfter: data.outcomeLessons }),
          },
        });
        try {
          const { reconcileAccountBalance } = require('../services/accountBalanceService');
          await reconcileAccountBalance(updatedMentorTrade.tradingAccountId);
        } catch (e) {
          console.warn('Balance reconcile warning:', e?.message);
        }
      } else if (data.logToMentorAccount) {
        let mentorAccount = null;
        if (data.mentorTradingAccountId) {
          mentorAccount = await prisma.tradingAccount.findFirst({
            where: { id: data.mentorTradingAccountId, userId: req.user.id },
          });
        }
        if (!mentorAccount) {
          mentorAccount = await prisma.tradingAccount.findFirst({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'asc' },
          });
        }
        if (!mentorAccount) {
          mentorAccount = await prisma.tradingAccount.create({
            data: {
              userId: req.user.id,
              name: 'Mentor Primary Account',
              broker: 'Institutional Feed',
              accountType: 'LIVE',
              currency: 'USD',
              initialBalance: 100000,
              currentBalance: 100000,
            },
          });
        }

        const createdMentorTrade = await prisma.trade.create({
          data: {
            tradingAccountId: mentorAccount.id,
            pair: String(setup.pair || updatedSnapshot.pair || 'XAUUSD').trim().toUpperCase(),
            direction: String(setup.direction || updatedSnapshot.direction || 'BUY').trim().toUpperCase(),
            entryPrice: rawEntry ?? 0,
            stopLoss: rawSL,
            takeProfit: rawTP,
            exitPrice: rawExit,
            lotSize: toNumOrNull(setup.lotSize) ?? 1.0,
            profitLossAmount: rawPnL,
            profitLossPercent: rawPnLPct,
            riskRewardRatio: rawRR,
            pips: rawPips,
            result: rawResult,
            status: isClosed ? 'CLOSED' : 'ACTIVE',
            session: setup.session || updatedSnapshot.session || null,
            notesBefore: data.setupThesis || existing.setupThesis || null,
            notesAfter: data.outcomeLessons || existing.outcomeLessons || null,
            entryTime: existing.createdAt || new Date(),
            exitTime: isClosed ? new Date() : null,
          },
        });
        linkedSourceTradeId = createdMentorTrade.id;
        try {
          const { reconcileAccountBalance } = require('../services/accountBalanceService');
          await reconcileAccountBalance(mentorAccount.id);
        } catch (e) {
          console.warn('Balance reconcile warning:', e?.message);
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatePayload = {
        title: data.title !== undefined ? data.title : existing.title,
        sourceTradeId: linkedSourceTradeId,
        tradeSnapshot: updatedSnapshot,
        setupThesis: data.setupThesis !== undefined ? data.setupThesis : existing.setupThesis,
        entryReasoning: data.entryReasoning !== undefined ? data.entryReasoning : existing.entryReasoning,
        riskRationale: data.riskRationale !== undefined ? data.riskRationale : existing.riskRationale,
        managementReasoning: data.managementReasoning !== undefined ? data.managementReasoning : existing.managementReasoning,
        outcomeLessons: data.outcomeLessons !== undefined ? data.outcomeLessons : existing.outcomeLessons,
        generalNotes: data.generalNotes !== undefined ? data.generalNotes : existing.generalNotes,
        isCaseStudy: data.isCaseStudy !== undefined ? data.isCaseStudy : existing.isCaseStudy,
        pinned: data.pinned !== undefined ? data.pinned : existing.pinned,
        status: data.status !== undefined ? data.status : existing.status,
      };

      if (data.status === 'PUBLISHED' && !existing.publishedAt) {
        updatePayload.publishedAt = new Date();
      } else if (data.status === 'ARCHIVED' && !existing.archivedAt) {
        updatePayload.archivedAt = new Date();
      }

      const item = await tx.cohortTradeShare.update({
        where: { id },
        data: updatePayload,
        include: {
          targets: {
            include: {
              mentorGroup: { select: { id: true, name: true, academyName: true } },
            },
          },
          _count: {
            select: { readReceipts: true },
          },
        },
      });

      if (data.targetCohortIds) {
        await tx.cohortTradeShareTarget.deleteMany({ where: { tradeShareId: id } });
        await tx.cohortTradeShareTarget.createMany({
          data: data.targetCohortIds.map((mentorGroupId) => ({
            tradeShareId: id,
            mentorGroupId,
          })),
        });
      }

      return item;
    });

    res.json({ message: 'Trade share updated successfully.', tradeShare: updated });
  } catch (error) {
    console.error('updateTradeShare error:', error);
    res.status(500).json({ message: 'Failed to update trade share.' });
  }
};

/**
 * Delete or archive a cohort trade share
 * DELETE /api/mentors/cohort-trade-shares/:id
 */
const deleteTradeShare = async (req, res) => {
  try {
    const { id } = req.params;
    const shareWhere = { id };
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      shareWhere.mentorId = req.user.id;
    }

    const existing = await prisma.cohortTradeShare.findFirst({ where: shareWhere });
    if (!existing) {
      return res.status(404).json({ message: 'Trade share not found or access denied.' });
    }

    await prisma.cohortTradeShare.delete({ where: { id } });
    res.json({ message: 'Trade share removed from academy cohorts.' });
  } catch (error) {
    console.error('deleteTradeShare error:', error);
    res.status(500).json({ message: 'Failed to delete trade share.' });
  }
};

/**
 * List trade shares created by the mentor
 * GET /api/mentors/cohort-trade-shares
 */
const getMentorTradeShares = async (req, res) => {
  try {
    const { cohortId, status } = req.query;

    const where = {};
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      where.mentorId = req.user.id;
    }

    if (status) {
      where.status = status;
    }

    if (cohortId) {
      where.targets = {
        some: { mentorGroupId: cohortId },
      };
    }

    const shares = await prisma.cohortTradeShare.findMany({
      where,
      include: {
        targets: {
          include: {
            mentorGroup: {
              select: { id: true, name: true, academyName: true },
            },
          },
        },
        sourceTrade: {
          select: {
            id: true,
            pair: true,
            direction: true,
            entryPrice: true,
            stopLoss: true,
            takeProfit: true,
            exitPrice: true,
            riskRewardRatio: true,
            pips: true,
            profitLossAmount: true,
            profitLossPercent: true,
            lotSize: true,
            result: true,
            status: true,
            session: true,
            higherTimeframe: true,
            entryTimeframe: true,
            htfBias: true,
          },
        },
        _count: {
          select: { readReceipts: true },
        },
      },
      orderBy: [
        { pinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Enrich any legacy snapshots missing computed R:R or outcome aliases
    const enrichedShares = shares.map((s) => {
      const snap = s.tradeSnapshot || {};
      if (s.sourceTrade && (snap.riskRewardRatio === null || snap.riskRewardRatio === undefined)) {
        return {
          ...s,
          tradeSnapshot: buildAudienceSafeTradeSnapshot(s.sourceTrade, snap.visibility, snap),
        };
      }
      return s;
    });

    res.json({ shares: enrichedShares });
  } catch (error) {
    console.error('getMentorTradeShares error:', error);
    res.status(500).json({ message: 'Failed to fetch mentor trade shares.' });
  }
};

// ==========================================
// 2. COHORT ANNOUNCEMENTS (MENTOR ACTIONS)
// ==========================================

/**
 * Create a cohort announcement (supports single mentorGroupId or multiple targetCohortIds)
 * POST /api/mentors/cohort-announcements
 */
const createAnnouncement = async (req, res) => {
  try {
    const parseResult = createAnnouncementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { mentorGroupId, targetCohortIds, title, content, category, isPinned, status, attachments } = parseResult.data;

    const cohortIds = Array.isArray(targetCohortIds) && targetCohortIds.length > 0
      ? [...new Set(targetCohortIds)]
      : (mentorGroupId ? [mentorGroupId] : []);

    if (cohortIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one cohort for this announcement.' });
    }

    const authorized = await verifyMentorCohorts(req.user.id, req.user.role, cohortIds);
    if (!authorized) {
      return res.status(403).json({ message: 'Unauthorized for one or more selected cohorts.' });
    }

    const createdAnnouncements = await prisma.$transaction(
      cohortIds.map((groupId) =>
        prisma.cohortAnnouncement.create({
          data: {
            mentorId: req.user.id,
            mentorGroupId: groupId,
            title,
            content,
            category: category || 'GENERAL',
            isPinned: Boolean(isPinned),
            status: status || 'PUBLISHED',
            attachments: attachments || [],
            publishedAt: (status || 'PUBLISHED') === 'PUBLISHED' ? new Date() : null,
          },
          include: {
            mentor: { select: { id: true, name: true, avatarUrl: true } },
            mentorGroup: { select: { id: true, name: true, academyName: true } },
            _count: { select: { readReceipts: true } },
          },
        })
      )
    );

    if ((status || 'PUBLISHED') === 'PUBLISHED') {
      notifyCohortStudents(
        cohortIds,
        `Academy Announcement: ${title}`,
        `${req.user.name || 'Your mentor'} posted a new ${category || 'GENERAL'} announcement.`,
        req.user.id,
        `/student-cohorts?tab=announcements&cohortId=${cohortIds[0]}`
      );
    }

    res.status(201).json({
      message: createdAnnouncements.length > 1
        ? `Announcement broadcasted to ${createdAnnouncements.length} cohorts!`
        : 'Announcement posted to cohort!',
      announcement: createdAnnouncements[0],
      announcements: createdAnnouncements,
    });
  } catch (error) {
    console.error('createAnnouncement error:', error);
    res.status(500).json({ message: 'Failed to create announcement.' });
  }
};

/**
 * Update an announcement
 * PUT /api/mentors/cohort-announcements/:id
 */
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = updateAnnouncementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const where = { id };
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      where.mentorId = req.user.id;
    }

    const existing = await prisma.cohortAnnouncement.findFirst({ where });
    if (!existing) {
      return res.status(404).json({ message: 'Announcement not found or unauthorized.' });
    }

    const updated = await prisma.cohortAnnouncement.update({
      where: { id },
      data: parseResult.data,
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } },
        mentorGroup: { select: { id: true, name: true, academyName: true } },
        _count: { select: { readReceipts: true } },
      },
    });

    res.json({ message: 'Announcement updated.', announcement: updated });
  } catch (error) {
    console.error('updateAnnouncement error:', error);
    res.status(500).json({ message: 'Failed to update announcement.' });
  }
};

/**
 * Delete an announcement
 * DELETE /api/mentors/cohort-announcements/:id
 */
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const where = { id };
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      where.mentorId = req.user.id;
    }

    const existing = await prisma.cohortAnnouncement.findFirst({ where });
    if (!existing) {
      return res.status(404).json({ message: 'Announcement not found or unauthorized.' });
    }

    await prisma.cohortAnnouncement.delete({ where: { id } });
    res.json({ message: 'Announcement removed.' });
  } catch (error) {
    console.error('deleteAnnouncement error:', error);
    res.status(500).json({ message: 'Failed to delete announcement.' });
  }
};

/**
 * List announcements created by the mentor
 * GET /api/mentors/cohort-announcements
 */
const getMentorAnnouncements = async (req, res) => {
  try {
    const { cohortId } = req.query;
    const where = {};
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      where.mentorId = req.user.id;
    }
    if (cohortId) {
      where.mentorGroupId = cohortId;
    }
    const announcements = await prisma.cohortAnnouncement.findMany({
      where,
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } },
        mentorGroup: { select: { id: true, name: true, academyName: true } },
        _count: { select: { readReceipts: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    res.json({ announcements });
  } catch (error) {
    console.error('getMentorAnnouncements error:', error);
    res.status(500).json({ message: 'Failed to fetch announcements.' });
  }
};

// ==========================================
// 3. STUDENT & COHORT FEED (STUDENT-FACING)
// ==========================================

/**
 * Centralized student feed aggregating published trade shares and announcements
 * Scoped strictly to cohorts where the user has an ACTIVE membership (or owns as Mentor).
 * GET /api/mentors/student-feed
 */
const getStudentFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cohortId, contentType, readStatus, page = 1, limit = 30 } = req.query;

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 30));

    // 1. Find all active cohort memberships for this student
    const activeMemberships = await prisma.mentorStudent.findMany({
      where: {
        studentId: userId,
        status: 'ACTIVE',
      },
      select: {
        mentorGroupId: true,
        mentorGroup: {
          select: {
            id: true,
            name: true,
            academyName: true,
            logoUrl: true,
            mentor: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Also include cohorts owned by this user if they are a mentor previewing their academy hub
    const ownedCohorts = await prisma.mentorGroup.findMany({
      where: { mentorId: userId },
      select: {
        id: true,
        name: true,
        academyName: true,
        logoUrl: true,
        mentor: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const cohortMap = new Map();
    activeMemberships.forEach((m) => cohortMap.set(m.mentorGroupId, m.mentorGroup));
    ownedCohorts.forEach((g) => cohortMap.set(g.id, g));

    let activeCohortIds = Array.from(cohortMap.keys());

    // If specific cohort requested, verify active membership or ownership
    if (cohortId && cohortId !== 'ALL') {
      if (!activeCohortIds.includes(cohortId) && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          message: 'You do not have an active enrollment in this cohort.',
        });
      }
      activeCohortIds = [cohortId];
    }

    if (activeCohortIds.length === 0) {
      return res.json({
        feed: [],
        total: 0,
        page: pageNum,
        totalPages: 0,
        unreadCount: 0,
        cohorts: [],
      });
    }

    // 2. Fetch read receipts for this user
    const readReceipts = await prisma.cohortFeedReadState.findMany({
      where: { userId },
      select: { itemType: true, tradeShareId: true, announcementId: true },
    });

    const readTradeShareIds = new Set(readReceipts.filter((r) => r.itemType === 'TRADE_SHARE').map((r) => r.tradeShareId));
    const readAnnouncementIds = new Set(readReceipts.filter((r) => r.itemType === 'ANNOUNCEMENT').map((r) => r.announcementId));

    const feedItems = [];

    // 3. Fetch published trade shares if contentType allows
    if (!contentType || contentType === 'ALL' || contentType === 'TRADES') {
      const tradeShares = await prisma.cohortTradeShare.findMany({
        where: {
          status: 'PUBLISHED',
          targets: {
            some: {
              mentorGroupId: { in: activeCohortIds },
            },
          },
        },
        include: {
          mentor: {
            select: { id: true, name: true, avatarUrl: true },
          },
          sourceTrade: {
            select: {
              pair: true,
              direction: true,
              entryPrice: true,
              stopLoss: true,
              takeProfit: true,
              exitPrice: true,
              riskRewardRatio: true,
              pips: true,
              profitLossAmount: true,
              profitLossPercent: true,
              lotSize: true,
              result: true,
              status: true,
              session: true,
              higherTimeframe: true,
              entryTimeframe: true,
              htfBias: true,
            },
          },
          targets: {
            where: {
              mentorGroupId: { in: activeCohortIds },
            },
            include: {
              mentorGroup: {
                select: { id: true, name: true, academyName: true, logoUrl: true },
              },
            },
          },
        },
        orderBy: [
          { pinned: 'desc' },
          { publishedAt: 'desc' },
        ],
        take: 100,
      });

      for (const ts of tradeShares) {
        const isRead = readTradeShareIds.has(ts.id);
        if (readStatus === 'UNREAD' && isRead) continue;
        if (readStatus === 'READ' && !isRead) continue;

        let snap = ts.tradeSnapshot || {};
        if (ts.sourceTrade && (snap.riskRewardRatio === null || snap.riskRewardRatio === undefined)) {
          snap = buildAudienceSafeTradeSnapshot(ts.sourceTrade, snap.visibility, snap);
        }

        feedItems.push({
          id: ts.id,
          type: 'TRADE_SHARE',
          title: ts.title,
          tradeSnapshot: snap,
          setupThesis: ts.setupThesis,
          entryReasoning: ts.entryReasoning,
          riskRationale: ts.riskRationale,
          managementReasoning: ts.managementReasoning,
          outcomeLessons: ts.outcomeLessons,
          generalNotes: ts.generalNotes,
          attachments: ts.attachments || [],
          isCaseStudy: ts.isCaseStudy,
          isPinned: ts.pinned,
          publishedAt: ts.publishedAt || ts.createdAt,
          mentor: ts.mentor,
          cohorts: ts.targets.map((t) => t.mentorGroup),
          isRead,
        });
      }
    }

    // 4. Fetch published announcements if contentType allows
    if (!contentType || contentType === 'ALL' || contentType === 'ANNOUNCEMENTS') {
      const announcements = await prisma.cohortAnnouncement.findMany({
        where: {
          status: 'PUBLISHED',
          mentorGroupId: { in: activeCohortIds },
        },
        include: {
          mentor: {
            select: { id: true, name: true, avatarUrl: true },
          },
          mentorGroup: {
            select: { id: true, name: true, academyName: true, logoUrl: true },
          },
        },
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: 'desc' },
        ],
        take: 100,
      });

      for (const an of announcements) {
        const isRead = readAnnouncementIds.has(an.id);
        if (readStatus === 'UNREAD' && isRead) continue;
        if (readStatus === 'READ' && !isRead) continue;

        feedItems.push({
          id: an.id,
          type: 'ANNOUNCEMENT',
          title: an.title,
          content: an.content,
          category: an.category,
          attachments: an.attachments || [],
          isPinned: an.isPinned,
          publishedAt: an.publishedAt || an.createdAt,
          mentor: an.mentor,
          cohorts: [an.mentorGroup],
          isRead,
        });
      }
    }

    // 5. Sort unified feed items: Pinned first, then reverse chronological
    feedItems.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    const unreadCount = feedItems.filter((i) => !i.isRead).length;
    const total = feedItems.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedItems = feedItems.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      feed: paginatedItems,
      total,
      page: pageNum,
      totalPages,
      unreadCount,
      cohorts: Array.from(cohortMap.values()),
    });
  } catch (error) {
    console.error('getStudentFeed error:', error);
    res.status(500).json({ message: 'Failed to load academy feed.' });
  }
};

/**
 * Get detailed view of a shared trade
 * GET /api/mentors/cohort-trade-shares/:id
 */
const getTradeShareDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const share = await prisma.cohortTradeShare.findUnique({
      where: { id },
      include: {
        mentor: { select: { id: true, name: true, avatarUrl: true } },
        targets: {
          include: {
            mentorGroup: { select: { id: true, name: true, academyName: true, logoUrl: true } },
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ message: 'Shared trade not found.' });
    }

    const isAuthor = share.mentorId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isAuthor && !isAdmin) {
      const targetGroupIds = share.targets.map((t) => t.mentorGroupId);
      const activeEnrollment = await prisma.mentorStudent.findFirst({
        where: {
          studentId: req.user.id,
          status: 'ACTIVE',
          mentorGroupId: { in: targetGroupIds },
        },
      });

      if (!activeEnrollment) {
        return res.status(403).json({
          message: 'You must have an active membership in this cohort to view this trade breakdown.',
        });
      }

      // Mark as read for this student
      await prisma.cohortFeedReadState.upsert({
        where: {
          userId_itemType_tradeShareId: {
            userId: req.user.id,
            itemType: 'TRADE_SHARE',
            tradeShareId: id,
          },
        },
        update: { readAt: new Date() },
        create: {
          userId: req.user.id,
          itemType: 'TRADE_SHARE',
          tradeShareId: id,
        },
      });
    }

    res.json({
      id: share.id,
      title: share.title,
      status: share.status,
      tradeSnapshot: share.tradeSnapshot,
      setupThesis: share.setupThesis,
      entryReasoning: share.entryReasoning,
      riskRationale: share.riskRationale,
      managementReasoning: share.managementReasoning,
      outcomeLessons: share.outcomeLessons,
      generalNotes: share.generalNotes,
      attachments: share.attachments || [],
      isCaseStudy: share.isCaseStudy,
      pinned: share.pinned,
      publishedAt: share.publishedAt,
      mentor: share.mentor,
      cohorts: share.targets.map((t) => t.mentorGroup),
    });
  } catch (error) {
    console.error('getTradeShareDetail error:', error);
    res.status(500).json({ message: 'Failed to fetch trade breakdown.' });
  }
};

/**
 * Student logs a mentor's shared trade setup into their own personal trading journal
 * POST /api/mentors/cohort-trade-shares/:id/log-to-journal
 */
const logSharedTradeToStudentJournal = async (req, res) => {
  try {
    const { id } = req.params;
    const { tradingAccountId, status = 'PLANNED', lotSize } = req.body || {};

    const share = await prisma.cohortTradeShare.findUnique({
      where: { id },
      include: {
        mentor: { select: { id: true, name: true } },
        targets: true,
      },
    });

    if (!share) {
      return res.status(404).json({ message: 'Shared trade setup not found.' });
    }

    // Verify student has access to this trade share
    const isAuthor = share.mentorId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    if (!isAuthor && !isAdmin) {
      const targetGroupIds = share.targets.map((t) => t.mentorGroupId);
      const activeEnrollment = await prisma.mentorStudent.findFirst({
        where: {
          studentId: req.user.id,
          status: 'ACTIVE',
          mentorGroupId: { in: targetGroupIds },
        },
      });
      if (!activeEnrollment) {
        return res.status(403).json({ message: 'You must be an active member of this cohort to log this setup.' });
      }
    }

    // Find student's target trading account
    let account = null;
    if (tradingAccountId) {
      account = await prisma.tradingAccount.findFirst({
        where: { id: tradingAccountId, userId: req.user.id },
      });
    }
    if (!account) {
      account = await prisma.tradingAccount.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!account) {
      return res.status(400).json({
        message: 'Please create a Trading Account in your journal first before logging setups.',
      });
    }

    const snap = share.tradeSnapshot || {};
    const normalizedDir = String(snap.direction || 'BUY').toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
    const validSessions = ['ASIAN', 'LONDON', 'NEW_YORK', 'OVERLAP', 'OTHER'];
    const normalizedSession = validSessions.includes(String(snap.session || '').toUpperCase())
      ? String(snap.session).toUpperCase()
      : 'LONDON';

    const newTrade = await prisma.trade.create({
      data: {
        tradingAccountId: account.id,
        pair: snap.pair || 'EURUSD',
        direction: normalizedDir,
        entryPrice: toNumOrNull(snap.entryPrice),
        stopLoss: toNumOrNull(snap.stopLoss),
        takeProfit: toNumOrNull(snap.takeProfit),
        riskRewardRatio: toNumOrNull(snap.riskRewardRatio ?? snap.plannedRR),
        lotSize: toNumOrNull(lotSize) ?? toNumOrNull(snap.lotSize) ?? 0.1,
        result: 'OPEN',
        status: status === 'ACTIVE' ? 'ACTIVE' : 'PLANNED',
        session: normalizedSession,
        higherTimeframe: snap.higherTimeframe || null,
        entryTimeframe: snap.entryTimeframe || null,
        htfBias: snap.htfBias || null,
        entryTime: new Date(),
        entryReason: `[Academy Setup by ${share.mentor?.name || 'Mentor'}] ${share.title || ''}\n${share.setupThesis || ''}`.trim(),
        notesBefore: [
          share.entryReasoning ? `Entry Confluence: ${share.entryReasoning}` : '',
          share.riskRationale ? `Risk Rationale: ${share.riskRationale}` : '',
          share.outcomeLessons ? `Key Lesson: ${share.outcomeLessons}` : '',
        ].filter(Boolean).join('\n\n') || null,
      },
    });

    res.status(201).json({
      message: `${newTrade.pair} setup logged to your "${account.name}" journal!`,
      trade: newTrade,
    });
  } catch (error) {
    console.error('logSharedTradeToStudentJournal error:', error);
    res.status(500).json({ message: 'Failed to log setup to your trading journal.' });
  }
};

/**
 * Mark a feed item as read
 * POST /api/mentors/feed/:itemType/:itemId/read
 */
const markFeedItemRead = async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    if (itemType !== 'TRADE_SHARE' && itemType !== 'ANNOUNCEMENT') {
      return res.status(400).json({ message: 'Invalid feed item type.' });
    }

    if (itemType === 'TRADE_SHARE') {
      await prisma.cohortFeedReadState.upsert({
        where: {
          userId_itemType_tradeShareId: {
            userId: req.user.id,
            itemType: 'TRADE_SHARE',
            tradeShareId: itemId,
          },
        },
        update: { readAt: new Date() },
        create: {
          userId: req.user.id,
          itemType: 'TRADE_SHARE',
          tradeShareId: itemId,
        },
      });
    } else {
      await prisma.cohortFeedReadState.upsert({
        where: {
          userId_itemType_announcementId: {
            userId: req.user.id,
            itemType: 'ANNOUNCEMENT',
            announcementId: itemId,
          },
        },
        update: { readAt: new Date() },
        create: {
          userId: req.user.id,
          itemType: 'ANNOUNCEMENT',
          announcementId: itemId,
        },
      });
    }

    res.json({ success: true, message: 'Item marked as read.' });
  } catch (error) {
    console.error('markFeedItemRead error:', error);
    res.status(500).json({ message: 'Failed to mark item as read.' });
  }
};

/**
 * Centralized student review feed: all feedback received by the student
 * GET /api/mentors/my-reviews
 */
const getMyStudentReviews = async (req, res) => {
  try {
    const studentId = req.user.id;

    const feedbacks = await prisma.mentorFeedback.findMany({
      where: {
        trade: {
          tradingAccount: {
            userId: studentId,
          },
        },
      },
      include: {
        mentor: {
          select: { id: true, name: true, avatarUrl: true, tradingStyle: true },
        },
        trade: {
          select: {
            id: true,
            pair: true,
            direction: true,
            entryPrice: true,
            exitPrice: true,
            result: true,
            profitLossAmount: true,
            profitLossPercent: true,
            riskRewardRatio: true,
            entryTime: true,
            exitTime: true,
            tradingAccount: {
              select: { name: true, currency: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ feedbacks });
  } catch (error) {
    console.error('getMyStudentReviews error:', error);
    res.status(500).json({ message: 'Failed to fetch your mentor trade reviews.' });
  }
};

/**
 * Rich overview endpoint for the "My Academies" Hub
 * GET /api/mentors/my-academies-overview
 */
const getMyAcademiesOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const isMentor = req.user.role === 'MENTOR' || req.user.subscriptionPlan === 'MENTOR';

    const memberships = await prisma.mentorStudent.findMany({
      where: { studentId: userId, status: 'ACTIVE' },
      include: {
        mentorGroup: {
          include: {
            mentor: {
              select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true },
            },
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                submissions: { where: { studentId: userId } },
              },
            },
            _count: {
              select: {
                students: { where: { status: 'ACTIVE' } },
                announcements: { where: { status: 'PUBLISHED' } },
                cohortTradeTargets: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeCohortIds = memberships.map((m) => m.mentorGroupId);

    let unreadCount = 0;
    if (activeCohortIds.length > 0) {
      const readReceipts = await prisma.cohortFeedReadState.findMany({
        where: { userId },
        select: { itemType: true, tradeShareId: true, announcementId: true },
      });

      const readShareIds = new Set(readReceipts.filter((r) => r.itemType === 'TRADE_SHARE').map((r) => r.tradeShareId));
      const readAnnIds = new Set(readReceipts.filter((r) => r.itemType === 'ANNOUNCEMENT').map((r) => r.announcementId));

      const [publishedShares, publishedAnnouncements] = await Promise.all([
        prisma.cohortTradeShare.findMany({
          where: {
            status: 'PUBLISHED',
            targets: { some: { mentorGroupId: { in: activeCohortIds } } },
          },
          select: { id: true },
        }),
        prisma.cohortAnnouncement.findMany({
          where: {
            status: 'PUBLISHED',
            mentorGroupId: { in: activeCohortIds },
          },
          select: { id: true },
        }),
      ]);

      const unreadShares = publishedShares.filter((s) => !readShareIds.has(s.id)).length;
      const unreadAnns = publishedAnnouncements.filter((a) => !readAnnIds.has(a.id)).length;
      unreadCount = unreadShares + unreadAnns;
    }

    const totalReviewsCount = await prisma.mentorFeedback.count({
      where: {
        trade: { tradingAccount: { userId } },
      },
    });

    let mentorStats = null;
    if (isMentor || req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      const [ownedCohortsCount, totalStudentsCount, publishedSharesCount, announcementsCount] = await Promise.all([
        prisma.mentorGroup.count({ where: { mentorId: userId } }),
        prisma.mentorStudent.count({ where: { mentorGroup: { mentorId: userId }, status: 'ACTIVE' } }),
        prisma.cohortTradeShare.count({ where: { mentorId: userId, status: 'PUBLISHED' } }),
        prisma.cohortAnnouncement.count({ where: { mentorId: userId, status: 'PUBLISHED' } }),
      ]);

      mentorStats = {
        ownedCohortsCount,
        totalStudentsCount,
        publishedSharesCount,
        announcementsCount,
      };
    }

    res.json({
      isMentor,
      memberships,
      unreadCount,
      totalReviewsCount,
      mentorStats,
    });
  } catch (error) {
    console.error('getMyAcademiesOverview error:', error);
    res.status(500).json({ message: 'Failed to load academies overview.' });
  }
};

// ==========================================
// 4. DIRECT 1-ON-1 MENTOR <-> STUDENT CHAT
// ==========================================

/**
 * List 1-on-1 chat threads for either Mentor (all students across cohorts) or Student (their cohort mentors)
 * GET /api/mentors/chat/threads
 */
const getDirectChatThreads = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cohortId } = req.query;

    // 1. Threads where user is the Mentor
    const mentorWhere = {
      status: 'ACTIVE',
      mentorGroup: { mentorId: userId },
    };
    if (cohortId && cohortId !== 'ALL') {
      mentorWhere.mentorGroupId = cohortId;
    }

    // 2. Threads where user is the Student
    const studentWhere = {
      status: 'ACTIVE',
      studentId: userId,
    };
    if (cohortId && cohortId !== 'ALL') {
      studentWhere.mentorGroupId = cohortId;
    }

    const [asMentorEnrollments, asStudentEnrollments] = await Promise.all([
      prisma.mentorStudent.findMany({
        where: mentorWhere,
        include: {
          student: {
            select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true },
          },
          mentorGroup: {
            select: {
              id: true,
              name: true,
              academyName: true,
              mentorId: true,
              mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mentorStudent.findMany({
        where: studentWhere,
        include: {
          student: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          mentorGroup: {
            select: {
              id: true,
              name: true,
              academyName: true,
              mentorId: true,
              mentor: { select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const allEnrollments = [...asMentorEnrollments, ...asStudentEnrollments];
    const uniqueKeyMap = new Map();
    for (const enr of allEnrollments) {
      const key = `${enr.mentorGroupId}:${enr.studentId}`;
      if (!uniqueKeyMap.has(key)) {
        uniqueKeyMap.set(key, enr);
      }
    }

    const threads = await Promise.all(
      Array.from(uniqueKeyMap.values()).map(async (enr) => {
        const [lastMessage, unreadCount] = await Promise.all([
          prisma.mentorDirectMessage.findFirst({
            where: {
              mentorGroupId: enr.mentorGroupId,
              studentId: enr.studentId,
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.mentorDirectMessage.count({
            where: {
              mentorGroupId: enr.mentorGroupId,
              studentId: enr.studentId,
              senderId: { not: userId },
              isRead: false,
            },
          }),
        ]);

        const isUserMentor = enr.mentorGroup.mentorId === userId;
        const partner = isUserMentor ? enr.student : enr.mentorGroup.mentor;

        return {
          threadKey: `${enr.mentorGroupId}:${enr.studentId}`,
          mentorGroupId: enr.mentorGroupId,
          cohortName: enr.mentorGroup.name,
          academyName: enr.mentorGroup.academyName,
          mentorId: enr.mentorGroup.mentorId,
          mentor: enr.mentorGroup.mentor,
          studentId: enr.studentId,
          student: enr.student,
          partner,
          roleInThread: isUserMentor ? 'MENTOR' : 'STUDENT',
          lastMessage,
          unreadCount,
          updatedAt: lastMessage?.createdAt || enr.createdAt,
        };
      })
    );

    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const totalUnread = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

    res.json({ threads, totalUnread });
  } catch (error) {
    console.error('getDirectChatThreads error:', error);
    res.status(500).json({ message: 'Failed to load chat threads.' });
  }
};

/**
 * Get 1-on-1 message history between a mentor and an individual student in a cohort
 * GET /api/mentors/groups/:groupId/students/:studentId/messages
 */
const getDirectMessages = async (req, res) => {
  try {
    const { groupId, studentId } = req.params;
    const userId = req.user.id;

    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      include: {
        mentor: { select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true } },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Cohort not found.' });
    }

    const enrollment = await prisma.mentorStudent.findFirst({
      where: {
        mentorGroupId: groupId,
        studentId,
        status: 'ACTIVE',
      },
      include: {
        student: { select: { id: true, name: true, email: true, avatarUrl: true, tradingStyle: true } },
      },
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Active student enrollment not found in this cohort.' });
    }

    const isMentorOwner = group.mentorId === userId;
    const isEnrolledStudent = studentId === userId;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isMentorOwner && !isEnrolledStudent && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to access this private conversation.' });
    }

    // Mark incoming unread messages as read
    await prisma.mentorDirectMessage.updateMany({
      where: {
        mentorGroupId: groupId,
        studentId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    const messages = await prisma.mentorDirectMessage.findMany({
      where: {
        mentorGroupId: groupId,
        studentId,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    res.json({
      cohort: { id: group.id, name: group.name, academyName: group.academyName },
      mentor: group.mentor,
      student: enrollment.student,
      messages,
    });
  } catch (error) {
    console.error('getDirectMessages error:', error);
    res.status(500).json({ message: 'Failed to load direct messages.' });
  }
};

/**
 * Send a 1-on-1 direct message between mentor and individual student
 * POST /api/mentors/groups/:groupId/students/:studentId/messages
 */
const sendDirectMessage = async (req, res) => {
  try {
    const { groupId, studentId } = req.params;
    const userId = req.user.id;

    const parseResult = sendDirectMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { content, tradeShareId, attachmentUrl } = parseResult.data;

    const group = await prisma.mentorGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, mentorId: true },
    });

    if (!group) {
      return res.status(404).json({ message: 'Cohort not found.' });
    }

    const enrollment = await prisma.mentorStudent.findFirst({
      where: {
        mentorGroupId: groupId,
        studentId,
        status: 'ACTIVE',
      },
      select: { id: true, studentId: true },
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Student is not actively enrolled in this cohort.' });
    }

    const isMentorOwner = group.mentorId === userId;
    const isEnrolledStudent = studentId === userId;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isMentorOwner && !isEnrolledStudent && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to send messages in this conversation.' });
    }

    const directMessage = await prisma.mentorDirectMessage.create({
      data: {
        mentorGroupId: groupId,
        mentorId: group.mentorId,
        studentId,
        senderId: userId,
        content: content.trim(),
        tradeShareId: tradeShareId || null,
        attachmentUrl: attachmentUrl || null,
        isRead: false,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    // Notify recipient
    const recipientId = userId === group.mentorId ? studentId : group.mentorId;
    const targetActionUrl = userId === group.mentorId
      ? `/student-cohorts?tab=chat&cohortId=${groupId}`
      : `/mentor-workspace?tab=messages&cohortId=${groupId}&studentId=${studentId}`;
    notificationService.sendManualNotification(
      `New Direct Message in ${group.name}`,
      `${req.user.name || 'Academy Member'}: "${content.trim().slice(0, 90)}${content.length > 90 ? '...' : ''}"`,
      [recipientId],
      'MENTOR_UPDATE',
      userId,
      targetActionUrl
    ).catch((err) => console.warn('Direct message notification warning:', err?.message));

    res.status(201).json({
      message: 'Message sent!',
      directMessage,
    });
  } catch (error) {
    console.error('sendDirectMessage error:', error);
    res.status(500).json({ message: 'Failed to send message.' });
  }
};

module.exports = {
  createTradeShare,
  updateTradeShare,
  deleteTradeShare,
  getMentorTradeShares,
  createAnnouncement,
  getMentorAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  getStudentFeed,
  getTradeShareDetail,
  logSharedTradeToStudentJournal,
  markFeedItemRead,
  getMyStudentReviews,
  getMyAcademiesOverview,
  getDirectChatThreads,
  getDirectMessages,
  sendDirectMessage,
  buildAudienceSafeTradeSnapshot,
};
