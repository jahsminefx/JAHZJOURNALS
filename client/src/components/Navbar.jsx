import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Button from './Button';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/useAuth';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Prop Firm', to: '/prop-firm-traders' },
  { label: 'Mentors', to: '/mentors' },
  { label: 'Blog', to: '/blog' },
  { label: 'About', to: '/about' },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  // If user is authenticated, hide public landing navbar (app layout handles navigation)
  if (user) return null;

  const linkClass = ({ isActive }) =>
    `text-sm font-bold transition-colors ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-extrabold underline underline-offset-4 decoration-emerald-500' : 'text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-surface/95 dark:bg-slate-950/95 shadow-sm backdrop-blur-xl">
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
        <div className="border-t border-border bg-surface dark:bg-slate-950 px-4 py-4 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-bold ${isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-slate-900 dark:text-slate-100 hover:bg-surface-muted'}`
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
