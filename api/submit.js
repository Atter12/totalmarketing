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

  const {
    nombre,
    apellido,
    country,
    whatsapp,
    email,
    anuncios,
    ecommerce,
    presupuesto,
    compromiso,
    calificado,
    puntos,
  } = body || {};

  try {
    const p = getPool();
    const r = await p.query(
      `insert into public.leads (
        nombre, apellido, country, whatsapp, email,
        anuncios, ecommerce, presupuesto, compromiso, calificado, puntos
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      returning id`,
      [
        nombre ?? null,
        apellido ?? null,
        country ?? null,
        whatsapp ?? null,
        email ?? null,
        anuncios ?? null,
        ecommerce ?? null,
        presupuesto ?? null,
        !!compromiso,
        !!calificado,
        Number.isFinite(Number(puntos)) ? Number(puntos) : 0,
      ]
    );
    return res.status(200).json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    console.error('submit', err);
    return res.status(500).json({ error: 'save_failed' });
  }
};
