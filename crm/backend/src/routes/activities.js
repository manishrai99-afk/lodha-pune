const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/activities/lead/:leadId - Fetch all timeline actions for a lead (with RBAC verification)
 */
router.get('/lead/:leadId', authenticateToken, async (req, res) => {
  const { leadId } = req.params;

  try {
    // 1. Fetch lead to verify access permissions
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('id, assigned_to, created_by')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    if (req.user.role === 'broker') {
      const isOwner = lead.assigned_to === req.user.id || lead.created_by === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden: You cannot access activity history for this lead.' });
      }
    }

    // 2. Fetch timeline history
    const { data: activities, error } = await supabaseAdmin
      .from('activities')
      .select('*, user_id(id, full_name, username)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(activities);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
