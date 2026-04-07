// app/(app)/(tabs)/profile.tsx
// Profile Screen — Screen 8
// Human crafted personal workspace.
// Bubbly settings, role badge, and session management.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Bell,
  Lock,
  Question,
  SignOut,
  CaretRight,
  Sun,
  Moon,
  ShieldCheck,
} from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';

export default function ProfileScreen() {
  const { user, logout, isAdmin, isTechnician } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'MM';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.initials, { color: Colors.primary }]}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: Colors.primaryLight }]}>
              <ShieldCheck size={14} color={Colors.primary} weight="bold" />
              <Text style={[styles.roleText, { color: Colors.primary }]}>
                {user?.role?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Settings Sections ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                  {isDark ? <Moon size={20} color={Colors.primary} /> : <Sun size={20} color={Colors.warning} />}
                </View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#eee', true: Colors.primary }}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingItem
              icon={Bell}
              label="Notifications"
              color="#FDF2F8"
              iconColor="#DB2777"
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
            <SettingItem
              icon={User}
              label="Edit Profile"
              color="#F0FDF4"
              iconColor="#15803D"
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingItem
              icon={Lock}
              label="Security"
              color="#FEFCE8"
              iconColor="#A16207"
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SUPPORT</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
            <SettingItem
              icon={Question}
              label="Help Center"
              color="#F5F3FF"
              iconColor="#7C3AED"
              colors={colors}
            />
          </View>
        </View>

        {/* ── Sign Out ──────────────────────────────────────────── */}
        <Pressable 
          style={[styles.signOutBtn, { borderColor: Colors.critical }]}
          onPress={logout}
        >
          <SignOut size={20} color={Colors.critical} weight="bold" />
          <Text style={[styles.signOutText, { color: Colors.critical }]}>Sign Out</Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.textMuted }]}>MajiMeter v1.0.0 (Expo SDK 54)</Text>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SettingItem({ icon: Icon, label, color, iconColor, colors }: any) {
  return (
    <Pressable style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconBox, { backgroundColor: color }]}>
          <Icon size={20} color={iconColor} />
        </View>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <CaretRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
  },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: Typography.xl, fontWeight: Typography.bold },
  userEmail: { fontSize: Typography.sm },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: Typography.heavy,
    letterSpacing: 0.5,
  },

  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionTitle: {
    fontSize: 11,
    fontWeight: Typography.heavy,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  settingsGroup: {
    borderRadius: Radii.card,
    overflow: 'hidden',
    ...Shadows.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },

  signOutBtn: {
    margin: Spacing.lg,
    marginTop: 40,
    height: 56,
    borderRadius: Radii.pill,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  signOutText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  version: {
    textAlign: 'center',
    fontSize: Typography.xs,
    marginBottom: 20,
  },
});
