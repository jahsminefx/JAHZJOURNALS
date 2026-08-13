import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Layout from './Layout';

/**
 * SharedRouteLayout
 * Wraps routes that are accessible to both anonymous visitors and authenticated traders
 * (e.g. /pricing, /privacy, /terms, /cookies, /disclaimer, /about, /contact, /features, /blog, etc.)
 * 
 * - Authenticated trader: Rendered inside the application <Layout /> (with Sidebar, TopBar, and Assistant).
 *   Public Navbar & Footer are suppressed so the user stays in the app experience without logout.
 * - Anonymous visitor: Rendered with the public site experience (Navbar, Page Content, Footer).
 */
const SharedRouteLayout = () => {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted font-sans">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <Layout>
        <Outlet />
      </Layout>
    );
  }

  return <Outlet />;
};

export default SharedRouteLayout;
