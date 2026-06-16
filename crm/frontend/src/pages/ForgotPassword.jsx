import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/styles.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        if (data.resetToken) {
          // Display the simulated token in the full stack demo so the user can easily copy/click to reset!
          setResetToken(data.resetToken);
        }
      } else {
        setError(data.error || 'Request failed.');
      }
    } catch (err) {
      setError('Connection to backend server failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-logo">24K</span>
        <h2>Forgot Password</h2>
        <p>Enter your email address to receive a reset token.</p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="manish@24k.com"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Processing...' : 'Send Reset Link'}
          </button>
        </form>

        {resetToken && (
          <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'left' }}>
            <h4 style={{ color: 'var(--gold)', marginBottom: '8px', fontSize: '0.85rem', textTransform: 'uppercase' }}>🔧 Developer Mode: Reset Link Generated</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Copy the token below and use it on the Reset Password page.</p>
            <textarea
              readOnly
              value={resetToken}
              style={{ width: '100%', height: '80px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', padding: '8px', fontSize: '0.75rem', outline: 'none', resize: 'none' }}
              onClick={(e) => e.target.select()}
            />
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <Link to={`/reset-password?token=${encodeURIComponent(resetToken)}`} className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 12px', textDecoration: 'none' }}>
                Go to Reset Page
              </Link>
            </div>
          </div>
        )}

        <div className="auth-footer">
          Remember your password?
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
