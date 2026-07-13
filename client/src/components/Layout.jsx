import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

const Layout = () => {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50 text-gray-900 dark:bg-surface dark:text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto pb-16 md:pb-0 relative">
        <div className="p-4 md:p-7 max-w-[1500px] mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default Layout;
