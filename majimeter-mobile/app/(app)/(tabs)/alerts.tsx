// app/(app)/(tabs)/alerts.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellSimpleRinging,
  Warning,
  Info,
  Check,
  MapPin,
  Drop,
  ArrowsLeftRight,
  WaveSine,
  ArrowDown,
} from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';
import { getAlertsSocket } from '@/lib/socket';

// ── Types ──────────────────────────────────────────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertType = 'low_level' | 'high_pressure' | 'low_pressure' | 'no_flow' | 'leak_detected';

interface Alert {
  id: string;
  water_point_id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; Icon: any }> = {
  critical: { label: 'Critical', color: Colors.critical, Icon: Warning        },
  warning:  { label: 'Warning',  color: Colors.warning,  Icon: Info           },
  info:     { label: 'Info',     color: Colors.info,     Icon: BellSimpleRinging },
};

const TYPE_LABELS: Record<AlertType, string> = {
  low_level:      'Low Water Level',
  high_pressure:  'High Pressure',
  low_pressure:   'Low Pressure',
  no_flow:        'No Flow Detected',
  leak_detected:  'Leak Detected',
};

const TYPE_ICONS: Record<AlertType, any> = {
  low_level:      ArrowDown,
  high_pressure:  ArrowsLeftRight,
  low_pressure:   ArrowsLeftRight,
  no_flow:        WaveSine,
  leak_detected:  Drop,
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

export default function AlertsScreen() {
  const { accessToken, canAcknowledgeAlerts } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<'all' | 'unread' | AlertSeverity>('all');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ackingIds, setAckingIds] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '50' };
      if (filter === 'unread') params.acknowledged = 'false';
      else if (filter !== 'all') params.severity = filter;

      const { data } = await api.get('/alerts', { params });
      setAlerts(data.data ?? []);
    } catch (err) {
      console.warn('Failed to fetch alerts:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setIsLoading(true);
    fetchAlerts();
  }, [filter]);

  // ── Socket ──────────────────────────────────────────────────────────────────
  const fetchAlertsRef = useRef(fetchAlerts);
  useEffect(() => { fetchAlertsRef.current = fetchAlerts; }, [fetchAlerts]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getAlertsSocket(accessToken);
    socket.connect();

    socket.on('alert:new', (newAlert: Alert) => {
      setAlerts(prev => [newAlert, ...prev]);
    });

    socket.on('alert:acknowledged', ({ alertId, acknowledgedAt }: { alertId: string; acknowledgedAt: string }) => {
      setAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, acknowledged_at: acknowledgedAt } : a),
      );
    });

    return () => {
      socket.off('alert:new');
      socket.off('alert:acknowledged');
      socket.disconnect();
    };
  }, [accessToken]);

  // ── Acknowledge ─────────────────────────────────────────────────────────────
  const handleAcknowledge = async (id: string) => {
    setAckingIds(s => new Set(s).add(id));
    try {
      await api.patch(`/alerts/${id}/acknowledge`);
      // Socket event will update the state; fallback update if socket is slow
      setAlerts(prev =>
        prev.map(a => a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a),
      );
    } catch (err) {
      console.warn('Acknowledge failed:', err);
    } finally {
      setAckingIds(s => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const unreadCount = alerts.filter(a => !a.acknowledged_at).length;
  const TABS: Array<{ key: typeof filter; label: string }> = [
    { key: 'all',      label: 'All'      },
    { key: 'unread',   label: 'Unread'   },
    { key: 'critical', label: 'Critical' },
    { key: 'warning',  label: 'Warning'  },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Alerts</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            System monitoring
          </Text>
        </View>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: Colors.critical }]}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* ── Filter tabs ────────────────────────────────────────────── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map(tab => {
          const active = filter === tab.key;
          const dotColor =
            tab.key === 'critical' ? Colors.critical :
            tab.key === 'warning'  ? Colors.warning  : Colors.primary;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[styles.tab, active && { borderBottomColor: dotColor, borderBottomWidth: 2.5 }]}
            >
              <Text style={[
                styles.tabLabel,
                { color: active ? dotColor : colors.textMuted },
                active && { fontWeight: Typography.bold as any },
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { setIsRefreshing(true); fetchAlerts(); }}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item, index }) => (
            <AlertCard
              alert={item}
              index={index}
              colors={colors}
              canAck={canAcknowledgeAlerts}
              isAcking={ackingIds.has(item.id)}
              onAck={() => handleAcknowledge(item.id)}
            />
          )}
          ListEmptyComponent={<EmptyAlerts filter={filter} colors={colors} />}
        />
      )}
    </View>
  );
}

