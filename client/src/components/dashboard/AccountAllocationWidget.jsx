import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ArrowUpRight, CheckCircle2, Shield, RefreshCw } from 'lucide-react';
import { DashboardCard, CardHeader } from './DashboardShell';
import { formatCurrency, formatPercent } from '../../utils/dashboard';

const AccountAllocationWidget = ({ accounts = [], currency = 'USD', className = '' }) => {
  if (!accounts || accounts.length === 0) return null;

  return (
    <DashboardCard className={`p-5 ${className}`}>
      <CardHeader 
        title="Trading Capital & Accounts" 
        eyebrow="Connected portfolios & cloud sync"
        action={(
          <Link 
            to="/accounts" 
            className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:border-emerald-500/40 hover:text-foreground transition"
          >
            Manage Accounts <ArrowUpRight size={13} />
          </Link>
        )}
      />

      <div className="space-y-3">
        {accounts.map((acc) => {
          const start = Number(acc.startingBalance || 0);
          const current = Number(acc.currentBalance || 0);
          const diff = current - start;
          const pct = start > 0 ? (diff / start) * 100 : 0;
          const isProfitable = diff >= 0;

          return (
            <div 
              key={acc.id} 
              className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-background/50 hover:bg-background/80 transition"
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Wallet size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{acc.name}</p>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-muted border border-border text-muted font-mono">
                      {acc.currency || currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted">
                      Start: {formatCurrency(start, acc.currency || currency)}
                    </span>
                    {acc.isPropFirmAccount && (
                      <span className="text-[10px] text-amber-400 font-medium flex items-center gap-0.5">
                        <Shield size={10} /> Prop Firm
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-foreground">
                  {formatCurrency(current, acc.currency || currency)}
                </p>
                <p className={`text-[11px] font-semibold mt-0.5 ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isProfitable ? '+' : ''}{formatPercent(pct)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
};

export default AccountAllocationWidget;
