// ============================================================
// api/drive.js — Indómita Love Club
// Proxy para descargar archivos de Google Drive
// Evita restricciones CORS al acceder a archivos desde el navegador
// ============================================================

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ error: 'ID de archivo requerido' });
    return;
  }

  // Solo permite IDs válidos de Drive (letras, números, guiones)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  try {
    // Descarga el archivo desde Drive
    const url = `https://drive.google.com/uc?export=download&id=${id}`;
    const respuesta = await fetch(url, { redirect: 'follow' });

    if (!respuesta.ok) {
      res.status(respuesta.status).json({ error: 'No se pudo descargar el archivo' });
      return;
    }

    // Obtiene el tipo de contenido
    const contentType = respuesta.headers.get('content-type') || 'application/octet-stream';
    const buffer = await respuesta.arrayBuffer();

    // Headers para permitir lectura desde el navegador
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    res.status(200).send(Buffer.from(buffer));

  } catch (e) {
    res.status(500).json({ error: 'Error al obtener el archivo' });
  }
}
