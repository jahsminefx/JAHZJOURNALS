import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Briefcase, PlusCircle, LineChart, Settings, Sparkles } from 'lucide-react';

const MobileNav = () => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Home size={24} /> },
    { name: 'Trades', path: '/trades', icon: <Briefcase size={24} /> },
    { name: 'New Trade', path: '/trades/new', icon: <PlusCircle size={32} className="text-green-400" /> },
    { name: 'Analytics', path: '/analytics', icon: <LineChart size={24} /> },
    { name: 'JAHZ AI', path: '/ai', icon: <Sparkles size={24} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={24} /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-muted border-t border-border pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item, id) => (
          <NavLink
            key={id}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive && item.name !== 'New Trade' ? 'text-green-400' : 'text-muted hover:text-foreground'
              }`
            }
          >
            {item.icon}
            {item.name !== 'New Trade' && <span className="text-[10px] mt-1">{item.name}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
