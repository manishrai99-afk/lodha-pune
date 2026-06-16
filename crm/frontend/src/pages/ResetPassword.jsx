import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import '../styles/styles.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Password has been reset successfully. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(data.error || 'Reset failed.');
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
        <h2>Reset Password</h2>
        <p>Set your new password below.</p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="token">Reset Token</label>
            <input
              type="text"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              placeholder="Paste JWT reset token"
              disabled={loading || !!searchParams.get('token')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div className="auth-footer">
          Back to
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
