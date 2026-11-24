import { lazy } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'jahz_chunk_recovery_at';
export const CHUNK_RELOAD_COOLDOWN_MS = 15000;

const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Loading CSS chunk [\w-]+ failed|Unable to preload CSS for|Failed to load module script/i;

function getDefaultStorage() {
  return typeof window !== 'undefined' ? window.sessionStorage : null;
}

function getDefaultNavigator() {
  return typeof window !== 'undefined' ? window.navigator : null;
}

function getDefaultReload() {
  return typeof window !== 'undefined'
    ? () => window.location.reload()
    : null;
}

/**
 * Returns true when an error comes from a stale/missing dynamic JS/CSS chunk.
 */
export function isChunkLoadError(error) {
  if (!error) return false;
  if (error?.name === 'ChunkLoadError') return true;
  const message = typeof error === 'string' ? error : error?.message;
  return typeof message === 'string' && CHUNK_LOAD_ERROR_PATTERN.test(message);
}

/**
 * Safely clears the chunk recovery reload cooldown marker.
 */
export function clearChunkRecoveryCooldown(storage = getDefaultStorage()) {
  try {
    storage?.removeItem?.(CHUNK_RELOAD_STORAGE_KEY);
  } catch {
    // Ignore storage access errors (e.g. private browsing restrictions).
  }
}

/**
 * Triggers a guarded page reload once per cooldown window after a chunk error.
 * Passing `undefined` as `error` is permitted for `vite:preloadError` events
 * whose `payload` is omitted.
 */
export function attemptChunkRecoveryReload(error, options = {}) {
  if (error !== undefined && !isChunkLoadError(error)) {
    return false;
  }

  const {
    storage = getDefaultStorage(),
    reload = getDefaultReload(),
    navigatorObj = getDefaultNavigator(),
    now = Date.now,
  } = options;

  if (navigatorObj && navigatorObj.onLine === false) {
    return false;
  }

  const currentTime = now();

  try {
    const prevRaw = storage?.getItem?.(CHUNK_RELOAD_STORAGE_KEY);
    if (prevRaw !== null && prevRaw !== undefined && prevRaw !== '') {
      const prevTime = Number(prevRaw);
      if (Number.isFinite(prevTime) && currentTime - prevTime < CHUNK_RELOAD_COOLDOWN_MS) {
        return false;
      }
    }
    storage?.setItem?.(CHUNK_RELOAD_STORAGE_KEY, String(currentTime));
  } catch {
    // Storage failure should still allow one best-effort reload when reload exists.
  }

  if (typeof reload !== 'function') {
    return false;
  }

  reload();
  return true;
}

/**
 * Wraps a dynamic import() call so chunk mismatches silently trigger one reload
 * while keeping Suspense visible instead of crashing into ErrorBoundary.
 */
export function loadChunkWithRetry(importer, options = {}) {
  return importer().catch((error) => {
    if (isChunkLoadError(error) && attemptChunkRecoveryReload(error, options)) {
      return new Promise(() => {});
    }
    throw error;
  });
}

/**
 * Drop-in replacement for React.lazy() with automatic stale-chunk reload recovery.
 */
export function lazyWithRetry(importer) {
  return lazy(() => loadChunkWithRetry(importer));
}

/**
 * Listens for Vite's `vite:preloadError` event and recovers cleanly.
 */
export function installChunkErrorRecovery(
  targetWindow = typeof window !== 'undefined' ? window : undefined,
  options = {},
) {
  if (typeof targetWindow === 'undefined' || !targetWindow?.addEventListener) {
    return () => {};
  }

  const handlePreloadError = (event) => {
    const reloaded = attemptChunkRecoveryReload(event?.payload, options);
    if (reloaded && typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  targetWindow.addEventListener('vite:preloadError', handlePreloadError);
  return () => {
    targetWindow.removeEventListener?.('vite:preloadError', handlePreloadError);
  };
}

/**
 * Clears chunk recovery cooldown, asks the Service Worker to check for updates
 * without blocking, and reloads the application.
 */
export async function forceAppReload(options = {}) {
  const {
    storage = getDefaultStorage(),
    reload = getDefaultReload(),
    navigatorObj = getDefaultNavigator(),
    timeoutMs = 1500,
  } = options;

  clearChunkRecoveryCooldown(storage);

  try {
    const sw = navigatorObj?.serviceWorker;
    if (sw && typeof sw.getRegistration === 'function') {
      const updateTask = sw
        .getRegistration()
        .then((registration) => registration?.update?.())
        .catch(() => {});
      await Promise.race([
        updateTask,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }
  } catch {
    // Never block reload if Service Worker update check fails.
  }

  if (typeof reload === 'function') {
    reload();
  }
}
