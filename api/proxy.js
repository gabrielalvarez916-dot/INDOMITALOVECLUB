// ============================================================
// api/proxy.js — Indómita Love Club
// Proxy para evitar restricciones CORS con Google Apps Script
// ============================================================
export default async function handler(req, res) {
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Aplana objetos anidados (ej: datos: { linkInstagram: '...' } → datos.linkInstagram: '...' NO)
  // En cambio los serializa como JSON en el querystring
  const aplanar = (obj, prefix = '') => {
    return Object.entries(obj).reduce((acc, [key, val]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(acc, aplanar(val, fullKey));
      } else {
        acc[fullKey] = val;
      }
      return acc;
    }, {});
  };

  const datos = req.method === 'POST' ? req.body : req.query;
  const aplanado = aplanar(datos);
  const params = new URLSearchParams(aplanado);
  const url = `${BACKEND_URL}?${params.toString()}`;

  try {
    const respuesta = await fetch(url, { method: 'GET', redirect: 'follow' });
    const json = await respuesta.json();
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error de conexión con el backend.' });
  }
}
