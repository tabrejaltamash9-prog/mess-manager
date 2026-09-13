import React, { useEffect, useState, useRef } from 'react';
import Papa from 'papaparse';
import { api } from '../lib/api';

interface Student {
  id: string;
  name: string;
  roll_no: string;
  email: string;
  department: string | null;
  hostel_block: string | null;
  photo_url: string | null;
  is_active: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', roll_no: '', email: '', department: '', hostel_block: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [uploadStudentId, setUploadStudentId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getStudents(page, limit, search);
      setStudents(data.students);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, search]);

  function showAlert(type: 'success' | 'error', msg: string) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    try {
      await api.createStudent(form);
      showAlert('success', 'Student added successfully.');
      setShowModal(false);
      setForm({ name: '', roll_no: '', email: '', department: '', hostel_block: '' });
      load();
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleActive(s: Student) {
    try {
      await api.updateStudent(s.id, { is_active: !s.is_active });
      showAlert('success', `Student ${!s.is_active ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const rows = result.data as any[];
          const res = await api.bulkImport(rows);
          showAlert('success', `Imported ${res.imported} students.`);
          load();
        } catch (err: any) {
          showAlert('error', err.message);
        } finally {
          setImportLoading(false);
          if (csvRef.current) csvRef.current.value = '';
        }
      },
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadStudentId) return;
    try {
      await api.uploadPhoto(uploadStudentId, file);
      showAlert('success', 'Photo uploaded successfully.');
      load();
    } catch (err: any) {
      showAlert('error', err.message);
    } finally {
      setUploadStudentId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Students</h2>
          <p>{total} registered students</p>
        </div>
        <div className="flex gap-2">
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            {importLoading ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'var(--gray-700)' }} /> : '📥 Import CSV'}
            <input ref={csvRef} type="file" accept=".csv" hidden onChange={handleCsvImport} />
          </label>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Student
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? '✅' : '⚠️'} {alert.msg}
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search name, roll no, email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* CSV Format hint */}
      <div style={{ marginBottom: 12 }}>
        <p className="text-muted">
          📄 CSV format: <code>name, roll_no, email, department, hostel_block</code> (header row required)
        </p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Roll No</th>
                <th>Email</th>
                <th>Department</th>
                <th>Block</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center" style={{ padding: 32, color: 'var(--gray-400)' }}>Loading...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={8} className="text-center" style={{ padding: 32, color: 'var(--gray-400)' }}>No students found.</td></tr>
              ) : students.map(s => (
                <tr key={s.id}>
                  <td>
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gray-100)' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                        {s.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td><strong>{s.name}</strong></td>
                  <td><code style={{ fontSize: 12 }}>{s.roll_no}</code></td>
                  <td style={{ fontSize: 12 }}>{s.email}</td>
                  <td>{s.department ?? '—'}</td>
                  <td>{s.hostel_block ?? '—'}</td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-error'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                        📷 Photo
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          ref={uploadStudentId === s.id ? fileRef : undefined}
                          onChange={handlePhotoUpload}
                          onClick={() => setUploadStudentId(s.id)}
                        />
                      </label>
                      <button
                        className={`btn btn-sm ${s.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleActive(s)}
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span>Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}</span>
          <div className="pagination-btns">
            <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, page - 2) + i;
              if (p > totalPages) return null;
              return (
                <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              );
            })}
            <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Student</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              {(['name', 'roll_no', 'email', 'department', 'hostel_block'] as const).map(field => (
                <div className="form-group" key={field}>
                  <label className="form-label">{field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}{['name','roll_no','email'].includes(field) ? ' *' : ''}</label>
                  <input
                    className="form-input"
                    type={field === 'email' ? 'email' : 'text'}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    required={['name','roll_no','email'].includes(field)}
                  />
                </div>
              ))}
              <button className="btn btn-primary w-full btn-lg" type="submit" disabled={formLoading}>
                {formLoading ? <span className="spinner" /> : 'Add Student'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
    </div>
  );
}
