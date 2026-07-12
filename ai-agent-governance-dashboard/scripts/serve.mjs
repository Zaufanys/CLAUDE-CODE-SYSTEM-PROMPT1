// Minimal static file server for local development.
// Serves the `public/` directory (the same folder that ships to GitHub Pages),
// so what you see locally is exactly what deploys.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "public");
const port = Number(process.env.PORT) || 4175;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const fp = path.join(root, rel);

  // Contain every request inside `public/` — block path-traversal attempts.
  if (fp !== root && !fp.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "text/plain" });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`AI Agent Governance Dashboard running at http://localhost:${port}`);
  console.log(`  dashboard : http://localhost:${port}/`);
  console.log(`  mapping   : http://localhost:${port}/mapping.html`);
});
