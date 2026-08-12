// ============================================================
// notificaciones.js — Indómita Love Club
// Campana de notificaciones in-app. Diferenciada por rol.
// ============================================================

let _notifPollingId = null;
let _notifCache = [];

// ────────────────────────────────────────────────────────────
// TEXTOS POR TIPO (diferenciados autor / reseñador)
// ────────────────────────────────────────────────────────────

// Mismo sistema de variantes que notificacionesApi.js (mobile) y la Edge
// Function enviar-push-notificacion: 3 opciones de copy por tipo, emoji fijo
// por categoría. La variante se elige con un hash estable del id de la
// notificación, así el push (mobile) y la campanita (acá) siempre muestran
// el mismo texto para la misma notificación.
function _hashSeed(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const VARIANTES = {
  // AUTOR
  postulacion_nueva: {
    emoji: '😏',
    textos: [
      (d) => `${d.aliasResenador || 'Alguien'} se postuló a "${d.nombreLibro || 'tu campaña'}". Después no digas que nadie quiere leerte.`,
      (d) => `ALERTA: alguien quiere leer "${d.nombreLibro || 'tu campaña'}". Se llama ${d.aliasResenador || 'alguien'}. Hacé algo.`,
      (d) => `${d.aliasResenador || 'Alguien'} se postuló a "${d.nombreLibro || 'tu campaña'}". Elegí sabiamente, criatura.`,
    ],
  },
  resena_cargada: {
    emoji: '🫣',
    textos: [
      (d) => `Hay una reseña nueva de "${d.nombreLibro || ''}". Que sea lo que Dios quiera.`,
      (d) => `Tenemos una reseña nueva de "${d.nombreLibro || ''}". Proceda con cautela.`,
      (d) => `No queremos meter presión, pero ${d.aliasResenador || 'alguien'} ya reseñó "${d.nombreLibro || ''}".`,
    ],
  },
  campaña_finalizada: {
    emoji: '🏁',
    textos: [
      (d) => `"${d.nombreLibro || ''}" llegó al final. ¿Y ahora qué hacemos con nuestras vidas?`,
      (d) => `Se terminó la campaña de "${d.nombreLibro || ''}". Nosotras ya tenemos el pochoclo.`,
      (d) => `Campaña finalizada. "${d.nombreLibro || ''}" hizo lo suyo. Ahora te toca a vos.`,
    ],
  },
  pago_aprobado: {
    emoji: '💅',
    textos: [
      (d) => `Pago aprobado. Qué buen gusto tenés: elegiste ${d.plan || 'tu plan'}.`,
      () => `Tu pago pasó. Una decisión cuestionable, pero nos encanta.`,
      () => `Pago aprobado. Ahora sí, oficialmente sos de los nuestros.`,
    ],
  },
  pago_rechazado: {
    emoji: '😭',
    textos: [
      () => `Houston, tenemos un problema: tu pago fue rechazado.`,
      () => `Casi. Pero tu pago fue rechazado.`,
      () => `Indómita te quiere. Tu banco, aparentemente, no — te rechazó el plan.`,
    ],
  },
  impulso_rechazado: {
    emoji: '🚫',
    textos: [
      (d) => `Tu impulso ${d.plan || ''} para "${d.nombreLibro || 'tu campaña'}" fue rechazado${d.motivo ? `: ${d.motivo}` : '.'}`,
      (d) => `No pudimos aprobar tu impulso ${d.plan || ''} de "${d.nombreLibro || 'tu campaña'}"${d.motivo ? `: ${d.motivo}` : '.'}`,
      (d) => `Rechazamos el impulso ${d.plan || ''} de "${d.nombreLibro || 'tu campaña'}"${d.motivo ? `. Motivo: ${d.motivo}` : '.'}`,
    ],
  },
  postulacion_abandono: {
    emoji: '💔',
    textos: [
      (d) => `${d.aliasResenador || 'Una reseñadora'} abandonó "${d.nombreLibro || ''}". La relación no funcionó.`,
      (d) => `No funcionó: ${d.aliasResenador || 'una reseñadora'} abandonó "${d.nombreLibro || ''}".`,
      (d) => `Se terminó el romance: ${d.aliasResenador || 'una reseñadora'} abandonó "${d.nombreLibro || ''}".`,
    ],
  },

  // RESEÑADOR
  campaña_cancelada_autor: {
    emoji: '🚨',
    textos: [
      (d) => `El autor canceló "${d.nombreLibro || ''}". Tu reseña queda oficialmente perdonada.`,
      (d) => `Cancelaron "${d.nombreLibro || ''}". Podés volver a tu vida.`,
      (d) => `El autor canceló la campaña de "${d.nombreLibro || ''}". Sí, podés respirar.`,
    ],
  },
  postulacion_aprobada: {
    emoji: '👀',
    textos: [
      (d) => `¡Entraste a "${d.nombreLibro || ''}"! Ahora demostrá que te lo merecías.`,
      (d) => `Buenas noticias: te aprobaron "${d.nombreLibro || ''}". Malas noticias: ahora hay que leerlo.`,
      (d) => `Te aprobaron "${d.nombreLibro || ''}". Qué lindo. Ahora leé.`,
    ],
  },
  postulacion_rechazada: {
    emoji: '💀',
    textos: [
      (d) => `Te rechazaron en "${d.nombreLibro || ''}". Dignidad ante todo.`,
      (d) => `Rechazada/o. "${d.nombreLibro || ''}" no sabe lo que se pierde.`,
      (d) => `No fue match: tu postulación a "${d.nombreLibro || ''}" fue rechazada.`,
    ],
  },
  resena_calificada: {
    emoji: '🤭',
    textos: [
      (d) => `Tu reseña pasó por el tribunal. ${d.puntuacion || '?'} estrellas.`,
      (d) => `¿Nervios? El autor ya calificó tu reseña: ${d.puntuacion || '?'}.`,
      (d) => `Tanto opinar… ahora te tocó recibir nota: ${d.puntuacion || '?'}.`,
    ],
  },
  recordatorio_resena: {
    emoji: '🫠',
    textos: [
      (d) => `Faltan pocos días. ¿Vas a reseñar "${d.nombreLibro || ''}" o vamos a fingir que no vimos nada?`,
      (d) => `Pssst… quedan pocos días para entregar "${d.nombreLibro || ''}".`,
      (d) => `Quedan pocos días para "${d.nombreLibro || ''}". ¿Todo bajo control? Porque parece que no.`,
    ],
  },
  toque_no_empezado: {
    emoji: '👉',
    textos: [
      (d) => `El autor de "${d.nombreLibro || ''}" te está mirando. Todavía no arrancaste.`,
      (d) => `Toque suave: "${d.nombreLibro || ''}" sigue esperando que lo abras.`,
      (d) => `Alguien se acordó de vos: falta que empieces "${d.nombreLibro || ''}".`,
    ],
  },
  toque_leyendo: {
    emoji: '👀',
    textos: [
      (d) => `El autor de "${d.nombreLibro || ''}" pasó a ver cómo vas.`,
      (d) => `Toque: seguís leyendo "${d.nombreLibro || ''}"… ¿cómo va?`,
      (d) => `Te tocaron el hombro. "${d.nombreLibro || ''}" sigue en curso.`,
    ],
  },
  toque_mitad: {
    emoji: '📖',
    textos: [
      (d) => `Vas por la mitad de "${d.nombreLibro || ''}" y el autor lo sabe.`,
      (d) => `Toque: ya casi. Falta la otra mitad de "${d.nombreLibro || ''}".`,
      (d) => `El autor de "${d.nombreLibro || ''}" te manda ánimo para que termines.`,
    ],
  },
  toque_finalizado: {
    emoji: '✍️',
    textos: [
      (d) => `Terminaste "${d.nombreLibro || ''}"… ¿y la reseña?`,
      (d) => `Toque: falta lo último. Escribí la reseña de "${d.nombreLibro || ''}".`,
      (d) => `El autor de "${d.nombreLibro || ''}" espera tu reseña, ya leíste todo.`,
    ],
  },
  resena_no_entregada: {
    emoji: '🔍',
    textos: [
      (d) => `Tu reseña de "${d.nombreLibro || ''}" quedó oficialmente atrasada.`,
      (d) => `¿Te acordabas de "${d.nombreLibro || ''}"? Porque el plazo sí se acordó de vos.`,
      (d) => `El tiempo pasó. La reseña no. Hablemos de "${d.nombreLibro || ''}".`,
    ],
  },
  nueva_campana_disponible: {
    emoji: '📖',
    textos: [
      (d) => `Nueva campaña desbloqueada: "${d.nombreLibro || ''}". Corré antes de que vuelen.`,
      (d) => `Tenemos algo nuevo para vos: "${d.nombreLibro || ''}" acaba de abrir campaña.`,
      (d) => `Nuevo candidato a obsesión desbloqueado: "${d.nombreLibro || ''}".`,
    ],
  },
  resena_compatible_impulso: {
    emoji: '❤️‍🔥',
    textos: [
      (d) => `No queremos meternos en tu vida, pero "${d.nombreLibro || ''}" tiene mucha compatibilidad con vos.`,
      (d) => `Tu algoritmo te conoce mejor que vos. "${d.nombreLibro || ''}" es para vos.`,
      (d) => `No te estamos diciendo qué leer, pero "${d.nombreLibro || ''}" te queda demasiado bien.`,
    ],
  },

  // AUTOR (nuevas)
  cupos_llenos: {
    emoji: '😜',
    textos: [
      (d) => `"${d.nombreLibro || ''}" agotó sus cupos. Algo estás haciendo bien.`,
      (d) => `Cupos completos de "${d.nombreLibro || ''}". No aceptamos más fans… por ahora.`,
      (d) => `Todos quieren leer "${d.nombreLibro || ''}". Cupos llenos. La presión empieza ahora.`,
    ],
  },

    auditoria_complete: {
    emoji: '🔎',
    textos: [
      (d) => `Terminamos tu auditoría de "${d.nombreLibro || ''}". Te contamos qué estrategia vamos a usar.`,
      (d) => `Auditoría lista para "${d.nombreLibro || ''}". Mirá qué encontramos.`,
      (d) => `Ya analizamos "${d.nombreLibro || ''}" a fondo. Te dejamos el resultado.`,
    ],
  },

  // TODOS LOS ROLES
  ticket_actualizado: {
    emoji: '🔔',
    textos: [
      (d) => `Tu ticket "${d.asunto || ''}" tiene novedades.`,
      (d) => `Hay novedades en tu ticket "${d.asunto || ''}". Vení a ver.`,
      (d) => `Actualizamos tu ticket "${d.asunto || ''}". Ya podés revisarlo.`,
    ],
  },
  completar_subgenero_perfil: {
    emoji: '🫦',
    textos: [
      () => `¿Fantasía? ¿Thriller? ¿Romance? Ahora decinos qué tipo te vuelve loco/a.`,
      () => `No te hagas el/la misterioso/a. Decinos qué subgéneros leés.`,
      () => `No podés decir "me gusta todo". Elegí tus subgéneros.`,
    ],
  },
  evento_reto_completado: {
    emoji: '👑',
    textos: [
      (d) => `¿Quién acaba de sumar +${d.puntosGanados || 0}? Vos. "${d.nombreReto || ''}" está hecho.`,
      (d) => `Otro reto mordió el polvo: "${d.nombreReto || ''}". +${d.puntosGanados || 0} puntos.`,
      (d) => `Completaste "${d.nombreReto || ''}". Ahora queremos ver si podés con el siguiente.`,
    ],
  },
  evento_completado: {
    emoji: '🎉',
    textos: [
      (d) => `"${d.nombreEvento || ''}" cayó. +${d.puntosGanados || 0} puntos. Siguiente víctima.`,
      (d) => `"${d.nombreEvento || ''}" completado. No te vamos a decir que sos mejor que los demás… pero.`,
      (d) => `Completaste "${d.nombreEvento || ''}". +${d.puntosGanados || 0} puntos. ¿Quién te para ahora?`,
    ],
  },
};

// INSIGNIAS: mismo criterio de variantes, elegidas por subtipo (d.tipo)
// dentro de insignia_obtenida.
const INSIGNIA_VARIANTES = {
  liga: {
    emoji: '🏆',
    textos: [
      () => `Subiste de liga. Mirá quién se nos puso competitivo/a.`,
      () => `Subiste de liga. No te pongas insoportable.`,
      () => `Ascendiste. ¿Hasta dónde pensás llegar?`,
    ],
  },
  completion: {
    emoji: '⭐',
    textos: [
      () => `100% este mes. No sabemos qué te pasó, pero nos encanta.`,
      () => `Todo hecho. 100%. Absolutamente nada que reclamarte.`,
      () => `¿100%? Bueno, alguien se tomó esto demasiado en serio.`,
    ],
  },
  top5: {
    emoji: '🔥',
    textos: [
      () => `Top 5 desbloqueado. El resto que se ponga las pilas.`,
      () => `TOP 5. Sí, estás entre los mejores. Bajá un cambio.`,
      () => `Entraste al Top 5. Ahora todos te tienen en la mira.`,
    ],
  },
  top20: {
    emoji: '🥇',
    textos: [
      () => `Top 20 desbloqueado. Ahora queremos verte subir.`,
      () => `Top 20. Bueno, bueno… alguien viene con ganas.`,
      () => `Entraste al Top 20. Nada mal, criatura.`,
    ],
  },
};

// Tipos sin variantes (copy fijo)
const NOTIF_TEXTOS = {
  campaña_cancelada_admin: (d) => `Tu campaña "${d.nombreLibro || ''}" fue cancelada por el equipo de Indómita.`,
};

function _textoNotificacion(notif) {
  const seed = notif.idNotificacion || `${notif.tipo}:${notif.referenciaId || ''}`;

  if (notif.tipo === 'insignia_obtenida') {
    const variante = INSIGNIA_VARIANTES[notif.datosExtra?.tipo];
    if (variante) {
      try {
        const idx = _hashSeed(seed) % variante.textos.length;
        return `${variante.emoji} ${variante.textos[idx](notif.datosExtra || {})}`;
      } catch (e) {
        return 'Ganaste una nueva insignia.';
      }
    }
    return 'Ganaste una nueva insignia.';
  }

  const variante = VARIANTES[notif.tipo];
  if (variante) {
    try {
      const idx = _hashSeed(seed) % variante.textos.length;
      return `${variante.emoji} ${variante.textos[idx](notif.datosExtra || {})}`;
    } catch (e) {
      return 'Tenés una notificación nueva.';
    }
  }

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
      <span class="notif-item-fecha">${_escNotif(_formatearFechaNotif(n.fecha))}</span>
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

function _formatearFechaNotif(fechaISO) {
  if (!fechaISO) return '';
  const fecha = new Date(fechaISO);
  if (isNaN(fecha.getTime())) return '';

  const ahora = new Date();
  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHoras < 24) return `Hace ${diffHoras} h`;
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) return `Hace ${diffDias} días`;

  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
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
    'campaña_cancelada_autor', 'recordatorio_resena',
    'resena_no_entregada', 'nueva_campana_disponible',
    'resena_compatible_impulso', 'cupos_llenos',
    'toque_no_empezado', 'toque_leyendo', 'toque_mitad', 'toque_finalizado'
  ];

  if (notif.tipo === 'auditoria_complete') {
    if (typeof mostrarPanelRol === 'function') mostrarPanelRol();
    return;
  }

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

  if (notif.tipo === 'ticket_actualizado' || notif.tipo === 'completar_subgenero_perfil') {
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
