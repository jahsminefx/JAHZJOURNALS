import React from 'react';
import { Lightbulb, TrendingUp, ShieldCheck, Flame, Zap, ArrowUpRight } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatPercent, formatProfitFactor, formatCurrency } from '../../utils/dashboard';

const TradingInsightsCard = ({ dashboard = {}, currency = 'USD', className = '' }) => {
  const summary = dashboard.summary || {};
  const sessions = dashboard.sessionPerformance || [];
  const topPairs = dashboard.topPairs || [];
  const breakdown = dashboard.performanceBreakdown || {};

  const strongestSession = sessions.find((s) => s.isStrongest) || sessions[0];
  const bestPair = topPairs[0];
  
  const avgWin = Number(breakdown.averageWin || 0);
  const avgLoss = Math.abs(Number(breakdown.averageLoss || 0));
  const rrRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A';

  const winRate = Number(summary.winRate || 0);
  const profitFactor = Number(summary.profitFactor || 0);

  // Generate dynamic contextual insight
  let insightText = "Maintain your trading discipline and strictly adhere to your risk-per-trade guidelines.";
  let insightTone = "indigo";

  if (profitFactor >= 2.0 && winRate >= 50) {
    insightText = `Outstanding execution. Your ${strongestSession ? strongestSession.label + ' session' : 'primary strategy'} is generating high alpha. Focus on scaling your winners.`;
    insightTone = "emerald";
  } else if (winRate >= 50 && avgWin < avgLoss) {
    insightText = `Good win rate (${formatPercent(winRate)}), but your average loss exceeds your average win. Let your winning trades run to hit full 1:2+ R:R.`;
    insightTone = "amber";
  } else if (winRate < 45 && profitFactor >= 1.5) {
    insightText = `Excellent asymmetric risk-reward (${rrRatio}:1). Even with a ${formatPercent(winRate)} win rate, your profitable setups carry your overall edge.`;
    insightTone = "emerald";
  } else if (strongestSession && strongestSession.percentage > 40) {
    insightText = `${strongestSession.label} session is your statistical powerhouse (${formatPercent(strongestSession.winRate)} WR). Prioritize setups during this window.`;
    insightTone = "indigo";
  }

  return (
    <DashboardCard className={`p-4 ${className}`}>
      <CardHeader 
        title="Executive Trading Insights" 
        eyebrow="Algorithmic edge assessment" 
      />

      {/* AI Key Insight Banner */}
      <div className={`mb-3 rounded-xl border p-2.5 flex items-start gap-2.5 ${
        insightTone === 'emerald'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : insightTone === 'amber'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
      }`}>
        <div className="shrink-0 mt-0.5">
          <Lightbulb size={16} className={
            insightTone === 'emerald' ? 'text-emerald-400' : insightTone === 'amber' ? 'text-amber-400' : 'text-indigo-400'
          } />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/80 mb-0.5">Key Takeaway</p>
          <p className="text-xs leading-snug text-foreground/90 font-medium">{insightText}</p>
        </div>
      </div>

      {/* Grid of Micro Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[10px] font-medium">Session Edge</span>
            <Zap size={13} className="text-amber-400" />
          </div>
          <p className="text-xs font-bold text-foreground truncate">
            {strongestSession ? strongestSession.label : 'Accumulating'}
          </p>
          <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
            {strongestSession ? `${formatPercent(strongestSession.winRate)} WR` : 'Log trades'}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[10px] font-medium">Top Asset Edge</span>
            <TrendingUp size={13} className="text-emerald-400" />
          </div>
          <p className="text-xs font-bold text-foreground truncate">
            {bestPair ? bestPair.pair : 'Diversified'}
          </p>
          <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
            {bestPair ? `${formatCurrency(bestPair.netProfitLoss, currency)} net` : 'Awaiting'}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[10px] font-medium">Realized R:R</span>
            <ShieldCheck size={13} className="text-indigo-400" />
          </div>
          <p className="text-xs font-bold text-foreground">
            {rrRatio !== 'N/A' ? `1 : ${rrRatio}` : 'N/A'}
          </p>
          <p className="text-[10px] text-muted font-medium mt-0.5">Avg Win / Loss</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[10px] font-medium">Profit Factor</span>
            <Flame size={13} className="text-rose-400" />
          </div>
          <p className="text-xs font-bold text-foreground">
            {formatProfitFactor(profitFactor)}
          </p>
          <p className={`text-[10px] font-semibold mt-0.5 ${profitFactor >= 1.5 ? 'text-emerald-400' : 'text-muted'}`}>
            {profitFactor >= 2 ? 'Elite Edge' : profitFactor >= 1.2 ? 'Profitable' : 'Refining'}
          </p>
        </div>
      </div>
    </DashboardCard>
  );
};

export default TradingInsightsCard;
