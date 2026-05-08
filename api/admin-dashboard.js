/**
 * Panel /admin: lectura directa de leads, sin clave ni sesión.
 * Cualquiera con la URL puede ver los datos → si necesitas privacidad,
 * usa "Deployment Protection" en Vercel u oculta la ruta.
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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-LA', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

module.exports = async (req, res) => {
  let rows = [];
  try {
    const r = await getPool().query(
      `select * from public.leads order by created_at desc limit 1000`
    );
    rows = r.rows;
  } catch (e) {
    console.error('admin-dashboard query', e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 500;
    return res.end(
      `<!doctype html><meta charset="utf-8"/><title>Error</title><body style="background:#111;color:#fff;font-family:sans-serif;padding:40px"><p>No se pudo leer la base de datos. Ejecuta <code>supabase/schema.sql</code> y revisa <code>DATABASE_URL</code> en Vercel.</p><p><a href="/">← Inicio</a></p></body>`
    );
  }

  const n = rows.length;
  const ok = rows.filter((x) => x.calificado === true).length;
  const no = n - ok;
  const sum = rows.reduce((a, r) => a + (Number(r.puntos) || 0), 0);
  const avg = n ? (sum / n).toFixed(1) : '0';

  const tableRows = rows
    .map((r) => {
      const nm = [r.nombre, r.apellido].filter(Boolean).join(' ') || '—';
      const wa = [r.country, r.whatsapp].filter(Boolean).join(' ') || '—';
      const pill =
        r.calificado === true
          ? '<span style="padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(25,195,125,.15);color:#5ee9a8">Apto</span>'
          : '<span style="padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,43,94,.12);color:#ff8fa8">No</span>';
      return `<tr>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(fmtDate(r.created_at))}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(nm)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(r.email || '—')}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(wa)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(r.country || '—')}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${pill}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(String(r.puntos ?? '—'))}</td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${escapeHtml(r.presupuesto || '—')}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<meta http-equiv="refresh" content="60"/>
<title>Admin — Leads Holistic Marketing</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100%;background:#030508;color:#e8ecf1;font-family:'Inter',system-ui,sans-serif;padding:24px}
  :root{--cyan:#3FF8E3;--pink:#ff5b86;--line:rgba(63,248,227,.2);--card:#0c1018;--muted:#8b95a5}
  .head{max-width:1400px;margin:0 auto 22px;padding-bottom:18px;border-bottom:1px solid var(--line)}
  h1{font-size:clamp(20px,3vw,26px);font-weight:800}
  h1 span{background:linear-gradient(135deg,var(--cyan),var(--pink));-webkit-background-clip:text;background-clip:text;color:transparent}
  .stats{max-width:1400px;margin:0 auto 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 16px}
  .stat label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}
  .stat b{font-size:26px;font-weight:800;background:linear-gradient(135deg,#fff,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  .wrap{max-width:1400px;margin:0 auto;overflow:auto;border-radius:14px;border:1px solid var(--line);background:var(--card)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{padding:12px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:rgba(63,248,227,.04);border-bottom:1px solid rgba(255,255,255,.06)}
  tr:hover td{background:rgba(63,248,227,.04)}
  .foot{margin-top:18px;text-align:center;font-size:13px;color:var(--muted)}
  .foot a{color:var(--cyan)}
</style>
</head>
<body>
  <header class="head">
    <h1>Dashboard <span>Leads</span> · Holistic Marketing</h1>
    <p style="margin-top:10px;color:var(--muted);font-size:14px">Actualización automática cada 60 s · Datos desde tu base.</p>
  </header>
  <div class="stats">
    <div class="stat"><label>Total registros</label><b>${n}</b></div>
    <div class="stat"><label>Calificados</label><b>${ok}</b></div>
    <div class="stat"><label>No calificados</label><b>${no}</b></div>
    <div class="stat"><label>Promedio puntos</label><b>${avg}</b></div>
  </div>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Nombre</th><th>Email</th><th>WhatsApp</th><th>País</th><th>Estado</th><th>Puntos</th><th>Presupuesto</th>
        </tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--muted)">Sin registros todavía.</td></tr>'}</tbody>
    </table>
  </div>
  <p class="foot"><a href="/">← Volver al sitio</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  return res.end(html);
};
