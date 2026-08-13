import test from 'node:test';
import assert from 'node:assert/strict';

// Test shared navigation logic & route layout state machine

const mockUser = {
  id: 'usr_123',
  name: 'Trader Alex',
  email: 'alex@jahzjournals.com',
  role: 'TRADER',
  subscriptionPlan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  onboardingCompleted: true,
};

const resolveLayoutMode = (pathname, user) => {
  const sharedRoutes = [
    '/',
    '/features',
    '/pricing',
    '/prop-firm-traders',
    '/mentors',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
    '/disclaimer',
    '/cookies',
    '/blog',
    '/trading-psychology',
    '/risk-management',
  ];

  const isShared = sharedRoutes.some(r => pathname === r || pathname.startsWith('/blog/'));
  const isProtected = ['/dashboard', '/trades', '/accounts', '/settings', '/analytics', '/ai'].some(r => pathname.startsWith(r));
  const isAdmin = pathname.startsWith('/admin');

  if (isProtected || isAdmin) {
    if (!user) return { layout: 'REDIRECT_LOGIN', authenticated: false };
    if (isAdmin && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return { layout: 'FORBIDDEN', authenticated: true };
    }
    return { layout: 'APP_LAYOUT', authenticated: true };
  }

  if (isShared) {
    if (user) {
      return { layout: 'APP_LAYOUT', authenticated: true };
    }
    return { layout: 'PUBLIC_LAYOUT', authenticated: false };
  }

  return { layout: 'NOT_FOUND', authenticated: Boolean(user) };
};

test('Shared Navigation - Authenticated user can navigate to /pricing and remains authenticated', () => {
  const result = resolveLayoutMode('/pricing', mockUser);
  assert.equal(result.authenticated, true);
  assert.equal(result.layout, 'APP_LAYOUT');
});

test('Shared Navigation - Authenticated user can navigate to /privacy and remains authenticated', () => {
  const result = resolveLayoutMode('/privacy', mockUser);
  assert.equal(result.authenticated, true);
  assert.equal(result.layout, 'APP_LAYOUT');
});

test('Shared Navigation - Authenticated user can navigate to /terms and remains authenticated', () => {
  const result = resolveLayoutMode('/terms', mockUser);
  assert.equal(result.authenticated, true);
  assert.equal(result.layout, 'APP_LAYOUT');
});

test('Shared Navigation - Authenticated user can navigate to /cookies and remains authenticated', () => {
  const result = resolveLayoutMode('/cookies', mockUser);
  assert.equal(result.authenticated, true);
  assert.equal(result.layout, 'APP_LAYOUT');
});

test('Shared Navigation - Refreshing shared page preserves authentication', () => {
  const resultInitial = resolveLayoutMode('/pricing', mockUser);
  const resultRefreshed = resolveLayoutMode('/pricing', mockUser);
  assert.equal(resultInitial.authenticated, true);
  assert.equal(resultRefreshed.authenticated, true);
  assert.equal(resultRefreshed.layout, 'APP_LAYOUT');
});

test('Shared Navigation - Anonymous user can access shared pages with public navigation', () => {
  const sharedPaths = ['/pricing', '/privacy', '/terms', '/cookies', '/about', '/contact'];
  for (const path of sharedPaths) {
    const result = resolveLayoutMode(path, null);
    assert.equal(result.authenticated, false);
    assert.equal(result.layout, 'PUBLIC_LAYOUT');
  }
});

test('Shared Navigation - Dashboard remains protected', () => {
  const anonResult = resolveLayoutMode('/dashboard', null);
  assert.equal(anonResult.layout, 'REDIRECT_LOGIN');

  const authResult = resolveLayoutMode('/dashboard', mockUser);
  assert.equal(authResult.layout, 'APP_LAYOUT');
});

test('Shared Navigation - Admin routes remain protected against non-admin traders', () => {
  const anonResult = resolveLayoutMode('/admin', null);
  assert.equal(anonResult.layout, 'REDIRECT_LOGIN');

  const traderResult = resolveLayoutMode('/admin', mockUser);
  assert.equal(traderResult.layout, 'FORBIDDEN');

  const adminResult = resolveLayoutMode('/admin', { ...mockUser, role: 'ADMIN' });
  assert.equal(adminResult.layout, 'APP_LAYOUT');
});

test('Shared Navigation - No redirect loop exists on shared routes', () => {
  const authPricing = resolveLayoutMode('/pricing', mockUser);
  const anonPricing = resolveLayoutMode('/pricing', null);
  assert.notEqual(authPricing.layout, 'REDIRECT_LOGIN');
  assert.notEqual(anonPricing.layout, 'REDIRECT_LOGIN');
});

test('Shared Navigation - Logout clears user and transitions layout cleanly', () => {
  let currentUser = mockUser;
  assert.equal(resolveLayoutMode('/privacy', currentUser).layout, 'APP_LAYOUT');

  // Perform logout
  currentUser = null;
  assert.equal(resolveLayoutMode('/privacy', currentUser).layout, 'PUBLIC_LAYOUT');
  assert.equal(resolveLayoutMode('/dashboard', currentUser).layout, 'REDIRECT_LOGIN');
});
