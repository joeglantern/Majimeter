// app/index.tsx
// Entry point — decides where to send the user based on auth state.
// Shows an animated splash while the AuthProvider checks the stored token.

import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Drop } from 'phosphor-react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors, Typography } from '@/constants/Theme';

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Animations
  const dropScale = useRef(new Animated.Value(0)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation sequence
    Animated.sequence([
      Animated.parallel([
        Animated.spring(dropScale, {
          toValue: 1,
          tension: 50,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(dropOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Navigate once auth check resolves
  useEffect(() => {
    if (!isLoading) {
      const timeout = setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/(app)/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      }, 1600); // Let the animation breathe
      return () => clearTimeout(timeout);
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      {/* Drop icon with spring entrance */}
      <Animated.View
        style={[
          styles.iconWrapper,
          { opacity: dropOpacity, transform: [{ scale: dropScale }] },
        ]}
      >
        <Drop size={64} color={Colors.primary} weight="fill" />
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>
        MajiMeter
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Smart Water. Safer Communities.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
});
