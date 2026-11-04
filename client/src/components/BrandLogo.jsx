import React from 'react';
import { Link } from 'react-router-dom';

const logo = '/logo-mark.png';

const sizes = {
  xs: {
    image: 'h-6 w-auto',
    text: 'text-[10px]',
  },
  sm: {
    image: 'h-8 w-auto',
    text: 'text-[11px] sm:text-xs lg:text-[13px]',
  },
  md: {
    image: 'h-9 w-auto',
    text: 'text-xs sm:text-sm',
  },
  lg: {
    image: 'h-11 w-auto',
    text: 'text-sm sm:text-base',
  },
};

const BrandLogo = ({ to = '/', size = 'sm', showText = true, forceDark = false, className = '' }) => {
  const selected = sizes[size] || sizes.sm;
  const content = (
    <>
      <img
        src={logo}
        alt="JAHZJOURNALS logo"
        className={`${selected.image} shrink-0 object-contain select-none transition-transform duration-200 group-hover:scale-105`}
      />
      {showText && (
        <span className={`${selected.text} font-ethnocentric font-black tracking-tighter inline-flex items-center uppercase select-none whitespace-nowrap shrink-0`}>
          <span className={forceDark ? "text-rose-400" : "text-rose-600 dark:text-rose-400"}>JAHZ</span>
          <span className={forceDark ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"}>JOURNALS</span>
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`group flex items-center gap-2.5 ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {content}
    </div>
  );
};

export default BrandLogo;
