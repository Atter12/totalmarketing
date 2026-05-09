/**
 * Guarda o actualiza un lead. Preferencia: upsert por session_id.
 * Si la tabla aún no tiene esas columnas, intenta ALTER (Supabase suele permitirlo).
 * Si no hay permisos, guarda en modo legacy: actualiza por WhatsApp + país o inserta.
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

function isSchemaRelatedError(err) {
  const c = err && err.code;
  if (c === '42703' || c === '42P10') return true;
  const msg = String((err && err.message) || '');
  return /session_id|last_step|"status"|no unique or exclusion constraint matching/i.test(msg);
}

let schemaEnsured = false;

/** Intenta alinear la tabla con supabase/schema.sql (idempotente). */
async function ensureLeadsSchema(p) {
  if (schemaEnsured) return;
  await p.query(`
    alter table public.leads add column if not exists session_id text;
    alter table public.leads add column if not exists status text not null default 'incompleto';
    alter table public.leads add column if not exists last_step smallint;
    alter table public.leads add column if not exists updated_at timestamptz not null default now();
  `);
  await p.query(`
    create unique index if not exists leads_session_id_uidx on public.leads (session_id);
  `);
  schemaEnsured = true;
}

const UPSERT_SQL = `
  insert into public.leads
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
  returning id, status`;

async function upsertBySession(p, fields, session_id) {
  const r = await p.query(UPSERT_SQL, [
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
  ]);
  return { id: r.rows[0].id, status: r.rows[0].status };
}

/** Sin columnas nuevas: una fila por WhatsApp+país (última actualizada). */
async function saveLegacy(p, fields) {
  const w = fields.whatsapp;
  const c = fields.country;

  if (w) {
    const sel = await p.query(
      `select id from public.leads
       where whatsapp = $1 and (country is not distinct from $2)
       order by created_at desc nulls last
       limit 1`,
      [w, c]
    );
    if (sel.rows.length) {
      const id = sel.rows[0].id;
      await p.query(
        `update public.leads set
          nombre = coalesce($1, nombre),
          apellido = coalesce($2, apellido),
          country = coalesce($3, country),
          whatsapp = coalesce($4, whatsapp),
          email = coalesce($5, email),
          anuncios = coalesce($6, anuncios),
          ecommerce = coalesce($7, ecommerce),
          presupuesto = coalesce($8, presupuesto),
          compromiso = coalesce($9, compromiso),
          calificado = case when $12::text = 'completo' then $10::boolean else calificado end,
          puntos = greatest(coalesce($11, 0), coalesce(puntos, 0))
        where id = $13`,
        [
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
          fields.status,
          id,
        ]
      );
      return { id, status: fields.status };
    }
  }

  const ins = await p.query(
    `insert into public.leads
      (nombre, apellido, country, whatsapp, email, anuncios, ecommerce, presupuesto, compromiso, calificado, puntos)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning id`,
    [
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
    ]
  );
  return { id: ins.rows[0].id, status: fields.status };
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

  const p = getPool();

  try {
    const row = await upsertBySession(p, fields, session_id);
    return res.status(200).json({ ok: true, id: row.id, status: row.status });
  } catch (err) {
    if (!isSchemaRelatedError(err)) {
      console.error('submit', err);
      return res.status(500).json({ error: 'save_failed' });
    }
    try {
      await ensureLeadsSchema(p);
      const row = await upsertBySession(p, fields, session_id);
      return res.status(200).json({ ok: true, id: row.id, status: row.status });
    } catch (err2) {
      console.warn('submit: migración automática o upsert falló, modo legacy:', err2.message);
      try {
        const row = await saveLegacy(p, fields);
        return res.status(200).json({
          ok: true,
          id: row.id,
          status: row.status,
          mode: 'legacy',
        });
      } catch (err3) {
        console.error('submit', err3);
        return res.status(500).json({ error: 'save_failed' });
      }
    }
  }
};
