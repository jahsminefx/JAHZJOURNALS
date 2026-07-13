import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/useAuth';

const Onboarding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { register, handleSubmit } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await api.put('/users/profile', {
        country: data.country,
        tradingExperience: data.experience,
        mainSession: data.mainSession,
        tradingStyle: data.tradingStyle,
        mainTradingPairs: data.mainPairs,
        onboardingCompleted: true,
      });
      await refreshUser();
      toast.success('Onboarding complete!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We hit a snag saving your profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8 text-foreground font-sans">
      <div className="max-w-2xl mx-auto bg-surface-muted p-8 rounded-xl shadow-lg border border-border">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-green-400">Welcome to your Sanctuary</h2>
          <p className="mt-2 text-muted text-sm">Let's set up your trading profile, so we can better protect and grow your edge.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <label className="block text-sm font-medium text-muted">Country</label>
              <input type="text" {...register('country')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-green-500 shadow-sm" placeholder="e.g. Nigeria" />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted">Experience Level</label>
              <select {...register('experience')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-green-500 shadow-sm text-muted">
                <option value="beginner">Beginner (&lt; 1 year)</option>
                <option value="intermediate">Intermediate (1-3 years)</option>
                <option value="advanced">Advanced (3+ years)</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted">Main Session</label>
              <select {...register('mainSession')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-green-500 shadow-sm text-muted">
                <option value="london">London</option>
                <option value="new_york">New York</option>
                <option value="asian">Asian</option>
                <option value="overlap">London/NY Overlap</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted">Trading Style</label>
              <select {...register('tradingStyle')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-green-500 shadow-sm text-muted">
                <option value="scalping">Scalping</option>
                <option value="day_trading">Day Trading</option>
                <option value="swing_trading">Swing Trading</option>
                <option value="position">Position Trading</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted">Main Pairs/Instruments</label>
              <input type="text" {...register('mainPairs')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-green-500 shadow-sm" placeholder="e.g. XAUUSD, NAS100, EURUSD" />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted">Average Risk Per Trade (%)</label>
              <input type="number" step="0.1" {...register('riskPerTrade')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-green-500 shadow-sm" placeholder="e.g. 1.0" />
            </div>

          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-gray-900 bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              {isLoading ? 'Preparing your space...' : 'Complete Setup & Enter Sanctuary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
