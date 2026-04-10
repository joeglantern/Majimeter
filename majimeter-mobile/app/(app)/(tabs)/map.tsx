// app/(app)/(tabs)/map.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MagnifyingGlass,
  PlusCircle,
  Drop,
  DropSlash,
  WarningCircle,
  Flask,
  HardHat,
  DotsThree,
  X,
  ArrowsClockwise,
  ThumbsUp,
  Gauge,
  Wind,
  BatteryHigh,
  BatteryLow,
  BatteryMedium,
  NavigationArrow,
  ThermometerSimple,
  Camera,
} from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

const REPORT_TYPES = [
  { key: 'burst_pipe',     label: 'Burst Pipe',   hint: 'Leak or burst',    Icon: DropSlash,     color: Colors.water     },
  { key: 'shortage',       label: 'No Water',     hint: 'Supply cut off',   Icon: WarningCircle, color: Colors.critical  },
  { key: 'contamination',  label: 'Dirty Water',  hint: 'Quality issue',    Icon: Flask,         color: Colors.warning   },
  { key: 'infrastructure', label: 'Damage',       hint: 'Infrastructure',   Icon: HardHat,       color: Colors.info      },
  { key: 'other',          label: 'Other',        hint: 'Something else',   Icon: DotsThree,     color: '#9CA3AF'        },
] as const;

const WP_TYPE_LABEL: Record<string, string> = {
  borehole: 'Borehole',
  tank:     'Tank',
  pipe:     'Pipeline',
  tap:      'Tap Stand',
};

// ── Types ────────────────────────────────────────────────────────────────────

type MapPOI = {
  id: string;
  type: 'water_point' | 'report';
  lat: number;
  lng: number;
  title: string;
  status: string;
  subType?: string;
  upvotes?: number;
  description?: string;
  created_at?: string;
  address?: string;
  sensor_id?: string | null;
  wp_type?: string;
};

type SensorReading = {
  flow_rate: string | null;
  pressure: string | null;
  water_level: string | null;
  temperature: string | null;
  battery_level: string | null;
  time: string;
};

type UserLocation = { latitude: number; longitude: number } | null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtVal(val: string | null, unit: string, decimals = 1): string {
  if (val == null) return '—';
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `${n.toFixed(decimals)} ${unit}`;
}

function batteryPct(val: string | null): number {
  return Math.min(100, Math.max(0, parseFloat(val ?? '0') || 0));
}

function waterLevelPct(val: string | null): number {
  return Math.min(100, Math.max(0, parseFloat(val ?? '0') || 0));
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':      return Colors.success;
    case 'resolved':    return Colors.success;
    case 'in_progress': return Colors.warning;
    case 'maintenance': return Colors.warning;
    case 'open':        return Colors.critical;
    case 'dismissed':   return '#9CA3AF';
    default:            return Colors.info;
  }
}

