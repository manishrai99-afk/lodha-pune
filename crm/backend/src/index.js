const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leadRoutes = require('./routes/leads');
const activityRoutes = require('./routes/activities');
const followupRoutes = require('./routes/followups');
const sitevisitRoutes = require('./routes/sitevisits');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Public Configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
});

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/sitevisits', sitevisitRoutes);
app.use('/api/notifications', notificationRoutes);

// Simple Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Real Estate CRM Backend running on port ${PORT}`);
});
