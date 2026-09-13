const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('mess_admin_token');
}

function getRefreshToken() {
  return localStorage.getItem('mess_admin_refresh_token');
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (netErr: any) {
    throw new Error(`Failed to connect to backend server (${BASE_URL}). Please verify it is running.`);
  }

  // If unauthorized and we haven't retried yet, attempt silent refresh
  if (res.status === 401 && !isRetry && !path.startsWith('/api/auth/')) {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      if (isRefreshing) {
        return new Promise<T>((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(request<T>(path, options, true));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('mess_admin_token', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('mess_admin_refresh_token', data.refreshToken);
          }
          isRefreshing = false;
          onRefreshed(data.accessToken);
          return request<T>(path, options, true);
        } else {
          // Refresh token expired or revoked
          isRefreshing = false;
          localStorage.removeItem('mess_admin_token');
          localStorage.removeItem('mess_admin_refresh_token');
          localStorage.removeItem('mess_admin_user');
          localStorage.removeItem('mess_admin_role');
          window.location.href = '/login';
          throw new Error('Your session has expired. Please sign in again.');
        }
      } catch (err: any) {
        isRefreshing = false;
        throw err;
      }
    } else {
      // No refresh token available, redirect to login
      localStorage.removeItem('mess_admin_token');
      localStorage.removeItem('mess_admin_user');
      localStorage.removeItem('mess_admin_role');
      window.location.href = '/login';
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  // Auth
  requestOtp: (email: string) =>
    request('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email: string, otp: string) =>
    request<{ accessToken: string; refreshToken: string; user: any; role: string }>(
      '/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),

  // Students
  getStudents: (page = 1, limit = 50, search = '') =>
    request<{ students: any[]; total: number }>(`/api/students?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
  createStudent: (data: any) =>
    request('/api/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id: string, data: any) =>
    request(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  bulkImport: (rows: any[]) =>
    request<{ imported: number }>('/api/students/bulk', { method: 'POST', body: JSON.stringify(rows) }),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const token = getToken();
    return fetch(`${BASE_URL}/api/students/${id}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json());
  },

  // Meal Windows
  getMealWindows: (page = 1) =>
    request<{ windows: any[]; total: number }>(`/api/meal/windows?page=${page}&limit=20`),
  createWindow: (data: any) =>
    request('/api/meal/windows', { method: 'POST', body: JSON.stringify(data) }),
  updateWindow: (id: string, data: any) =>
    request(`/api/meal/windows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWindow: (id: string) =>
    request(`/api/meal/windows/${id}`, { method: 'DELETE' }),
  getTemplates: () => request<any[]>('/api/meal/templates'),
  updateTemplate: (mealType: string, data: any) =>
    request(`/api/meal/templates/${mealType}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Reports
  getDailyReport: (date?: string) =>
    request<{ date: string; meals: any[]; total_students: number }>(
      `/api/reports/daily${date ? `?date=${date}` : ''}`),
  getHostelReport: (mealWindowId: string) =>
    request<{ breakdown: any[] }>(`/api/reports/hostel?meal_window_id=${mealWindowId}`),
  getNoShows: (mealWindowId: string) =>
    request<{ no_shows: any[]; count: number }>(`/api/reports/no-shows?meal_window_id=${mealWindowId}`),

  // Scan overrides
  manualOverride: (student_id: string, meal_window_id: string, note: string) =>
    request('/api/scan/manual-override', { method: 'POST', body: JSON.stringify({ student_id, meal_window_id, note }) }),
};
