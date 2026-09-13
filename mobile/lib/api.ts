import { useAuthStore } from '../store/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // If access token expired, try to refresh once
  if (response.status === 401 && refreshToken && requiresAuth) {
    const refreshResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccess, refreshToken: newRefresh } = await refreshResponse.json();
      setTokens(newAccess, newRefresh);
      headers['Authorization'] = `Bearer ${newAccess}`;
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    } else {
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
