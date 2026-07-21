import React from 'react';

const TestimonialCard = ({ quote, name, role }) => (
  <div className="rounded-xl border border-border bg-surface dark:border-white/10 dark:bg-white/[0.04] p-5 shadow-sm dark:shadow-none">
    <p className="text-sm leading-6 text-muted">"{quote}"</p>
    <div className="mt-5">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-sm text-gray-500">{role}</p>
    </div>
  </div>
);

export default TestimonialCard;
