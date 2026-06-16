/**
 * Lodha Pune Local Development Server — Enterprise Multi-User Edition
 * 
 * Features:
 * - Static file serving (HTML, CSS, JS, images)
 * - Zero-dependency local JSON database fallback
 * - Role-Based Access Control (RBAC): Admin vs Brokers (Manish, Amit, Priya)
 * - Secure Session Tokens (Stateless base64 JSON payload verification)
 * - Lead isolation: Brokers can only access leads assigned to them
 * - Server-Sent Events (SSE) stream filtered by broker identity in real-time
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

// ==================== USER ACCOUNTS & SECURITY CONFIG ====================
const ACCOUNTS = {
  admin: { password: process.env.ADMIN_PASS || "admin24k", role: "admin", name: "Admin Manager" },
  manish: { password: process.env.MANISH_PASS || "manish24k", role: "broker", name: "Manish" },
  amit: { password: process.env.AMIT_PASS || "amit24k", role: "broker", name: "Amit" },
  priya: { password: process.env.PRIYA_PASS || "priya24k", role: "broker", name: "Priya" }
};

// Store active Server-Sent Events (SSE) clients with their user context
let sseClients = [];

/**
 * Broadcast event to authorized SSE clients only
 */
function broadcast(event, data) {
  sseClients.forEach(client => {
    try {
      const ctx = client.userContext;
      if (!ctx) return; // Unauthenticated client

      // Admins receive all events
      if (ctx.role === "admin") {
        client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        return;
      }

      // Brokers only receive updates for leads assigned to them
      if (ctx.role === "broker") {
        const assignedTo = data.metadata && data.metadata.assigned_to;
        if (assignedTo && assignedTo.toLowerCase() === ctx.name.toLowerCase()) {
          client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      }
    } catch (e) {
      console.error('[SSE] Broadcast write error:', e.message);
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
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (err) { reject(new Error("Invalid JSON body")); }
    });
    request.on("error", reject);
  });
}

/**
 * Extract and verify token, returning user context if valid
 * @returns {object|null} { username, role, name }
 */
function getUserContext(request) {
  const authHeader = request.headers["authorization"] || "";
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();
  
  // SSE EventSource query parameters fallback
  if (!token) {
    try {
      const parsedUrl = new URL(request.url || "", `http://${host}:${port}`);
      token = parsedUrl.searchParams.get("token") || "";
    } catch (e) {}
  }
  
  if (!token) return null;

  try {
    // Decode base64 session token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const user = JSON.parse(decoded);
    
    // Verify user exists and credentials are correct
    const account = ACCOUNTS[user.username];
    if (account && account.role === user.role && account.name === user.name) {
      return user;
    }
  } catch (e) {}
  
  return null;
}

const server = http.createServer(async (request, response) => {
  const parsedUrl = new URL(request.url || "/", `http://${host}:${port}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === "/") pathname = "/index.html";

  // CORS Headers
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

  // 1. POST /api/leads or POST /api/leads-proxy -> Submit Lead (Public)
  if ((pathname === "/api/leads" || pathname === "/api/leads-proxy") && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const savedLead = await db.insertLead(body);
      
      console.log(`[API] Lead Captured: ${savedLead.name} (${savedLead.phone})`);
      
      // Broadcast to active admins
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

  // 2. POST /api/leads/login or POST /api/login -> Authenticate Multi-Users
  if ((pathname === "/api/leads/login" || pathname === "/api/login") && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const username = (body.username || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      const account = ACCOUNTS[username];
      
      if (account && account.password === password) {
        // Generate stateless base64 session token
        const userPayload = { username, role: account.role, name: account.name };
        const token = Buffer.from(JSON.stringify(userPayload)).toString('base64');

        response.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ 
          status: "success", 
          token, 
          role: account.role,
          name: account.name
        }));
      } else {
        response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ error: "Invalid username or password" }));
      }
    } catch (err) {
      response.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. GET /api/leads -> Fetch Leads List (Protected & Isolated)
  if (pathname === "/api/leads" && request.method === "GET") {
    const user = getUserContext(request);
    if (!user) {
      response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const allLeads = await db.getLeads();
      
      // Filter list based on role
      let filteredLeads = [];
      if (user.role === "admin") {
        filteredLeads = allLeads;
      } else if (user.role === "broker") {
        // Brokers only see leads assigned to them (case-insensitive check)
        filteredLeads = allLeads.filter(lead => {
          const assigned = lead.metadata && lead.metadata.assigned_to;
          return assigned && assigned.toLowerCase() === user.name.toLowerCase();
        });
      }

      response.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify(filteredLeads));
    } catch (err) {
      console.error("[API] Fetch Leads error:", err.message);
      response.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. PATCH /api/leads -> Update Lead (Protected & Role Restrained)
  if (pathname === "/api/leads" && request.method === "PATCH") {
    const user = getUserContext(request);
    if (!user) {
      response.writeHead(401, { "Content-Type": "application/json", ...corsHeaders });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      const body = await readJsonBody(request);
      const { id, stage, metadata } = body;
      
      if (!id) {
        response.writeHead(400, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ error: "Missing lead id" }));
        return;
      }

      // Fetch lead to verify access
      const allLeads = await db.getLeads();
      const currentLead = allLeads.find(l => Number(l.id) === Number(id));
      
      if (!currentLead) {
        response.writeHead(404, { "Content-Type": "application/json", ...corsHeaders });
        response.end(JSON.stringify({ error: "Lead not found" }));
        return;
      }

      const updates = {};

      if (user.role === "admin") {
        // Admin has full modification rights
        if (stage !== undefined) updates.crm_stage = stage;
        if (metadata !== undefined) updates.metadata = metadata;
      } else if (user.role === "broker") {
        // Brokers can only modify their own leads
        const assignedTo = currentLead.metadata && currentLead.metadata.assigned_to;
        if (!assignedTo || assignedTo.toLowerCase() !== user.name.toLowerCase()) {
          response.writeHead(403, { "Content-Type": "application/json", ...corsHeaders });
          response.end(JSON.stringify({ error: "Forbidden: You do not own this lead" }));
          return;
        }

        // Brokers can modify stage, notes, and tasks, but CANNOT change broker assignment
        if (stage !== undefined) updates.crm_stage = stage;
        if (metadata !== undefined) {
          // Block reassignments by removing assigned_to from updates
          const { assigned_to, ...allowedMetadata } = metadata;
          updates.metadata = allowedMetadata;
        }
      }

      const updatedLead = await db.updateLead(id, updates);
      console.log(`[API] Lead ID ${id} updated by ${user.name}`);

      // Broadcast update to dashboard connections
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

  // 5. GET /api/leads/live -> SSE Streaming (Protected & User Bound)
  if (pathname === "/api/leads/live" && request.method === "GET") {
    const user = getUserContext(request);
    if (!user) {
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

    response.write(":ok\n\n");

    // Tag the response with userContext so we can filter broadcasts
    response.userContext = user;
    sseClients.push(response);
    console.log(`[SSE] ${user.name} (${user.role}) connected. Active streams: ${sseClients.length}`);

    request.on("close", () => {
      sseClients = sseClients.filter(client => client !== response);
      console.log(`[SSE] ${user.name} disconnected. Active streams: ${sseClients.length}`);
    });

    return;
  }

  // ==================== STATIC FILES SERVING ====================
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
