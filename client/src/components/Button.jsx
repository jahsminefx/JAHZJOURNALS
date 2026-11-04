import React from 'react';
import { Link } from 'react-router-dom';

const variants = {
  primary: 'bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-md shadow-emerald-500/20',
  secondary: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
  ghost: 'text-slate-900 dark:text-slate-100 font-bold hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-muted',
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

const Button = ({
  children,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  ...props
}) => {
  const classes = `inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background ${variants[variant]} ${sizes[size]} ${className}`;

  const linkHref = href || (to && to.startsWith('#') ? to : null);

  if (linkHref) {
    const handleAnchorClick = (e) => {
      if (linkHref.startsWith('#')) {
        const targetId = linkHref.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (window.history?.pushState) {
            window.history.pushState(null, '', linkHref);
          }
        }
      }
      onClick?.(e);
    };

    return (
      <a href={linkHref} className={classes} onClick={handleAnchorClick} {...props}>
        {children}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick} {...props}>
      {children}
    </button>
  );
};

export default Button;
