const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const parseNum = (v) => {
  if (v === null || v === undefined || v === '' || v === 'null') return null;
  const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? null : n;
};

/**
 * Calculates similarity score (0 to 100) between an incoming trade candidate and an existing trade record.
 *
 * Scoring Breakdown:
 * - Direct Ticket / externalId Match: 100 (Immediate Exact Match)
 * - Instrument & Direction Match: +30
 * - Entry Price Proximity (<0.1% diff = +25, <0.5% diff = +15)
 * - Exit Price Proximity (<0.1% diff = +20, <0.5% diff = +10)
 * - Timestamps (within 15m = +25, within 60m = +15)
 * - Volume / Lot Size Exact Match = +15
 * - Realized PnL Proximity (<$0.10 diff = +15)
 */
const calculateTradeSimilarity = (candidate, existing) => {
  // 1. Direct Ticket ID / External ID match
  const candidateTicket = candidate.externalId ? String(candidate.externalId).trim() : null;
  const existingTicket = existing.externalId ? String(existing.externalId).trim() : null;

  if (candidateTicket && existingTicket) {
    if (candidateTicket === existingTicket) {
      return {
        score: 100,
        isExactTicketMatch: true,
        reason: `Exact broker ticket match (#${candidateTicket})`,
      };
    }
    // Both have ticket IDs and they differ -> distinct trades!
    return { score: 0, isExactTicketMatch: false, reason: 'Different broker ticket IDs' };
  }

  // 2. Instrument & Direction check
  const candidatePair = candidate.pair ? String(candidate.pair).toUpperCase().trim() : null;
  const existingPair = existing.pair ? String(existing.pair).toUpperCase().trim() : null;

  const candidateDir = candidate.direction ? String(candidate.direction).toUpperCase().trim() : null;
  const existingDir = existing.direction ? String(existing.direction).toUpperCase().trim() : null;

  if (!candidatePair || !existingPair || candidatePair !== existingPair) {
    return { score: 0, isExactTicketMatch: false, reason: 'Different trading instruments' };
  }

  if (candidateDir && existingDir && candidateDir !== existingDir) {
    return { score: 0, isExactTicketMatch: false, reason: 'Opposite trade directions' };
  }

  let score = 30; // Instrument and Direction matched
  const matchedFactors = ['Same instrument and direction'];

  // 3. Entry Price proximity
  const candidateEntry = parseNum(candidate.entryPrice);
  const existingEntry = parseNum(existing.entryPrice);

  if (candidateEntry && existingEntry && existingEntry > 0) {
    const diffPct = Math.abs(candidateEntry - existingEntry) / existingEntry;
    if (diffPct < 0.001) { // within 0.1%
      score += 25;
      matchedFactors.push(`Entry price within 0.1% (${candidateEntry} vs ${existingEntry})`);
    } else if (diffPct < 0.005) { // within 0.5%
      score += 15;
      matchedFactors.push(`Entry price within 0.5%`);
    }
  }

  // 4. Exit Price proximity
  const candidateExit = parseNum(candidate.exitPrice);
  const existingExit = parseNum(existing.exitPrice);

  if (candidateExit && existingExit && existingExit > 0) {
    const diffPct = Math.abs(candidateExit - existingExit) / existingExit;
    if (diffPct < 0.001) {
      score += 20;
      matchedFactors.push(`Exit price within 0.1%`);
    } else if (diffPct < 0.005) {
      score += 10;
      matchedFactors.push(`Exit price within 0.5%`);
    }
  }

  // 5. Volume / Lot Size
  const candidateLots = parseNum(candidate.lotSize || candidate.volume);
  const existingLots = parseNum(existing.lotSize);

  if (candidateLots !== null && existingLots !== null) {
    if (Math.abs(candidateLots - existingLots) < 0.001) {
      score += 15;
      matchedFactors.push(`Identical volume (${candidateLots} lots)`);
    }
  }

  // 6. Timestamps (Entry and Exit)
  const candidateEntryTime = candidate.entryTime ? new Date(candidate.entryTime).getTime() : null;
  const existingEntryTime = existing.entryTime ? new Date(existing.entryTime).getTime() : null;

  if (candidateEntryTime && existingEntryTime && !isNaN(candidateEntryTime) && !isNaN(existingEntryTime)) {
    const timeDiffMs = Math.abs(candidateEntryTime - existingEntryTime);
    if (timeDiffMs <= 15 * 60 * 1000) { // 15 mins
      score += 25;
      matchedFactors.push('Entry timestamps within 15 minutes');
    } else if (timeDiffMs <= 60 * 60 * 1000) { // 1 hour
      score += 15;
      matchedFactors.push('Entry timestamps within 1 hour');
    }
  }

  // 7. PnL / Profit proximity
  const candidatePnl = parseNum(candidate.profitLossAmount || candidate.grossProfit);
  const existingPnl = parseNum(existing.profitLossAmount || existing.grossProfit);

  if (candidatePnl !== null && existingPnl !== null) {
    if (Math.abs(candidatePnl - existingPnl) <= 0.10) {
      score += 15;
      matchedFactors.push(`P&L matches within $0.10 ($${candidatePnl} vs $${existingPnl})`);
    }
  }

  return {
    score: Math.min(score, 100),
    isExactTicketMatch: false,
    reason: matchedFactors.join(', '),
  };
};

