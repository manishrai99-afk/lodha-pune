const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

/**
 * Helper: check lead ownership/access permission
 */
async function hasLeadAccess(userId, userRole, leadId) {
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, assigned_to, created_by')
    .eq('id', leadId)
    .single();

  if (!lead) return false;
  if (userRole === 'broker') {
    return lead.assigned_to === userId || lead.created_by === userId;
  }
  return true;
}

/**
 * GET /api/sitevisits/lead/:leadId - Get all site visits for a lead
 */
router.get('/lead/:leadId', authenticateToken, async (req, res) => {
  const { leadId } = req.params;

  try {
    const authorized = await hasLeadAccess(req.user.id, req.user.role, leadId);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this lead\'s site visits.' });
    }

    const { data: visits, error } = await supabaseAdmin
      .from('site_visits')
      .select('*, broker_id(id, full_name, username)')
      .eq('lead_id', leadId)
      .order('visit_date', { ascending: true });

    if (error) throw error;
    res.json(visits);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sitevisits - Schedule a site visit
 */
router.post('/', authenticateToken, async (req, res) => {
  const { lead_id, visit_date, visit_time, remarks, broker_id } = req.body;

  if (!lead_id || !visit_date || !visit_time) {
    return res.status(400).json({ error: 'Lead ID, visit date, and visit time are required.' });
  }

  try {
    const authorized = await hasLeadAccess(req.user.id, req.user.role, lead_id);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: You cannot schedule site visits for this lead.' });
    }

    // Default broker_id to assigned broker or creator if empty
    let visitBroker = broker_id || req.user.id;

    const { data: visit, error } = await supabaseAdmin
      .from('site_visits')
      .insert({
        lead_id,
        visit_date,
        visit_time,
        visit_status: 'Scheduled',
        remarks: remarks || null,
        broker_id: visitBroker,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    // Log Activity
    const dateStr = `${visit_date} at ${visit_time}`;
    await logActivity(
      'Site Visit Scheduled', 
      `Site visit scheduled for ${dateStr}. Remarks: ${remarks || '—'}`, 
      lead_id, 
      req.user.id
    );

    res.status(201).json(visit);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sitevisits/:id - Update site visit (reschedule, complete, cancel)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { visit_date, visit_time, visit_status, remarks, broker_id } = req.body;

  try {
    // Fetch current site visit details
    const { data: currentVisit, error: fetchErr } = await supabaseAdmin
      .from('site_visits')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentVisit) {
      return res.status(404).json({ error: 'Site visit not found.' });
    }

    const authorized = await hasLeadAccess(req.user.id, req.user.role, currentVisit.lead_id);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const updates = {};
    if (visit_date !== undefined) updates.visit_date = visit_date;
    if (visit_time !== undefined) updates.visit_time = visit_time;
    if (visit_status !== undefined) updates.visit_status = visit_status;
    if (remarks !== undefined) updates.remarks = remarks;
    if (broker_id !== undefined) updates.broker_id = broker_id;
    updates.updated_at = new Date().toISOString();

    const { data: updatedVisit, error } = await supabaseAdmin
      .from('site_visits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Determine and Log Activity changes
    if (visit_status !== undefined && visit_status !== currentVisit.visit_status) {
      let actionType = 'Status Changed';
      let desc = `Site visit status updated from ${currentVisit.visit_status} to ${visit_status}`;
      
      if (visit_status === 'Completed') {
        actionType = 'Site Visit Completed';
        desc = `Site visit successfully completed. Remarks: ${remarks || updatedVisit.remarks || '—'}`;
      } else if (visit_status === 'Cancelled') {
        actionType = 'Status Changed'; // mapped to Status Changed / Cancelled
        desc = `Site visit cancelled. Reason: ${remarks || '—'}`;
      } else if (visit_status === 'Rescheduled') {
        actionType = 'Site Visit Scheduled';
        desc = `Site visit rescheduled to ${updatedVisit.visit_date} at ${updatedVisit.visit_time}`;
      }

      await logActivity(actionType, desc, currentVisit.lead_id, req.user.id);
    } else if (visit_date !== undefined || visit_time !== undefined) {
      // Just date/time changed but status same
      await logActivity(
        'Site Visit Scheduled', 
        `Site visit rescheduled to ${updatedVisit.visit_date} at ${updatedVisit.visit_time}`, 
        currentVisit.lead_id, 
        req.user.id
      );
    }

    res.json(updatedVisit);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sitevisits/:id - Delete site visit
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: currentVisit, error: fetchErr } = await supabaseAdmin
      .from('site_visits')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentVisit) {
      return res.status(404).json({ error: 'Site visit not found.' });
    }

    const authorized = await hasLeadAccess(req.user.id, req.user.role, currentVisit.lead_id);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const { error } = await supabaseAdmin
      .from('site_visits')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Site visit successfully deleted.' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
