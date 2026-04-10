// useTheme.ts
// Returns the correct color set based on the active color scheme.
// ThemeProvider must wrap the app to enable toggleTheme.

import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Theme';

// ── Theme context ─────────────────────────────────────────────────────────────

type ThemeOverride = 'light' | 'dark' | null;

const ThemeContext = createContext<{
  override: ThemeOverride;
  toggleTheme: () => void;
}>({ override: null, toggleTheme: () => {} });

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<ThemeOverride>(null);

  const toggleTheme = () => {
    const current = override ?? system;
    setOverride(current === 'dark' ? 'light' : 'dark');
  };

  return React.createElement(ThemeContext.Provider, { value: { override, toggleTheme } }, children);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme() {
  const scheme = useColorScheme();
  const { override, toggleTheme } = useContext(ThemeContext);
  const isDark = override !== null ? override === 'dark' : scheme === 'dark';

  return {
    isDark,
    toggleTheme,
    colors: {
      primary: Colors.primary,
      primaryLight: Colors.primaryLight,
      primaryDark: Colors.primaryDark,
      water: Colors.water,
      waterDark: Colors.waterDark,
      success: Colors.success,
      successLight: Colors.successLight,
      warning: Colors.warning,
      warningLight: Colors.warningLight,
      critical: Colors.critical,
      criticalLight: Colors.criticalLight,
      info: Colors.info,

      background: isDark ? Colors.dark.background : Colors.background,
      surface: isDark ? Colors.dark.surface : Colors.surface,
      surfaceSecondary: isDark ? Colors.dark.surfaceSecondary : Colors.surfaceSecondary,

      textPrimary: isDark ? Colors.dark.textPrimary : Colors.textPrimary,
      textSecondary: isDark ? Colors.dark.textSecondary : Colors.textSecondary,
      textMuted: isDark ? Colors.dark.textMuted : Colors.textMuted,
      textInverse: Colors.textInverse,

      border: isDark ? Colors.dark.border : Colors.border,
      borderStrong: isDark ? Colors.dark.borderStrong : Colors.borderStrong,
      divider: isDark ? Colors.dark.divider : Colors.divider,
    },
  };
}
