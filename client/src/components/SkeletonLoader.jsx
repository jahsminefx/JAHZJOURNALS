import React from 'react';

export const SkeletonText = ({ className = 'h-4 w-full' }) => (
  <div className={`bg-surface-muted/80 rounded-md animate-pulse ${className}`} />
);

export const SkeletonCard = ({ className = 'h-32' }) => (
  <div className={`bg-surface border border-border rounded-xl p-5 space-y-3 animate-pulse ${className}`}>
    <div className="flex justify-between items-center">
      <SkeletonText className="h-4 w-24" />
      <div className="h-8 w-8 rounded-lg bg-surface-muted/70" />
    </div>
    <SkeletonText className="h-7 w-36" />
    <SkeletonText className="h-3 w-20" />
  </div>
);

export const SkeletonStatGrid = ({ count = 5 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonChart = ({ className = 'h-72' }) => (
  <div className={`bg-surface border border-border rounded-xl p-6 space-y-4 animate-pulse ${className}`}>
    <div className="flex justify-between items-center">
      <SkeletonText className="h-5 w-40" />
      <SkeletonText className="h-8 w-24" />
    </div>
    <div className="h-48 w-full bg-surface-muted/40 rounded-lg flex items-end justify-between p-4 gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <div 
          key={i} 
          className="bg-surface-muted/80 rounded-t-sm w-full" 
          style={{ height: `${Math.max(20, Math.floor(Math.sin(i) * 40 + 50))}%` }} 
        />
      ))}
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5 }) => (
  <div className="bg-surface border border-border rounded-xl overflow-hidden animate-pulse">
    <div className="p-4 bg-surface-muted/50 border-b border-border flex gap-4">
      <SkeletonText className="h-4 w-28" />
      <SkeletonText className="h-4 w-20" />
      <SkeletonText className="h-4 w-32" />
    </div>
    <div className="divide-y divide-border p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2">
          <SkeletonText className="h-4 w-1/4" />
          <SkeletonText className="h-4 w-1/5" />
          <SkeletonText className="h-4 w-1/6" />
          <SkeletonText className="h-4 w-12" />
        </div>
      ))}
    </div>
  </div>
);

export default SkeletonCard;
