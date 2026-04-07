// app/(app)/_layout.tsx
// App group layout — protects all main screens from unauthenticated access.

import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
