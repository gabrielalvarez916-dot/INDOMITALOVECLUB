function abrirModalDenuncia(referenciaTipo, referenciaId) {
  if (!referenciaId) return;
  document.getElementById('denuncia-referencia-tipo').value = referenciaTipo;
  document.getElementById('denuncia-referencia-id').value = referenciaId;
  document.getElementById('denuncia-categoria').value = '';
  document.getElementById('denuncia-mensaje').value = '';
  ocultarMensajes('denuncia-error', 'denuncia-ok');
  mostrarModal('modal-denuncia');
}

async function enviarDenuncia(event) {
  event.preventDefault();
  ocultarMensajes('denuncia-error', 'denuncia-ok');

  const categoria = document.getElementById('denuncia-categoria')?.value;
  const mensaje = document.getElementById('denuncia-mensaje')?.value?.trim();
  const referenciaTipo = document.getElementById('denuncia-referencia-tipo')?.value;
  const referenciaId = document.getElementById('denuncia-referencia-id')?.value;

  if (!categoria) {
    mostrarMensajeError('denuncia-error', 'Elegí un motivo.');
    return;
  }

  const email = Sesion.email() || '';
  if (!email) {
    mostrarMensajeError('denuncia-error', 'Necesitás iniciar sesión para denunciar.');
    return;
  }

  const { data: resultado, error } = await supabaseClient.rpc('crear_denuncia', {
    p_email: email,
    p_categoria: categoria,
    p_mensaje: mensaje || '',
    p_referencia_tipo: referenciaTipo,
    p_referencia_id: referenciaId
  });

  if (error || !resultado || resultado.error) {
    mostrarMensajeError('denuncia-error', resultado?.error || 'No pudimos enviar la denuncia. Probá de nuevo.');
    return;
  }

  mostrarMensajeOk('denuncia-ok', 'Denuncia enviada. Gracias por avisarnos.');
  document.getElementById('form-denuncia')?.reset();
  setTimeout(() => cerrarModales(), 1800);
}
