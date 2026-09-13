import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.requestOtp(email.trim().toLowerCase());
      setSuccess('OTP sent to your email.');
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await api.verifyOtp(email.trim().toLowerCase(), otp.trim());
      if (result.role !== 'admin' && result.role !== 'mess_staff') {
        setError('This portal is for admin and mess staff only.');
        return;
      }
      login(result.accessToken, result.user, result.role);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🍽️</div>
          <h1>Mess QR Admin</h1>
          <p>College Meal Attendance System</p>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {step === 'email' ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label className="form-label">Admin / Staff Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@college.edu"
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Login Code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">One-Time Password</label>
              <input
                className="form-input"
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
                style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
              />
            </div>
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading || otp.length !== 6}>
              {loading ? <span className="spinner" /> : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full mt-4"
              onClick={() => { setStep('email'); setSuccess(''); setError(''); setOtp(''); }}
            >
              ← Change Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
