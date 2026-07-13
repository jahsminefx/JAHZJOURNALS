import React from 'react';
import Button from './Button';

const CTASection = ({
  title = 'Build discipline. Discover your edge. Journal every trade.',
  description = 'Start with structured logging, screenshots, and analytics built for serious forex traders.',
  cta = 'Start Free Today',
}) => (
  <section className="px-4 py-16 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/15 via-cyan-400/8 to-white/[0.03] p-8 text-center sm:p-12">
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
      <Button to="/register" size="lg" className="mt-8 w-full sm:w-auto">
        {cta}
      </Button>
    </div>
  </section>
);

export default CTASection;
