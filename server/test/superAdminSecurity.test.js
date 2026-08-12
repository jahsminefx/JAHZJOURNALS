const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/roleMiddleware');
const { impersonateUser } = require('../src/controllers/adminImpersonationController');

test('Super Admin Security - authorize middleware permits SUPER_ADMIN and ADMIN', () => {
  const middleware = authorize('SUPER_ADMIN', 'ADMIN');
  let nextCalled = false;

  const req = { user: { role: 'SUPER_ADMIN' } };
  middleware(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});

test('Super Admin Security - authorize middleware rejects TRADER role with 403', () => {
  const middleware = authorize('SUPER_ADMIN');
  let statusSet = null;
  let jsonSent = null;

  const req = { user: { role: 'TRADER' } };
  const res = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(body) {
      jsonSent = body;
    }
  };

  middleware(req, res, () => {});

  assert.equal(statusSet, 403);
  assert.equal(jsonSent.message, 'User role TRADER is not authorized to access this route');
});

test('Super Admin Security - impersonation requires a structured audit reason', async () => {
  let statusSet = null;
  let jsonSent = null;

  const req = {
    params: { id: 'user-123' },
    body: {}, // missing reason
    user: { role: 'SUPER_ADMIN' }
  };
  const res = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(body) {
      jsonSent = body;
    }
  };

  await impersonateUser(req, res);

  assert.equal(statusSet, 400);
  assert.match(jsonSent.message, /Reason/i);
});
