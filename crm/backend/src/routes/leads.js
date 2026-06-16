const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/db');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');

/**
 * Helper: Triggers a real-time notification
 */
async function triggerNotification(userId, title, message) {
  try {
    await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, title, message });
  } catch (err) {
    console.error('[Notification Trigger Error]:', err.message);
  }
}

/**
 * GET /api/leads - Scoped fetch leads with filters & search & pagination
 */
router.get('/', authenticateToken, async (req, res) => {
  const { status, project, budget, search, page = 1, limit = 50 } = req.query;

  try {
    let query = supabaseAdmin
      .from('leads')
      .select('*, assigned_to(id, full_name, username), created_by(id, full_name)', { count: 'exact' });

    // Scoping based on Role
    if (req.user.role === 'broker') {
      query = query.or(`assigned_to.eq.${req.user.id},created_by.eq.${req.user.id}`);
    }

    // Apply filters
    if (status) query = query.eq('status', status);
    if (project) query = query.eq('project', project);
    if (budget) query = query.eq('budget', budget);

    // Apply text search across name, phone, email, notes
    if (search) {
      const cleanSearch = search.trim();
      query = query.or(`lead_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: leads, count, error } = await query;
    if (error) throw error;

    res.json({
      leads,
      count,
      page: Number(page),
      totalPages: Math.ceil(count / limit)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leads - Create lead (Authenticated Admin/Broker)
 */
router.post('/', authenticateToken, async (req, res) => {
  const { lead_name, phone, email, source, project, budget, status, assigned_to, notes } = req.body;

  if (!lead_name || !phone) {
    return res.status(400).json({ error: 'Lead name and phone are required.' });
  }

  try {
    // If broker is creating, automatically assign to themselves unless admin specifies another broker
    let assignee = assigned_to || null;
    if (req.user.role === 'broker' && !assignee) {
      assignee = req.user.id;
    }

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_name: lead_name.trim(),
        phone: phone.trim(),
        email: email ? email.trim().toLowerCase() : null,
        source: source || 'direct',
        project: project || null,
        budget: budget || null,
        status: status || 'New',
        assigned_to: assignee,
        created_by: req.user.id,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    // Log Activity
    await logActivity('Lead Created', `Lead successfully created by ${req.user.full_name}`, lead.id, req.user.id);

    // Trigger notification if assigned to another broker
    if (assignee && assignee !== req.user.id) {
      await logActivity('Lead Assigned', `Lead assigned to broker`, lead.id, req.user.id);
      await triggerNotification(assignee, 'New Lead Assigned', `You have been assigned a new lead: ${lead.lead_name}`);
    }

    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leads/public - Public submission from landing page (No authentication required)
 */
router.post('/public', async (req, res) => {
  const { name, phone, requirement, budget, timeline, utm_source, utm_campaign, landing_page, referrer } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone required.' });
  }

  try {
    // Save lead
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_name: name.trim(),
        phone: phone.trim(),
        email: null,
        source: utm_source || 'website',
        project: requirement || 'Lodha Pune',
        budget: budget || null,
        status: 'New',
        assigned_to: null,
        notes: `Timeline: ${timeline || '—'}. Ref: ${referrer || 'Direct'}. Page: ${landing_page || '—'}. Campaign: ${utm_campaign || '—'}`
      })
      .select()
      .single();

    if (error) throw error;

    // Log Activity
    await logActivity('Lead Created', 'Lead captured via website submission form', lead.id, null);

    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/leads/:id - Edit lead (Enforces RBAC)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { lead_name, phone, email, source, project, budget, status, assigned_to, notes } = req.body;

  try {
    // Fetch current lead details
    const { data: currentLead, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentLead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    // Role-based authorization check
    if (req.user.role === 'broker') {
      const isOwner = currentLead.assigned_to === req.user.id || currentLead.created_by === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden: You do not own this lead.' });
      }

      // Check: Broker cannot change assignment
      if (assigned_to !== undefined && assigned_to !== currentLead.assigned_to) {
        return res.status(403).json({ error: 'Forbidden: Brokers cannot reassign leads.' });
      }
    }

    const updates = {};
    if (lead_name !== undefined) updates.lead_name = lead_name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;
    if (source !== undefined) updates.source = source;
    if (project !== undefined) updates.project = project;
    if (budget !== undefined) updates.budget = budget;
    if (status !== undefined) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (notes !== undefined) updates.notes = notes;
    updates.updated_at = new Date().toISOString();

    const { data: updatedLead, error: updateErr } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Detect Assignment Changes & Log
    if (assigned_to !== undefined && assigned_to !== currentLead.assigned_to) {
      const actionType = !currentLead.assigned_to ? 'Lead Assigned' : 'Lead Reassigned';
      
      let detailText = '';
      if (assigned_to) {
        const { data: assigneeUser } = await supabaseAdmin.from('users').select('full_name').eq('id', assigned_to).single();
        detailText = `Lead assigned to ${assigneeUser?.full_name || assigned_to} by ${req.user.full_name}`;
        
        // Notification
        await triggerNotification(assigned_to, 'Lead Assigned', `Lead ${updatedLead.lead_name} has been assigned to you.`);
      } else {
        detailText = `Lead unassigned by ${req.user.full_name}`;
      }

      await logActivity(actionType, detailText, id, req.user.id);
      
      // Notify admin
      await triggerNotification(req.user.id, 'Lead Assignment Successful', `Lead ${updatedLead.lead_name} has been assigned successfully.`);
    }

    // Detect Status / Stage changes & Log
    if (status !== undefined && status !== currentLead.status) {
      const action = status === 'Booked' ? 'Booking Done' : 'Status Changed';
      await logActivity(action, `Status updated from ${currentLead.status} to ${status} by ${req.user.full_name}`, id, req.user.id);
      
      // If status is Booked, notify the broker and admin
      if (status === 'Booked') {
        if (updatedLead.assigned_to) {
          await triggerNotification(updatedLead.assigned_to, 'Booking Completed! 🎉', `Congratulations! The booking for lead ${updatedLead.lead_name} is complete!`);
        }
      }
    }

    res.json(updatedLead);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/leads/:id - Delete lead (Admins & Super Admins only)
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Lead successfully deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
