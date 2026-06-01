// ============================================================
// admin.js — Indómita Love Club
// Panel admin: usuarios, campañas, pagos, configuración, errores
// ============================================================


// ────────────────────────────────────────────────────────────
// CARGAR PANEL ADMIN
// ────────────────────────────────────────────────────────────

/**
 * Carga el panel admin.
 * Se llama automáticamente cuando se muestra la sección admin.
 */
async function cargarAdmin() {
  const email = Sesion.email();
  if (!email) return;

  await Promise.all([
    cargarUsuariosAdmin(email),
    cargarCampañasAdmin(email),
    cargarPagosAdmin(email)
  ]);
}


// ────────────────────────────────────────────────────────────
// USUARIOS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de usuarios en el panel admin.
 *
 * @param {string} email
 */
async function cargarUsuariosAdmin(email) {
  const contenedor = document.getElementById('admin-usuarios-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const resultado = await llamarBackend('adminListarUsuarios', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const usuarios = resultado.datos.usuarios || [];

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

  // Guarda los usuarios para filtrar
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

  return `
    <tr>
      <td>${u.email}</td>
      <td>${u.alias || '—'}</td>
      <td><span class="badge badge-nivel">${u.rol}</span></td>
      <td>${planTexto}</td>
      <td>${estadoBadge}</td>
      <td style="font-size:12px;">${u.fechaRegistro ? u.fechaRegistro.split(' ')[0] : '—'}</td>
      <td>${botonBloqueo}</td>
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
  const email = Sesion.email();
  const accionBackend = accion === 'bloquear' ? 'adminBloquearUsuario' : 'adminDesbloquearUsuario';

  let motivo = '';
  if (accion === 'bloquear') {
    motivo = prompt(`¿Motivo del bloqueo de ${emailUsuario}?`) || '';
    if (motivo === null) return; // canceló
  } else {
    if (!confirm(`¿Desbloquear a ${emailUsuario}?`)) return;
  }

  const resultado = await llamarBackend(accionBackend, {
    email,
    emailObjetivo: emailUsuario,
    motivo
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje, 'error');
    return;
  }

  mostrarToast(accion === 'bloquear' ? 'Usuario bloqueado.' : 'Usuario desbloqueado.', 'ok');
  await cargarUsuariosAdmin(email);
}


// ────────────────────────────────────────────────────────────
// CAMPAÑAS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de campañas en el panel admin.
 *
 * @param {string} email
 */
async function cargarCampañasAdmin(email) {
  const contenedor = document.getElementById('admin-campanas-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const resultado = await llamarBackend('adminListarCampanas', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const campañas = resultado.datos.campañas || [];

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

  const resultado = await llamarBackend('adminCancelarCampana', {
    email: Sesion.email(),
    idCampana: idCampaña,
    motivo
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje, 'error');
    return;
  }

  mostrarToast('Campaña cancelada.', 'ok');
  await cargarCampañasAdmin(Sesion.email());
}


// ────────────────────────────────────────────────────────────
// PAGOS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la lista de pagos en el panel admin.
 *
 * @param {string} email
 */
async function cargarPagosAdmin(email) {
  const contenedor = document.getElementById('admin-pagos-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const resultado = await llamarBackend('adminListarPagos', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const pagos = resultado.datos.pagos || [];

  if (pagos.length === 0) {
    contenedor.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-texto">No hay pagos registrados.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <table class="admin-tabla">
      <thead>
        <tr>
          <th>Email</th>
          <th>Plan</th>
          <th>Monto</th>
          <th>Método</th>
          <th>Estado</th>
          <th>Fecha</th>
          <th>Comprobante</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${pagos.map(p => construirFilaPagoAdmin(p)).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Construye la fila de un pago para la tabla admin.
 *
 * @param {Object} p — datos del pago
 * @returns {string} HTML de la fila
 */
function construirFilaPagoAdmin(p) {
  const botonesAccion = p.estadoPago === 'pendiente' ? `
    <button class="btn-primario btn-sm" onclick="accionPagoAdmin('${p.id}', 'aprobar')">Aprobar</button>
    <button class="btn-secundario btn-sm btn-peligro" onclick="accionPagoAdmin('${p.id}', 'rechazar')">Rechazar</button>
  ` : '';

  const comprobanteLink = p.comprobanteUrl
    ? `<a href="${p.comprobanteUrl}" target="_blank" class="red-link">Ver</a>`
    : '—';

  const estadoBadge = p.estadoPago === 'aprobado'
    ? '<span class="badge badge-aprobada">Aprobado</span>'
    : p.estadoPago === 'rechazado'
    ? '<span class="badge badge-rechazada">Rechazado</span>'
    : '<span class="badge badge-pendiente">Pendiente</span>';

  return `
    <tr>
      <td style="font-size:12px;">${p.email}</td>
      <td>${p.planSolicitado}</td>
      <td>${p.monto || '—'} ${p.moneda || ''}</td>
      <td style="font-size:12px;">${p.metodoPago}</td>
      <td>${estadoBadge}</td>
      <td style="font-size:12px;">${p.fechaSolicitud ? p.fechaSolicitud.split(' ')[0] : '—'}</td>
      <td>${comprobanteLink}</td>
      <td style="display:flex; gap:6px;">${botonesAccion}</td>
    </tr>
  `;
}

/**
 * Aprueba o rechaza un pago.
 *
 * @param {string} idPago
 * @param {string} accion — 'aprobar' o 'rechazar'
 */
async function accionPagoAdmin(idPago, accion) {
  const email = Sesion.email();

  let motivo = '';
  if (accion === 'rechazar') {
    motivo = prompt('¿Motivo del rechazo?') || '';
    if (motivo === null) return;
  } else {
    if (!confirm('¿Aprobar este pago y activar el plan?')) return;
  }

  const accionBackend = accion === 'aprobar' ? 'adminAprobarPago' : 'adminRechazarPago';

  const resultado = await llamarBackend(accionBackend, {
    email,
    idPago,
    motivo
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje, 'error');
    return;
  }

  mostrarToast(accion === 'aprobar' ? 'Pago aprobado. Plan activado.' : 'Pago rechazado.', 'ok');
  await cargarPagosAdmin(email);
}
