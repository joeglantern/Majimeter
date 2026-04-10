// app/(app)/(tabs)/analytics.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChartBar,
  Drop,
  Warning,
  BellSimpleRinging,
  CheckSquare,
  Activity,
  WaveTriangle,
  ArrowDown,
  ArrowsLeftRight,
  WaveSine,
  ShieldWarning,
} from 'phosphor-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';

const { width } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────

interface Summary {
  active_water_points: number;
  total_water_points: number;
  open_reports: number;
  active_alerts: number;
  critical_alerts: number;
  readings_today: number;
}

interface Anomaly {
  id: string;
  water_point_id: string;
  water_point_name: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  low_level:     'Low Water Level',
  high_pressure: 'High Pressure',
  low_pressure:  'Low Pressure',
  no_flow:       'No Flow Detected',
  leak_detected: 'Leak Detected',
};

const ANOMALY_ICONS: Record<string, any> = {
  low_level:     ArrowDown,
  high_pressure: ArrowsLeftRight,
  low_pressure:  ArrowsLeftRight,
  no_flow:       WaveSine,
  leak_detected: Drop,
};

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, anomRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/anomalies', { params: { limit: 10 } }),
      ]);
      setSummary(sumRes.data.data ?? null);
      setAnomalies(anomRes.data.data ?? []);
    } catch (err) {
      console.warn('Analytics fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const waterPointHealth = summary
    ? Math.round((summary.active_water_points / Math.max(summary.total_water_points, 1)) * 100)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); fetchData(); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Insights</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>System overview</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* ── Summary KPIs ──────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(0).springify().damping(16)}>
              <View style={styles.kpiGrid}>
                <KpiCard
                  label="Active Points"
                  value={`${summary?.active_water_points ?? 0} / ${summary?.total_water_points ?? 0}`}
                  icon={Drop}
                  color={Colors.water}
                  colors={colors}
                />
                <KpiCard
                  label="Open Reports"
                  value={summary?.open_reports ?? 0}
                  icon={ChartBar}
                  color={Colors.critical}
                  colors={colors}
                  alert={!!summary?.open_reports}
                />
              </View>
              <View style={styles.kpiGrid}>
                <KpiCard
                  label="Active Alerts"
                  value={summary?.active_alerts ?? 0}
                  subValue={summary?.critical_alerts ? `${summary.critical_alerts} critical` : undefined}
                  icon={BellSimpleRinging}
                  color={Colors.warning}
                  colors={colors}
                  alert={!!summary?.critical_alerts}
                />
                <KpiCard
                  label="Readings Today"
                  value={summary?.readings_today ?? 0}
                  icon={Activity}
                  color={Colors.primary}
                  colors={colors}
                />
              </View>
            </Animated.View>

            {/* ── Network Health Bar ──────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(100).springify().damping(16)}>
              <View style={[styles.section]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Network Health</Text>
                <View style={[styles.healthCard, Shadows.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.healthHeader}>
                    <Text style={[styles.healthPct, { color: waterPointHealth >= 80 ? Colors.success : waterPointHealth >= 50 ? Colors.warning : Colors.critical }]}>
                      {waterPointHealth}%
                    </Text>
                    <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
                      {waterPointHealth >= 80 ? 'Healthy' : waterPointHealth >= 50 ? 'Degraded' : 'Critical'}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${waterPointHealth}%` as any,
                          backgroundColor:
                            waterPointHealth >= 80 ? Colors.success :
                            waterPointHealth >= 50 ? Colors.warning : Colors.critical,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.healthSub, { color: colors.textMuted }]}>
                    {summary?.active_water_points ?? 0} of {summary?.total_water_points ?? 0} water points online
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* ── Recent Anomalies ────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(200).springify().damping(16)}>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Recent Anomalies
                </Text>
                {anomalies.length === 0 ? (
                  <View style={[styles.emptyCard, Shadows.card, { backgroundColor: colors.surface }]}>
                    <CheckSquare size={28} color={Colors.success} weight="light" />
                    <Text style={[styles.emptyCardText, { color: colors.textMuted }]}>
                      No anomalies in the last 7 days
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.anomalyList, Shadows.card, { backgroundColor: colors.surface }]}>
                    {anomalies.map((item, index) => (
                      <AnomalyRow
                        key={item.id}
                        item={item}
                        isLast={index === anomalies.length - 1}
                        colors={colors}
                      />
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>

            {/* ── Severity Breakdown ──────────────────────────────── */}
            {anomalies.length > 0 && (
              <Animated.View entering={FadeInDown.delay(280).springify().damping(16)}>
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Severity Breakdown</Text>
                  <SeverityBreakdown anomalies={anomalies} colors={colors} />
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, subValue, icon: Icon, color, colors, alert,
}: {
  label: string; value: string | number; subValue?: string;
  icon: any; color: string; colors: any; alert?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, Shadows.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.kpiIconBg, { backgroundColor: color + '15' }]}>
        <Icon size={22} color={color} weight="fill" />
      </View>
      <Text style={[styles.kpiValue, { color: alert ? color : colors.textPrimary }]}>
        {value}
      </Text>
      {subValue && (
        <Text style={[styles.kpiSubValue, { color: color }]}>{subValue}</Text>
      )}
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ── Anomaly Row ─────────────────────────────────────────────────────────────────

