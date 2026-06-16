/**
 * Vercel Serverless Function: GET/PATCH/POST /api/leads — Enterprise RBAC Edition
 * 
 * Secure entry point for managing leads in production on Vercel.
 * - POST /api/leads: Submit Lead (Public, no auth)
 * - GET /api/leads: Fetch Leads (Protected, Admin gets all, Broker gets assigned only)
 * - PATCH /api/leads: Update Lead (Protected, Brokers restricted from changing assignments)
 */

const readJsonBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (err) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
};

const getFetch = async () => {
  if (typeof fetch === 'function') return fetch;
  const undici = await import('undici');
  return undici.fetch;
};

// ==================== USER ACCOUNTS CONFIG ====================
const ACCOUNTS = {
  admin: { password: process.env.ADMIN_PASS || "admin24k", role: "admin", name: "Admin Manager" },
  manish: { password: process.env.MANISH_PASS || "manish24k", role: "broker", name: "Manish" },
  amit: { password: process.env.AMIT_PASS || "amit24k", role: "broker", name: "Amit" },
  priya: { password: process.env.PRIYA_PASS || "priya24k", role: "broker", name: "Priya" }
};

/**
 * Extract user session context from token
 */
function getUserContext(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Query parameter token fallback
  if (!token) {
    try {
      const parsedUrl = new URL(req.url || '', 'http://localhost');
      token = parsedUrl.searchParams.get('token') || '';
    } catch (e) {}
  }

  if (!token) return null;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const user = JSON.parse(decoded);
    
    const account = ACCOUNTS[user.username];
    if (account && account.role === user.role && account.name === user.name) {
      return user;
    }
  } catch (e) {}
  
  return null;
}

module.exports = async (req, res) => {
  console.log('[leads-api] Method:', req.method);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server misconfigured: missing Supabase env vars' }));
    return;
  }

  const localFetch = await getFetch();

  // 1. POST -> Insert lead (Public)
  if (req.method === 'POST') {
    try {
      const body = req.body && Object.keys(req.body).length ? req.body : await readJsonBody(req);
      
      const cleanLead = {
        name: body.name || '',
        phone: body.phone || '',
        requirement: body.requirement || '',
        budget: body.budget || '',
        timeline: body.timeline || '',
        crm_stage: body.crm_stage || 'new',
        lead_source: body.lead_source || 'website',
        lead_series: body.lead_series || body.utm_campaign || 'website',
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_term: body.utm_term || null,
        utm_content: body.utm_content || null,
        landing_page: body.landing_page || null,
        referrer: body.referrer || null,
        metadata: body.metadata || {}
      };

      const response = await localFetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(cleanLead)
      });

      const text = await response.text();
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(text || JSON.stringify({ status: 'ok' }));
    } catch (err) {
      console.error('[leads-api] POST error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Authentication check for GET/PATCH
  const user = getUserContext(req);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // 2. GET -> Fetch Leads List (Protected & Role Filtered)
  if (req.method === 'GET') {
    try {
      const response = await localFetch(`${SUPABASE_URL}/rest/v1/leads?order=created_at.desc`, {
        method: 'GET',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });

      if (!response.ok) {
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(await response.text());
        return;
      }

      const allLeads = await response.json();
      
      // Filter list based on role
      let filteredLeads = [];
      if (user.role === 'admin') {
        filteredLeads = allLeads;
      } else if (user.role === 'broker') {
        // Brokers only see leads assigned to them (case-insensitive check)
        filteredLeads = allLeads.filter(lead => {
          const assigned = lead.metadata && lead.metadata.assigned_to;
          return assigned && assigned.toLowerCase() === user.name.toLowerCase();
        });
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(filteredLeads));
    } catch (err) {
      console.error('[leads-api] GET error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. PATCH -> Update Lead (Protected & Restricted)
  if (req.method === 'PATCH') {
    try {
      const body = req.body && Object.keys(req.body).length ? req.body : await readJsonBody(req);
      const { id, stage, metadata } = body;

      if (!id) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing id parameter' }));
        return;
      }

      // Fetch current lead from Supabase to check role permission
      const fetchResponse = await localFetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
        method: 'GET',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });

      if (!fetchResponse.ok) {
        res.statusCode = fetchResponse.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Failed to fetch lead for authorization check` }));
        return;
      }

      const currentLeads = await fetchResponse.json();
      if (currentLeads.length === 0) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Lead with ID ${id} not found.` }));
        return;
      }

      const current = currentLeads[0];
      const patchBody = {};

      if (user.role === 'admin') {
        // Admin can update everything
        if (stage !== undefined) patchBody.crm_stage = stage;
        if (metadata !== undefined) {
          patchBody.metadata = {
            ...(current.metadata || {}),
            ...metadata
          };
        }
      } else if (user.role === 'broker') {
        // Brokers can only modify leads assigned to them
        const assignedTo = current.metadata && current.metadata.assigned_to;
        if (!assignedTo || assignedTo.toLowerCase() !== user.name.toLowerCase()) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Forbidden: You do not own this lead.' }));
          return;
        }

        // Brokers can update stage, notes, and tasks, but CANNOT change broker assignment
        if (stage !== undefined) patchBody.crm_stage = stage;
        if (metadata !== undefined) {
          // Block broker assignment updates by stripping the property
          const { assigned_to, ...allowedMetadata } = metadata;
          patchBody.metadata = {
            ...(current.metadata || {}),
            ...allowedMetadata
          };
        }
      }

      const response = await localFetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(patchBody)
      });

      const data = await response.json();
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data[0] || {}));
    } catch (err) {
      console.error('[leads-api] PATCH error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Method not allowed' }));
};
