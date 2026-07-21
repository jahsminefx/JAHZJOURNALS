const { calculateRiskReward, calculateTradeResult } = require('../utils/tradeCalculations'); // Or build inline
// We need to calculate robust stats per combination.

const calculateMetrics = (trades) => {
  const result = {
    total: trades.length,
    wins: 0,
    losses: 0,
    breakevens: 0,
    netProfit: 0,
    grossProfit: 0,
    grossLoss: 0,
    maxDrawdown: 0, // Simplified: maybe just peak-to-trough of chronological P/L
    totalR: 0,
  };

  const sortedTrades = [...trades].sort((a,b) => new Date(a.entryTime) - new Date(b.entryTime));
  let peak = 0;
  let runningPL = 0;

  sortedTrades.forEach(t => {
    // Basic stats
    if (t.result === 'WIN') result.wins++;
    else if (t.result === 'LOSS') result.losses++;
    else if (t.result === 'BREAKEVEN') result.breakevens++;

    const pl = t.profitLossAmount || 0;
    result.netProfit += pl;
    
    if (pl > 0) result.grossProfit += pl;
    if (pl < 0) result.grossLoss += Math.abs(pl);

    // R calculation
    const r = t.riskAmount ? pl / t.riskAmount : 0;
    result.totalR += r;

    // Drawdown tracked over sequence
    runningPL += pl;
    if (runningPL > peak) peak = runningPL;
    const currentDrawdown = peak - runningPL;
    if (currentDrawdown > result.maxDrawdown) result.maxDrawdown = currentDrawdown;
  });

  result.winRate = result.total > 0 ? result.wins / result.total : 0;
  result.profitFactor = result.grossLoss > 0 ? result.grossProfit / result.grossLoss : (result.grossProfit > 0 ? 999 : 0);
  result.expectancyR = result.total > 0 ? result.totalR / result.total : 0;
  result.avgWin = result.wins > 0 ? result.grossProfit / result.wins : 0;
  result.avgLoss = result.losses > 0 ? result.grossLoss / result.losses : 0;
  
  return result;
};

const getTradeAttributes = (trade) => {
  const attrs = [];
  if (trade.pair) attrs.push(`Pair:${trade.pair}`);
  if (trade.session) attrs.push(`Session:${trade.session}`);
  if (trade.setupType) attrs.push(`Setup:${trade.setupType}`);
  if (trade.strategyName) attrs.push(`Strategy:${trade.strategyName}`);
  
  if (trade.emotionLogs && trade.emotionLogs.length > 0) {
    const mainEmotion = trade.emotionLogs.reduce((prev, curr) => (prev.intensity > curr.intensity) ? prev : curr);
    attrs.push(`Emotion:${mainEmotion.emotion}`);
  }
  
  return attrs;
};

const getCombinations = (attrs, maxDepth = 2) => {
  const result = [];
  const f = (prefix, attrs, depth) => {
    if (depth > maxDepth) return;
    for (let i = 0; i < attrs.length; i++) {
       const next = prefix.concat([attrs[i]]);
       result.push(next.sort().join(' AND '));
       f(next, attrs.slice(i + 1), depth + 1);
    }
  };
  f([], attrs, 1);
  return result;
};

const findEdges = (trades, minSampleSize = 5) => {
  const closedTrades = trades.filter(t => ['WIN', 'LOSS', 'BREAKEVEN'].includes(t.result));
  
  if (closedTrades.length < minSampleSize) return { baseline: null, edges: [] };

  const baselineMetrics = calculateMetrics(closedTrades);
  const buckets = {};

  // Group trades by dimension intersections
  closedTrades.forEach(trade => {
    const attrs = getTradeAttributes(trade);
    const combinations = getCombinations(attrs, 2);
    
    combinations.forEach(combo => {
      if (!buckets[combo]) buckets[combo] = [];
      buckets[combo].push(trade);
    });
  });

  const edges = [];
  for (const [combo, comboTrades] of Object.entries(buckets)) {
    if (comboTrades.length >= minSampleSize) {
      const metrics = calculateMetrics(comboTrades);
      
      // We grade the edge based on multiple criteria versus baseline
      const isBetterWinRate = metrics.winRate > baselineMetrics.winRate * 1.1; // 10% better
      const isBetterPF = metrics.profitFactor > baselineMetrics.profitFactor * 1.1;
      const isBetterExpectancy = metrics.expectancyR > baselineMetrics.expectancyR;
      
      if (isBetterWinRate || isBetterPF || isBetterExpectancy) {
        // Compute an arbitrary edge score to rank them
        // Score incorporates sample size reliability and expectancy magnitude
        const score = (metrics.expectancyR * Math.sqrt(metrics.total)) + (metrics.profitFactor > 999 ? 5 : metrics.profitFactor);
        
        edges.push({
          combination: combo,
          metrics,
          improvementOverBaseline: {
            winRateDiff: metrics.winRate - baselineMetrics.winRate,
            expectancyDiff: metrics.expectancyR - baselineMetrics.expectancyR,
            pfDiff: metrics.profitFactor - baselineMetrics.profitFactor
          },
          score
        });
      }
    }
  }

  // Rank and deduplicate completely overlapping sets (simple deduplication based on exact same trade arrays skipped here for brevity, 
  // but we sort by score and take top 5).
  edges.sort((a,b) => b.score - a.score);

  return {
    baseline: baselineMetrics,
    candidates: edges.slice(0, 5) // Top 5 candidates sent to AI
  };
};

module.exports = {
  findEdges,
  calculateMetrics
};
