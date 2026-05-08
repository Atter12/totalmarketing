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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'x-admin-key, Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const key = req.headers['x-admin-key'];
  const admin = process.env.ADMIN_KEY;
  if (!admin || key !== admin) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const p = getPool();
    const r = await p.query(
      `select * from public.leads order by created_at desc limit 1000`
    );
    return res.status(200).json({ leads: r.rows });
  } catch (err) {
    console.error('leads', err);
    return res.status(500).json({ error: 'list_failed' });
  }
};
