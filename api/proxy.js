// ============================================================
// api/proxy.js — Indómita Love Club
// Proxy para evitar restricciones CORS con Google Apps Script
// ============================================================
export default async function handler(req, res) {
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec';
  // Arma la URL con los parámetros que mandó el frontend
  const params = new URLSearchParams(req.query);
  const url = `${BACKEND_URL}?${params.toString()}`;  // ✅ con backticks
  try {
    const respuesta = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });
    const datos = await respuesta.json();
    // Permite CORS para que el frontend pueda leer la respuesta
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(datos);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ ok: false, mensaje: 'Error de conexión con el backend.' });
  }
}
