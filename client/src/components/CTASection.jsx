import React from 'react';
import Button from './Button';
import { useAuth } from '../context/useAuth';
import { Reveal } from './motion/MotionSystem';

const CTASection = ({
  title = 'Build discipline. Discover your edge. Journal every trade.',
  description = 'Start with structured logging, screenshots, and analytics built for serious forex traders.',
  cta = 'Start Free Today',
  to,
}) => {
  const { user } = useAuth();
  const destination = to || (user ? '/dashboard' : '/register');
  const buttonText = !to && user && (cta === 'Start Free Today' || cta === 'Start Journaling Free') ? 'Go to Dashboard' : cta;

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <Reveal direction="up" scale={0.98} duration={640}>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/15 via-cyan-400/8 to-transparent dark:to-white/[0.03] p-8 text-center sm:p-12 transition-colors duration-300 hover:border-emerald-400/35">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-emerald-400/10 blur-3xl"
          />
          <h2 className="relative text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
          <div className="relative">
            <Button to={destination} size="lg" className="mt-8 w-full sm:w-auto">
              {buttonText}
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
};

export default CTASection;
