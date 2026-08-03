import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CreditCard, Medal, Gift, BrainCircuit, 
  LineChart, BarChart2, DollarSign, LifeBuoy, Megaphone, Flag, 
  Activity, ShieldCheck, Settings, LogOut, Bug, Lightbulb, Menu, X
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navGroups = [
    {
      title: 'Platform',
      items: [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { label: 'Users', path: '/admin/users', icon: Users },
        { label: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
      ]
    },
    {
      title: 'Growth & Launch',
      items: [
        { label: 'Founding Trader', path: '/admin/founding-trader', icon: Medal },
        { label: 'Promotions', path: '/admin/promotions', icon: Gift },
      ]
    },
    {
      title: 'Platform Administration',
      items: [
        { label: 'Control Hub', path: '/admin/platform/overview', icon: Activity },
        { label: 'Feature Flags', path: '/admin/platform/features', icon: Flag },
        { label: 'System Settings', path: '/admin/platform/settings', icon: Settings },
        { label: 'Integrations & API', path: '/admin/platform/integrations', icon: ShieldCheck },
      ]
    },
    {
      title: 'Business Intelligence',
      items: [
        { label: 'CEO Dashboard', path: '/admin/business/executive', icon: LineChart },
        { label: 'Trading Insights', path: '/admin/business/trading', icon: BarChart2 },
        { label: 'AI Operations', path: '/admin/business/ai', icon: BrainCircuit },
        { label: 'Revenue Trends', path: '/admin/business/revenue', icon: DollarSign },
      ]
    },
    {
      title: 'System & Analytics',
      items: [
        { label: 'Mission Control', path: '/admin/infrastructure', icon: Activity },
        { label: 'AI Center', path: '/admin/ai', icon: BrainCircuit },
        { label: 'Trades & Analytics', path: '/admin/analytics', icon: LineChart },
        { label: 'Audit Logs', path: '/admin/audit', icon: ShieldCheck },
      ]
    },
    {
      title: 'Customer Success',
      items: [
        { label: 'Overview', path: '/admin/customer-success', icon: LifeBuoy },
        { label: 'Communications Hub', path: '/admin/communications/contact', icon: Megaphone },
        { label: 'Support Tickets', path: '/admin/support', icon: ShieldCheck },
        { label: 'Bug Reports', path: '/admin/bugs', icon: Bug },
        { label: 'Feature Requests', path: '/admin/features', icon: Lightbulb },
      ]
    }
  ];

  const adminNavContent = (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-surface dark:bg-surface-muted z-10">
        <div>
          <h1 className="font-black text-xl tracking-wide text-foreground">
            JAHZ<span className="text-emerald-500">ADMIN</span>
          </h1>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Portal HQ</p>
        </div>
        <button 
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-muted hover:text-foreground p-1"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-6">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            <h2 className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{group.title}</h2>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/admin'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => 
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isActive 
                            ? 'bg-emerald-500/10 text-emerald-500 font-bold' 
                            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                        }`
                      }
                    >
                      <Icon size={18} />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border bg-surface dark:bg-surface-muted sticky bottom-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-slate-900 font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{user?.name || 'Admin'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.role || 'ADMIN'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 flex-col border-r border-border bg-surface dark:bg-surface-muted overflow-y-auto hidden md:flex">
        {adminNavContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" />
          <div className="relative w-[80vw] max-w-[320px] h-full bg-surface border-r border-border shadow-2xl z-50 animate-slide-right flex flex-col pt-safe pb-safe">
            {adminNavContent}
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:hidden bg-surface">
          <button 
            onClick={() => setMobileOpen(true)}
            className="p-2 text-muted hover:text-foreground rounded-lg bg-surface-muted border border-border"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-black text-lg tracking-wide text-foreground">
            JAHZ<span className="text-emerald-500">ADMIN</span>
          </h1>
          <div className="w-8" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
