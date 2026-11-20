import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '../utils/settings';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

const resolveThemeValue = (targetTheme) => {
  if (targetTheme === THEMES.SYSTEM) {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
    }
    return THEMES.DARK;
  }
  return targetTheme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('jahzjournals-theme');
      if (stored && Object.values(THEMES).includes(stored)) {
        return stored;
      }
      
      const settings = loadSettings();
      if (settings?.appearance?.theme) {
        return settings.appearance.theme;
      }
      return THEMES.SYSTEM;
    } catch {
      return THEMES.SYSTEM;
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => resolveThemeValue(theme));

  useEffect(() => {
    try {
      localStorage.setItem('jahzjournals-theme', theme);
      const currentSettings = loadSettings();
      if (currentSettings?.appearance?.theme !== theme) {
        saveSettings({
          ...currentSettings,
          appearance: {
            ...(currentSettings?.appearance || {}),
            theme,
          },
        });
      }
    } catch (e) {}

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const nextResolved = resolveThemeValue(theme);
    root.classList.add(nextResolved);
    setResolvedTheme(nextResolved);
  }, [theme]);

  useEffect(() => {
    const mediaObj = window.matchMedia('(prefers-color-scheme: dark)');
    const changeHandler = (e) => {
      if (theme !== THEMES.SYSTEM) return;
      
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };
    
    mediaObj.addEventListener('change', changeHandler);
    return () => mediaObj.removeEventListener('change', changeHandler);
  }, [theme]);

  useEffect(() => {
    const handleAuthSync = (e) => {
      if (e.detail) {
        setTheme(e.detail);
      }
    };
    window.addEventListener('theme-sync', handleAuthSync);
    return () => window.removeEventListener('theme-sync', handleAuthSync);
  }, []);

  const toggleTheme = () => {
    const nextTheme = resolvedTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
