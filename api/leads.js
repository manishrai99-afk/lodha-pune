/**
 * Vercel Serverless Function: GET/PATCH/POST /api/leads
 * 
 * Secure entry point for managing leads in production.
 * - POST /api/leads: Insert a lead (public, no auth required)
 * - GET /api/leads: Fetch all leads (admin only, requires AUTHORIZATION header)
 * - PATCH /api/leads: Update lead stage (admin only, requires AUTHORIZATION header)
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
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin24k';

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
  const authHeader = req.headers['authorization'] || '';
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Query parameter token fallback (e.g., for direct links or custom scripts)
  if (!token) {
    try {
      const parsedUrl = new URL(req.url || '', 'http://localhost');
      token = parsedUrl.searchParams.get('token') || '';
    } catch (e) {
      // Ignore URL parse error
    }
  }

  if (token !== ADMIN_PASS) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // 2. GET -> Fetch Leads (Admin)
  if (req.method === 'GET') {
    try {
      const response = await localFetch(`${SUPABASE_URL}/rest/v1/leads?order=created_at.desc`, {
        method: 'GET',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });

      const data = await response.json();
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('[leads-api] GET error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. PATCH -> Update Lead Stage and Metadata (Admin)
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

      // Fetch current lead from Supabase to merge metadata
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
        res.end(JSON.stringify({ error: `Failed to fetch lead for merge: ${fetchResponse.status}` }));
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

      // Build updates object
      const patchBody = {};
      if (stage !== undefined) patchBody.crm_stage = stage;
      if (metadata !== undefined) {
        patchBody.metadata = {
          ...(current.metadata || {}),
          ...metadata
        };
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
