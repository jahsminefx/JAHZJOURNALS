import React from 'react';

const TradeReflectionReview = ({ register }) => {
  return (
    <section className="bg-surface-muted p-6 rounded-xl border border-border space-y-4">
      <h3 className="text-lg font-medium text-green-400">Notes & Reflection</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <label className="text-sm text-muted">
          Why did you enter this trade? (Thesis)
          <textarea rows="3" {...register('entryReason')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
        </label>
        <label className="text-sm text-muted">
          Why did you exit?
          <textarea rows="3" {...register('exitReason')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
        </label>
        <label className="text-sm text-muted">
          Pre-trade Notes (Feelings/Thoughts)
          <textarea rows="3" {...register('notesBefore')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
        </label>
        <label className="text-sm text-muted">
          Post-trade Reflection (What went well/wrong?)
          <textarea rows="3" {...register('notesAfter')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" />
        </label>
      </div>
    </section>
  );
};

export default TradeReflectionReview;
