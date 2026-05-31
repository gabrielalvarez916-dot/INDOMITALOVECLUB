// ============================================================
// api/proxy.js — Indómita Love Club
// Proxy para evitar restricciones CORS con Google Apps Script
// ============================================================

export default async function handler(req, res) {
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec';

  // Maneja preflight CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Toma el body que mandó el frontend
    const body = req.body;

    // Manda el body como POST a Apps Script
    const respuesta = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    const datos = await respuesta.json();
    res.status(200).json(datos);

  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error de conexión con el backend.' });
  }
}
