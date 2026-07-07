import React from 'react';

const TestimonialCard = ({ quote, name, role }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
    <p className="text-sm leading-6 text-gray-300">"{quote}"</p>
    <div className="mt-5">
      <p className="font-semibold text-white">{name}</p>
      <p className="text-sm text-gray-500">{role}</p>
    </div>
  </div>
);

export default TestimonialCard;
