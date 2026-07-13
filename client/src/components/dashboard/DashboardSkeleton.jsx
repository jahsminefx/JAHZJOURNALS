import React from 'react';

const SkeletonBox = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg border border-border bg-surface/80 ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="space-y-4">
    <div className="flex flex-col justify-between gap-4 lg:flex-row">
      <SkeletonBox className="h-16 w-full lg:w-80" />
      <SkeletonBox className="h-12 w-full lg:w-96" />
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => <SkeletonBox key={index} className="h-32" />)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.55fr_1.2fr]">
      <SkeletonBox className="h-80" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
        <SkeletonBox className="h-80" />
        <SkeletonBox className="h-80" />
      </div>
    </div>
  </div>
);

export default DashboardSkeleton;
