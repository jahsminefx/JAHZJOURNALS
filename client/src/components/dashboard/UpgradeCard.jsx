import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const topPlans = new Set(['PRO', 'MENTOR']);

const UpgradeCard = ({ compact = false }) => {
  const { user } = useAuth();
  const plan = String(user?.subscriptionPlan || 'FREE').toUpperCase();

  if (topPlans.has(plan)) return null;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/10 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-500/10 blur-xl" />
      <div className="relative">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 size={20} />
        </div>
        <p className="font-bold text-foreground">Upgrade Your Edge</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">Unlock advanced analytics, custom reports, AI reviews and more.</p>
        <Link to="/pricing" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <Sparkles size={15} />
          Upgrade Plan
        </Link>
      </div>
    </div>
  );
};

export default UpgradeCard;
