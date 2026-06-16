const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_fallback_secret';

/**
 * Generate Access & Refresh tokens
 */
function generateTokens(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    user_metadata: {
      role: user.role,
      username: user.username,
      full_name: user.full_name
    }
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
}

/**
 * signup - public registration (creates a broker or admin based on request, or defaults to broker)
 */
router.post('/signup', async (req, res) => {
  const { full_name, username, email, phone, password, role } = req.body;

  if (!full_name || !username || !email || !password) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  try {
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`email.eq.${email.trim().toLowerCase()},username.eq.${username.trim().toLowerCase()}`)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user in DB
    const selectedRole = role && ['super_admin', 'admin', 'broker'].includes(role) ? role : 'broker';
    
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        full_name: full_name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        password_hash: passwordHash,
        role: selectedRole,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    // Issue tokens
    const { accessToken, refreshToken } = generateTokens(newUser);

    res.status(201).json({
      message: 'Signup successful.',
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * login - authenticates by username or email
 */
router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body; // loginIdentifier can be username or email

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Credentials required.' });
  }

  const cleanIdentifier = loginIdentifier.trim().toLowerCase();

  try {
    // Query user by email or username
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`email.eq.${cleanIdentifier},username.eq.${cleanIdentifier}`)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled. Please contact your manager.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Issue tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        profile_photo: user.profile_photo
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * refresh token
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Fetch current user details
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.sub)
      .single();

    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Unauthorized or user deactivated.' });
    }

    // Generate new token pair
    const tokens = generateTokens(user);

    res.json(tokens);

  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token.' });
  }
});

/**
 * Simulate Forgot/Reset Password
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (!user) {
      // Return success anyway to prevent email enumeration
      return res.json({ message: 'If registered, a password reset link has been simulated.' });
    }

    // In a real production setup, we would generate a token, save it to a table, and send an email.
    // For this full stack demonstration, we will return a mock reset token.
    const resetToken = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '15m' });
    res.json({
      message: 'Reset token generated (simulated link).',
      resetToken // Returned directly for testing/local reset workflow
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', decoded.sub);

    if (error) throw error;

    res.json({ message: 'Password reset successful.' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
});

module.exports = router;
