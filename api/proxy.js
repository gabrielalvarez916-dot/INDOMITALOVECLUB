export default async function handler(req, res) {
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Manda todo como POST con JSON al backend
    const respuesta = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.query),
      redirect: 'follow'
    });

    const datos = await respuesta.json();
    res.status(200).json(datos);
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error de conexión con el backend.' });
  }
}
