const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isMissingStaticAssetRequest,
  getStaticCacheControl,
} = require('../src/utils/staticAssetRouting');

test('isMissingStaticAssetRequest distinguishes static/chunk assets from SPA routes', () => {
  assert.equal(isMissingStaticAssetRequest('/assets/Dashboard-OLD.js'), true);
  assert.equal(isMissingStaticAssetRequest('/assets/index-OLD.css'), true);
  assert.equal(isMissingStaticAssetRequest('/assets/anything-else'), true);
  assert.equal(isMissingStaticAssetRequest('/workbox-old.js'), true);
  assert.equal(isMissingStaticAssetRequest('/scripts/chunk.mjs?v=123'), true);
  assert.equal(isMissingStaticAssetRequest('/missing.png'), true);
  assert.equal(isMissingStaticAssetRequest('/fonts/custom.woff2'), true);

  assert.equal(isMissingStaticAssetRequest('/'), false);
  assert.equal(isMissingStaticAssetRequest('/dashboard'), false);
  assert.equal(isMissingStaticAssetRequest('/trades/abc-123'), false);
  assert.equal(isMissingStaticAssetRequest('/blog/how-to-pass-a-prop-firm-challenge'), false);
  assert.equal(isMissingStaticAssetRequest('/shared/trade/share-token-123'), false);
  assert.equal(isMissingStaticAssetRequest(''), false);
  assert.equal(isMissingStaticAssetRequest(null), false);
});

test('getStaticCacheControl returns appropriate Cache-Control headers across POSIX and Windows paths', () => {
  const noCache = 'no-cache, no-store, must-revalidate';
  const immutable = 'public, max-age=31536000, immutable';
  const shortPublic = 'public, max-age=86400';

  // Entry & service worker files must never be stale-cached
  assert.equal(getStaticCacheControl('/app/client/dist/index.html'), noCache);
  assert.equal(getStaticCacheControl('C:\\app\\client\\dist\\index.html'), noCache);
  assert.equal(getStaticCacheControl('/app/client/dist/registerSW.js'), noCache);
  assert.equal(getStaticCacheControl('C:\\app\\client\\dist\\sw.js'), noCache);
  assert.equal(getStaticCacheControl('/app/client/dist/sw-push.js'), noCache);

  // Content-hashed build assets and workbox runtime are safe to cache immutably
  assert.equal(getStaticCacheControl('/app/client/dist/assets/Dashboard-CBitMs31.js'), immutable);
  assert.equal(getStaticCacheControl('C:\\app\\client\\dist\\assets\\Dashboard-CBitMs31.js'), immutable);
  assert.equal(getStaticCacheControl('assets/index-D38fKGsH.css'), immutable);
  assert.equal(getStaticCacheControl('/app/client/dist/workbox-dcde9eb3.js'), immutable);
  assert.equal(getStaticCacheControl('C:\\app\\client\\dist\\workbox-dcde9eb3.js'), immutable);

  // Non-hashed static assets use a bounded 1-day cache
  assert.equal(getStaticCacheControl('/app/client/dist/heroes/hero-home.png'), shortPublic);
  assert.equal(getStaticCacheControl('C:\\app\\client\\dist\\heroes\\hero-home.png'), shortPublic);
  assert.equal(getStaticCacheControl('heroes/hero-home.png'), shortPublic);
  assert.equal(getStaticCacheControl('/app/client/dist/manifest.webmanifest'), shortPublic);
});
