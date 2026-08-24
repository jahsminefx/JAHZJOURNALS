import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AuthLayout from '../components/AuthLayout';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email: data.email });
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toast.success('6-digit reset code sent to your email.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request password reset. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset Your Password" subtitle="Enter your email to receive a 6-digit verification code.">
      {isSubmitted ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Check Your Email</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed max-w-sm mx-auto">
              We've sent a 6-digit verification code to <strong className="text-foreground">{submittedEmail}</strong>.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <Link
              to={`/reset-password?email=${encodeURIComponent(submittedEmail)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3.5 text-xs font-bold text-gray-950 transition hover:bg-emerald-300 shadow-lg shadow-emerald-500/20"
            >
              <ShieldCheck size={18} />
              Enter 6-Digit Code
            </Link>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-xs font-bold text-muted hover:text-foreground transition-all pt-2"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-muted mb-1">Account Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              {...register('email')}
              className="w-full rounded-xl border border-border dark:border-white/10 bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-emerald-400"
            />
            {errors.email && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-xl bg-emerald-400 px-5 py-3.5 text-xs font-bold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? 'Sending Request...' : 'Send 6-Digit Reset Code'}
          </button>

          <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border/60">
            <Link to="/login" className="flex items-center gap-1.5 font-bold hover:text-foreground transition-all">
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
            <Link to="/reset-password" className="font-bold text-emerald-400 hover:underline">
              Already have a code?
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
