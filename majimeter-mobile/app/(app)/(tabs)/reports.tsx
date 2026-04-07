// app/(app)/(tabs)/reports.tsx
// Reports Screen — Screen 5
// Community feed of water issues.
// Bubbly, card-based design with status micro-animations.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Faders,
  WarningCircle,
  Drop,
  CheckCircle,
  Clock,
  ChatCircle,
} from 'phosphor-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  type: 'leak' | 'shortage' | 'quality' | 'point_request';
  status: 'pending' | 'verifying' | 'resolved' | 'dismissed';
  description: string;
  address: string;
  createdAt: string;
  commentsCount: number;
}

export default function ReportsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'all' | 'nearby' | 'my'>('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchReports = async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: Report[] }>('/reports');
      setReports(data.data || []);
    } catch (err) {
      console.warn('Failed to fetch reports:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Community</Text>
        <Pressable style={[styles.filterBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Faders size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <TabItem label="All" active={activeTab === 'all'} onPress={() => setActiveTab('all')} colors={colors} />
        <TabItem label="Nearby" active={activeTab === 'nearby'} onPress={() => setActiveTab('nearby')} colors={colors} />
        <TabItem label="My Reports" active={activeTab === 'my'} onPress={() => setActiveTab('my')} colors={colors} />
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchReports(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <ReportCard report={item} colors={colors} />
          )}
          ListEmptyComponent={<EmptyReports colors={colors} />}
        />
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TabItem({ label, active, onPress, colors }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tab,
        active && { borderBottomColor: Colors.primary, borderBottomWidth: 3 }
      ]}
    >
      <Text style={[
        styles.tabLabel,
        { color: active ? Colors.primary : colors.textMuted },
        active && { fontWeight: Typography.bold }
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ReportCard({ report, colors }: { report: Report; colors: any }) {
  const statusColor = 
    report.status === 'resolved' ? Colors.success :
    report.status === 'verifying' ? Colors.warning :
    Colors.critical;

  const Icon = 
    report.type === 'leak' ? Drop :
    report.type === 'shortage' ? WarningCircle :
    CheckCircle;

  return (
    <Pressable style={[styles.card, Shadows.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBg, { backgroundColor: statusColor + '20' }]}>
          <Icon size={20} color={statusColor} weight="fill" />
        </View>
        <View style={styles.cardTitleArea}>
          <Text style={[styles.reportType, { color: colors.textPrimary }]}>
            {report.type.replace('_', ' ').toUpperCase()}
          </Text>
          <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>
            {report.address}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '10' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{report.status}</Text>
        </View>
      </View>

      <Text style={[styles.description, { color: colors.textPrimary }]} numberOfLines={3}>
        {report.description}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Clock size={16} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>2h ago</Text>
        </View>
        <View style={styles.footerItem}>
          <ChatCircle size={16} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>{report.commentsCount || 0}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyReports({ colors }: any) {
  return (
    <View style={styles.empty}>
      <ChatCircle size={48} color={colors.textMuted} weight="light" />
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No reports yet</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>Be the first to help your community by reporting an issue.</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    letterSpacing: -0.5,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#eee', // Should be dynamic border
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
  },
  tabLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // Card
  card: {
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBg: {
    padding: 8,
    borderRadius: Radii.md,
  },
  cardTitleArea: { flex: 1 },
  reportType: {
    fontSize: Typography.xs,
    fontWeight: Typography.heavy,
    letterSpacing: 0.5,
  },
  address: {
    fontSize: Typography.sm,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  statusText: {
    fontSize: 10,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: Typography.base,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },

  // Empty
  empty: {
    paddingTop: 100,
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  emptyText: {
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
