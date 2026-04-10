// app/(app)/water-point/[id].tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop, G, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Drop,
  Gauge,
  Wind,
  BatteryHigh,
  BatteryMedium,
  BatteryLow,
  ThermometerSimple,
  ArrowsClockwise,
  WarningCircle,
  DropSlash,
  Flask,
  HardHat,
  DotsThree,
  MapPin,
  BellSimpleRinging,
  Check,
  ArrowDown,
  ArrowsLeftRight,
  WaveSine,
  Waves,
  Lightning,
} from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';
import { getSensorsSocket } from '@/lib/socket';

const { width: SCREEN_W } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Types ──────────────────────────────────────────────────────────────────────

interface WaterPoint {
  id: string;
  name: string;
  type: 'borehole' | 'tank' | 'pipe' | 'tap';
  status: 'active' | 'inactive' | 'maintenance';
  address: string | null;
  location_lat: string;
  location_lng: string;
  sensor_id: string | null;
  created_at: string;
}

interface SensorReading {
  flow_rate: string | null;
  pressure: string | null;
  water_level: string | null;
  temperature: string | null;
  battery_level: string | null;
  time: string;
}

interface HistoryPoint {
  period: string;
  avg_flow_rate: string | null;
  avg_pressure: string | null;
  avg_water_level: string | null;
  reading_count: number;
}

interface Report {
  id: string;
  type: 'shortage' | 'burst_pipe' | 'contamination' | 'infrastructure' | 'other';
  title: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  description: string | null;
  created_at: string;
  upvotes: number;
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const WP_TYPE_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  borehole: { label: 'Borehole',  color: Colors.waterDark, Icon: Drop   },
  tank:     { label: 'Tank',      color: Colors.primary,   Icon: Waves  },
  pipe:     { label: 'Pipeline',  color: Colors.info,      Icon: Wind   },
  tap:      { label: 'Tap Stand', color: Colors.success,   Icon: Drop   },
};

const REPORT_CONFIG: Record<string, { label: string; Icon: any; color: string }> = {
  burst_pipe:     { label: 'Burst Pipe',   Icon: DropSlash,     color: Colors.water    },
  shortage:       { label: 'No Water',     Icon: WarningCircle, color: Colors.critical },
  contamination:  { label: 'Dirty Water',  Icon: Flask,         color: Colors.warning  },
  infrastructure: { label: 'Damage',       Icon: HardHat,       color: Colors.info     },
  other:          { label: 'Other',        Icon: DotsThree,     color: '#9CA3AF'       },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  low_level:      'Low Water Level',
  high_pressure:  'High Pressure',
  low_pressure:   'Low Pressure',
  no_flow:        'No Flow Detected',
  leak_detected:  'Leak Detected',
};

const ALERT_TYPE_ICONS: Record<string, any> = {
  low_level:     ArrowDown,
  high_pressure: ArrowsLeftRight,
  low_pressure:  ArrowsLeftRight,
  no_flow:       WaveSine,
  leak_detected: Drop,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtVal(val: string | null | undefined, unit: string, decimals = 1): string {
  if (val == null) return '—';
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `${n.toFixed(decimals)} ${unit}`;
}

function safePct(val: string | null | undefined): number {
  return Math.min(100, Math.max(0, parseFloat(val ?? '0') || 0));
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'resolved':    return Colors.success;
    case 'in_progress':
    case 'maintenance': return Colors.warning;
    case 'open':        return Colors.critical;
    default:            return '#9CA3AF';
  }
}

// ── Circular Gauge ─────────────────────────────────────────────────────────────

function CircularGauge({
  pct, size = 160, color, label, value, colors,
}: {
  pct: number; size?: number; color: string;
  label: string; value: string; colors: any;
}) {
  const radius    = (size - 20) / 2;
  const cx        = size / 2;
  const cy        = size / 2;
  const circumference = 2 * Math.PI * radius;
  // We show a 270° arc (start at 135°, end at 405°)
  const arcLen   = circumference * 0.75;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(200, withSpring(pct / 100, { damping: 18, stiffness: 100 }));
  }, [pct]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - progress.value),
  }));

  // rotate the arcs so the gap is at the bottom
  const rotate = '135deg';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        {/* Background arc */}
        <Circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color + '20'}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
          transform={`rotate(135, ${cx}, ${cy})`}
        />
        {/* Foreground arc */}
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={`url(#gaugeGrad)`}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
          transform={`rotate(135, ${cx}, ${cy})`}
          animatedProps={animProps}
        />
      </Svg>
      {/* Center text */}
      <View style={StyleSheet.absoluteFill as any} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -1 }}>
            {value}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500', marginTop: 2 }}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Area Chart ─────────────────────────────────────────────────────────────────

