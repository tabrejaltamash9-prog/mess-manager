import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

export const SERVER_URL_STORAGE_KEY = 'mess_app_server_url';
export const DEFAULT_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.251.131.177:3000';

let cachedServerUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  try {
    const saved = await AsyncStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      cachedServerUrl = saved.trim().replace(/\/+$/, '');
      return cachedServerUrl;
    }
  } catch {}
  return DEFAULT_SERVER_URL.replace(/\/+$/, '');
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  cachedServerUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
}

export async function resetServerUrl(): Promise<string> {
  const url = DEFAULT_SERVER_URL.replace(/\/+$/, '');
  cachedServerUrl = url;
  await AsyncStorage.removeItem(SERVER_URL_STORAGE_KEY);
  return url;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore.getState();
  const baseUrl = await getServerUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(
        `Connection timed out reaching:\n${baseUrl}\n\nPlease check your Server URL or internet connection.`
      );
    }
    throw new Error(
      `Cannot reach backend server at:\n${baseUrl}\n\nPlease check your Server URL or internet connection.`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // If access token expired, try to refresh once
  if (response.status === 401 && refreshToken && requiresAuth) {
    try {
      const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const { accessToken: newAccess, refreshToken: newRefresh } = await refreshResponse.json();
        setTokens(newAccess, newRefresh);
        headers['Authorization'] = `Bearer ${newAccess}`;
        response = await fetch(`${baseUrl}${path}`, { ...options, headers });
      } else {
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    } catch {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed: ${response.status}`);
  }

  return data as T;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  requestOtp: (email: string) =>
    request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false),

  verifyOtp: (email: string, otp: string) =>
    request<{
      accessToken: string;
      refreshToken: string;
      user: any;
      role: string;
    }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }, false),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // ── Meal / QR ─────────────────────────────────────────────────────────────
  getCurrentMeal: () =>
    request<{
      window: any;
      qr: string | null;
      already_scanned: boolean;
      scanned_at: string | null;
    }>('/api/meal/current', { method: 'GET' }),

  // ── Scan ──────────────────────────────────────────────────────────────────
  verifyScan: (qr: string) =>
    request<{
      success: boolean;
      reason?: string;
      student?: {
        name: string;
        roll_no: string;
        email: string;
        department: string | null;
        hostel_block: string | null;
        photo_url: string | null;
      };
      scanned_at?: string;
      already_scanned_at?: string;
    }>('/api/scan/verify', {
      method: 'POST',
      body: JSON.stringify({ qr }),
    }),

  getScanCounter: (mealWindowId: string) =>
    request<{ scanned: number; total: number }>(
      `/api/scan/counter/${mealWindowId}`,
      { method: 'GET' }
    ),

  // ── History ───────────────────────────────────────────────────────────────
  getHistory: () =>
    request<any[]>('/api/students/me/history', { method: 'GET' }),
};
