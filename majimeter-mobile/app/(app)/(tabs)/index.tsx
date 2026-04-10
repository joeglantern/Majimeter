// app/(app)/(tabs)/index.tsx
// Dashboard / Home Screen
// Role-adaptive: regular users see local water points, admins see system-wide stats.
// Live data via Socket.IO /sensors namespace.

import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellRinging,
  Drop,
  Gauge,
  ArrowUp,
  ArrowDown,
  Lightning,
  CheckCircle,
  WarningCircle,
  XCircle,
  Spinner,
} from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Typography, Spacing, Radii, Shadows } from '@/constants/Theme';
import { api } from '@/lib/api';
import { getSensorsSocket } from '@/lib/socket';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Summary {
  active_water_points: number;
  total_water_points: number;
  open_reports: number;
  active_alerts: number;
  critical_alerts: number;
  readings_today: number;
}

interface WaterPoint {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'maintenance';
  address: string;
  latestReading?: {
    waterLevel: number;
    flowRate: number;
    pressure: number;
    time: string;
  };
}

interface SensorReading {
  waterPointId: string;
  waterLevel: number;
  flowRate: number;
  pressure: number;
  time: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, isAdmin, accessToken } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [waterPoints, setWaterPoints] = useState<WaterPoint[]>([]);
  const [liveReadings, setLiveReadings] = useState<Record<string, SensorReading>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Bell badge pulse
  const bellPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if ((summary?.active_alerts ?? 0) > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bellPulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(bellPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [summary?.active_alerts]);

  // ── Data fetch ───────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const [summaryRes, pointsRes] = await Promise.all([
        api.get<{ success: boolean; data: Summary }>('/analytics/summary'),
        api.get<{ success: boolean; data: WaterPoint[] }>('/water-points', { params: { limit: 10 } }),
      ]);
      setSummary(summaryRes.data.data);
      setWaterPoints(pointsRes.data.data ?? []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Socket.IO — live sensor readings ─────────────────────────────────────────

  useEffect(() => {
    if (!accessToken || waterPoints.length === 0) return;

    const socket = getSensorsSocket(accessToken);
    socket.connect();

    // Join a room for each visible water point
    waterPoints.forEach(wp => {
      socket.emit('join', { waterPointId: wp.id });
    });

    socket.on('reading', (data: SensorReading) => {
      setLiveReadings(prev => ({ ...prev, [data.waterPointId]: data }));
    });

    return () => {
      waterPoints.forEach(wp => socket.emit('leave', { waterPointId: wp.id }));
      socket.off('reading');
      socket.disconnect();
    };
  }, [accessToken, waterPoints.length]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {greeting}, {firstName} 👋
            </Text>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>MajiMeter</Text>
          </View>

          {/* Bell icon with badge */}
          <Pressable
            style={[styles.bellBtn, { backgroundColor: colors.surface }, Shadows.card]}
            onPress={() => router.push('/(app)/(tabs)/alerts')}
            accessibilityLabel="View alerts"
          >
            <Animated.View style={{ transform: [{ scale: bellPulse }] }}>
              <BellRinging
                size={22}
                color={(summary?.active_alerts ?? 0) > 0 ? Colors.critical : colors.textSecondary}
                weight={(summary?.active_alerts ?? 0) > 0 ? 'fill' : 'regular'}
              />
            </Animated.View>
            {(summary?.active_alerts ?? 0) > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {(summary?.active_alerts ?? 0) > 9 ? '9+' : summary?.active_alerts}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── KPI Row ──────────────────────────────────────────────── */}
        {isLoading ? (
          <KPISkeleton colors={colors} />
        ) : (
          <View style={styles.kpiRow}>
            <KPICard
              value={summary?.active_water_points ?? 0}
              label="Active Points"
              color={Colors.success}
              bgColor={Colors.successLight}
              Icon={CheckCircle}
              colors={colors}
            />
            <KPICard
              value={summary?.active_alerts ?? 0}
              label="Alerts"
              color={Colors.critical}
              bgColor={Colors.criticalLight}
              Icon={WarningCircle}
              colors={colors}
            />
            <KPICard
              value={summary?.open_reports ?? 0}
              label="Reports"
              color={Colors.warning}
              bgColor={Colors.warningLight}
              Icon={XCircle}
              colors={colors}
            />
          </View>
        )}

        {/* ── Water Points ─────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {isAdmin ? 'All Water Points' : 'Nearby Points'}
          </Text>
          <Pressable onPress={() => {}}>
            <Text style={[styles.seeAll, { color: Colors.primary }]}>See all</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <WaterPointSkeleton colors={colors} />
        ) : waterPoints.length === 0 ? (
          <EmptyPoints colors={colors} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pointsScroll}
          >
            {waterPoints.map(wp => (
              <WaterPointCard
                key={wp.id}
                point={wp}
                liveReading={liveReadings[wp.id]}
                colors={colors}
                onPress={() => router.push(`/(app)/water-point/${wp.id}` as any)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Quick stats for admin ─────────────────────────────────── */}
        {isAdmin && summary && (
          <View style={[styles.adminCard, Shadows.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.adminCardTitle, { color: colors.textPrimary }]}>
              Today's Activity
            </Text>
            <View style={styles.adminRow}>
              <AdminStat
                label="Readings"
                value={summary.readings_today}
                icon={<Lightning size={16} color={Colors.primary} weight="fill" />}
                colors={colors}
              />
              <AdminStat
                label="Open Reports"
                value={summary.open_reports}
                icon={<WarningCircle size={16} color={Colors.warning} weight="fill" />}
                colors={colors}
              />
              <AdminStat
                label="Network Health"
                value={`${Math.round((summary.active_water_points / Math.max(summary.total_water_points, 1)) * 100)}%`}
                icon={<Gauge size={16} color={Colors.success} weight="fill" />}
                colors={colors}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({
  value,
  label,
  color,
  bgColor,
  Icon,
  colors,
}: {
  value: number;
  label: string;
  color: string;
  bgColor: string;
  Icon: any;
  colors: any;
}) {
  return (
    <View style={[styles.kpiCard, Shadows.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.kpiIconBg, { backgroundColor: bgColor }]}>
        <Icon size={18} color={color} weight="fill" />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function WaterPointCard({
  point,
  liveReading,
  colors,
  onPress,
}: {
  point: WaterPoint;
  liveReading?: SensorReading;
  colors: any;
  onPress: () => void;
}) {
  const reading = liveReading ?? point.latestReading;
  const statusColor =
    point.status === 'active'
      ? Colors.success
      : point.status === 'maintenance'
      ? Colors.warning
      : Colors.textMuted ?? '#9CA3AF';

  return (
    <Pressable
      style={[styles.wpCard, Shadows.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
    >
      {/* Status dot */}
      <View style={styles.wpStatus}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.wpStatusText, { color: statusColor }]}>
          {point.status.charAt(0).toUpperCase() + point.status.slice(1)}
        </Text>
      </View>

      {/* Name */}
      <Text style={[styles.wpName, { color: colors.textPrimary }]} numberOfLines={2}>
        {point.name}
      </Text>
      <Text style={[styles.wpType, { color: colors.textMuted }]}>
        {point.type.replace('_', ' ')}
      </Text>

      {/* Live readings */}
      {reading ? (
        <View style={styles.wpReadings}>
          <ReadingChip icon="💧" value={`${reading.waterLevel?.toFixed(0)}%`} color={Colors.water} />
          <ReadingChip icon="⚡" value={`${reading.pressure?.toFixed(1)}bar`} color={Colors.warning} />
          <ReadingChip icon="🌊" value={`${reading.flowRate?.toFixed(1)}L/m`} color={Colors.primary} />
        </View>
      ) : (
        <Text style={[styles.wpNoReading, { color: colors.textMuted }]}>No data yet</Text>
      )}

      {/* Live indicator */}
      {liveReading && (
        <View style={styles.liveChip}>
          <View style={[styles.liveDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      )}
    </Pressable>
  );
}

function ReadingChip({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '18' }]}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
    </View>
  );
}

function AdminStat({ label, value, icon, colors }: { label: string; value: string | number; icon: React.ReactNode; colors: any }) {
  return (
    <View style={styles.adminStat}>
      {icon}
      <Text style={[styles.adminStatValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.adminStatLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ── Skeleton loaders ───────────────────────────────────────────────────────────

function KPISkeleton({ colors }: { colors: any }) {
  return (
    <View style={styles.kpiRow}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.kpiCard, Shadows.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.skeletonBlock, { width: 32, height: 32, borderRadius: Radii.sm, backgroundColor: colors.border }]} />
          <View style={[styles.skeletonBlock, { width: 40, height: 24, borderRadius: 4, backgroundColor: colors.border }]} />
          <View style={[styles.skeletonBlock, { width: 56, height: 12, borderRadius: 4, backgroundColor: colors.border }]} />
        </View>
      ))}
    </View>
  );
}

function WaterPointSkeleton({ colors }: { colors: any }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pointsScroll}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.wpCard, Shadows.card, { backgroundColor: colors.surface }]}>
          {[80, 120, 60, 90].map((w, j) => (
            <View key={j} style={[styles.skeletonBlock, { width: w, height: 14, borderRadius: 4, backgroundColor: colors.border }]} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function EmptyPoints({ colors }: { colors: any }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
      <Text style={styles.emptyEmoji}>💧</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No water points yet</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        No water points in your area yet.
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.md, gap: Spacing.lg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  appName: {
    fontSize: Typography.xl,
    fontWeight: Typography.heavy,
    letterSpacing: -0.5,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.critical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: Typography.bold,
  },

  // KPI
  kpiRow: { flexDirection: 'row', gap: Spacing.sm },
  kpiCard: {
    flex: 1,
    borderRadius: Radii.card,
    padding: Spacing.md,
    gap: 4,
    alignItems: 'center',
  },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: Typography.xl,
    fontWeight: Typography.heavy,
  },
  kpiLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    textAlign: 'center',
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  seeAll: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },

  // Water point cards (horizontal scroll)
  pointsScroll: { paddingRight: Spacing.md, gap: Spacing.sm },
  wpCard: {
    width: 180,
    borderRadius: Radii.card,
    padding: Spacing.md,
    gap: 6,
  },
  wpStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  wpStatusText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  wpName: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    lineHeight: 20,
  },
  wpType: { fontSize: Typography.xs, fontWeight: Typography.medium },
  wpReadings: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  wpNoReading: { fontSize: Typography.xs },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.success,
  },

  // Reading chips on WaterPointCard
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  chipIcon: { fontSize: 10 },
  chipValue: { fontSize: 10, fontWeight: Typography.semibold },

  // Admin card
  adminCard: {
    borderRadius: Radii.card,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  adminCardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  adminRow: { flexDirection: 'row', justifyContent: 'space-around' },
  adminStat: { alignItems: 'center', gap: 4 },
  adminStatValue: { fontSize: Typography.lg, fontWeight: Typography.heavy },
  adminStatLabel: { fontSize: Typography.xs, fontWeight: Typography.medium },

  // Skeleton
  skeletonBlock: {},

  // Empty
  emptyCard: {
    borderRadius: Radii.card,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: Typography.base, fontWeight: Typography.bold },
  emptyText: { fontSize: Typography.sm, textAlign: 'center', lineHeight: 20 },
});
