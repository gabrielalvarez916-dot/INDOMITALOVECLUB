// ============================================================
// soporte-usuario.js — Indómita Love Club
// Canal de chat de soporte desde ADENTRO de la app para el
// usuario: menú del botón flotante, badge de mensajes
// pendientes, historial de tickets y chat por ticket.
//
// No reemplaza ni toca el flujo de mail existente (soporte.js,
// soporte-responder, soporte-leer-inbox, fn_soporte_notificar_admin).
// Este archivo es 100% aditivo.
// ============================================================

let _soporteUsuarioPollingId = null;
let _misTicketsSoporteCache = [];
let _ticketSoporteUsuarioActivo = null;

// ────────────────────────────────────────────────────────────
// MENÚ DEL BOTÓN FLOTANTE (Enviar mensaje / Ver mensajes)
// ────────────────────────────────────────────────────────────

function toggleMenuSoporte() {
  const menu = document.getElementById('soporte-menu');
  if (!menu) return;
  menu.classList.toggle('activo');
}

function cerrarMenuSoporte() {
  document.getElementById('soporte-menu')?.classList.remove('activo');
}

// Cierra el menú si se clickea afuera (mismo patrón que el panel de notificaciones)
document.addEventListener('click', (e) => {
  const menu = document.getElementById('soporte-menu');
  const boton = document.getElementById('btn-soporte-flotante');
  if (!menu || !boton) return;
  if (!menu.classList.contains('activo')) return;
  if (!menu.contains(e.target) && !boton.contains(e.target)) {
    menu.classList.remove('activo');
  }
});

// ────────────────────────────────────────────────────────────
// INICIALIZACIÓN — se llama junto con iniciarNotificaciones() /
// detenerNotificaciones() después del login / logout
// ────────────────────────────────────────────────────────────

function iniciarBandejaSoporteUsuario() {
  cargarBadgeSoporteUsuario();

  if (_soporteUsuarioPollingId) clearInterval(_soporteUsuarioPollingId);
  _soporteUsuarioPollingId = setInterval(cargarBadgeSoporteUsuario, 60000); // cada 60s, igual que notificaciones
}

function detenerBandejaSoporteUsuario() {
  if (_soporteUsuarioPollingId) {
    clearInterval(_soporteUsuarioPollingId);
    _soporteUsuarioPollingId = null;
  }
  _misTicketsSoporteCache = [];
  _pintarBadgeSoporte(0);
  cerrarMenuSoporte();
}

// ────────────────────────────────────────────────────────────
// BADGE (numerito de tickets con mensaje pendiente de leer)
// ────────────────────────────────────────────────────────────

async function cargarBadgeSoporteUsuario() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: resultado, error } = await supabaseClient.rpc('mis_tickets_soporte');
  if (error || !resultado || resultado.error) return; // silencioso: no rompe el resto de la app

  _misTicketsSoporteCache = resultado.tickets || [];
  const pendientes = _misTicketsSoporteCache.filter(t => t.noLeido).length;
  _pintarBadgeSoporte(pendientes);
}

