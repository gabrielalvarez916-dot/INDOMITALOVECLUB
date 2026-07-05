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
  if (!email) {
    mostrarMensajeError('soporte-error', 'Necesitás iniciar sesión para enviar un mensaje de soporte.');
    return;
  }

  const { data: resultado, error } = await supabaseClient.rpc('crear_ticket_soporte', {
    p_email: email,
    p_asunto: asunto,
    p_mensaje: mensaje
  });

  if (error || !resultado || resultado.error) {
    mostrarMensajeError('soporte-error', resultado?.error || 'No pudimos enviar tu mensaje. Probá de nuevo.');
    return;
  }

  mostrarMensajeOk('soporte-ok', resultado.mensaje || '¡Mensaje enviado!');
  document.getElementById('form-soporte')?.reset();
  setTimeout(() => cerrarModales(), 1800);
}
