export default async function handler(req, res) {
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgLSkUb87q5A/exec';

  res.setHeader('Access-Control-Allow-Origin', '*');

  const paramsLimpios = new URLSearchParams();
  for (const [clave, valor] of Object.entries(req.query)) {
    paramsLimpios.append(clave, decodeURIComponent(valor));
  }

  try {
    const respuesta = await fetch(`${BACKEND_URL}?${paramsLimpios.toString()}`, { method: 'GET', redirect: 'follow' });
    const datos = await respuesta.json();
    res.status(200).json(datos);
  } catch (e) {
    res.status(500).json({ ok: false, mensaje: 'Error de conexión con el backend.' });
  }
}
