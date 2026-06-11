export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec';

  try {
    const { email, googleToken } = req.body;
    const params = new URLSearchParams({ action: 'loginConGoogle', email, googleToken });
    const respuesta = await fetch(`${BACKEND_URL}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow'
    });
    const resultado = await respuesta.json();
    res.status(200).json(resultado);
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error de conexión.' });
  }
}
