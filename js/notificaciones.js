// ============================================================
// notificaciones.js — Indómita Love Club
// Campana de notificaciones in-app. Diferenciada por rol.
// ============================================================

let _notifPollingId = null;
let _notifCache = [];

// ────────────────────────────────────────────────────────────
// TEXTOS POR TIPO (diferenciados autor / reseñador)
// ────────────────────────────────────────────────────────────

const NOTIF_TEXTOS = {
  // Para AUTOR
  postulacion_nueva: (d) => `${d.aliasReseñador || 'Alguien'} se postuló a "${d.nombreLibro || 'tu campaña'}".`,
  resena_cargada: (d) => `${d.aliasReseñador || 'Una reseñadora'} cargó su reseña de "${d.nombreLibro || ''}".`,
  campaña_finalizada: (d) => `Tu campaña "${d.nombreLibro || ''}" finalizó.`,
  campaña_cancelada_admin: (d) => `Tu campaña "${d.nombreLibro || ''}" fue cancelada por el equipo de Indómita.`,
  pago_aprobado: (d) => `Tu pago del plan ${d.plan || ''} fue aprobado.`,
  pago_rechazado: (d) => `Tu pago fue rechazado. ${d.motivo ? 'Motivo: ' + d.motivo : ''}`,
  postulacion_abandono: (d) => `${d.aliasReseñador || 'Una reseñadora'} abandonó la campaña "${d.nombreLibro || ''}".`,

  // Para RESEÑADOR
  postulacion_aprobada: (d) => `¡Te aprobaron en "${d.nombreLibro || 'una campaña'}"! Ya podés acceder al libro.`,
  postulacion_rechazada: (d) => `Tu postulación a "${d.nombreLibro || ''}" fue rechazada.`,
  resena_calificada: (d) => `El autor calificó tu reseña de "${d.nombreLibro || ''}" con ${d.puntuacion || '?'} estrellas.`,
  campaña_cancelada_autor: (d) => `La campaña "${d.nombreLibro || ''}" en la que participabas fue cancelada.`,
  recordatorio_resena: (d) => `Te quedan pocos días para entregar tu reseña de "${d.nombreLibro || ''}".`,
  ticket_actualizado: (d) => `Tu ticket de soporte "${d.asunto || ''}" cambió de estado.`
};

function _textoNotificacion(notif) {
  const fn = NOTIF_TEXTOS[notif.tipo];
  if (!fn) return 'Tenés una notificación nueva.';
  try {
    return fn(notif.datosExtra || {});
  } catch (e) {
    return 'Tenés una notificación nueva.';
  }
}


// ────────────────────────────────────────────────────────────
// INICIALIZACIÓN — se llama después del login exitoso
// ────────────────────────────────────────────────────────────

function iniciarNotificaciones() {
  const cont = document.getElementById('notif-campana-cont');
  if (!cont) return;
  cont.style.display = '';

  cargarNotificaciones();

  if (_notifPollingId) clearInterval(_notifPollingId);
  _notifPollingId = setInterval(cargarNotificaciones, 60000); // cada 60s
}

function detenerNotificaciones() {
  const cont = document.getElementById('notif-campana-cont');
  if (cont) cont.style.display = 'none';
  if (_notifPollingId) {
    clearInterval(_notifPollingId);
    _notifPollingId = null;
  }
  _notifCache = [];
}


// ────────────────────────────────────────────────────────────
// CARGAR Y PINTAR
// ────────────────────────────────────────────────────────────

async function cargarNotificaciones() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  try {
    const { data, error } = await supabaseClient
      .from('notificaciones')
      .select('*')
      .eq('id_usuario', user.id)
      .order('fecha', { ascending: false });

    if (error) throw error;

    _notifCache = (data || []).map(n => ({
      idNotificacion: n.id,
      tipo: n.tipo,
      leida: n.leida,
      fecha: n.fecha,
      referenciaId: n.referencia_id,
      datosExtra: n.datos_extra
    }));

    const noLeidas = _notifCache.filter(n => !n.leida).length;
    _pintarBadge(noLeidas);
    _pintarListaNotificaciones(_notifCache);

  } catch (e) {
    // Silencioso: si falla, no rompe el resto de la app
  }
}

