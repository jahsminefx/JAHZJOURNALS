import React from 'react';

const PropFirmStepIndicator = ({ steps, currentStep }) => (
  <div className="grid gap-3 sm:grid-cols-4">
    {steps.map((step, index) => {
      const isActive = index === currentStep;
      const isComplete = index < currentStep;

      return (
        <div key={step} className={`rounded-xl border p-3 ${isActive ? 'border-green-400 bg-green-500/10' : isComplete ? 'border-green-500/30 bg-gray-900' : 'border-gray-700 bg-gray-900'}`}>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isActive || isComplete ? 'text-green-400' : 'text-gray-500'}`}>Step {index + 1}</p>
          <p className="mt-1 text-sm font-semibold text-gray-100">{step}</p>
        </div>
      );
    })}
  </div>
);

export default PropFirmStepIndicator;
