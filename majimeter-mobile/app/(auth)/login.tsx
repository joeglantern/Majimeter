// app/(auth)/login.tsx
// Login Screen — Screen 1
// Clean, friendly, human-crafted design.
// Large drop logo on top, slide-up form card with pill inputs and CTA.

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Drop, Eye, EyeSlash, EnvelopeSimple, Lock } from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Typography, Spacing, Radii, Shadows } from '@/constants/Theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  // Animated button press scale
  const btnScale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const pressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password.trim()) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    try {
      await login(email.trim().toLowerCase(), password);
      // AuthProvider updates state → auth layout redirects to app
    } catch (err: any) {
      const message = err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero top section ─────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
          <View style={styles.logoRing}>
            <Drop size={40} color={Colors.primary} weight="fill" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>MajiMeter</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Smart water for everyone.
          </Text>
        </View>

        {/* ── Form card ────────────────────────────────────────────── */}
        <View style={[styles.card, Shadows.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Welcome back 👋</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Sign in to your account
          </Text>

          {/* General error banner */}
          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          )}

          {/* Email field */}
          <View style={styles.fieldGap}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: errors.email ? Colors.critical : colors.border,
                },
              ]}
            >
              <EnvelopeSimple
                size={18}
                color={errors.email ? Colors.critical : colors.textMuted}
                weight="regular"
              />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
          </View>

          {/* Password field */}
          <View style={styles.fieldGap}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: errors.password ? Colors.critical : colors.border,
                },
              ]}
            >
              <Lock
                size={18}
                color={errors.password ? Colors.critical : colors.textMuted}
                weight="regular"
              />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: undefined })); }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword(v => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword
                  ? <Eye size={18} color={colors.textMuted} />
                  : <EyeSlash size={18} color={colors.textMuted} />}
              </Pressable>
            </View>
            {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
          </View>

          {/* Forgot password */}
          <Pressable onPress={() => {}} style={styles.forgotRow}>
            <Text style={[styles.forgotText, { color: Colors.primary }]}>Forgot password?</Text>
          </Pressable>

          {/* Sign in CTA */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              style={[styles.btn, { backgroundColor: Colors.primary }, isLoading && styles.btnDisabled]}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Sign In</Text>}
            </Pressable>
          </Animated.View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Register link */}
          <Pressable
            style={[styles.ghostBtn, { borderColor: colors.borderStrong }]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={[styles.ghostBtnText, { color: colors.textPrimary }]}>
              Create an account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.md },

  // ── Hero ──────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: Radii.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: Typography.base,
    fontWeight: Typography.regular,
    marginTop: 4,
  },

  // ── Card ──────────────────────────────────────────────
  card: {
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: Typography.sm,
    fontWeight: Typography.regular,
    marginTop: -Spacing.sm,
  },

  // ── Error banner ──────────────────────────────────────
  errorBanner: {
    backgroundColor: Colors.criticalLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  errorBannerText: {
    color: Colors.critical,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },

  // ── Fields ────────────────────────────────────────────
  fieldGap: { gap: 6 },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: Typography.regular,
    paddingVertical: 0, // removes Android default padding
  },
  fieldError: {
    color: Colors.critical,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    marginLeft: 4,
  },

  // ── Forgot ────────────────────────────────────────────
  forgotRow: { alignItems: 'flex-end', marginTop: -Spacing.sm },
  forgotText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },

  // ── Buttons ───────────────────────────────────────────
  btn: {
    height: 54,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.fab,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    letterSpacing: 0.3,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontSize: Typography.sm,
  },

  ghostBtn: {
    height: 54,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
  },
});
