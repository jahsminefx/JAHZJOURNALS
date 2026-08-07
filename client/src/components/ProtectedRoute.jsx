import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import SEO from './SEO';

const ProtectedRoute = () => {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-muted">
        Preparing your space...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <SEO noindex={true} />
      <Outlet />
    </>
  );
};

export default ProtectedRoute;
