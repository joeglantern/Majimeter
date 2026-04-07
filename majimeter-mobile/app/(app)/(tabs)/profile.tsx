// app/(app)/(tabs)/profile.tsx — Placeholder (full implementation next)
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Typography, Spacing, Radii, Shadows } from '@/constants/Theme';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  return (
    <View style={[styles.c, { backgroundColor: colors.background }]}>
      <View style={[styles.avatar, { backgroundColor: Colors.primaryLight }]}>
        <Text style={styles.initials}>
          {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'}
        </Text>
      </View>
      <Text style={[styles.name, { color: colors.textPrimary }]}>{user?.name}</Text>
      <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
      <View style={[styles.rolePill, { backgroundColor: Colors.primaryLight }]}>
        <Text style={[styles.roleText, { color: Colors.primary }]}>{user?.role}</Text>
      </View>
      <Pressable style={[styles.logoutBtn, { borderColor: Colors.critical }]} onPress={logout}>
        <Text style={[styles.logoutText, { color: Colors.critical }]}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: Typography.xl, fontWeight: Typography.heavy, color: Colors.primary },
  name: { fontSize: Typography.lg, fontWeight: Typography.bold },
  email: { fontSize: Typography.sm },
  rolePill: { borderRadius: Radii.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  roleText: { fontSize: Typography.sm, fontWeight: Typography.semibold, textTransform: 'capitalize' },
  logoutBtn: { marginTop: Spacing.xl, borderWidth: 1.5, borderRadius: Radii.pill, paddingHorizontal: Spacing.xl, paddingVertical: 12 },
  logoutText: { fontSize: Typography.base, fontWeight: Typography.semibold },
});
