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
 * GET /api/followups/lead/:leadId - Get all followups for a lead
 */
router.get('/lead/:leadId', authenticateToken, async (req, res) => {
  const { leadId } = req.params;

  try {
    const authorized = await hasLeadAccess(req.user.id, req.user.role, leadId);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this lead\'s followups.' });
    }

    const { data: followups, error } = await supabaseAdmin
      .from('followups')
      .select('*')
      .eq('lead_id', leadId)
      .order('followup_date', { ascending: true });

    if (error) throw error;
    res.json(followups);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/followups - Create a follow-up
 */
router.post('/', authenticateToken, async (req, res) => {
  const { lead_id, followup_date, notes } = req.body;

  if (!lead_id || !followup_date) {
    return res.status(400).json({ error: 'Lead ID and followup date are required.' });
  }

  try {
    const authorized = await hasLeadAccess(req.user.id, req.user.role, lead_id);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: You cannot add followups to this lead.' });
    }

    const { data: followup, error } = await supabaseAdmin
      .from('followups')
      .insert({
        lead_id,
        followup_date,
        notes: notes || null,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    // Log Activity
    const formattedDate = new Date(followup_date).toLocaleDateString();
    await logActivity(
      'Follow-up Added', 
      `Follow-up task scheduled for ${formattedDate}. Notes: ${notes || '—'}`, 
      lead_id, 
      req.user.id
    );

    res.status(201).json(followup);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/followups/:id - Edit or complete a follow-up
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { followup_date, notes, is_completed } = req.body;

  try {
    // Fetch current followup to verify lead access
    const { data: currentFollowup, error: fetchErr } = await supabaseAdmin
      .from('followups')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentFollowup) {
      return res.status(404).json({ error: 'Follow-up not found.' });
    }

    const authorized = await hasLeadAccess(req.user.id, req.user.role, currentFollowup.lead_id);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const updates = {};
    if (followup_date !== undefined) updates.followup_date = followup_date;
    if (notes !== undefined) updates.notes = notes;
    if (is_completed !== undefined) updates.is_completed = is_completed;
    updates.updated_at = new Date().toISOString();

    const { data: updatedFollowup, error } = await supabaseAdmin
      .from('followups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log Completion Activity if status changed to complete
    if (is_completed === true && currentFollowup.is_completed === false) {
      await logActivity(
        'Follow-up Completed', 
        `Completed followup task: ${currentFollowup.notes || 'No description'}`, 
        currentFollowup.lead_id, 
        req.user.id
      );
    }

    res.json(updatedFollowup);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/followups/:id - Delete a follow-up
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: currentFollowup, error: fetchErr } = await supabaseAdmin
      .from('followups')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentFollowup) {
      return res.status(404).json({ error: 'Follow-up not found.' });
    }

    const authorized = await hasLeadAccess(req.user.id, req.user.role, currentFollowup.lead_id);
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const { error } = await supabaseAdmin
      .from('followups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Follow-up successfully deleted.' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
