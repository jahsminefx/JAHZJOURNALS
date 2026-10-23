const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  parseTradeFromText,
  parseTradeFromImage,
  parseBatchImages,
  generateJournalEnrichment,
} = require('../services/aiTradeCaptureService');
const {
  checkTradeDuplicate,
  getIdempotentResult,
  setIdempotentResult,
  claimIdempotencyKey,
  releaseIdempotencyKey,
} = require('../services/tradeDuplicateDetectionService');
const { reconcileAccountBalance } = require('../services/accountBalanceService');
const {
  classifyTrade,
} = require('../services/tradeClassificationService');
const { calculatePips } = require('../utils/pipCalculator');
const currencyService = require('../services/fx/currencyService');
const {
  saveLocalScreenshot,
} = require('../services/screenshotService');

const getRequestBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const parseNum = (v) => {
  if (v === null || v === undefined || v === '' || v === 'null') return null;
  const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? null : n;
};

/**
 * Unified Chat and Multimodal Trade Capture Endpoint
 * Route: POST /api/ai/trade-capture/chat
 * Supports:
 * 1. Text only
 * 2. Single screenshot only
 * 3. Multiple screenshots only (batch)
 * 4. Text + single screenshot
 * 5. Text + multiple screenshots
 * 6. Follow-up updates on existing draft
 */
const handleChatTradeCapture = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    let { message = '', currentDraft = {}, mockExtraction = null } = req.body;

    if (typeof mockExtraction === 'string') {
      try {
        mockExtraction = JSON.parse(mockExtraction);
      } catch (e) {
        mockExtraction = null;
      }
    }

    if (typeof currentDraft === 'string') {
      try {
        currentDraft = JSON.parse(currentDraft);
      } catch (e) {
        currentDraft = {};
      }
    }
    if (!currentDraft || typeof currentDraft !== 'object') {
      currentDraft = {};
    }

    const hasMessage = Boolean(message && typeof message === 'string' && message.trim());
    const hasFiles = Boolean(files && files.length > 0);

    if (!hasMessage && !hasFiles) {
      return res.status(400).json({ message: 'Please provide trade details in text or attach at least one screenshot.' });
    }

    const userId = req.user.id;
    const baseUrl = getRequestBaseUrl(req);

    // Fetch user context: accounts, strategies, userSettings, recentTrades
    const [accounts, strategies, userSettings, recentTrades] = await Promise.all([
      prisma.tradingAccount.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          currency: true,
          brokerName: true,
          propFirmName: true,
          mtAccountNumber: true,
          cloudLogin: true,
          currentBalance: true,
        },
      }),
      prisma.strategy.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
        select: { breakEvenThresholdAmount: true },
      }),
      prisma.trade.findMany({
        where: { tradingAccount: { userId } },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const userThresholdAmount = userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null;

    // CASE 1: Screenshot(s) attached (single or multiple)
    if (hasFiles) {
      const preparedImages = [];
      for (const f of files) {
        try {
          const saved = await saveLocalScreenshot(f, userId, 'ai-capture', baseUrl);
          preparedImages.push({
            buffer: f.buffer,
            mimetype: f.mimetype,
            originalname: f.originalname,
            imageUrl: saved.secure_url,
            mockExtraction: f.mockExtraction || null,
          });
        } catch (saveErr) {
          preparedImages.push({
            buffer: f.buffer,
            mimetype: f.mimetype,
            originalname: f.originalname,
            imageUrl: null,
            mockExtraction: f.mockExtraction || null,
          });
        }
      }

      if (preparedImages.length === 1) {
        const single = preparedImages[0];
        const result = await parseTradeFromImage({
          imageBuffer: single.buffer,
          mimeType: single.mimetype,
          imageUrl: single.imageUrl,
          userAccounts: accounts,
          userThresholdAmount,
          existingTrades: recentTrades,
          userId,
          userMessage: hasMessage ? message.trim() : null,
          currentDraft,
          mockExtraction: single.mockExtraction || mockExtraction || null,
        });

        return res.json({
          success: true,
          isBatch: false,
          trade: result.candidateTrade,
          updatedDraft: result.candidateTrade,
          fieldStatuses: result.fieldStatuses,
          duplicateInfo: result.duplicateInfo,
          confidenceScore: result.confidenceScore,
          rationale: result.rationale,
          accountResolution: result.accountResolution,
          currencyConflict: result.currencyConflict,
          assistantReply: result.assistantReply || `Extracted trade details from your screenshot for ${result.candidateTrade.pair || 'trade'}. Review the card below and confirm before saving.`,
        });
      }

      // Multi-screenshot batch processing
      const batchResults = await parseBatchImages({
        images: preparedImages,
        userAccounts: accounts,
        userThresholdAmount,
        existingTrades: recentTrades,
        userId,
        userMessage: hasMessage ? message.trim() : null,
        currentDraft,
        mockExtraction,
      });

      const validCount = batchResults.filter((b) => b.candidateTrade !== null).length;

      return res.json({
        success: true,
        isBatch: true,
        totalUploaded: preparedImages.length,
        extractedCount: validCount,
        batch: batchResults,
        assistantReply: `Extracted ${validCount} trade candidate(s) from ${preparedImages.length} screenshot(s). Review each card below and make any adjustments before saving.`,
      });
    }

    // CASE 2: Text only (no files)
    const result = await parseTradeFromText({
      text: message,
      currentDraft,
      userAccounts: accounts,
      userStrategies: strategies,
      userThresholdAmount,
      mockExtraction,
    });

    let duplicateInfo = { hasDuplicate: false, isPossibleDuplicate: false, similarityScore: 0, matchReason: 'No duplicates' };
    if (result.updatedDraft.pair && result.updatedDraft.direction) {
      duplicateInfo = await checkTradeDuplicate({
        candidate: result.updatedDraft,
        userId,
        tradingAccountId: result.updatedDraft.tradingAccountId,
        existingTrades: recentTrades,
      });
    }

    return res.json({
      success: true,
      isBatch: false,
      trade: result.updatedDraft,
      updatedDraft: result.updatedDraft,
      ...result,
      duplicateInfo,
    });
  } catch (error) {
    const correlationId = 'ai_err_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    console.error('[AI Trade Capture Error] [' + correlationId + ']:', {
      userId: req.user?.id,
      message: error.message,
      stack: error.stack,
    });

    const isImageUpload = Boolean((req.files && req.files.length > 0) || req.file);
    const userFacingMessage = isImageUpload
      ? "We couldn't read this screenshot correctly. Your image has not been saved as a trade. Please try again or enter the trade details manually."
      : "We couldn't interpret your trade description. Please check the details and try again or log the trade manually.";

    return res.status(422).json({
      success: false,
      message: userFacingMessage,
      correlationId,
      canRetry: true,
      canManualEntry: true,
    });
  }
};

