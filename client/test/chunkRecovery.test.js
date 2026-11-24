import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_COOLDOWN_MS,
  isChunkLoadError,
  attemptChunkRecoveryReload,
  loadChunkWithRetry,
  installChunkErrorRecovery,
  forceAppReload,
} from '../src/utils/chunkRecovery.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test('isChunkLoadError identifies browser & Vite dynamic chunk errors and ignores runtime bugs', () => {
  assert.equal(
    isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://jahzjournal.com/assets/Dashboard-OLD.js')),
    true,
  );
  assert.equal(
    isChunkLoadError(new TypeError('Importing a module script failed.')),
    true,
  );
  assert.equal(
    isChunkLoadError(new Error('error loading dynamically imported module: /assets/Settings-123.js')),
    true,
  );
  assert.equal(
    isChunkLoadError(new Error('Unable to preload CSS for /assets/index-OLD.css')),
    true,
  );
  assert.equal(
    isChunkLoadError(new Error('Loading chunk 42 failed')),
    true,
  );
  assert.equal(
    isChunkLoadError(new Error('Failed to load module script: Expected a JavaScript module script')),
    true,
  );

  const namedErr = new Error('Some network issue');
  namedErr.name = 'ChunkLoadError';
  assert.equal(isChunkLoadError(namedErr), true);

  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'foo')")), false);
  assert.equal(isChunkLoadError(new ReferenceError('x is not defined')), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(isChunkLoadError(undefined), false);
  assert.equal(isChunkLoadError({}), false);
});

test('attemptChunkRecoveryReload reloads once, respects cooldown, handles offline & broken storage', () => {
  const storage = createMemoryStorage();
  let time = 1_700_000_000_000;
  let reloadCount = 0;
  const reload = () => {
    reloadCount += 1;
  };
  const chunkErr = new TypeError('Failed to fetch dynamically imported module: /assets/TradesList-old.js');

  // First failure reloads once and stores timestamp
  assert.equal(
    attemptChunkRecoveryReload(chunkErr, {
      storage,
      reload,
      navigatorObj: { onLine: true },
      now: () => time,
    }),
    true,
  );
  assert.equal(reloadCount, 1);
  assert.equal(storage.getItem(CHUNK_RELOAD_STORAGE_KEY), String(time));

  // Second failure inside cooldown does not loop
  time += 5000;
  assert.equal(
    attemptChunkRecoveryReload(chunkErr, {
      storage,
      reload,
      navigatorObj: { onLine: true },
      now: () => time,
    }),
    false,
  );
  assert.equal(reloadCount, 1);

  // Failure after cooldown reloads again
  time += CHUNK_RELOAD_COOLDOWN_MS + 1;
  assert.equal(
    attemptChunkRecoveryReload(chunkErr, {
      storage,
      reload,
      navigatorObj: { onLine: true },
      now: () => time,
    }),
    true,
  );
  assert.equal(reloadCount, 2);

  // Offline skips reload even outside cooldown
  time += CHUNK_RELOAD_COOLDOWN_MS + 1;
  assert.equal(
    attemptChunkRecoveryReload(chunkErr, {
      storage,
      reload,
      navigatorObj: { onLine: false },
      now: () => time,
    }),
    false,
  );
  assert.equal(reloadCount, 2);

  // Non-chunk error never triggers reload
  assert.equal(
    attemptChunkRecoveryReload(new TypeError('Regular runtime bug'), {
      storage,
      reload,
      navigatorObj: { onLine: true },
      now: () => time,
    }),
    false,
  );
  assert.equal(reloadCount, 2);

  // Throwing sessionStorage does not crash and still performs best-effort reload
  const brokenStorage = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('SecurityError');
    },
  };
  assert.equal(
    attemptChunkRecoveryReload(chunkErr, {
      storage: brokenStorage,
      reload,
      navigatorObj: { onLine: true },
      now: () => time,
    }),
    true,
  );
  assert.equal(reloadCount, 3);
});

test('loadChunkWithRetry resolves normally, stays pending on recoverable reload, and rethrows in cooldown or on normal errors', async () => {
  const ok = await loadChunkWithRetry(async () => ({ default: 'DashboardComponent' }));
  assert.deepEqual(ok, { default: 'DashboardComponent' });

  // Recoverable chunk error triggers reload and stays pending (never flashes ErrorBoundary)
  const storage = createMemoryStorage();
  let reloads = 0;
  const time = 1_700_000_000_000;
  const chunkPromise = loadChunkWithRetry(
    async () => {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/Dashboard-OLD.js');
    },
    { storage, reload: () => { reloads += 1; }, navigatorObj: { onLine: true }, now: () => time },
  );

  const raceResult = await Promise.race([
    chunkPromise.then(() => 'resolved', () => 'rejected'),
    new Promise((resolve) => setTimeout(() => resolve('still-pending'), 20)),
  ]);
  assert.equal(raceResult, 'still-pending');
  assert.equal(reloads, 1);

  // Inside cooldown, rethrows so ErrorBoundary renders the calm update screen
  await assert.rejects(
    loadChunkWithRetry(
      async () => {
        throw new TypeError('Failed to fetch dynamically imported module: /assets/Dashboard-OLD.js');
      },
      { storage, reload: () => { reloads += 1; }, navigatorObj: { onLine: true }, now: () => time + 1000 },
    ),
    /Failed to fetch dynamically imported module/,
  );
  assert.equal(reloads, 1);

  // Non-chunk error always rethrows without reloading
  await assert.rejects(
    loadChunkWithRetry(
      async () => {
        throw new SyntaxError('Unexpected token in component');
      },
      { storage, reload: () => { reloads += 1; }, navigatorObj: { onLine: true }, now: () => time + 50000 },
    ),
    /Unexpected token/,
  );
  assert.equal(reloads, 1);
});

test('installChunkErrorRecovery intercepts vite:preloadError, prevents default, and cleans up', () => {
  const listeners = new Map();
  const mockWindow = {
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type, fn) {
      if (listeners.get(type) === fn) {
        listeners.delete(type);
      }
    },
  };

  const storage = createMemoryStorage();
  let reloadCount = 0;
  let prevented = false;

  const cleanup = installChunkErrorRecovery(mockWindow, {
    storage,
    reload: () => { reloadCount += 1; },
    navigatorObj: { onLine: true },
    now: () => 1_700_000_000_000,
  });

  assert.ok(listeners.has('vite:preloadError'));

  listeners.get('vite:preloadError')({
    payload: new Error('Unable to preload CSS for /assets/index-old.css'),
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(reloadCount, 1);
  assert.equal(prevented, true);

  cleanup();
  assert.equal(listeners.has('vite:preloadError'), false);
});

test('forceAppReload clears cooldown, triggers SW update, and reloads', async () => {
  const storage = createMemoryStorage({ [CHUNK_RELOAD_STORAGE_KEY]: '1700000000000' });
  let updated = false;
  let reloaded = false;

  await forceAppReload({
    storage,
    reload: () => { reloaded = true; },
    navigatorObj: {
      serviceWorker: {
        async getRegistration() {
          return {
            async update() {
              updated = true;
            },
          };
        },
      },
    },
  });

  assert.equal(storage.getItem(CHUNK_RELOAD_STORAGE_KEY), null);
  assert.equal(updated, true);
  assert.equal(reloaded, true);
});
