import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import Layout from '../components/Layout';
import '../styles/styles.css';

export default function UserManagement() {
  const { user, apiFetch } = useAuth();
  const { addToast } = useRealtime();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('broker');

  // Reset password state
  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          username,
          email,
          phone,
          password,
          role
        })
      });

      if (res.ok) {
        addToast('Success', 'User profile successfully created.');
        setShowCreateModal(false);
        setFullName('');
        setUsername('');
        setEmail('');
        setPhone('');
        setPassword('');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create user.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (userId, currentVal) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentVal })
      });
      if (res.ok) {
        addToast('Status Updated', 'User active status modified.');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to change user status.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoleChange = async (userId, nextRole) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole })
      });
      if (res.ok) {
        addToast('Role Updated', `User role changed to ${nextRole}`);
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update user role.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;

    try {
      const res = await apiFetch(`/api/users/${resettingUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) {
        addToast('Password Reset', `Password reset successfully for ${resettingUser.full_name}`);
        setResettingUser(null);
        setNewPassword('');
      } else {
        const err = await res.json();
        alert(err.error || 'Password override failed.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Layout>
      <div className="workspace-header">
        <div className="workspace-title">
          <h1>Team Directory</h1>
          <p>Create, manage, de-activate, or configure brokerage agent accounts.</p>
        </div>

        <div className="workspace-actions">
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ Create User
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Loading directory...</div>
      ) : (
        <div className="analytics-drawer">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Profile / Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>App Role</th>
                  <th>Access status</th>
                  <th>Security options</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="lead-tile-avatar" style={{ margin: 0 }}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 700 }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td>@{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      {user.role === 'super_admin' ? (
                        <select 
                          value={u.role} 
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{ padding: '6px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px', fontWeight: 600 }}
                        >
                          <option value="broker">Broker / Agent</option>
                          <option value="admin">Admin / Manager</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      ) : (
                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{u.role.replace('_', ' ')}</span>
                      )}
                    </td>
                    <td>
                      <button 
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                        className={`badge ${u.is_active ? 'badge-booked' : 'badge-lost'}`}
                        style={{ border: 'none', cursor: 'pointer', outline: 'none' }}
                        disabled={user.id === u.id} // Cannot disable yourself
                      >
                        {u.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      <button 
                        className="btn-secondary" 
                        onClick={() => setResettingUser(u)}
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      >
                        🔑 Reset Pass
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="drawer-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="auth-card" style={{ zIndex: 120, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Add Sales Member</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="auth-form">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Manish Rai" />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="manish99" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="manish@24k.com" />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div className="form-group">
                <label>App Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="broker">Broker / Agent</option>
                  <option value="admin">Admin / Manager</option>
                  {user.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>

              <button type="submit" className="btn-auth">Register User</button>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="drawer-backdrop" onClick={() => setResettingUser(null)}>
          <div className="auth-card" style={{ zIndex: 120, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Override Password</h3>
              <button 
                onClick={() => setResettingUser(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            
            <p style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Forces password override for user: <strong>{resettingUser.full_name}</strong> (@{resettingUser.username})
            </p>

            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="form-group">
                <label>New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  placeholder="Min 6 characters" 
                />
              </div>
              <button type="submit" className="btn-auth">Apply New Password</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
