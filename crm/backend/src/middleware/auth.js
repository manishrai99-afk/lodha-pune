const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[Auth Middleware] JWT_SECRET is not configured.');
  process.exit(1);
}

/**
 * Middleware to verify custom JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token.' });
    }
    
    // Bind context variables
    req.user = {
      id: user.sub,
      email: user.email,
      role: user.user_metadata?.role,
      username: user.user_metadata?.username,
      full_name: user.user_metadata?.full_name
    };
    
    next();
  });
}

/**
 * Middleware to check user role permissions (RBAC)
 * @param {Array<string>} roles Allowed roles (e.g. ['super_admin', 'admin'])
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of these roles: ${roles.join(', ')}` });
    }
    next();
  };
}

/**
 * Activity log helper
 * @param {string} action Action type
 * @param {string} details Description of action
 * @param {number|string} leadId Lead reference ID
 * @param {string} userId User UUID
 */
async function logActivity(action, details, leadId, userId) {
  try {
    const { error } = await supabaseAdmin
      .from('activities')
      .insert({
        lead_id: leadId,
        action,
        details,
        user_id: userId
      });
    if (error) {
      console.error('[Activity Log Error]:', error.message);
    }
  } catch (err) {
    console.error('[Activity Log Exception]:', err.message);
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  logActivity
};
