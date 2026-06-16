import React, { createContext, useState, useEffect, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

export const useRealtime = () => useContext(RealtimeContext);

export const RealtimeProvider = ({ children }) => {
  const { user, token, apiFetch } = useAuth();
  const [supabase, setSupabase] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [leadsTrigger, setLeadsTrigger] = useState(0); // Dummy state to trigger lead reloads

  // Fetch Public Config and Initialize Supabase
  useEffect(() => {
    if (!user || !token) {
      setSupabase(null);
      setNotifications([]);
      return;
    }

    const initSupabaseRealtime = async () => {
      try {
        const res = await apiFetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          if (config.supabaseUrl && config.supabaseAnonKey) {
            // Initialize Supabase with custom JWT token signed by Express backend
            const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
              global: {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              },
              realtime: {
                params: {
                  eventsPerSecond: 10
                }
              }
            });
            
            // Set custom session token so RLS matches sub and user_metadata
            await client.auth.setSession({
              access_token: token,
              refresh_token: token // Custom payload fallback
            });

            setSupabase(client);
            console.log('[Realtime] Supabase Client Initialized with custom JWT Auth.');
          } else {
            console.warn('[Realtime] Supabase configuration missing. Falling back to HTTP polling.');
          }
        }
      } catch (err) {
        console.error('[Realtime Init Exception]:', err.message);
      }
    };

    initSupabaseRealtime();
    loadNotifications();
  }, [user, token]);

  // Handle postgres changes subscriptions
  useEffect(() => {
    if (!supabase || !user) return;

    console.log('[Realtime] Subscribing to database updates...');

    // Subscribe to Leads changes
    const leadsChannel = supabase
      .channel('leads-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        console.log('[Realtime] Leads postgres change received:', payload);
        
        // Trigger a dashboard lead reload
        setLeadsTrigger(prev => prev + 1);

        const newLead = payload.new;
        const oldLead = payload.old;

        // Scoped Broker notifications
        if (user.role === 'broker') {
          const isAssignedToMe = newLead.assigned_to === user.id;
          const wasAssignedToMe = oldLead?.assigned_to === user.id;

          if (payload.eventType === 'INSERT' && isAssignedToMe) {
            addToast('New Lead Assigned', `Lead ${newLead.lead_name} has been assigned to you.`);
          } else if (payload.eventType === 'UPDATE') {
            if (isAssignedToMe && !wasAssignedToMe) {
              addToast('New Lead Assigned', `Lead ${newLead.lead_name} has been assigned to you.`);
            } else if (!isAssignedToMe && wasAssignedToMe) {
              addToast('Lead Reassigned', `Lead ${newLead.lead_name} was reassigned to another broker.`);
            }
          }
        } else {
          // Admin notifications
          if (payload.eventType === 'INSERT') {
            addToast('New Lead Received', `New client registration: ${newLead.lead_name}`);
          }
        }
      })
      .subscribe();

    // Subscribe to Notifications changes
    const notificationsChannel = supabase
      .channel('notifications-user')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('[Realtime] User notification received:', payload);
        setNotifications(prev => [payload.new, ...prev]);
        addToast(payload.new.title, payload.new.message);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [supabase, user]);

  const loadNotifications = async () => {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('[Notifications Load Error]:', err.message);
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const res = await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToast = (title, message) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message }]);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <RealtimeContext.Provider value={{ 
      supabase, 
      notifications, 
      toasts, 
      leadsTrigger, 
      markNotificationAsRead, 
      markAllNotificationsAsRead, 
      addToast, 
      removeToast,
      refreshLeads: () => setLeadsTrigger(prev => prev + 1)
    }}>
      {children}
    </RealtimeContext.Provider>
  );
};