function reportIconForType(type?: string) {
  const found = REPORT_TYPES.find(r => r.key === type);
  return found ?? REPORT_TYPES[REPORT_TYPES.length - 1];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({
  label, value, icon, color, colors, children,
}: {
  label: string; value: string; icon: React.ReactNode;
  color: string; colors: any; children?: React.ReactNode;
}) {
  return (
    <View style={[metricStyles.tile, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={[metricStyles.iconWrap, { backgroundColor: color + '18' }]}>{icon}</View>
      <Text style={[metricStyles.value, { color: colors.textPrimary }]}>{value}</Text>
      {children}
      <Text style={[metricStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function LevelBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={metricStyles.barTrack}>
      <View style={[metricStyles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function SensorSkeleton({ colors }: { colors: any }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1, true,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[metricStyles.skeletonGrid, style]}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[metricStyles.skeletonTile, { backgroundColor: colors.surfaceSecondary }]} />
      ))}
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { colors, isDark } = useTheme();
  const { accessToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<Socket | null>(null);

  const [region, setRegion] = useState({
    latitude: -1.286389, longitude: 36.817223,
    latitudeDelta: 0.08,  longitudeDelta: 0.08,
  });
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [pois, setPois] = useState<MapPOI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<MapPOI | null>(null);
  const [sensorData, setSensorData] = useState<SensorReading | null>(null);
  const [isFetchingSensor, setIsFetchingSensor] = useState(false);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [localUpvotes, setLocalUpvotes] = useState<Record<string, number>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapPOI[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<TextInput>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isReporting, setIsReporting] = useState(false);
  const [reportStep, setReportStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Animations ───────────────────────────────────────────────────────────
  const cardTranslateY = useSharedValue(400);
  const cardOpacity = useSharedValue(0);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
    opacity: cardOpacity.value,
  }));

  // ── Location ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setRegion(r => ({ ...r, ...coords }));
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 800);
    })();
  }, []);

  // ── Data Fetch ───────────────────────────────────────────────────────────
  const fetchMapData = useCallback(async (loc?: UserLocation) => {
    const position = loc ?? userLocation;
    try {
      const geoParams = position
        ? { lat: position.latitude, lng: position.longitude, radius: 15 }
        : {};
      const [wpRes, openRes, inProgressRes] = await Promise.all([
        api.get('/water-points', { params: { ...geoParams, limit: 100 } }),
        api.get('/reports', { params: { ...geoParams, status: 'open', limit: 100 } }),
        api.get('/reports', { params: { ...geoParams, status: 'in_progress', limit: 100 } }),
      ]);
      const waterPoints: MapPOI[] = (wpRes.data.data ?? []).map((wp: any) => ({
        id: wp.id, type: 'water_point' as const,
        lat: parseFloat(wp.location_lat), lng: parseFloat(wp.location_lng),
        title: wp.name || 'Water Point', status: wp.status,
        address: wp.address ?? null, sensor_id: wp.sensor_id ?? null, wp_type: wp.type,
      }));
      const reports: MapPOI[] = [
        ...(openRes.data.data ?? []),
        ...(inProgressRes.data.data ?? []),
      ].map((rep: any) => ({
        id: rep.id, type: 'report' as const,
        lat: parseFloat(rep.location_lat), lng: parseFloat(rep.location_lng),
        title: rep.title || 'Incident Report', status: rep.status,
        subType: rep.type, upvotes: rep.upvotes ?? 0,
        description: rep.description ?? '', created_at: rep.created_at,
      }));
      setPois([...waterPoints, ...reports]);
    } catch (err) {
      console.error('Map fetch error:', err);
    }
  }, [userLocation]);

  useEffect(() => { fetchMapData(); }, [userLocation]);

  // Keep selectedPOI in sync when pois refresh (e.g. upvote from another user)
  useEffect(() => {
    if (!selectedPOI) return;
    const updated = pois.find(p => p.id === selectedPOI.id);
    if (updated) setSelectedPOI(updated);
  }, [pois]);

  // ── Socket — use ref to avoid stale closure forcing reconnects ───────────
  const fetchMapDataRef = useRef(fetchMapData);
  useEffect(() => { fetchMapDataRef.current = fetchMapData; }, [fetchMapData]);

  useEffect(() => {
    if (!accessToken) return;
    const baseUrl = api.defaults.baseURL?.toString().split('/api/v1')[0] || '';
    const socket = io(`${baseUrl}/map`, {
      auth: { token: `Bearer ${accessToken}` },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.on('report:new',     () => fetchMapDataRef.current());
    socket.on('report:updated', () => fetchMapDataRef.current());
    socket.on('report:resolved',() => fetchMapDataRef.current());
    return () => { socket.disconnect(); };
  }, [accessToken]); // stable — no reconnect on location change

  // ── Sensor Fetch ─────────────────────────────────────────────────────────
  const fetchSensorData = async (poi: MapPOI) => {
    if (!poi.sensor_id) { setSensorData(null); return; }
    setIsFetchingSensor(true);
    setSensorData(null);
    try {
      const { data } = await api.get(`/water-points/${poi.id}/sensors/live`);
      setSensorData(data.data ?? null);
    } catch {
      setSensorData(null);
    } finally {
      setIsFetchingSensor(false);
    }
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/water-points', { params: { q: text.trim(), limit: 10 } });
        const results: MapPOI[] = (data.data ?? []).map((wp: any) => ({
          id: wp.id, type: 'water_point' as const,
          lat: parseFloat(wp.location_lat), lng: parseFloat(wp.location_lng),
          title: wp.name, status: wp.status,
          address: wp.address ?? null, sensor_id: wp.sensor_id ?? null, wp_type: wp.type,
        }));
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSearchSelect = (poi: MapPOI) => {
    setSearchQuery(''); setSearchResults([]); setSearchFocused(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(
      { latitude: poi.lat, longitude: poi.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600,
    );
    setSelectedPOI(poi); showCard(); fetchSensorData(poi);
  };

  const handleSearchClear = () => {
    setSearchQuery(''); setSearchResults([]); setSearchFocused(false);
    Keyboard.dismiss();
  };

  // ── Card show/hide ────────────────────────────────────────────────────────
  const showCard = () => {
    cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    cardOpacity.value = withTiming(1, { duration: 200 });
  };

  const hideCard = (cb?: () => void) => {
    cardTranslateY.value = withSpring(400, { damping: 20 });
    cardOpacity.value = withTiming(0, { duration: 150 });
    setTimeout(() => cb?.(), 280);
  };

  // ── Map handlers ──────────────────────────────────────────────────────────
  const handleMarkerPress = (poi: MapPOI) => {
    if (isReporting) return;
    setSelectedPOI(poi);
    setSensorData(null);
    mapRef.current?.animateCamera(
      { center: { latitude: poi.lat, longitude: poi.lng }, pitch: 40, altitude: 1200, zoom: 15 },
      { duration: 600 },
    );
    showCard();
    if (poi.type === 'water_point') fetchSensorData(poi);
  };

  const handleDeselect = () => hideCard(() => setSelectedPOI(null));

  const handleCenterOnUser = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600);
  };

  // ── Report sheet ──────────────────────────────────────────────────────────
  const handleOpenReport = () => {
    hideCard(() => { setIsReporting(true); setReportStep(0); });
  };

  const handleCloseReport = () => {
    setIsReporting(false);
    setDescription(''); setSelectedType(null); setReportStep(0); setReportImage(null);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setReportImage(result.assets[0].uri);
    }
  };

  const handleUpvote = async (poi: MapPOI) => {
    if (upvotedIds.has(poi.id)) return;
    setUpvotedIds(s => new Set(s).add(poi.id));
    const prev = localUpvotes[poi.id] ?? poi.upvotes ?? 0;
    setLocalUpvotes(m => ({ ...m, [poi.id]: prev + 1 }));
    try {
      const { data } = await api.post(`/reports/${poi.id}/upvote`);
      setLocalUpvotes(m => ({ ...m, [poi.id]: data.data.upvotes }));
    } catch {
      setUpvotedIds(s => { const n = new Set(s); n.delete(poi.id); return n; });
      setLocalUpvotes(m => ({ ...m, [poi.id]: prev }));
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !description.trim()) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      const typeConfig = REPORT_TYPES.find(r => r.key === selectedType) ?? REPORT_TYPES[0];
      formData.append('type', selectedType || 'other');
      formData.append('title', typeConfig.label);
      formData.append('description', description);
      formData.append('location_lat', (userLocation?.latitude ?? region.latitude).toString());
      formData.append('location_lng', (userLocation?.longitude ?? region.longitude).toString());
      if (reportImage) {
        const ext = reportImage.split('.').pop() ?? 'jpg';
        formData.append('images', {
          uri: reportImage, name: `report.${ext}`, type: `image/${ext}`,
        } as any);
      }
      await api.post('/reports', formData);
      Alert.alert('Reported!', 'Thank you for helping your community.');
      handleCloseReport();
      fetchMapData();
    } catch {
      Alert.alert('Error', 'Could not submit. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Detail card content ───────────────────────────────────────────────────
  const renderDetailContent = () => {
    if (!selectedPOI) return null;

    if (selectedPOI.type === 'water_point') {
      const sc = statusColor(selectedPOI.status);
      const wLevel = waterLevelPct(sensorData?.water_level ?? null);
      const bat = batteryPct(sensorData?.battery_level ?? null);
      const BattIcon = bat > 60 ? BatteryHigh : bat > 30 ? BatteryMedium : BatteryLow;
      const batColor = bat > 60 ? Colors.success : bat > 30 ? Colors.warning : Colors.critical;
      const wpLabel = WP_TYPE_LABEL[selectedPOI.wp_type ?? ''] ?? selectedPOI.wp_type ?? '';

      return (
        <>
          <View style={cardStyles.header}>
            <View style={[cardStyles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
              <Drop size={22} color={Colors.primary} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[cardStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                  {selectedPOI.title}
                </Text>
                {wpLabel ? (
                  <View style={[cardStyles.typeBadge, { backgroundColor: Colors.primary + '15' }]}>
                    <Text style={[cardStyles.typeBadgeText, { color: Colors.primary }]}>{wpLabel}</Text>
                  </View>
                ) : null}
              </View>
              {selectedPOI.address ? (
                <Text style={[cardStyles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {selectedPOI.address}
                </Text>
              ) : null}
            </View>
            <View style={[cardStyles.statusPill, { backgroundColor: sc + '15' }]}>
              <Text style={[cardStyles.statusText, { color: sc }]}>
                {selectedPOI.status.replace('_', ' ')}
              </Text>
            </View>
            <Pressable onPress={handleDeselect} style={cardStyles.closeBtn} hitSlop={12}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Sensor section */}
          {isFetchingSensor ? (
            <SensorSkeleton colors={colors} />
          ) : !selectedPOI.sensor_id ? (
            <Animated.View entering={FadeIn} style={[cardStyles.noSensor, { backgroundColor: colors.surfaceSecondary }]}>
              <Gauge size={20} color={colors.textMuted} />
              <Text style={[cardStyles.noSensorText, { color: colors.textMuted }]}>No sensor attached</Text>
            </Animated.View>
          ) : sensorData ? (
            <Animated.View entering={FadeIn}>
              <View style={metricStyles.grid}>
                <MetricTile label="Flow Rate" value={fmtVal(sensorData.flow_rate, 'L/m')}
                  icon={<Wind size={18} color={Colors.water} />} color={Colors.water} colors={colors} />
                <MetricTile label="Pressure" value={fmtVal(sensorData.pressure, 'bar')}
                  icon={<Gauge size={18} color={Colors.primary} />} color={Colors.primary} colors={colors} />
                <MetricTile label="Water Level" value={`${wLevel.toFixed(0)}%`}
                  icon={<Drop size={18} color={Colors.waterDark} />} color={Colors.waterDark} colors={colors}>
                  <LevelBar pct={wLevel} color={Colors.waterDark} />
                </MetricTile>
                <MetricTile label="Battery" value={`${bat.toFixed(0)}%`}
                  icon={<BattIcon size={18} color={batColor} />} color={batColor} colors={colors}>
                  <LevelBar pct={bat} color={batColor} />
                </MetricTile>
              </View>
              {/* Temperature full-width row */}
              {sensorData.temperature != null && (
                <View style={[metricStyles.tempRow, { backgroundColor: colors.surfaceSecondary }]}>
                  <ThermometerSimple size={16} color={Colors.warning} />
                  <Text style={[metricStyles.tempValue, { color: colors.textPrimary }]}>
                    {fmtVal(sensorData.temperature, '°C')}
                  </Text>
                  <Text style={[metricStyles.tempLabel, { color: colors.textMuted }]}>Temperature</Text>
                  <Text style={[metricStyles.tempTime, { color: colors.textMuted }]}>
                    {timeAgo(sensorData.time)}
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} style={[cardStyles.noSensor, { backgroundColor: colors.surfaceSecondary }]}>
              <ArrowsClockwise size={18} color={colors.textMuted} />
              <Text style={[cardStyles.noSensorText, { color: colors.textMuted }]}>No recent reading</Text>
            </Animated.View>
          )}

          <View style={cardStyles.footer}>
            <Pressable
              style={[cardStyles.footerBtn, { backgroundColor: Colors.primary, flex: 1 }]}
              onPress={() => {
                hideCard(() => router.push(`/(app)/water-point/${selectedPOI!.id}` as any));
              }}
            >
              <Text style={[cardStyles.footerBtnText, { color: '#fff' }]}>View Details</Text>
            </Pressable>
            <Pressable
              style={[cardStyles.footerBtn, { backgroundColor: colors.surfaceSecondary }]}
              onPress={handleOpenReport}
            >
              <WarningCircle size={16} color={Colors.critical} />
            </Pressable>
          </View>
        </>
      );
    }

    // ── Report card ─────────────────────────────────────────────────────────
    const sc = statusColor(selectedPOI.status);
    const upvotes = localUpvotes[selectedPOI.id] ?? selectedPOI.upvotes ?? 0;
    const hasUpvoted = upvotedIds.has(selectedPOI.id);
    const typeConfig = reportIconForType(selectedPOI.subType);

    return (
      <>
        <View style={cardStyles.header}>
          <View style={[cardStyles.iconCircle, { backgroundColor: typeConfig.color + '18' }]}>
            <typeConfig.Icon size={22} color={typeConfig.color} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cardStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {selectedPOI.title}
            </Text>
            <Text style={[cardStyles.subtitle, { color: colors.textMuted }]}>
              {typeConfig.label}
              {selectedPOI.created_at ? `  ·  ${timeAgo(selectedPOI.created_at)}` : ''}
            </Text>
          </View>
          <View style={[cardStyles.statusPill, { backgroundColor: sc + '15' }]}>
            <Text style={[cardStyles.statusText, { color: sc }]}>
              {selectedPOI.status.replace('_', ' ')}
            </Text>
          </View>
          <Pressable onPress={handleDeselect} style={cardStyles.closeBtn} hitSlop={12}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {selectedPOI.description ? (
          <Animated.View entering={FadeInDown.duration(250)}>
            <Text style={[cardStyles.description, { color: colors.textSecondary }]} numberOfLines={3}>
              {selectedPOI.description}
            </Text>
          </Animated.View>
        ) : null}

        <View style={cardStyles.footer}>
          <Pressable
            style={[
              cardStyles.upvoteBtn,
              { backgroundColor: hasUpvoted ? Colors.primary + '15' : colors.surfaceSecondary },
              hasUpvoted && { borderColor: Colors.primary, borderWidth: 1 },
            ]}
            onPress={() => handleUpvote(selectedPOI)}
            disabled={hasUpvoted}
          >
            <ThumbsUp size={16} color={hasUpvoted ? Colors.primary : colors.textMuted}
              weight={hasUpvoted ? 'fill' : 'regular'} />
            <Text style={[cardStyles.upvoteText, { color: hasUpvoted ? Colors.primary : colors.textMuted }]}>
              {upvotes}
            </Text>
          </Pressable>
          <Text style={[cardStyles.reportType, { color: colors.textMuted }]}>Community report</Text>
        </View>
      </>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onPress={handleDeselect}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pois.map(poi => {
          const isReport = poi.type === 'report';
          const isSelected = selectedPOI?.id === poi.id;
          const rConfig = isReport ? reportIconForType(poi.subType) : null;
          const markerBg = isReport
            ? (poi.status === 'resolved' ? Colors.success : rConfig?.color ?? Colors.critical)
            : (poi.status === 'active' ? Colors.primary : poi.status === 'maintenance' ? Colors.warning : '#9CA3AF');

          return (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.lat, longitude: poi.lng }}
              onPress={e => { e.stopPropagation(); handleMarkerPress(poi); }}
              tracksViewChanges={false}
            >
              <View style={[styles.marker, isSelected && styles.markerSelected, { backgroundColor: markerBg }]}>
                {isReport && rConfig
                  ? <rConfig.Icon size={18} color="#fff" weight="fill" />
                  : <Drop size={18} color="#fff" weight="fill" />}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Detail Card */}
      <Animated.View
        style={[styles.detailCard, { backgroundColor: colors.surface, bottom: insets.bottom + 96 }, cardAnimatedStyle]}
        pointerEvents={selectedPOI ? 'auto' : 'none'}
      >
        {renderDetailContent()}
      </Animated.View>

      {/* Top Bar */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <View style={[styles.searchBar, Shadows.card, { backgroundColor: colors.surface }]}>
            {isSearching
              ? <ActivityIndicator size="small" color={Colors.primary} style={{ width: 18 }} />
              : <MagnifyingGlass size={18} color={searchFocused ? Colors.primary : colors.textMuted} />}
            <TextInput
              ref={searchRef}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search water points..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { if (!searchQuery) setSearchFocused(false); }}
              returnKeyType="search"
              clearButtonMode="never"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleSearchClear} hitSlop={10}>
                <X size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {searchFocused && searchResults.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={[styles.searchDropdown, Shadows.modal, { backgroundColor: colors.surface }]}
            >
              {searchResults.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.searchResultItem,
                    index < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => handleSearchSelect(item)}
                >
                  <View style={[styles.searchResultIcon, { backgroundColor: Colors.primary + '15' }]}>
                    <Drop size={14} color={Colors.primary} weight="fill" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.address ? (
                      <Text style={[styles.searchResultAddr, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.address}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.searchResultStatus, { backgroundColor: statusColor(item.status) + '15' }]}>
                    <Text style={[styles.searchResultStatusText, { color: statusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Animated.View>
          )}

          {searchFocused && searchQuery.length > 0 && !isSearching && searchResults.length === 0 && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[styles.searchDropdown, Shadows.modal, { backgroundColor: colors.surface }]}
            >
              <View style={styles.searchEmpty}>
                <MagnifyingGlass size={20} color={colors.textMuted} />
                <Text style={[styles.searchEmptyText, { color: colors.textMuted }]}>No water points found</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {userLocation && (
          <Pressable
            style={[styles.locateBtn, Shadows.card, { backgroundColor: colors.surface }]}
            onPress={handleCenterOnUser}
          >
            <NavigationArrow size={20} color={Colors.primary} weight="fill" />
          </Pressable>
        )}
      </View>

      {/* Legend */}
      <View style={[styles.legend, Shadows.card, { backgroundColor: colors.surface, top: insets.top + Spacing.sm + 54 }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Water Point</Text>
        </View>
        <View style={[styles.legendDivider, { backgroundColor: colors.border }]} />
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.critical }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Report</Text>
        </View>
      </View>

      {/* FAB */}
      {!isReporting && !selectedPOI && (
        <Animated.View entering={FadeInDown.springify()} style={[styles.fabWrap, { bottom: insets.bottom + 100 }]}>
          <Pressable style={[styles.fab, Shadows.fab]} onPress={handleOpenReport}>
            <PlusCircle size={22} color="#fff" weight="bold" />
            <Text style={styles.fabText}>Report Issue</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Report Sheet */}
      {isReporting && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrap}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom + 90 }}>
              <Animated.View
                entering={FadeInDown.springify().damping(18)}
                style={[styles.sheet, Shadows.modal, { backgroundColor: colors.surface }]}
              >
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                      {reportStep === 0 ? 'What happened?' : 'Add details'}
                    </Text>
                    <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
                      {reportStep === 0 ? 'Choose the issue type' : 'Description + optional photo'}
                    </Text>
                  </View>
                  <Pressable onPress={handleCloseReport} style={[styles.sheetClose, { backgroundColor: colors.surfaceSecondary }]}>
                    <X size={18} color={colors.textMuted} />
                  </Pressable>
                </View>

                {/* Step 0 — type picker */}
                {reportStep === 0 && (
                  <Animated.View entering={FadeInDown.duration(250)}>
                    <View style={styles.typeGrid}>
                      {REPORT_TYPES.slice(0, 4).map(rt => (
                        <Pressable
                          key={rt.key}
                          style={[styles.typeCard, { backgroundColor: rt.color + '12', borderColor: rt.color + '35', borderWidth: 1 }]}
                          onPress={() => { setSelectedType(rt.key); setReportStep(1); }}
                        >
                          <View style={[styles.typeIconWrap, { backgroundColor: rt.color + '22' }]}>
                            <rt.Icon size={26} color={rt.color} weight="fill" />
                          </View>
                          <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{rt.label}</Text>
                          <Text style={[styles.typeHint, { color: colors.textMuted }]}>{rt.hint}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {/* Other — full width */}
                    <Pressable
                      style={[styles.typeOther, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={() => { setSelectedType('other'); setReportStep(1); }}
                    >
                      <DotsThree size={20} color={colors.textMuted} weight="bold" />
                      <Text style={[styles.typeOtherLabel, { color: colors.textSecondary }]}>Something else</Text>
                    </Pressable>
                  </Animated.View>
                )}

                {/* Step 1 — details */}
                {reportStep === 1 && (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.detailsForm}>
                    {/* Selected type badge */}
                    {(() => {
                      const rt = REPORT_TYPES.find(r => r.key === selectedType) ?? REPORT_TYPES[REPORT_TYPES.length - 1];
                      return (
                        <Pressable
                          style={[styles.selectedTypeBadge, { backgroundColor: rt.color + '15' }]}
                          onPress={() => setReportStep(0)}
                        >
                          <rt.Icon size={14} color={rt.color} weight="fill" />
                          <Text style={[styles.selectedTypeText, { color: rt.color }]}>{rt.label}</Text>
                          <Text style={[styles.selectedTypeChange, { color: rt.color + 'AA' }]}>change</Text>
                        </Pressable>
                      );
                    })()}

                    <TextInput
                      style={[styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }]}
                      placeholder="Describe what you see..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      value={description}
                      onChangeText={setDescription}
                      autoFocus
                    />

                    {/* Photo picker */}
                    {reportImage ? (
                      <View style={styles.imagePreviewWrap}>
                        <Image source={{ uri: reportImage }} style={styles.imagePreview} />
                        <Pressable
                          style={styles.imageRemove}
                          onPress={() => setReportImage(null)}
                        >
                          <X size={14} color="#fff" weight="bold" />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                        onPress={handlePickImage}
                      >
                        <Camera size={18} color={colors.textMuted} />
                        <Text style={[styles.photoBtnText, { color: colors.textMuted }]}>Add photo (optional)</Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={[styles.submitBtn, { backgroundColor: description.trim() ? Colors.primary : colors.border }]}
                      onPress={handleSubmit}
                      disabled={!description.trim() || isSubmitting}
                    >
                      {isSubmitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.submitBtnText}>Submit Report</Text>}
                    </Pressable>
                  </Animated.View>
                )}
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TILE_W = (SCREEN_W - Spacing.md * 2 - Spacing.lg * 2 - 8) / 2;

const metricStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tile: { width: TILE_W, borderRadius: Radii.md, padding: 12, gap: 4 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  value: { fontSize: 18, fontWeight: Typography.heavy as any, letterSpacing: -0.3 },
  label: { fontSize: 11, fontWeight: Typography.medium as any, textTransform: 'uppercase', letterSpacing: 0.4 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: '#00000012', overflow: 'hidden', marginTop: 2 },
  barFill: { height: '100%', borderRadius: 2 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  skeletonTile: { width: TILE_W, height: 90, borderRadius: Radii.md },
  tempRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  tempValue: { fontSize: Typography.base as any, fontWeight: Typography.bold as any },
  tempLabel: { fontSize: 12, flex: 1 },
  tempTime: { fontSize: 11 },
});

const cardStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography.base as any, fontWeight: Typography.heavy as any },
  subtitle: { fontSize: 12, marginTop: 1 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.pill },
  typeBadgeText: { fontSize: 10, fontWeight: Typography.bold as any },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
  statusText: { fontSize: 10, fontWeight: Typography.bold as any, textTransform: 'capitalize' },
  closeBtn: { padding: 6, borderRadius: 20 },
  description: { fontSize: Typography.sm as any, lineHeight: 20, marginBottom: 12 },
  noSensor: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: Radii.md, marginTop: 4, marginBottom: 4 },
  noSensorText: { fontSize: Typography.sm as any },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radii.pill },
  footerBtnText: { fontSize: Typography.sm as any, fontWeight: Typography.bold as any },
  upvoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radii.pill },
  upvoteText: { fontSize: Typography.sm as any, fontWeight: Typography.bold as any },
  reportType: { fontSize: Typography.xs as any, marginLeft: 'auto' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: {
    padding: 8, borderRadius: 50, borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  markerSelected: { borderColor: Colors.warning, borderWidth: 3, transform: [{ scale: 1.15 }] },

  topBar: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', gap: Spacing.sm, zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderRadius: Radii.pill, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: Typography.sm as any, paddingVertical: 0 },
  searchDropdown: { marginTop: 6, borderRadius: Radii.card, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 10 },
  searchResultIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchResultName: { fontSize: Typography.sm as any, fontWeight: Typography.bold as any },
  searchResultAddr: { fontSize: 11, marginTop: 1 },
  searchResultStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
  searchResultStatusText: { fontSize: 10, fontWeight: Typography.bold as any, textTransform: 'capitalize' },
  searchEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md },
  searchEmptyText: { fontSize: Typography.sm as any },

  locateBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  legend: {
    position: 'absolute', right: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, gap: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: Typography.medium as any },
  legendDivider: { width: 1, height: 12 },

  detailCard: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    borderRadius: Radii.card, paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg, paddingBottom: Spacing.lg, zIndex: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 }, elevation: 14,
  },

  fabWrap: { position: 'absolute', alignSelf: 'center', zIndex: 10 },
  fab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 24,
    paddingVertical: 14, borderRadius: Radii.pill,
  },
  fabText: { color: '#fff', fontSize: Typography.base as any, fontWeight: Typography.bold as any },

  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30 },
  sheet: { marginHorizontal: Spacing.md, borderRadius: Radii.card, padding: Spacing.lg },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  sheetTitle: { fontSize: Typography.xl as any, fontWeight: Typography.heavy as any },
  sheetSub: { fontSize: Typography.sm as any, marginTop: 2 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  typeCard: { width: (SCREEN_W - Spacing.md * 2 - Spacing.lg * 2 - Spacing.sm) / 2, borderRadius: Radii.card, padding: Spacing.md, alignItems: 'center', gap: 6 },
  typeIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: Typography.sm as any, fontWeight: Typography.heavy as any },
  typeHint: { fontSize: 11 },
  typeOther: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radii.md, padding: 12, marginBottom: Spacing.sm },
  typeOtherLabel: { fontSize: Typography.sm as any, fontWeight: Typography.medium as any },

  detailsForm: { gap: Spacing.md },
  selectedTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill },
  selectedTypeText: { fontSize: Typography.sm as any, fontWeight: Typography.bold as any },
  selectedTypeChange: { fontSize: 11 },
  textArea: { minHeight: 80, borderWidth: 1, borderRadius: Radii.md, padding: 12, fontSize: Typography.base as any, textAlignVertical: 'top' },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radii.md, padding: 12 },
  photoBtnText: { fontSize: Typography.sm as any },
  imagePreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  imagePreview: { width: 80, height: 80, borderRadius: Radii.md },
  imageRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.critical, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { height: 52, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: Typography.base as any, fontWeight: Typography.bold as any },
});
