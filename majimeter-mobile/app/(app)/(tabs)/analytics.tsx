// app/(app)/(tabs)/analytics.tsx
// Analytics/Insights Screen — Screen 7 (Admin Only)
// High-level system health and usage trends.
// Bubbly visual indicators and trend cards.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChartBar,
  TrendUp,
  TrendDown,
  Water,
  Warning,
  Users,
  CaretRight,
} from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';

const { width } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  value: string | number;
  trend: number; // percentage
  icon: any;
  color: string;
}

export default function AnalyticsScreen() {
  const { isAdmin } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading for the UI demonstration
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Warning size={48} color={colors.textMuted} />
        <Text style={[styles.deniedText, { color: colors.textPrimary }]}>Access Restricted</Text>
        <Text style={[styles.deniedSub, { color: colors.textSecondary }]}>This screen is for administrators only.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Insights</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Network trends for the last 30 days</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 100 }} />
        ) : (
          <>
            {/* ── Main KPIs ────────────────────────────────────────────── */}
            <View style={styles.metricsRow}>
              <MetricCard
                label="Total Usage"
                value="1.2M L"
                trend={12}
                icon={Water}
                color={Colors.water}
                colors={colors}
              />
              <MetricCard
                label="New Users"
                value="452"
                trend={-5}
                icon={Users}
                color={Colors.primary}
                colors={colors}
              />
            </View>

            {/* ── Trend Section ─────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Usage Trend</Text>
              <View style={[styles.chartPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                {/* Manual "Human Crafted" bar indicators */}
                <View style={styles.chartBars}>
                  {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                    <View key={i} style={styles.barWrapper}>
                      <View style={[styles.bar, { height: h, backgroundColor: Colors.primaryLight }]} />
                      <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* ── Reports Analytics ─────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Resolution Speed</Text>
              <View style={[styles.speedCard, Shadows.card, { backgroundColor: colors.surface }]}>
                <View style={styles.speedInfo}>
                  <Text style={[styles.speedValue, { color: Colors.success }]}>4.2 hrs</Text>
                  <Text style={[styles.speedLabel, { color: colors.textSecondary }]}>Avg. response time</Text>
                </View>
                <View style={styles.speedTrend}>
                  <TrendUp size={16} color={Colors.success} />
                  <Text style={[styles.speedTrendText, { color: Colors.success }]}>15% faster</Text>
                </View>
              </View>
            </View>

            {/* ── Recent Alerts List ───────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Activity</Text>
              <CaretRight size={20} color={colors.textMuted} />
            </View>
            <View style={styles.list}>
              <ActivityItem
                title="Pressure drop at Kilimani East"
                time="2h ago"
                type="alert"
                colors={colors}
              />
              <ActivityItem
                title="New Water Point verified: Langata 4"
                time="5h ago"
                type="event"
                colors={colors}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, trend, icon: Icon, color, colors }: any) {
  const isUp = trend >= 0;
  return (
    <View style={[styles.metricCard, Shadows.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.metricIconBg, { backgroundColor: color + '15' }]}>
        <Icon size={24} color={color} weight="fill" />
      </View>
      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.trendRow}>
        {isUp ? <TrendUp size={14} color={Colors.success} /> : <TrendDown size={14} color={Colors.critical} />}
        <Text style={[styles.trendText, { color: isUp ? Colors.success : Colors.critical }]}>
          {Math.abs(trend)}% vs last month
        </Text>
      </View>
    </View>
  );
}

function ActivityItem({ title, time, type, colors }: any) {
  return (
    <View style={[styles.activityItem, { borderBottomColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: type === 'alert' ? Colors.critical : Colors.success }]} />
      <View style={styles.activityInfo}>
        <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.activityTime, { color: colors.textMuted }]}>{time}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  title: { fontSize: Typography.xxl, fontWeight: Typography.heavy, letterSpacing: -0.5 },
  subtitle: { fontSize: Typography.sm, marginTop: 4 },
  
  metricsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  metricCard: { flex: 1, padding: Spacing.lg, borderRadius: Radii.card, gap: 4 },
  metricIconBg: { width: 44, height: 44, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { fontSize: Typography.xl, fontWeight: Typography.heavy },
  metricLabel: { fontSize: Typography.xs, fontWeight: Typography.medium },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  trendText: { fontSize: 10, fontWeight: Typography.bold },

  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: Typography.md, fontWeight: Typography.bold },
  
  chartPlaceholder: { height: 160, borderRadius: Radii.card, padding: Spacing.md, justifyContent: 'flex-end' },
  chartBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%' },
  barWrapper: { alignItems: 'center', gap: 8 },
  bar: { width: 14, borderRadius: 7 },
  barLabel: { fontSize: 10, fontWeight: Typography.medium },

  speedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderRadius: Radii.card },
  speedInfo: { gap: 2 },
  speedValue: { fontSize: Typography.xl, fontWeight: Typography.heavy },
  speedLabel: { fontSize: Typography.sm, fontWeight: Typography.medium },
  speedTrend: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill },
  speedTrendText: { fontSize: 10, fontWeight: Typography.bold },

  list: { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activityInfo: { flex: 1, gap: 2 },
  activityTitle: { fontSize: Typography.sm, fontWeight: Typography.medium },
  activityTime: { fontSize: Typography.xs },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  deniedText: { fontSize: Typography.xl, fontWeight: Typography.bold },
  deniedSub: { fontSize: Typography.sm, textAlign: 'center' },
});
