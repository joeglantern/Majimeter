// app/(app)/(tabs)/reports.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  Faders,
  WarningCircle,
  DropSlash,
  Flask,
  HardHat,
  DotsThree,
  Clock,
  ThumbsUp,
  MapPin,
  CheckCircle,
  Wrench,
  Drop,
} from 'phosphor-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportType = 'shortage' | 'burst_pipe' | 'contamination' | 'infrastructure' | 'other';
type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

interface Report {
  id: string;
  user_id: string;
  water_point_id: string | null;
  type: ReportType;
  title: string;
  description: string | null;
  location_lat: string;
  location_lng: string;
  images: string[];
  status: ReportStatus;
  upvotes: number;
  created_at: string;
  resolved_at: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REPORT_CONFIG: Record<ReportType, { label: string; Icon: any; color: string }> = {
  burst_pipe:     { label: 'Burst Pipe',   Icon: DropSlash,     color: Colors.water    },
  shortage:       { label: 'No Water',     Icon: WarningCircle, color: Colors.critical },
  contamination:  { label: 'Dirty Water',  Icon: Flask,         color: Colors.warning  },
  infrastructure: { label: 'Damage',       Icon: HardHat,       color: Colors.info     },
  other:          { label: 'Other Issue',  Icon: DotsThree,     color: '#9CA3AF'       },
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string }> = {
  open:        { label: 'Open',        color: Colors.critical },
  in_progress: { label: 'In Progress', color: Colors.warning  },
  resolved:    { label: 'Resolved',    color: Colors.success  },
  dismissed:   { label: 'Dismissed',  color: '#9CA3AF'       },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'all' | 'nearby' | 'active'>('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Get location once for "nearby" tab
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      locationRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (activeTab === 'nearby') fetchReports(true);
    })();
  }, []);

  const buildParams = useCallback((reset: boolean) => {
    const params: Record<string, any> = { limit: 20 };
    if (activeTab === 'nearby' && locationRef.current) {
      params.lat = locationRef.current.latitude;
      params.lng = locationRef.current.longitude;
      params.radius = 10;
    }
    if (activeTab === 'active') {
      params.status = 'open';
    }
    if (!reset && cursor) {
      params.cursor = cursor;
    }
    return params;
  }, [activeTab, cursor]);

  const fetchReports = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true);
      setCursor(null);
      setHasMore(true);
    }
    try {
      const params = reset
        ? (() => {
            const p: Record<string, any> = { limit: 20 };
            if (activeTab === 'nearby' && locationRef.current) {
              p.lat = locationRef.current.latitude;
              p.lng = locationRef.current.longitude;
              p.radius = 10;
            }
            if (activeTab === 'active') p.status = 'open';
            return p;
          })()
        : buildParams(false);

      const { data } = await api.get('/reports', { params });
      const items: Report[] = data.data ?? [];
      const nextCursor: string | null = data.meta?.cursor ?? null;

      if (reset) {
        setReports(items);
      } else {
        setReports(prev => [...prev, ...items]);
      }
      setCursor(nextCursor);
      setHasMore(nextCursor !== null);
    } catch (err) {
      console.warn('Failed to fetch reports:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetchingMore(false);
    }
  }, [activeTab, buildParams]);

  useEffect(() => {
    fetchReports(true);
  }, [activeTab]);

  const handleLoadMore = () => {
    if (!hasMore || isFetchingMore || isLoading) return;
    setIsFetchingMore(true);
    fetchReports(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Community</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Water issue reports</Text>
        </View>
        <Pressable style={[styles.filterBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Faders size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TabItem label="All" active={activeTab === 'all'} onPress={() => setActiveTab('all')} colors={colors} />
        <TabItem label="Nearby" active={activeTab === 'nearby'} onPress={() => setActiveTab('nearby')} colors={colors} />
        <TabItem label="Active" active={activeTab === 'active'} onPress={() => setActiveTab('active')} colors={colors} />
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { setIsRefreshing(true); fetchReports(true); }}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          renderItem={({ item, index }) => (
            <ReportCard report={item} index={index} colors={colors} />
          )}
          ListEmptyComponent={<EmptyReports activeTab={activeTab} colors={colors} />}
          ListFooterComponent={
            isFetchingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator color={Colors.primary} size="small" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ── Tab Item ────────────────────────────────────────────────────────────────────

function TabItem({ label, active, onPress, colors }: {
  label: string; active: boolean; onPress: () => void; colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && { borderBottomColor: Colors.primary, borderBottomWidth: 2.5 }]}
    >
      <Text style={[
        styles.tabLabel,
        { color: active ? Colors.primary : colors.textMuted },
        active && { fontWeight: Typography.bold as any },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Report Card ─────────────────────────────────────────────────────────────────

function ReportCard({ report, index, colors }: { report: Report; index: number; colors: any }) {
  const scale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  const typeConf = REPORT_CONFIG[report.type] ?? REPORT_CONFIG.other;
  const statusConf = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.open;
  const { Icon } = typeConf;

  useEffect(() => {
    if (report.status === 'open' || report.status === 'in_progress') {
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 1100 }), withTiming(1, { duration: 1100 })),
        -1, true,
      );
    }
  }, [report.status]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const hasImage = report.images && report.images.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 80, 400)).springify().damping(15)}
      layout={Layout.springify()}
    >
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={[styles.card, Shadows.card, { backgroundColor: colors.surface }]}
      >
        <Animated.View style={animatedStyle}>
          {/* ── Card header ─────────────────────────────────────────── */}
          <View style={styles.cardHeader}>
            <View style={[styles.iconBg, { backgroundColor: typeConf.color + '18' }]}>
              <Icon size={22} color={typeConf.color} weight="fill" />
            </View>
            <View style={styles.cardTitleArea}>
              <Text style={[styles.reportTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {report.title}
              </Text>
              <View style={styles.typeBadgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeConf.color + '15' }]}>
                  <Text style={[styles.typeBadgeText, { color: typeConf.color }]}>
                    {typeConf.label}
                  </Text>
                </View>
              </View>
            </View>
            <Animated.View style={[styles.statusPill, { backgroundColor: statusConf.color + '12' }, pulseStyle]}>
              <Text style={[styles.statusText, { color: statusConf.color }]}>
                {statusConf.label}
              </Text>
            </Animated.View>
          </View>

          {/* ── Description ─────────────────────────────────────────── */}
          {report.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
              {report.description}
            </Text>
          ) : (
            <Text style={[styles.description, { color: colors.textMuted, fontStyle: 'italic' }]}>
              No description provided.
            </Text>
          )}

          {/* ── Image preview ───────────────────────────────────────── */}
          {hasImage && (
            <Image
              source={{ uri: report.images[0] }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          )}

          {/* ── Divider ─────────────────────────────────────────────── */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* ── Footer ──────────────────────────────────────────────── */}
          <View style={styles.cardFooter}>
            <View style={styles.footerItem}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                {timeAgo(report.created_at)}
              </Text>
            </View>
            <View style={styles.footerItem}>
              <ThumbsUp size={14} color={colors.textMuted} />
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                {report.upvotes ?? 0}
              </Text>
            </View>
            {report.resolved_at && (
              <View style={styles.footerItem}>
                <CheckCircle size={14} color={Colors.success} />
                <Text style={[styles.footerText, { color: Colors.success }]}>
                  Resolved {timeAgo(report.resolved_at)}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────────

function EmptyReports({ activeTab, colors }: { activeTab: string; colors: any }) {
  const messages: Record<string, { icon: any; title: string; body: string }> = {
    all:    { icon: Drop,    title: 'No reports yet',   body: 'Be the first to report a water issue in your area.' },
    nearby: { icon: MapPin,  title: 'Nothing nearby',   body: 'No active reports found within 10 km of your location.' },
    active: { icon: Wrench,  title: 'All clear!',       body: 'There are no open water issues right now. Great news!' },
  };
  const { icon: Icon, title, body } = messages[activeTab] ?? messages.all;
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconBg, { backgroundColor: Colors.primary + '12' }]}>
        <Icon size={32} color={Colors.primary} weight="light" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
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
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: 4,
  },
  tabLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium as any,
  },

  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { paddingVertical: Spacing.lg, alignItems: 'center' },

  // Card
  card: {
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleArea: { flex: 1, gap: 3 },
  reportTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold as any,
  },
  typeBadgeRow: { flexDirection: 'row' },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: Typography.bold as any,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: Typography.bold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  description: {
    fontSize: Typography.sm,
    lineHeight: 20,
    marginTop: 2,
  },

  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: Radii.md,
    marginTop: Spacing.xs,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: Spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium as any,
  },

  // Empty
  empty: {
    paddingTop: 80,
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: 48,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold as any,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
