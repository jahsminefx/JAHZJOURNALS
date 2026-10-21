import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const AccountTypeCard = ({ icon: Icon, title, description, to, action }) => (
  <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 transition-all duration-200 hover:border-border-strong hover:shadow-sm">
    <div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted border border-border text-emerald-500">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 text-xs text-muted leading-relaxed">{description}</p>
    </div>
    <div className="pt-6">
      <Link
        to={to}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99] shadow-sm shadow-emerald-500/10"
      >
        <span>{action}</span>
        <ArrowRight size={14} />
      </Link>
    </div>
  </div>
);

export default AccountTypeCard;