function _pintarBadge(noLeidas) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  if (noLeidas > 0) {
    badge.textContent = noLeidas > 9 ? '9+' : String(noLeidas);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function _pintarListaNotificaciones(notificaciones) {
  const cont = document.getElementById('notif-lista');
  if (!cont) return;

  if (notificaciones.length === 0) {
    cont.innerHTML = '<p class="notif-vacio">No tenés notificaciones todavía.</p>';
    return;
  }

  cont.innerHTML = notificaciones.map(n => `
    <button class="notif-item ${n.leida ? '' : 'no-leida'}" onclick="_clickNotificacion('${n.idNotificacion}')">
      <span class="notif-item-texto">${_escNotif(_textoNotificacion(n))}</span>
      <span class="notif-item-fecha">${_escNotif(n.fecha || '')}</span>
    </button>
  `).join('');
}

function _escNotif(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


// ────────────────────────────────────────────────────────────
// INTERACCIÓN
// ────────────────────────────────────────────────────────────

let _notifPanelAbierto = false;

function toggleNotificaciones() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  _notifPanelAbierto = false;

  _notifPanelAbierto = !_notifPanelAbierto;

  if (_notifPanelAbierto) {
    panel.style.display = '';
    marcarTodasComoLeidas();
  } else {
    panel.style.display = 'none';
  }
}
async function marcarTodasComoLeidas() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  try {
    const { error } = await supabaseClient
      .from('notificaciones')
      .update({ leida: true })
      .eq('id_usuario', user.id)
      .eq('leida', false);

    if (error) throw error;

    _pintarBadge(0);
    _notifCache = _notifCache.map(n => ({ ...n, leida: true }));
    _pintarListaNotificaciones(_notifCache);
  } catch (e) {
    // silencioso
  }
}

async function _clickNotificacion(idNotificacion) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  await supabaseClient
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', idNotificacion)
    .eq('id_usuario', user.id);

  const idx = _notifCache.findIndex(n => n.idNotificacion === idNotificacion);
  if (idx !== -1) _notifCache[idx].leida = true;
  _pintarBadge(_notifCache.filter(n => !n.leida).length);

  const notif = _notifCache.find(n => n.idNotificacion === idNotificacion);
  if (notif) {
    _navegarPorNotificacion(notif);
  }

  // Cierra el panel
  const panel = document.getElementById('notif-panel');
  if (panel) panel.style.display = 'none';
}

/**
 * Navega a la sección correspondiente según el tipo de notificación.
 * Usa funciones que ya existen en tu app (mostrarSeccion, verDetalleCampaña, etc.)
 */
function _navegarPorNotificacion(notif) {
  const tiposCampaña = [
    'postulacion_nueva', 'resena_cargada', 'campaña_finalizada',
    'campaña_cancelada_admin', 'postulacion_abandono',
    'postulacion_aprobada', 'postulacion_rechazada',
    'campaña_cancelada_autor', 'recordatorio_resena'
  ];

  if (tiposCampaña.includes(notif.tipo) && notif.referenciaId) {
    if (typeof mostrarPanelRol === 'function') mostrarPanelRol();
    return;
  }

  if (notif.tipo === 'resena_calificada') {
    if (typeof mostrarPanelRol === 'function') mostrarPanelRol();
    return;
  }

  if (notif.tipo === 'pago_aprobado' || notif.tipo === 'pago_rechazado') {
    if (typeof mostrarPanelRol === 'function') mostrarPanelRol();
    return;
  }

  if (notif.tipo === 'ticket_actualizado') {
    if (typeof mostrarSeccion === 'function') mostrarSeccion('perfil');
    return;
  }
}


// ────────────────────────────────────────────────────────────
// CERRAR PANEL AL CLICKEAR AFUERA
// ────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const cont = document.getElementById('notif-campana-cont');
  const panel = document.getElementById('notif-panel');
  if (!cont || !panel) return;
  if (!_notifPanelAbierto) return;
  if (!cont.contains(e.target)) {
    panel.style.display = 'none';
    _notifPanelAbierto = false;
  }
});
