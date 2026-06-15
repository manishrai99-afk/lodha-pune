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