function AreaChart({ data, colors }: { data: HistoryPoint[]; colors: any }) {
  const W = SCREEN_W - Spacing.lg * 2 - Spacing.md * 2;
  const H = 120;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (data.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: Typography.sm }}>Not enough data</Text>
      </View>
    );
  }

  const values = data.map(d => parseFloat(d.avg_flow_rate ?? d.avg_water_level ?? '0') || 0);
  const maxV = Math.max(...values, 0.01);
  const minV = Math.min(...values, 0);

  const toX = (i: number) => PAD_L + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - minV) / (maxV - minV || 1)) * chartH;

  // Smooth bezier path
  const linePath = values
    .map((v, i) => {
      if (i === 0) return `M ${toX(i)} ${toY(v)}`;
      const cpX1 = toX(i - 1) + (toX(i) - toX(i - 1)) * 0.4;
      const cpX2 = toX(i - 1) + (toX(i) - toX(i - 1)) * 0.6;
      return `C ${cpX1} ${toY(values[i - 1])}, ${cpX2} ${toY(v)}, ${toX(i)} ${toY(v)}`;
    })
    .join(' ');

  const areaPath = `${linePath} L ${toX(data.length - 1)} ${PAD_T + chartH} L ${toX(0)} ${PAD_T + chartH} Z`;

  // X axis labels — show ~4 evenly spaced
  const labelIndices = [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  return (
    <Svg width={W} height={H}>
      <Defs>
        <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <Line
          key={f}
          x1={PAD_L} y1={PAD_T + chartH * (1 - f)}
          x2={PAD_L + chartW} y2={PAD_T + chartH * (1 - f)}
          stroke={colors.border}
          strokeWidth={0.5}
          strokeDasharray="3 4"
        />
      ))}
      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaGrad)" />
      {/* Line */}
      <Path d={linePath} fill="none" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
      {/* Dots at labeled positions */}
      {labelIndices.map(i => (
        <Circle key={i} cx={toX(i)} cy={toY(values[i])} r={3} fill={Colors.primary} />
      ))}
      {/* X axis labels */}
      {/* We skip actual SVG Text here and use overlay View instead */}
    </Svg>
  );
}

// ── Stat Row ───────────────────────────────────────────────────────────────────

