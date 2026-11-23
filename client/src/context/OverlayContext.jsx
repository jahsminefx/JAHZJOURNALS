import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { dialog, registerOverlayHandler } from '../components/common/dialog/dialogService';

export const OverlayContext = createContext(null);

export { dialog, registerOverlayHandler };

export const OverlayProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);

  const closeDialog = useCallback((result = null) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setDialogState(null);
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        id: `dialog-${Date.now()}`,
        type: 'confirm',
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'primary', // 'danger' | 'warning' | 'primary'
        allowBackdropDismiss: options.allowBackdropDismiss ?? (options.variant !== 'danger'),
        isOpen: true,
      });
    });
  }, []);

  const prompt = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        id: `prompt-${Date.now()}`,
        type: 'prompt',
        title: options.title || 'Input Required',
        message: options.message || '',
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        inputType: options.inputType || 'text',
        confirmText: options.confirmText || 'Submit',
        cancelText: options.cancelText || 'Cancel',
        required: options.required ?? false,
        validate: options.validate,
        allowBackdropDismiss: options.allowBackdropDismiss ?? true,
        isOpen: true,
      });
    });
  }, []);

  const alert = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = () => resolve();
      setDialogState({
        id: `alert-${Date.now()}`,
        type: 'alert',
        alertType: options.type || 'info', // 'info' | 'error' | 'success' | 'warning'
        title: options.title || 'Notice',
        message: options.message || '',
        confirmText: options.confirmText || 'Close',
        allowBackdropDismiss: options.allowBackdropDismiss ?? true,
        isOpen: true,
      });
    });
  }, []);

  React.useEffect(() => {
    const unregister = registerOverlayHandler({
      confirm,
      prompt,
      alert,
    });
    return unregister;
  }, [confirm, prompt, alert]);

  return (
    <OverlayContext.Provider
      value={{
        dialogState,
        closeDialog,
        confirm,
        prompt,
        alert,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
};

export const useOverlay = () => {
  const context = useContext(OverlayContext);
  if (!context) {
    return {
      dialogState: null,
      closeDialog: () => {},
      confirm: dialog.confirm,
      prompt: dialog.prompt,
      alert: dialog.alert,
    };
  }
  return context;
};
