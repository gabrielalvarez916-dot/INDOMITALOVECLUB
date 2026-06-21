// ============================================================
// soporte.js — Indómita Love Club
// Envío de tickets desde el botón flotante de ayuda
// ============================================================

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
  const rol   = Sesion.rol() || '';

  if (!email) {
    mostrarMensajeError('soporte-error', 'Necesitás iniciar sesión para enviar un mensaje de soporte.');
    return;
  }

  const resultado = await llamarBackend('crearTicketSoporte', {
    email,
    rol,
    asunto,
    mensaje
  });

  if (!resultado.ok) {
    mostrarMensajeError('soporte-error', resultado.mensaje);
    return;
  }

  mostrarMensajeOk('soporte-ok', resultado.mensaje || '¡Mensaje enviado!');
  document.getElementById('form-soporte')?.reset();

  setTimeout(() => cerrarModales(), 1800);
}
