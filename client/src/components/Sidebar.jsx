import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, LineChart, Briefcase, PlusCircle, Calculator, Compass, Settings, 
  LogOut, Wallet, ShieldCheck, Layers, Sparkles, User as UserIcon, X, 
  ChevronLeft, ChevronRight, HelpCircle, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import BrandLogo from './BrandLogo';
import UpgradeCard from './dashboard/UpgradeCard';
import FoundingTraderBadge from './FoundingTraderBadge';

const LOCAL_STORAGE_COLLAPSED_KEY = 'jahzjournals-sidebar-collapsed';

const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Persistent collapsed state for desktop/tablet
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_COLLAPSED_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });

  // Touch gesture tracking for mobile swipe-to-close
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LOCAL_STORAGE_COLLAPSED_KEY, String(next));
      } catch (_) {}
      return next;
    });
  };

  // Close mobile drawer on route changes
  useEffect(() => {
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  }, [location.pathname]);

  // ESC key handler & body scroll lock when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onCloseMobile?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileOpen, onCloseMobile]);

  // Touch swipe gesture handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchCurrentX.current > 50) {
      onCloseMobile?.();
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home, exact: true },
    { name: 'Accounts', path: '/accounts', icon: Wallet, prefix: '/accounts' },
    { name: 'Trades', path: '/trades', icon: Briefcase, exact: true },
    { name: 'New Trade', path: '/trades/new', icon: PlusCircle },
    { name: 'Rules', path: '/rules', icon: ShieldCheck },
    { name: 'Strategies', path: '/strategies', icon: Layers },
    { name: 'Analytics', path: '/analytics', icon: LineChart },
    { name: 'Calculator', path: '/risk-calculator', icon: Calculator },
    { name: 'Weekly Review', path: '/weekly-review', icon: Compass },
    { name: 'JAHZ AI', path: '/ai', icon: Sparkles, prefix: '/ai' },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Help & Support', path: '/contact', icon: HelpCircle },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Your session is securely closed.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t close your session safely.');
    }
  };

  const isItemActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    if (item.prefix) return location.pathname.startsWith(item.prefix);
    return location.pathname === item.path;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar select-none">
      {/* Sidebar Header & Brand */}
      <div className="p-4 border-b border-border flex items-center justify-between h-16 shrink-0">
        <BrandLogo to="/dashboard" size="sm" showText={!isCollapsed} />
        
        {/* Toggle Button for Desktop/Tablet */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="hidden lg:flex items-center justify-center h-8 w-8 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* Close Button for Mobile Drawer */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* User Profile Card Header */}
      <div className={`p-3.5 border-b border-border/60 bg-surface-muted/40 ${isCollapsed ? 'flex justify-center p-2.5' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-emerald-500/30">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <UserIcon size={20} />
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground leading-snug">{user?.name || 'Trader'}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">{user?.email || 'trader@jahzjournals.com'}</p>
              {user?.subscriptions?.[0]?.source === 'PROMOTION' && (
                <div className="mt-1">
                  <FoundingTraderBadge 
                    subscription={user.subscriptions[0]} 
                    badgeName={user.subscriptions[0].promotion?.badge?.name || 'Founding Trader'}
                    badgeColor={user.subscriptions[0].promotion?.badge?.color || 'amber'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <NavLink
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={
                `flex items-center px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${
                  active 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' 
                    : 'text-muted hover:bg-surface-muted hover:text-foreground dark:text-muted dark:hover:bg-surface-muted dark:hover:text-foreground font-medium'
                } ${isCollapsed ? 'justify-center px-2' : ''}`
              }
            >
              <Icon size={19} className={`shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span className="text-sm truncate">{item.name}</span>}
            </NavLink>
          );
        })}

        {/* Admin Console Link (if admin) */}
        {user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
          <NavLink
            to="/admin"
            title={isCollapsed ? 'Admin Console' : undefined}
            className={({ isActive }) =>
              `flex items-center px-3.5 py-2.5 rounded-xl transition-all duration-200 mt-4 border border-rose-500/20 bg-rose-500/5 ${
                isActive ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-rose-500/80 hover:bg-rose-500/10 hover:text-rose-500 font-medium'
              } ${isCollapsed ? 'justify-center px-2' : ''}`
            }
          >
            <ShieldCheck size={19} className={`shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && <span className="text-sm font-bold truncate">Admin Console</span>}
          </NavLink>
        )}
      </nav>

      {/* Footer & User Actions */}
      <div className="p-3 border-t border-border space-y-3 shrink-0">
        {!isCollapsed && <UpgradeCard compact />}

        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? 'Logout' : undefined}
          className={`flex items-center w-full px-3 py-2 rounded-xl text-xs font-bold text-muted hover:text-red-500 dark:text-muted dark:hover:text-red-400 hover:bg-red-500/10 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={18} className={`${isCollapsed ? '' : 'mr-2.5'}`} />
          {!isCollapsed && <span>Logout</span>}
        </button>

        {/* Version & App Branding at Bottom */}
        {!isCollapsed && (
          <div className="pt-1 px-1 text-[10px] text-muted-foreground flex justify-between items-center opacity-75 font-semibold">
            <span>JAHZJOURNALS</span>
            <span>v1.3.0</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Permanent Desktop & Tablet Sidebar */}
      <aside 
        className={`hidden lg:flex flex-col shrink-0 bg-background border-r border-border h-full transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer (Width 80%, max 320px, left-side, touch swipe to close) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Dark Blurred Overlay Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 ease-in-out animate-fade-in"
          />

          {/* Sliding Drawer Container */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-[80vw] max-w-[320px] h-full bg-background border-r border-border rounded-r-2xl shadow-2xl z-50 animate-slide-right flex flex-col pt-safe pb-safe"
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