/**
 * Screenshot extraction endpoint (single or multiple images)
 * Route: POST /api/ai/trade-capture/upload-screenshot
 * Delegates to handleChatTradeCapture for unified behavior while preserving API compatibility.
 */
const handleScreenshotTradeCapture = async (req, res) => {
  return handleChatTradeCapture(req, res);
};

/**
 * Check duplicate for a candidate trade draft
 * Route: POST /api/ai/trade-capture/check-duplicate
 */
const handleCheckDuplicate = async (req, res) => {
  try {
    const { candidateTrade } = req.body;
    if (!candidateTrade) {
      return res.status(400).json({ message: 'Candidate trade data is required.' });
    }

    const duplicateInfo = await checkTradeDuplicate({
      candidate: candidateTrade,
      userId: req.user.id,
      tradingAccountId: candidateTrade.tradingAccountId,
    });

    return res.json(duplicateInfo);
  } catch (error) {
    console.error('Error in handleCheckDuplicate:', error);
    return res.status(500).json({ message: 'Failed to verify trade duplicates.' });
  }
};

/**
 * Confirm and save single trade or batch of trades through existing authorized persistence
 * Route: POST /api/ai/trade-capture/confirm-save
 */
const handleConfirmSave = async (req, res) => {
  const userId = req.user.id;
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;

  try {
    // 1. Idempotency Check & Atomic In-Progress Lock
    if (idempotencyKey) {
      const claim = await claimIdempotencyKey(idempotencyKey, userId);
      if (!claim.acquired) {
        if (claim.completed && claim.cachedResult) {
          return res.status(200).json(claim.cachedResult);
        }
        if (claim.inProgress) {
          return res.status(409).json({
            message: 'A trade save request with this idempotency key is currently processing. Please wait a moment.',
            retryAfter: 2,
          });
        }
      }
    }

    const { trades, trade } = req.body;
    const tradesToSave = Array.isArray(trades) ? trades : (trade ? [trade] : []);

    if (tradesToSave.length === 0) {
      if (idempotencyKey) await releaseIdempotencyKey(idempotencyKey, userId);
      return res.status(400).json({ message: 'No trades supplied to save.' });
    }

    // Fetch user settings for custom Break-Even threshold
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { breakEvenThresholdAmount: true },
    });
    const userThresholdAmount = userSettings?.breakEvenThresholdAmount !== undefined ? userSettings.breakEvenThresholdAmount : null;

    const savedTrades = [];
    const failedTrades = [];
    const affectedAccountIds = new Set();

    for (let i = 0; i < tradesToSave.length; i++) {
      const item = tradesToSave[i];
      try {
        if (!item.tradingAccountId) {
          throw new Error('Trading account is required.');
        }

        // Verify account ownership
        const account = await prisma.tradingAccount.findFirst({
          where: { id: item.tradingAccountId, userId },
        });

        if (!account) {
          throw new Error(`Trading account '${item.tradingAccountId}' not found or unauthorized.`);
        }

        if (!item.pair) {
          throw new Error('Trading pair is required.');
        }

        if (!item.direction || !['BUY', 'SELL'].includes(String(item.direction).toUpperCase())) {
          throw new Error('Valid direction (BUY or SELL) is required.');
        }

        const pair = String(item.pair).toUpperCase().trim();
        const direction = String(item.direction).toUpperCase().trim();
        const entryPrice = parseNum(item.entryPrice);
        const exitPrice = parseNum(item.exitPrice);
        const stopLoss = parseNum(item.stopLoss);
        const takeProfit = parseNum(item.takeProfit);
        const lotSize = parseNum(item.lotSize || item.volume);
        const grossProfit = parseNum(item.grossProfit);
        const commission = parseNum(item.commission) ?? 0;
        const swap = parseNum(item.swap) ?? 0;
        const fees = parseNum(item.fees) ?? 0;

        let status = item.status ? String(item.status).toUpperCase() : (exitPrice !== null ? 'CLOSED' : (entryPrice !== null ? 'ACTIVE' : 'PLANNED'));
        const isClosed = status === 'CLOSED';

        const computedPips = item.pips !== null && item.pips !== undefined
          ? parseNum(item.pips)
          : calculatePips({ pair, direction, entryPrice, exitPrice });

        // Deterministically calculate outcome using canonical service
        const classification = classifyTrade({
          status,
          direction,
          pair,
          entryPrice,
          exitPrice,
          stopLoss,
          initialStopLoss: stopLoss,
          lotSize,
          grossProfit,
          commission,
          swap,
          fees,
          profitLossAmount: isClosed ? parseNum(item.profitLossAmount) : null,
          breakEvenActivated: Boolean(item.breakEvenActivated),
          breakEvenPrice: parseNum(item.breakEvenPrice),
          breakEvenEvidenceSource: item.breakEvenEvidenceSource || (item.breakEvenActivated ? 'USER_MANUAL' : null),
          breakEvenEvidenceStatus: item.breakEvenEvidenceStatus || (item.breakEvenActivated ? 'USER_CONFIRMED' : null),
          userConfirmedBe: Boolean(item.breakEvenActivated),
          manualResultOverride: item.isManualResultOverride ? item.result : null,
          userThresholdAmount,
        });

        // Compute FX rate if closed
        let fxRateToReporting = null;
        let fxRateSource = null;
        let fxRateTimestamp = null;

        if (isClosed) {
          const fxDetails = await currencyService.getExchangeRateDetails(account.currency || 'USD', 'USD');
          fxRateToReporting = fxDetails.rate;
          fxRateSource = fxDetails.source;
          fxRateTimestamp = new Date();
        }

        const effectiveNetPnl = isClosed ? (classification.netProfit ?? parseNum(item.profitLossAmount)) : null;

        // Atomically persist trade + screenshot + emotion logs in a single transaction
        const savedTrade = await prisma.$transaction(async (tx) => {
          const tradeRecord = await tx.trade.create({
            data: {
              tradingAccountId: account.id,
              pair,
              direction,
              entryPrice,
              exitPrice,
              stopLoss,
              takeProfit,
              initialStopLoss: stopLoss,
              initialTakeProfit: takeProfit,
              lotSize,
              grossProfit,
              commission,
              swap,
              fees,
              profitLossAmount: effectiveNetPnl,
              pips: computedPips,
              status,
              result: classification.result,
              breakEvenActivated: classification.breakEvenActivated,
              breakEvenPrice: classification.breakEvenPrice,
              breakEvenActivatedAt: classification.breakEvenActivated ? new Date() : null,
              breakEvenEvidenceSource: classification.breakEvenEvidenceSource,
              breakEvenEvidenceStatus: classification.breakEvenEvidenceStatus,
              classificationSource: 'AI_SUGGESTION',
              resultCalculatedAt: new Date(),
              isManualResultOverride: Boolean(item.isManualResultOverride),
              session: item.session || null,
              strategyId: item.strategyId || null,
              setupId: item.setupId || null,
              higherTimeframe: item.higherTimeframe || null,
              entryTimeframe: item.entryTimeframe || null,
              htfBias: item.htfBias || null,
              entryReason: item.entryReason || null,
              exitReason: item.exitReason || null,
              notesBefore: item.notesBefore || null,
              notesAfter: item.notesAfter || null,
              followedPlan: item.followedPlan !== undefined ? Boolean(item.followedPlan) : null,
              isAPlusSetup: item.isAPlusSetup !== undefined ? Boolean(item.isAPlusSetup) : null,
              newsRelated: item.newsRelated !== undefined ? Boolean(item.newsRelated) : null,
              grade: item.grade || null,
              externalId: item.externalId ? String(item.externalId).trim() : null,
              entryTime: item.entryTime ? new Date(item.entryTime) : new Date(),
              exitTime: isClosed && item.exitTime ? new Date(item.exitTime) : (isClosed ? new Date() : null),
              fxRateToReporting,
              fxRateSource,
              fxRateTimestamp,
            },
          });

          // Link screenshot if provided
          if (item.imageUrl) {
            const screenshotType = item.screenshotType === 'CHART_SETUP'
              ? 'MARKED_CHART'
              : (isClosed ? 'EXIT' : 'ENTRY');

            await tx.tradeScreenshot.create({
              data: {
                tradeId: tradeRecord.id,
                imageUrl: item.imageUrl,
                screenshotType,
                note: 'Attached via JAHZ AI Trade Capture',
              },
            });
          }

          // Link emotion logs if provided
          if (Array.isArray(item.emotions) && item.emotions.length > 0) {
            for (const em of item.emotions) {
              if (typeof em === 'string' && em.trim()) {
                await tx.emotionLog.create({
                  data: {
                    tradeId: tradeRecord.id,
                    stage: 'BEFORE_TRADE',
                    emotion: em.trim().toUpperCase(),
                    intensity: 5,
                  },
                }).catch(() => null);
              }
            }
          }

          return tradeRecord;
        });

        affectedAccountIds.add(account.id);
        savedTrades.push(savedTrade);
      } catch (tradeErr) {
        failedTrades.push({
          batchIndex: i,
          item,
          error: tradeErr.message,
          retryable: true,
        });
      }
    }

    // Reconcile account balances to ground truth: startingBalance + sum(closedTrades.profitLossAmount)
    // Ensures balance is never drifted, double-counted, or corrupted by retries/edits.
    for (const accId of affectedAccountIds) {
      await reconcileAccountBalance(accId).catch((err) => console.warn('[Account Balance] Reconciliation warning:', err.message));
    }

    const hasSuccess = savedTrades.length > 0;
    const hasFailures = failedTrades.length > 0;

    const responsePayload = {
      success: hasSuccess,
      savedCount: savedTrades.length,
      failedCount: failedTrades.length,
      savedTrades,
      failedTrades,
      message: hasSuccess
        ? `Successfully logged ${savedTrades.length} trade${savedTrades.length === 1 ? '' : 's'}${hasFailures ? ` (${failedTrades.length} failed, see details)` : ''}.`
        : 'Failed to log trades. Please correct the highlighted errors and try again.',
    };

    if (hasSuccess && idempotencyKey) {
      await setIdempotentResult(idempotencyKey, responsePayload, userId);
    } else if (!hasSuccess && idempotencyKey) {
      await releaseIdempotencyKey(idempotencyKey, userId);
    }

    // HTTP 201 for full success, 207 Multi-Status for partial, 400 for complete failure
    const statusCode = (!hasFailures && hasSuccess) ? 201 : (hasSuccess && hasFailures ? 207 : 400);
    return res.status(statusCode).json(responsePayload);
  } catch (error) {
    if (idempotencyKey) {
      await releaseIdempotencyKey(idempotencyKey, userId);
    }
    console.error('Error in handleConfirmSave:', error);
    return res.status(500).json({ message: error.message || 'Failed to save trade(s).' });
  }
};

const handleJournalAssist = async (req, res) => {
  try {
    const { tradeId, userNotes = '' } = req.body;
    if (!tradeId) {
      return res.status(400).json({ message: 'tradeId is required.' });
    }

    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { userId: req.user.id } },
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found.' });
    }

    const suggestions = await generateJournalEnrichment({ trade, userNotes });

    return res.json({
      success: true,
      tradeId: trade.id,
      suggestions,
    });
  } catch (error) {
    console.error('Error in handleJournalAssist:', error);
    return res.status(500).json({ message: error.message || 'Failed to generate journal assistance.' });
  }
};

module.exports = {
  handleChatTradeCapture,
  handleScreenshotTradeCapture,
  handleCheckDuplicate,
  handleConfirmSave,
  handleJournalAssist,
};