function StatRow({
  icon, label, value, color, bar, barPct, colors,
}: {
  icon: React.ReactNode; label: string; value: string;
  color: string; bar?: boolean; barPct?: number; colors: any;
}) {
  const fill = useSharedValue(0);
  useEffect(() => {
    if (bar && barPct != null) {
      fill.value = withDelay(300, withSpring(barPct / 100, { damping: 18, stiffness: 100 }));
    }
  }, [barPct]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%` as any,
  }));

  return (
    <View style={statStyles.row}>
      <View style={[statStyles.iconBox, { backgroundColor: color + '15' }]}>{icon}</View>
      <View style={statStyles.info}>
        <View style={statStyles.topRow}>
          <Text style={[statStyles.label, { color: colors.textMuted }]}>{label}</Text>
          <Text style={[statStyles.value, { color: colors.textPrimary }]}>{value}</Text>
        </View>
        {bar && (
          <View style={[statStyles.track, { backgroundColor: color + '20' }]}>
            <Animated.View style={[statStyles.fill, fillStyle, { backgroundColor: color }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  iconBox: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: Typography.sm, fontWeight: '500' as any },
  value: { fontSize: Typography.base, fontWeight: '700' as any },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, minWidth: 4 },
});

// ── Pulse dot ──────────────────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.8, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
    opacity.value = withRepeat(withSequence(withTiming(0, { duration: 900 }), withTiming(0.7, { duration: 900 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: color }, ringStyle]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function WaterPointDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [wp, setWp] = useState<WaterPoint | null>(null);
  const [sensor, setSensor] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'alerts'>('reports');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [isLoading, setIsLoading] = useState(true);
  const [isSensorLoading, setIsSensorLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const fetchBase = useCallback(async () => {
    try {
      const [wpRes, repRes, alertRes] = await Promise.all([
        api.get(`/water-points/${id}`),
        api.get(`/water-points/${id}/reports`, { params: { limit: 10 } }),
        api.get(`/water-points/${id}/alerts`,  { params: { limit: 10 } }),
      ]);
      setWp(wpRes.data.data);
      setReports(repRes.data.data ?? []);
      setAlerts(alertRes.data.data ?? []);
    } catch (err) {
      console.warn('WP detail fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  const fetchSensor = useCallback(async () => {
    setIsSensorLoading(true);
    try {
      const { data } = await api.get(`/water-points/${id}/sensors/live`);
      setSensor(data.data ?? null);
    } catch { setSensor(null); }
    finally { setIsSensorLoading(false); }
  }, [id]);

  const fetchHistory = useCallback(async (p: typeof period) => {
    setIsHistoryLoading(true);
    try {
      const now  = new Date();
      const from = new Date(now);
      if (p === 'daily')   from.setDate(now.getDate() - 14);
      if (p === 'weekly')  from.setDate(now.getDate() - 56);
      if (p === 'monthly') from.setFullYear(now.getFullYear() - 1);

      const { data } = await api.get(`/water-points/${id}/sensors/history`, {
        params: { from: from.toISOString(), to: now.toISOString(), interval: '1d' },
      });
      setHistory(data.data ?? []);
    } catch { setHistory([]); }
    finally { setIsHistoryLoading(false); }
  }, [id]);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  useEffect(() => {
    if (wp?.sensor_id) { fetchSensor(); fetchHistory(period); }
  }, [wp?.sensor_id]);

  useEffect(() => {
    if (wp?.sensor_id) fetchHistory(period);
  }, [period]);

  // Live socket
  useEffect(() => {
    if (!accessToken || !wp?.sensor_id) return;
    const socket = getSensorsSocket(accessToken);
    socket.connect();
    socket.emit('join', { waterPointId: id });
    socket.on('reading', (data: any) => {
      if (data.waterPointId !== id) return;
      setIsLive(true);
      setSensor({
        flow_rate:     data.flowRate     != null ? String(data.flowRate)     : null,
        pressure:      data.pressure     != null ? String(data.pressure)     : null,
        water_level:   data.waterLevel   != null ? String(data.waterLevel)   : null,
        temperature:   data.temperature  != null ? String(data.temperature)  : null,
        battery_level: data.batteryLevel != null ? String(data.batteryLevel) : null,
        time: data.time,
      });
    });
    return () => {
      socket.emit('leave', { waterPointId: id });
      socket.off('reading');
      socket.disconnect();
    };
  }, [accessToken, id, wp?.sensor_id]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!wp) {
    return (
      <View style={[styles.container, styles.loadingCenter, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Water point not found.</Text>
      </View>
    );
  }

  const wpConf   = WP_TYPE_CONFIG[wp.type] ?? WP_TYPE_CONFIG.borehole;
  const sc       = statusColor(wp.status);
  const wlPct    = safePct(sensor?.water_level);
  const batPct   = safePct(sensor?.battery_level);
  const BattIcon = batPct > 60 ? BatteryHigh : batPct > 30 ? BatteryMedium : BatteryLow;
  const batColor = batPct > 60 ? Colors.success : batPct > 30 ? Colors.warning : Colors.critical;
  const openReports  = reports.filter(r => r.status === 'open' || r.status === 'in_progress').length;
  const unackAlerts  = alerts.filter(a => !a.acknowledged_at).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Sticky top bar ─────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {wp.name}
        </Text>
        {isLive && (
          <View style={styles.liveChip}>
            <PulseDot color={Colors.success} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); fetchBase(); if (wp.sensor_id) { fetchSensor(); fetchHistory(period); } }}
            tintColor={Colors.primary}
          />
        }
      >

        {/* ── Hero Card ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).springify().damping(18)}>
          <View style={[styles.heroCard, { backgroundColor: wpConf.color + '12' }]}>
            {/* Big background icon */}
            <View style={styles.heroBgIcon} pointerEvents="none">
              <wpConf.Icon size={120} color={wpConf.color} weight="thin" style={{ opacity: 0.12 }} />
            </View>

            <View style={styles.heroContent}>
              <View style={styles.heroLeft}>
                {/* Status row */}
                <View style={styles.heroStatusRow}>
                  <PulseDot color={sc} />
                  <Text style={[styles.heroStatusText, { color: sc }]}>
                    {wp.status.replace('_', ' ')}
                  </Text>
                </View>

                {/* Name */}
                <Text style={[styles.heroName, { color: colors.textPrimary }]}>
                  {wp.name}
                </Text>

                {/* Type badge */}
                <View style={[styles.heroBadge, { backgroundColor: wpConf.color + '20' }]}>
                  <wpConf.Icon size={13} color={wpConf.color} weight="bold" />
                  <Text style={[styles.heroBadgeText, { color: wpConf.color }]}>{wpConf.label}</Text>
                </View>

                {/* Address */}
                {wp.address && (
                  <View style={styles.heroAddress}>
                    <MapPin size={13} color={colors.textMuted} weight="fill" />
                    <Text style={[styles.heroAddressText, { color: colors.textMuted }]} numberOfLines={2}>
                      {wp.address}
                    </Text>
                  </View>
                )}
              </View>

              {/* Summary pills */}
              <View style={styles.heroRight}>
                <SummaryPill value={openReports} label="Reports" color={Colors.critical} />
                <SummaryPill value={unackAlerts} label="Alerts"  color={Colors.warning}  />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Live Sensor ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Sensor Data</Text>
            {sensor && (
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                {timeAgo(sensor.time)}
              </Text>
            )}
          </View>

          {!wp.sensor_id ? (
            <View style={[styles.emptyCard, Shadows.card, { backgroundColor: colors.surface }]}>
              <Gauge size={32} color={colors.textMuted} weight="light" />
              <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>No sensor</Text>
              <Text style={[styles.emptyCardSub, { color: colors.textMuted }]}>
                This water point has no sensor attached
              </Text>
            </View>
          ) : isSensorLoading ? (
            <View style={[styles.emptyCard, Shadows.card, { backgroundColor: colors.surface }]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : !sensor ? (
            <View style={[styles.emptyCard, Shadows.card, { backgroundColor: colors.surface }]}>
              <ArrowsClockwise size={32} color={colors.textMuted} weight="light" />
              <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>No reading yet</Text>
              <Text style={[styles.emptyCardSub, { color: colors.textMuted }]}>Waiting for sensor data</Text>
            </View>
          ) : (
            <Animated.View entering={FadeIn.delay(100)}>
              {/* Water level gauge — hero metric */}
              <View style={[styles.gaugeCard, Shadows.card, { backgroundColor: colors.surface }]}>
                <CircularGauge
                  pct={wlPct}
                  size={170}
                  color={Colors.waterDark}
                  label="Water Level"
                  value={`${wlPct.toFixed(0)}%`}
                  colors={colors}
                />
                <View style={styles.gaugeRight}>
                  <Text style={[styles.gaugeHint, { color: colors.textMuted }]}>
                    {wlPct >= 70 ? 'Level is good' : wlPct >= 40 ? 'Level is moderate' : 'Level is low'}
                  </Text>
                  {sensor.temperature != null && (
                    <View style={[styles.tempChip, { backgroundColor: Colors.warning + '15' }]}>
                      <ThermometerSimple size={16} color={Colors.warning} />
                      <Text style={[styles.tempChipText, { color: Colors.warning }]}>
                        {fmtVal(sensor.temperature, '°C')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Other stats */}
              <View style={[styles.statsCard, Shadows.card, { backgroundColor: colors.surface }]}>
                <StatRow
                  icon={<Wind size={18} color={Colors.water} />}
                  label="Flow Rate"
                  value={fmtVal(sensor.flow_rate, 'L/min')}
                  color={Colors.water}
                  colors={colors}
                />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <StatRow
                  icon={<Gauge size={18} color={Colors.primary} />}
                  label="Pressure"
                  value={fmtVal(sensor.pressure, 'bar')}
                  color={Colors.primary}
                  colors={colors}
                />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <StatRow
                  icon={<BattIcon size={18} color={batColor} />}
                  label="Battery"
                  value={`${batPct.toFixed(0)}%`}
                  color={batColor}
                  bar
                  barPct={batPct}
                  colors={colors}
                />
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Usage Trend ──────────────────────────────────────────────── */}
        {wp.sensor_id && (
          <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Usage Trend</Text>
              <View style={styles.periodRow}>
                {(['daily', 'weekly', 'monthly'] as const).map(p => (
                  <Pressable
                    key={p}
                    onPress={() => setPeriod(p)}
                    style={[
                      styles.periodBtn,
                      { backgroundColor: period === p ? Colors.primary : colors.surfaceSecondary },
                    ]}
                  >
                    <Text style={[styles.periodBtnText, { color: period === p ? '#fff' : colors.textMuted }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.chartCard, Shadows.card, { backgroundColor: colors.surface }]}>
              {isHistoryLoading ? (
                <View style={styles.chartLoader}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                </View>
              ) : (
                <>
                  <AreaChart data={history} colors={colors} />
                  <Text style={[styles.chartCaption, { color: colors.textMuted }]}>
                    Avg flow rate · {period === 'daily' ? 'last 14 days' : period === 'weekly' ? 'last 8 weeks' : 'last 12 months'}
                  </Text>
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Reports / Alerts tabs ───────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).springify().damping(18)}>
          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            <TabButton
              label="Reports"
              count={reports.length}
              active={activeTab === 'reports'}
              color={Colors.critical}
              onPress={() => setActiveTab('reports')}
              colors={colors}
            />
            <TabButton
              label="Alerts"
              count={alerts.length}
              active={activeTab === 'alerts'}
              color={Colors.warning}
              onPress={() => setActiveTab('alerts')}
              colors={colors}
            />
          </View>

          <View style={styles.listContainer}>
            {activeTab === 'reports' ? (
              reports.length === 0 ? (
                <EmptyTab
                  icon={<Drop size={28} color={Colors.primary} weight="light" />}
                  text="No reports for this water point"
                  colors={colors}
                />
              ) : (
                reports.map((r, i) => <ReportRow key={r.id} report={r} index={i} colors={colors} />)
              )
            ) : (
              alerts.length === 0 ? (
                <EmptyTab
                  icon={<Check size={28} color={Colors.success} weight="light" />}
                  text="No recent alerts"
                  colors={colors}
                />
              ) : (
                alerts.map((a, i) => <AlertRow key={a.id} alert={a} index={i} colors={colors} />)
              )
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Supporting components ──────────────────────────────────────────────────────

function SummaryPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: value > 0 ? color + '15' : '#F3F4F6' }]}>
      <Text style={[pillStyles.value, { color: value > 0 ? color : '#9CA3AF' }]}>{value}</Text>
      <Text style={[pillStyles.label, { color: value > 0 ? color : '#9CA3AF' }]}>{label}</Text>
    </View>
  );
}
const pillStyles = StyleSheet.create({
  pill: { borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', minWidth: 60, gap: 2 },
  value: { fontSize: Typography.xl, fontWeight: '800' as any, letterSpacing: -0.5 },
  label: { fontSize: 10, fontWeight: '600' as any, textTransform: 'uppercase', letterSpacing: 0.3 },
});

function TabButton({ label, count, active, color, onPress, colors }: {
  label: string; count: number; active: boolean; color: string; onPress: () => void; colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && { borderBottomColor: color, borderBottomWidth: 2.5 }]}
    >
      <Text style={[styles.tabLabel, { color: active ? color : colors.textMuted },
        active && { fontWeight: '700' as any }]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabBadge, { backgroundColor: active ? color : colors.surfaceSecondary }]}>
          <Text style={[styles.tabBadgeText, { color: active ? '#fff' : colors.textMuted }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ReportRow({ report, index, colors }: { report: Report; index: number; colors: any }) {
  const conf = REPORT_CONFIG[report.type] ?? REPORT_CONFIG.other;
  const { Icon } = conf;
  const sc = statusColor(report.status);
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(16)}>
      <View style={[styles.listCard, Shadows.card, { backgroundColor: colors.surface }]}>
        <View style={[styles.listCardAccent, { backgroundColor: conf.color }]} />
        <View style={[styles.listIconBox, { backgroundColor: conf.color + '15' }]}>
          <Icon size={18} color={conf.color} weight="fill" />
        </View>
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {report.title}
          </Text>
          <Text style={[styles.listSub, { color: colors.textMuted }]}>
            {conf.label} · {timeAgo(report.created_at)}
            {report.upvotes > 0 ? ` · ${report.upvotes} upvotes` : ''}
          </Text>
        </View>
        <View style={[styles.smallPill, { backgroundColor: sc + '12' }]}>
          <Text style={[styles.smallPillText, { color: sc }]}>
            {report.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AlertRow({ alert, index, colors }: { alert: Alert; index: number; colors: any }) {
  const AlertIcon = ALERT_TYPE_ICONS[alert.type] ?? BellSimpleRinging;
  const sevColor = alert.severity === 'critical' ? Colors.critical : alert.severity === 'warning' ? Colors.warning : Colors.info;
  const typeLabel = ALERT_TYPE_LABELS[alert.type] ?? alert.type.replace(/_/g, ' ');
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(16)}>
      <View style={[styles.listCard, Shadows.card, { backgroundColor: colors.surface, opacity: alert.acknowledged_at ? 0.55 : 1 }]}>
        <View style={[styles.listCardAccent, { backgroundColor: sevColor }]} />
        <View style={[styles.listIconBox, { backgroundColor: sevColor + '15' }]}>
          <AlertIcon size={18} color={sevColor} />
        </View>
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {typeLabel}
          </Text>
          <Text style={[styles.listSub, { color: colors.textMuted }]}>
            {timeAgo(alert.triggered_at)}
            {alert.acknowledged_at ? ' · Acknowledged' : ''}
          </Text>
        </View>
        <View style={[styles.smallPill, { backgroundColor: sevColor + '12' }]}>
          <Text style={[styles.smallPillText, { color: sevColor }]}>{alert.severity}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function EmptyTab({ icon, text, colors }: { icon: React.ReactNode; text: string; colors: any }) {
  return (
    <View style={styles.emptyTab}>
      {icon}
      <Text style={[styles.emptyTabText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topBarTitle: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: '700' as any,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700' as any,
    color: Colors.success,
  },

  // Hero
  heroCard: {
    margin: Spacing.lg,
    marginBottom: 0,
    borderRadius: Radii.card,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  heroBgIcon: {
    position: 'absolute',
    right: -20,
    top: -20,
    opacity: 1,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroLeft: { flex: 1, gap: 8 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroStatusText: { fontSize: Typography.sm, fontWeight: '600' as any, textTransform: 'capitalize' },
  heroName: { fontSize: Typography.xl, fontWeight: '800' as any, letterSpacing: -0.5 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700' as any },
  heroAddress: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 2 },
  heroAddressText: { flex: 1, fontSize: Typography.xs, lineHeight: 17 },
  heroRight: { gap: Spacing.sm, alignItems: 'flex-end' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700' as any },
  sectionSub: { fontSize: Typography.xs },

  // Sensor
  gaugeCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radii.card,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  gaugeRight: { flex: 1, gap: Spacing.md },
  gaugeHint: { fontSize: Typography.sm, lineHeight: 18 },
  tempChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  tempChipText: { fontSize: Typography.base, fontWeight: '700' as any },

  statsCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.lg,
  },
  statDivider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },

  emptyCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radii.card,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyCardTitle: { fontSize: Typography.base, fontWeight: '700' as any },
  emptyCardSub: { fontSize: Typography.sm, textAlign: 'center' },

  // Chart
  periodRow: { flexDirection: 'row', gap: 4 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
  periodBtnText: { fontSize: 11, fontWeight: '700' as any },
  chartCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radii.card,
    padding: Spacing.md,
  },
  chartLoader: { height: 120, alignItems: 'center', justifyContent: 'center' },
  chartCaption: { fontSize: 10, textAlign: 'center', marginTop: Spacing.sm },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    borderBottomWidth: 1,
    marginTop: Spacing.xl,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: 4,
  },
  tabLabel: { fontSize: Typography.sm, fontWeight: '500' as any },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.pill, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '700' as any },

  listContainer: { padding: Spacing.lg, gap: Spacing.sm },

  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.card,
    overflow: 'hidden',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  listCardAccent: { width: 4, alignSelf: 'stretch' },
  listIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listInfo: { flex: 1, gap: 3 },
  listTitle: { fontSize: Typography.sm, fontWeight: '700' as any },
  listSub: { fontSize: Typography.xs },
  smallPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.pill },
  smallPillText: { fontSize: 10, fontWeight: '700' as any, textTransform: 'capitalize' },

  emptyTab: { paddingVertical: 48, alignItems: 'center', gap: Spacing.sm },
  emptyTabText: { fontSize: Typography.sm },
});
