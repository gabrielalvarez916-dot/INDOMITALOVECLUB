// ============================================================
// soporte.js — Indómita Love Club
// Envío de tickets desde el botón flotante de ayuda
// ============================================================

const FORMATOS_ADJUNTO_SOPORTE = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf'];
const MAX_BYTES_ADJUNTO_SOPORTE = 8 * 1024 * 1024;

/**
 * Sube el adjunto elegido directo a R2 usando una URL prefirmada.
 * Devuelve { key, nombre, tipo } o null si no se eligió archivo.
 * Lanza un Error con mensaje legible si algo falla.
 */
async function subirAdjuntoSoporteSiHay(token) {
  const input = document.getElementById('soporte-adjunto');
  const archivo = input?.files?.[0];
  if (!archivo) return null;

  if (archivo.size > MAX_BYTES_ADJUNTO_SOPORTE) {
    throw new Error('El archivo es demasiado grande (máximo 8MB).');
  }

  const formato = (archivo.name.split('.').pop() || '').toLowerCase();
  if (!FORMATOS_ADJUNTO_SOPORTE.includes(formato)) {
    throw new Error('Formato no permitido. Usá jpg, png, webp, heic o pdf.');
  }

  const { data: presign, error: errPresign } = await supabaseClient.functions.invoke('subir-adjunto-soporte', {
    body: { nombre: archivo.name, formato },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (errPresign || presign?.error) {
    throw new Error(presign?.error || 'No se pudo preparar la subida del archivo.');
  }

  const respPut = await fetch(presign.url, {
    method: 'PUT',
    headers: { 'Content-Type': presign.content_type },
    body: archivo
  });

  if (!respPut.ok) {
    throw new Error('No se pudo subir el archivo. Probá de nuevo.');
  }

  return { key: presign.key, nombre: archivo.name, tipo: presign.content_type };
}

async function enviarTicketSoporte(event) {
  event.preventDefault();
  ocultarMensajes('soporte-error', 'soporte-ok');
  const asunto   = document.getElementById('soporte-asunto')?.value?.trim();
  const mensaje  = document.getElementById('soporte-mensaje')?.value?.trim();
  if (!mensaje) {
    mostrarMensajeError('soporte-error', 'El mensaje es obligatorio.');
    return;
  }
  const email = Sesion.email() || '';
  if (!email) {
    mostrarMensajeError('soporte-error', 'Necesitás iniciar sesión para enviar un mensaje de soporte.');
    return;
  }

  const botonEnviar = document.querySelector('#form-soporte button[type="submit"]');
  if (botonEnviar) botonEnviar.disabled = true;

  let adjunto = null;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    adjunto = await subirAdjuntoSoporteSiHay(session?.access_token);
  } catch (e) {
    mostrarMensajeError('soporte-error', e.message || 'No se pudo subir el archivo adjunto.');
    if (botonEnviar) botonEnviar.disabled = false;
    return;
  }

  const { data: resultado, error } = await supabaseClient.rpc('crear_ticket_soporte', {
    p_email: email,
    p_asunto: asunto,
    p_mensaje: mensaje,
    p_adjunto_key: adjunto?.key ?? null,
    p_adjunto_nombre: adjunto?.nombre ?? null,
    p_adjunto_tipo: adjunto?.tipo ?? null
  });

  if (botonEnviar) botonEnviar.disabled = false;

  if (error || !resultado || resultado.error) {
    mostrarMensajeError('soporte-error', resultado?.error || 'No pudimos enviar tu mensaje. Probá de nuevo.');
    return;
  }

  mostrarMensajeOk('soporte-ok', resultado.mensaje || '¡Mensaje enviado!');
  document.getElementById('form-soporte')?.reset();
  setTimeout(() => cerrarModales(), 1800);
}
