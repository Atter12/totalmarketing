/**
 * Elimina leads por id (panel /admin). POST { "ids": ["uuid", ...] }
 */
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const conn = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!conn) throw new Error('Missing DATABASE_URL or DIRECT_URL');
    pool = new Pool({
      connectionString: conn,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return pool;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIds(body) {
  const raw = body && body.ids;
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < raw.length && out.length < 500; i++) {
    const id = String(raw[i] || '').trim().toLowerCase();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return res.status(400).json({ error: 'invalid_json' });
    }
  }

  const ids = parseIds(body || {});
  if (!ids.length) {
    return res.status(400).json({ error: 'no_valid_ids' });
  }

  try {
    const p = getPool();
    const r = await p.query(`delete from public.leads where id = any($1::uuid[])`, [ids]);
    return res.status(200).json({ ok: true, deleted: r.rowCount ?? 0 });
  } catch (err) {
    console.error('admin-delete', err);
    return res.status(500).json({ error: 'delete_failed' });
  }
};
