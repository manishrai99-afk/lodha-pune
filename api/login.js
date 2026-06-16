/**
 * Vercel Serverless Function: POST /api/login — Enterprise RBAC Edition
 * 
 * Verifies username and password and returns stateless base64 session token.
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

// ==================== USER ACCOUNTS CONFIG ====================
const ACCOUNTS = {
  admin: { password: process.env.ADMIN_PASS || "admin24k", role: "admin", name: "Admin Manager" },
  manish: { password: process.env.MANISH_PASS || "manish24k", role: "broker", name: "Manish" },
  amit: { password: process.env.AMIT_PASS || "amit24k", role: "broker", name: "Amit" },
  priya: { password: process.env.PRIYA_PASS || "priya24k", role: "broker", name: "Priya" }
};

module.exports = async (req, res) => {
  // Set CORS headers
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

  try {
    const body = req.body && Object.keys(req.body).length ? req.body : await readJsonBody(req);
    const username = (body.username || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    const account = ACCOUNTS[username];

    if (account && account.password === password) {
      // Generate stateless base64 session token
      const userPayload = { username, role: account.role, name: account.name };
      const token = Buffer.from(JSON.stringify(userPayload)).toString('base64');

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        status: 'success', 
        token, 
        role: account.role, 
        name: account.name 
      }));
    } else {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid username or password' }));
    }
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
