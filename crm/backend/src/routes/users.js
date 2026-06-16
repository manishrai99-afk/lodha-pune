const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/users - Get all users (Admins & Super Admins only)
 */
router.get('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, created_at, full_name, username, email, phone, role, profile_photo, is_active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users - Create a new user (Admins & Super Admins only)
 */
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { full_name, username, email, phone, password, role } = req.body;

  if (!full_name || !username || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        full_name: full_name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        password_hash: passwordHash,
        role,
        created_by: req.user.id,
        is_active: true
      })
      .select('id, full_name, username, email, phone, role, is_active')
      .single();

    if (error) throw error;
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/users/:id - Edit user details (Admins can edit anyone, brokers can only edit themselves)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, profile_photo } = req.body;

  // Security check: Broker can only edit themselves
  if (req.user.role === 'broker' && req.user.id !== id) {
    return res.status(403).json({ error: 'Forbidden: You cannot modify other users profiles.' });
  }

  try {
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (phone !== undefined) updates.phone = phone || null;
    if (profile_photo !== undefined) updates.profile_photo = profile_photo;
    updates.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, full_name, username, email, phone, role, profile_photo, is_active')
      .single();

    if (error) throw error;
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/users/:id/role - Update user role (Super Admins only)
 */
router.patch('/:id/role', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['super_admin', 'admin', 'broker'].includes(role)) {
    return res.status(400).json({ error: 'Valid role required.' });
  }

  try {
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, full_name, username, email, phone, role, is_active')
      .single();

    if (error) throw error;
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/users/:id/status - Toggle user active status (Admins/Super Admins only)
 */
router.patch('/:id/status', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (is_active === undefined) {
    return res.status(400).json({ error: 'Active status required.' });
  }

  // Prevent disabling yourself
  if (req.user.id === id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  try {
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, full_name, username, email, phone, role, is_active')
      .single();

    if (error) throw error;
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/users/:id/password - Force reset user password (Admins/Super Admins only)
 */
router.patch('/:id/password', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'User password reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
