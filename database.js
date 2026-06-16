/**
 * 24K Realtors Lead Database Wrapper
 * 
 * Provides unified interface to save/read/update leads.
 * - Local mode: Saves to `data/leads_db.json`
 * - Cloud mode: Saves to Supabase (if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set)
 */

const fs = require('fs').promises;
const path = require('path');

const DB_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DB_DIR, 'leads_db.json');

// Check if Supabase variables are set
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isCloud = !!(SUPABASE_URL && SERVICE_ROLE_KEY);

console.log(`[Database] Initializing in ${isCloud ? 'CLOUD (Supabase)' : 'LOCAL (leads_db.json)'} mode.`);

/**
 * Initialize local database if it doesn't exist
 */
async function initLocalDb() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    try {
      await fs.access(DB_FILE);
    } catch {
      // File does not exist, create empty array
      await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[Database] Failed to initialize local directory:', err.message);
  }
}

if (!isCloud) {
  initLocalDb();
}

/**
 * Inserts a lead into the database.
 * @param {object} leadData 
 * @returns {Promise<object>} The saved lead with its ID
 */
async function insertLead(leadData) {
  const cleanLead = {
    name: leadData.name || '',
    phone: leadData.phone || '',
    requirement: leadData.requirement || '',
    budget: leadData.budget || '',
    timeline: leadData.timeline || '',
    crm_stage: leadData.crm_stage || 'new',
    lead_source: leadData.lead_source || 'website',
    lead_series: leadData.lead_series || leadData.utm_campaign || 'website',
    utm_source: leadData.utm_source || null,
    utm_medium: leadData.utm_medium || null,
    utm_campaign: leadData.utm_campaign || null,
    utm_term: leadData.utm_term || null,
    utm_content: leadData.utm_content || null,
    landing_page: leadData.landing_page || null,
    referrer: leadData.referrer || null,
    metadata: leadData.metadata || {}
  };

  if (isCloud) {
    // Write to Supabase using fetch
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(cleanLead)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase insert failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data[0];
  } else {
    // Write to local JSON
    await initLocalDb(); // Ensure folder exists
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const leads = JSON.parse(data || '[]');
    
    // Generate new numeric ID
    const nextId = leads.reduce((max, l) => Math.max(max, Number(l.id || 0)), 0) + 1;
    
    const newLead = {
      id: nextId,
      created_at: new Date().toISOString(),
      ...cleanLead
    };

    leads.push(newLead);
    await fs.writeFile(DB_FILE, JSON.stringify(leads, null, 2), 'utf-8');
    return newLead;
  }
}

/**
 * Gets leads list from the database sorted by date descending.
 * @returns {Promise<Array>}
 */
async function getLeads() {
  if (isCloud) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase fetch failed: ${response.status} - ${errText}`);
    }

    return await response.json();
  } else {
    await initLocalDb();
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const leads = JSON.parse(data || '[]');
    // Sort descending by created_at or id
    return leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

/**
 * Updates properties of a lead, merging metadata changes.
 * @param {string|number} id The lead ID
 * @param {object} updates Field updates (e.g. crm_stage, metadata)
 * @returns {Promise<object>} The updated lead
 */
async function updateLead(id, updates) {
  if (isCloud) {
    // Fetch current lead to merge metadata
    const fetchResponse = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch lead for merge: ${fetchResponse.status}`);
    }

    const currentLeads = await fetchResponse.json();
    if (currentLeads.length === 0) {
      throw new Error(`Lead with ID ${id} not found.`);
    }

    const current = currentLeads[0];
    
    // Build actual PATCH request
    const patchBody = {};
    if (updates.crm_stage !== undefined) patchBody.crm_stage = updates.crm_stage;
    
    // Merge metadata if present
    if (updates.metadata !== undefined) {
      patchBody.metadata = {
        ...(current.metadata || {}),
        ...updates.metadata
      };
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase patch failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data[0];
  } else {
    await initLocalDb();
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const leads = JSON.parse(data || '[]');
    const numericId = Number(id);
    
    const leadIndex = leads.findIndex(l => Number(l.id) === numericId);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found.`);
    }

    const current = leads[leadIndex];
    if (updates.crm_stage !== undefined) {
      current.crm_stage = updates.crm_stage;
    }

    // Merge metadata
    if (updates.metadata !== undefined) {
      current.metadata = {
        ...(current.metadata || {}),
        ...updates.metadata
      };
    }

    leads[leadIndex] = current;
    await fs.writeFile(DB_FILE, JSON.stringify(leads, null, 2), 'utf-8');
    return current;
  }
}

module.exports = {
  isCloud,
  insertLead,
  getLeads,
  updateLead
};
