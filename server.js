// ============================================================================
//  server.js — TriviaDuel local static server (zero dependencies)
//
//  Serves the whole project folder on http://localhost:8080 so you can test
//  the app exactly like it would run on Vercel (this also fixes the manifest
//  CORS warning you see when opening index.html directly via file://).
//
//  Usage:   node server.js
//  Then:    open http://localhost:8080
// ============================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";

      // keep every path inside the project folder
      const filePath = path.normalize(path.join(ROOT, urlPath));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        return res.end("Forbidden");
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          return res.end("Not found: " + urlPath);
        }
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        res.end(data);
      });
    } catch (e) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
    }
  })
  .listen(PORT, () => {
    console.log("TriviaDuel is running at http://localhost:" + PORT);
    console.log("Press Ctrl+C to stop the server.");
  });
