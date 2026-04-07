// AuthContext.tsx
// The global brain of the app.
// Manages auth state, tokens, user profile, and exposes the user's role
// so every component can adapt its UI intelligently.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'technician' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  locationLat?: number;
  locationLng?: number;
  fcmToken?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Role helpers — use these in components instead of checking user.role directly
  isUser: boolean;
  isTechnician: boolean;
  isAdmin: boolean;
  canAcknowledgeAlerts: boolean;
  canManageWaterPoints: boolean;
  canManageUsers: boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'maji_access_token';
const REFRESH_TOKEN_KEY = 'maji_refresh_token';

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session on app launch
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (!token) {
        setState(s => ({ ...s, isLoading: false }));
        return;
      }

      // Set token on api client so the /me call is authenticated
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get<{ success: boolean; data: User }>('/users/me');

      setState({
        user: response.data.data,
        accessToken: token,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      // Token expired or invalid — clear and start fresh
      await clearTokens();
      setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{
      success: boolean;
      data: { user: User; accessToken: string; refreshToken: string };
    }>('/auth/login', { email, password });

    const { user, accessToken, refreshToken } = response.data.data;

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

    setState({ user, accessToken, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const response = await api.post<{
      success: boolean;
      data: { user: User; accessToken: string; refreshToken: string };
    }>('/auth/register', { name, email, password, phone });

    const { user, accessToken, refreshToken } = response.data.data;

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

    setState({ user, accessToken, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Fire and forget — always clear locally
    } finally {
      await clearTokens();
      delete api.defaults.headers.common['Authorization'];
      setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get<{ success: boolean; data: User }>('/users/me');
    setState(s => ({ ...s, user: response.data.data }));
  }, []);

  const clearTokens = async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  };

  // ── Role helpers ─────────────────────────────────────────────────────────────
  const role = state.user?.role;
  const isUser = role === 'user';
  const isTechnician = role === 'technician';
  const isAdmin = role === 'admin';
  const canAcknowledgeAlerts = isTechnician || isAdmin;
  const canManageWaterPoints = isTechnician || isAdmin;
  const canManageUsers = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshUser,
        isUser,
        isTechnician,
        isAdmin,
        canAcknowledgeAlerts,
        canManageWaterPoints,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
