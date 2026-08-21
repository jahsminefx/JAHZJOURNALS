import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthLayout from '../components/AuthLayout';

const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  code: z.string().min(6, { message: 'Reset code must be 6 digits' }).max(10, { message: 'Code is too long' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters' }),
  confirmPassword: z.string().min(8, { message: 'Confirm password must be at least 8 characters' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const initialEmail = searchParams.get('email') || '';
  const initialCode = searchParams.get('code') || searchParams.get('token') || '';

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialEmail,
      code: initialCode,
      newPassword: '',
      confirmPassword: '',
    }
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', {
        email: data.email,
        code: data.code.trim().replace(/\s+/g, ''),
        password: data.newPassword,
        newPassword: data.newPassword,
      });
      setIsSuccess(true);
      toast.success('Password updated successfully! Please sign in.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password. Check your code and email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Set New Password" subtitle="Enter your 6-digit reset code and your new password.">
      {isSuccess ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Password Changed!</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 px-4 bg-emerald-400 hover:bg-emerald-300 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-muted mb-1">Account Email</label>
            <input
              id="email"
              type="email"
              placeholder="anintajahsmine@gmail.com"
              {...register('email')}
              className="w-full rounded-xl border border-border dark:border-white/10 bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-emerald-400"
            />
            {errors.email && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="code" className="block text-xs font-semibold text-muted mb-1">6-Digit Reset Code</label>
            <div className="relative">
              <input
                id="code"
                type="text"
                maxLength={8}
                placeholder="e.g. 482910"
                {...register('code')}
                className="w-full rounded-xl border border-border dark:border-white/10 bg-background px-4 py-3 font-mono text-base font-bold tracking-widest text-emerald-400 outline-none transition focus:border-emerald-400 placeholder:text-muted/40 placeholder:font-normal placeholder:tracking-normal"
              />
              <ShieldCheck size={20} className="absolute right-3.5 top-3.5 text-emerald-500/70 pointer-events-none" />
            </div>
            {errors.code && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.code.message}</p>}
          </div>

          {/* New Password with Visibility Toggle */}
          <div>
            <label htmlFor="newPassword" className="block text-xs font-semibold text-muted mb-1">New Password (min 8 chars)</label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                {...register('newPassword')}
                className="w-full rounded-xl border border-border dark:border-white/10 bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none transition focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-1 text-muted hover:text-foreground transition-all"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm Password with Visibility Toggle */}
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-muted mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                {...register('confirmPassword')}
                className="w-full rounded-xl border border-border dark:border-white/10 bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none transition focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 p-1 text-muted hover:text-foreground transition-all"
                title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 justify-center rounded-xl bg-emerald-400 px-5 py-3.5 text-xs font-bold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? 'Updating Password...' : 'Save New Password'}
          </button>

          <div className="text-center pt-2">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-foreground transition-all">
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
