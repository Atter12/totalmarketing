/**
 * GET — Números de WhatsApp de la agencia para wa.me (un chat distinto por número).
 *
 * Vercel — variable opcional:
 *   WHATSAPP_AGENCY_NUMBERS=51984789504:Ventas,51987654321:Soporte
 * Formato: E164 sin +, opcional ":Etiqueta" por entrada. Separados por coma.
 *
 * Alternativa (un solo número):
 *   WHATSAPP_AGENCY_E164=51984789504
 *
 * Si no hay env, se usa el número por defecto del sitio.
 */
function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function parseContacts() {
  const raw = process.env.WHATSAPP_AGENCY_NUMBERS || '';
  const legacy = process.env.WHATSAPP_AGENCY_E164 || '';
  const fallback = '51984789504';

  const out = [];
  if (raw.trim()) {
    for (const part of raw.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const colon = p.indexOf(':');
      let numPart;
      let label;
      if (colon > -1) {
        numPart = p.slice(0, colon);
        label = p.slice(colon + 1).trim();
      } else {
        numPart = p;
        label = '';
      }
      const e164 = digitsOnly(numPart);
      if (e164.length < 10 || e164.length > 15) continue;
      out.push({
        e164,
        label: label || defaultLabel(e164),
      });
    }
  }

  if (out.length === 0 && legacy.trim()) {
    const e164 = digitsOnly(legacy);
    if (e164.length >= 10 && e164.length <= 15) {
      out.push({ e164, label: defaultLabel(e164) });
    }
  }

  if (out.length === 0) {
    out.push({ e164: fallback, label: 'Holistic Marketing (+51 984 789 504)' });
  }

  return out;
}

function defaultLabel(e164) {
  return 'Chat +' + e164;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    return res.status(200).json({ contacts: parseContacts() });
  } catch (e) {
    console.error('agency-whatsapp', e);
    return res.status(200).json({
      contacts: [{ e164: '51984789504', label: 'Holistic Marketing (+51 984 789 504)' }],
    });
  }
};