/**
 * Checks if a candidate trade already exists in user's journal or matches high confidence duplicate.
 *
 * @param {Object} candidate - Candidate trade data
 * @param {string} userId - User ID
 * @param {string} [tradingAccountId] - Optional account ID
 * @param {Array} [existingTrades] - Optional cached existing trades array
 * @returns {Promise<Object>}
 */
const checkTradeDuplicate = async ({
  candidate,
  userId,
  tradingAccountId = null,
  existingTrades = null,
}) => {
  let trades = existingTrades;

  if (!trades) {
    trades = await prisma.trade.findMany({
      where: {
        tradingAccount: { userId },
        ...(tradingAccountId ? { tradingAccountId } : {}),
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        pair: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        stopLoss: true,
        lotSize: true,
        profitLossAmount: true,
        grossProfit: true,
        status: true,
        result: true,
        externalId: true,
        entryTime: true,
        exitTime: true,
        tradingAccountId: true,
        tradingAccount: { select: { id: true, name: true } },
      },
    });
  }

  let highestScore = 0;
  let bestMatch = null;
  let matchReason = null;

  for (const existing of trades) {
    const similarity = calculateTradeSimilarity(candidate, existing);
    if (similarity.score > highestScore) {
      highestScore = similarity.score;
      bestMatch = existing;
      matchReason = similarity.reason;
    }

    if (similarity.score === 100) {
      break; // Exact match found
    }
  }

  const isDuplicate = highestScore >= 75;
  const isPossibleDuplicate = highestScore >= 50 && highestScore < 75;

  return {
    hasDuplicate: isDuplicate,
    isPossibleDuplicate,
    similarityScore: highestScore,
    matchReason: matchReason || 'No duplicate found',
    matchedTrade: (isDuplicate || isPossibleDuplicate) ? bestMatch : null,
  };
};

/**
 * Detects duplicates among multiple trades in a single upload batch.
 *
 * @param {Array} candidateList
 * @returns {Array} List of candidates with intraBatchDuplicate flags
 */
const detectBatchDuplicates = (candidateList = []) => {
  const result = candidateList.map((item, idx) => ({ ...item, batchIndex: idx, isDuplicateInBatch: false, duplicateWithIndex: null }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const sim = calculateTradeSimilarity(result[i], result[j]);
      if (sim.score >= 75) {
        result[j].isDuplicateInBatch = true;
        result[j].duplicateWithIndex = i;
        result[j].duplicateReason = `Duplicate with item #${i + 1} in this batch (${sim.reason})`;
      }
    }
  }

  return result;
};

// ==========================================
// DURABLE MULTI-INSTANCE IDEMPOTENCY SYSTEM
// ==========================================
// L1: Fast In-Memory Map (sub-millisecond local caching)
// L2: PostgreSQL SystemConfig Table (durable across restarts, multi-instance Dokku clusters, 24h TTL)
const idempotencyStore = new Map();

const cleanupIdempotencyKeys = () => {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.timestamp > 24 * 60 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
};
setInterval(cleanupIdempotencyKeys, 10 * 60 * 1000).unref();

/**
 * Retrieves a previously completed result for an idempotency key.
 * Checks L1 memory first, then L2 PostgreSQL systemConfig.
 */
const getIdempotentResult = async (key, userId = null) => {
  if (!key) return null;
  const now = Date.now();

  // 1. Check L1 memory cache (fast path)
  const entry = idempotencyStore.get(key);
  if (entry && now - entry.timestamp <= 24 * 60 * 60 * 1000) {
    return entry.result;
  }

  // 2. Check L2 PostgreSQL durable store
  try {
    const configKey = `idemp:${userId ? `${userId}:` : ''}${key}`;
    const record = await prisma.systemConfig.findUnique({
      where: { key: configKey },
    });

    if (record && record.value) {
      const val = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
      if (val.expiresAt && now < val.expiresAt) {
        if (val.status === 'COMPLETED') {
          // Re-populate L1
          idempotencyStore.set(key, { result: val.payload, timestamp: now });
          return val.payload;
        }
      }
      if (val.expiresAt && now >= val.expiresAt) {
        // Expired record cleanup
        await prisma.systemConfig.delete({ where: { key: configKey } }).catch(() => null);
      }
    }
  } catch (err) {
    // Graceful fallback to memory
  }

  return null;
};

