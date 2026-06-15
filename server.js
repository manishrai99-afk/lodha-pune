/**
 * Lodha Pune Local Development Server
 * 
 * Provides a lightweight HTTP server for local development and testing.
 * Features:
 * - Static file serving (HTML, CSS, JS, images)
 * - Optional Basic Auth for /admin.html (via ADMIN_USER/ADMIN_PASS env vars)
 * - Local proxy endpoint /api/leads-proxy for testing serverless function
 * 
 * Run: node server.js
 * Optional env vars: ADMIN_USER, ADMIN_PASS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 
 * NOTE: This server is for LOCAL DEVELOPMENT ONLY.
 * For production, deploy to Vercel (static site + serverless functions).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const https = require('https');

const server = http.createServer((request, response) => {
  let pathname = decodeURIComponent((request.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";

  // Basic auth for admin page when ADMIN_USER and ADMIN_PASS are set in env
  const adminUser = process.env.ADMIN_USER || "";
  const adminPass = process.env.ADMIN_PASS || "";
  const authEnabled = adminUser && adminPass;
  const requiresAdminAuth = authEnabled && (pathname === "/admin.html" || pathname.startsWith("/admin"));

  if (requiresAdminAuth) {
    const auth = request.headers.authorization || "";
    const expected = "Basic " + Buffer.from(`${adminUser}:${adminPass}`).toString("base64");
    if (auth !== expected) {
      response.writeHead(401, { "WWW-Authenticate": 'Basic realm="Admin Area"' });
      response.end("Authentication required");
      return;
    }
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  // Local serverless-like proxy: POST /api/leads-proxy -> forward to Supabase using service_role key
  if (pathname === '/api/leads-proxy' && request.method === 'POST') {
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }));
      return;
    }

    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        const supabaseUrl = new URL(`${SUPABASE_URL}/rest/v1/leads`);
        const opts = {
          hostname: supabaseUrl.hostname,
          path: supabaseUrl.pathname + (supabaseUrl.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          }
        };

        const prox = https.request(opts, (supRes) => {
          let respData = '';
          supRes.on('data', (c) => { respData += c; });
          supRes.on('end', () => {
            response.writeHead(supRes.statusCode || 200, { 'Content-Type': 'application/json' });
            response.end(respData || JSON.stringify({ status: 'ok' }));
          });
        });

        prox.on('error', (err) => {
          response.writeHead(502, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: err.message }));
        });

        prox.write(body);
        prox.end();
      } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: err.message }));
      }
    });

    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`24K Realtors preview: http://${host}:${port}/`);
});
