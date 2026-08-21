import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import AuthLayout from '../components/AuthLayout';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Your password needs at least 6 characters' }),
});

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user, login } = useAuth();

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
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const user = await login(data);
      toast.success('Welcome back — let\'s review.');
      
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t sign you in. Check your details and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Your journal is waiting. Pick up where you left off.">
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-muted mb-1">Email</label>
          <input
            id="email"
            type="email"
            placeholder="yourname@domain.com"
            {...register('email')}
            className="w-full rounded-xl border border-border dark:border-white/10 bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-emerald-400"
          />
          {errors.email && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-xs font-semibold text-muted">Password</label>
            <Link to="/forgot-password" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
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
          {errors.password && <p className="mt-1.5 text-xs font-semibold text-rose-400">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-xl bg-emerald-400 px-5 py-3.5 text-xs font-bold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-emerald-500/20"
        >
          {isLoading ? 'Signing you in...' : 'Step Inside'}
        </button>

        <p className="text-center text-xs text-muted">
          New here?{' '}
          <Link to="/register" className="font-bold text-emerald-400 hover:text-emerald-300">
            Create your sanctuary
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
