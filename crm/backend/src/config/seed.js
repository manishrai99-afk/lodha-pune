const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./db');
require('dotenv').config();

async function runSeed() {
  console.log('[Seed] Starting database initialization...');

  const fullName = 'Admin Manager';
  const username = 'admin';
  const email = 'admin@24k.com';
  const password = 'admin24k';
  const role = 'super_admin';

  try {
    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      console.log('[Seed] Super Admin user "admin" already exists. Skipping creation.');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert super admin
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        full_name: fullName,
        username,
        email,
        phone: '9876543210',
        password_hash: passwordHash,
        role,
        is_active: true
      })
      .select();

    if (error) {
      throw error;
    }

    console.log('==================================================');
    console.log('🎉 Seed Successful! Initial account created:');
    console.log(`👤 Name: ${fullName}`);
    console.log(`🔑 Username: ${username}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔒 Password: ${password}`);
    console.log(`🛡️ Role: ${role}`);
    console.log('==================================================');

  } catch (err) {
    console.error('[Seed Error]:', err.message);
  }
}

runSeed();
