// app/(app)/(tabs)/alerts.tsx
// Alerts Screen — Screen 6
// Real-time critical alerts (maintenance, leaks, outages).
// Technicians/Admins can acknowledge alerts here.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellSimpleRinging,
  Warning,
  Info,
  Check,
  MapPin,
} from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';
import { api } from '@/lib/api';
import { getAlertsSocket } from '@/lib/socket';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  waterPointId?: string;
  waterPointName?: string;
  acknowledged: boolean;
  createdAt: string;
}

export default function AlertsScreen() {
  const { accessToken, canAcknowledgeAlerts } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Data Fetch & Sync ───────────────────────────────────────────────────────

  const fetchAlerts = async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: Alert[] }>('/alerts?limit=50');
      setAlerts(data.data || []);
    } catch (err) {
      console.warn('Failed to fetch alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Socket sync
    if (accessToken) {
      const socket = getAlertsSocket(accessToken);
      socket.connect();
      
      socket.on('alert:new', (newAlert: Alert) => {
        setAlerts(prev => [newAlert, ...prev]);
      });

      socket.on('alert:acknowledged', ({ alertId }: { alertId: string }) => {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
      });

      return () => {
        socket.off('alert:new');
        socket.off('alert:acknowledged');
        socket.disconnect();
      };
    }
  }, [accessToken]);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      // Socket will update the UI
    } catch (err) {
      console.warn('Ack failed:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerLabelArea}>
          <BellSimpleRinging size={24} color={Colors.primary} weight="fill" />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Alerts</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {alerts.filter(a => !a.acknowledged).length} Active
        </Text>
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AlertCard 
              alert={item} 
              colors={colors} 
              canAck={canAcknowledgeAlerts} 
              onAck={() => handleAcknowledge(item.id)} 
            />
          )}
          ListEmptyComponent={<EmptyAlerts colors={colors} />}
        />
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AlertCard({ alert, colors, canAck, onAck }: { alert: Alert; colors: any; canAck: boolean; onAck: () => void }) {
  const isCritical = alert.severity === 'critical';
  const isWarning = alert.severity === 'warning';
  
  const accentColor = isCritical ? Colors.critical : isWarning ? Colors.warning : Colors.primary;
  const Icon = isCritical ? Warning : isWarning ? Info : BellSimpleRinging;

  return (
    <View style={[
      styles.card, 
      Shadows.card, 
      { backgroundColor: colors.surface, borderLeftColor: accentColor, borderLeftWidth: 4 },
      alert.acknowledged && { opacity: 0.6 }
    ]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: accentColor + '20' }]}>
          <Icon size={20} color={accentColor} weight="fill" />
        </View>
        <View style={styles.titleBox}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{alert.title}</Text>
          {alert.waterPointName && (
            <View style={styles.locationRow}>
              <MapPin size={12} color={colors.textSecondary} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>{alert.waterPointName}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>10m ago</Text>
      </View>

      <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{alert.description}</Text>

      {canAck && !alert.acknowledged && (
        <Pressable 
          style={[styles.ackBtn, { backgroundColor: colors.surfaceSecondary }]}
          onPress={onAck}
        >
          <Check size={16} color={Colors.success} weight="bold" />
          <Text style={[styles.ackText, { color: Colors.success }]}>Acknowledge</Text>
        </Pressable>
      )}

      {alert.acknowledged && (
        <View style={styles.ackedBadge}>
          <Check size={14} color={colors.textMuted} />
          <Text style={[styles.ackedText, { color: colors.textMuted }]}>Acknowledged</Text>
        </View>
      )}
    </View>
  );
}

function EmptyAlerts({ colors }: any) {
  return (
    <View style={styles.empty}>
      <Check size={48} color={Colors.success} weight="light" />
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All clear!</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>No active alerts at the moment.</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabelArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    backgroundColor: Colors.critical + '15',
    color: Colors.critical,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
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
    gap: Spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconBox: {
    padding: 8,
    borderRadius: Radii.md,
  },
  titleBox: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: Typography.xs,
  },
  time: {
    fontSize: 10,
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
  },
  ackText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    textTransform: 'uppercase',
  },
  ackedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ackedText: {
    fontSize: 10,
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
