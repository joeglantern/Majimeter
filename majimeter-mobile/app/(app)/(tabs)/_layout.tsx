// app/(app)/(tabs)/_layout.tsx
// Custom floating tab bar — the spine of the main app navigation.
// Role-Intelligent: shows different tabs depending on user.role.

import { Tabs, useRouter } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House,
  MapPin,
  FileText,
  Warning,
  ChartLine,
  User,
} from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Shadows, Radii, Typography, Spacing } from '@/constants/Theme';

// ── Tab config type ────────────────────────────────────────────────────────────

interface TabItem {
  name: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; weight: 'fill' | 'regular' }>;
}

const BASE_TABS: TabItem[] = [
  { name: 'index', label: 'Home', Icon: House },
  { name: 'map', label: 'Map', Icon: MapPin },
  { name: 'reports', label: 'Reports', Icon: FileText },
];

const ALERT_TAB: TabItem = { name: 'alerts', label: 'Alerts', Icon: Warning };
const ANALYTICS_TAB: TabItem = { name: 'analytics', label: 'Insights', Icon: ChartLine };
const PROFILE_TAB: TabItem = { name: 'profile', label: 'Me', Icon: User };

export default function TabsLayout() {
  const { isAdmin, isTechnician } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Role-intelligent tab assembly ─────────────────────────────────────────────
  const tabs: TabItem[] = [...BASE_TABS];
  if (isTechnician || isAdmin) tabs.push(ALERT_TAB);
  if (isAdmin) tabs.push(ANALYTICS_TAB);
  tabs.push(PROFILE_TAB);

  return (
    <Tabs
      tabBar={props => (
        <FloatingTabBar {...props} tabs={tabs} colors={colors} insets={insets} />
      )}
      screenOptions={{ headerShown: false }}
    >
      {/* Declare all possible screens — visibility is controlled by `tabs` array */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

// ── Floating Tab Bar ───────────────────────────────────────────────────────────

function FloatingTabBar({
  state,
  navigation,
  tabs,
  colors,
  insets,
}: {
  state: any;
  navigation: any;
  tabs: TabItem[];
  colors: ReturnType<typeof useTheme>['colors'];
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  return (
    <View
      style={[
        styles.tabBarOuter,
        { paddingBottom: insets.bottom || Spacing.md },
      ]}
    >
      <View
        style={[
          styles.tabBar,
          Shadows.modal,
          { backgroundColor: colors.surface },
        ]}
      >
        {tabs.map((tab, index) => {
          const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[routeIndex]?.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented && routeIndex !== -1) {
              navigation.navigate(state.routes[routeIndex].name);
            }
          };

          return (
            <Pressable
              key={tab.name}
              style={styles.tabItem}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <View style={[styles.tabIconWrapper, isFocused && styles.tabIconActive]}>
                <tab.Icon
                  size={22}
                  color={isFocused ? Colors.primary : colors.textMuted}
                  weight={isFocused ? 'fill' : 'regular'}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? Colors.primary : colors.textMuted },
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    // transparent — background shows through
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: Radii.card,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  tabIconWrapper: {
    width: 40,
    height: 32,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  tabLabelActive: {
    fontWeight: Typography.semibold,
  },
});
