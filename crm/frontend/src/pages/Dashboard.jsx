import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import Layout from '../components/Layout';
import '../styles/styles.css';

export default function Dashboard() {
  const { user, apiFetch } = useAuth();
  const { leadsTrigger } = useRealtime();

  const [leads, setLeads] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [leadsTrigger]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Leads (scoped automatically by server role)
      const leadsRes = await apiFetch('/api/leads?limit=1000');
      const leadsData = await leadsRes.json();
      const leadsList = leadsData.leads || [];
      setLeads(leadsList);

      // 2. Fetch Users (if Admin to calculate workloads)
      if (user.role === 'admin' || user.role === 'super_admin') {
        const usersRes = await apiFetch('/api/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
      }

      // 3. Fetch Followups & Site Visits to match dashboard metrics
      // To get accurate counts, we can fetch all details. Let's simulate fetching lists or calculate directly.
      // For a robust experience, we can fetch all site visits and followups.
      // Wait, let's fetch followups and site visits
      // Since followups/sitevisits routes require leadId, we can calculate from leads or fetch globally if we had a global endpoint.
      // Let's implement global fetch for dashboard inside backend, or calculate based on metadata / related queries.
      // Actually, since leads contain assigned_to UUID, we can query our backend. Let's make mock lists or calculate from lead statuses.
      // Let's assume we can fetch site visits by calling a general endpoint, or if we don't have one, we can calculate counts.
      // Wait! Let's mock a simple query or pull from database. It is much easier to just calculate followups and visits from lead status & details.
      // Better yet, we can fetch all site visits and followups for leads we own!
      // Let's make requests:
      const visitsList = [];
      const followupsList = [];
      
      for (const lead of leadsList) {
        try {
          const vRes = await apiFetch(`/api/sitevisits/lead/${lead.id}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            visitsList.push(...vData);
          }
          const fRes = await apiFetch(`/api/followups/lead/${lead.id}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            followupsList.push(...fData);
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      setSiteVisits(visitsList);
      setFollowups(followupsList);

    } catch (err) {
      console.error('[Dashboard Fetch Error]:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <h2 style={{ color: 'var(--gold)' }}>Loading Dashboard Metrics...</h2>
        </div>
      </Layout>
    );
  }

  // Helper to parse budgets into numbers
  const getBudgetValuation = (budgetStr) => {
    if (!budgetStr) return 10000000; // 1 Cr default
    if (budgetStr.includes('Above 2.5')) return 30000000; // 3 Cr
    if (budgetStr.includes('1.8') || budgetStr.includes('2.5')) return 21500000; // 2.15 Cr
    if (budgetStr.includes('1.2') || budgetStr.includes('1.8')) return 15000000; // 1.5 Cr
    return 10000000;
  };

  // ==================== METRICS CALCULATIONS ====================

  // A. BROKER METRICS
  const brokerTotal = leads.length;
  const brokerNew = leads.filter(l => l.status === 'New').length;
  const brokerFollowupsPending = followups.filter(f => !f.is_completed).length;
  const brokerVisitsScheduled = siteVisits.filter(v => v.visit_status === 'Scheduled' || v.visit_status === 'Rescheduled').length;
  const brokerVisitsCompleted = siteVisits.filter(v => v.visit_status === 'Completed').length;
  const brokerBookings = leads.filter(l => l.status === 'Booked').length;
  const brokerConversionRate = brokerTotal > 0 ? Math.round((brokerBookings / brokerTotal) * 100) : 0;

  // B. ADMIN GLOBAL METRICS
  const adminTotal = leads.length;
  const adminActive = leads.filter(l => l.status !== 'Booked' && l.status !== 'Lost').length;
  const adminClosed = leads.filter(l => l.status === 'Booked').length;
  const adminLost = leads.filter(l => l.status === 'Lost').length;

  // Revenue metrics
  const potentialRevenue = leads
    .filter(l => l.status !== 'Booked' && l.status !== 'Lost')
    .reduce((sum, l) => sum + getBudgetValuation(l.budget), 0);
  const closedRevenue = leads
    .filter(l => l.status === 'Booked')
    .reduce((sum, l) => sum + getBudgetValuation(l.budget), 0);
  const commissionRevenue = closedRevenue * 0.02; // 2% Commission

  // Group leads per broker
  const brokerWorkload = {};
  leads.forEach(lead => {
    const brokerName = lead.assigned_to?.full_name || 'Unassigned';
    brokerWorkload[brokerName] = (brokerWorkload[brokerName] || 0) + 1;
  });

  // Calculate performance per broker for table
  const brokersPerformance = users
    .filter(u => u.role === 'broker')
    .map(u => {
      const assignedLeads = leads.filter(l => l.assigned_to?.id === u.id);
      const bookingsClosed = assignedLeads.filter(l => l.status === 'Booked').length;
      
      // Count completed site visits for leads assigned to this broker
      const leadIds = assignedLeads.map(l => l.id);
      const visitsCompleted = siteVisits.filter(v => leadIds.includes(v.lead_id) && v.visit_status === 'Completed').length;
      const followupsCompleted = followups.filter(f => leadIds.includes(f.lead_id) && f.is_completed).length;

      const conversion = assignedLeads.length > 0 ? Math.round((bookingsClosed / assignedLeads.length) * 100) : 0;

      return {
        name: u.full_name,
        assigned: assignedLeads.length,
        followupsCompleted,
        visitsCompleted,
        bookingsClosed,
        conversion
      };
    });

  // Helper to format currency
  const formatCurrency = (val) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(val / 100000).toFixed(2)} L`;
  };

  return (
    <Layout>
      <div className="workspace-header">
        <div className="workspace-title">
          <h1>CRM Metrics Dashboard</h1>
          <p>
            {user.role === 'broker' 
              ? 'Broker Scoped Performance Tracking & Reminder checklist.' 
              : 'Global Acquisition, Workload distributions, and Revenue dashboard.'}
          </p>
        </div>
      </div>

      {user.role === 'broker' ? (
        // ==================== BROKER VIEW ====================
        <>
          <div className="dashboard-grid">
            <div className="metric-card gold">
              <div className="metric-label">Total Leads</div>
              <div className="metric-value">{brokerTotal}</div>
              <div className="metric-subtext">My Assigned Leads</div>
            </div>

            <div className="metric-card cyan">
              <div className="metric-label">New Leads</div>
              <div className="metric-value">{brokerNew}</div>
              <div className="metric-subtext">Awaiting Response</div>
            </div>

            <div className="metric-card orange">
              <div className="metric-label">Pending Follow-ups</div>
              <div className="metric-value">{brokerFollowupsPending}</div>
              <div className="metric-subtext">Checklist Tasks Due</div>
            </div>

            <div className="metric-card green">
              <div className="metric-label">Site Visits (Completed)</div>
              <div className="metric-value">{brokerVisitsCompleted} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/ {brokerVisitsScheduled + brokerVisitsCompleted}</span></div>
              <div className="metric-subtext">Client Presentations</div>
            </div>

            <div className="metric-card gold">
              <div className="metric-label">Bookings Closed</div>
              <div className="metric-value">{brokerBookings}</div>
              <div className="metric-subtext">Conversion Rate: {brokerConversionRate}%</div>
            </div>
          </div>

          <div className="analytics-drawer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Task list reminders */}
            <div className="chart-box">
              <span className="chart-title">🕒 Upcoming Follow-ups & Reminders</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {followups.filter(f => !f.is_completed).slice(0, 5).map(f => {
                  const leadName = leads.find(l => l.id === f.lead_id)?.lead_name || 'Client';
                  return (
                    <div key={f.id} className="task-row">
                      <div className="task-left">
                        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>📅 {new Date(f.followup_date).toLocaleDateString()}</span>
                        <span style={{ marginLeft: '10px' }}>{f.notes} for <strong>{leadName}</strong></span>
                      </div>
                    </div>
                  );
                })}
                {followups.filter(f => !f.is_completed).length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending follow-ups. Good job!</p>
                )}
              </div>
            </div>

            {/* Scheduled site visits */}
            <div className="chart-box">
              <span className="chart-title">📍 Scheduled Site Visits</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {siteVisits.filter(v => v.visit_status === 'Scheduled').slice(0, 5).map(v => {
                  const leadName = leads.find(l => l.id === v.lead_id)?.lead_name || 'Client';
                  return (
                    <div key={v.id} className="task-row">
                      <div className="task-left">
                        <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>🚗 {v.visit_date} at {v.visit_time.slice(0,5)}</span>
                        <span style={{ marginLeft: '10px' }}>Client: <strong>{leadName}</strong> ({v.remarks || 'No remarks'})</span>
                      </div>
                    </div>
                  );
                })}
                {siteVisits.filter(v => v.visit_status === 'Scheduled').length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No site visits scheduled.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        // ==================== ADMIN VIEW ====================
        <>
          {/* Revenue and General Cards */}
          <div className="dashboard-grid">
            <div className="metric-card gold">
              <div className="metric-label">Total Leads (All)</div>
              <div className="metric-value">{adminTotal}</div>
              <div className="metric-subtext">Active: {adminActive} | Lost: {adminLost}</div>
            </div>

            <div className="metric-card green">
              <div className="metric-label">Potential Pipeline</div>
              <div className="metric-value" style={{ color: '#2ecc71' }}>{formatCurrency(potentialRevenue)}</div>
              <div className="metric-subtext">Active Leads Valuation</div>
            </div>

            <div className="metric-card gold">
              <div className="metric-label">Closed Revenue</div>
              <div className="metric-value">{formatCurrency(closedRevenue)}</div>
              <div className="metric-subtext">Bookings: {adminClosed}</div>
            </div>

            <div className="metric-card orange">
              <div className="metric-label">Estimated Commissions</div>
              <div className="metric-value" style={{ color: 'var(--gold)' }}>{formatCurrency(commissionRevenue)}</div>
              <div className="metric-subtext">2% on Closed Bookings</div>
            </div>
          </div>

          <div className="analytics-drawer">
            <h3>📊 Executive Analytics</h3>
            <div className="analytics-grid">
              
              {/* Funnel distribution */}
              <div className="chart-box">
                <span className="chart-title">Lead Acquisition Funnel</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['New', 'Contacted', 'Interested', 'Site Visit', 'Negotiation', 'Booked', 'Lost'].map(stage => {
                    const count = leads.filter(l => l.status === stage).length;
                    const percent = adminTotal > 0 ? Math.round((count / adminTotal) * 100) : 0;
                    return (
                      <div key={stage} className="bar-row">
                        <span className="bar-label">{stage}</span>
                        <div className="bar-container">
                          <div className="bar-fill" style={{ width: `${percent}%` }}></div>
                          <span className="bar-value">{count} ({percent}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workload distribution */}
              <div className="chart-box">
                <span className="chart-title">Broker Workload Distribution</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(brokerWorkload).map(([brokerName, count]) => {
                    const percent = adminTotal > 0 ? Math.round((count / adminTotal) * 100) : 0;
                    return (
                      <div key={brokerName} className="bar-row">
                        <span className="bar-label">{brokerName}</span>
                        <div className="bar-container">
                          <div className="bar-fill" style={{ width: `${percent}%`, background: 'var(--gold)' }}></div>
                          <span className="bar-value">{count} leads</span>
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(brokerWorkload).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No leads assigned yet.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Broker Performance Table */}
          <div className="analytics-drawer">
            <h3>👥 Team Performance Analytics</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Broker Name</th>
                    <th>Leads Assigned</th>
                    <th>Follow-ups Completed</th>
                    <th>Site Visits Completed</th>
                    <th>Bookings Closed</th>
                    <th>Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {brokersPerformance.map(b => (
                    <tr key={b.name}>
                      <td style={{ fontWeight: 700, color: 'var(--gold)' }}>{b.name}</td>
                      <td>{b.assigned}</td>
                      <td>{b.followupsCompleted}</td>
                      <td>{b.visitsCompleted}</td>
                      <td style={{ color: '#2ecc71', fontWeight: 700 }}>{b.bookingsClosed}</td>
                      <td style={{ fontWeight: 700 }}>{b.conversion}%</td>
                    </tr>
                  ))}
                  {brokersPerformance.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No broker profiles registered in the directory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
