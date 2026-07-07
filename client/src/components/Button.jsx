import React from 'react';
import { Link } from 'react-router-dom';

const variants = {
  primary: 'bg-emerald-400 text-gray-950 hover:bg-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.22)]',
  secondary: 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
  ghost: 'text-gray-300 hover:text-white hover:bg-white/5',
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

const Button = ({
  children,
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const classes = `inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-gray-950 ${variants[variant]} ${sizes[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
};

export default Button;
