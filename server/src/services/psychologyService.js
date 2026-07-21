const detectRevengeTrading = (trades) => {
  let incidents = 0;
  // Sort chronologically
  const sortedTrades = [...trades].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime));
  
  for (let i = 0; i < sortedTrades.length - 1; i++) {
    const trade1 = sortedTrades[i];
    const trade2 = sortedTrades[i + 1];
    
    if (trade1.result === 'LOSS' && trade2.result === 'LOSS') {
      const diffMs = new Date(trade2.entryTime) - new Date(trade1.exitTime || trade1.entryTime);
      const diffMins = diffMs / 60000;
      
      // If entered another trade within 30 mins of a loss, and risked more
      if (diffMins < 30 && trade2.riskAmount > (trade1.riskAmount || 0)) {
        incidents++;
      }
    }
  }
  return incidents;
};

const detectCuttingWinnersShort = (trades) => {
  const wins = trades.filter(t => t.result === 'WIN' && t.profitLossAmount > 0);
  const losses = trades.filter(t => t.result === 'LOSS' && t.profitLossAmount < 0);
  
  if (wins.length === 0 || losses.length === 0) return false;
  
  const avgWin = wins.reduce((acc, t) => acc + t.profitLossAmount, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((acc, t) => acc + t.profitLossAmount, 0) / losses.length);
  
  // If absolute average loss is significantly higher than average win, and win rate is decent
  return avgLoss > (avgWin * 1.5);
};

const analyzeTradingPatterns = (trades) => {
  const patterns = [];
  
  if (!trades || trades.length < 3) return patterns;
  
  const revengeIncidents = detectRevengeTrading(trades);
  if (revengeIncidents > 0) {
    patterns.push(`Detected potential "Revenge Trading" behavior: Increased risk immediately after a loss on ${revengeIncidents} occasion(s).`);
  }
  
  if (detectCuttingWinnersShort(trades)) {
    patterns.push(`Detected potential skewed risk asymmetry: Average losses are significantly larger than average wins, indicating you may be cutting winning trades prematurely while letting losing trades run.`);
  }

  return patterns;
};

module.exports = {
  analyzeTradingPatterns
};
