import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Layout from './Layout';

/**
 * SharedRouteLayout
 * Wraps routes that are accessible to both anonymous visitors and authenticated traders
 * (e.g. /pricing, /privacy, /terms, /cookies, /disclaimer, /about, /contact, /features, /blog, etc.)
 * 
 * - Authenticated trader: Automatically redirected to /dashboard if accessing root URL '/'.
 *   Shared pages (e.g. /pricing, /terms) are rendered inside application <Layout />.
 * - Anonymous visitor: Rendered with the public site experience (Navbar, Page Content, Footer).
 */
const SharedRouteLayout = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    if (location.pathname === '/') {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <Layout>
        <Outlet />
      </Layout>
    );
  }

  return <Outlet />;
};

export default SharedRouteLayout;
