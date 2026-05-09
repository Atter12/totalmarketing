/** Inserta un evento (clics, vistas, etc.). Crea la tabla si aún no existe. */
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

let eventsTableEnsured = false;

async function ensureEventsTable(p) {
  if (eventsTableEnsured) return;
  await p.query(`
    create table if not exists public.events (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      type text not null,
      session_id text,
      meta jsonb
    )
  `);
  await p.query(`
    create index if not exists events_type_idx on public.events (type)
  `);
  await p.query(`
    create index if not exists events_created_at_idx on public.events (created_at desc)
  `);
  eventsTableEnsured = true;
}

async function insertEvent(p, type, session_id, meta) {
  await p.query(`insert into public.events (type, session_id, meta) values ($1, $2, $3)`, [
    type,
    session_id,
    meta,
  ]);
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
  body = body || {};

  const type = String(body.type || '').toLowerCase();
  if (!ALLOWED.has(type)) {
    return res.status(400).json({ error: 'invalid_type' });
  }
  const session_id = body.session_id ? String(body.session_id).slice(0, 80) : null;
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : null;

  const p = getPool();

  try {
    await insertEvent(p, type, session_id, meta);
    return res.status(200).json({ ok: true });
  } catch (err) {
    const missingTable = err.code === '42P01';
    const missingRelation = /relation .* does not exist/i.test(err.message || '');
    if (missingTable || missingRelation) {
      try {
        await ensureEventsTable(p);
        await insertEvent(p, type, session_id, meta);
        return res.status(200).json({ ok: true });
      } catch (err2) {
        console.error('track: could not create or use events table:', err2.message);
        /* No romper la landing: el clic ya ocurrió en el cliente */
        return res.status(200).json({ ok: true, deferred: true });
      }
    }
    console.error('track', err);
    return res.status(200).json({ ok: true, deferred: true });
  }
};
