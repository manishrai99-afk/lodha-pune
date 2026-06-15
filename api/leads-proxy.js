// Vercel serverless function example: /api/leads-proxy
// Expects environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

const readJsonBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (jsonErr) {
        reject(new Error('Invalid JSON body')); 
      }
    });

    req.on('error', reject);
  });
};

const getFetch = async () => {
  if (typeof fetch === 'function') return fetch;
  const undici = await import('undici');
  if (typeof undici.fetch !== 'function') {
    throw new Error('Fetch is not available in this runtime');
  }
  return undici.fetch;
};

module.exports = async (req, res) => {
  console.log('[leads-proxy] invoked', req.method, req.url);

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
    const lead = req.body && Object.keys(req.body).length ? req.body : await readJsonBody(req);
    console.log('[leads-proxy] lead body:', lead && Object.keys(lead).length ? 'parsed' : 'empty');

    if (!lead || !Object.keys(lead).length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Request body is empty or invalid JSON' }));
      return;
    }

    const localFetch = await getFetch();

    const r = await localFetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(lead)
    });

    const text = await r.text();
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json');

    if (!r.ok) {
      console.error('[leads-proxy] supabase error', r.status, text);
      res.end(JSON.stringify({ error: `Supabase insert failed ${r.status}`, details: text || undefined }));
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
