import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const MEAL_COLORS: Record<string, string> = {
  breakfast: '#f59e0b',
  lunch: '#3b82f6',
  dinner: '#8b5cf6',
};

export default function ReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState<string>('');
  const [hostel, setHostel] = useState<any[]>([]);
  const [noShows, setNoShows] = useState<any[]>([]);
  const [noShowCount, setNoShowCount] = useState(0);
  const [hostelLoading, setHostelLoading] = useState(false);

  async function loadReport(d: string) {
    setLoading(true);
    try {
      const data = await api.getDailyReport(d);
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport(date); }, [date]);

  async function loadHostelReport(windowId: string) {
    setHostelLoading(true);
    setSelectedWindow(windowId);
    try {
      const [h, n] = await Promise.all([
        api.getHostelReport(windowId),
        api.getNoShows(windowId),
      ]);
      setHostel(h.breakdown);
      setNoShows(n.no_shows);
      setNoShowCount(n.count);
    } finally {
      setHostelLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Attendance Reports</h2>
          <p>Daily meal attendance analytics</p>
        </div>
        <input
          type="date"
          className="form-input"
          style={{ width: 'auto' }}
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {/* Stat cards */}
      {report && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-icon">👥</span>
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{report.total_students}</div>
          </div>
          {report.meals.map((m: any) => (
            <div className="stat-card" key={m.meal_type} style={{ borderTop: `3px solid ${MEAL_COLORS[m.meal_type]}` }}>
              <span className="stat-icon">
                {m.meal_type === 'breakfast' ? '🌅' : m.meal_type === 'lunch' ? '☀️' : '🌙'}
              </span>
              <div className="stat-label">{m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1)}</div>
              <div className="stat-value">{m.scanned}</div>
              <div className="stat-sub">{m.percentage}% attendance</div>
              <div style={{ marginTop: 8 }}>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${m.percentage}%`, background: MEAL_COLORS[m.meal_type] }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      {report?.meals?.length > 0 && (
        <div className="card card-padded mb-4" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Meal-wise Attendance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report.meals} barCategoryGap="35%">
              <XAxis dataKey="meal_type" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [`${v} students`, 'Scanned']} />
              <Bar dataKey="scanned" radius={[6, 6, 0, 0]}>
                {report.meals.map((m: any) => (
                  <Cell key={m.meal_type} fill={MEAL_COLORS[m.meal_type]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hostel Breakdown */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <div className="flex justify-between items-center mb-4" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Hostel Block Breakdown</h3>
          <select
            className="form-input"
            style={{ width: 'auto' }}
            value={selectedWindow}
            onChange={e => e.target.value && loadHostelReport(e.target.value)}
          >
            <option value="">— Select meal window —</option>
            {report?.meals?.map((m: any, i: number) => (
              <option key={i} value={m.window_id ?? `${date}-${m.meal_type}`}>
                {m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1)} ({date})
              </option>
            ))}
          </select>
        </div>

        {hostelLoading ? (
          <p className="text-muted text-center" style={{ padding: 20 }}>Loading...</p>
        ) : hostel.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hostel Block</th>
                  <th>Scanned</th>
                  <th>Total</th>
                  <th>Attendance</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {hostel.map((row: any) => (
                  <tr key={row.hostel_block}>
                    <td><strong>{row.hostel_block}</strong></td>
                    <td>{row.scanned}</td>
                    <td>{row.total}</td>
                    <td>
                      <span className={`badge ${row.percentage >= 80 ? 'badge-success' : row.percentage >= 50 ? 'badge-warning' : 'badge-error'}`}>
                        {row.percentage}%
                      </span>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${row.percentage}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">Select a meal window to view hostel breakdown.</p>
        )}
      </div>

      {/* No-shows */}
      {noShows.length > 0 && (
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            No-shows — {noShowCount} students
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Email</th>
                  <th>Block</th>
                </tr>
              </thead>
              <tbody>
                {noShows.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.roll_no}</td>
                    <td>{s.email}</td>
                    <td>{s.hostel_block ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No data for this date.</p>
        </div>
      )}
    </div>
  );
}
