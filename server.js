/**
 * InstaBuilt — local dev server (node server.js).
 *
 * Serves the static site AND the AI agent endpoint, so the chatbot works
 * locally exactly like it does on Vercel:
 *
 *   GET  /...          → static files (index.html, css, js, images, ...)
 *   POST /api/agent    → the same serverless handler as api/agent.js
 *
 * Reads GROQ_API_KEY / GROQ_MODEL from .env (gitignored). Zero dependencies —
 * plain Node, no install needed. Usage:
 *
 *   node server.js            → http://localhost:8124
 *   node server.js 3000       → http://localhost:3000
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8124;

// ---- minimal .env loader (no dependencies) ----
(function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch (e) { /* no .env — GROQ_API_KEY must come from the environment */ }
})();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.pdf': 'application/pdf',
};

// Vercel-style res wrapper: api/agent.js uses res.status(...).json(...)
function wrapRes(realRes) {
  const wrapper = {
    setHeader: (k, v) => realRes.setHeader(k, v),
    status: (code) => {
      realRes.statusCode = code;
      return wrapper;
    },
    json: (obj) => {
      realRes.setHeader('content-type', 'application/json; charset=utf-8');
      realRes.end(JSON.stringify(obj));
    },
  };
  return wrapper;
}

async function handleAgent(req, res) {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    let body = raw ? raw : '{}';
    try { body = JSON.parse(raw || '{}'); } catch (e) { body = raw; } // handler tolerates strings
    req.body = body;
    try {
      const handler = require(path.join(ROOT, 'api', 'agent.js'));
      await handler(req, wrapRes(res));
    } catch (err) {
      console.error('[server] /api/agent failed:', err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'Local agent error: ' + (err && err.message) }));
      }
    }
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (err2, st2) => {
        if (err2 || !st2.isFile()) return send404(res, urlPath);
        sendFile(res, filePath);
      });
      return;
    }
    if (err || !st.isFile()) return send404(res, urlPath);
    sendFile(res, filePath);
  });
}

function send404(res, urlPath) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found: ' + urlPath);
}

function sendFile(res, filePath) {
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (url === '/api/agent' || url === '/api/agent/') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json', Allow: 'POST' });
      res.end(JSON.stringify({ error: 'Method not allowed.' }));
      return;
    }
    handleAgent(req, res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    res.end('Method not allowed.');
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('InstaBuilt local server:');
  console.log('  Site:   http://localhost:' + PORT);
  console.log('  Agent:  POST http://localhost:' + PORT + '/api/agent');
  console.log('  Key:    ' + (process.env.GROQ_API_KEY ? 'GROQ_API_KEY found (' + (process.env.GROQ_MODEL || 'default model') + ')' : 'GROQ_API_KEY MISSING — copy .env.example to .env'));
  console.log('  Tip:    open http://localhost:' + PORT + ' in your browser (not file://)');
});
