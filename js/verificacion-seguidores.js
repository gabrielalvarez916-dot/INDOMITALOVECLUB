// ============================================================
// verificacion-seguidores.js — Indómita Love Club
// Lado reseñador: cargar seguidores IG/TikTok una sola vez, para verificación admin.
// Lado admin: revisar, aprobar o rechazar esas solicitudes.
// ============================================================

// ────────────────────────────────────────────────────────────
// LADO RESEÑADOR (pestaña "Perfil" propia)
// ────────────────────────────────────────────────────────────

/**
 * Se llama desde cargarPerfil() (perfil.js) cuando el usuario logueado es reseñador.
 * Decide qué mostrar en el bloque privado de verificación de seguidores:
 * - null / sin solicitar / rechazado → formulario para cargar seguidores
 * - pendiente → mensaje "en revisión"
 * - aprobado → el bloque entero se oculta (ya está verificado, se ve la insignia en la cabecera)
 */
async function cargarEstadoVerificacionSeguidores() {
  const usuario = Sesion.obtener();
  if (!usuario) return;

  const bloque = document.getElementById('bloque-verificacion-seguidores');
  if (!bloque) return;

  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('verificacion_seguidores_estado, instagram_seguidores, tiktok_seguidores')
    .eq('id', usuario.id)
    .single();

  if (error || !data) {
    bloque.style.display = 'none';
    return;
  }

  const estado = data.verificacion_seguidores_estado;
  const formEl = document.getElementById('verificacion-seguidores-form');
  const pendienteEl = document.getElementById('verificacion-seguidores-pendiente');

  if (estado === 'aprobado') {
    bloque.style.display = 'none';
    return;
  }

  bloque.style.display = '';

  if (estado === 'pendiente') {
    formEl.style.display = 'none';
    pendienteEl.style.display = '';
    return;
  }

  // null (nunca solicitó) o 'rechazado' → mostrar formulario
  formEl.style.display = '';
  pendienteEl.style.display = 'none';
  ocultarMensajes('verificacion-seguidores-msg');

  if (estado === 'rechazado') {
    const igInput = document.getElementById('input-ig-seguidores');
    const ttInput = document.getElementById('input-tiktok-seguidores');
    if (igInput) igInput.value = data.instagram_seguidores ?? '';
    if (ttInput) ttInput.value = data.tiktok_seguidores ?? '';
    mostrarMensajeError('verificacion-seguidores-msg', 'Tu solicitud anterior no fue aprobada. Revisá los números y volvé a enviar.');
  }
}

async function solicitarVerificacionSeguidores() {
  ocultarMensajes('verificacion-seguidores-msg');

  const igRaw = document.getElementById('input-ig-seguidores')?.value;
  const ttRaw = document.getElementById('input-tiktok-seguidores')?.value;
  const ig = igRaw === '' || igRaw === undefined ? null : parseInt(igRaw, 10);
  const tt = ttRaw === '' || ttRaw === undefined ? null : parseInt(ttRaw, 10);

  if ((ig === null || isNaN(ig)) && (tt === null || isNaN(tt))) {
    mostrarMensajeError('verificacion-seguidores-msg', 'Cargá al menos una de las dos redes.');
    return;
  }

  const boton = document.getElementById('btn-solicitar-verificacion-seguidores');
  if (boton) { boton.disabled = true; boton.textContent = 'Enviando...'; }

  const { data: resultado, error } = await supabaseClient.rpc('solicitar_verificacion_seguidores', {
    p_instagram_seguidores: isNaN(ig) ? null : ig,
    p_tiktok_seguidores: isNaN(tt) ? null : tt
  });

  if (boton) { boton.disabled = false; boton.textContent = 'Enviar para verificación'; }

  if (error || !resultado || resultado.error) {
    mostrarMensajeError('verificacion-seguidores-msg', resultado?.error || 'No pudimos enviar la solicitud. Probá de nuevo.');
    return;
  }

  await cargarEstadoVerificacionSeguidores();
}

// ────────────────────────────────────────────────────────────
// LADO ADMIN (pestaña "Verificación")
// ────────────────────────────────────────────────────────────

let _filtroVerificacionAdminActual = 'pendiente';

function cambiarFiltroVerificacionAdmin(botonEl, filtro) {
  document.querySelectorAll('#tab-admin-verificacion .tab-mini').forEach(b => b.classList.remove('activo'));
  botonEl.classList.add('activo');
  _filtroVerificacionAdminActual = filtro;
  cargarVerificacionesAdmin();
}

async function cargarVerificacionesAdmin() {
  const cont = document.getElementById('admin-verificacion-lista');
  if (!cont) return;
  cont.innerHTML = '<p class="admin-cargando">Cargando...</p>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_verificaciones_seguidores', {
    p_estado: _filtroVerificacionAdminActual
  });

  if (error || resultado?.error) {
    cont.innerHTML = `<p class="admin-error">${_esc(resultado?.error || 'Error al cargar las solicitudes.')}</p>`;
    return;
  }

  const lista = resultado || [];
  if (lista.length === 0) {
    cont.innerHTML = '<p class="admin-vacio">No hay solicitudes en este estado.</p>';
    return;
  }

  cont.innerHTML = lista.map(u => _renderFilaVerificacionAdmin(u)).join('');
}

function _renderFilaVerificacionAdmin(u) {
  const mostrarBotones = u.estado === 'pendiente';
  return `
    <div class="admin-verificacion-fila" id="verif-fila-${_esc(u.id)}">
      <img src="${_esc(u.avatarUrl || '')}" class="admin-verificacion-avatar" alt="" onerror="this.style.visibility='hidden'" />
      <div class="admin-verificacion-datos">
        <p class="admin-verificacion-alias">${_esc(u.alias || u.nombre || 'Sin alias')}</p>
        <p class="admin-verificacion-email">${_esc(u.email || '')}</p>
        <p class="admin-verificacion-numeros">
          📸 ${u.instagramSeguidores ?? '—'} seguidores &nbsp;|&nbsp; 🎵 ${u.tiktokSeguidores ?? '—'} seguidores
        </p>
        <div class="admin-verificacion-links">
          ${u.instagram ? `<a href="${_esc(u.instagram)}" target="_blank" class="btn-secundario btn-sm">Ver Instagram</a>` : ''}
          ${u.tiktok ? `<a href="${_esc(u.tiktok)}" target="_blank" class="btn-secundario btn-sm">Ver TikTok</a>` : ''}
        </div>
      </div>
      ${mostrarBotones ? `
        <div class="admin-verificacion-acciones">
          <button class="btn-primario btn-sm" onclick="revisarVerificacionSeguidoresAdmin('${_esc(u.id)}', true)">✔ Verificar</button>
          <button class="btn-secundario btn-sm" onclick="revisarVerificacionSeguidoresAdmin('${_esc(u.id)}', false)">✕ Rechazar</button>
        </div>
      ` : `<div class="admin-verificacion-estado admin-verificacion-estado-${_esc(u.estado)}">${u.estado === 'aprobado' ? '✔ Verificado' : '✕ Rechazado'}</div>`}
    </div>
  `;
}

async function revisarVerificacionSeguidoresAdmin(idUsuario, aprobar) {
  const { data: resultado, error } = await supabaseClient.rpc('admin_revisar_verificacion_seguidores', {
    p_id_usuario: idUsuario,
    p_aprobar: aprobar
  });

  if (error || !resultado || resultado.error) {
    alert(resultado?.error || 'No pudimos procesar la acción. Probá de nuevo.');
    return;
  }

  cargarVerificacionesAdmin();
}
