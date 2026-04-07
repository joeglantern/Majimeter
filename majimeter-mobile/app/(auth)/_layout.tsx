// app/(auth)/_layout.tsx
// Auth group layout.
// Redirects to the main app if the user is already authenticated.

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/(app)/(tabs)');
    }
  }, [isAuthenticated, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
