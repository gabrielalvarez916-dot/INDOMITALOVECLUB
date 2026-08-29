// ============================================================
// admin.js — Indómita Love Club
// Panel admin: usuarios, campañas, suscripciones, configuración, errores
// ============================================================


// ────────────────────────────────────────────────────────────
// CARGAR PANEL ADMIN
// ────────────────────────────────────────────────────────────

/**
 * Carga el panel admin.
 * Se llama automáticamente cuando se muestra la sección admin.
 */
// ────────────────────────────────────────────────────────────
// USUARIOS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de usuarios en el panel admin.
 */
async function cargarUsuariosAdmin() {
  const contenedor = document.getElementById('admin-usuarios-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_usuarios');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar los usuarios.'}</p>`;
    return;
  }

  const usuarios = resultado.usuarios || [];

  if (usuarios.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay usuarios registrados.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <div style="margin-bottom:16px;">
      <input type="text" id="admin-buscar-usuario" class="input-buscar" placeholder="Buscar por email o alias..." oninput="filtrarUsuariosAdmin()" style="max-width:400px;" />
    </div>
    <table class="admin-tabla" id="tabla-usuarios">
      <thead>
        <tr>
          <th>Email</th>
          <th>Alias</th>
          <th>Rol</th>
          <th>Plan</th>
          <th>Estado</th>
          <th>Registro</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${usuarios.map(u => construirFilaUsuarioAdmin(u)).join('')}
      </tbody>
    </table>
  `;

  window._usuariosAdmin = usuarios;
}

/**
 * Construye la fila de un usuario para la tabla admin.
 *
 * @param {Object} u — datos del usuario
 * @returns {string} HTML de la fila
 */
function construirFilaUsuarioAdmin(u) {
  const estadoBadge = u.estadoCuenta === 'bloqueado'
    ? '<span class="badge badge-cancelada">Bloqueado</span>'
    : '<span class="badge badge-aprobada">Activo</span>';

  const planTexto = u.rol === 'autor' ? (u.plan || 'free') : '—';

  const botonBloqueo = u.estadoCuenta === 'bloqueado'
    ? `<button class="btn-secundario btn-sm" onclick="accionUsuarioAdmin('${u.email}', 'desbloquear')">Desbloquear</button>`
    : `<button class="btn-secundario btn-sm btn-peligro" onclick="accionUsuarioAdmin('${u.email}', 'bloquear')">Bloquear</button>`;

  const botonVerComo = u.rol !== 'admin'
    ? `<button class="btn-secundario btn-sm" onclick="iniciarImpersonacion('${u.email}')">Ver como</button>`
    : '';

  return `
    <tr>
      <td>${u.email}</td>
      <td>${u.alias || '—'}</td>
      <td><span class="badge badge-nivel">${u.rol}</span></td>
      <td>${planTexto}</td>
      <td>${estadoBadge}</td>
      <td style="font-size:12px;">${u.fechaRegistro ? String(u.fechaRegistro).split('T')[0] : '—'}</td>
      <td style="display:flex; gap:6px;">${botonBloqueo}${botonVerComo}</td>
    </tr>
  `;
}

/**
 * Filtra la tabla de usuarios por email o alias.
 */
function filtrarUsuariosAdmin() {
  const texto = (document.getElementById('admin-buscar-usuario')?.value || '').toLowerCase();
  const usuarios = (window._usuariosAdmin || []).filter(u =>
    u.email.toLowerCase().includes(texto) ||
    (u.alias || '').toLowerCase().includes(texto)
  );

  const tbody = document.querySelector('#tabla-usuarios tbody');
  if (tbody) tbody.innerHTML = usuarios.map(u => construirFilaUsuarioAdmin(u)).join('');
}

/**
 * Bloquea o desbloquea un usuario.
 *
 * @param {string} emailUsuario
 * @param {string} accion — 'bloquear' o 'desbloquear'
 */
async function accionUsuarioAdmin(emailUsuario, accion) {
  let motivo = '';
  if (accion === 'bloquear') {
    motivo = prompt(`¿Motivo del bloqueo de ${emailUsuario}?`) || '';
    if (motivo === null) return; // canceló
  } else {
    if (!confirm(`¿Desbloquear a ${emailUsuario}?`)) return;
  }

  const rpcNombre = accion === 'bloquear' ? 'admin_bloquear_usuario' : 'admin_desbloquear_usuario';
  const params = accion === 'bloquear'
    ? { p_email: emailUsuario, p_motivo: motivo }
    : { p_email: emailUsuario };

  const { error } = await supabaseClient.rpc(rpcNombre, params);

  if (error) {
    mostrarToast(error.message || 'Error al actualizar el usuario.', 'error');
    return;
  }

  mostrarToast(accion === 'bloquear' ? 'Usuario bloqueado.' : 'Usuario desbloqueado.', 'ok');
  await cargarUsuariosAdmin();
}


// ────────────────────────────────────────────────────────────
// CAMPAÑAS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de campañas en el panel admin.
 */
async function cargarCampañasAdmin() {
  const contenedor = document.getElementById('admin-campanas-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_campanas');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar las campañas.'}</p>`;
    return;
  }

  const campañas = resultado.campañas || [];

  if (campañas.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay campañas registradas.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Libro</th>
          <th>Autor</th>
          <th>Estado</th>
          <th>Cupos</th>
          <th>Fecha límite</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${campañas.map(c => construirFilaCampañaAdmin(c)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Construye la fila de una campaña para la tabla admin.
 *
 * @param {Object} c — datos de la campaña
 * @returns {string} HTML de la fila
 */
function construirFilaCampañaAdmin(c) {
  const botonCancelar = c.estado === 'activa'
    ? `<button class="btn-secundario btn-sm btn-peligro" onclick="cancelarCampañaAdmin('${c.id}', '${c.nombreLibro}')">Cancelar</button>`
    : '';

  return `
    <tr>
      <td>${c.nombreLibro}</td>
      <td style="font-size:12px;">${c.emailAutor}</td>
      <td>${badgeEstado(c.estado)}</td>
      <td>${c.cuposDisponibles} / ${c.cuposTotal}</td>
      <td style="font-size:12px;">${formatearFechaAmigable(c.fechaLimite)}</td>
      <td>${botonCancelar}</td>
    </tr>
  `;
}

/**
 * Cancela una campaña desde el panel admin.
 *
 * @param {string} idCampaña
 * @param {string} nombreLibro
 */
async function cancelarCampañaAdmin(idCampaña, nombreLibro) {
  const motivo = prompt(`¿Motivo de la cancelación de "${nombreLibro}"?`);
  if (motivo === null) return;

  const { error } = await supabaseClient.rpc('admin_cancelar_campana', {
    p_id_campana: idCampaña,
    p_motivo: motivo
  });

  if (error) {
    mostrarToast(error.message || 'Error al cancelar la campaña.', 'error');
    return;
  }

  mostrarToast('Campaña cancelada.', 'ok');
  await cargarCampañasAdmin();
}

// ────────────────────────────────────────────────────────────
// INCUMPLIMIENTOS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra los incumplimientos de entrega (últimos 90 días) en el panel admin.
 */
async function cargarIncumplimientosAdmin() {
  const contenedor = document.getElementById('admin-incumplimientos-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_incumplimientos');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar los incumplimientos.'}</p>`;
    return;
  }

  const incumplimientos = resultado.incumplimientos || [];

  if (incumplimientos.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">🎉</p>
        <p class="estado-vacio-texto">Sin incumplimientos registrados en los últimos 90 días.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <p class="form-info" style="margin-bottom:14px;">
      <strong>${resultado.total90Dias}</strong> incumplimiento${resultado.total90Dias === 1 ? '' : 's'} registrado${resultado.total90Dias === 1 ? '' : 's'} en los últimos 90 días.
    </p>
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Reseñador</th>
          <th>Libro</th>
          <th>Autor</th>
          <th>Venció el</th>
          <th>Incumplido el</th>
          <th>Reincidencia (90d)</th>
        </tr>
      </thead>
      <tbody>
        ${incumplimientos.map(i => construirFilaIncumplimientoAdmin(i)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Construye la fila de un incumplimiento para la tabla admin.
 *
 * @param {Object} i — datos del incumplimiento
 * @returns {string} HTML de la fila
 */
function construirFilaIncumplimientoAdmin(i) {
  const n = i.incumplimientos_90dias;

  const badgeReincidencia = n >= 3
    ? `<span class="badge badge-rechazada">${n} — bloqueo activo</span>`
    : n === 2
    ? `<span class="badge badge-pendiente">${n} — 1 campaña activa máx.</span>`
    : `<span class="badge badge-nivel">${n} — solo aviso</span>`;

  return `
    <tr>
      <td style="font-size:12px;">${i.alias || '—'}<br><span style="color:#888;">${i.email}</span></td>
      <td>${i.nombre_libro}</td>
      <td style="font-size:12px;">${i.nombre_autor}</td>
      <td style="font-size:12px;">${i.fecha_limite_entrega ? String(i.fecha_limite_entrega).split('T')[0] : '—'}</td>
      <td style="font-size:12px;">${i.fecha_incumplida ? String(i.fecha_incumplida).split('T')[0] : '—'}</td>
      <td>${badgeReincidencia}</td>
    </tr>
  `;
}

// ────────────────────────────────────────────────────────────
// TROPES PROPUESTOS (autores/editoriales proponen, admin aprueba o rechaza)
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra en el panel admin las propuestas de tropes pendientes de revisión.
 */
async function cargarTropesPropuestosAdmin() {
  const contenedor = document.getElementById('admin-tropes-propuestos-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: propuestas, error } = await supabaseClient
    .from('tropes_propuestos')
    .select(`
      id, nombre, creado_en,
      generos ( nombre ),
      tropes_propuestos_autores (
        creado_en,
        usuarios ( alias, email ),
        libros ( titulo )
      )
    `)
    .order('creado_en', { ascending: true });

  if (error) {
    contenedor.innerHTML = `<p class="mensaje-error">Error al cargar las propuestas: ${error.message}</p>`;
    return;
  }

  if (!propuestas || propuestas.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">✨</p>
        <p class="estado-vacio-texto">No hay tropes propuestos pendientes de revisión.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <p class="form-info" style="margin-bottom:14px;">
      <strong>${propuestas.length}</strong> propuesta${propuestas.length === 1 ? '' : 's'} pendiente${propuestas.length === 1 ? '' : 's'}.
    </p>
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Trope propuesto</th>
          <th>Género</th>
          <th>Propuesto por</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${propuestas.map(p => construirFilaTropePropuestoAdmin(p)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Construye la fila de una propuesta de trope para la tabla admin.
 *
 * @param {Object} p — propuesta con sus autores anidados
 * @returns {string} HTML de la fila
 */
function construirFilaTropePropuestoAdmin(p) {
  const autores = (p.tropes_propuestos_autores || []).map(a => {
    const quien = a.usuarios?.alias || a.usuarios?.email || 'Autor desconocido';
    const libro = a.libros?.titulo ? ` (${a.libros.titulo})` : '';
    return `${quien}${libro}`;
  }).join('<br>') || '—';

  const nombreEscapado = p.nombre.replace(/'/g, "\\'");

  return `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.generos?.nombre || '—'}</td>
      <td style="font-size:12px;">${autores}</td>
      <td>
        <button type="button" class="btn-secundario btn-sm" onclick="aprobarTropePropuestoAdmin('${p.id}', '${nombreEscapado}')">Aprobar</button>
        <button type="button" class="btn-secundario btn-sm" onclick="rechazarTropePropuestoAdmin('${p.id}', '${nombreEscapado}')">Rechazar</button>
      </td>
    </tr>
  `;
}

/**
 * Aprueba una propuesta: la integra al catálogo de tropes de ese género
 * (queda disponible para elegir en libros/campañas) y borra la propuesta.
 */
async function aprobarTropePropuestoAdmin(idPropuesta, nombre) {
  if (!confirm(`¿Aprobar "${nombre}" e integrarlo al catálogo de tropes?`)) return;

  const { error } = await supabaseClient.rpc('aprobar_trope_propuesto', { p_id_propuesta: idPropuesta });

  if (error) {
    mostrarToast(error.message || 'Error al aprobar la propuesta.', 'error');
    return;
  }

  mostrarToast(`"${nombre}" fue agregado al catálogo de tropes.`, 'ok');
  await cargarTropesPropuestosAdmin();
}

/**
 * Rechaza una propuesta: no pasa nada más, se borra sin dejar rastro en el catálogo.
 */
async function rechazarTropePropuestoAdmin(idPropuesta, nombre) {
  if (!confirm(`¿Rechazar "${nombre}"? No se agregará al catálogo.`)) return;

  const { error } = await supabaseClient.rpc('rechazar_trope_propuesto', { p_id_propuesta: idPropuesta });

  if (error) {
    mostrarToast(error.message || 'Error al rechazar la propuesta.', 'error');
    return;
  }

  mostrarToast(`Propuesta "${nombre}" rechazada.`, 'ok');
  await cargarTropesPropuestosAdmin();
}

// ────────────────────────────────────────────────────────────
// SUSCRIPCIONES (antes "Pagos" — ahora es solo lectura,
// la activación/rechazo la maneja automáticamente el webhook
// de Mercado Pago / PayPal, no el admin)
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de suscripciones en el panel admin.
 */
async function cargarSuscripcionesAdmin() {
  const contenedor = document.getElementById('admin-pagos-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_suscripciones');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar las suscripciones.'}</p>`;
    return;
  }

  const suscripciones = resultado.suscripciones || [];

  if (suscripciones.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay suscripciones registradas.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <p class="form-info" style="margin-bottom:14px;">
      Las suscripciones se activan y desactivan automáticamente por webhook de Mercado Pago / PayPal. Esta tabla es solo informativa.
    </p>
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Email</th>
          <th>Plan</th>
          <th>Estado</th>
          <th>Monto</th>
          <th>Proveedor</th>
          <th>Próximo pago</th>
          <th>Último pago</th>
        </tr>
      </thead>
      <tbody>
        ${suscripciones.map(s => construirFilaSuscripcionAdmin(s)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Construye la fila de una suscripción para la tabla admin.
 *
 * @param {Object} s — datos de la suscripción
 * @returns {string} HTML de la fila
 */
function construirFilaSuscripcionAdmin(s) {
  const estadoBadge = {
    activa: '<span class="badge badge-aprobada">Activa</span>',
    autorizada: '<span class="badge badge-aprobada">Autorizada</span>',
    pendiente: '<span class="badge badge-pendiente">Pendiente</span>',
    pausada: '<span class="badge badge-pendiente">Pausada</span>',
    cancelada: '<span class="badge badge-cancelada">Cancelada</span>',
    pago_fallido: '<span class="badge badge-rechazada">Pago fallido</span>'
  }[s.estado] || s.estado;

  const ultimoPagoTexto = s.ultimoPago
    ? `${s.ultimoPago.monto ?? '—'} (${s.ultimoPago.estado}) — ${s.ultimoPago.fecha ? String(s.ultimoPago.fecha).split('T')[0] : '—'}`
    : '—';

  return `
    <tr>
      <td style="font-size:12px;">${s.email}</td>
      <td>${s.plan}</td>
      <td>${estadoBadge}</td>
      <td>${s.monto || '—'} ${s.moneda || ''}</td>
      <td style="font-size:12px;">${s.proveedorPago}</td>
      <td style="font-size:12px;">${s.fechaProximoPago ? String(s.fechaProximoPago).split('T')[0] : '—'}</td>
      <td style="font-size:12px;">${ultimoPagoTexto}</td>
    </tr>
  `;
}


// ────────────────────────────────────────────────────────────
// IMPULSOS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de solicitudes de "Impulsar campaña" en el panel admin.
 * Separado por completo de Suscripciones: no toca ni depende del webhook de pagos.
 */
async function cargarImpulsosAdmin() {
  const contenedor = document.getElementById('admin-impulsos-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_impulsos');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar los impulsos.'}</p>`;
    return;
  }

  const impulsos = resultado.impulsos || [];

  if (impulsos.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay solicitudes de impulso.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <p class="form-info" style="margin-bottom:14px;">
      El autor arma la solicitud y queda "pendiente". Mandale vos el link de pago por fuera del sistema
      (Mercado Pago / PayPal) y, cuando confirme el pago, tocá "Activar impulso": eso manda las notificaciones
      a los reseñadores de alta coincidencia y mete la campaña en el slider por los días configurados.
    </p>
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Libro</th>
          <th>Plan</th>
          <th>Autor</th>
          <th>Cupos libres</th>
          <th>Precio lista</th>
          <th>¿Usó créditos?</th>
          <th>A pagar</th>
          <th>Estado</th>
          <th>Solicitado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${impulsos.map(i => construirFilaImpulsoAdmin(i)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Construye la fila de una solicitud de impulso para la tabla admin.
 *
 * @param {Object} i — datos del impulso
 * @returns {string} HTML de la fila
 */
function construirFilaImpulsoAdmin(i) {
  const estadoBadge = {
    pendiente: '<span class="badge badge-pendiente">Pendiente</span>',
    pagado: '<span class="badge badge-aprobada">Activo</span>',
    rechazado: '<span class="badge badge-cancelada">Rechazado</span>'
  }[i.estado] || i.estado;

  const simbolo = i.moneda === 'ARS' ? '$' : 'USD ';

  const botones = i.estado === 'pendiente' ? (
    i.plan === 'complete'
      ? `
        <button class="btn-primario btn-sm" onclick="mostrarOpcionesPrioridadComplete('${i.id}', '${escaparHtmlSoporte(i.nombreLibro)}')">Aprobar</button>
        <button class="btn-secundario btn-sm btn-peligro" onclick="rechazarImpulsoAdmin('${i.id}', '${escaparHtmlSoporte(i.nombreLibro)}')">Rechazar</button>
      `
      : `
        <button class="btn-primario btn-sm" onclick="activarImpulsoAdmin('${i.id}', '${escaparHtmlSoporte(i.nombreLibro)}')">Activar impulso</button>
        <button class="btn-secundario btn-sm btn-peligro" onclick="rechazarImpulsoAdmin('${i.id}', '${escaparHtmlSoporte(i.nombreLibro)}')">Rechazar</button>
      `
  ) : (i.estado === 'pagado' && i.fechaFinSlider
      ? `<span style="font-size:12px;">En slider hasta ${String(i.fechaFinSlider).split('T')[0]}</span>`
      : '');

  const nombrePlan = i.plan ? i.plan.charAt(0).toUpperCase() + i.plan.slice(1) : 'Impulso';

  return `
    <tr>
      <td>${i.nombreLibro}</td>
      <td><span class="badge" style="background:var(--rosa-claro); color:var(--bordo);">${nombrePlan}</span></td>
      <td style="font-size:12px;">${i.aliasAutor || '—'}<br><span style="opacity:.7;">${i.emailAutor}</span></td>
      <td>${i.cuposDisponibles ?? '—'}</td>
      <td>${simbolo}${Number(i.precioLista).toLocaleString('es-AR')}</td>
      <td>${Number(i.creditosAplicados || 0) > 0
        ? `<span class="badge badge-aprobada">Sí · ${Number(i.creditosAplicados).toLocaleString('es-AR')}</span>`
        : `<span class="badge" style="background:rgba(0,0,0,0.08); color:var(--gris-suave);">No</span>`}</td>
      <td><strong>${simbolo}${Number(i.montoAPagar).toLocaleString('es-AR')}</strong></td>
      <td>${estadoBadge}</td>
      <td style="font-size:12px;">${i.fechaSolicitud ? String(i.fechaSolicitud).split('T')[0] : '—'}</td>
      <td id="impulso-acciones-${i.id}" style="display:flex; gap:6px; flex-wrap:wrap;">${botones}</td>
    </tr>
  `;
}

/**
 * Activa un impulso: dispara la notificación (mail + notificación in-app) a los
 * reseñadores de alta coincidencia y marca la campaña para entrar al slider.
 * Se hace desde una única función RPC (admin_activar_impulso) para que sea
 * un único click atómico, tal como está pensado el flujo.
 *
 * @param {string} idImpulso
 * @param {string} nombreLibro
 */
async function activarImpulsoAdmin(idImpulso, nombreLibro) {
  if (!confirm(`¿Confirmás que ya se cobró el impulso de "${nombreLibro}"?\n\nEsto va a notificar a los reseñadores de alta coincidencia y va a meter la campaña en el slider.`)) return;

  const resultado = await _ejecutarAccionImpulsoAdmin('admin_activar_impulso', { p_id_impulso: idImpulso });
  if (!resultado) return;

  mostrarToast(`Impulso activado. Se notificó a ${resultado.notificados ?? 0} reseñador(es).`, 'ok');
  await cargarImpulsosAdmin();
}

/**
 * Plan Complete: al aprobar, en vez de activar directo, muestra 3 botones
 * de prioridad (Match / Visibilidad / Confiabilidad). Elegir uno define el
 * algoritmo de búsqueda de reseñadoras y dispara la auditoría personalizada
 * (predefinida) al autor.
 */
function mostrarOpcionesPrioridadComplete(idImpulso, nombreLibro) {
  const celda = document.getElementById(`impulso-acciones-${idImpulso}`);
  if (!celda) return;

  celda.innerHTML = `
    <span style="font-size:12px; width:100%; margin-bottom:4px;">Elegí la prioridad para "${nombreLibro}":</span>
    <button class="btn-primario btn-sm" onclick="activarImpulsoCompleteConPrioridad('${idImpulso}', '${escaparHtmlSoporte(nombreLibro)}', 'match')">Prioriza Match</button>
    <button class="btn-primario btn-sm" onclick="activarImpulsoCompleteConPrioridad('${idImpulso}', '${escaparHtmlSoporte(nombreLibro)}', 'visibilidad')">Prioriza Visibilidad</button>
    <button class="btn-primario btn-sm" onclick="activarImpulsoCompleteConPrioridad('${idImpulso}', '${escaparHtmlSoporte(nombreLibro)}', 'confiabilidad')">Prioriza Confiabilidad</button>
    <button class="btn-secundario btn-sm" onclick="cargarImpulsosAdmin()">Cancelar</button>
  `;
}

async function activarImpulsoCompleteConPrioridad(idImpulso, nombreLibro, prioridad) {
  const nombresPrioridad = { match: 'Match', visibilidad: 'Visibilidad', confiabilidad: 'Confiabilidad' };
  if (!confirm(`¿Confirmás que ya se cobró el Complete de "${nombreLibro}" con prioridad ${nombresPrioridad[prioridad]}?\n\nEsto va a notificar a las reseñadoras que correspondan, meter la campaña en el slider por 2 semanas y mandarle al autor la auditoría personalizada.`)) return;

  const resultado = await _ejecutarAccionImpulsoAdmin('admin_activar_impulso', { p_id_impulso: idImpulso, p_prioridad: prioridad });
  if (!resultado) return;

  mostrarToast(`Complete activado (${nombresPrioridad[prioridad]}). Se notificó a ${resultado.notificados ?? 0} reseñador(es) y se envió la auditoría al autor.`, 'ok');
  await cargarImpulsosAdmin();
}

/**
 * Rechaza una solicitud de impulso pendiente (por ejemplo, si el autor nunca pagó).
 * Devuelve automáticamente los créditos que se hubieran aplicado como descuento.
 *
 * @param {string} idImpulso
 * @param {string} nombreLibro
 */
async function rechazarImpulsoAdmin(idImpulso, nombreLibro) {
  const motivo = prompt(`¿Motivo del rechazo del impulso de "${nombreLibro}"?`) || '';
  if (motivo === null) return;

  const resultado = await _ejecutarAccionImpulsoAdmin('admin_rechazar_impulso', { p_id_impulso: idImpulso, p_motivo: motivo });
  if (!resultado) return;

  mostrarToast('Impulso rechazado.', 'ok');
  await cargarImpulsosAdmin();
}

/**
 * Helper interno para llamar a las RPC de impulsos y mostrar el error en un toast
 * si algo falla, sin repetir el mismo boilerplate en cada acción.
 */
async function _ejecutarAccionImpulsoAdmin(nombreFuncion, params) {
  const { data: resultado, error } = await supabaseClient.rpc(nombreFuncion, params);

  if (error || !resultado || resultado.error) {
    mostrarToast(resultado?.error || error?.message || 'No se pudo completar la acción.', 'error');
    return null;
  }

  return resultado;
}


// ────────────────────────────────────────────────────────────
// PENDIENTES (tareas manuales: banner feed / banner cuadrado / historia IG)
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de tareas manuales pendientes (banner feed /
 * banner cuadrado / historia de Instagram) generadas automáticamente al
 * activar cada impulso. Impulso genera 1 banner cuadrado + 1 historia;
 * Select y Resistence generan 1 banner + 1 banner cuadrado + 1 historia;
 * Complete genera 1 banner + 1 banner cuadrado + 2 historias.
 */
async function cargarPendientesAdmin() {
  const contenedor = document.getElementById('admin-pendientes-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_tareas_impulso');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar las tareas pendientes.'}</p>`;
    return;
  }

  const tareas = resultado.tareas || [];

  if (tareas.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay tareas pendientes.</p></div>`;
    return;
  }

  // Las tareas de banner (feed / reseñadoras) cuya fecha de desactivación ya
  // pasó se consideran finalizadas y van al final del listado, para que arriba
  // queden siempre las tareas que todavía requieren acción.
  const tareasOrdenadas = [...tareas].sort((a, b) => {
    const vencidaA = _tareaImpulsoVencida(a) ? 1 : 0;
    const vencidaB = _tareaImpulsoVencida(b) ? 1 : 0;
    return vencidaA - vencidaB;
  });

  contenedor.innerHTML = `
    <p class="form-info" style="margin-bottom:14px;">
      Cada vez que se activa un impulso se generan acá las tareas manuales que hay que hacer
      (banner del feed, banner del panel de reseñadoras y/o historia de Instagram). Marcá
      "Hecho" cuando la subas. Para los banners, te calcula la fecha en la que hay que
      desactivarlos manualmente desde Banner publicitario (una semana para Impulso/Select/
      Resistence, dos semanas para Complete); la historia de Instagram no tiene fecha de
      desactivación. Los banners cuya fecha de desactivación ya pasó quedan marcados como
      "Finalizado" y se muestran al final.
    </p>
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Plan</th>
          <th>Libro</th>
          <th>Acción</th>
          <th>Estado</th>
          <th>Desactivar banner</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${tareasOrdenadas.map(t => construirFilaPendienteAdmin(t)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Indica si una tarea de banner (feed o reseñadoras) ya venció, es decir
 * si su fecha de desactivación programada ya pasó. Las historias de
 * Instagram no tienen fecha de desactivación, así que nunca se consideran
 * vencidas.
 *
 * @param {Object} t — datos de la tarea
 * @returns {boolean}
 */
function _tareaImpulsoVencida(t) {
  const esBanner = t.tipoAccion === 'banner' || t.tipoAccion === 'banner_cuadrado';
  if (!esBanner || !t.fechaDesactivarBanner) return false;
  return new Date(t.fechaDesactivarBanner).getTime() < Date.now();
}

/**
 * Construye la fila de una tarea pendiente para la tabla admin.
 *
 * @param {Object} t — datos de la tarea
 * @returns {string} HTML de la fila
 */
function construirFilaPendienteAdmin(t) {
  const nombrePlan = t.plan ? t.plan.charAt(0).toUpperCase() + t.plan.slice(1) : '—';
  const nombresAccion = {
    banner: 'Banner (feed)',
    banner_cuadrado: 'Banner (reseñadoras)',
    historia_instagram: 'Historia Instagram'
  };
  const nombreAccion = nombresAccion[t.tipoAccion] || t.tipoAccion || '—';
  const esBanner = t.tipoAccion === 'banner' || t.tipoAccion === 'banner_cuadrado';
  const vencida = _tareaImpulsoVencida(t);

  let estadoBadge = t.estado === 'hecho'
    ? '<span class="badge badge-aprobada">Hecho</span>'
    : '<span class="badge badge-pendiente">Pendiente</span>';
  if (vencida) {
    estadoBadge += ' <span class="badge badge-finalizada">Finalizado</span>';
  }

  const fechaDesactivar = t.fechaDesactivarBanner
    ? `<strong>${String(t.fechaDesactivarBanner).split('T')[0]}</strong>`
    : (esBanner ? '—' : '');

  const boton = t.estado === 'hecho'
    ? `<button class="btn-secundario btn-sm" onclick="marcarTareaImpulsoAdmin('${t.id}', 'pendiente')">Volver a pendiente</button>`
    : `<button class="btn-primario btn-sm" onclick="marcarTareaImpulsoAdmin('${t.id}', 'hecho')">Hecho</button>`;

  return `
    <tr${vencida ? ' style="opacity:0.6;"' : ''}>
      <td style="font-size:12px;">${t.fechaCreacion ? String(t.fechaCreacion).split('T')[0] : '—'}</td>
      <td><span class="badge" style="background:var(--rosa-claro); color:var(--bordo);">${nombrePlan}</span></td>
      <td>${t.nombreLibro || '—'}</td>
      <td>${nombreAccion}</td>
      <td>${estadoBadge}</td>
      <td style="font-size:12px;">${fechaDesactivar}</td>
      <td>${boton}</td>
    </tr>
  `;
}

/**
 * Marca una tarea pendiente como hecha (o la vuelve a pendiente). Si es un
 * banner de un plan con desactivación programada, el backend calcula solo
 * la fecha de desactivación (7 días Select/Resistence, 14 días Complete).
 */
async function marcarTareaImpulsoAdmin(idTarea, nuevoEstado) {
  const { data: resultado, error } = await supabaseClient.rpc('admin_marcar_tarea_impulso', {
    p_id_tarea: idTarea,
    p_estado: nuevoEstado
  });

  if (error || !resultado || resultado.error) {
    mostrarToast(resultado?.error || error?.message || 'No se pudo actualizar la tarea.', 'error');
    return;
  }

  await cargarPendientesAdmin();
}


// ────────────────────────────────────────────────────────────
// ESTADÍSTICAS
// ────────────────────────────────────────────────────────────

async function cargarEstadisticasAdmin() {
  const contenedor = document.getElementById('admin-estadisticas-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_estadisticas');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar las estadísticas.'}</p>`;
    return;
  }

  const { usuarios, campañas, reseñas } = resultado;
  const ratioPorCampaña = resultado.ratioPorCampaña || [];

  contenedor.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Autores</p>
        <p class="stat-valor">${usuarios.totalAutores}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Total de autores registrados en la plataforma.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Reseñadores</p>
        <p class="stat-valor">${usuarios.totalReseñadores}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Total de reseñadores registrados en la plataforma.</p>
      </div>
    </div>

    <div class="form-separador">Actividad</div>
    <div style="display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
      <div>
        <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">Desde</label>
        <input type="date" id="admin-actividad-desde" class="input-buscar" style="max-width:170px;" />
      </div>
      <div>
        <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">Hasta</label>
        <input type="date" id="admin-actividad-hasta" class="input-buscar" style="max-width:170px;" />
      </div>
      <button class="btn-secundario btn-sm" onclick="actualizarActividadAdmin()">Actualizar</button>
      <span style="font-size:11px; color:#888;">Por defecto: últimos 45 días.</span>
    </div>
    <div id="admin-actividad-cards" class="stats-grid"></div>

    <div class="form-separador">Campañas</div>
    <div class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Total</p>
        <p class="stat-valor">${campañas.total}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Todas las campañas creadas históricamente.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Activas</p>
        <p class="stat-valor">${campañas.activas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Campañas abiertas actualmente.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Finalizadas</p>
        <p class="stat-valor">${campañas.finalizadas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Campañas que llegaron a su fin de forma normal.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Canceladas</p>
        <p class="stat-valor">${campañas.canceladas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Campañas dadas de baja manualmente por vos o por el autor.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Activas con cupo completo</p>
        <p class="stat-valor">${campañas.activasCupoCompleto}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las campañas activas, cuántas ya no tienen cupos disponibles.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Activas con cupo disponible</p>
        <p class="stat-valor">${campañas.activasCupoIncompleto}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las campañas activas, cuántas todavía tienen cupos libres.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">% histórico que llenó cupo</p>
        <p class="stat-valor">${campañas.pctHistoricoLlenoCupo ?? '—'}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De todas las campañas creadas alguna vez, qué % llegó a agotar sus cupos (sin importar su estado actual).</p>
      </div>
    </div>

    <div class="form-separador">Reseñas</div>
    <div class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Total entregadas</p>
        <p class="stat-valor">${reseñas.totalEntregadas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Todas las reseñas cargadas históricamente en la plataforma.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Últimos 30 días</p>
        <p class="stat-valor">${reseñas.ultimos30Dias}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Reseñas entregadas en la última ventana móvil de 30 días (no "este mes calendario").</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Conversión</p>
        <p class="stat-valor">${reseñas.conversion}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De todo lo que alguna vez se aprobó (histórico), qué % terminó en una reseña entregada.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Completion total</p>
        <p class="stat-valor">${reseñas.completionTotal}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las asignaciones vencidas (excluye abandonos avisados y campañas canceladas por el autor), qué % se entregó (tarde o en término).</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Completion a tiempo</p>
        <p class="stat-valor">${reseñas.completionATiempo}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las mismas asignaciones vencidas, qué % se entregó antes del deadline.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Tasa de abandono</p>
        <p class="stat-valor">${reseñas.tasaAbandono}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las asignaciones vencidas (sin contar abandonos avisados ni campañas canceladas por el autor), qué % nunca se entregó. Es incumplimiento real.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Abandono avisado</p>
        <p class="stat-valor">${reseñas.abandonoAvisado} <span style="font-size:14px; color:#888;">(${reseñas.abandonoAvisadoPct}%)</span></p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Reseñadoras que cancelaron formalmente su postulación avisando, en vez de simplemente no entregar. No cuenta como incumplimiento.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Tiempo promedio de entrega</p>
        <p class="stat-valor">${reseñas.tiempoPromedioEntregaDias ?? '—'} días</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Promedio de días entre la aprobación de la postulación y la entrega efectiva de la reseña.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Asignaciones vencidas</p>
        <p class="stat-valor">${reseñas.asignacionesVencidas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Asignaciones con deadline vencido, aprobadas y de campañas no canceladas (es la base real sobre la que se calculan completion y abandono).</p>
      </div>
    </div>
    
    <div class="form-separador">Retención</div>
    <div class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Autores con 2+ campañas</p>
        <p class="stat-valor">${resultado.retencion.autoresConDosMasCampañas ?? '—'}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De los autores que publicaron alguna vez, qué % publicó más de una campaña (histórico).</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Reseñadores con 2+ campañas</p>
        <p class="stat-valor">${resultado.retencion.reseñadoresConDosMasCampañas ?? '—'}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De los reseñadores que participaron alguna vez, qué % lo hizo en más de una campaña (histórico).</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Tiempo de aprobación</p>
        <p class="stat-valor">${resultado.retencion.tiempoAprobacionPromedioHoras ?? '—'} hs</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Promedio de horas entre que un reseñador se postula y el autor responde. Mediana: ${resultado.retencion.tiempoAprobacionMedianaHoras ?? '—'} hs.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Tiempo hasta agotar cupos</p>
        <p class="stat-valor">${resultado.retencion.tiempoCompletarCuposPromedioDias ?? '—'}${resultado.retencion.tiempoCompletarCuposPromedioDias != null ? ' días' : ''}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">
          ${resultado.retencion.tiempoCompletarCuposMuestra > 0
            ? `Promedio de días entre la creación de la campaña y que se agotan los cupos. Mediana: ${resultado.retencion.tiempoCompletarCuposMedianaDias} días (n=${resultado.retencion.tiempoCompletarCuposMuestra}).`
            : 'Todavía ninguna campaña agotó sus cupos antes del vencimiento — sin datos suficientes.'}
        </p>
      </div>
    </div>

    <div class="form-separador">Ratio de incumplimiento por campaña</div>
    <p style="font-size:12px; color:#888; margin:0 0 12px;">
      Por cada campaña: de las postulaciones aprobadas que ya tienen un desenlace conocido (se entregó la reseña, en cualquier momento, o venció el plazo sin entregarla), qué % nunca entregó (incumplidas / (entregadas + incumplidas)). Las que todavía están en curso y sin vencer no suman ni restan. Ordenado de mayor a menor ratio, para detectar primero las campañas que más están sufriendo incumplimientos. Ratio en rojo a partir de 60%.
    </p>
    ${ratioPorCampaña.length === 0
      ? `<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no hay campañas con postulaciones aprobadas.</p></div>`
      : `
        <table class="admin-tabla">
          <thead>
            <tr>
              <th>Libro</th>
              <th>Autor</th>
              <th>Aprobadas</th>
              <th>Vencidas</th>
              <th>Entregadas</th>
              <th>Incumplidas</th>
              <th>Ratio incumplimiento</th>
            </tr>
          </thead>
          <tbody>
            ${ratioPorCampaña.map(c => construirFilaRatioCampañaAdmin(c)).join('')}
          </tbody>
        </table>
      `
    }
  `;

  // Rango por defecto: últimos 45 días (hoy incluido). Se precargan los inputs
  // y se dispara la carga de la sección "Actividad" con ese rango.
  const hoy = new Date();
  const hace45 = new Date();
  hace45.setDate(hoy.getDate() - 45);
  const formatoFecha = (d) => d.toISOString().slice(0, 10);

  const inputDesde = document.getElementById('admin-actividad-desde');
  const inputHasta = document.getElementById('admin-actividad-hasta');
  if (inputDesde) inputDesde.value = formatoFecha(hace45);
  if (inputHasta) inputHasta.value = formatoFecha(hoy);

  cargarActividadAdmin(formatoFecha(hace45), formatoFecha(hoy));
}

/**
 * Carga las 3 tarjetas de "Actividad" (autores sin actividad, reseñadores sin
 * actividad, usuarios nuevos) para el rango de fechas indicado, llamando a la
 * función admin_estadisticas_actividad(p_fecha_desde, p_fecha_hasta) en Supabase.
 *
 * @param {string} fechaDesde — 'YYYY-MM-DD'
 * @param {string} fechaHasta — 'YYYY-MM-DD'
 */
async function cargarActividadAdmin(fechaDesde, fechaHasta) {
  const contenedor = document.getElementById('admin-actividad-cards');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_estadisticas_actividad', {
    p_fecha_desde: fechaDesde || null,
    p_fecha_hasta: fechaHasta || null
  });

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || error?.message || 'Error al cargar la actividad.'}</p>`;
    return;
  }

  const rangoTexto = `${resultado.rangoDesde} al ${resultado.rangoHasta}`;

  contenedor.innerHTML = `
    <div class="stat-card">
      <p class="stat-label">Autores sin actividad</p>
      <p class="stat-valor">${resultado.autoresSinActividad}</p>
      <p style="font-size:11px; color:#888; margin:2px 0 0;">Autores activos sin crear campaña, responder postulaciones, editar libros ni pedir impulsos entre ${rangoTexto}.</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Reseñadores sin actividad</p>
      <p class="stat-valor">${resultado.reseñadoresSinActividad}</p>
      <p style="font-size:11px; color:#888; margin:2px 0 0;">Reseñadores activos sin postularse, entregar reseñas ni marcar favoritos entre ${rangoTexto}.</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Usuarios nuevos</p>
      <p class="stat-valor">${resultado.usuariosNuevos}</p>
      <p style="font-size:11px; color:#888; margin:2px 0 0;">Usuarios (cualquier rol) registrados entre ${rangoTexto}.</p>
    </div>
  `;
}

/**
 * Handler del botón "Actualizar" de la sección Actividad: toma las fechas
 * elegidas en los inputs y recarga las 3 tarjetas con ese rango.
 */
function actualizarActividadAdmin() {
  const desde = document.getElementById('admin-actividad-desde')?.value;
  const hasta = document.getElementById('admin-actividad-hasta')?.value;

  if (!desde || !hasta) {
    mostrarToast('Elegí las dos fechas (desde y hasta).', 'error');
    return;
  }
  if (desde > hasta) {
    mostrarToast('La fecha "desde" no puede ser posterior a "hasta".', 'error');
    return;
  }

  cargarActividadAdmin(desde, hasta);
}

/**
 * Construye la fila de una campaña para la tabla de ratio de entrega.
 *
 * @param {Object} c — { nombre_libro, nombre_autor, aprobadas, vencidas, entregadas, incumplidas, ratio }
 *   ratio = % de incumplimiento = incumplidas / (entregadas + incumplidas). Se resalta en rojo a partir de 60%.
 * @returns {string} HTML de la fila
 */
function construirFilaRatioCampañaAdmin(c) {
  return `
    <tr>
      <td>${c.nombre_libro}</td>
      <td style="font-size:12px;">${c.nombre_autor}</td>
      <td>${c.aprobadas}</td>
      <td style="${c.vencidas > 0 ? 'color:#c0392b;' : ''}">${c.vencidas}</td>
      <td>${c.entregadas}</td>
      <td style="${c.incumplidas > 0 ? 'color:#c0392b;' : ''}">${c.incumplidas}</td>
      <td style="${c.ratio >= 60 ? 'color:#c0392b; font-weight:600;' : ''}">${c.ratio}%</td>
    </tr>
  `;
}


// ────────────────────────────────────────────────────────────
// SOPORTE (TICKETS)
// ────────────────────────────────────────────────────────────

async function cargarTicketsAdmin() {
  const contenedor = document.getElementById('admin-tickets-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_tickets');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar los tickets.'}</p>`;
    return;
  }

  const tickets = resultado.tickets || [];
  window._ticketsAdmin = tickets; // guardamos para poder usar asunto/email en el modal
  window._ticketsSeleccionadosAdmin = new Set(); // reseteamos selección al recargar

  if (tickets.length === 0) {
    contenedor.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button class="btn-secundario btn-sm" onclick="abrirModalNuevoTicketAdmin()">+ Nuevo ticket</button>
      </div>
      <div class="estado-vacio"><p class="estado-vacio-texto">No hay tickets de soporte.</p></div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
      <button id="admin-btn-cerrar-seleccionados" class="btn-secundario btn-sm btn-peligro" style="display:none;" onclick="cerrarTicketsSeleccionadosAdmin()">Cerrar seleccionados (0)</button>
      <button class="btn-secundario btn-sm" style="margin-left:auto;" onclick="abrirModalNuevoTicketAdmin()">+ Nuevo ticket</button>
    </div>
    <table class="admin-tabla">
      <thead>
        <tr>
          <th style="width:30px;"><input type="checkbox" id="admin-ticket-check-todos" onchange="toggleSeleccionarTodosTicketsAdmin(this.checked)" /></th>
          <th>Email</th>
          <th>Rol</th>
          <th>Asunto</th>
          <th>Mensaje</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${tickets.map(t => construirFilaTicketAdmin(t)).join('')}
      </tbody>
    </table>
  `;
}

function construirFilaTicketAdmin(t) {
  const tipoBadge = t.tipo === 'denuncia'
    ? `<span class="badge badge-rechazada">🚩 Denuncia${t.categoria ? ' · ' + t.categoria : ''}</span>`
    : '';
  const estadoBadge = t.estado === 'cerrado'
    ? '<span class="badge badge-cancelada">Cerrado</span>'
    : t.estado === 'respondido'
    ? '<span class="badge badge-aprobada">Respondido</span>'
    : '<span class="badge badge-pendiente">Pendiente</span>';

  const botones = `
    <button class="btn-secundario btn-sm" onclick="abrirModalTicketAdmin('${t.idTicket}')">Ver / Responder</button>
    ${t.estado !== 'cerrado' ? `<button class="btn-secundario btn-sm btn-peligro" onclick="cerrarTicketAdmin('${t.idTicket}')">Cerrar</button>` : ''}
  `;
  const checkbox = t.estado !== 'cerrado'
    ? `<input type="checkbox" class="admin-ticket-checkbox" onchange="toggleSeleccionTicketAdmin('${t.idTicket}', this.checked)" />`
    : '';
  return `
    <tr>
      <td style="text-align:center;">${checkbox}</td>
      <td style="font-size:12px;">${t.email}</td>
      <td><span class="badge badge-nivel">${t.rol || '—'}</span></td>
      <td>${tipoBadge || t.asunto || ''} ${t.adjuntoKey ? '📎' : ''}</td>
      <td style="max-width:280px; font-size:12px;">${t.mensaje}</td>
      <td style="font-size:12px;">${t.fecha ? String(t.fecha).split('T')[0] : '—'}</td>
      <td>${estadoBadge}</td>
      <td style="display:flex; gap:6px;">${botones}</td>
    </tr>
  `;
}

// ────────────────────────────────────────────────────────────
// SELECCIÓN MÚLTIPLE Y CIERRE MASIVO DE TICKETS
// ────────────────────────────────────────────────────────────

function toggleSeleccionTicketAdmin(idTicket, marcado) {
  if (!window._ticketsSeleccionadosAdmin) window._ticketsSeleccionadosAdmin = new Set();
  if (marcado) {
    window._ticketsSeleccionadosAdmin.add(idTicket);
  } else {
    window._ticketsSeleccionadosAdmin.delete(idTicket);
    // si desmarcan uno a mano, el checkbox "todos" deja de estar en estado marcado
    const checkTodos = document.getElementById('admin-ticket-check-todos');
    if (checkTodos) checkTodos.checked = false;
  }
  actualizarBotonCerrarSeleccionadosAdmin();
}

function toggleSeleccionarTodosTicketsAdmin(marcarTodos) {
  if (!window._ticketsSeleccionadosAdmin) window._ticketsSeleccionadosAdmin = new Set();
  const checkboxes = document.querySelectorAll('.admin-ticket-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = marcarTodos;
    const fila = cb.closest('tr');
    const idTicket = fila?.querySelector('[onclick^="abrirModalTicketAdmin"]')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (!idTicket) return;
    if (marcarTodos) window._ticketsSeleccionadosAdmin.add(idTicket);
    else window._ticketsSeleccionadosAdmin.delete(idTicket);
  });
  actualizarBotonCerrarSeleccionadosAdmin();
}

function actualizarBotonCerrarSeleccionadosAdmin() {
  const boton = document.getElementById('admin-btn-cerrar-seleccionados');
  if (!boton) return;
  const cantidad = window._ticketsSeleccionadosAdmin?.size || 0;
  if (cantidad === 0) {
    boton.style.display = 'none';
  } else {
    boton.style.display = 'inline-block';
    boton.textContent = `Cerrar seleccionados (${cantidad})`;
  }
}

async function cerrarTicketsSeleccionadosAdmin() {
  const ids = Array.from(window._ticketsSeleccionadosAdmin || []);
  if (ids.length === 0) return;

  if (!confirm(`¿Cerrar ${ids.length} ticket${ids.length > 1 ? 's' : ''} de soporte?`)) return;

  const token = await obtenerTokenFresco();
  if (!token) {
    mostrarToast('No se pudo autenticar la sesión de admin.', 'error');
    return;
  }

  const boton = document.getElementById('admin-btn-cerrar-seleccionados');
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Cerrando...';
  }

  let exitosos = 0;
  let fallidos = 0;

  for (const idTicket of ids) {
    try {
      const { data, error } = await supabaseClient.functions.invoke('soporte-cerrar-ticket', {
        body: { id_ticket: idTicket },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (error || data?.error) {
        fallidos++;
      } else {
        exitosos++;
      }
    } catch (e) {
      fallidos++;
    }
  }

  if (fallidos === 0) {
    mostrarToast(`${exitosos} ticket${exitosos > 1 ? 's' : ''} cerrado${exitosos > 1 ? 's' : ''}.`, 'ok');
  } else {
    mostrarToast(`${exitosos} cerrado${exitosos > 1 ? 's' : ''}, ${fallidos} falló${fallidos > 1 ? 'ron' : ''}.`, exitosos > 0 ? 'ok' : 'error');
  }

  window._ticketsSeleccionadosAdmin = new Set();
  await cargarTicketsAdmin();
}

// ────────────────────────────────────────────────────────────
// ESTADÍSTICAS DE SOPORTE (encuestas de satisfacción)
// ────────────────────────────────────────────────────────────

async function cargarEstadisticasSoporteAdmin() {
  const contenedor = document.getElementById('admin-estadisticas-soporte-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_estadisticas_soporte');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar las estadísticas de soporte.'}</p>`;
    return;
  }

  const { ultimos30Dias: u, tendencia: t, totalRespuestasHistorico, respuestas } = resultado;

  contenedor.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Respuestas (30 días)</p>
        <p class="stat-valor">${u.totalRespuestas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Total histórico: ${totalRespuestasHistorico}.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Promedio atención</p>
        <p class="stat-valor">${u.promedioAtencion} / 5</p>
        <p style="font-size:11px; margin:2px 0 0; color:${_colorDeltaSoporte(t.deltaAtencion)};">${_textoDeltaSoporte(t.deltaAtencion)} vs mes anterior (${t.promedioAtencionMesAnterior})</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Promedio rapidez</p>
        <p class="stat-valor">${u.promedioRapidez} / 5</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Últimos 30 días.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">% resuelto</p>
        <p class="stat-valor">${u.pctResuelto}%</p>
        <p style="font-size:11px; margin:2px 0 0; color:${_colorDeltaSoporte(t.deltaPctResuelto)};">${_textoDeltaSoporte(t.deltaPctResuelto)} vs mes anterior (${t.pctResueltoMesAnterior}%)</p>
      </div>
    </div>

    <div class="form-separador">Respuestas (últimos 30 días)</div>
    ${!respuestas || respuestas.length === 0
      ? `<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no hay respuestas a la encuesta en este período.</p></div>`
      : `
        <table class="admin-tabla">
          <thead>
            <tr>
              <th>Asunto</th>
              <th>¿Resuelto?</th>
              <th>Atención</th>
              <th>Rapidez</th>
              <th>Comentario</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${respuestas.map(r => construirFilaEncuestaSoporteAdmin(r)).join('')}
          </tbody>
        </table>
      `
    }
  `;
}

function _colorDeltaSoporte(delta) {
  if (delta > 0) return '#2e7d32';
  if (delta < 0) return '#c0392b';
  return '#888';
}

function _textoDeltaSoporte(delta) {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return '— sin cambios';
}

function construirFilaEncuestaSoporteAdmin(r) {
  const resueltoBadge = r.problema_resuelto === 'si'
    ? '<span class="badge badge-aprobada">Sí</span>'
    : r.problema_resuelto === 'no'
    ? '<span class="badge badge-rechazada">No</span>'
    : '<span class="badge badge-pendiente">—</span>';

  const filaStyle = r.necesita_atencion ? 'background:rgba(192,57,43,0.06);' : '';

  return `
    <tr style="${filaStyle}">
      <td>${r.asunto || '—'}</td>
      <td>${resueltoBadge}</td>
      <td>${r.puntuacion_atencion ?? '—'}</td>
      <td>${r.puntuacion_rapidez ?? '—'}</td>
      <td style="max-width:280px; font-size:12px;">${escaparHtmlSoporte(r.comentario || '')}</td>
      <td style="font-size:12px;">${r.respondido_en ? String(r.respondido_en).split('T')[0] : '—'}</td>
    </tr>
  `;
}

// ────────────────────────────────────────────────────────────
// MODAL: historial de conversación + responder
// ────────────────────────────────────────────────────────────

function _renderLinkDenunciaAdmin(ticket) {
  const mapa = {
    campana:          { label: 'Ver campaña denunciada →',  accion: `verDetalleCampaña('${ticket.referenciaId}')` },
    usuario_autor:    { label: 'Ver perfil denunciado →',   accion: `abrirPerfilPublico('${ticket.referenciaId}', 'autor')` },
    usuario_resenador:{ label: 'Ver perfil denunciado →',   accion: `abrirPerfilPublico('${ticket.referenciaId}', 'reseñador')` }
  };
  const info = mapa[ticket.referenciaTipo];
  if (!info) return '';
  return `
    <p style="font-size:12px; margin:0 0 12px;">
      <a href="#" onclick="event.preventDefault(); cerrarModalTicketAdmin(); ${info.accion}">${info.label}</a>
    </p>
  `;
}
  
async function abrirModalTicketAdmin(idTicket) {
  const ticket = (window._ticketsAdmin || []).find(t => t.idTicket === idTicket);

  const overlay = document.createElement('div');
  overlay.id = 'modal-ticket-soporte';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:20px; max-width:520px; width:90%; max-height:80vh; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0; font-size:16px;">${ticket?.asunto || 'Ticket de soporte'}</h3>
        <button onclick="cerrarModalTicketAdmin()" style="background:none; border:none; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>
      <p style="font-size:12px; color:#888; margin:0 0 12px;">${ticket?.email || ''}</p>
      ${ticket?.tipo === 'denuncia' ? _renderLinkDenunciaAdmin(ticket) : ''}
      ${ticket?.adjuntoKey ? `
        <p style="font-size:12px; margin:0 0 12px;">
          <a href="#" onclick="event.preventDefault(); verAdjuntoSoporte('${idTicket}', '${ticket.adjuntoKey}')">📎 Ver adjunto del mensaje original (${escaparHtmlSoporte(ticket.adjuntoNombre || 'archivo')})</a>
        </p>
      ` : ''}
      <div id="modal-ticket-historial" style="flex:1; overflow-y:auto; margin-bottom:12px; min-height:80px;">
        <div class="cargando-container"><div class="spinner"></div></div>
      </div>
      <textarea id="modal-ticket-mensaje" rows="3" placeholder="Escribí tu respuesta..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-family:inherit; resize:vertical; box-sizing:border-box;"></textarea>
      <div style="margin-top:8px;">
        <label style="font-size:12px; color:#888;">Adjuntar archivo a la respuesta (opcional, jpg/png/webp/heic/pdf, máx. 8MB)</label>
        <input type="file" id="modal-ticket-adjunto" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" style="display:block; margin-top:4px; font-size:12px;" />
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
        <button class="btn-secundario btn-sm" onclick="cerrarModalTicketAdmin()">Cancelar</button>
        <button class="btn-secundario btn-sm" onclick="enviarRespuestaModalTicket('${idTicket}')">Enviar respuesta</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  await cargarHistorialModalTicket(idTicket);
}

async function cargarHistorialModalTicket(idTicket) {
  const contenedor = document.getElementById('modal-ticket-historial');
  if (!contenedor) return;

  const { data: mensajes, error } = await supabaseClient
    .from('soporte_mensajes')
    .select('autor, cuerpo, creado_en, adjunto_key, adjunto_nombre, adjunto_tipo')
    .eq('id_ticket', idTicket)
    .order('creado_en', { ascending: true });

  if (error) {
    contenedor.innerHTML = '<p class="mensaje-error">No se pudo cargar la conversación.</p>';
    return;
  }

  if (!mensajes || mensajes.length === 0) {
    contenedor.innerHTML = '<p style="font-size:13px; color:#888;">Todavía no hay mensajes en esta conversación.</p>';
    return;
  }

  contenedor.innerHTML = mensajes.map(m => `
    <div style="margin-bottom:10px; padding:10px; border-radius:8px; background:${m.autor === 'admin' ? '#eef3ff' : '#f4f4f4'};">
      <div style="font-size:11px; color:#888; margin-bottom:4px;">
        ${m.autor === 'admin' ? 'Admin' : 'Usuario'} — ${m.creado_en ? new Date(m.creado_en).toLocaleString() : ''}
      </div>
      <div style="font-size:13px; white-space:pre-wrap;">${escaparHtmlSoporte(m.cuerpo)}</div>
      ${m.adjunto_key ? `
        <div style="margin-top:6px;">
          <a href="#" onclick="event.preventDefault(); verAdjuntoSoporte('${idTicket}', '${m.adjunto_key}')" style="font-size:12px;">📎 ${escaparHtmlSoporte(m.adjunto_nombre || 'Ver adjunto')}</a>
        </div>
      ` : m.adjunto_nombre ? `
        <div style="margin-top:6px; font-size:12px; color:#888;">📎 ${escaparHtmlSoporte(m.adjunto_nombre)} (enviado por mail)</div>
      ` : ''}
    </div>
  `).join('');

  contenedor.scrollTop = contenedor.scrollHeight;
}

function escaparHtmlSoporte(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

function cerrarModalTicketAdmin() {
  document.getElementById('modal-ticket-soporte')?.remove();
}

// ────────────────────────────────────────────────────────────
// MODAL: crear un ticket nuevo (iniciado por el admin)
// ────────────────────────────────────────────────────────────

function abrirModalNuevoTicketAdmin() {
  const overlay = document.createElement('div');
  overlay.id = 'modal-nuevo-ticket-soporte';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:20px; max-width:480px; width:90%;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px;">Nuevo ticket de soporte</h3>
        <button onclick="cerrarModalNuevoTicketAdmin()" style="background:none; border:none; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>
      <label style="font-size:12px; color:#888;">Usuario (buscar por email o alias)</label>
      <div style="position:relative;">
        <input type="text" id="nuevo-ticket-busqueda" autocomplete="off" placeholder="Escribí para buscar..." oninput="buscarUsuarioNuevoTicket()" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-family:inherit; box-sizing:border-box; margin:4px 0 0;" />
        <div id="nuevo-ticket-resultados" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #ddd; border-top:none; border-radius:0 0 8px 8px; max-height:160px; overflow-y:auto; z-index:10;"></div>
      </div>
      <input type="hidden" id="nuevo-ticket-email" />
      <div id="nuevo-ticket-info-usuario" style="font-size:12px; color:#888; margin:6px 0 10px;"></div>
      <label style="font-size:12px; color:#888;">Asunto</label>
      <input type="text" id="nuevo-ticket-asunto" placeholder="Asunto del mensaje" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-family:inherit; box-sizing:border-box; margin:4px 0 10px;" />
      <label style="font-size:12px; color:#888;">Mensaje</label>
      <textarea id="nuevo-ticket-mensaje" rows="4" placeholder="Escribí el mensaje..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-family:inherit; resize:vertical; box-sizing:border-box; margin:4px 0 10px;"></textarea>
      <label style="font-size:12px; color:#888;">Adjuntar archivo (opcional, jpg/png/webp/heic/pdf, máx. 8MB)</label>
      <input type="file" id="nuevo-ticket-adjunto" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" style="display:block; margin-top:4px; font-size:12px;" />
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
        <button class="btn-secundario btn-sm" onclick="cerrarModalNuevoTicketAdmin()">Cancelar</button>
        <button class="btn-secundario btn-sm" onclick="enviarNuevoTicketAdmin()">Crear y enviar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  asegurarUsuariosAdminCargados();
}

/**
 * Garantiza que window._usuariosAdmin esté disponible antes de buscar,
 * sin depender de que la pestaña Usuarios se haya cargado antes.
 */
async function asegurarUsuariosAdminCargados() {
  if (window._usuariosAdmin && window._usuariosAdmin.length > 0) return;

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_usuarios');
  if (!error && resultado && !resultado.error) {
    window._usuariosAdmin = resultado.usuarios || [];
  }
}

function cerrarModalNuevoTicketAdmin() {
  document.getElementById('modal-nuevo-ticket-soporte')?.remove();
}

function buscarUsuarioNuevoTicket() {
  // cualquier edición en el texto invalida la selección anterior
  document.getElementById('nuevo-ticket-email').value = '';
  document.getElementById('nuevo-ticket-info-usuario').innerHTML = '';

  const texto = (document.getElementById('nuevo-ticket-busqueda')?.value || '').trim().toLowerCase();
  const resultados = document.getElementById('nuevo-ticket-resultados');

  if (!texto) {
    resultados.style.display = 'none';
    resultados.innerHTML = '';
    return;
  }

  const coincidencias = (window._usuariosAdmin || [])
    .filter(u => u.email.toLowerCase().includes(texto) || (u.alias || '').toLowerCase().includes(texto))
    .slice(0, 8);

  if (coincidencias.length === 0) {
    resultados.innerHTML = '<div style="padding:8px; font-size:12px; color:#888;">Sin coincidencias.</div>';
    resultados.style.display = 'block';
    return;
  }

  resultados.innerHTML = coincidencias.map(u => `
    <div onclick='seleccionarUsuarioNuevoTicket(${JSON.stringify(u.email)})' style="padding:8px; font-size:12px; cursor:pointer; border-bottom:1px solid #f0f0f0;" onmouseover="this.style.background='#f7f7f7'" onmouseout="this.style.background='transparent'">
      <strong>${u.email}</strong>${u.alias ? ` — ${u.alias}` : ''} <span style="color:#888;">(${u.rol || '—'})</span>
    </div>
  `).join('');
  resultados.style.display = 'block';
}

async function seleccionarUsuarioNuevoTicket(email) {
  document.getElementById('nuevo-ticket-email').value = email;
  document.getElementById('nuevo-ticket-busqueda').value = email;
  const resultados = document.getElementById('nuevo-ticket-resultados');
  resultados.style.display = 'none';
  resultados.innerHTML = '';

  const infoDiv = document.getElementById('nuevo-ticket-info-usuario');
  infoDiv.innerHTML = 'Cargando...';

  const { data: resultado, error } = await supabaseClient.rpc('admin_info_soporte_usuario', { p_email: email });

  if (error || !resultado || resultado.error) {
    infoDiv.innerHTML = '';
    return;
  }

  const { rol, items } = resultado;

  if (rol === 'autor') {
    infoDiv.innerHTML = !items || items.length === 0
      ? 'Autor sin campañas activas.'
      : `Campañas activas: ${items.map(i => i.nombreLibro).join(', ')}.`;
  } else if (rol === 'reseñador') {
    infoDiv.innerHTML = !items || items.length === 0
      ? 'Reseñador sin aprobaciones activas.'
      : `Aprobado en: ${items.map(i => i.nombreLibro).join(', ')}.`;
  } else {
    infoDiv.innerHTML = '';
  }
}

async function enviarNuevoTicketAdmin() {
  const email = document.getElementById('nuevo-ticket-email')?.value?.trim();
  const asunto = document.getElementById('nuevo-ticket-asunto')?.value?.trim();
  const mensaje = document.getElementById('nuevo-ticket-mensaje')?.value?.trim();

  if (!email || !mensaje) {
    mostrarToast('Completá el email y el mensaje.', 'error');
    return;
  }

  const token = await obtenerTokenFresco();
  if (!token) {
    mostrarToast('No se pudo autenticar la sesión de admin.', 'error');
    return;
  }

  let adjunto = null;
  const inputAdjunto = document.getElementById('nuevo-ticket-adjunto');
  const archivo = inputAdjunto?.files?.[0];
  if (archivo) {
    if (archivo.size > MAX_BYTES_ADJUNTO_ADMIN) {
      mostrarToast('El archivo es demasiado grande (máximo 8MB).', 'error');
      return;
    }
    const formato = (archivo.name.split('.').pop() || '').toLowerCase();
    const tipo = TIPOS_ADJUNTO_ADMIN[formato];
    if (!tipo) {
      mostrarToast('Formato no permitido. Usá jpg, png, webp, heic o pdf.', 'error');
      return;
    }
    try {
      const contenidoBase64 = await archivoABase64(archivo);
      adjunto = { nombre: archivo.name, tipo, contenidoBase64 };
    } catch (e) {
      mostrarToast(e.message || 'No se pudo leer el archivo.', 'error');
      return;
    }
  }

  const { data, error } = await supabaseClient.functions.invoke('soporte-crear-ticket-admin', {
    body: { email, asunto, mensaje, adjunto },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error || data?.error) {
    mostrarToast(data?.error || error?.message || 'No se pudo crear el ticket.', 'error');
    return;
  }

  mostrarToast('Ticket creado y mail enviado.', 'ok');
  cerrarModalNuevoTicketAdmin();
  await cargarTicketsAdmin();
}

async function obtenerTokenFresco() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const vencePronto = session.expires_at && (session.expires_at * 1000 - Date.now() < 60_000);

  if (vencePronto) {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (error || !data?.session) return null;
    return data.session.access_token;
  }

  return session.access_token;
}

// Adjuntos de la respuesta del admin: viajan como base64 dentro del mismo
// request a soporte-responder, sin pasar por R2 (no hace falta guardarlos,
// solo van embebidos en el mail).
const TIPOS_ADJUNTO_ADMIN = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf' };
const MAX_BYTES_ADJUNTO_ADMIN = 8 * 1024 * 1024;

function archivoABase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '');
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

async function verAdjuntoSoporte(idTicket, key) {
  const token = await obtenerTokenFresco();
  if (!token) {
    mostrarToast('No se pudo autenticar la sesión de admin.', 'error');
    return;
  }
  const { data, error } = await supabaseClient.functions.invoke('obtener-adjunto-soporte', {
    body: { id_ticket: idTicket, key },
    headers: { Authorization: `Bearer ${token}` }
  });
  if (error || data?.error || !data?.url) {
    mostrarToast(data?.error || error?.message || 'No se pudo abrir el adjunto.', 'error');
    return;
  }
  window.open(data.url, '_blank');
}

async function enviarRespuestaModalTicket(idTicket) {
  const textarea = document.getElementById('modal-ticket-mensaje');
  const mensaje = textarea?.value?.trim();
  if (!mensaje) {
    mostrarToast('Escribí un mensaje antes de enviar.', 'error');
    return;
  }

  const token = await obtenerTokenFresco();
  if (!token) {
    mostrarToast('No se pudo autenticar la sesión de admin.', 'error');
    return;
  }

  let adjunto = null;
  const inputAdjunto = document.getElementById('modal-ticket-adjunto');
  const archivo = inputAdjunto?.files?.[0];
  if (archivo) {
    if (archivo.size > MAX_BYTES_ADJUNTO_ADMIN) {
      mostrarToast('El archivo es demasiado grande (máximo 8MB).', 'error');
      return;
    }
    const formato = (archivo.name.split('.').pop() || '').toLowerCase();
    const tipo = TIPOS_ADJUNTO_ADMIN[formato];
    if (!tipo) {
      mostrarToast('Formato no permitido. Usá jpg, png, webp, heic o pdf.', 'error');
      return;
    }
    try {
      const contenidoBase64 = await archivoABase64(archivo);
      adjunto = { nombre: archivo.name, tipo, contenidoBase64 };
    } catch (e) {
      mostrarToast(e.message || 'No se pudo leer el archivo.', 'error');
      return;
    }
  }

  const { data, error } = await supabaseClient.functions.invoke('soporte-responder', {
    body: { id_ticket: idTicket, mensaje, adjunto },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error || data?.error) {
    mostrarToast(data?.error || error?.message || 'No se pudo enviar la respuesta.', 'error');
    return;
  }

  mostrarToast('Respuesta enviada.', 'ok');
  textarea.value = '';
  if (inputAdjunto) inputAdjunto.value = '';
  await cargarHistorialModalTicket(idTicket);
  await cargarTicketsAdmin();
}

async function cerrarTicketAdmin(idTicket) {
  if (!confirm('¿Cerrar este ticket?')) return;

   const token = await obtenerTokenFresco();
  if (!token) {
    mostrarToast('No se pudo autenticar la sesión de admin.', 'error');
    return;
  }

  const { data, error } = await supabaseClient.functions.invoke('soporte-cerrar-ticket', {
    body: { id_ticket: idTicket },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error || data?.error) {
    mostrarToast(data?.error || error?.message || 'No se pudo cerrar el ticket.', 'error');
    return;
  }

  mostrarToast('Ticket cerrado.', 'ok');
  cerrarModalTicketAdmin();
  await cargarTicketsAdmin();
}

// ────────────────────────────────────────────────────────────
// MODALES DE ACTUALIZACIÓN
// ────────────────────────────────────────────────────────────

async function cargarModalesAdmin() {
  const formCont = document.getElementById('admin-modales-form-contenedor');
  const listaCont = document.getElementById('admin-modales-lista');
  if (!formCont || !listaCont) return;

  formCont.innerHTML = `
    <div class="plan-info" style="margin-bottom:24px;">
      <p class="plan-nombre" style="font-size:18px;">Nuevo modal de actualización</p>
      <form id="form-nuevo-modal-actualizacion" onsubmit="crearModalActualizacionAdmin(event)">
        <div class="form-grupo">
          <label class="form-label">Título *</label>
          <input type="text" id="modal-act-titulo" class="form-input" required />
        </div>
        <div class="form-grupo">
          <label class="form-label">Texto *</label>
          <textarea id="modal-act-texto" class="form-textarea" rows="6" required placeholder="Contenido del modal. Podés usar saltos de línea."></textarea>
        </div>
        <div class="form-grupo">
          <label class="form-label">Imagen decorativa (opcional)</label>
          <input type="url" id="modal-act-imagen" class="form-input" placeholder="https://..." />
        </div>
        <div class="form-grupo">
          <label class="form-label">¿A quién se le muestra? *</label>
          <select id="modal-act-alcance" class="form-input">
            <option value="todos">Todos los usuarios</option>
            <option value="existentes">Solo usuarios existentes (cualquier rol, no aplica a los que se registren después)</option>
            <option value="resenador">Solo reseñadores</option>
            <option value="autor">Solo autores</option>
            <option value="editorial">Solo editorial</option>
          </select>
        </div>
        <div class="form-grupo">
          <label class="form-label">Texto del botón de acción (opcional, además de "Entendido")</label>
          <input type="text" id="modal-act-boton-texto" class="form-input" placeholder="Ej: Revisar ahora" />
        </div>
        <div class="form-grupo">
          <label class="form-label">Destino del botón para autor/editorial</label>
          <select id="modal-act-destino-autor" class="form-input">
            <option value="">Sin botón para este grupo</option>
            <option value="panel">Ir a Campañas activas</option>
            <option value="feed">Ir a Feed</option>
            <option value="biblioteca">Ir a Biblioteca</option>
            <option value="ranking">Ir a Ranking de libros</option>
            <option value="evento">Ir a Evento</option>
          </select>
        </div>
        <div class="form-grupo">
          <label class="form-label">Destino del botón para reseñador</label>
          <select id="modal-act-destino-resenador" class="form-input">
            <option value="">Sin botón para este grupo</option>
            <option value="perfil">Ir a Editar perfil</option>
            <option value="feed">Ir a Feed</option>
            <option value="biblioteca">Ir a Biblioteca</option>
            <option value="ranking">Ir a Ranking</option>
            <option value="evento">Ir a Evento</option>
          </select>
        </div>
        <div id="modal-act-error" class="mensaje-error" style="display:none;"></div>
        <button type="submit" class="btn-primario">Crear modal</button>
      </form>
    </div>
  `;

  listaCont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: modales, error } = await supabaseClient
    .from('modales_actualizacion')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    listaCont.innerHTML = `<p class="mensaje-error">Error al cargar los modales: ${error.message}</p>`;
    return;
  }

  if (!modales || modales.length === 0) {
    listaCont.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no creaste ningún modal.</p></div>`;
    return;
  }

  listaCont.innerHTML = `
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Título</th>
          <th>Texto</th>
          <th>Alcance</th>
          <th>Botón</th>
          <th>Estado</th>
          <th>Creado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${modales.map(m => construirFilaModalActualizacionAdmin(m)).join('')}
      </tbody>
    </table>
  `;
}

const ETIQUETAS_ALCANCE_MODAL = {
  todos: 'Todos',
  existentes: 'Solo existentes',
  resenador: 'Solo reseñadores',
  autor: 'Solo autores',
  editorial: 'Solo editorial'
};

function construirFilaModalActualizacionAdmin(m) {
  const estadoBadge = m.activo
    ? '<span class="badge badge-aprobada">Activo</span>'
    : '<span class="badge badge-cancelada">Inactivo</span>';

  const textoCorto = (m.texto || '').length > 80 ? m.texto.slice(0, 80) + '…' : (m.texto || '');

  const botonToggle = m.activo
    ? `<button class="btn-secundario btn-sm" onclick="desactivarModalActualizacionAdmin('${m.id}')">Desactivar</button>`
    : `<button class="btn-primario btn-sm" onclick="activarModalActualizacionAdmin('${m.id}')">Activar</button>`;

  const descripcionBoton = m.boton_texto
    ? `${escaparHtmlModalAdmin(m.boton_texto)}${m.boton_destino_autor_editorial ? ' · autor/editorial → ' + m.boton_destino_autor_editorial : ''}${m.boton_destino_resenador ? ' · reseñador → ' + m.boton_destino_resenador : ''}`
    : '—';

  return `
    <tr>
      <td style="font-weight:700;">${escaparHtmlModalAdmin(m.titulo)}</td>
      <td style="max-width:220px; font-size:12px;">${escaparHtmlModalAdmin(textoCorto)}</td>
      <td style="font-size:12px;">${ETIQUETAS_ALCANCE_MODAL[m.alcance] || m.alcance}</td>
      <td style="font-size:12px;">${descripcionBoton}</td>
      <td>${estadoBadge}</td>
      <td style="font-size:12px;">${m.creado_en ? String(m.creado_en).split('T')[0] : '—'}</td>
      <td style="display:flex; gap:6px;">
        ${botonToggle}
        <button class="btn-secundario btn-sm btn-peligro" onclick="eliminarModalActualizacionAdmin('${m.id}')">Eliminar</button>
      </td>
    </tr>
  `;
}

function escaparHtmlModalAdmin(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

async function crearModalActualizacionAdmin(event) {
  event.preventDefault();

  const titulo = document.getElementById('modal-act-titulo')?.value.trim();
  const texto = document.getElementById('modal-act-texto')?.value.trim();
  const imagenUrl = document.getElementById('modal-act-imagen')?.value.trim() || null;
  const alcance = document.getElementById('modal-act-alcance')?.value || 'todos';
  const botonTexto = document.getElementById('modal-act-boton-texto')?.value.trim() || null;
  const destinoAutor = document.getElementById('modal-act-destino-autor')?.value || null;
  const destinoResenador = document.getElementById('modal-act-destino-resenador')?.value || null;
  const errorEl = document.getElementById('modal-act-error');

  if (errorEl) errorEl.style.display = 'none';

  if (!titulo || !texto) {
    if (errorEl) { errorEl.textContent = 'Completá título y texto.'; errorEl.style.display = 'block'; }
    return;
  }

  const { error } = await supabaseClient
    .from('modales_actualizacion')
    .insert({
      titulo,
      texto,
      imagen_url: imagenUrl,
      activo: false,
      alcance,
      boton_texto: botonTexto,
      boton_destino_autor_editorial: destinoAutor,
      boton_destino_resenador: destinoResenador
    });

  if (error) {
    if (errorEl) { errorEl.textContent = error.message; errorEl.style.display = 'block'; }
    return;
  }

  mostrarToast('Modal creado. Activalo cuando quieras desde la lista.', 'ok');
  await cargarModalesAdmin();
}

async function activarModalActualizacionAdmin(idModal) {
  if (!confirm('¿Activar este modal? Se mostrará a los usuarios que no lo hayan visto, y se desactivará el que esté activo ahora (si hay uno).')) return;

  // 1. Desactiva el que esté activo (si hay alguno) — necesario porque
  //    solo puede haber UN modal activo a la vez (restricción en la BD).
  const { error: errorDesactivar } = await supabaseClient
    .from('modales_actualizacion')
    .update({ activo: false })
    .eq('activo', true);

  if (errorDesactivar) {
    mostrarToast('Error al desactivar el modal anterior: ' + errorDesactivar.message, 'error');
    return;
  }

  // 2. Activa el nuevo
  const { error: errorActivar } = await supabaseClient
    .from('modales_actualizacion')
    .update({ activo: true })
    .eq('id', idModal);

  if (errorActivar) {
    mostrarToast('Error al activar el modal: ' + errorActivar.message, 'error');
    return;
  }

  mostrarToast('Modal activado.', 'ok');
  await cargarModalesAdmin();
}

async function desactivarModalActualizacionAdmin(idModal) {
  if (!confirm('¿Desactivar este modal? Dejará de mostrarse a los usuarios.')) return;

  const { error } = await supabaseClient
    .from('modales_actualizacion')
    .update({ activo: false })
    .eq('id', idModal);

  if (error) {
    mostrarToast('Error al desactivar: ' + error.message, 'error');
    return;
  }

  mostrarToast('Modal desactivado.', 'ok');
  await cargarModalesAdmin();
}

async function eliminarModalActualizacionAdmin(idModal) {
  if (!confirm('¿Eliminar este modal definitivamente? Esta acción no se puede deshacer.')) return;

  const { error } = await supabaseClient
    .from('modales_actualizacion')
    .delete()
    .eq('id', idModal);

  if (error) {
    mostrarToast('Error al eliminar: ' + error.message, 'error');
    return;
  }

  mostrarToast('Modal eliminado.', 'ok');
  await cargarModalesAdmin();
}

// ────────────────────────────────────────────────────────────
// TUTORIALES DE BIENVENIDA (onboarding autor / reseñador)
// ────────────────────────────────────────────────────────────

const TUTORIAL_DESTINOS = {
  'reseñador': ['Campañas', 'Perfil', 'Panel', 'Ranking', 'Biblioteca', 'Evento', 'Despedida'],
  'autor': ['Perfil', 'Agregar libro', 'Nueva campaña', 'Campañas', 'Campañas activas', 'Postulaciones', 'Mi plan', 'Evento', 'Despedida'],
  'editorial': ['Perfil', 'Agregar libro', 'Nueva campaña', 'Campañas', 'Campañas activas', 'Postulaciones', 'Mi plan', 'Evento', 'Despedida']
};

function _slugRolTutorial(rol) {
  if (rol === 'reseñador') return 'resenador';
  if (rol === 'editorial') return 'editorial';
  return 'autor';
}

async function cargarTutorialesAdmin() {
  const cont = document.getElementById('admin-tutoriales-contenedor');
  if (!cont) return;

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: pasos, error } = await supabaseClient
    .from('tutoriales_bienvenida')
    .select('*');

  if (error) {
    cont.innerHTML = `<p class="mensaje-error">Error al cargar los tutoriales: ${error.message}</p>`;
    return;
  }

  const porRol = { 'reseñador': [], 'autor': [], 'editorial': [] };
  (pasos || []).forEach(p => { if (porRol[p.rol]) porRol[p.rol].push(p); });

  cont.innerHTML = `
    <div class="plan-info" style="margin-bottom:32px;">
      <p class="plan-nombre" style="font-size:18px;">Tutorial de bienvenida — Reseñador</p>
      ${_construirPasosTutorialAdmin('reseñador', porRol['reseñador'])}
    </div>
    <div class="plan-info" style="margin-bottom:32px;">
      <p class="plan-nombre" style="font-size:18px;">Tutorial de bienvenida — Autor</p>
      ${_construirPasosTutorialAdmin('autor', porRol['autor'])}
    </div>
    <div class="plan-info">
      <p class="plan-nombre" style="font-size:18px;">Tutorial de bienvenida — Editorial</p>
      ${_construirPasosTutorialAdmin('editorial', porRol['editorial'])}
    </div>
  `;
}

function _construirPasosTutorialAdmin(rol, pasosExistentes) {
  const destinos = ['__INTRO__', ...TUTORIAL_DESTINOS[rol]];
  const slug = _slugRolTutorial(rol);

  return destinos.map((destino, idx) => {
    const numeroPaso = idx; // idx 0 = intro (paso 0), idx 1..6 = pasos 1..6
    const existente = pasosExistentes.find(p => p.numero_paso === numeroPaso) || {};
    const idBase = `tutorial-${slug}-${numeroPaso}`;
    const esIntro = destino === '__INTRO__';
    const esDespedida = destino === 'Despedida';

    return `
      <div class="form-grupo" style="border:1px solid var(--borde, #333); border-radius:10px; padding:16px; margin-top:16px; ${esIntro ? 'background:rgba(255,77,141,0.06);' : ''}">
        <p style="font-weight:700; margin-bottom:4px;">${esIntro ? 'Paso 0 — Introducción' : `Paso ${numeroPaso}`}</p>
        <p style="font-size:12px; opacity:0.7; margin-bottom:12px;">${esIntro ? '💬 Mensaje general de bienvenida (no apunta a nada, aparece antes del globo)' : esDespedida ? '👋 Pantalla de cierre (no apunta a nada, último paso del tutorial)' : `🎯 Apunta a: ${destino}`}</p>

        <div class="form-grupo">
          <label class="form-label">Imagen de la mascota</label>
          ${existente.imagen_mascota ? `<img src="${existente.imagen_mascota}" alt="" style="width:60px; height:60px; object-fit:cover; border-radius:8px; display:block; margin-bottom:8px;" id="${idBase}-preview" />` : `<img src="" alt="" style="display:none;" id="${idBase}-preview" />`}
          <input type="file" id="${idBase}-archivo" class="form-input" accept="image/png,image/jpeg,image/webp" />
          <input type="hidden" id="${idBase}-imagen-actual" value="${existente.imagen_mascota || ''}" />
        </div>

        <div class="form-grupo">
          <label class="form-label">Título</label>
          <input type="text" id="${idBase}-titulo" class="form-input" value="${(existente.titulo || '').replace(/"/g, '&quot;')}" />
        </div>

        <div class="form-grupo">
          <label class="form-label">Texto explicativo</label>
          <textarea id="${idBase}-texto" class="form-textarea" rows="3">${existente.texto || ''}</textarea>
        </div>

        <div id="${idBase}-error" class="mensaje-error" style="display:none;"></div>
        <button type="button" class="btn-primario btn-sm" onclick="guardarPasoTutorialAdmin('${rol}', ${numeroPaso})">Guardar paso ${esIntro ? '0' : numeroPaso}</button>
      </div>
    `;
  }).join('');
}

async function guardarPasoTutorialAdmin(rol, numeroPaso) {
  const slug = _slugRolTutorial(rol);
  const idBase = `tutorial-${slug}-${numeroPaso}`;

  const tituloEl = document.getElementById(`${idBase}-titulo`);
  const textoEl = document.getElementById(`${idBase}-texto`);
  const archivoEl = document.getElementById(`${idBase}-archivo`);
  const imagenActualEl = document.getElementById(`${idBase}-imagen-actual`);
  const errorEl = document.getElementById(`${idBase}-error`);

  if (errorEl) errorEl.style.display = 'none';

  let imagenUrl = imagenActualEl ? imagenActualEl.value : '';

  try {
    if (archivoEl && archivoEl.files && archivoEl.files[0]) {
      imagenUrl = await subirImagen('EVENTOS', `tutoriales/${slug}/paso${numeroPaso}-${crypto.randomUUID()}`, archivoEl.files[0]);
    }

    const { error } = await supabaseClient.rpc('admin_guardar_paso_tutorial', {
      p_rol: rol,
      p_numero_paso: numeroPaso,
      p_titulo: tituloEl ? tituloEl.value.trim() : null,
      p_texto: textoEl ? textoEl.value.trim() : null,
      p_imagen_mascota: imagenUrl || null
    });

    if (error) throw new Error(error.message);

    mostrarToast(`Paso ${numeroPaso} (${rol}) guardado.`, 'ok');
    await cargarTutorialesAdmin();
  } catch (e) {
    if (errorEl) { errorEl.textContent = e.message; errorEl.style.display = 'block'; }
  }
}
