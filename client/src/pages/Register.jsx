import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
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

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { user, registerUser } = useAuth();

  React.useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

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
      navigate('/onboarding', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t create your account right now — please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Begin your journey" subtitle="A space for clarity, growth, and honest reflection.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="name" className="block text-xs font-bold text-foreground mb-1.5">Your name</label>
          <input id="name" type="text" placeholder="Alex Morgan" {...register('name')} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          {errors.name && <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-foreground mb-1.5">Email</label>
          <input id="email" type="email" placeholder="name@example.com" {...register('email')} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
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
          className="flex w-full justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 shadow-md shadow-emerald-500/20"
        >
          {isLoading ? 'Preparing your space...' : 'Create My Sanctuary'}
        </button>

        <p className="text-center text-[11px] leading-5 text-muted">
          By creating an account, you agree to the JAHZJOURNALS{' '}
          <Link to="/terms" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline">Terms of Service</Link>{' '}
          and acknowledge the{' '}
          <Link to="/privacy" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline">Privacy Policy</Link>.
        </p>

        <p className="text-center text-xs text-muted">
          Already part of the journey?{' '}
          <Link to="/login" className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
