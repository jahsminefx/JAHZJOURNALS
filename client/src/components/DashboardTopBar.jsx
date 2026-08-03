import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, User as UserIcon, Sparkles } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import BrandLogo from './BrandLogo';

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Trading Accounts',
  '/trades': 'Trade Log',
  '/trades/new': 'New Trade Entry',
  '/rules': 'Trading Rules',
  '/strategies': 'Playbook Strategies',
  '/analytics': 'Performance Analytics',
  '/risk-calculator': 'Position Calculator',
  '/weekly-review': 'Weekly Journal',
  '/ai': 'JAHZ AI Assistant',
  '/settings': 'Account Settings',
  '/admin': 'Admin Console',
};

const DashboardTopBar = ({ onOpenDrawer }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = () => {
    if (routeTitles[location.pathname]) {
      return routeTitles[location.pathname];
    }
    if (location.pathname.startsWith('/trades/')) {
      return 'Trade Details';
    }
    if (location.pathname.startsWith('/accounts/')) {
      return 'Account Overview';
    }
    if (location.pathname.startsWith('/admin')) {
      return 'Admin Console';
    }
    return 'JAHZJOURNALS';
  };

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-background/90 dark:bg-background/90 backdrop-blur-md border-b border-border text-foreground pt-safe transition-colors">
      {/* Left: Hamburger menu button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-muted/60 text-foreground hover:bg-surface-muted active:scale-95 transition-all border border-border/60"
          aria-label="Open Navigation Menu"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <BrandLogo size="xs" />
        </div>
      </div>

      {/* Center: Dynamic Page Title */}
      <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-foreground truncate px-2 max-w-[180px] sm:max-w-xs text-center">
        {location.pathname === '/ai' && <Sparkles size={16} className="text-indigo-400 shrink-0" />}
        <span className="truncate">{getPageTitle()}</span>
      </div>

      {/* Right: Notifications & Profile Avatar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-surface-muted/60 text-muted hover:text-foreground hover:bg-surface-muted transition-all border border-border/40"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-500 overflow-hidden ring-2 ring-emerald-500/30 hover:ring-emerald-500 transition-all shrink-0"
          aria-label="User Settings"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name || 'User'} className="h-full w-full object-cover" />
          ) : (
            <UserIcon size={18} />
          )}
        </button>
      </div>
    </header>
  );
};

export default DashboardTopBar;
