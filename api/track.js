/** Inserta un evento (clics, vistas, etc.). Usado por la landing y /admin. */
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

const ALLOWED = new Set(['cta_click', 'page_view']);

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
  body = body || {};

  const type = String(body.type || '').toLowerCase();
  if (!ALLOWED.has(type)) {
    return res.status(400).json({ error: 'invalid_type' });
  }
  const session_id = body.session_id ? String(body.session_id).slice(0, 80) : null;
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : null;

  try {
    await getPool().query(
      `insert into public.events (type, session_id, meta) values ($1, $2, $3)`,
      [type, session_id, meta]
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('track', err);
    return res.status(500).json({ error: 'track_failed' });
  }
};