function _pintarBadgeSoporte(cantidad) {
  const badge = document.getElementById('soporte-badge');
  if (!badge) return;

  if (cantidad > 0) {
    badge.textContent = cantidad > 9 ? '9+' : String(cantidad);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ────────────────────────────────────────────────────────────
// HISTORIAL (todos los tickets del usuario)
// ────────────────────────────────────────────────────────────

function abrirHistorialSoporte() {
  mostrarModal('modal-historial-soporte');
  cargarHistorialSoporte();
}

async function cargarHistorialSoporte() {
  const contenedor = document.getElementById('historial-soporte-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('mis_tickets_soporte');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'No pudimos cargar tus mensajes.'}</p>`;
    return;
  }

  const tickets = resultado.tickets || [];
  _misTicketsSoporteCache = tickets;

  const pendientes = tickets.filter(t => t.noLeido).length;
  _pintarBadgeSoporte(pendientes);

  if (tickets.length === 0) {
    contenedor.innerHTML = '<p class="notif-vacio">Todavía no enviaste ningún mensaje de soporte.</p>';
    return;
  }

  contenedor.innerHTML = tickets.map(t => _construirItemHistorialSoporte(t)).join('');
}

function _construirItemHistorialSoporte(t) {
  const estadoBadge = t.estado === 'cerrado'
    ? '<span class="badge badge-cancelada">Cerrado</span>'
    : t.estado === 'respondido'
    ? '<span class="badge badge-aprobada">Respondido</span>'
    : '<span class="badge badge-pendiente">Pendiente</span>';

  return `
    <button class="notif-item ${t.noLeido ? 'no-leida' : ''}" onclick="abrirTicketSoporteUsuario('${t.idTicket}')">
      <span class="notif-item-texto">
        <strong>${escaparHtmlSoporte(t.asunto || 'Sin asunto')}</strong> ${estadoBadge}<br/>
        ${escaparHtmlSoporte((t.ultimoMensaje || '').slice(0, 90))}${(t.ultimoMensaje || '').length > 90 ? '…' : ''}
      </span>
      <span class="notif-item-fecha">${_formatearFechaSoporte(t.actualizadoEn || t.creadoEn)}</span>
    </button>
  `;
}

function _formatearFechaSoporte(fechaISO) {
  if (!fechaISO) return '';
  const fecha = new Date(fechaISO);
  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function volverAHistorialSoporte() {
  cerrarModales();
  abrirHistorialSoporte();
}

// ────────────────────────────────────────────────────────────
// CHAT DE UN TICKET (ver hilo + responder si no está cerrado)
// ────────────────────────────────────────────────────────────

async function abrirTicketSoporteUsuario(idTicket) {
  _ticketSoporteUsuarioActivo = idTicket;
  cerrarModales();
  mostrarModal('modal-ticket-soporte-usuario');
  ocultarMensajes('ticket-soporte-usuario-error');

  const hilo = document.getElementById('ticket-soporte-usuario-hilo');
  if (hilo) hilo.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('mensajes_ticket_soporte', { p_id_ticket: idTicket });

  if (error || !resultado || resultado.error) {
    if (hilo) hilo.innerHTML = `<p class="mensaje-error">${resultado?.error || 'No pudimos cargar la conversación.'}</p>`;
    return;
  }

  const tituloEl = document.getElementById('ticket-soporte-usuario-asunto');
  if (tituloEl) tituloEl.textContent = resultado.asunto || 'Ticket de soporte';

  _pintarHiloTicketUsuario(resultado.mensajes || []);
  _actualizarFormularioSegunEstado(resultado.estado);

  // Marca el ticket como leído y refresca el numerito
  await supabaseClient.rpc('marcar_ticket_leido', { p_id_ticket: idTicket });
  cargarBadgeSoporteUsuario();
}

function _pintarHiloTicketUsuario(mensajes) {
  const hilo = document.getElementById('ticket-soporte-usuario-hilo');
  if (!hilo) return;

  if (mensajes.length === 0) {
    hilo.innerHTML = '<p class="notif-vacio">Todavía no hay mensajes en esta conversación.</p>';
    return;
  }

  hilo.innerHTML = mensajes.map(m => `
    <div class="soporte-msg ${m.autor === 'usuario' ? 'soporte-msg-usuario' : 'soporte-msg-admin'}">
      <div class="soporte-msg-autor">${m.autor === 'usuario' ? 'Vos' : 'Indómita'}</div>
      <div class="soporte-msg-cuerpo">${escaparHtmlSoporte(m.cuerpo)}</div>
      ${m.adjunto_nombre ? `<div class="soporte-msg-fecha">📎 ${escaparHtmlSoporte(m.adjunto_nombre)}</div>` : ''}
      <div class="soporte-msg-fecha">${_formatearFechaSoporte(m.fecha)}</div>
    </div>
  `).join('');

  hilo.scrollTop = hilo.scrollHeight;
}

function _actualizarFormularioSegunEstado(estado) {
  const form = document.getElementById('ticket-soporte-usuario-form');
  const nota = document.getElementById('ticket-soporte-usuario-cerrado-nota');
  const cerrado = estado === 'cerrado';

  if (form) form.style.display = cerrado ? 'none' : '';
  if (nota) nota.style.display = cerrado ? '' : 'none';
}

async function enviarRespuestaTicketUsuario() {
  const idTicket = _ticketSoporteUsuarioActivo;
  if (!idTicket) return;

  ocultarMensajes('ticket-soporte-usuario-error');
  const textarea = document.getElementById('ticket-soporte-usuario-mensaje');
  const cuerpo = textarea?.value?.trim();

  if (!cuerpo) {
    mostrarMensajeError('ticket-soporte-usuario-error', 'Escribí un mensaje antes de enviar.');
    return;
  }

  const boton = document.getElementById('ticket-soporte-usuario-btn-enviar');
  if (boton) boton.disabled = true;

  const { error } = await supabaseClient
    .from('soporte_mensajes')
    .insert({ id_ticket: idTicket, autor: 'usuario', cuerpo });

  if (boton) boton.disabled = false;

  if (error) {
    // La policy de RLS rechaza el insert si el ticket ya está cerrado
    mostrarMensajeError('ticket-soporte-usuario-error', 'No pudimos enviar tu respuesta. Si el ticket se cerró mientras escribías, enviá un mensaje nuevo.');
    return;
  }

  if (textarea) textarea.value = '';

  // Recarga el hilo (el trigger ya reabrió el ticket a "pendiente" y avisó al admin por mail)
  const { data: resultado } = await supabaseClient.rpc('mensajes_ticket_soporte', { p_id_ticket: idTicket });
  if (resultado && !resultado.error) {
    _pintarHiloTicketUsuario(resultado.mensajes || []);
    _actualizarFormularioSegunEstado(resultado.estado);
  }
}

// ────────────────────────────────────────────────────────────
// Nota para reusar en mobile: `escaparHtmlSoporte`, `ocultarMensajes`,
// `mostrarMensajeError` y `mostrarMensajeOk` son helpers ya
// definidos en admin.js / ui.js / soporte.js respectivamente y
// se reusan tal cual acá porque conviven en el mismo bundle.
// ────────────────────────────────────────────────────────────
