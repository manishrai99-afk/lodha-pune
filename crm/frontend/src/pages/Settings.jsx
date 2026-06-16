import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import Layout from '../components/Layout';
import '../styles/styles.css';

export default function Settings() {
  const { user, apiFetch } = useAuth();
  const { addToast } = useRealtime();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (password !== confirm) return alert('Passwords do not match.');
    if (password.length < 6) return alert('Password must be at least 6 characters.');

    setLoading(true);

    try {
      const res = await apiFetch(`/api/users/${user.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        setPassword('');
        setConfirm('');
        addToast('Success', 'Security password updated successfully.');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update password.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="workspace-header">
        <div className="workspace-title">
          <h1>Security Settings</h1>
          <p>Configure password and workspace preferences.</p>
        </div>
      </div>

      <div className="analytics-drawer" style={{ maxWidth: '600px' }}>
        <h3>🔑 Update Workspace Password</h3>
        <form onSubmit={handlePasswordChange} className="auth-form" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label>New Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Min 6 characters" 
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input 
              type="password" 
              value={confirm} 
              onChange={(e) => setConfirm(e.target.value)} 
              required 
              placeholder="••••••••" 
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: 'fit-content', padding: '12px 24px' }}>
            {loading ? 'Updating Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
