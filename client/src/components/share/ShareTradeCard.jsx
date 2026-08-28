import React from 'react';
import BrandLogo from '../BrandLogo';

export default function ShareTradeCard({ trade, cardRef }) {
  if (!trade) return null;

  const isWin = trade.result === 'WIN';
  const isLoss = trade.result === 'LOSS';

  const formatCurrency = (amount, currencyStr) => {
    const symbol = currencyStr === 'NGN' ? '₦' : currencyStr === 'GBP' ? '£' : currencyStr === 'EUR' ? '€' : '$';
    const num = Number(amount || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${symbol}${Math.abs(num).toLocaleString()} ${currencyStr || 'USD'}`;
  };

  const getPips = (t) => {
    if (t.pips !== null && t.pips !== undefined && !isNaN(Number(t.pips))) {
      return Number(t.pips);
    }
    const entry = Number(t.entryPrice);
    const exit = Number(t.exitPrice);
    if (!entry || !exit || !t.pair || !t.direction) return null;

    const pairStr = String(t.pair).toUpperCase().trim();
    let pipSize = 0.0001;
    if (pairStr.includes('JPY')) pipSize = 0.01;
    else if (pairStr.startsWith('XAU') || pairStr.includes('GOLD')) pipSize = 0.1;
    else if (pairStr.startsWith('XAG') || pairStr.includes('SILVER')) pipSize = 0.01;
    else if (['BTC', 'ETH', 'US30', 'NAS100', 'SPX', 'GER30', 'DE30', 'UK100', 'US500'].some(k => pairStr.includes(k))) pipSize = 1.0;

    const diff = String(t.direction).toUpperCase().trim() === 'BUY' ? exit - entry : entry - exit;
    return Math.round((diff / pipSize) * 10) / 10;
  };

  const pipsVal = getPips(trade);

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[600px] bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 font-sans relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      }}
    >
      {/* Decorative ambient glow */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-25 ${isWin ? 'bg-emerald-500' : isLoss ? 'bg-rose-500' : 'bg-amber-500'}`} />
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5 relative z-10">
        <div>
          <BrandLogo size="sm" to={null} />
          <p className="text-[10px] text-indigo-300 font-medium tracking-wide mt-1">VERIFIED TRADE RESULT</p>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
          isLoss ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
          'bg-amber-500/20 text-amber-400 border border-amber-500/40'
        }`}>
          {trade.result || 'CLOSED'}
        </span>
      </div>

      {/* Main Trade Details */}
      <div className="grid grid-cols-2 gap-4 mb-5 relative z-10">
        <div>
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block mb-1">Instrument</span>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-black tracking-tight text-white">{trade.pair}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
              trade.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {trade.direction}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block mb-1">Profit / Loss</span>
          <span className={`text-2xl font-black tracking-tight ${
            trade.profitLossAmount > 0 ? 'text-emerald-400' : trade.profitLossAmount < 0 ? 'text-rose-400' : 'text-slate-300'
          }`}>
            {formatCurrency(trade.profitLossAmount, trade.currency)}
          </span>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 mb-5 relative z-10 text-center">
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase block">Pips</span>
          <span className="text-sm font-bold text-slate-200">{pipsVal !== null && pipsVal !== undefined ? `${pipsVal > 0 ? '+' : ''}${pipsVal}` : '—'}</span>
        </div>
        <div className="border-x border-slate-800">
          <span className="text-[10px] text-slate-400 font-medium uppercase block">Risk : Reward</span>
          <span className="text-sm font-bold text-slate-200">{trade.riskRewardRatio ? `1:${trade.riskRewardRatio}` : '—'}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase block">Session</span>
          <span className="text-sm font-bold text-slate-200">{trade.session || '—'}</span>
        </div>
      </div>

      {/* Screenshot Preview if available */}
      {trade.screenshotUrl && (
        <div className="mb-5 relative z-10 rounded-xl overflow-hidden border border-slate-800 max-h-48">
          <img src={trade.screenshotUrl} alt="Trade Screenshot" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Footer CTA Branding */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 relative z-10 text-[11px] text-slate-400">
        <span className="font-medium text-slate-400">Tracked with JAHZJOURNALS</span>
        <span className="text-indigo-400 font-semibold">jahzjournal.com</span>
      </div>
    </div>
  );
}