function AnomalyRow({ item, isLast, colors }: { item: Anomaly; isLast: boolean; colors: any }) {
  const AnomalyIcon = ANOMALY_ICONS[item.type] ?? ShieldWarning;
  const typeLabel = ANOMALY_TYPE_LABELS[item.type] ?? item.type.replace(/_/g, ' ');
  const sevColor =
    item.severity === 'critical' ? Colors.critical :
    item.severity === 'warning'  ? Colors.warning  : Colors.info;

  return (
    <View style={[styles.anomalyRow, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.anomalyDot, { backgroundColor: sevColor + '20' }]}>
        <AnomalyIcon size={15} color={sevColor} />
      </View>
      <View style={styles.anomalyInfo}>
        <Text style={[styles.anomalyType, { color: colors.textPrimary }]} numberOfLines={1}>
          {typeLabel}
        </Text>
        <Text style={[styles.anomalyWp, { color: colors.textMuted }]} numberOfLines={1}>
          {item.water_point_name}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <View style={[styles.sevPill, { backgroundColor: sevColor + '15' }]}>
          <Text style={[styles.sevText, { color: sevColor }]}>{item.severity}</Text>
        </View>
        <Text style={[styles.anomalyTime, { color: colors.textMuted }]}>
          {timeAgo(item.triggered_at)}
        </Text>
      </View>
    </View>
  );
}

// ── Severity Breakdown ──────────────────────────────────────────────────────────

function SeverityBreakdown({ anomalies, colors }: { anomalies: Anomaly[]; colors: any }) {
  const counts = anomalies.reduce(
    (acc, a) => { acc[a.severity] = (acc[a.severity] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const total = anomalies.length;
  const bars: Array<{ key: string; label: string; color: string; count: number }> = [
    { key: 'critical', label: 'Critical', color: Colors.critical, count: counts.critical ?? 0 },
    { key: 'warning',  label: 'Warning',  color: Colors.warning,  count: counts.warning  ?? 0 },
    { key: 'info',     label: 'Info',     color: Colors.info,     count: counts.info     ?? 0 },
  ];

  return (
    <View style={[styles.breakdownCard, Shadows.card, { backgroundColor: colors.surface }]}>
      {bars.map(bar => (
        <View key={bar.key} style={styles.breakdownRow}>
          <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>{bar.label}</Text>
          <View style={[styles.breakdownTrack, { backgroundColor: colors.surfaceSecondary }]}>
            <View
              style={[
                styles.breakdownFill,
                { width: `${(bar.count / total) * 100}%` as any, backgroundColor: bar.color },
              ]}
            />
          </View>
          <Text style={[styles.breakdownCount, { color: bar.count > 0 ? bar.color : colors.textMuted }]}>
            {bar.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, marginTop: 120, alignItems: 'center' },

  header: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy as any,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.sm,
    marginTop: 2,
  },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radii.card,
    gap: 3,
  },
  kpiIconBg: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  kpiValue: {
    fontSize: Typography.xl,
    fontWeight: Typography.heavy as any,
    letterSpacing: -0.5,
  },
  kpiSubValue: {
    fontSize: 11,
    fontWeight: Typography.bold as any,
  },
  kpiLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium as any,
  },

  // Section
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold as any,
  },

  // Health card
  healthCard: {
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  healthPct: {
    fontSize: 32,
    fontWeight: Typography.heavy as any,
    letterSpacing: -1,
  },
  healthLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.medium as any,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthSub: {
    fontSize: Typography.xs,
  },

  // Anomaly list
  emptyCard: {
    borderRadius: Radii.card,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyCardText: {
    fontSize: Typography.sm,
    textAlign: 'center',
  },
  anomalyList: {
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  anomalyDot: {
    width: 34,
    height: 34,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  anomalyInfo: { flex: 1, gap: 2 },
  anomalyType: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold as any,
  },
  anomalyWp: {
    fontSize: Typography.xs,
  },
  sevPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  sevText: {
    fontSize: 9,
    fontWeight: Typography.bold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  anomalyTime: {
    fontSize: 10,
  },

  // Severity breakdown
  breakdownCard: {
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  breakdownLabel: {
    width: 58,
    fontSize: Typography.xs,
    fontWeight: Typography.medium as any,
  },
  breakdownTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
  breakdownCount: {
    width: 20,
    fontSize: Typography.xs,
    fontWeight: Typography.bold as any,
    textAlign: 'right',
  },
});
