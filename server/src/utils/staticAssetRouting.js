const NO_CACHE_BASENAMES = new Set([
  'index.html',
  'registerSW.js',
  'sw.js',
  'sw-push.js',
]);

const STATIC_ASSET_EXT_PATTERN =
  /\.((m|c)?js|css|map|woff2?|ttf|eot|png|jpe?g|gif|webp|avif|svg|ico|webmanifest)$/i;

const WORKBOX_RUNTIME_PATTERN = /^workbox-[^/]+\.js$/;

/**
 * Returns true when a request path targets a versioned/static asset file
 * (rather than a client-side SPA route) so Express never returns index.html on a 404.
 */
function isMissingStaticAssetRequest(reqPath) {
  if (typeof reqPath !== 'string' || !reqPath) {
    return false;
  }

  const cleanPath = reqPath.split('?')[0];
  if (cleanPath.startsWith('/assets/')) {
    return true;
  }

  return STATIC_ASSET_EXT_PATTERN.test(cleanPath);
}

/**
 * Computes appropriate Cache-Control headers for static files served from client/dist.
 */
function getStaticCacheControl(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const baseName = normalized.split('/').pop();

  if (NO_CACHE_BASENAMES.has(baseName)) {
    return 'no-cache, no-store, must-revalidate';
  }

  if (
    normalized.includes('/assets/') ||
    normalized.startsWith('assets/') ||
    WORKBOX_RUNTIME_PATTERN.test(baseName)
  ) {
    return 'public, max-age=31536000, immutable';
  }

  return 'public, max-age=86400';
}

module.exports = {
  isMissingStaticAssetRequest,
  getStaticCacheControl,
};
