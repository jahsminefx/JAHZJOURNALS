import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrandLogo from './BrandLogo';
import authTradingBg from '../assets/auth-trading-bg.jpg';

const AuthLayout = ({ title, subtitle, backTo, backLabel, showBack = true, children }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.12),transparent_40%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl lg:grid-cols-[1fr_0.9fr]">
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">Your trading sanctuary</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-white leading-tight">
                Clarity begins with honest reflection.
              </h2>
              <p className="mt-4 text-sm font-medium text-slate-200 leading-relaxed">
                Your journal, your charts, your emotions, your growth — all in one sacred space.
              </p>
            </div>
            <p className="relative z-10 text-xs font-semibold text-slate-300">Not signals. Not hype. Just honest, structured self-review.</p>
          </div>
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between">
              {showBack && (
                backTo ? (
                  <Link
                    to={backTo}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-1.5 text-xs font-bold text-muted hover:border-emerald-500/40 hover:bg-surface-muted hover:text-foreground transition-all group shadow-sm"
                  >
                    <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                    <span>{backLabel || 'Back'}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-1.5 text-xs font-bold text-muted hover:border-emerald-500/40 hover:bg-surface-muted hover:text-foreground transition-all group shadow-sm"
                  >
                    <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                    <span>{backLabel || 'Back'}</span>
                  </button>
                )
              )}
              <BrandLogo className="lg:hidden" size="sm" />
            </div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">{title}</h1>
              <p className="mt-2 text-sm text-muted">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
