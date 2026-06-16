import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import '../styles/styles.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { notifications, toasts, removeToast, markNotificationAsRead, markAllNotificationsAsRead } = useRealtime();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('crm_theme') || 'dark');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('crm_theme', nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  // Set initial theme on body
  React.useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-mark">24K</span>
          <div className="sidebar-logo-text">
            <strong>24K Realtors</strong>
            <small>Enterprise CRM</small>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="sidebar-user">
            <span className="sidebar-user-label">Authorized Profile</span>
            <span className="sidebar-user-name">{user.full_name}</span>
            <span className="sidebar-user-role">
              {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Manager (Admin)' : 'Consultant (Broker)'}
            </span>
          </div>
        )}

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/leads" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
            👥 Lead Acquisition
          </NavLink>
          {user && (user.role === 'admin' || user.role === 'super_admin') && (
            <NavLink to="/users" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
              ⚙️ Team Directory
            </NavLink>
          )}
          <NavLink to="/profile" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
            👤 My Profile
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
            🔧 Settings
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p>© 24K Realtors 2026</p>
          <button className="btn-signout" onClick={handleSignOut}>
            Sign Out / Lock
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Top Header Controls */}
        <header style={{ 
          height: '70px', 
          borderBottom: '1px solid var(--border)', 
          background: 'var(--card)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          padding: '0 40px',
          gap: '20px',
          position: 'relative'
        }}>
          {/* Theme Switcher */}
          <button className="btn-theme-toggle" onClick={toggleTheme} title="Switch Light/Dark Mode">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Notifications Center Widget */}
          <div style={{ position: 'relative' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ position: 'relative', padding: '10px 14px' }}
            >
              🔔 Alerts 
              {unreadCount > 0 && (
                <span style={{ 
                  background: 'var(--red)', 
                  color: '#fff', 
                  borderRadius: '50%', 
                  padding: '2px 6px', 
                  fontSize: '0.7rem', 
                  fontWeight: 'bold',
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: '0',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                width: '320px',
                boxShadow: 'var(--shadow)',
                zIndex: '150',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.88rem' }}>Recent Notifications</strong>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllNotificationsAsRead}
                      style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => markNotificationAsRead(n.id)}
                        style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid var(--border)', 
                          cursor: 'pointer',
                          background: n.is_read ? 'transparent' : 'var(--gold-glow)',
                          fontSize: '0.82rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, color: n.is_read ? 'var(--text)' : 'var(--gold)' }}>{n.title}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="workspace">
          {children}
        </main>
      </div>

      {/* Realtime Toasts Drawer overlay */}
      <div className="toast-panel">
        {toasts.map(t => (
          <div key={t.id} className="toast-item">
            <div className="toast-message">
              <h4>🔔 {t.title}</h4>
              <p>{t.message}</p>
            </div>
            <button className="btn-close-toast" onClick={() => removeToast(t.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
