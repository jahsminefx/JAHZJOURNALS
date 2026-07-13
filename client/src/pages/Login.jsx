import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import AuthLayout from '../components/AuthLayout';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Your password needs at least 6 characters' }),
});

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const user = await login(data);
      toast.success('Welcome back — let\'s review.');
      navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
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
          <label htmlFor="email" className="block text-sm font-medium text-muted">Email</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-emerald-400"
          />
          {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-muted">Password</label>
            <span className="text-xs text-muted">Forgot password?</span>
          </div>
          <input
            id="password"
            type="password"
            {...register('password')}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-emerald-400"
          />
          {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-lg bg-emerald-400 px-5 py-3 font-bold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? 'Signing you in...' : 'Step Inside'}
        </button>

        <p className="text-center text-sm text-muted">
          New here?{' '}
          <Link to="/register" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Create your sanctuary
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
