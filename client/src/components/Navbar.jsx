import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Button from './Button';
import BrandLogo from './BrandLogo';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Prop Firm Traders', to: '/prop-firm-traders' },
  { label: 'Mentors', to: '/mentors' },
  { label: 'About', to: '/about' },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? 'text-emerald-500 dark:text-emerald-300' : 'text-muted hover:text-foreground dark:hover:text-foreground'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border dark:border-border bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo />

        <div className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Button to="/login" variant="ghost" size="sm">Login</Button>
          <Button to="/register" size="sm">Start Free</Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground dark:border-border dark:text-foreground lg:hidden"
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border dark:border-border bg-background px-4 py-4 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-300' : 'text-muted hover:bg-surface-muted dark:hover:bg-surface-muted'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button to="/login" variant="secondary" onClick={() => setOpen(false)}>Login</Button>
              <Button to="/register" onClick={() => setOpen(false)}>Start Free</Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
