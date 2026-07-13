import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { registerUser } = useAuth();

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
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-muted">Your name</label>
          <input id="name" type="text" {...register('name')} className="mt-2 block w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-emerald-400" />
          {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-muted">Email</label>
          <input id="email" type="email" {...register('email')} className="mt-2 block w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-emerald-400" />
          {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted">Password</label>
            <input id="password" type="password" {...register('password')} className="mt-2 block w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-emerald-400" />
            {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted">Confirm password</label>
            <input id="confirmPassword" type="password" {...register('confirmPassword')} className="mt-2 block w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-emerald-400" />
            {errors.confirmPassword && <p className="mt-2 text-sm text-red-400">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-lg bg-emerald-400 px-5 py-3 font-bold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? 'Preparing your space...' : 'Create My Sanctuary'}
        </button>

        <p className="text-center text-sm text-muted">
          Already part of the journey?{' '}
          <Link to="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
