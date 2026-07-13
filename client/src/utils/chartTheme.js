export function getChartTheme(resolvedTheme) {
  const isDark = resolvedTheme === "dark";

  return {
    axis: isDark ? "#94a3b8" : "#64748b", // slate-400 : slate-500
    grid: isDark ? "#1e293b" : "#e2e8f0", // slate-800 : slate-200
    tooltipBackground: isDark ? "#0f172a" : "#ffffff", // slate-900 : white
    tooltipBorder: isDark ? "#334155" : "#cbd5e1", // slate-700 : slate-300
    tooltipText: isDark ? "#f8fafc" : "#0f172a", // slate-50 : slate-900
    colors: {
      profit: "#10b981", // emerald-500
      loss: "#ef4444", // red-500
      breakeven: isDark ? "#94a3b8" : "#64748b",
      primary: "#8b5cf6", // violet-500
      secondary: "#3b82f6", // blue-500
    }
  };
}
