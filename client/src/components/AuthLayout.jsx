import React from 'react';
import BrandLogo from './BrandLogo';
import authTradingBg from '../assets/auth-trading-bg.jpg';

const AuthLayout = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.16),transparent_34%),linear-gradient(180deg,#020617,#111827_72%,#020617)]" />
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
      <div className="grid w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl lg:grid-cols-[1fr_0.9fr]">
        <div className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center opacity-95 blur-[1px]"
            style={{ backgroundImage: `url(${authTradingBg})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-background/25" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/55 via-slate-950/30 to-slate-950/65" aria-hidden="true" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(52,211,153,0.16),transparent_38%)]" aria-hidden="true" />

          <BrandLogo size="md" className="relative z-10" />
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Your trading sanctuary</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
              Clarity begins with honest reflection.
            </h2>
            <p className="mt-4 text-muted">
              Your journal, your charts, your emotions, your growth — all in one sacred space.
            </p>
          </div>
          <p className="relative z-10 text-sm text-muted">Not signals. Not hype. Just honest, structured self-review.</p>
        </div>
        <div className="p-6 sm:p-8 lg:p-10">
          <BrandLogo className="mb-8 lg:hidden" />
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  </div>
);

export default AuthLayout;
