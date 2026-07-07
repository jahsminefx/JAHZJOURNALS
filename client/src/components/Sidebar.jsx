import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, LineChart, Briefcase, PlusCircle, Calculator, Compass, Settings, LogOut, Wallet, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import BrandLogo from './BrandLogo';

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Home size={20} /> },
    { name: 'Accounts', path: '/accounts', icon: <Wallet size={20} /> },
    { name: 'Trades', path: '/trades', icon: <Briefcase size={20} /> },
    { name: 'New Trade', path: '/trades/new', icon: <PlusCircle size={20} /> },
    { name: 'Rules', path: '/rules', icon: <ShieldCheck size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <LineChart size={20} /> },
    { name: 'Calculator', path: '/risk-calculator', icon: <Calculator size={20} /> },
    { name: 'Weekly Review', path: '/weekly-review', icon: <Compass size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to log out');
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-800 border-r border-gray-700 min-h-screen">
      <div className="p-4 border-b border-gray-700 flex items-center justify-center">
        <BrandLogo to="/dashboard" size="sm" />
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-gray-700 text-green-400' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100'
              }`
            }
          >
            <span className="mr-3">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 text-gray-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} className="mr-3" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
