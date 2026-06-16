/**
 * Vercel Serverless Function: POST /api/leads-proxy
 * 
 * Purpose: Secure proxy for lead submission (Compatibility endpoint)
 * - Receives POST requests from frontend with lead data
 * - Forwards to Supabase using SUPABASE_SERVICE_ROLE_KEY (server-side only)
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
  console.log('[leads-proxy] invoked', req.method, req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
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

  try {
    const body = req.body && Object.keys(req.body).length ? req.body : await readJsonBody(req);
    
    if (!body || !Object.keys(body).length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Request body is empty or invalid JSON' }));
      return;
    }

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

    const localFetch = await getFetch();

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

    if (!response.ok) {
      console.error('[leads-proxy] Supabase error', response.status, text);
      res.end(JSON.stringify({ error: `Supabase insert failed ${response.status}`, details: text || undefined }));
      return;
    }

    res.end(text || JSON.stringify({ status: 'ok' }));
  } catch (err) {
    console.error('[leads-proxy] error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
