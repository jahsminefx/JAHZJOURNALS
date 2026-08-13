import React from 'react';
import Button from './Button';
import { useAuth } from '../context/useAuth';

const CTASection = ({
  title = 'Build discipline. Discover your edge. Journal every trade.',
  description = 'Start with structured logging, screenshots, and analytics built for serious forex traders.',
  cta = 'Start Free Today',
  to,
}) => {
  const { user } = useAuth();
  const destination = to || (user ? '/dashboard' : '/register');
  const buttonText = user && (cta === 'Start Free Today' || cta === 'Start Journaling Free') ? 'Go to Dashboard' : cta;

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/15 via-cyan-400/8 to-transparent dark:to-white/[0.03] p-8 text-center sm:p-12">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
        <Button to={destination} size="lg" className="mt-8 w-full sm:w-auto">
          {buttonText}
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
