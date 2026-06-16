/**
 * Lodha Pune Local Development Server
 * 
 * Features:
 * - Static file serving (HTML, CSS, JS, images)
 * - Local database integration (via database.js)
 * - Server-Sent Events (SSE) for real-time lead notifications
 * - Token auth check for secure CRM endpoints (default pass: admin24k)
 * 
 * Run: npm start OR node server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./database");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Store active Server-Sent Events (SSE) clients
let sseClients = [];

/**
 * Broadcast event and data to all SSE clients
 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {
      console.error('[SSE] Failed to write to client', e.message);
    }
  });
}

/**
 * Helper to read JSON request body
 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => { body += chunk.toString(); });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

/**
 * Helper to check password/token authorization
 */
function isAuthorized(request) {
  const ADMIN_PASS = process.env.ADMIN_PASS || "admin24k";
  const authHeader = request.headers["authorization"] || "";
  
  // Header format: Bearer <password> or just <password>
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();
  
  // SSE EventSource query fallback
  if (!token) {
    try {
      const parsedUrl = new URL(request.url || "", "http://localhost");
      token = parsedUrl.searchParams.get("token") || "";
    } catch (e) {
      // Ignore URL parse error
    }
  }
  
  return token === ADMIN_PASS;
}

const server = http.createServer(async (request, response) => {
  const parsedUrl = new URL(request.url || "/", `http://${host}:${port}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === "/") pathname = "/index.html";

  // Cors Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Pre-flight check
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  // ==================== API ENDPOINTS ====================

  // 1. POST /api/leads-proxy or POST /api/leads -> Insert Lead
  if ((pathname === "/api/leads-proxy" || pathname === "/api/leads") && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const savedLead = await db.insertLead(body);
      
      console.log(`[API] Saved Lead: ${savedLead.name} (${savedLead.phone})`);
      
      // Broadcast to any active admin dashboard listening via SSE
      broadcast("lead_insert", savedLead);

      response.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify(savedLead));
    } catch (err) {
      console.error("[API] Insert Lead error:", err.message);
      response.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. POST /api/leads/login -> Admin Dashboard Auth
  if (pathname === "/api/leads/login" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const ADMIN_PASS = process.env.ADMIN_PASS || "admin24k";
      
      if (body.password === ADMIN_PASS) {
        response.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ status: "success", token: ADMIN_PASS }));
      } else {
        response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ error: "Invalid password" }));
      }
    } catch (err) {
      response.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. GET /api/leads -> Fetch All Leads (Protected)
  if (pathname === "/api/leads" && request.method === "GET") {
    if (!isAuthorized(request)) {
      response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const leads = await db.getLeads();
      response.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify(leads));
    } catch (err) {
      console.error("[API] Fetch Leads error:", err.message);
      response.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. PATCH /api/leads -> Update Lead Stage and Metadata (Protected)
  if (pathname === "/api/leads" && request.method === "PATCH") {
    if (!isAuthorized(request)) {
      response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const body = await readJsonBody(request);
      const { id, stage, metadata } = body;
      
      if (!id) {
        response.writeHead(400, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ error: "Missing id parameter" }));
        return;
      }

      const updates = {};
      if (stage !== undefined) updates.crm_stage = stage;
      if (metadata !== undefined) updates.metadata = metadata;

      const updatedLead = await db.updateLead(id, updates);
      console.log(`[API] Lead ID ${id} updated.`);

      // Broadcast update to dashboards
      broadcast("lead_update", updatedLead);

      response.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify(updatedLead));
    } catch (err) {
      console.error("[API] Patch Lead error:", err.message);
      response.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. GET /api/leads/live -> Server-Sent Events for Live Dashboard (Protected)
  if (pathname === "/api/leads/live" && request.method === "GET") {
    if (!isAuthorized(request)) {
      response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Set headers for Event Stream
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...corsHeaders
    });

    // Send initial keep-alive comment
    response.write(":ok\n\n");

    // Add this response to active clients list
    sseClients.push(response);
    console.log(`[SSE] Client connected. Total clients: ${sseClients.length}`);

    // Remove client when request closes
    request.on("close", () => {
      sseClients = sseClients.filter(client => client !== response);
      console.log(`[SSE] Client disconnected. Total clients: ${sseClients.length}`);
    });

    return;
  }

  // ==================== STATIC FILES SERVING ====================

  // Basic auth fallback for /admin.html via old ADMIN_USER/ADMIN_PASS env (if explicitly set)
  const adminUser = process.env.ADMIN_USER || "";
  const adminPass = process.env.ADMIN_PASS || "";
  const basicAuthEnabled = adminUser && adminPass;
  const requiresBasicAuth = basicAuthEnabled && (pathname === "/admin.html" || pathname.startsWith("/admin-basic"));

  if (requiresBasicAuth) {
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

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`24K Realtors preview: http://${host}:${port}/`);
});
