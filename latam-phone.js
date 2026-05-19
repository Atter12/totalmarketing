/**
 * Longitud nacional del móvil (sin código de país) para WhatsApp en LATAM.
 * lead: primer dígito obligatorio del móvil cuando aplica.
 */
const LATAM_PHONES = [
  { code: '+51', flag: '🇵🇪', name: 'Perú', digits: 9, example: '912 345 678', lead: '9', tz: ['America/Lima'] },
  { code: '+54', flag: '🇦🇷', name: 'Argentina', digits: 10, example: '11 2345 6789', tz: ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'] },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia', digits: 8, example: '7123 4567', tz: ['America/La_Paz'] },
  { code: '+55', flag: '🇧🇷', name: 'Brasil', digits: 11, example: '11 91234 5678', tz: ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza'] },
  { code: '+56', flag: '🇨🇱', name: 'Chile', digits: 9, example: '912 345 678', lead: '9', tz: ['America/Santiago'] },
  { code: '+57', flag: '🇨🇴', name: 'Colombia', digits: 10, example: '300 123 4567', lead: '3', tz: ['America/Bogota'] },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica', digits: 8, example: '6123 4567', tz: ['America/Costa_Rica'] },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador', digits: 9, example: '991 234 567', lead: '9', tz: ['America/Guayaquil'] },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador', digits: 8, example: '7123 4567', tz: ['America/El_Salvador'] },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala', digits: 8, example: '5123 4567', tz: ['America/Guatemala'] },
  { code: '+504', flag: '🇭🇳', name: 'Honduras', digits: 8, example: '9123 4567', tz: ['America/Tegucigalpa'] },
  { code: '+52', flag: '🇲🇽', name: 'México', digits: 10, example: '55 1234 5678', tz: ['America/Mexico_City', 'America/Cancun', 'America/Monterrey', 'America/Tijuana'] },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua', digits: 8, example: '8123 4567', tz: ['America/Managua'] },
  { code: '+507', flag: '🇵🇦', name: 'Panamá', digits: 8, example: '6123 4567', tz: ['America/Panama'] },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay', digits: 9, example: '981 234 567', tz: ['America/Asuncion'] },
  { code: '+1', flag: '🇩🇴', name: 'Rep. Dominicana', digits: 10, example: '809 123 4567', tz: ['America/Santo_Domingo'] },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay', digits: 8, example: '99 123 456', tz: ['America/Montevideo'] },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela', digits: 10, example: '412 123 4567', tz: ['America/Caracas'] },
];

const PHONE_BY_CODE = Object.fromEntries(LATAM_PHONES.map((p) => [p.code, p]));

const LANG_TO_CODE = {
  'es-ar': '+54',
  'es-bo': '+591',
  'es-br': '+55',
  'es-cl': '+56',
  'es-co': '+57',
  'es-cr': '+506',
  'es-ec': '+593',
  'es-sv': '+503',
  'es-gt': '+502',
  'es-hn': '+504',
  'es-mx': '+52',
  'es-ni': '+505',
  'es-pa': '+507',
  'es-py': '+595',
  'es-pe': '+51',
  'es-do': '+1',
  'es-uy': '+598',
  'es-ve': '+58',
};

function phoneByCode(code) {
  return PHONE_BY_CODE[code] || null;
}

function whatsappDigitsOk(code, raw) {
  const cfg = phoneByCode(code);
  if (!cfg) return false;
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== cfg.digits) return false;
  if (cfg.lead && !d.startsWith(cfg.lead)) return false;
  return true;
}

function whatsappErrMsg(code) {
  const cfg = phoneByCode(code);
  if (!cfg) return 'Ingresa un número válido';
  let msg = `Debe tener exactamente ${cfg.digits} dígitos (ej. ${cfg.example})`;
  if (cfg.lead) msg += ` y empezar por ${cfg.lead}`;
  return msg;
}

function guessDefaultCountryCode() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    for (const p of LATAM_PHONES) {
      if (p.tz && p.tz.includes(tz)) return p.code;
    }
  } catch (_) {}
  const lang = (navigator.language || '').toLowerCase();
  for (const [prefix, code] of Object.entries(LANG_TO_CODE)) {
    if (lang.startsWith(prefix)) return code;
  }
  return '+51';
}

const HM_PHONE_API = {
  LATAM_PHONES,
  PHONE_BY_CODE,
  phoneByCode,
  whatsappDigitsOk,
  whatsappErrMsg,
  guessDefaultCountryCode,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HM_PHONE_API;
}
if (typeof window !== 'undefined') {
  window.HM_PHONE = HM_PHONE_API;
}