// ── Alert Card ──────────────────────────────────────────────────────────────────

function AlertCard({
  alert, index, colors, canAck, isAcking, onAck,
}: {
  alert: Alert;
  index: number;
  colors: any;
  canAck: boolean;
  isAcking: boolean;
  onAck: () => void;
}) {
  const sevConf = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
  const { Icon } = sevConf;
  const TypeIcon = TYPE_ICONS[alert.type] ?? Info;
  const typeLabel = TYPE_LABELS[alert.type] ?? alert.type.replace(/_/g, ' ');
  const isAcknowledged = !!alert.acknowledged_at;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 60, 300)).springify().damping(16)}
      layout={Layout.springify()}
      style={[
        styles.card,
        Shadows.card,
        { backgroundColor: colors.surface, borderLeftColor: sevConf.color, borderLeftWidth: 3.5 },
        isAcknowledged && { opacity: 0.55 },
      ]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: sevConf.color + '18' }]}>
          <Icon size={20} color={sevConf.color} weight="fill" />
        </View>
        <View style={styles.titleBox}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {typeLabel}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.severityPill, { backgroundColor: sevConf.color + '15' }]}>
              <Text style={[styles.severityText, { color: sevConf.color }]}>
                {sevConf.label}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {timeAgo(alert.triggered_at)}
        </Text>
      </View>

      {/* Message */}
      {alert.message ? (
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          {alert.message}
        </Text>
      ) : null}

      {/* Acknowledge button */}
      {canAck && !isAcknowledged && (
        <Pressable
          style={[styles.ackBtn, { backgroundColor: colors.surfaceSecondary }]}
          onPress={onAck}
          disabled={isAcking}
        >
          {isAcking ? (
            <ActivityIndicator size="small" color={Colors.success} />
          ) : (
            <>
              <Check size={15} color={Colors.success} weight="bold" />
              <Text style={[styles.ackText, { color: Colors.success }]}>Acknowledge</Text>
            </>
          )}
        </Pressable>
      )}

      {isAcknowledged && (
        <View style={styles.ackedRow}>
          <Check size={13} color={colors.textMuted} />
          <Text style={[styles.ackedText, { color: colors.textMuted }]}>
            Acknowledged {timeAgo(alert.acknowledged_at!)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Empty ───────────────────────────────────────────────────────────────────────

function EmptyAlerts({ filter, colors }: { filter: string; colors: any }) {
  const isFiltered = filter !== 'all';
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconBg, { backgroundColor: Colors.success + '12' }]}>
        <Check size={32} color={Colors.success} weight="light" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {isFiltered ? 'Nothing here' : 'All clear!'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {isFiltered
          ? 'No alerts match the current filter.'
          : 'No active alerts right now. The system is healthy.'}
      </Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy as any,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: Typography.sm,
    marginTop: 2,
  },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
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

  // Card
  card: {
    borderRadius: Radii.card,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBox: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold as any,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  severityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  severityText: {
    fontSize: 10,
    fontWeight: Typography.bold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 11,
    flexShrink: 0,
  },
  cardDescription: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },

  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    marginTop: 2,
  },
  ackText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  ackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ackedText: {
    fontSize: 11,
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
