import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme, THEMES } from '../context/ThemeProvider';

const ThemeToggle = ({ className = '' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-surface-muted text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-background ${className}`}
      aria-label={`Toggle theme. Current theme is ${resolvedTheme}`}
      title="Toggle Theme"
    >
      {resolvedTheme === THEMES.DARK ? (
        <Moon size={20} className="text-emerald-400" />
      ) : (
        <Sun size={20} className="text-amber-500 shadow-amber-500/50" />
      )}
    </button>
  );
};

export default ThemeToggle;
