import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const AdminRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted">You do not have the required administrative clearance to view this page.</p>
          <a href="/dashboard" className="mt-6 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-emerald-400">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default AdminRoute;
