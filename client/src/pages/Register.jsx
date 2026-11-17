import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import AuthLayout from '../components/AuthLayout';

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Your name needs at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Your password needs at least 6 characters' }),
  confirmPassword: z.string().min(6, { message: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Those passwords don\'t quite match — try again',
  path: ['confirmPassword'],
});

const RegisterReassurance = ({ isMobile = false }) => (
  <div className={`space-y-6 ${isMobile ? 'mb-6 p-4 rounded-2xl border border-border bg-surface-muted/40' : 'text-slate-100'}`}>
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
        Start Free
      </p>
      <h2 className={`font-black text-foreground ${isMobile ? 'text-lg mt-1' : 'text-2xl sm:text-3xl mt-2 text-white'}`}>
        Review your trading with structure.
      </h2>
      <p className={`mt-2 text-xs sm:text-sm leading-relaxed ${isMobile ? 'text-muted' : 'text-slate-300'}`}>
        A structured journal designed to help you track setups, review execution, and build discipline over time.
      </p>
    </div>

    {/* Exact Reassurance Points */}
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        <span className={isMobile ? 'text-foreground' : 'text-white'}>Free forever · no card required</span>
      </div>
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        <span className={isMobile ? 'text-foreground' : 'text-white'}>Log up to 20 trades/month</span>
      </div>
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
        <Clock size={16} className="text-emerald-400 shrink-0" />
        <span className={isMobile ? 'text-foreground' : 'text-white'}>Takes about 2 minutes</span>
      </div>
    </div>

    {/* What Happens Next Sequence */}
    <div className={`pt-4 border-t ${isMobile ? 'border-border' : 'border-white/10'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider mb-3 ${isMobile ? 'text-muted' : 'text-slate-400'}`}>
        What happens next
      </p>
      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
            1
          </span>
          <div className="text-xs">
            <span className={`font-bold ${isMobile ? 'text-foreground' : 'text-white'}`}>Create your account</span>
            <p className={isMobile ? 'text-muted' : 'text-slate-400'}>Enter your name and email to set up your private journal.</p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
            2
          </span>
          <div className="text-xs">
            <span className={`font-bold ${isMobile ? 'text-foreground' : 'text-white'}`}>Log your first trade</span>
            <p className={isMobile ? 'text-muted' : 'text-slate-400'}>Record pair, direction, entry, stop loss, and chart screenshots.</p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
            3
          </span>
          <div className="text-xs">
            <span className={`font-bold ${isMobile ? 'text-foreground' : 'text-white'}`}>Get your first review</span>
            <p className={isMobile ? 'text-muted' : 'text-slate-400'}>Inspect your discipline score, risk execution, and trade metrics.</p>
          </div>
        </li>
      </ol>
    </div>

    <p className={`text-[11px] leading-relaxed ${isMobile ? 'text-muted/80' : 'text-slate-400/90'}`}>
      Built for structured journaling and discipline review. Not financial advice.
    </p>
  </div>
);

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { user, registerUser } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const promoParam = searchParams.get('promo') || searchParams.get('code');
  const planParam = searchParams.get('plan')?.toLowerCase();
  const rawRedirect = searchParams.get('redirect') || '';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '';

  React.useEffect(() => {
    if (user) {
      if (safeRedirect) {
        navigate(safeRedirect, { replace: true });
      } else if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate, safeRedirect]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const payload = {
        name: data.name,
        email: data.email,
        password: data.password,
      };
      await registerUser(payload);
      toast.success('Your sanctuary is ready. Let\'s begin.');
      if (safeRedirect) {
        navigate(safeRedirect, { replace: true });
      } else if (promoParam) {
        navigate(`/pricing?promo=${encodeURIComponent(promoParam)}`, { replace: true });
      } else if (planParam === 'starter' || planParam === 'pro') {
        navigate(`/pricing?plan=${encodeURIComponent(planParam)}`, { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t create your account right now — please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanBadge = () => {
    if (planParam === 'starter') {
      return (
        <div className="mb-4 p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-bold flex items-center justify-between gap-2">
          <span>Selected Plan: <strong>Starter (₦4,000/mo)</strong></span>
          <span className="text-[11px] font-normal text-muted">Complete after account setup</span>
        </div>
      );
    }
    if (planParam === 'pro') {
      return (
        <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-between gap-2">
          <span>Selected Plan: <strong>Pro (₦8,500/mo)</strong></span>
          <span className="text-[11px] font-normal text-muted">Complete after account setup</span>
        </div>
      );
    }
    return null;
  };

  return (
    <AuthLayout
      title="Begin your journey"
      subtitle="A space for clarity, growth, and honest reflection."
      backTo="/"
      sidePanel={<RegisterReassurance />}
    >
      {promoParam && (
        <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <span>🔥</span>
          <span>
            Special Offer: <strong>{promoParam.toUpperCase()}</strong> active! Create your account to claim your discount.
          </span>
        </div>
      )}

      {getPlanBadge()}

      {/* Mobile-only Reassurance Flow */}
      <div className="block lg:hidden">
        <RegisterReassurance isMobile />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="name" className="block text-xs font-bold text-foreground mb-1.5">Your name</label>
          <input
            id="name"
            type="text"
            placeholder="Alex Morgan"
            {...register('name')}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          {errors.name && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-foreground mb-1.5">Email</label>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            {...register('email')}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          {errors.email && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.email.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="block text-xs font-bold text-foreground mb-1.5">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 chars"
                {...register('password')}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-3 p-1 text-muted hover:text-foreground transition-all"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-bold text-foreground mb-1.5">Confirm password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                {...register('confirmPassword')}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-3 p-1 text-muted hover:text-foreground transition-all"
                title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          {isLoading ? 'Preparing your space...' : 'Create Free Account'}
        </button>

        <p className="text-center text-[11px] leading-5 text-muted">
          By creating an account, you agree to the JAHZJOURNALS{' '}
          <Link to="/terms" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline">Terms of Service</Link>{' '}
          and acknowledge the{' '}
          <Link to="/privacy" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline">Privacy Policy</Link>.
        </p>

        <p className="text-center text-xs text-muted">
          Already part of the journey?{' '}
          <Link to={safeRedirect ? `/login?redirect=${encodeURIComponent(safeRedirect)}` : '/login'} className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
