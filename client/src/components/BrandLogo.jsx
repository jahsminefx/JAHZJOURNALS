import React from 'react';
import { Link } from 'react-router-dom';

const logo = '/logo-mark.png';

const sizes = {
  xs: {
    mark: 'h-6 w-6',
    image: 'h-9 w-9',
    text: 'text-[10px]',
  },
  sm: {
    mark: 'h-8 w-8',
    image: 'h-12 w-12',
    text: 'text-[11px] sm:text-xs lg:text-[13px]',
  },
  md: {
    mark: 'h-9 w-9',
    image: 'h-14 w-14',
    text: 'text-xs sm:text-sm',
  },
  lg: {
    mark: 'h-10 w-10',
    image: 'h-16 w-16',
    text: 'text-sm sm:text-base',
  },
};

const BrandLogo = ({ to = '/', size = 'sm', showText = true, className = '' }) => {
  const selected = sizes[size] || sizes.sm;
  const content = (
    <>
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black ${selected.mark}`}>
        <img
          src={logo}
          alt="JAHZJOURNALS logo"
          className={`${selected.image} max-w-none object-contain`}
        />
      </span>
      {showText && (
        <span className={`${selected.text} font-ethnocentric font-black tracking-tighter inline-flex items-center uppercase select-none whitespace-nowrap shrink-0`}>
          <span className="text-rose-600 dark:text-rose-400">JAHZ</span>
          <span className="text-emerald-600 dark:text-emerald-400">JOURNALS</span>
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`flex items-center gap-3 ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {content}
    </div>
  );
};

export default BrandLogo;
