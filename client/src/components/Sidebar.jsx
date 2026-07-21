import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, LineChart, Briefcase, PlusCircle, Calculator, Compass, Settings, LogOut, Wallet, ShieldCheck, Layers, Sparkles, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import BrandLogo from './BrandLogo';
import UpgradeCard from './dashboard/UpgradeCard';
import FoundingTraderBadge from './FoundingTraderBadge';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Home size={20} /> },
    { name: 'Accounts', path: '/accounts', icon: <Wallet size={20} /> },
    { name: 'Trades', path: '/trades', icon: <Briefcase size={20} /> },
    { name: 'New Trade', path: '/trades/new', icon: <PlusCircle size={20} /> },
    { name: 'Rules', path: '/rules', icon: <ShieldCheck size={20} /> },
    { name: 'Strategies', path: '/strategies', icon: <Layers size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <LineChart size={20} /> },
    { name: 'Calculator', path: '/risk-calculator', icon: <Calculator size={20} /> },
    { name: 'Weekly Review', path: '/weekly-review', icon: <Compass size={20} /> },
    { name: 'JAHZ AI', path: '/ai', icon: <Sparkles size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
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

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border-r border-gray-200 dark:bg-background dark:border-border h-full overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-center">
        <BrandLogo to="/dashboard" size="sm" />
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'text-muted hover:bg-gray-100 hover:text-gray-900 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-foreground'
              }`
            }
          >
            <span className="mr-3">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}

        {user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors mt-4 border border-rose-500/20 bg-rose-500/5 ${
                isActive ? 'text-rose-600 dark:text-rose-400' : 'text-rose-500/80 hover:bg-rose-500/10 hover:text-rose-500'
              }`
            }
          >
            <span className="mr-3"><ShieldCheck size={20} /></span>
            <span className="font-medium">Admin Console</span>
          </NavLink>
        )}
      </nav>
      <div className="space-y-4 p-4 border-t border-border">
        <UpgradeCard compact />
        
        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted/50 p-3 mt-auto">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserIcon size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name || 'Trader'}</p>
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
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 text-muted hover:text-red-500 dark:text-muted dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={20} className="mr-3" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
