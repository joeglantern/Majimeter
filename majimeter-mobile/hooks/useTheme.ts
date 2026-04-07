// useTheme.ts
// Returns the correct color set based on the user's current color scheme.
// Components import this hook instead of importing Colors directly.

import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Theme';

export function useTheme() {
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const isDark = scheme === 'dark';

  return {
    isDark,
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
