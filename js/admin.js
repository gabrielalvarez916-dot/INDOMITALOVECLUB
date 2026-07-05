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
async function cargarAdmin() {
  await Promise.all([
    cargarUsuariosAdmin(),
    cargarCampañasAdmin(),
    cargarSuscripcionesAdmin(),
    cargarTicketsAdmin()
  ]);
}


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

  contenedor.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><p class="stat-label">Autores</p><p class="stat-valor">${usuarios.totalAutores}</p></div>
      <div class="stat-card"><p class="stat-label">Reseñadores</p><p class="stat-valor">${usuarios.totalReseñadores}</p></div>
      <div class="stat-card"><p class="stat-label">Nuevos este mes</p><p class="stat-valor">${usuarios.nuevosEsteMes}</p></div>
      <div class="stat-card"><p class="stat-label">Autores sin actividad</p><p class="stat-valor">${usuarios.autoresSinActividad}</p></div>
      <div class="stat-card"><p class="stat-label">Reseñadores sin actividad</p><p class="stat-valor">${usuarios.reseñadoresSinActividad}</p></div>
    </div>

    <div class="form-separador">Campañas</div>
    <div class="stats-grid">
      <div class="stat-card"><p class="stat-label">Total</p><p class="stat-valor">${campañas.total}</p></div>
      <div class="stat-card"><p class="stat-label">Activas</p><p class="stat-valor">${campañas.activas}</p></div>
      <div class="stat-card"><p class="stat-label">Finalizadas</p><p class="stat-valor">${campañas.finalizadas}</p></div>
      <div class="stat-card"><p class="stat-label">Canceladas</p><p class="stat-valor">${campañas.canceladas}</p></div>
    </div>

    <div class="form-separador">Reseñas</div>
    <div class="stats-grid">
      <div class="stat-card"><p class="stat-label">Total entregadas</p><p class="stat-valor">${reseñas.totalEntregadas}</p></div>
      <div class="stat-card"><p class="stat-label">Este mes</p><p class="stat-valor">${reseñas.entregadasEsteMes}</p></div>
      <div class="stat-card"><p class="stat-label">Completion global</p><p class="stat-valor">${reseñas.completionGlobal}%</p></div>
      <div class="stat-card"><p class="stat-label">Completion del mes</p><p class="stat-valor">${reseñas.completionMes}%</p></div>
    </div>
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

  if (tickets.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay tickets de soporte.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <table class="admin-tabla">
      <thead>
        <tr>
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
  const estadoBadge = t.estado === 'cerrado'
    ? '<span class="badge badge-cancelada">Cerrado</span>'
    : t.estado === 'respondido'
    ? '<span class="badge badge-aprobada">Respondido</span>'
    : '<span class="badge badge-pendiente">Pendiente</span>';

  const botones = t.estado === 'cerrado' ? '' : `
    ${t.estado !== 'respondido' ? `<button class="btn-secundario btn-sm" onclick="accionTicketAdmin('${t.idTicket}', 'respondido')">Respondido</button>` : ''}
    <button class="btn-secundario btn-sm btn-peligro" onclick="accionTicketAdmin('${t.idTicket}', 'cerrado')">Cerrar</button>
  `;

  return `
    <tr>
      <td style="font-size:12px;">${t.email}</td>
      <td><span class="badge badge-nivel">${t.rol || '—'}</span></td>
      <td>${t.asunto}</td>
      <td style="max-width:280px; font-size:12px;">${t.mensaje}</td>
      <td style="font-size:12px;">${t.fecha ? String(t.fecha).split('T')[0] : '—'}</td>
      <td>${estadoBadge}</td>
      <td style="display:flex; gap:6px;">${botones}</td>
    </tr>
  `;
}

async function accionTicketAdmin(idTicket, nuevoEstado) {
  const confirmText = nuevoEstado === 'cerrado' ? '¿Cerrar este ticket?' : '¿Marcar como respondido?';
  if (!confirm(confirmText)) return;

  const { data: resultado, error } = await supabaseClient.rpc('admin_actualizar_estado_ticket', {
    p_id_ticket: idTicket,
    p_nuevo_estado: nuevoEstado
  });

  if (error || !resultado || resultado.error) {
    mostrarToast(resultado?.error || 'Error al actualizar el ticket.', 'error');
    return;
  }

  mostrarToast('Ticket actualizado.', 'ok');
  await cargarTicketsAdmin();
}
