// ============================================================
// storage.js — Indómita Love Club
// Helper genérico de subida de archivos a Supabase Storage
// ============================================================

/**
 * Sube un archivo a un bucket de Supabase Storage y devuelve su URL pública.
 * Usa upsert (sobreescribe si ya existe algo en esa ruta), lo que permite
 * reutilizar el mismo path al editar (ej: eventos) en vez de acumular archivos.
 *
 * @param {string} bucket - Nombre del bucket ('PORTADAS' | 'EVENTOS')
 * @param {string} ruta - Path dentro del bucket, SIN extensión (ej: '{id_usuario}/{uuid}')
 * @param {File} archivo - Archivo a subir (típicamente de un input type="file")
 * @returns {Promise<string>} URL pública del archivo subido
 * @throws {Error} si el archivo es inválido o la subida falla
 */
/**
 * Redimensiona y comprime una imagen en el navegador antes de subirla.
 * Convierte siempre a JPEG para maximizar compresión.
 */
async function comprimirImagen(archivo, maxAncho = 1000, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const urlTemp = URL.createObjectURL(archivo);

    img.onload = () => {
      URL.revokeObjectURL(urlTemp);
      let { width, height } = img;
      if (width > maxAncho) {
        height = Math.round(height * (maxAncho / width));
        width = maxAncho;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('No se pudo comprimir la imagen.'));
          resolve(new File([blob], archivo.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        calidad
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(urlTemp);
      reject(new Error('No se pudo leer la imagen para comprimir.'));
    };
    img.src = urlTemp;
  });
}

async function subirImagen(bucket, ruta, archivo) {
  if (!archivo) {
    throw new Error('No se seleccionó ningún archivo.');
  }

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(archivo.type)) {
    throw new Error('Formato no permitido. Usá JPG, PNG o WEBP.');
  }

  const limiteBytes = 10 * 1024 * 1024; // 10 MB
  if (archivo.size > limiteBytes) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }

  if (bucket === 'PORTADAS' || bucket === 'EVENTOS') {
    archivo = await comprimirImagen(archivo, 1000, 0.82);
  }

  const extension = bucket === 'PORTADAS' || bucket === 'EVENTOS' ? 'jpg' : archivo.name.split('.').pop().toLowerCase();
  const rutaCompleta = `${ruta}.${extension}`;

  const { error } = await supabaseClient
    .storage
    .from(bucket)
    .upload(rutaCompleta, archivo, {
      upsert: true,
      contentType: archivo.type,
      cacheControl: '31536000' // 1 año — evita re-descargas del mismo archivo mientras no cambie
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabaseClient
    .storage
    .from(bucket)
    .getPublicUrl(rutaCompleta);

  return data.publicUrl;
}
