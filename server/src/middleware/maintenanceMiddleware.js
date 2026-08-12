const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let cachedMaintenanceMode = false;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10000; // 10 second cache to avoid DB bottleneck on every request

/**
 * Checks system-wide maintenance mode status
 */
const isMaintenanceModeActive = async () => {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS) {
    return cachedMaintenanceMode;
  }

  try {
    const launchConfig = await prisma.systemConfig.findUnique({
      where: { key: 'LAUNCH_SETTINGS' }
    });
    if (launchConfig && launchConfig.value && typeof launchConfig.value === 'object') {
      cachedMaintenanceMode = Boolean(launchConfig.value.maintenanceMode);
    } else {
      cachedMaintenanceMode = false;
    }
    lastFetchTime = now;
  } catch (err) {
    console.error('Error reading maintenance mode setting:', err);
    // Safe fallback to avoid locking system on DB query errors
    cachedMaintenanceMode = false;
  }

  return cachedMaintenanceMode;
};

/**
 * Middleware enforcing server-side Maintenance Mode for public/user requests
 */
const maintenanceMiddleware = async (req, res, next) => {
  const active = await isMaintenanceModeActive();

  if (!active) {
    return next();
  }

  // Exempt health checks, admin routes, and authentication routes for recovery
  const path = req.path || req.originalUrl || '';
  const isHealthCheck = path.includes('/health') || path === '/';
  const isAdminRoute = path.startsWith('/api/admin');
  const isAuthLogin = path.includes('/api/auth/login');

  if (isHealthCheck || isAdminRoute || isAuthLogin) {
    return next();
  }

  // Allow active Super Admin / Admin sessions to pass through
  if (req.user && ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return next();
  }

  return res.status(503).json({
    maintenance: true,
    message: 'JAHZJOURNALS is currently undergoing scheduled maintenance. Please try again shortly.',
  });
};

/**
 * Reset cache helper for testing or immediate config updates
 */
const clearMaintenanceCache = () => {
  lastFetchTime = 0;
  cachedMaintenanceMode = false;
};

module.exports = {
  maintenanceMiddleware,
  isMaintenanceModeActive,
  clearMaintenanceCache,
};
