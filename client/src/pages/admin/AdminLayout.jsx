import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Medal, Gift, BrainCircuit,
  LineChart, BarChart2, DollarSign, LifeBuoy, Megaphone, Flag,
  Activity, ShieldCheck, Settings, LogOut, Bug, Lightbulb, Menu, X, BookOpen,
  Bell, Sun, Moon, ChevronLeft, ChevronRight, ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/ThemeProvider';

const ROUTE_TITLES = [
  { match: '/admin/users', title: 'Users & Accounts' },
  { match: '/admin/subscriptions', title: 'Subscriptions & Billing' },
  { match: '/admin/promotions', title: 'Promotions & Discounts' },
  { match: '/admin/founding-trader', title: 'Founding Traders' },
  { match: '/admin/blog/new', title: 'Write Article' },
  { match: '/admin/blog/edit', title: 'Edit Article' },
  { match: '/admin/blog', title: 'Blog & Education' },
  { match: '/admin/platform', title: 'Platform Settings' },
  { match: '/admin/business', title: 'Business & Revenue' },
  { match: '/admin/analytics', title: 'Platform Analytics' },
  { match: '/admin/infrastructure', title: 'Server & System Health' },
  { match: '/admin/ai', title: 'AI Operations' },
  { match: '/admin/audit', title: 'Audit Logs' },
  { match: '/admin/customer-success', title: 'Support Overview' },
  { match: '/admin/communications', title: 'Communications Hub' },
  { match: '/admin/support', title: 'Support Tickets' },
  { match: '/admin/bugs', title: 'Bug Reports' },
  { match: '/admin/features', title: 'Feature Requests' },
  { match: '/admin', title: 'Super Admin Dashboard' },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  const profileMenuRef = useRef(null);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    setMobileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  // Resolve current page title for the mobile top header
  const currentPageTitle =
    ROUTE_TITLES.find((r) =>
      r.match === '/admin'
        ? location.pathname === '/admin' || location.pathname === '/admin/'
        : location.pathname.startsWith(r.match)
    )?.title || 'Super Admin';

  // Close mobile drawer and profile menu automatically on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  // Adjust default collapsed state cleanly when crossing 768-1024 tablet breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll, hide floating widget, and listen for Escape when mobile drawer is open
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('jahz-modal-visibility', { detail: { open: mobileOpen } })
    );

    if (!mobileOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  // Close mobile profile popover on outside click or Escape
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [profileMenuOpen]);

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { label: 'Business & Revenue', path: '/admin/business/executive', matchPrefix: '/admin/business', icon: LineChart },
        { label: 'Platform Analytics', path: '/admin/analytics', icon: BarChart2 },
      ],
    },
    {
      title: 'Users & Billing',
      items: [
        { label: 'Users & Accounts', path: '/admin/users', icon: Users },
        { label: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
        { label: 'Promotions & Discounts', path: '/admin/promotions', icon: Gift },
        { label: 'Founding Traders', path: '/admin/founding-trader', icon: Medal },
      ],
    },
    {
      title: 'Content',
      items: [
        { label: 'Blog & Education', path: '/admin/blog', icon: BookOpen },
      ],
    },
    {
      title: 'Platform & AI',
      items: [
        { label: 'Platform Settings', path: '/admin/platform/overview', matchPrefix: '/admin/platform', icon: Settings },
        { label: 'AI Operations', path: '/admin/ai', icon: BrainCircuit },
        { label: 'Server & System Health', path: '/admin/infrastructure', icon: Activity },
        { label: 'Audit Logs', path: '/admin/audit', icon: ShieldCheck },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'Support Overview', path: '/admin/customer-success', icon: LifeBuoy },
        { label: 'Communications Hub', path: '/admin/communications/contact', matchPrefix: '/admin/communications', icon: Megaphone },
        { label: 'Support Tickets', path: '/admin/support', icon: Flag },
        { label: 'Bug Reports', path: '/admin/bugs', icon: Bug },
        { label: 'Feature Requests', path: '/admin/features', icon: Lightbulb },
      ],
    },
  ];

  const renderNavContent = (isDrawer = false) => {
    const isCompact = !isDrawer && sidebarCollapsed;

    return (
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {/* Sidebar Header */}
        <div className={`border-b border-border flex items-center sticky top-0 bg-surface dark:bg-surface-muted z-10 ${isCompact ? 'p-3 justify-center flex-col gap-2' : 'p-4 sm:p-5 justify-between'}`}>
          {!isCompact ? (
            <div className="min-w-0">
              <h1 className="font-black text-xl tracking-wide text-foreground truncate">
                JAHZ<span className="text-emerald-500">ADMIN</span>
              </h1>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                Portal HQ
              </p>
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 font-black flex items-center justify-center text-sm" title="JAHZADMIN Portal HQ">
              JA
            </div>
          )}

          {isDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-xl transition"
            >
              <X size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg border border-border bg-surface-muted/60 hover:bg-surface-muted text-muted-foreground hover:text-foreground transition"
            >
              {isCompact ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 ${isCompact ? 'p-2 space-y-4' : 'p-3 space-y-5'}`}>
          {navGroups.map((group, idx) => (
            <div key={idx}>
              {!isCompact && (
                <h2 className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {group.title}
                </h2>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const customActive = item.matchPrefix
                    ? location.pathname.startsWith(item.matchPrefix)
                    : false;

                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/admin'}
                        onClick={() => setMobileOpen(false)}
                        title={isCompact ? item.label : undefined}
                        className={({ isActive }) => {
                          const active = isActive || customActive;
                          return `flex items-center ${
                            isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                          } rounded-lg text-sm font-medium transition ${
                            active
                              ? 'bg-emerald-500/10 text-emerald-500 font-bold'
                              : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                          }`;
                        }}
                      >
                        <Icon size={18} className="shrink-0" />
                        {!isCompact && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Quick App Switch + Theme + User Footer */}
        <div className={`border-t border-border bg-surface dark:bg-surface-muted sticky bottom-0 space-y-3 ${isCompact ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${isCompact ? 'flex-col gap-2' : 'justify-between gap-2'}`}>
            <Link
              to="/dashboard"
              onClick={() => setMobileOpen(false)}
              title="Return to Trader App"
              className={`flex items-center ${
                isCompact ? 'justify-center p-2 w-full' : 'gap-2 px-3 py-1.5 flex-1'
              } rounded-lg border border-border bg-surface-muted/60 hover:bg-surface-muted text-xs font-semibold text-foreground transition`}
            >
              <ArrowLeftRight size={14} className="text-emerald-500 shrink-0" />
              {!isCompact && <span className="truncate">Trader App</span>}
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
              className="p-2 rounded-lg border border-border bg-surface-muted/60 hover:bg-surface-muted text-foreground transition shrink-0"
            >
              {resolvedTheme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-500" />}
            </button>
          </div>

          <div className={`flex items-center ${isCompact ? 'justify-center flex-col gap-2' : 'gap-3'}`}>
            <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-slate-900 font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            {!isCompact && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{user?.name || 'Admin'}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.role || 'SUPER_ADMIN'}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition shrink-0"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full max-w-full bg-background text-foreground overflow-hidden">
      {/* Tablet & Desktop Sidebar (>= 768px) */}
      <aside
        className={`hidden md:flex flex-shrink-0 flex-col border-r border-border bg-surface dark:bg-surface-muted overflow-y-auto transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Slide-Out Navigation Drawer (< 768px) */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Theme-aware blurred backdrop */}
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        />

        {/* Slide-out panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Super Admin Navigation"
          className={`relative w-[85vw] max-w-[320px] h-full bg-surface border-r border-border shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderNavContent(true)}
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden bg-background">
        {/* Compact Mobile Top Navigation Bar (< 768px) */}
        <header className="h-14 border-b border-border flex items-center justify-between gap-2 px-3 md:hidden bg-surface shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground rounded-xl bg-surface-muted border border-border hover:bg-surface-muted/80 transition shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 leading-none">
                JAHZADMIN
              </p>
              <h1 className="font-bold text-sm text-foreground truncate leading-tight mt-0.5">
                {currentPageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              to="/admin/communications/notifications"
              aria-label="Notifications"
              title="Notification Center"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-border bg-surface-muted/60 text-muted-foreground hover:text-foreground transition"
            >
              <Bell size={17} />
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-border bg-surface-muted/60 text-foreground transition"
            >
              {resolvedTheme === 'dark' ? (
                <Sun size={17} className="text-amber-400" />
              ) : (
                <Moon size={17} className="text-indigo-500" />
              )}
            </button>

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-label="Admin profile menu"
                aria-expanded={profileMenuOpen}
                className="h-9 w-9 rounded-full bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs"
              >
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-bold text-foreground truncate">{user?.name || 'Super Admin'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email || user?.role}</p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                  >
                    <ArrowLeftRight size={14} className="text-emerald-500" />
                    Return to Trader App
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition text-left"
                  >
                    <LogOut size={14} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Outlet */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8 pb-24 sm:pb-12 bg-background min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
