import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import Layout from '../components/Layout';
import '../styles/styles.css';

export default function Profile() {
  const { user, apiFetch } = useAuth();
  const { addToast } = useRealtime();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          phone
        })
      });

      if (res.ok) {
        const updated = await res.json();
        // Update user state in localStorage
        const savedUser = JSON.parse(localStorage.getItem('crm_user'));
        const newUserData = { ...savedUser, full_name: updated.full_name, phone: updated.phone };
        localStorage.setItem('crm_user', JSON.stringify(newUserData));
        
        addToast('Success', 'Profile details updated.');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update profile.');
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
          <h1>My Profile</h1>
          <p>View or edit your personal profile details.</p>
        </div>
      </div>

      <div className="analytics-drawer" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username (Read-Only)</label>
            <input type="text" value={`@${user?.username}`} disabled style={{ background: 'rgba(255,255,255,0.01)', color: 'var(--text-muted)' }} />
          </div>

          <div className="form-group">
            <label>Email Address (Read-Only)</label>
            <input type="text" value={user?.email} disabled style={{ background: 'rgba(255,255,255,0.01)', color: 'var(--text-muted)' }} />
          </div>

          <div className="form-group">
            <label>Workspace Role</label>
            <input 
              type="text" 
              value={user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Manager (Admin)' : 'Consultant (Broker)'} 
              disabled 
              style={{ background: 'rgba(255,255,255,0.01)', color: 'var(--text-muted)', textTransform: 'capitalize' }} 
            />
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required 
              disabled={loading} 
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              disabled={loading} 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: 'fit-content', padding: '12px 24px' }}>
            {loading ? 'Saving Details...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
