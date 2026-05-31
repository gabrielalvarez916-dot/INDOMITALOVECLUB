// ============================================================
// api/proxy.js — Indómita Love Club
// Proxy para evitar restricciones CORS con Google Apps Script
// ============================================================

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const body = req.body;

    if (!body || !body.action) {
      res.status(400).json({ ok: false, mensaje: 'Falta la acción.' });
      return;
    }

    const respuesta = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    const texto = await respuesta.text();

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = { ok: false, mensaje: 'Respuesta inválida del servidor.' };
    }

    res.status(200).json(datos);

  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error de conexión con el backend: ' + e.message });
  }
}
