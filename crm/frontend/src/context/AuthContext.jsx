import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize Auth State on Mount
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('crm_access_token');
      const savedRefresh = localStorage.getItem('crm_refresh_token');
      const savedUser = localStorage.getItem('crm_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        
        // Setup automatic token refresh
        setupRefreshTimer(savedRefresh);
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const setupRefreshTimer = (refreshToken) => {
    // Refresh access token every 45 minutes (access token expires in 1 hour)
    const interval = setInterval(async () => {
      const currentRefresh = localStorage.getItem('crm_refresh_token');
      if (!currentRefresh) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefresh })
        });

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('crm_access_token', data.accessToken);
          localStorage.setItem('crm_refresh_token', data.refreshToken);
          setToken(data.accessToken);
        } else {
          // Token expired or invalid, log out
          logout();
        }
      } catch (err) {
        console.error('[Auth Refresh Error]:', err.message);
      }
    }, 45 * 60 * 1000);

    return () => clearInterval(interval);
  };

  const login = async (loginIdentifier, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginIdentifier, password })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed.');
    }

    const data = await res.json();
    localStorage.setItem('crm_access_token', data.accessToken);
    localStorage.setItem('crm_refresh_token', data.refreshToken);
    localStorage.setItem('crm_user', JSON.stringify(data.user));

    setToken(data.accessToken);
    setUser(data.user);
    setupRefreshTimer(data.refreshToken);

    return data.user;
  };

  const signup = async (userData) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Signup failed.');
    }

    const data = await res.json();
    localStorage.setItem('crm_access_token', data.accessToken);
    localStorage.setItem('crm_refresh_token', data.refreshToken);
    localStorage.setItem('crm_user', JSON.stringify(data.user));

    setToken(data.accessToken);
    setUser(data.user);
    setupRefreshTimer(data.refreshToken);

    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('crm_access_token');
    localStorage.removeItem('crm_refresh_token');
    localStorage.removeItem('crm_user');
    setToken(null);
    setUser(null);
  };

  // Custom fetch client wrapping requests with Auth token headers
  const apiFetch = async (endpoint, options = {}) => {
    const currentToken = localStorage.getItem('crm_access_token') || token;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    // Handle session expiry auto refresh and retry
    if (res.status === 403 || res.status === 401) {
      const currentRefresh = localStorage.getItem('crm_refresh_token');
      if (currentRefresh) {
        try {
          const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentRefresh })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem('crm_access_token', refreshData.accessToken);
            localStorage.setItem('crm_refresh_token', refreshData.refreshToken);
            setToken(refreshData.accessToken);
            
            // Retry request with new token
            headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
            return await fetch(`${API_URL}${endpoint}`, {
              ...options,
              headers
            });
          } else {
            logout();
          }
        } catch (err) {
          logout();
        }
      } else {
        logout();
      }
    }

    return res;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};
