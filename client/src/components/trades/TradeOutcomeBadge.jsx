import React from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, MinusCircle, AlertCircle } from 'lucide-react';

/**
 * Renders a consistent, accessible trade outcome badge supporting
 * WIN, LOSS, BREAKEVEN, and Break-Even Management indicators
 * (e.g. "Small win · BE protected", "BE Protected", "Break-Even").
 */
const TradeOutcomeBadge = ({ trade = {}, size = 'md', showManagementHint = true, ...rest }) => {
  const target = (trade && typeof trade === 'object' && (trade.result || trade.status || trade.profitLossAmount !== undefined))
    ? trade
    : rest;
  const result = String(target.result || target.status || 'OPEN').toUpperCase();
  const isBeProtected = Boolean(target.breakEvenActivated);
  const pnl = Number(target.profitLossAmount || 0);

  let badgeColor = 'bg-surface-muted text-muted border border-border';
  let label = result;
  let Icon = null;

  if (result === 'BREAKEVEN') {
    badgeColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    label = isBeProtected ? 'BE Protected' : 'Break-Even';
    Icon = MinusCircle;
  } else if (result === 'WIN') {
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (isBeProtected && pnl <= 5.00) {
      label = 'Small Win · BE';
    } else if (isBeProtected) {
      label = 'Win · BE';
    } else {
      label = 'Win';
    }
    Icon = CheckCircle2;
  } else if (result === 'LOSS') {
    badgeColor = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    if (isBeProtected && Math.abs(pnl) <= 5.00) {
      label = 'Small Loss · BE';
    } else if (isBeProtected) {
      label = 'Loss · BE';
    } else {
      label = 'Loss';
    }
    Icon = AlertCircle;
  } else if (result === 'OPEN' || trade.status === 'ACTIVE') {
    badgeColor = 'bg-blue-500/15 text-blue-400 border border-blue-500/25';
    label = trade.status === 'ACTIVE' ? 'Active' : 'Open';
  } else if (trade.status === 'PLANNED') {
    badgeColor = 'bg-purple-500/15 text-purple-400 border border-purple-500/25';
    label = 'Planned';
  }

  const sizeCls = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px]' 
    : size === 'lg' 
    ? 'px-3.5 py-1.5 text-sm' 
    : 'px-2.5 py-1 text-xs';

  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider ${sizeCls} ${badgeColor}`}
      title={isBeProtected ? `Break-even protection was activated (${trade.breakEvenEvidenceSource || 'User confirmed'})` : undefined}
    >
      {isBeProtected && showManagementHint ? (
        <ShieldCheck size={size === 'sm' ? 10 : 13} className="shrink-0 text-amber-400" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 10 : 12} className="shrink-0 opacity-80" />
      ) : null}
      <span>{label}</span>
    </span>
  );
};

export default TradeOutcomeBadge;
