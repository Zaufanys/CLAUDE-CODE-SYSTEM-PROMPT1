// Minimal static file server for the public/ directory. Zero dependencies.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public");
const port = process.env.PORT || 4173;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(root, decodeURIComponent(requested));

    // Prevent path traversal outside of the served root.
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(filePath)] || "text/plain"
      });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`running at http://localhost:${port}`));
