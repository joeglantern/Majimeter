// app/(app)/(tabs)/map.tsx
// Map Screen — Phase 2
// Clean, bubbly UI with custom markers and a floating "Report" FAB.
// Uses react-native-maps and gorhom/bottom-sheet.

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MagnifyingGlass,
  PlusCircle,
  Gps,
  Drop,
  WarningCircle,
  Crosshair,
} from 'phosphor-react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';

const { width, height } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────

interface PointOfInterest {
  id: string;
  type: 'water_point' | 'report';
  lat: number;
  lng: number;
  title: string;
  status?: string;
}

export default function MapScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Refs
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  // State
  const [region, setRegion] = useState({
    latitude: -1.286389, // Default to Nairobi for now
    longitude: 36.817223,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [pois] = useState<PointOfInterest[]>([
    { id: '1', type: 'water_point', lat: -1.28, lng: 36.82, title: 'Kibera Point A', status: 'active' },
    { id: '2', type: 'report', lat: -1.29, lng: 36.81, title: 'Burst Pipe', status: 'critical' },
  ]);

  // Bottom Sheet logic
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);
  const [reportStep, setReportStep] = useState(0); // 0: Select, 1: Details, 2: Review
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const handleOpenReport = () => {
    setReportStep(0);
    bottomSheetRef.current?.snapToIndex(1);
  };

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setReportStep(1);
  };

  const handleBack = () => setReportStep(reportStep - 1);
  const handleNext = () => setReportStep(reportStep + 1);
  const handleSubmit = () => {
    // Submit logic here
    bottomSheetRef.current?.close();
    setReportStep(0);
  };

  return (
    <View style={styles.container}>
      {/* ── Main Map ────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
      >
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            onPress={() => {}}
          >
            <View style={[
              styles.markerContainer,
              Shadows.card,
              { backgroundColor: poi.type === 'water_point' ? Colors.primary : Colors.critical }
            ]}>
              {poi.type === 'water_point' 
                ? <Drop size={20} color="#fff" weight="fill" />
                : <WarningCircle size={20} color="#fff" weight="fill" />
              }
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── Top Floating Bar ────────────────────────────────────────── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
        <View style={[styles.searchBar, Shadows.card, { backgroundColor: colors.surface }]}>
          <MagnifyingGlass size={20} color={colors.textMuted} />
          <Text style={[styles.searchText, { color: colors.textMuted }]}>Search for water points...</Text>
        </View>
      </View>

      {/* ── Bottom Controls ─────────────────────────────────────────── */}
      <View style={[styles.bottomControls, { bottom: 100 }]}>
        <Pressable
          style={[styles.zoomBtn, Shadows.card, { backgroundColor: colors.surface }]}
          onPress={() => {}}
        >
          <Crosshair size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {/* ── Large Bubbly Report FAB ─────────────────────────────────── */}
      {reportStep === 0 && (
        <Pressable
          style={[
            styles.reportFab,
            Shadows.fab,
            { bottom: 100, left: width / 2 - 80 }
          ]}
          onPress={handleOpenReport}
        >
          <View style={styles.fabGradient}>
            <PlusCircle size={24} color="#fff" weight="bold" />
            <Text style={styles.fabText}>Report Issue</Text>
          </View>
        </Pressable>
      )}

      {/* ── Reporting Bottom Sheet ──────────────────────────────────── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => setReportStep(0)}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backgroundStyle={{ backgroundColor: colors.surface }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {reportStep === 0 && (
            <View style={styles.sheetLayout}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Choose Issue Type</Text>
              <View style={styles.grid}>
                <IssueTypeCard
                  icon={Drop}
                  label="Water Leak"
                  color={Colors.water}
                  colors={colors}
                  onPress={() => handleSelectType('Water Leak')}
                />
                <IssueTypeCard
                  icon={WarningCircle}
                  label="No Water"
                  color={Colors.critical}
                  colors={colors}
                  onPress={() => handleSelectType('No Water')}
                />
                <IssueTypeCard
                  icon={Crosshair}
                  label="Low Pressure"
                  color={Colors.warning}
                  colors={colors}
                  onPress={() => handleSelectType('Low Pressure')}
                />
                <IssueTypeCard
                  icon={Gps}
                  label="New Point"
                  color={Colors.success}
                  colors={colors}
                  onPress={() => handleSelectType('New Point')}
                />
              </View>
            </View>
          )}

          {reportStep === 1 && (
            <View style={styles.sheetLayout}>
              <View style={styles.sheetHeader}>
                <Pressable onPress={handleBack}><Text style={{ color: Colors.primary, fontWeight: 'bold' }}>Back</Text></Pressable>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Add Details</Text>
                <View style={{ width: 40 }} />
              </View>
              
              <View style={[styles.inputGroup, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>What's happening?</Text>
                <View style={[styles.textArea, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted }}>Describe the issue briefly...</Text>
                </View>
              </View>

              <Pressable style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceSecondary, borderStyle: 'dashed', borderColor: colors.borderStrong }]}>
                <PlusCircle size={24} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }}>Add a photo (Optional)</Text>
              </Pressable>

              <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.primary }]} onPress={handleNext}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {reportStep === 2 && (
            <View style={styles.sheetLayout}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Review Report</Text>
              
              <View style={[styles.summaryCard, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.summaryRow}>
                  <Text style={{ color: colors.textSecondary }}>Type</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{selectedType}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={{ color: colors.textSecondary }}>Location</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>Detected Nearby</Text>
                </View>
              </View>

              <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.success }]} onPress={handleSubmit}>
                <Text style={styles.primaryBtnText}>Submit Report</Text>
              </Pressable>
              
              <Pressable style={styles.ghostBtn} onPress={handleBack}>
                <Text style={{ color: colors.textSecondary }}>Go Back</Text>
              </Pressable>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IssueTypeCard({ icon: Icon, label, color, colors, onPress }: any) {
  return (
    <Pressable style={[styles.typeCard, { backgroundColor: colors.surfaceSecondary }]} onPress={onPress}>
      <View style={[styles.typeIconBg, { backgroundColor: color + '20' }]}>
        <Icon size={32} color={color} weight="fill" />
      </View>
      <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  
  // Marker
  markerContainer: {
    padding: 8,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Floating Search
  topBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radii.pill,
    gap: Spacing.sm,
  },
  searchText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
  },

  // Bottom Controls
  bottomControls: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 10,
    gap: Spacing.md,
  },
  zoomBtn: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Report FAB
  reportFab: {
    position: 'absolute',
    width: 160,
    height: 56,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    zIndex: 10,
  },
  fabGradient: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },

  // Bottom Sheet
  sheetContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  sheetLayout: {
    gap: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sheetTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.heavy,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  typeCard: {
    width: (width - Spacing.lg * 2 - Spacing.md * 2) / 2,
    aspectRatio: 1,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  typeIconBg: {
    padding: 16,
    borderRadius: Radii.xl,
  },
  typeLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },

  // Steps UI
  inputGroup: {
    padding: Spacing.md,
    borderRadius: Radii.card,
    gap: 8,
  },
  inputLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
  },
  textArea: {
    height: 100,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  imagePlaceholder: {
    height: 120,
    borderRadius: Radii.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: Radii.card,
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ghostBtn: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
});

// ── Map Styles ────────────────────────────────────────────────────────────────

const LIGHT_MAP_STYLE: any[] = []; // Add detailed styles to make it look "Human Crafted" like Apple Maps
const DARK_MAP_STYLE: any[] = [];
