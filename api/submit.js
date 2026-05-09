/**
 * Guarda o actualiza un lead. Hace upsert por session_id, así que cada paso
 * del formulario sobrescribe la fila correspondiente y los leads parciales
 * quedan registrados como "incompleto".
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

function clean(v) {
  if (v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return v;
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

  const session_id = clean(body.session_id);
  if (!session_id) {
    return res.status(400).json({ error: 'missing_session_id' });
  }

  const status = body.status === 'completo' ? 'completo' : 'incompleto';
  const last_step = Number.isFinite(Number(body.last_step)) ? Number(body.last_step) : null;
  const puntos = Number.isFinite(Number(body.puntos)) ? Number(body.puntos) : 0;

  const fields = {
    nombre: clean(body.nombre),
    apellido: clean(body.apellido),
    country: clean(body.country),
    whatsapp: clean(body.whatsapp),
    email: clean(body.email),
    anuncios: clean(body.anuncios),
    ecommerce: clean(body.ecommerce),
    presupuesto: clean(body.presupuesto),
    compromiso: typeof body.compromiso === 'boolean' ? body.compromiso : null,
    calificado: status === 'completo' ? !!body.calificado : false,
    puntos,
    last_step,
    status,
  };

  try {
    const p = getPool();
    const r = await p.query(
      `insert into public.leads
        (session_id, nombre, apellido, country, whatsapp, email,
         anuncios, ecommerce, presupuesto, compromiso, calificado, puntos,
         last_step, status, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       on conflict (session_id) do update set
         nombre      = coalesce(excluded.nombre,      public.leads.nombre),
         apellido    = coalesce(excluded.apellido,    public.leads.apellido),
         country     = coalesce(excluded.country,     public.leads.country),
         whatsapp    = coalesce(excluded.whatsapp,    public.leads.whatsapp),
         email       = coalesce(excluded.email,       public.leads.email),
         anuncios    = coalesce(excluded.anuncios,    public.leads.anuncios),
         ecommerce   = coalesce(excluded.ecommerce,   public.leads.ecommerce),
         presupuesto = coalesce(excluded.presupuesto, public.leads.presupuesto),
         compromiso  = coalesce(excluded.compromiso,  public.leads.compromiso),
         calificado  = case when excluded.status = 'completo' then excluded.calificado else public.leads.calificado end,
         puntos      = greatest(coalesce(excluded.puntos, 0), coalesce(public.leads.puntos, 0)),
         last_step   = greatest(coalesce(excluded.last_step, 0), coalesce(public.leads.last_step, 0)),
         status      = case when excluded.status = 'completo' then 'completo' else public.leads.status end,
         updated_at  = now()
       returning id, status`,
      [
        session_id,
        fields.nombre,
        fields.apellido,
        fields.country,
        fields.whatsapp,
        fields.email,
        fields.anuncios,
        fields.ecommerce,
        fields.presupuesto,
        fields.compromiso,
        fields.calificado,
        fields.puntos,
        fields.last_step,
        fields.status,
      ]
    );
    return res.status(200).json({ ok: true, id: r.rows[0].id, status: r.rows[0].status });
  } catch (err) {
    console.error('submit', err);
    return res.status(500).json({ error: 'save_failed' });
  }
};