/**
 * Attempts to claim an idempotency key to prevent concurrent double-submissions.
 * Uses atomic PostgreSQL SystemConfig.create with primary key constraint,
 * backed by L1 memory cache.
 *
 * Returns:
 * - { acquired: true } if lock acquired.
 * - { acquired: false, inProgress: true } if another concurrent request is currently holding the lock.
 * - { acquired: false, completed: true, cachedResult } if request has already been completed.
 */
const claimIdempotencyKey = async (key, userId = null, lockTtlMs = 60 * 1000) => {
  if (!key) return { acquired: true };
  const now = Date.now();
  const configKey = `idemp:${userId ? `${userId}:` : ''}${key}`;

  // 1. Fast check L1 memory cache
  const l1Entry = idempotencyStore.get(key);
  if (l1Entry && now - l1Entry.timestamp <= 24 * 60 * 60 * 1000) {
    return { acquired: false, completed: true, cachedResult: l1Entry.result };
  }

  // 2. Attempt atomic PostgreSQL create with primary key constraint
  try {
    await prisma.systemConfig.create({
      data: {
        key: configKey,
        value: {
          status: 'IN_PROGRESS',
          lockExpiresAt: now + lockTtlMs,
          expiresAt: now + 24 * 60 * 60 * 1000,
          createdAt: new Date().toISOString(),
        },
        updatedBy: userId || 'AI_TRADE_CAPTURE',
      },
    });

    return { acquired: true };
  } catch (err) {
    // If not a unique constraint violation (P2002), return acquired: true as graceful fallback
    if (err.code !== 'P2002') {
      return { acquired: true };
    }
  }

  // 3. Unique constraint failed: Record already exists. Inspect current status.
  try {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: configKey },
    });

    if (existing && existing.value) {
      const val = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;

      if (val.expiresAt && now < val.expiresAt) {
        if (val.status === 'COMPLETED') {
          idempotencyStore.set(key, { result: val.payload, timestamp: now });
          return { acquired: false, completed: true, cachedResult: val.payload };
        }
        if (val.status === 'IN_PROGRESS' && val.lockExpiresAt && now < val.lockExpiresAt) {
          return { acquired: false, inProgress: true };
        }
      }

      // If previous lock has expired (lockExpiresAt <= now or expired record), take over the lock
      await prisma.systemConfig.update({
        where: { key: configKey },
        data: {
          value: {
            status: 'IN_PROGRESS',
            lockExpiresAt: now + lockTtlMs,
            expiresAt: now + 24 * 60 * 60 * 1000,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return { acquired: true };
    }

    return { acquired: true };
  } catch (err) {
    return { acquired: true };
  }
};

/**
 * Releases an idempotency lock in the event of an error, allowing safe retry.
 */
const releaseIdempotencyKey = async (key, userId = null) => {
  if (!key) return;
  const configKey = `idemp:${userId ? `${userId}:` : ''}${key}`;
  idempotencyStore.delete(key);
  try {
    await prisma.systemConfig.delete({ where: { key: configKey } }).catch(() => null);
  } catch (err) {}
};

/**
 * Stores the completed result for an idempotency key across L1 and L2.
 */
const setIdempotentResult = async (key, result, userId = null, ttlMs = 24 * 60 * 60 * 1000) => {
  if (!key) return;
  const now = Date.now();

  // 1. Write L1 memory
  idempotencyStore.set(key, { result, timestamp: now });

  // 2. Write L2 PostgreSQL durable store
  try {
    const configKey = `idemp:${userId ? `${userId}:` : ''}${key}`;
    await prisma.systemConfig.upsert({
      where: { key: configKey },
      create: {
        key: configKey,
        value: {
          status: 'COMPLETED',
          payload: result,
          expiresAt: now + ttlMs,
          createdAt: new Date().toISOString(),
        },
        updatedBy: userId || 'AI_TRADE_CAPTURE',
      },
      update: {
        value: {
          status: 'COMPLETED',
          payload: result,
          expiresAt: now + ttlMs,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    // Non-fatal if DB is temporarily unreachable; L1 persists for lifetime of process
  }
};

module.exports = {
  calculateTradeSimilarity,
  checkTradeDuplicate,
  detectBatchDuplicates,
  getIdempotentResult,
  claimIdempotencyKey,
  releaseIdempotencyKey,
  setIdempotentResult,
};
