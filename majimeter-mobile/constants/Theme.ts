// MajiMeter Design Tokens
// The single source of truth for all visual decisions in the app.

export const Colors = {
  // ── Brand ─────────────────────────────────────────────
  primary: '#007AFF',       // Vibrant Apple-blue, CTAs & active states
  primaryLight: '#E8F3FF',  // Soft blue tint for backgrounds / tag fills
  primaryDark: '#0056CC',   // Press state for primary button

  // ── Water / Data Accents ──────────────────────────────
  water: '#38BDF8',         // Cyan — water level indicators, liquid visuals
  waterDark: '#0284C7',     // Deeper cyan for contrast

  // ── Status ────────────────────────────────────────────
  success: '#34C759',       // Bright green — active/ok states
  successLight: '#E6F9ED',
  warning: '#FF9500',       // Friendly amber — warnings
  warningLight: '#FFF3E0',
  critical: '#FF3B30',      // Bright red — critical alerts
  criticalLight: '#FFEBEA',
  info: '#007AFF',

  // ── Backgrounds ───────────────────────────────────────
  background: '#F2F2F7',    // iOS system grouped background
  surface: '#FFFFFF',       // Cards, modals
  surfaceSecondary: '#F9FAFB', // Nested card backgrounds

  // ── Text ──────────────────────────────────────────────
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // ── Borders ───────────────────────────────────────────
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  divider: '#F3F4F6',

  // ── Dark theme overrides (used when colorScheme === 'dark') ───────
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    borderStrong: '#475569',
    divider: '#1E293B',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  card: 24,   // Standard card radius — bubbly feel
  pill: 999,  // Pills, FABs, tags
};

export const Shadows = {
  // iOS-style card shadow
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  // Larger for modals / bottom sheets
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  // Floating action buttons
  fab: {
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const Typography = {
  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  hero: 40,

  // Weights (cast to valid React Native fontWeight values)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};
