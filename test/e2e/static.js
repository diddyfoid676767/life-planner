const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2], types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  fs.readFile(f, (e, b) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); r.end(b); }); }).listen(47960);
