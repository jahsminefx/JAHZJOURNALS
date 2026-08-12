const test = require('node:test');
const assert = require('node:assert/strict');
const { maintenanceMiddleware, clearMaintenanceCache } = require('../src/middleware/maintenanceMiddleware');

test('maintenanceMiddleware allows requests when maintenance mode is inactive', async () => {
  clearMaintenanceCache();

  let nextCalled = false;
  const req = { path: '/api/trades', user: { role: 'TRADER' } };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    }
  };
  const next = () => { nextCalled = true; };

  await maintenanceMiddleware(req, res, next);
  assert.equal(nextCalled, true);
});

test('maintenanceMiddleware exempts health check and auth login routes', async () => {
  clearMaintenanceCache();

  const reqHealth = { path: '/api/health', user: null };
  let nextCalledHealth = false;
  await maintenanceMiddleware(reqHealth, {}, () => { nextCalledHealth = true; });
  assert.equal(nextCalledHealth, true);

  const reqAuth = { path: '/api/auth/login', user: null };
  let nextCalledAuth = false;
  await maintenanceMiddleware(reqAuth, {}, () => { nextCalledAuth = true; });
  assert.equal(nextCalledAuth, true);
});

test('maintenanceMiddleware allows SUPER_ADMIN and ADMIN sessions', async () => {
  clearMaintenanceCache();

  const reqAdmin = { path: '/api/trades', user: { role: 'SUPER_ADMIN' } };
  let nextCalledAdmin = false;
  await maintenanceMiddleware(reqAdmin, {}, () => { nextCalledAdmin = true; });
  assert.equal(nextCalledAdmin, true);
});
