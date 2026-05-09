/**
 * Dashboard /admin (lectura abierta, sin clave). Presenta:
 *  - Métricas: total, completos, incompletos, calificados, clics CTA
 *  - Tabla de leads con badge de estado
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

function presupuestoLabel(v) {
  return ({
    '0': 'Sin inversión',
    '1-500': '$1 a $500',
    '500-2000': '$500 a $2.000',
    '2000-5000': '$2.000 a $5.000',
    '5000+': 'Más de $5.000',
  })[v] || (v || '—');
}

module.exports = async (req, res) => {
  let rows = [];
  let ctaClicks = 0;
  try {
    const p = getPool();
    const [leadsR, ctaR] = await Promise.all([
      p.query(`select * from public.leads order by coalesce(updated_at, created_at) desc limit 1000`),
      p.query(`select count(*)::int as c from public.events where type = 'cta_click'`),
    ]);
    rows = leadsR.rows;
    ctaClicks = ctaR.rows[0]?.c ?? 0;
  } catch (e) {
    console.error('admin-dashboard query', e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 500;
    return res.end(
      `<!doctype html><meta charset="utf-8"><title>Error</title><body style="background:#fff;color:#0b1220;font-family:system-ui,sans-serif;padding:40px"><h1 style="margin-bottom:12px">No se pudo leer la base de datos</h1><p>Verifica que ejecutaste <code style="background:#eef;padding:2px 6px;border-radius:4px">supabase/schema.sql</code> y que <code style="background:#eef;padding:2px 6px;border-radius:4px">DATABASE_URL</code> está configurada en Vercel.</p><p style="margin-top:18px"><a href="/" style="color:#1d6cf4">← Volver al sitio</a></p></body>`
    );
  }

  const total = rows.length;
  const completos = rows.filter((x) => x.status === 'completo').length;
  const incompletos = total - completos;
  const calificados = rows.filter((x) => x.calificado === true).length;
  const denegados = completos - calificados;

  const tableRows = rows
    .map((r) => {
      const nm = [r.nombre, r.apellido].filter(Boolean).join(' ') || '<span style="color:#94a3b8">— sin nombre —</span>';
      const wa = r.whatsapp ? `${r.country || ''} ${r.whatsapp}`.trim() : '<span style="color:#94a3b8">—</span>';
      let estado;
      if (r.status !== 'completo') {
        estado = '<span class="pill pill-incomplete">Incompleto</span>';
      } else if (r.calificado === true) {
        estado = '<span class="pill pill-apto">Apto</span>';
      } else {
        estado = '<span class="pill pill-no">Denegado</span>';
      }
      const lastStep = r.last_step ? `paso ${r.last_step}/7` : '—';
      return `<tr>
        <td>${escapeHtml(fmtDate(r.updated_at || r.created_at))}</td>
        <td><div class="cell-name">${nm}</div><div class="cell-sub">${lastStep}</div></td>
        <td>${escapeHtml(r.email || '—')}</td>
        <td>${typeof wa === 'string' ? escapeHtml(wa) : wa}</td>
        <td>${estado}</td>
        <td class="num">${r.puntos ?? 0}</td>
        <td>${escapeHtml(presupuestoLabel(r.presupuesto))}</td>
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
<title>Admin · Holistic Marketing</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#f6f8fb;
    --surface:#ffffff;
    --text:#0b1220;
    --muted:#64748b;
    --line:#e6ebf2;
    --primary:#1d6cf4;
    --primary-2:#155ad6;
    --accent:#0fb98a;
    --warn:#f59e0b;
    --danger:#ef4444;
    --shadow-sm:0 1px 2px rgba(15,23,42,.06);
    --shadow:0 8px 24px rgba(15,23,42,.06);
  }
  html,body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .top{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
  .top-inner{max-width:1320px;margin:0 auto;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:18px}
  .brand .dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#1d6cf4,#0fb98a);box-shadow:0 0 0 4px rgba(29,108,244,.12)}
  .brand small{display:block;font-weight:500;color:var(--muted);font-size:12px;margin-top:2px;letter-spacing:.04em;text-transform:uppercase}
  .top-meta{display:flex;align-items:center;gap:18px;color:var(--muted);font-size:13px}
  .live{display:inline-flex;align-items:center;gap:6px}
  .live .pulse{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 0 rgba(15,185,138,.6);animation:pulse 1.6s ease-out infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(15,185,138,.55)}70%{box-shadow:0 0 0 12px rgba(15,185,138,0)}100%{box-shadow:0 0 0 0 rgba(15,185,138,0)}}

  main{max-width:1320px;margin:0 auto;padding:28px}
  h1{font-size:22px;font-weight:800;margin-bottom:6px;letter-spacing:-.01em}
  .subtitle{color:var(--muted);font-size:14px;margin-bottom:22px}

  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:22px}
  .stat{
    background:var(--surface);border:1px solid var(--line);border-radius:14px;
    padding:18px 18px;box-shadow:var(--shadow-sm);
    display:flex;flex-direction:column;gap:8px;
  }
  .stat .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:600}
  .stat .value{font-size:30px;font-weight:800;letter-spacing:-.01em}
  .stat .hint{font-size:12px;color:var(--muted)}
  .stat--accent{border-color:#cfe6da;background:linear-gradient(180deg,#f1faf6,#fff)}
  .stat--warn{border-color:#fde7c1;background:linear-gradient(180deg,#fff8eb,#fff)}
  .stat--primary{border-color:#cdddff;background:linear-gradient(180deg,#eff5ff,#fff)}
  .stat--danger{border-color:#fbd5d5;background:linear-gradient(180deg,#fff0f0,#fff)}

  .filters{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
  .filters input{
    flex:1;min-width:240px;max-width:420px;
    background:var(--surface);border:1px solid var(--line);border-radius:10px;
    padding:11px 14px;font-size:14px;color:var(--text);box-shadow:var(--shadow-sm);
  }
  .filters input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(29,108,244,.12)}
  .badge-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-size:13px;color:var(--muted);box-shadow:var(--shadow-sm)}

  .table-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
  .table-wrap{overflow:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  thead th{
    text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);
    font-weight:700;background:#fafbfd;padding:12px 16px;border-bottom:1px solid var(--line);white-space:nowrap;
  }
  tbody td{padding:14px 16px;border-bottom:1px solid #f1f4f8;vertical-align:middle}
  tbody tr:hover{background:#f8faff}
  tbody tr:last-child td{border-bottom:none}
  td.num{font-variant-numeric:tabular-nums;font-weight:600}
  .cell-name{font-weight:600}
  .cell-sub{font-size:12px;color:var(--muted);margin-top:2px}

  .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:11.5px;font-weight:700;line-height:1}
  .pill-apto{background:rgba(15,185,138,.12);color:#0c8a66;border:1px solid rgba(15,185,138,.3)}
  .pill-no{background:rgba(239,68,68,.10);color:#b42424;border:1px solid rgba(239,68,68,.3)}
  .pill-incomplete{background:rgba(245,158,11,.12);color:#9a6500;border:1px solid rgba(245,158,11,.4)}

  .empty{padding:48px;text-align:center;color:var(--muted)}
  .foot{margin-top:24px;text-align:center;color:var(--muted);font-size:12px}
  .foot a{color:var(--primary);font-weight:600}

  @media (max-width:560px){
    main{padding:18px}
    h1{font-size:18px}
    .stat .value{font-size:24px}
  }
</style>
</head>
<body>
<header class="top">
  <div class="top-inner">
    <div class="brand">
      <span class="dot"></span>
      <div>Holistic Marketing<br/><small>Dashboard de Leads</small></div>
    </div>
    <div class="top-meta">
      <span class="live"><span class="pulse"></span> Actualización automática 60 s</span>
      <a href="/" style="color:var(--primary);font-weight:600">Volver al sitio</a>
    </div>
  </div>
</header>

<main>
  <h1>Resumen</h1>
  <p class="subtitle">Datos en vivo desde tu base de datos. Los leads parciales (sin terminar) también aparecen registrados.</p>

  <section class="stats">
    <div class="stat stat--primary">
      <span class="label">Total registros</span>
      <span class="value">${total}</span>
      <span class="hint">incluye completos e incompletos</span>
    </div>
    <div class="stat stat--accent">
      <span class="label">Completos · Apto</span>
      <span class="value">${calificados}</span>
      <span class="hint">de ${completos} formularios completados</span>
    </div>
    <div class="stat stat--danger">
      <span class="label">Completos · Denegado</span>
      <span class="value">${denegados}</span>
      <span class="hint">no calificaron</span>
    </div>
    <div class="stat stat--warn">
      <span class="label">Datos sin terminar</span>
      <span class="value">${incompletos}</span>
      <span class="hint">abandonaron el formulario</span>
    </div>
    <div class="stat">
      <span class="label">Clics “Agendar llamada”</span>
      <span class="value">${ctaClicks}</span>
      <span class="hint">total acumulado del CTA principal</span>
    </div>
  </section>

  <div class="filters">
    <input id="filterInput" type="search" placeholder="Filtrar por nombre, email, WhatsApp…" autocomplete="off"/>
    <span class="badge-chip" id="filterCount">${total} resultados</span>
  </div>

  <div class="table-card">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Última actividad</th>
            <th>Lead</th>
            <th>Email</th>
            <th>WhatsApp</th>
            <th>Estado</th>
            <th>Puntos</th>
            <th>Presupuesto</th>
          </tr>
        </thead>
        <tbody id="tbody">
          ${tableRows || '<tr><td colspan="7" class="empty">Aún no hay registros.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <p class="foot">Holistic Marketing · panel interno · solo para uso de la agencia.</p>
</main>

<script>
(function(){
  const inp = document.getElementById('filterInput');
  const tbody = document.getElementById('tbody');
  const count = document.getElementById('filterCount');
  if(!inp || !tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  inp.addEventListener('input', ()=>{
    const q = inp.value.trim().toLowerCase();
    let shown = 0;
    rows.forEach(r=>{
      const txt = r.textContent.toLowerCase();
      const hit = !q || txt.includes(q);
      r.style.display = hit ? '' : 'none';
      if(hit) shown++;
    });
    count.textContent = shown + ' resultado' + (shown === 1 ? '' : 's');
  });
})();
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  return res.end(html);
};
