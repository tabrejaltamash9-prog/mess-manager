import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const MEAL_COLORS: Record<string, string> = { breakfast: '#f59e0b', lunch: '#3b82f6', dinner: '#8b5cf6' };

export default function MealWindowsPage() {
  const [windows, setWindows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [templateEdits, setTemplateEdits] = useState<Record<string, any>>({});
  const [templateSaving, setTemplateSaving] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ meal_type: 'breakfast', date: new Date().toISOString().slice(0, 10), start_time: '07:30', end_time: '10:00' });
  const [createLoading, setCreateLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showAlert(type: 'success' | 'error', msg: string) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const [tmpl, win] = await Promise.all([
        api.getTemplates(),
        api.getMealWindows(page),
      ]);
      setWindows(win.windows);
      setTotal(win.total ?? 0);
      // Init template edits
      const edits: Record<string, any> = {};
      tmpl.forEach((t: any) => {
        edits[t.meal_type] = { start_time: t.start_time, end_time: t.end_time, is_enabled: t.is_enabled };
      });
      setTemplateEdits(edits);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function saveTemplate(mealType: string) {
    setTemplateSaving(mealType);
    try {
      await api.updateTemplate(mealType, templateEdits[mealType]);
      showAlert('success', `${mealType} template updated. New windows will use these timings.`);
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setTemplateSaving(null);
    }
  }

  async function handleCloseWindow(id: string) {
    try {
      await api.updateWindow(id, { status: 'closed' });
      showAlert('success', 'Window closed early.');
      load();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  }

  async function handleDeleteWindow(id: string) {
    if (!window.confirm('Are you sure you want to delete this meal window?')) return;
    try {
      await api.deleteWindow(id);
      showAlert('success', 'Window deleted.');
      load();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await api.createWindow(createForm);
      showAlert('success', 'Meal window created.');
      setShowCreateModal(false);
      load();
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Meal Windows</h2>
          <p>Configure meal timings and manage windows</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Window
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? '✅' : '⚠️'} {alert.msg}
        </div>
      )}

      {/* Default Meal Templates */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Default Meal Timings</h3>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          The cron job uses these timings to auto-create tomorrow's windows. Changes apply from the next day.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {MEAL_TYPES.map(mealType => {
            const edit = templateEdits[mealType] ?? {};
            return (
              <div key={mealType} style={{ border: `2px solid ${MEAL_COLORS[mealType]}20`, borderRadius: 12, padding: 16, background: `${MEAL_COLORS[mealType]}08` }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 12, gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{MEAL_ICONS[mealType]}</span>
                  <strong style={{ textTransform: 'capitalize' }}>{mealType}</strong>
                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={edit.is_enabled ?? true}
                      onChange={e => setTemplateEdits(prev => ({ ...prev, [mealType]: { ...edit, is_enabled: e.target.checked } }))}
                    />
                    Enabled
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label className="form-label">Start</label>
                    <input type="time" className="form-input" value={edit.start_time?.slice(0, 5) ?? ''} onChange={e => setTemplateEdits(prev => ({ ...prev, [mealType]: { ...edit, start_time: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="form-label">End</label>
                    <input type="time" className="form-input" value={edit.end_time?.slice(0, 5) ?? ''} onChange={e => setTemplateEdits(prev => ({ ...prev, [mealType]: { ...edit, end_time: e.target.value } }))} />
                  </div>
                </div>
                <button
                  className="btn btn-primary w-full btn-sm"
                  onClick={() => saveTemplate(mealType)}
                  disabled={templateSaving === mealType}
                >
                  {templateSaving === mealType ? <span className="spinner" /> : 'Save Timings'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Windows Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Meal</th>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center" style={{ padding: 32, color: 'var(--gray-400)' }}>Loading...</td></tr>
              ) : windows.map((w: any) => (
                <tr key={w.id}>
                  <td>
                    <span style={{ marginRight: 6 }}>{MEAL_ICONS[w.meal_type]}</span>
                    <span style={{ textTransform: 'capitalize' }}>{w.meal_type}</span>
                  </td>
                  <td>{fmtDate(w.date)}</td>
                  <td>{fmtTime(w.start_time)}</td>
                  <td>{fmtTime(w.end_time)}</td>
                  <td>
                    <span className={`badge ${w.status === 'open' ? 'badge-success' : w.status === 'upcoming' ? 'badge-warning' : 'badge-gray'}`}>
                      {w.status === 'open' ? '● Open' : w.status === 'upcoming' ? '● Upcoming' : '✓ Closed'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {w.status === 'open' && (
                        <button className="btn btn-warning btn-sm" onClick={() => handleCloseWindow(w.id)}>
                          Close Early
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteWindow(w.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>Page {page} of {Math.max(1, totalPages)}</span>
          <div className="pagination-btns">
            <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>‹</button>
            <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
          </div>
        </div>
      </div>

      {/* Create Window Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Create Meal Window</span>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Meal Type</label>
                <select className="form-input" value={createForm.meal_type} onChange={e => setCreateForm(f => ({ ...f, meal_type: e.target.value }))}>
                  {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={createForm.date} onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input type="time" className="form-input" value={createForm.start_time} onChange={e => setCreateForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input type="time" className="form-input" value={createForm.end_time} onChange={e => setCreateForm(f => ({ ...f, end_time: e.target.value }))} required />
                </div>
              </div>
              <button className="btn btn-primary w-full btn-lg" type="submit" disabled={createLoading}>
                {createLoading ? <span className="spinner" /> : 'Create Window'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
