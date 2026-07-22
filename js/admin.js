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
      <div class="stat-card">
        <p class="stat-label">Nuevos este mes</p>
        <p class="stat-valor">${usuarios.nuevosEsteMes}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Usuarios (cualquier rol) registrados en lo que va del mes calendario.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Autores sin actividad</p>
        <p class="stat-valor">${usuarios.autoresSinActividad}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Autores activos que no crearon ninguna campaña en los últimos 30 días.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Reseñadores sin actividad</p>
        <p class="stat-valor">${usuarios.reseñadoresSinActividad}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Reseñadores activos sin postulaciones respondidas ni reseñas entregadas en los últimos 30 días.</p>
      </div>
    </div>

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
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las asignaciones cuyo plazo ya venció, qué % se entregó (tarde o en término).</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Completion a tiempo</p>
        <p class="stat-valor">${reseñas.completionATiempo}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las asignaciones vencidas, qué % se entregó antes del deadline.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Tasa de abandono</p>
        <p class="stat-valor">${reseñas.tasaAbandono}%</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">De las asignaciones vencidas, qué % nunca se entregó. Es el complemento exacto de completion total.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Tiempo promedio de entrega</p>
        <p class="stat-valor">${reseñas.tiempoPromedioEntregaDias ?? '—'} días</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Promedio de días entre la aprobación de la postulación y la entrega efectiva de la reseña.</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Asignaciones vencidas</p>
        <p class="stat-valor">${reseñas.asignacionesVencidas}</p>
        <p style="font-size:11px; color:#888; margin:2px 0 0;">Cantidad de asignaciones cuyo deadline ya pasó (es la base sobre la que se calculan completion y abandono).</p>
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

    <div class="form-separador">Ratio de entrega por campaña</div>
    <p style="font-size:12px; color:#888; margin:0 0 12px;">
      Por cada campaña: cuántas postulaciones aprobadas (incluye abandonadas) terminaron en una reseña entregada. Ordenado de menor a mayor ratio, para detectar rápido las campañas con peor cumplimiento.
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
              <th>Entregadas</th>
              <th>Ratio</th>
            </tr>
          </thead>
          <tbody>
            ${ratioPorCampaña.map(c => construirFilaRatioCampañaAdmin(c)).join('')}
          </tbody>
        </table>
      `
    }
  `;
}

/**
 * Construye la fila de una campaña para la tabla de ratio de entrega.
 *
 * @param {Object} c — { nombre_libro, nombre_autor, aprobadas, entregadas, ratio }
 * @returns {string} HTML de la fila
 */
function construirFilaRatioCampañaAdmin(c) {
  return `
    <tr>
      <td>${c.nombre_libro}</td>
      <td style="font-size:12px;">${c.nombre_autor}</td>
      <td>${c.aprobadas}</td>
      <td>${c.entregadas}</td>
      <td>${c.ratio}%</td>
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
  return `
    <tr>
      <td style="font-size:12px;">${t.email}</td>
      <td><span class="badge badge-nivel">${t.rol || '—'}</span></td>
      <td>${tipoBadge || t.asunto || ''}</td>
      <td style="max-width:280px; font-size:12px;">${t.mensaje}</td>
      <td style="font-size:12px;">${t.fecha ? String(t.fecha).split('T')[0] : '—'}</td>
      <td>${estadoBadge}</td>
      <td style="display:flex; gap:6px;">${botones}</td>
    </tr>
  `;
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
      <div id="modal-ticket-historial" style="flex:1; overflow-y:auto; margin-bottom:12px; min-height:80px;">
        <div class="cargando-container"><div class="spinner"></div></div>
      </div>
      <textarea id="modal-ticket-mensaje" rows="3" placeholder="Escribí tu respuesta..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-family:inherit; resize:vertical; box-sizing:border-box;"></textarea>
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
    .select('autor, cuerpo, creado_en')
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

  const { data, error } = await supabaseClient.functions.invoke('soporte-responder', {
    body: { id_ticket: idTicket, mensaje },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error || data?.error) {
    mostrarToast(data?.error || error?.message || 'No se pudo enviar la respuesta.', 'error');
    return;
  }

  mostrarToast('Respuesta enviada.', 'ok');
  textarea.value = '';
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
          <th>Imagen</th>
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

function construirFilaModalActualizacionAdmin(m) {
  const estadoBadge = m.activo
    ? '<span class="badge badge-aprobada">Activo</span>'
    : '<span class="badge badge-cancelada">Inactivo</span>';

  const textoCorto = (m.texto || '').length > 80 ? m.texto.slice(0, 80) + '…' : (m.texto || '');

  const botonToggle = m.activo
    ? `<button class="btn-secundario btn-sm" onclick="desactivarModalActualizacionAdmin('${m.id}')">Desactivar</button>`
    : `<button class="btn-primario btn-sm" onclick="activarModalActualizacionAdmin('${m.id}')">Activar</button>`;

  return `
    <tr>
      <td style="font-weight:700;">${escaparHtmlModalAdmin(m.titulo)}</td>
      <td style="max-width:260px; font-size:12px;">${escaparHtmlModalAdmin(textoCorto)}</td>
      <td>${m.imagen_url ? `<img src="${m.imagen_url}" alt="" style="width:40px; height:40px; object-fit:cover; border-radius:6px;" />` : '—'}</td>
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
  const errorEl = document.getElementById('modal-act-error');

  if (errorEl) errorEl.style.display = 'none';

  if (!titulo || !texto) {
    if (errorEl) { errorEl.textContent = 'Completá título y texto.'; errorEl.style.display = 'block'; }
    return;
  }

  const { error } = await supabaseClient
    .from('modales_actualizacion')
    .insert({ titulo, texto, imagen_url: imagenUrl, activo: false });

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
  'reseñador': ['Campañas', 'Perfil', 'Postulaciones y ARCs activas', 'Ranking', 'Biblioteca', 'Evento'],
  'autor': ['Campañas', 'Campañas activas', 'Postulaciones', 'Ranking libros', 'Mi plan', 'Evento', 'Nueva campaña'],
  'editorial': ['Campañas', 'Campañas activas', 'Postulaciones', 'Ranking libros', 'Mi plan', 'Evento', 'Nueva campaña']
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

    return `
      <div class="form-grupo" style="border:1px solid var(--borde, #333); border-radius:10px; padding:16px; margin-top:16px; ${esIntro ? 'background:rgba(255,77,141,0.06);' : ''}">
        <p style="font-weight:700; margin-bottom:4px;">${esIntro ? 'Paso 0 — Introducción' : `Paso ${numeroPaso}`}</p>
        <p style="font-size:12px; opacity:0.7; margin-bottom:12px;">${esIntro ? '💬 Mensaje general de bienvenida (no apunta a nada, aparece antes del globo)' : `🎯 Apunta a: ${destino}`}</p>

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
      imagenUrl = await subirImagen('EVENTOS', `tutoriales/${slug}/paso${numeroPaso}`, archivoEl.files[0]);
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
