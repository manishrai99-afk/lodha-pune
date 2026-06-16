import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>Checking session context...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Workspace Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/leads" 
              element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/users" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />

            {/* Redirection fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
