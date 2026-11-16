import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  ChevronDown, 
  Calendar, 
  Calculator, 
  ShieldCheck, 
  GraduationCap, 
  BookOpen, 
  Compass, 
  Sparkles, 
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import Button from './Button';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/useAuth';

const navigationItems = [
  {
    type: 'link',
    label: 'Home',
    to: '/',
  },
  {
    type: 'link',
    label: 'Features',
    to: '/features',
  },
  {
    type: 'dropdown',
    label: 'Trading Tools',
    id: 'trading-tools',
    items: [
      {
        label: 'News Calendar',
        to: '/calendar',
        description: 'High-impact macroeconomic events and live release countdowns',
        icon: Calendar,
      },
      {
        label: 'Risk Calculator',
        to: '/risk-calculator',
        description: 'Position sizing, lot calculations and custom risk buffers',
        icon: Calculator,
      },
    ],
  },
  {
    type: 'dropdown',
    label: 'Resources',
    id: 'resources',
    items: [
      {
        label: 'Prop Firm',
        to: '/prop-firm-traders',
        description: 'Challenge drawdown monitors, profit targets and rule safeguards',
        icon: ShieldCheck,
      },
      {
        label: 'Mentors',
        to: '/mentors',
        description: 'Private student cohorts, trade review and feedback grading',
        icon: GraduationCap,
      },
      {
        label: 'Blog',
        to: '/blog',
        description: 'Trading psychology, risk frameworks and execution guides',
        icon: BookOpen,
      },
    ],
  },
  {
    type: 'dropdown',
    label: 'Company',
    id: 'company',
    items: [
      {
        label: 'About',
        to: '/about',
        description: 'Our mission and the disciplined trader sanctuary',
        icon: Compass,
      },
      {
        label: 'Pricing',
        to: '/pricing',
        description: 'Transparent plans for retail traders and coaching academies',
        icon: Sparkles,
      },
      {
        label: 'Contact',
        to: '/contact',
        description: 'Connect with our team for questions, feedback, or support',
        icon: MessageSquare,
      },
    ],
  },
];

