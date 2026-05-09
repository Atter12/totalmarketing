/**
 * Envío de correo vía Resend (POST).
 * Variables: RESEND_API_KEY (obligatoria).
 * Remitente: RESEND_FROM o EMAIL_FROM (cualquiera; mismo uso). Dominio verificado en Resend.
 * EMAIL_AUTO_SECRET (opcional).
 */

function isEmailShape(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').replace(/\s/g, '').trim());
}

/** Variables definidas pero con valor que no es un correo (ej. solo texto). */
function listInvalidFromEnvs() {
  const bad = [];
  for (const name of ['RESEND_FROM', 'EMAIL_FROM']) {
    const v = process.env[name];
    if (v == null || String(v).trim() === '') continue;
    const s = String(v).replace(/\s/g, '').trim();
    if (!isEmailShape(s)) bad.push(name);
  }
  return bad;
}

function resolveFrom(body) {
  const candidates = [
    body && body.from,
    process.env.RESEND_FROM,
    process.env.EMAIL_FROM,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).replace(/\s/g, '').trim();
    if (s && isEmailShape(s)) return s;
  }
  return 'onboarding@resend.dev';
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method === 'GET') {
    const invalidFrom = listInvalidFromEnvs();
    const resolved = resolveFrom({});
    return res.status(200).json({
      requiresSecret: !!process.env.EMAIL_AUTO_SECRET,
      resendConfigured: !!process.env.RESEND_API_KEY,
      customFromSet: resolved !== 'onboarding@resend.dev',
      invalidFromEnv: invalidFrom,
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
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

  const envSecret = process.env.EMAIL_AUTO_SECRET;
  if (envSecret) {
    const auth = req.headers.authorization;
    const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const fromBody = String(body.tool_secret || '').trim();
    if (bearer !== envSecret && fromBody !== envSecret) {
      return res.status(401).json({
        error: 'unauthorized',
        hint: 'La clave no coincide con EMAIL_AUTO_SECRET en Vercel.',
      });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'missing_resend_api_key',
      hint:
        'En Vercel: Project → Settings → Environment Variables → añade RESEND_API_KEY con tu API key de Resend. Luego Redeploy.',
    });
  }

  const to = String(body.to || '').trim();
  const subject = String(body.subject || 'Mensaje automático').trim();
  const message = String(body.message || body.text || '').trim();
  const from = resolveFrom(body);

  const malformedFrom = listInvalidFromEnvs();
  if (from === 'onboarding@resend.dev' && malformedFrom.length > 0) {
    return res.status(400).json({
      error: 'invalid_from_env',
      hint:
        `${malformedFrom.join(' y ')} debe ser un correo real del dominio verificado en Resend, con @ y dominio (ej. hola@tudominio.com). No pongas solo un nombre o frase como «EmpresaEnApuro!».`,
      invalidFromEnv: malformedFrom,
    });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
  if (!to || !emailOk) {
    return res.status(400).json({ error: 'invalid_to' });
  }
  if (!message) {
    return res.status(400).json({ error: 'empty_message' });
  }

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;font-size:15px">${message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')}</div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('email-send resend', r.status, data);
      const msg = String(data.message || data.name || '');
      let hint;
      if (/only send testing emails|testing emails to your own/i.test(msg)) {
        hint =
          'Sigues usando el remitente de prueba. En Vercel define RESEND_FROM o EMAIL_FROM con un correo de tu dominio ya verificado en Resend (ej. hola@tudominio.com), sin saltos de línea. Redeploy y prueba de nuevo.';
      } else if (/verify a domain|from.*domain/i.test(msg)) {
        hint =
          'Verifica el dominio en resend.com/domains y en Vercel usa RESEND_FROM o EMAIL_FROM con una dirección de ese dominio.';
      }
      return res.status(502).json({
        error: 'resend_failed',
        detail: msg || data,
        hint,
      });
    }
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('email-send', e);
    return res.status(500).json({ error: 'send_failed' });
  }
};
