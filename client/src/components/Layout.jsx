import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default Layout;
