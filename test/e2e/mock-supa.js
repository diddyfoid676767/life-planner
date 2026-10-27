// a stand-in for the Supabase server: auth, and the planner_data row with
// conditional updates like PostgREST. GET /__row reads it, POST /__row sets it.
const http = require('http');
let row = null, n = 0;
const stamp = () => { n++; const d = new Date(Date.now() + n); return d.toISOString().replace('Z', '') + String(n % 1000).padStart(3, '0') + '+00:00'; };
const log = [];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let body = '';
  req.on('data', c => body += c); req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.end();
    const send = (code, v) => { res.statusCode = code; res.end(JSON.stringify(v)); };
    if (u.pathname === '/__row') { if (req.method === 'POST') { row = body ? { ...JSON.parse(body), updated_at: stamp() } : null; } return send(200, { row, log }); }
    if (u.pathname.startsWith('/auth/')) return send(200, { access_token: 'acc', refresh_token: 'ref', expires_in: 3600, user: { id: 'u1' } });
    if (u.pathname === '/rest/v1/planner_data') {
      const sel = u.searchParams.get('select') || '', out = () => row ? [sel.includes('data') ? { data: row.data, updated_at: row.updated_at } : { updated_at: row.updated_at }] : [];
      const b = body ? JSON.parse(body) : null;
      if (req.method !== 'GET') log.push(req.method + ' ' + (b && b.device));
      if (req.method === 'GET') return send(200, out());
      if (req.method === 'POST') {
        if (row && !(req.headers.prefer || '').includes('merge-duplicates')) return send(409, { message: 'duplicate key value' });
        row = { data: b.data, device: b.device, updated_at: stamp() }; return send(201, out());
      }
      if (req.method === 'PATCH') {
        if (!row || u.searchParams.get('updated_at') !== 'eq.' + row.updated_at) return send(200, []);
        row = { data: b.data, device: b.device, updated_at: stamp() }; return send(200, out());
      }
    }
    if (req.method === 'GET') return send(200, []);
    send(200, []);
  });
}).listen(47950, () => console.log('mock on 47950'));
