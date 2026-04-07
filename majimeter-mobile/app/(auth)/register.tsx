// app/(auth)/register.tsx
// Register Screen — Screen 2
// Same structural DNA as Login but with 4 fields + confirm password.

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
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User, EnvelopeSimple, Lock, Eye, EyeSlash, Phone } from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Typography, Spacing, Radii, Shadows } from '@/constants/Theme';

interface Fields {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Fields>({});

  const btnScale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const pressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();

  const clearError = (field: keyof Fields) =>
    setErrors(e => ({ ...e, [field]: undefined }));

  const validate = () => {
    const e: Fields = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (password.length < 6) e.password = 'Minimum 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, phone.trim() || undefined);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? 'Could not create account. Please try again.';
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back button ───────────────────────────────────────────── */}
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Join your community's water network.
          </Text>
        </View>

        {/* ── Form card ─────────────────────────────────────────────── */}
        <View style={[styles.card, Shadows.card, { backgroundColor: colors.surface }]}>
          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          )}

          {/* Full name */}
          <FieldBlock label="Full Name" error={errors.name}>
            <InputRow
              icon={<User size={18} color={errors.name ? Colors.critical : colors.textMuted} />}
              value={name}
              onChangeText={t => { setName(t); clearError('name'); }}
              placeholder="Liban Hassan"
              backgroundColor={colors.surfaceSecondary}
              borderColor={errors.name ? Colors.critical : colors.border}
              textColor={colors.textPrimary}
              placeholderColor={colors.textMuted}
            />
          </FieldBlock>

          {/* Email */}
          <FieldBlock label="Email" error={errors.email}>
            <InputRow
              icon={<EnvelopeSimple size={18} color={errors.email ? Colors.critical : colors.textMuted} />}
              value={email}
              onChangeText={t => { setEmail(t); clearError('email'); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              backgroundColor={colors.surfaceSecondary}
              borderColor={errors.email ? Colors.critical : colors.border}
              textColor={colors.textPrimary}
              placeholderColor={colors.textMuted}
            />
          </FieldBlock>

          {/* Phone (optional) */}
          <FieldBlock label="Phone (optional)" error={errors.phone}>
            <InputRow
              icon={<Phone size={18} color={colors.textMuted} />}
              value={phone}
              onChangeText={t => { setPhone(t); clearError('phone'); }}
              placeholder="+254 700 000 000"
              keyboardType="phone-pad"
              backgroundColor={colors.surfaceSecondary}
              borderColor={colors.border}
              textColor={colors.textPrimary}
              placeholderColor={colors.textMuted}
            />
          </FieldBlock>

          {/* Password */}
          <FieldBlock label="Password" error={errors.password}>
            <InputRow
              icon={<Lock size={18} color={errors.password ? Colors.critical : colors.textMuted} />}
              value={password}
              onChangeText={t => { setPassword(t); clearError('password'); }}
              placeholder="Min. 6 characters"
              secureTextEntry={!showPassword}
              backgroundColor={colors.surfaceSecondary}
              borderColor={errors.password ? Colors.critical : colors.border}
              textColor={colors.textPrimary}
              placeholderColor={colors.textMuted}
              rightElement={
                <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                  {showPassword
                    ? <Eye size={18} color={colors.textMuted} />
                    : <EyeSlash size={18} color={colors.textMuted} />}
                </Pressable>
              }
            />
          </FieldBlock>

          {/* Confirm password */}
          <FieldBlock label="Confirm Password" error={errors.confirmPassword}>
            <InputRow
              icon={<Lock size={18} color={errors.confirmPassword ? Colors.critical : colors.textMuted} />}
              value={confirmPassword}
              onChangeText={t => { setConfirmPassword(t); clearError('confirmPassword'); }}
              placeholder="Repeat password"
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              backgroundColor={colors.surfaceSecondary}
              borderColor={errors.confirmPassword ? Colors.critical : colors.border}
              textColor={colors.textPrimary}
              placeholderColor={colors.textMuted}
              rightElement={
                <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={10}>
                  {showConfirm
                    ? <Eye size={18} color={colors.textMuted} />
                    : <EyeSlash size={18} color={colors.textMuted} />}
                </Pressable>
              }
            />
          </FieldBlock>

          {/* CTA */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              style={[styles.btn, { backgroundColor: Colors.primary }, isLoading && styles.btnDisabled]}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Create Account</Text>}
            </Pressable>
          </Animated.View>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={[styles.loginHint, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.loginLink, { color: Colors.primary }]}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Small reusable subcomponents (file-scoped) ──────────────────────────────────

function FieldBlock({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function InputRow({
  icon,
  rightElement,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  returnKeyType,
  onSubmitEditing,
  backgroundColor,
  borderColor,
  textColor,
  placeholderColor,
}: {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
}) {
  return (
    <View style={[styles.inputWrapper, { backgroundColor, borderColor }]}>
      {icon}
      <TextInput
        style={[styles.input, { color: textColor }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {rightElement}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.md, gap: Spacing.lg },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  header: { gap: 4 },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.base,
    fontWeight: Typography.regular,
  },

  card: {
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
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
    paddingVertical: 0,
  },
  fieldError: {
    color: Colors.critical,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    marginLeft: 4,
  },

  btn: {
    height: 54,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.fab,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    letterSpacing: 0.3,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginHint: { fontSize: Typography.sm },
  loginLink: { fontSize: Typography.sm, fontWeight: Typography.semibold },
});
