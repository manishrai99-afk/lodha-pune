import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import Layout from '../components/Layout';
import '../styles/styles.css';

export default function Leads() {
  const { user, apiFetch } = useAuth();
  const { leadsTrigger, refreshLeads, addToast } = useRealtime();

  const [leads, setLeads] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [budgetFilter, setBudgetFilter] = useState('');

  // Inspector Drawer state
  const [activeLead, setActiveLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);

  // Create lead modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadProject, setNewLeadProject] = useState('Lodha Hinjewadi');
  const [newLeadBudget, setNewLeadBudget] = useState('₹1.2 Cr - ₹1.8 Cr');
  const [newLeadSource, setNewLeadSource] = useState('direct');
  const [newLeadAssigned, setNewLeadAssigned] = useState('');

  // Follow-up input state
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupDate, setFollowupDate] = useState('');

  // Site visit input state
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [visitRemarks, setVisitRemarks] = useState('');

  useEffect(() => {
    fetchLeads();
    fetchBrokers();
  }, [leadsTrigger, statusFilter, projectFilter, budgetFilter, search]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      let url = `/api/leads?limit=100`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (projectFilter) url += `&project=${encodeURIComponent(projectFilter)}`;
      if (budgetFilter) url += `&budget=${encodeURIComponent(budgetFilter)}`;

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrokers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setBrokers(data.filter(u => u.role === 'broker' && u.is_active));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          lead_name: newLeadName,
          phone: newLeadPhone,
          email: newLeadEmail || null,
          source: newLeadSource,
          project: newLeadProject,
          budget: newLeadBudget,
          assigned_to: newLeadAssigned || null
        })
      });

      if (res.ok) {
        addToast('Success', 'Lead created successfully.');
        setShowCreateModal(false);
        setNewLeadName('');
        setNewLeadPhone('');
        setNewLeadEmail('');
        setNewLeadAssigned('');
        refreshLeads();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create lead.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (leadId, nextStatus) => {
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        addToast('Stage Updated', `Lead stage updated to ${nextStatus}`);
        refreshLeads();
        if (activeLead && activeLead.id === leadId) {
          // Refresh open drawer details
          const updated = await res.json();
          setActiveLead(updated);
          fetchLeadSubDetails(leadId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBrokerAssign = async (leadId, brokerId) => {
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ assigned_to: brokerId || null })
      });
      if (res.ok) {
        addToast('Assignment Modified', 'Lead assignee changed successfully.');
        refreshLeads();
        if (activeLead && activeLead.id === leadId) {
          const updated = await res.json();
          setActiveLead(updated);
          fetchLeadSubDetails(leadId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeadSubDetails = async (leadId) => {
    try {
      const actRes = await apiFetch(`/api/activities/lead/${leadId}`);
      if (actRes.ok) setActivities(await actRes.json());

      const fRes = await apiFetch(`/api/followups/lead/${leadId}`);
      if (fRes.ok) setFollowups(await fRes.json());

      const vRes = await apiFetch(`/api/sitevisits/lead/${leadId}`);
      if (vRes.ok) setSiteVisits(await vRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const openDrawer = (lead) => {
    setActiveLead(lead);
    fetchLeadSubDetails(lead.id);
  };

  const closeDrawer = () => {
    setActiveLead(null);
    setActivities([]);
    setFollowups([]);
    setSiteVisits([]);
  };

  // Create follow-up checklist reminder
  const handleAddFollowup = async (e) => {
    e.preventDefault();
    if (!followupDate || !followupNotes) return;

    try {
      const res = await apiFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: activeLead.id,
          followup_date: new Date(followupDate).toISOString(),
          notes: followupNotes
        })
      });

      if (res.ok) {
        setFollowupNotes('');
        setFollowupDate('');
        fetchLeadSubDetails(activeLead.id);
        addToast('Checklist Updated', 'Follow-up reminder set.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFollowup = async (id, currentVal) => {
    try {
      const res = await apiFetch(`/api/followups/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_completed: !currentVal })
      });
      if (res.ok) {
        fetchLeadSubDetails(activeLead.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Schedule site visit
  const handleScheduleVisit = async (e) => {
    e.preventDefault();
    if (!visitDate || !visitTime) return;

    try {
      const res = await apiFetch('/api/sitevisits', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: activeLead.id,
          visit_date: visitDate,
          visit_time: visitTime,
          remarks: visitRemarks
        })
      });

      if (res.ok) {
        setVisitDate('');
        setVisitTime('');
        setVisitRemarks('');
        fetchLeadSubDetails(activeLead.id);
        addToast('Site Visit Scheduled', 'Site visit booked.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateVisitStatus = async (visitId, nextStatus) => {
    try {
      const res = await apiFetch(`/api/sitevisits/${visitId}`, {
        method: 'PUT',
        body: JSON.stringify({ visit_status: nextStatus })
      });
      if (res.ok) {
        fetchLeadSubDetails(activeLead.id);
        addToast('Visit Status Updated', `Site visit stage set to ${nextStatus}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // CSV Export helper
  const exportCSV = () => {
    if (leads.length === 0) return alert('No leads to export.');
    const headers = ['ID', 'Date Created', 'Name', 'Phone', 'Email', 'Source', 'Project', 'Budget', 'Status', 'Assignee'];
    
    const rows = leads.map(l => [
      l.id,
      new Date(l.created_at).toLocaleDateString(),
      l.lead_name,
      l.phone,
      l.email || '',
      l.source,
      l.project || '',
      l.budget || '',
      l.status,
      l.assigned_to?.full_name || 'Unassigned'
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${(cell + '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `crm-leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Layout>
      <div className="workspace-header">
        <div className="workspace-title">
          <h1>Lead Acquisition</h1>
          <p>Real-time client portfolio and pipeline stages.</p>
        </div>

        <div className="workspace-actions">
          <button className="btn-secondary" onClick={exportCSV}>
            📥 Export CSV
          </button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ Create Lead
          </button>
        </div>
      </div>

      {/* Filters board */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input 
            type="text" 
            placeholder="Search leads by name, phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-selects">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">-- All Stages --</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Interested">Interested</option>
            <option value="Site Visit">Site Visit</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Booked">Booked</option>
            <option value="Lost">Lost</option>
          </select>

          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">-- All Projects --</option>
            <option value="Lodha Hinjewadi">Lodha Hinjewadi</option>
            <option value="Lodha Bund Garden">Lodha Bund Garden</option>
            <option value="Lodha Kharadi">Lodha Kharadi</option>
          </select>

          <select value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)}>
            <option value="">-- All Budgets --</option>
            <option value="Above ₹2.5 Cr">Above ₹2.5 Cr</option>
            <option value="₹1.8 Cr - ₹2.5 Cr">₹1.8 Cr - ₹2.5 Cr</option>
            <option value="₹1.2 Cr - ₹1.8 Cr">₹1.2 Cr - ₹1.8 Cr</option>
          </select>
        </div>
      </div>

      {/* Leads cards grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="no-leads">
          <h3>No Leads Found</h3>
          <p>Create a lead or adjust filters to view acquisitions.</p>
        </div>
      ) : (
        <div className="leads-board">
          {leads.map(lead => {
            const initials = lead.assigned_to?.full_name ? lead.assigned_to.full_name.charAt(0).toUpperCase() : '?';
            return (
              <div 
                key={lead.id} 
                className="lead-tile" 
                onClick={() => openDrawer(lead)}
              >
                <div className="lead-tile-header">
                  <div className="lead-tile-title">
                    <h3>{lead.lead_name}</h3>
                    <span className="lead-tile-time">{new Date(lead.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className={`badge badge-${lead.status.toLowerCase().replace(' ', '')}`}>{lead.status}</span>
                </div>

                <div className="lead-tile-details">
                  <span className="lead-tile-chip project">{lead.project || 'Lodha project'}</span>
                  <span className="lead-tile-chip">{lead.budget || 'Budget not specified'}</span>
                  <span className="lead-tile-chip">{lead.source}</span>
                </div>

                <div className="lead-tile-footer" onClick={(e) => e.stopPropagation()}>
                  <div className="lead-tile-broker">
                    <span>Broker:</span>
                    {user.role === 'broker' ? (
                      <strong>{lead.assigned_to?.full_name || 'Unassigned'}</strong>
                    ) : (
                      <select 
                        value={lead.assigned_to?.id || ''} 
                        onChange={(e) => handleBrokerAssign(lead.id, e.target.value)}
                        style={{ border: 'none', background: 'none', color: 'var(--gold)', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="">Unassigned</option>
                        {brokers.map(b => (
                          <option key={b.id} value={b.id}>{b.full_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="lead-tile-avatar" title={`Assigned to: ${lead.assigned_to?.full_name || 'Unassigned'}`}>
                    {initials}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE LEAD MODAL */}
      {showCreateModal && (
        <div className="drawer-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="auth-card" style={{ zIndex: 120, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Create New Lead</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateLead} className="auth-form">
              <div className="form-group">
                <label>Client Name</label>
                <input type="text" value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} required placeholder="Client full name" />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} required placeholder="Mobile number" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)} placeholder="email@client.com" />
              </div>
              <div className="form-group">
                <label>Project Preference</label>
                <select value={newLeadProject} onChange={(e) => setNewLeadProject(e.target.value)}>
                  <option value="Lodha Hinjewadi">Lodha Hinjewadi</option>
                  <option value="Lodha Bund Garden">Lodha Bund Garden</option>
                  <option value="Lodha Kharadi">Lodha Kharadi</option>
                </select>
              </div>
              <div className="form-group">
                <label>Budget Range</label>
                <select value={newLeadBudget} onChange={(e) => setNewLeadBudget(e.target.value)}>
                  <option value="Above ₹2.5 Cr">Above ₹2.5 Cr</option>
                  <option value="₹1.8 Cr - ₹2.5 Cr">₹1.8 Cr - ₹2.5 Cr</option>
                  <option value="₹1.2 Cr - ₹1.8 Cr">₹1.2 Cr - ₹1.8 Cr</option>
                </select>
              </div>
              <div className="form-group">
                <label>Lead Source</label>
                <input type="text" value={newLeadSource} onChange={(e) => setNewLeadSource(e.target.value)} placeholder="e.g. google, facebook, referral" />
              </div>

              {(user.role === 'admin' || user.role === 'super_admin') && (
                <div className="form-group">
                  <label>Assign Broker</label>
                  <select value={newLeadAssigned} onChange={(e) => setNewLeadAssigned(e.target.value)}>
                    <option value="">-- Unassigned --</option>
                    {brokers.map(b => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn-auth">Register Lead</button>
            </form>
          </div>
        </div>
      )}

      {/* LEAD DETAILS DRAWER PANEL */}
      {activeLead && (
        <>
          <div className="drawer-backdrop" onClick={closeDrawer} />
          <div className="drawer-panel">
            <div className="drawer-header">
              <h2>Client Inspector</h2>
              <button className="btn-close-drawer" onClick={closeDrawer}>×</button>
            </div>

            <div className="drawer-body">
              {/* Profile Details */}
              <div className="drawer-section">
                <h3>Details</h3>
                <div className="drawer-row"><span className="drawer-label">Client Name</span><span className="drawer-value">{activeLead.lead_name}</span></div>
                <div className="drawer-row"><span className="drawer-label">Phone</span><span className="drawer-value"><a href={`tel:${activeLead.phone}`} style={{ color: 'var(--gold)' }}>{activeLead.phone}</a></span></div>
                <div className="drawer-row"><span className="drawer-label">Email</span><span className="drawer-value">{activeLead.email || '—'}</span></div>
                <div className="drawer-row"><span className="drawer-label">Project</span><span className="drawer-value">{activeLead.project || '—'}</span></div>
                <div className="drawer-row"><span className="drawer-label">Budget</span><span className="drawer-value">{activeLead.budget || '—'}</span></div>
                
                <div className="drawer-row" style={{ alignItems: 'center' }}>
                  <span className="drawer-label">Stage Stage</span>
                  <select 
                    value={activeLead.status} 
                    onChange={(e) => handleStatusChange(activeLead.id, e.target.value)}
                    style={{ padding: '6px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontWeight: 700 }}
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Site Visit">Site Visit</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Booked">Booked</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>

                <div className="drawer-row" style={{ alignItems: 'center' }}>
                  <span className="drawer-label">Assigned Broker</span>
                  {user.role === 'broker' ? (
                    <span className="drawer-value">{activeLead.assigned_to?.full_name || 'Unassigned'}</span>
                  ) : (
                    <select 
                      value={activeLead.assigned_to?.id || ''} 
                      onChange={(e) => handleBrokerAssign(activeLead.id, e.target.value)}
                      style={{ padding: '6px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontWeight: 600 }}
                    >
                      <option value="">Unassigned</option>
                      {brokers.map(b => (
                        <option key={b.id} value={b.id}>{b.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Reminders / Followups checklists */}
              <div className="drawer-section">
                <h3>Follow-up Reminders Checklist</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {followups.map(f => (
                    <div key={f.id} className="task-row">
                      <div className="task-left">
                        <input 
                          type="checkbox" 
                          checked={f.is_completed}
                          onChange={() => handleToggleFollowup(f.id, f.is_completed)}
                        />
                        <span className={`task-text ${f.is_completed ? 'completed' : ''}`}>
                          <strong>{new Date(f.followup_date).toLocaleDateString()}:</strong> {f.notes}
                        </span>
                      </div>
                    </div>
                  ))}
                  {followups.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No followup reminders defined.</p>
                  )}
                </div>

                <form onSubmit={handleAddFollowup} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Task reminder notes..." 
                    value={followupNotes} 
                    onChange={(e) => setFollowupNotes(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="date" 
                      value={followupDate} 
                      onChange={(e) => setFollowupDate(e.target.value)} 
                      required 
                      style={{ flex: 1, padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>Add Task</button>
                  </div>
                </form>
              </div>

              {/* Site Visit coordinator */}
              <div className="drawer-section">
                <h3>Site Visit Coordinator</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {siteVisits.map(v => (
                    <div key={v.id} className="task-row">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>🚗 {v.visit_date} at {v.visit_time.slice(0,5)}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status: <strong>{v.visit_status}</strong>. Info: {v.remarks || '—'}</span>
                      </div>
                      
                      <select 
                        value={v.visit_status} 
                        onChange={(e) => handleUpdateVisitStatus(v.id, e.target.value)}
                        style={{ padding: '4px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px', fontSize: '0.78rem' }}
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Rescheduled">Rescheduled</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  ))}
                  {siteVisits.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No site visits coordinates logged.</p>
                  )}
                </div>

                <form onSubmit={handleScheduleVisit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="date" 
                      value={visitDate} 
                      onChange={(e) => setVisitDate(e.target.value)} 
                      required 
                      style={{ flex: 1, padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                    />
                    <input 
                      type="time" 
                      value={visitTime} 
                      onChange={(e) => setVisitTime(e.target.value)} 
                      required 
                      style={{ flex: 1, padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Presentation/Vehicle arrangement remarks..." 
                    value={visitRemarks} 
                    onChange={(e) => setVisitRemarks(e.target.value)}
                    style={{ padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px' }}
                  />
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>Coordinate Visit</button>
                </form>
              </div>

              {/* Activity Timeline logs */}
              <div className="drawer-section">
                <h3>Activity timeline</h3>
                <div className="timeline">
                  {activities.map(act => {
                    let dotClass = '';
                    if (act.action.includes('Completed') || act.action.includes('Done')) dotClass = 'completed';
                    else if (act.action.includes('Cancel') || act.action.includes('Lost')) dotClass = 'cancelled';
                    else if (act.action.includes('Created')) dotClass = 'created';

                    return (
                      <div key={act.id} className="timeline-item">
                        <div className={`timeline-dot ${dotClass}`} />
                        <div className="timeline-content">
                          <div className="timeline-meta">
                            <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{act.action}</span>
                            <span>{new Date(act.created_at).toLocaleString()}</span>
                          </div>
                          <p className="timeline-desc">{act.details}</p>
                          {act.user_id && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Triggered by: {act.user_id.full_name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