const Navbar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedMobileGroups, setExpandedMobileGroups] = useState({});

  const dropdownTimeoutRef = useRef(null);
  const navContainerRef = useRef(null);

  // Helper: check if a specific route is active
  const isItemActive = (to) => {
    if (to === '/') return currentPath === '/';
    if (to === '/pricing') return currentPath.startsWith('/pricing');
    if (to === '/blog') return currentPath.startsWith('/blog');
    if (to === '/calendar') return currentPath.startsWith('/calendar');
    return currentPath === to || currentPath.startsWith(to + '/');
  };

  // Helper: check if any child item in a dropdown is active
  const isGroupActive = (group) => {
    return group.items?.some((item) => isItemActive(item.to));
  };

  // Auto-expand active group in mobile drawer on initial load or route change
  useEffect(() => {
    navigationItems.forEach((item) => {
      if (item.type === 'dropdown' && isGroupActive(item)) {
        setExpandedMobileGroups((prev) => ({ ...prev, [item.id]: true }));
      }
    });
  }, [currentPath]);

  // Close menus on route change
  useEffect(() => {
    setActiveDropdown(null);
    setDrawerOpen(false);
  }, [currentPath]);

  // Outside click listener to dismiss active desktop dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Escape key handler to close menus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Mouse hover handlers with intent delay
  const handleMouseEnter = (id) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(id);
  };

  const handleMouseLeave = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 180);
  };

  const handleDropdownToggle = (id) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const toggleMobileGroup = (id) => {
    setExpandedMobileGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // If user is authenticated, hide public landing navbar (app dashboard layout handles navigation)
  if (user) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-surface/95 dark:bg-slate-950/95 text-foreground shadow-sm backdrop-blur-xl transition-colors duration-200">
      <nav
        ref={navContainerRef}
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Global"
      >
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <BrandLogo />
        </div>

        {/* Center: Desktop Navigation Links & Dropdowns (Visible at lg: 1024px and above) */}
        <div className="hidden items-center gap-6 xl:gap-8 lg:flex">
          {navigationItems.map((item) => {
            if (item.type === 'link') {
              const active = isItemActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-2 text-sm font-bold transition-colors duration-150 ${
                    active
                      ? 'text-emerald-500 dark:text-emerald-400 font-extrabold'
                      : 'text-foreground/80 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  )}
                </Link>
              );
            }

            // Dropdown Group Trigger & Menu
            const groupActive = isGroupActive(item);
            const isOpen = activeDropdown === item.id;

            return (
              <div
                key={item.id}
                onMouseEnter={() => handleMouseEnter(item.id)}
                onMouseLeave={handleMouseLeave}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => handleDropdownToggle(item.id)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  className={`group relative inline-flex items-center gap-1.5 py-2 text-sm font-bold transition-colors duration-150 cursor-pointer select-none ${
                    groupActive || isOpen
                      ? 'text-emerald-500 dark:text-emerald-400 font-extrabold'
                      : 'text-foreground/80 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400'
                  }`}
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-emerald-500 dark:text-emerald-400' : 'opacity-70 group-hover:opacity-100'
                    }`}
                  />
                  {groupActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  )}
                </button>

                {/* Dropdown Menu Panel */}
                {isOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 rounded-2xl border border-border/80 dark:border-slate-800 bg-surface/98 dark:bg-slate-950/98 p-2 shadow-2xl shadow-slate-950/20 dark:shadow-black/70 ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-2xl z-50 transition-all duration-150 animate-in fade-in-0 zoom-in-95"
                  >
                    <div className="space-y-1">
                      {item.items.map((subItem) => {
                        const active = isItemActive(subItem.to);
                        const SubIcon = subItem.icon;

                        return (
                          <Link
                            key={subItem.to}
                            to={subItem.to}
                            role="menuitem"
                            onClick={() => setActiveDropdown(null)}
                            className={`group flex items-start gap-3 rounded-xl p-2.5 transition-all duration-150 cursor-pointer ${
                              active
                                ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-extrabold border-l-2 border-emerald-500 pl-3'
                                : 'text-foreground/90 dark:text-slate-200 hover:bg-surface-muted dark:hover:bg-slate-900/80 hover:text-emerald-500 dark:hover:text-emerald-400'
                            }`}
                          >
                            <div
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105 ${
                                active
                                  ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-surface-muted dark:bg-slate-900 border border-border/70 dark:border-slate-800 text-muted group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30'
                              }`}
                            >
                              <SubIcon size={17} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold flex items-center justify-between">
                                <span className="truncate">{subItem.label}</span>
                                {active && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-1 group-hover:text-muted/90">
                                {subItem.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Desktop CTA Buttons */}
        <div className="hidden items-center gap-3 lg:flex">
          <Button
            to="/login"
            variant="ghost"
            size="sm"
            className="!text-foreground/90 dark:!text-slate-100 hover:!text-emerald-500 dark:hover:!text-emerald-400 hover:!bg-surface-muted dark:hover:!bg-slate-900"
          >
            Login
          </Button>
          <Button to="/register" size="sm">
            Start Free
          </Button>
        </div>

        {/* Tablet & Mobile Right Actions (Tablet keeps Start Free visible + Hamburger Menu button) */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <Button to="/register" size="sm" className="hidden sm:inline-flex text-xs py-1.5 px-3">
            Start Free
          </Button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-surface text-foreground hover:bg-surface-muted hover:text-emerald-500 dark:hover:text-emerald-400 transition cursor-pointer"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {/* Slide-out Navigation Drawer for Mobile & Tablet Portrait */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop with Blur */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-surface dark:bg-slate-950 border-l border-border dark:border-slate-800 shadow-2xl p-5 sm:p-6 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-in-out"
            aria-label="Mobile navigation"
          >
            <div>
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/70 dark:border-slate-800">
                <BrandLogo />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-muted dark:hover:bg-slate-900 transition cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Items List */}
              <nav className="mt-5 space-y-2">
                {navigationItems.map((item) => {
                  if (item.type === 'link') {
                    const active = isItemActive(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${
                          active
                            ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-extrabold border-l-2 border-emerald-500'
                            : 'text-foreground hover:bg-surface-muted dark:hover:bg-slate-900 hover:text-emerald-500 dark:hover:text-emerald-400'
                        }`}
                      >
                        <span>{item.label}</span>
                        {active && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        )}
                      </Link>
                    );
                  }

                  // Expandable Accordion Group for Mobile Drawer
                  const groupActive = isGroupActive(item);
                  const isExpanded = !!expandedMobileGroups[item.id];

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/70 dark:border-slate-800/80 bg-surface-muted/30 dark:bg-slate-900/40 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleMobileGroup(item.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-bold text-left transition cursor-pointer ${
                          groupActive
                            ? 'text-emerald-500 dark:text-emerald-400 font-extrabold'
                            : 'text-foreground hover:text-emerald-500 dark:hover:text-emerald-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{item.label}</span>
                          {groupActive && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-200 text-muted ${
                            isExpanded ? 'rotate-180 text-emerald-500 dark:text-emerald-400' : ''
                          }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="px-2 pb-2 space-y-1 border-t border-border/50 dark:border-slate-800/60 pt-1.5 bg-surface/40 dark:bg-slate-950/40">
                          {item.items.map((subItem) => {
                            const active = isItemActive(subItem.to);
                            const SubIcon = subItem.icon;

                            return (
                              <Link
                                key={subItem.to}
                                to={subItem.to}
                                onClick={() => setDrawerOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                                  active
                                    ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 font-black border-l-2 border-emerald-500 pl-3'
                                    : 'text-foreground/80 dark:text-slate-300 hover:bg-surface-muted dark:hover:bg-slate-900 hover:text-emerald-500 dark:hover:text-emerald-400'
                                }`}
                              >
                                <SubIcon
                                  size={16}
                                  className={
                                    active ? 'text-emerald-500 dark:text-emerald-400' : 'text-muted'
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold flex items-center justify-between">
                                    <span>{subItem.label}</span>
                                    {active && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted truncate mt-0.5">
                                    {subItem.description}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-6 border-t border-border/70 dark:border-slate-800 space-y-3">
              <Button
                to="/login"
                variant="secondary"
                size="md"
                className="w-full justify-center"
                onClick={() => setDrawerOpen(false)}
              >
                Login
              </Button>
              <Button
                to="/register"
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => setDrawerOpen(false)}
              >
                Start Free
              </Button>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
};

export default Navbar;
