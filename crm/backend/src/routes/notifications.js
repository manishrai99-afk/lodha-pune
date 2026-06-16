const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/notifications - Get all notifications for logged-in user (unread first)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/read - Mark notification as read
 */
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/read-all - Mark all notifications as read for logged-in user
 */
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
