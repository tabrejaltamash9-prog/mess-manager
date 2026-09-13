const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('mess_admin_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
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
