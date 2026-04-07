// app/(app)/(tabs)/analytics.tsx — Placeholder (admin only, full build next)
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Theme';

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.c, { backgroundColor: colors.background }]}>
      <Text style={{ fontSize: Typography.xl, color: colors.textPrimary }}>📊 Insights</Text>
      <Text style={{ color: colors.textMuted }}>Coming next</Text>
    </View>
  );
}
const styles = StyleSheet.create({ c: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 } });
