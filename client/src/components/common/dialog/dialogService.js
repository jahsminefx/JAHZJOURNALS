/**
 * Pure JavaScript Dialog Service for JAHZJOURNALS
 * Provides a Promise-based API for custom confirmations, alerts, and prompts.
 */

let globalOverlayHandler = null;

export const registerOverlayHandler = (handler) => {
  globalOverlayHandler = handler;
  return () => {
    if (globalOverlayHandler === handler) {
      globalOverlayHandler = null;
    }
  };
};

export const getOverlayHandler = () => globalOverlayHandler;

export const dialog = {
  confirm: (options = {}) => {
    if (globalOverlayHandler?.confirm) {
      return globalOverlayHandler.confirm(options);
    }
    console.warn('[JAHZJOURNALS dialog] OverlayProvider is not mounted. Defaulting to false.');
    return Promise.resolve(false);
  },
  prompt: (options = {}) => {
    if (globalOverlayHandler?.prompt) {
      return globalOverlayHandler.prompt(options);
    }
    console.warn('[JAHZJOURNALS dialog] OverlayProvider is not mounted. Defaulting to null.');
    return Promise.resolve(null);
  },
  alert: (options = {}) => {
    if (globalOverlayHandler?.alert) {
      return globalOverlayHandler.alert(options);
    }
    console.warn('[JAHZJOURNALS dialog] OverlayProvider is not mounted.');
    return Promise.resolve();
  },
  danger: (options = {}) => dialog.confirm({ ...options, variant: 'danger' }),
  warning: (options = {}) => dialog.confirm({ ...options, variant: 'warning' }),
  info: (options = {}) => dialog.alert({ ...options, type: 'info' }),
  error: (options = {}) => dialog.alert({ ...options, type: 'error' }),
  success: (options = {}) => dialog.alert({ ...options, type: 'success' }),
};

export default dialog;
