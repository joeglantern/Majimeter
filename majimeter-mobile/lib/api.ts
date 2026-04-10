// lib/api.ts
// Axios instance pre-configured for the MajiMeter backend.
// Handles base URL, default headers, and automatic token refresh on 401.

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Config ────────────────────────────────────────────────────────────────────
// In development, use your machine's LAN IP so the Expo app on a physical
// device can reach the backend (localhost won't work from a phone).
// Change this to your production URL when deploying.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    // We let Axios handle Content-Type dynamically based on request data.
    // For objects, it defaults to application/json. 
    // For FormData, it correctly sets multipart/form-data with boundaries.
  },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Automatically attaches the access token to every request.
api.interceptors.request.use(
  async config => {
    const token = await SecureStore.getItemAsync('maji_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────────────────────
// On a 401, try exchanging the refresh token for a new access token.
// If that also fails, clear everything (session expired → user must re-login).
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue subsequent 401s while a refresh is in flight
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('maji_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newAccessToken: string = data.data.accessToken;

        await SecureStore.setItemAsync('maji_access_token', newAccessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Clear tokens — AuthContext's restoreSession will pick this up on next launch
        await SecureStore.deleteItemAsync('maji_access_token');
        await SecureStore.deleteItemAsync('maji_refresh_token');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
