import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardTopBar from './DashboardTopBar';
import FoundingTraderWelcomeModal from './FoundingTraderWelcomeModal';
import UnifiedAssistantWidget from './UnifiedAssistantWidget';

const Layout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Scroll restoration on route navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden bg-background text-foreground font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Mobile Top Bar (<1024px) */}
      <DashboardTopBar onOpenDrawer={() => setIsMobileOpen(true)} />

      {/* Responsive Sidebar & Mobile Drawer */}
      <Sidebar 
        isMobileOpen={isMobileOpen} 
        onCloseMobile={() => setIsMobileOpen(false)} 
      />

      <FoundingTraderWelcomeModal />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto relative pb-6 pt-2 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
          <Outlet />
        </div>
      </main>

      {/* Single Unified Floating Widget (JAHZ AI + Feedback) */}
      <UnifiedAssistantWidget />
    </div>
  );
};

export default Layout;
