const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[DB] Missing Supabase URL or Service Role Key in environment.');
  process.exit(1);
}

// Admin client to bypass RLS for server operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = {
  supabaseAdmin,
  supabaseUrl,
  supabaseServiceKey
};
