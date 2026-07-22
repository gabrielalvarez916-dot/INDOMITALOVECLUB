// ============================================================
// resenador.js — Indómita Love Club
// Panel del reseñador: postulaciones, ARCs activos,
// historial, ranking, cargar reseña
// ============================================================

const DURACION_PLAN_DIAS_RESEÑA = 30; // igual que en Apps Script, no está en tabla `configuracion`

async function obtenerPostulacionesReseñador() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from('postulaciones')
    .select(`
      id, estado, fecha_postulacion, fecha_respuesta, fecha_limite_entrega, fecha_abandono, motivo_abandono,
      campanas ( id, nombre_libro, nombre_autor, link_portada, id_usuario_autor, estado, fecha_limite, modalidad_lectura,
        campanas_archivos ( link_epub, link_pdf ) )
    `)
    .eq('id_usuario_resenador', user.id);

  if (error) { console.error(error); return []; }

  const DIAS_GRACIA_ENTREGA = 7;

const ahora = new Date();
return (data || [])
  .filter(p => {
    if (p.estado === 'pendiente') return true;

    if (p.estado === 'aprobada' && p.fecha_limite_entrega) {
      const limiteConGracia = new Date(p.fecha_limite_entrega);
      limiteConGracia.setDate(limiteConGracia.getDate() + DIAS_GRACIA_ENTREGA);
      return ahora <= limiteConGracia;
    }

    // abandonadas, rechazadas u otros casos sin fecha_limite_entrega: se mantiene el criterio original
    const fechaResolucion = new Date(p.fecha_respuesta || p.fecha_postulacion);
    if (isNaN(fechaResolucion.getTime())) return true;
    const limite = new Date(fechaResolucion);
    limite.setDate(limite.getDate() + DURACION_PLAN_DIAS_RESEÑA);
    return ahora <= limite;
  })
    .map(p => ({
      idPostulacion: p.id,
      estado: p.estado,
      fechaPostulacion: p.fecha_postulacion,
      fechaLimiteEntrega: p.fecha_limite_entrega,
      fechaAbandonoPrivado: p.fecha_abandono,
      campaña: p.campanas ? {
        id: p.campanas.id,
        nombreLibro: p.campanas.nombre_libro,
        nombreAutor: p.campanas.nombre_autor,
        linkPortada: p.campanas.link_portada,
        idAutor: p.campanas.id_usuario_autor,
        estado: p.campanas.estado,
        fechaLimite: p.campanas.fecha_limite,
       linkEpub: p.campanas.campanas_archivos?.link_epub || '',
        linkPdf: p.campanas.campanas_archivos?.link_pdf || '',
        modalidadLectura: p.campanas.modalidad_lectura || 'visor'
      } : null
    }));
}

// ────────────────────────────────────────────────────────────
// VARIABLES GLOBALES DEL PANEL RESEÑADOR
// ────────────────────────────────────────────────────────────

let _postulacionesReseñador = [];
let _arcsActivosReseñador   = [];
let _historialReseñador     = [];


// ────────────────────────────────────────────────────────────
// CARGAR PANEL RESEÑADOR
// ────────────────────────────────────────────────────────────

/**
 * Carga todos los datos del panel del reseñador.
 * Se llama automáticamente cuando se muestra la sección panel-resenador.
 */
async function cargarPanelResenador() {
  const email = Sesion.email();
  if (!email) return;

  await Promise.all([
    cargarEstadisticasReseñador(email),
    cargarPostulacionesReseñador(email),
    cargarArcsActivos(email),
    cargarHistorialReseñador(email),
    cargarRankingReseñador(email)
  ]);
}


// ────────────────────────────────────────────────────────────
// ESTADÍSTICAS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra las estadísticas del reseñador en el panel.
 *
 * @param {string} email
 */
async function cargarEstadisticasReseñador(email) {
  const contenedor = document.getElementById('resenador-stats');
  if (!contenedor) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
if (!user) return;

const mesActual = new Date().toISOString().slice(0, 7);

const [{ data: gamificacion }, { data: ranking }] = await Promise.all([
  supabaseClient.from('gamificacion').select('badge_historico').eq('id_usuario', user.id).maybeSingle(),
  supabaseClient.from('ranking').select('posicion, puntos_mensuales, porcentaje_completion, categoria').eq('id_usuario_resenador', user.id).eq('mes_año', mesActual).maybeSingle()
]);

const badgeHistorico  = gamificacion?.badge_historico || '—';
const puntosMensuales = ranking?.puntos_mensuales ?? '—';
const categoria       = ranking?.categoria || '';

const ICONOS_SVG = {
    medalla: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M9 13.5L7 22l5-3 5 3-2-8.5"/></svg>',
    grafico: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18M7 16l4-6 3 3 5-8"/></svg>',
    estrella: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.3L22 9.3l-5 4.9 1.2 7L12 17.8 5.8 21.2 7 14.2 2 9.3l7.1-1z"/></svg>',
    reloj:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    copa:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/></svg>'
  };

  const labelCategoria = {
    top5:     'Top 5',
    top20:    'Top 20',
    diamante: 'Liga Diamante',
    oro:      'Liga Oro',
    plata:    'Liga Plata',
    bronce:   'Liga Bronce',
    nuevo:    'Nuevo en el ranking'
  }[categoria] || '—';

const stats = [
    { icono: '🎖️', valor: badgeHistorico, label: 'Badge histórico', variante: 'bordo', texto: true },
    { icono: '📊', valor: ranking ? '#' + ranking.posicion : '—', label: 'Posición ranking', variante: 'dorado' },
    { icono: '⭐', valor: puntosMensuales, label: 'Puntos este mes', variante: 'rosa' },
    { icono: '⏱️', valor: ranking ? ranking.porcentaje_completion + '%' : '—', label: 'Completion este mes', variante: 'crema' },
    { icono: categoria === 'top5' ? '🏆' : '🎗️', valor: labelCategoria, label: 'Categoría del mes', variante: 'dorado', texto: true }
  ];

  contenedor.innerHTML = stats.map(s => `
    <div class="stat-card-v2 stat-card-v2--${s.variante}">
      <div class="stat-card-v2-header">${s.label}</div>
      <div class="stat-card-v2-body">
        <div class="stat-card-v2-icono">${s.icono}</div>
        <p class="stat-card-v2-numero${s.texto ? ' stat-card-v2-numero--texto' : ''}">${s.valor}</p>
      </div>
    </div>
  `).join('');
  }
// ────────────────────────────────────────────────────────────
// POSTULACIONES
// ────────────────────────────────────────────────────────────

/**
 * Carga las postulaciones del reseñador del mes actual.
 *
 * @param {string} email
 */
async function cargarPostulacionesReseñador(email) {
  const contenedor = document.getElementById('resenador-postulaciones-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  _postulacionesReseñador = await obtenerPostulacionesReseñador();
  
  if (_postulacionesReseñador.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📬</p>
        <p class="estado-vacio-texto">No tenés postulaciones este mes.</p>
        <p class="estado-vacio-sub">Explorá las campañas activas y postulate.</p>
        <button class="btn-primario" onclick="mostrarSeccion('feed')" style="margin-top:16px;">Ver campañas</button>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = _postulacionesReseñador.map(p => construirCardPostulacionReseñador(p)).join('');
}

/**
 * Construye la card de una postulación para el panel del reseñador.
 *
 * @param {Object} p — datos de la postulación
 * @returns {string} HTML de la card
 */
function construirCardPostulacionReseñador(p) {
  const c = p.campaña;
  if (!c) return '';

  const campañaCancelada = c.estado === 'cancelada';

  const portadaHtml = c.linkPortada
    ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="lista-item-portada" onerror="this.style.display='none'" />`
    : '';

  const linksLibro = !campañaCancelada && p.estado === 'aprobada' && (c.linkEpub || c.linkPdf) ? `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
      ${c.linkEpub ? `<button class="btn-secundario btn-sm" onclick="abrirVisorEpub('${c.id}', '${c.nombreLibro}')">📖 Leer EPUB</button>` : ''}
      ${c.linkPdf  ? `<button class="btn-secundario btn-sm" onclick="abrirVisorPdf('${c.id}', '${c.nombreLibro}')">📄 Leer PDF</button>`   : ''}
      ${c.modalidadLectura === 'descarga' && c.linkEpub ? `<button class="btn-secundario btn-sm" onclick="descargarLibro('${c.id}', '${c.nombreLibro}', 'epub')">⬇️ Descargar EPUB</button>` : ''}
      ${c.modalidadLectura === 'descarga' && c.linkPdf  ? `<button class="btn-secundario btn-sm" onclick="descargarLibro('${c.id}', '${c.nombreLibro}', 'pdf')">⬇️ Descargar PDF</button>` : ''}
    </div>
  ` : '';

 return `
    <div class="postulacion-resena-card">
      ${c.linkPortada ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="postulacion-resena-portada" onerror="this.style.display='none'" />` : '<div class="postulacion-resena-portada postulacion-resena-portada--vacia">📖</div>'}
      <div class="postulacion-resena-info">
        <div class="postulacion-resena-header">
          <p class="postulacion-resena-titulo">${c.nombreLibro}</p>
          ${campañaCancelada ? '<span class="badge-cancelada">Cancelada por el autor</span>' : badgeEstado(p.estado)}
        </div>
        <p class="postulacion-resena-autor"
   ${c.idAutor ? `onclick="abrirPerfilPublico('${c.idAutor}', 'autor')" style="cursor:pointer;"` : ''}>
  por ${c.nombreAutor}
</p>
        ${campañaCancelada
          ? '<p class="postulacion-resena-fecha" style="color:var(--error);">Esta campaña fue cancelada por el autor. No hace falta que la reseñes.</p>'
          : (p.estado === 'aprobada' ? `<p class="postulacion-resena-fecha">📅 Fecha límite para entregar: ${formatearFechaAmigable(p.fechaLimiteEntrega || c.fechaLimite)}</p>` : '')}
        ${linksLibro}
      </div>
    </div>
  `;
  }


// ────────────────────────────────────────────────────────────
// ARCs ACTIVOS
// ────────────────────────────────────────────────────────────

/**
 * Carga los ARCs activos del reseñador (postulaciones aprobadas
 * en campañas que todavía no vencieron y sin reseña entregada).
 *
 * @param {string} email
 */
async function cargarArcsActivos(email) {
  const contenedor = document.getElementById('resenador-arcs-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const postulaciones = await obtenerPostulacionesReseñador();
  const ahora = new Date();
  
  // Un ARC está activo mientras la postulación siga aprobada y no haya vencido
  // el plazo PERSONAL de entrega del reseñador (no el estado global de la campaña).
 const DIAS_GRACIA_ENTREGA = 7; // debe coincidir con la gracia de la policy RLS en Supabase

_arcsActivosReseñador = postulaciones.filter(p => {
  if (p.estado !== 'aprobada' || !p.campaña || p.campaña.estado === 'cancelada' || !p.fechaLimiteEntrega) {
    return false;
  }
  const limiteConGracia = new Date(p.fechaLimiteEntrega);
  limiteConGracia.setDate(limiteConGracia.getDate() + DIAS_GRACIA_ENTREGA);
  return ahora <= limiteConGracia;
});
  
  if (_arcsActivosReseñador.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📚</p>
        <p class="estado-vacio-texto">No tenés ARCs activos.</p>
        <p class="estado-vacio-sub">Cuando un autor apruebe tu postulación, el libro aparecerá acá.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `<div class="arcs-grid">${_arcsActivosReseñador.map(p => construirCardArcActivo(p)).join('')}</div>`;
}

/**
 * Construye la card de un ARC activo para el panel del reseñador.
 *
 * @param {Object} p — datos de la postulación aprobada
 * @returns {string} HTML de la card
 */
function construirCardArcActivo(p) {
  const c = p.campaña;
  const DIAS_GRACIA_ENTREGA = 7;

  const fechaLimite = p.fechaLimiteEntrega || c.fechaLimite;
  const ahora = new Date();
  const yaVencio = fechaLimite && ahora > new Date(fechaLimite);

  let textoFecha;
  if (yaVencio) {
    const fechaTope = new Date(fechaLimite);
    fechaTope.setDate(fechaTope.getDate() + DIAS_GRACIA_ENTREGA);
    textoFecha = `⚠️ Campaña vencida el ${formatearFechaAmigable(fechaLimite)}. Podés entregar hasta el ${formatearFechaAmigable(fechaTope.toISOString())}`;
  } else {
    textoFecha = `📅 Vence el ${formatearFechaAmigable(fechaLimite)}`;
  }

  return `
   <div class="arc-card">
    <div class="arc-card-portada-wrap">
        ${c.linkPortada
          ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="arc-card-portada" onerror="this.style.display='none'" />`
          : `<div class="arc-card-portada arc-card-portada--vacia">📖</div>`}
        <button class="arc-btn-denunciar" onclick="abrirModalDenuncia('campana', '${c.id}')" title="Denunciar este libro">🚩</button>
      </div>
      <div class="arc-card-body">
        <p class="arc-card-titulo">${c.nombreLibro}</p>
        <p class="arc-card-autor"
   ${c.idAutor ? `onclick="abrirPerfilPublico('${c.idAutor}', 'autor')" style="cursor:pointer;"` : ''}>
  por ${c.nombreAutor}
</p>
        <p class="arc-card-fecha"${yaVencio ? ' style="color:#c0392b;font-weight:600;"' : ''}>${textoFecha}</p>
        <div class="arc-card-acciones">
 ${c.linkEpub ? `<button class="btn-primario btn-full" onclick="abrirVisorEpub('${c.id}', '${c.nombreLibro}')">Leer EPUB</button>` : ''}
  ${c.linkPdf  ? `<button class="btn-secundario btn-full" onclick="abrirVisorPdf('${c.id}', '${c.nombreLibro}')">Leer PDF</button>`   : ''}
  ${c.modalidadLectura === 'descarga' && c.linkEpub ? `<button class="btn-secundario btn-full" onclick="descargarLibro('${c.id}', '${c.nombreLibro}', 'epub')">⬇️ Descargar EPUB</button>` : ''}
  ${c.modalidadLectura === 'descarga' && c.linkPdf  ? `<button class="btn-secundario btn-full" onclick="descargarLibro('${c.id}', '${c.nombreLibro}', 'pdf')">⬇️ Descargar PDF</button>` : ''}
  <button class="btn-secundario btn-full arc-btn-resena" onclick="abrirCargarResena('${c.id}')">✓ Entregar reseña</button>
  <button class="btn-peligro btn-full" onclick="abrirModalDNF('${p.idPostulacion}', '${c.nombreLibro}', '${c.nombreAutor}')">Abandonar libro (DNF)</button>
</div>
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────
// CARGAR RESEÑA
// ────────────────────────────────────────────────────────────

/**
 * Abre el modal para cargar la reseña de un ARC.
 *
 * @param {string} idCampaña
 */
let _resenaEnCurso = null; // guarda la postulación + campaña completa mientras se carga la reseña

function abrirCargarResena(idCampaña) {
  const item = _arcsActivosReseñador.find(p => p.campaña && p.campaña.id === idCampaña);
  if (!item) return;

  _resenaEnCurso = item;

  limpiarFormulario('form-cargar-resena');
  ocultarMensajes('resena-error', 'resena-ok', 'paso1-error');

  document.getElementById('resena-id-campana').value = idCampaña;

  // Auto: portada, autor, título (no lo carga el reseñador)
  const portadaEl = document.getElementById('paso1-portada');
  portadaEl.style.display = '';
  portadaEl.src = item.campaña.linkPortada || '';
  document.getElementById('paso1-titulo').textContent = item.campaña.nombreLibro || '';
  document.getElementById('paso1-autor').textContent = 'por ' + (item.campaña.nombreAutor || '');

  // Auto: fechas
  document.getElementById('paso1-fecha-postulacion').textContent = item.fechaPostulacion ? formatearFechaAmigable(item.fechaPostulacion) : '—';
  document.getElementById('paso1-fecha-entrega').textContent = formatearFechaAmigable(new Date().toISOString());

  // Reset estrellas
  document.getElementById('resena-puntuacion-libro').value = '';
  document.getElementById('resena-estrellas-label').textContent = 'Sin calificar';
  document.querySelectorAll('#resena-estrellas-container .estrella').forEach(e => e.classList.remove('activa'));

  // Reset moods
  document.querySelectorAll('input[name="resena-mood"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.mood-chip').classList.remove('activo');
  });

  // Reset frases favoritas
  document.getElementById('resena-frase-1').value = '';
  document.getElementById('resena-frase-2').value = '';
  document.getElementById('resena-frase-3').value = '';

  // Reset ratings decorativos
  document.querySelectorAll('.rating-decorativo-btn').forEach(b => b.classList.remove('activo'));
  ['romance', 'spice', 'drama', 'estilo'].forEach(cat => {
    document.getElementById('resena-rating-' + cat).value = '';
  });

  _mostrarPasoResena(1);
  mostrarModal('modal-cargar-resena');
}

/**
 * Selecciona un valor 1-5 para un rating decorativo (romance, spice, drama, estilo).
 * No afecta el ranking ni la calificación real del libro.
 */
function seleccionarRatingDecorativo(categoria, valor) {
  document.getElementById('resena-rating-' + categoria).value = valor;
  document.querySelectorAll(`.rating-decorativo-btn[data-categoria="${categoria}"]`).forEach(btn => {
    btn.classList.toggle('activo', parseInt(btn.dataset.valor) <= valor);
  });
}

/**
 * Muestra el Paso 1 o el Paso 2 del modal de reseña y actualiza el indicador.
 */
function _mostrarPasoResena(numero) {
  document.getElementById('resena-paso1').style.display = numero === 1 ? '' : 'none';
  document.getElementById('resena-paso2').style.display = numero === 2 ? '' : 'none';
  document.getElementById('resena-paso-indicador').textContent = `Paso ${numero}/2`;
}

/**
 * Valida el Paso 1 (frase favorita obligatoria) y avanza al Paso 2.
 */
function irAPasoResena2() {
  ocultarMensajes('paso1-error');
  const frase1 = document.getElementById('resena-frase-1')?.value?.trim();
  if (!frase1) {
    mostrarMensajeError('paso1-error', 'La primera frase favorita es obligatoria.');
    return;
  }
  _mostrarPasoResena(2);
}

function volverAPasoResena1() {
  _mostrarPasoResena(1);
}

/**
 * Envía la reseña completa (Paso 1 + Paso 2) al backend en un solo insert.
 * Se llama desde el submit del Paso 2/2.
 *
 * @param {Event} event
 */
async function enviarResena(event) {
  event.preventDefault();
  ocultarMensajes('resena-error', 'resena-ok');

  const idCampaña = document.getElementById('resena-id-campana')?.value;

  const frase1 = document.getElementById('resena-frase-1')?.value?.trim();
  if (!frase1) {
    mostrarMensajeError('resena-error', 'La primera frase favorita es obligatoria.');
    _mostrarPasoResena(1);
    return;
  }

  const moods = Array.from(document.querySelectorAll('input[name="resena-mood"]:checked')).map(cb => cb.value);

  const datos = {
    linkInstagram:    document.getElementById('resena-instagram')?.value?.trim(),
    linkTikTok:       document.getElementById('resena-tiktok')?.value?.trim(),
    linkAmazon:       document.getElementById('resena-amazon')?.value?.trim(),
    linkGoodreads:    document.getElementById('resena-goodreads')?.value?.trim(),
    comentarios:      document.getElementById('resena-comentarios')?.value?.trim(),
    puntuacionLibro:  document.getElementById('resena-puntuacion-libro')?.value || '',
    frase1,
    frase2: document.getElementById('resena-frase-2')?.value?.trim(),
    frase3: document.getElementById('resena-frase-3')?.value?.trim(),
    ratingRomance: document.getElementById('resena-rating-romance')?.value || '',
    ratingSpice:   document.getElementById('resena-rating-spice')?.value || '',
    ratingDrama:   document.getElementById('resena-rating-drama')?.value || '',
    ratingEstilo:  document.getElementById('resena-rating-estilo')?.value || ''
  };

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { data: postulacionAprobada } = await supabaseClient
    .from('postulaciones')
    .select('id')
    .eq('id_campana', idCampaña)
    .eq('estado', 'aprobada')
    .maybeSingle();

  if (!postulacionAprobada) {
    mostrarMensajeError('resena-error', 'No tenés una postulación aprobada en esta campaña.');
    return;
  }

  const { error } = await supabaseClient.from('resenas').insert({
    id_campana: idCampaña,
    id_postulacion: postulacionAprobada.id,
    id_usuario_resenador: user.id,
    link_instagram: datos.linkInstagram || '',
    link_tiktok: datos.linkTikTok || '',
    link_amazon: datos.linkAmazon || '',
    link_goodreads: datos.linkGoodreads || '',
    comentarios: datos.comentarios || '',
    puntuacion_libro: datos.puntuacionLibro ? parseInt(datos.puntuacionLibro) : null,
    moods: moods.length ? moods : null,
    frase_favorita_1: datos.frase1,
    frase_favorita_2: datos.frase2 || null,
    frase_favorita_3: datos.frase3 || null,
    rating_romance: datos.ratingRomance ? parseInt(datos.ratingRomance) : null,
    rating_spice: datos.ratingSpice ? parseInt(datos.ratingSpice) : null,
    rating_drama: datos.ratingDrama ? parseInt(datos.ratingDrama) : null,
    rating_estilo: datos.ratingEstilo ? parseInt(datos.ratingEstilo) : null
  });

  if (error) {
    if (error.code === '23505') {
      mostrarMensajeError('resena-error', 'Ya habías cargado una reseña para este libro.');
      return;
    }
    if (error.code === '23514') {
      mostrarMensajeError('resena-error', 'Debés cargar al menos un link de reseña.');
      return;
    }
    mostrarMensajeError('resena-error', 'Ocurrió un error al enviar la reseña. Intentá de nuevo.');
    return;
  }

  mostrarMensajeOk('resena-ok', '¡Reseña cargada correctamente!');

  setTimeout(async () => {
    cerrarModales();
    mostrarToast('¡Reseña enviada! Ganaste +100 puntos ⭐', 'ok');
    await cargarArcsActivos(Sesion.email());
    await cargarHistorialReseñador(Sesion.email());
    await cargarEstadisticasReseñador(Sesion.email());
  }, 1500);
}

// ────────────────────────────────────────────────────────────
// HISTORIAL
// ────────────────────────────────────────────────────────────

/**
 * Carga el historial completo de reseñas del reseñador.
 *
 * @param {string} email
 */
async function cargarHistorialReseñador(email) {
  const contenedor = document.getElementById('resenador-historial-lista');
  if (!contenedor) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
if (!user) return;

const { data: reseñas, error } = await supabaseClient
  .from('resenas')
  .select(`id, fecha_entrega, puntuacion_autor, link_instagram, link_tiktok, link_amazon, link_goodreads, comentarios,
    campanas ( nombre_libro, nombre_autor, link_portada )`)
  .eq('id_usuario_resenador', user.id)
  .order('fecha_entrega', { ascending: false });

if (error) {
  contenedor.innerHTML = `
    <div class="estado-vacio">
      <p class="estado-vacio-icono">📚</p>
      <p class="estado-vacio-texto">Todavía no hay libros en el ranking.</p>
      <p class="estado-vacio-sub">El ranking se arma cuando los libros acumulan al menos 3 reseñas.</p>
    </div>
  `;
  return;
}

_historialReseñador = (reseñas || []).map(r => ({
  fechaEntrega: r.fecha_entrega,
  puntuacion: r.puntuacion_autor,
  completion: null,
  linkInstagram: r.link_instagram,
  linkTikTok: r.link_tiktok,
  linkAmazon: r.link_amazon,
  linkGoodreads: r.link_goodreads,
  campaña: r.campanas ? {
    nombreLibro: r.campanas.nombre_libro,
    nombreAutor: r.campanas.nombre_autor,
    linkPortada: r.campanas.link_portada
  } : null
}));

const postulacionesAbandonadas = (await obtenerPostulacionesReseñador()).filter(p => p.estado === 'abandonada');

  // Combinar reseñas entregadas + abandonadas
  const historialCombinado = [
    ..._historialReseñador,
    ...postulacionesAbandonadas.map(p => ({
      id: p.idPostulacion,
      nombreLibro: p.campaña?.nombreLibro,
      nombreAutor: p.campaña?.nombreAutor,
      linkPortada: p.campaña?.linkPortada,
      fechaEntrega: p.fechaAbandonoPrivado || p.fechaAbandonoPrivado,
      esAbandonada: true,
      estado: 'abandonada'
    }))
  ];

  if (historialCombinado.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📖</p>
        <p class="estado-vacio-texto">Todavía no entregaste ninguna reseña.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = historialCombinado
    .map(r => r.esAbandonada ? construirCardHistorialDNF(r) : construirCardHistorialReseña(r))
    .join('');
}

function construirCardHistorialDNF(p) {
  return `
    <div class="lista-item">
      ${p.linkPortada ? `<img src="${p.linkPortada}" alt="${p.nombreLibro}" class="lista-item-portada" onerror="this.style.display='none'" />` : ''}
      <div class="lista-item-body">
        <div style="display:flex; align-items:center; gap:8px;">
          <p class="lista-item-titulo">${p.nombreLibro || 'Libro'}</p>
          <span class="badge bg-danger">DNF</span>
        </div>
        ${p.nombreAutor ? `<p class="lista-item-meta">por ${p.nombreAutor}</p>` : ''}
        <p style="font-size:12px; color:var(--gris-suave); margin:4px 0;">
          Abandonada: ${formatearFechaAmigable(p.fechaEntrega) || 'sin fecha'}
        </p>
      </div>
    </div>
  `;
}

/**
 * Construye la card de una reseña para el historial del reseñador.
 *
 * @param {Object} r — datos de la reseña
 * @returns {string} HTML de la card
 */
function construirCardHistorialReseña(r) {
  const c = r.campaña;

  const estrellas = r.puntuacion
    ? `<p style="font-size:13px; color:var(--bordo);">${'★'.repeat(r.puntuacion)}${'☆'.repeat(5 - r.puntuacion)} (${r.puntuacion}/5)</p>`
    : `<p style="font-size:12px; color:var(--gris-suave);">Sin calificar todavía</p>`;

  const completionHtml = r.completion != null ? `
    <div style="margin-top:8px;">
      <span class="completion-label">Completion</span>
      <span class="completion-valor" style="margin-left:6px;">${r.completion}%</span>
      <div class="completion-barra">
        <div class="completion-fill" style="width:${r.completion}%"></div>
      </div>
    </div>
  ` : '';
  
  return `
    <div class="lista-item">
      ${c && c.linkPortada ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="lista-item-portada" onerror="this.style.display='none'" />` : ''}
      <div class="lista-item-body">
        <p class="lista-item-titulo">${c ? c.nombreLibro : 'Libro eliminado'}</p>
        ${c ? `<p class="lista-item-meta">por ${c.nombreAutor}</p>` : ''}
        <p style="font-size:12px; color:var(--gris-suave); margin:4px 0;">
          Entregada: ${formatearFechaAmigable(r.fechaEntrega)}
        </p>
        ${estrellas}
        ${completionHtml}
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          ${r.linkInstagram ? `<a href="${r.linkInstagram}" target="_blank" class="red-link">Instagram</a>` : ''}
          ${r.linkTikTok    ? `<a href="${r.linkTikTok}"    target="_blank" class="red-link">TikTok</a>`    : ''}
          ${r.linkAmazon    ? `<a href="${r.linkAmazon}"    target="_blank" class="red-link">Amazon</a>`    : ''}
          ${r.linkGoodreads ? `<a href="${r.linkGoodreads}" target="_blank" class="red-link">Goodreads</a>` : ''}
        </div>
      </div>
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// RANKING
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra la posición del reseñador en el ranking del mes.
 *
 * @param {string} email
 */
async function cargarRankingReseñador(email) {
  const contenedor = document.getElementById('resenador-ranking-info');
  if (!contenedor) return;

  const { data, error } = await supabaseClient.rpc('obtener_ranking_resenadores');

if (error) {
  contenedor.innerHTML = `<p class="mensaje-error">Error al cargar el ranking.</p>`;
  return;
}

const { mes, destacados, top5, top20, ligas, lista_completa } = data;
  // Estado vacío: sin participantes
 if (!lista_completa || lista_completa.length === 0) {
    contenedor.innerHTML = `
      <div class="ranking-vacio">
        <div class="ranking-vacio-medalla">
          <svg viewBox="0 0 120 140" width="90" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(60,70)">
              <!-- ramas decorativas -->
              <path d="M-38,-10 Q-48,5 -36,20" stroke="#F2C4CE" stroke-width="2.5" fill="none"/>
              <path d="M-36,-4 Q-50,10 -40,26" stroke="#F2C4CE" stroke-width="2" fill="none"/>
              <path d="M-32,4 Q-46,18 -34,30" stroke="#F2C4CE" stroke-width="2" fill="none"/>
              <path d="M38,-10 Q48,5 36,20" stroke="#F2C4CE" stroke-width="2.5" fill="none"/>
              <path d="M36,-4 Q50,10 40,26" stroke="#F2C4CE" stroke-width="2" fill="none"/>
              <path d="M32,4 Q46,18 34,30" stroke="#F2C4CE" stroke-width="2" fill="none"/>
              <!-- destellos -->
              <text x="-28" y="-22" font-size="10" fill="#C9A84C">✦</text>
              <text x="22"  y="-22" font-size="10" fill="#C9A84C">✦</text>
              <text x="-6"  y="-30" font-size="8"  fill="#C9A84C">✦</text>
              <!-- medallon -->
              <circle cx="0" cy="8" r="28" fill="#8B1A2B"/>
              <circle cx="0" cy="8" r="22" fill="none" stroke="#F2C4CE" stroke-width="2"/>
              <text x="0" y="14" text-anchor="middle" font-size="20" fill="#F2C4CE">★</text>
              <!-- cinta -->
              <polygon points="-14,34 0,26 14,34 10,50 0,44 -10,50" fill="#8B1A2B"/>
              <polygon points="-14,34 -8,34 -4,50 -10,50" fill="#5C0F1A"/>
              <polygon points="14,34 8,34 4,50 10,50" fill="#5C0F1A"/>
            </g>
          </svg>
        </div>
        <p class="estado-vacio-texto" style="font-style:italic;">Todavía no participás en el ranking de este mes.</p>
        <p class="estado-vacio-sub">Necesitás al menos una campaña aprobada para aparecer en el ranking.</p>
      </div>
    `;
    return;
  }

  // Carrusel de destacados
  const destacadosHtml = `
    <div class="ranking-resenadores-seccion">
      <h4 class="ranking-seccion-titulo">Reseñadores destacados</h4>
      <div class="ranking-resenadores-carrusel-wrap">
        <button class="ranking-carrusel-arrow ranking-carrusel-prev" onclick="moverCarruselResenadores(-1)" aria-label="Anterior">&#8592;</button>
        <div class="ranking-resenadores-carrusel" id="carrusel-resenadores">
          ${destacados.map(r => `
            <div class="ranking-resenador-avatar-item">
              <img src="${r.avatar || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'}" alt="${r.alias}" class="ranking-resenador-avatar-img" onerror="this.src='/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'" />
              <p class="ranking-resenador-avatar-alias"
   ${r.id ? `onclick="abrirPerfilPublico('${r.id}', 'reseñador')" style="cursor:pointer;"` : ''}>
  ${r.alias}
</p>
              <span class="ranking-resenador-badge-nivel">${r.labelNivel || 'Novato'}</span>
            </div>
          `).join('')}
        </div>
        <button class="ranking-carrusel-arrow ranking-carrusel-next" onclick="moverCarruselResenadores(1)" aria-label="Siguiente">&#8594;</button>
      </div>
    </div>
  `;

 // Podio Top 5
  const ORDEN_PODIO = [3, 1, 0, 2, 4]; // índices de top5 (ordenado por posición 1..5) → orden visual: 4,2,1,3,5
  const ALTURA_POR_INDICE = { 0: 'alto-1', 1: 'alto-2', 2: 'alto-2', 3: 'alto-3', 4: 'alto-3' };

  const top5Html = top5 && top5.length > 0 ? `
    <div class="ranking-resenadores-seccion">
      <h4 class="ranking-seccion-titulo">🏆 Podio del mes</h4>
      <div class="ranking-podio-wrap">
        ${ORDEN_PODIO.filter(i => top5[i]).map(i => {
          const r = top5[i];
          const altura = ALTURA_POR_INDICE[i];
          return `
            <div class="ranking-podio-columna">
              <p class="ranking-podio-alias"
   ${r.id ? `onclick="abrirPerfilPublico('${r.id}', 'reseñador')" style="cursor:pointer;"` : ''}>${r.alias}</p>
              <div class="ranking-podio-avatar-wrap">
                ${i === 0 ? '<span class="ranking-podio-corona">👑</span>' : ''}
                <img src="${r.avatar || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'}" alt="${r.alias}" class="ranking-podio-avatar ${i === 0 ? 'ranking-podio-avatar--oro' : ''}" onerror="this.src='/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'" />
              </div>
              <p class="ranking-podio-puntos">♥ ${r.puntosMensuales ?? '—'} pts</p>
              <div class="ranking-podio-bloque ranking-podio-${altura}">
                <span class="ranking-podio-bloque-numero">${r.posicion}</span>
                <span class="ranking-podio-bloque-icono">${r.completion ?? '—'}%</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  // Top 20 (posiciones 6 en adelante)
  const top20Html = top20 && top20.length > 0 ? `
    <div class="ranking-resenadores-seccion">
      <h4 class="ranking-seccion-titulo">Top 20</h4>
      <div class="ranking-top-lista">
        ${top20.map(r => `
          <div class="ranking-resenador-top-item">
            <p class="ranking-top-item-pos" style="font-size:16px;">#${r.posicion}</p>
            <img src="${r.avatar || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'}" alt="${r.alias}" class="ranking-resenador-top-avatar" onerror="this.src='/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'" />
            <div class="ranking-top-item-info">
              <p class="ranking-top-item-titulo"
   ${r.id ? `onclick="abrirPerfilPublico('${r.id}', 'reseñador')" style="cursor:pointer;"` : ''}>
  ${r.alias}
</p>
            </div>
            <span class="ranking-resenador-badge-nivel">${r.puntosMensuales ?? 0} pts</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const nombresLiga = {
    diamante: '💎 Liga Diamante',
    oro:      '🥇 Liga Oro',
    plata:    '🥈 Liga Plata',
    bronce:   '🥉 Liga Bronce',
    nuevo:    '🌱 Nuevo en el ranking'
  };

  const _renderItemLiga = r => `
    <div class="ranking-resenador-top-item">
      <p class="ranking-top-item-pos" style="font-size:16px;">#${r.posicion}</p>
      <img src="${r.avatar || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'}" alt="${r.alias}" class="ranking-resenador-top-avatar" onerror="this.src='/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'" />
      <div class="ranking-top-item-info">
        <p class="ranking-top-item-titulo"
   ${r.id ? `onclick="abrirPerfilPublico('${r.id}', 'reseñador')" style="cursor:pointer;"` : ''}>
  ${r.alias}
</p>
      </div>
      <span class="ranking-resenador-badge-nivel">${r.puntosMensuales ?? 0} pts</span>
    </div>
  `;

  const LIMITE_LIGA = 10;

  const ligasHtml = ['diamante', 'oro', 'plata', 'bronce', 'nuevo'].map(codigo => {
    const lista = ligas?.[codigo] || [];
    if (lista.length === 0) return '';

    const primeros = lista.slice(0, LIMITE_LIGA);
    const resto     = lista.slice(LIMITE_LIGA);
    const idResto   = `ranking-liga-resto-${codigo}`;

    return `
      <div class="ranking-resenadores-seccion">
        <h4 class="ranking-seccion-titulo">${nombresLiga[codigo]} (${lista.length})</h4>
        <div class="ranking-top-lista">
          ${primeros.map(_renderItemLiga).join('')}
        </div>
        ${resto.length > 0 ? `
          <div id="${idResto}" class="ranking-top-lista" style="display:none; margin-top:10px;">
            ${resto.map(_renderItemLiga).join('')}
          </div>
          <button class="btn-secundario btn-sm" style="margin-top:10px;" onclick="_toggleVerMasLiga('${idResto}', this, ${resto.length})">Ver ${resto.length} más</button>
        ` : ''}
      </div>
    `;
  }).join('');

 contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:22px; font-weight:700; color:var(--bordo); margin-bottom:20px; font-style:italic;">Ranking — ${mes}</h3>
    ${top5Html}
    ${destacadosHtml}
    ${top20Html}
    ${ligasHtml}
  `;
}

function seleccionarEstrellaLibro(valor) {
  document.getElementById('resena-puntuacion-libro').value = valor;

  const labels = ['', 'No me gustó', 'Estuvo bien', 'Me gustó', 'Muy bueno', '¡Excelente!'];
  document.getElementById('resena-estrellas-label').textContent = labels[valor] || '';

  document.querySelectorAll('#resena-estrellas-container .estrella').forEach(btn => {
    btn.classList.toggle('activa', parseInt(btn.dataset.valor) <= valor);
  });
}
async function cargarRankingLibros(mesAño) {
  const contenedor = document.getElementById('ranking-libros-contenedor');
  if (!contenedor) return;
  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
  const mesActual = mesAño || new Date().toISOString().slice(0, 7);
  const mes = new Date(mesActual + '-01').toLocaleString('es-AR', { month: 'long', year: 'numeric' });

  const [{ data: recD }, { data: topD }] = await Promise.all([
    supabaseClient.from('ranking_libros').select('*').eq('mes_año', mesActual).not('pos_recomendado', 'is', null).order('pos_recomendado').limit(5),
    supabaseClient.from('ranking_libros').select('*').eq('mes_año', mesActual).not('pos_top', 'is', null).order('pos_top')
  ]);

  const adaptar = l => ({
    nombreLibro: l.nombre_libro, nombreAutor: l.nombre_autor, linkPortada: l.link_portada,
    promedio: l.promedio_puntuacion, totalReseñas: l.total_resenas, posicion: l.pos_top
  });

  const recomendados = (recD || []).map(adaptar);
  const listaTop      = (topD || []).map(adaptar);
  const top5          = listaTop.slice(0, 5);
  const resto         = listaTop.slice(5);

  // Podio Top 5 (mismo estilo que reseñadores, con portadas)
  const ORDEN_PODIO_LIBROS = [3, 1, 0, 2, 4]; // índices de top5 → orden visual 4,2,1,3,5
  const ALTURA_POR_INDICE_LIBROS = { 0: 'alto-1', 1: 'alto-2', 2: 'alto-2', 3: 'alto-3', 4: 'alto-3' };

  const top5Html = `
    <div style="margin-bottom:28px;">
      <h4 class="ranking-seccion-titulo">🏆 Top 5</h4>
      ${top5.length === 0
        ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
        : `<div class="ranking-podio-wrap">
            ${ORDEN_PODIO_LIBROS.filter(i => top5[i]).map(i => {
              const l = top5[i];
              const altura = ALTURA_POR_INDICE_LIBROS[i];
              const esOro = i === 0;
              return `
                <div class="ranking-podio-columna">
                  <p class="ranking-podio-alias">${l.nombreLibro}</p>
                  ${l.linkPortada
                    ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" class="ranking-podio-portada ${esOro ? 'ranking-podio-portada--oro' : ''}" onerror="this.style.display='none'" />`
                    : `<div class="ranking-podio-portada ${esOro ? 'ranking-podio-portada--oro' : ''}" style="display:flex; align-items:center; justify-content:center; font-size:22px;">📖</div>`}
                  <p class="ranking-podio-puntos">★ ${l.promedio?.toFixed(1) ?? '—'}</p>
                  <div class="ranking-podio-bloque ranking-podio-${altura}">
                    <span class="ranking-podio-bloque-numero">${l.posicion}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>`}
    </div>
  `;

  // Recomendados por lectores (carrusel)
  const recomendadosHtml = `
    <div style="margin-bottom:32px;">
      <h4 class="ranking-seccion-titulo">⭐ Recomendados por lectores</h4>
      <div class="ranking-slider">
        ${recomendados.length === 0
          ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
          : recomendados.map(l => construirSliderCard(l, 'recomendado')).join('')}
      </div>
    </div>
  `;

  // Del puesto 6 en adelante (carrusel con número arriba de cada portada)
  const restoHtml = resto.length > 0 ? `
    <div>
      <h4 class="ranking-seccion-titulo">📖 Resto del ranking</h4>
      <div class="ranking-slider">
        ${resto.map(l => construirSliderCardConNumero(l)).join('')}
      </div>
    </div>
  ` : '';

  contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:24px; font-weight:700; color:var(--bordo); margin-bottom:24px;">Ranking — ${mes}</h3>
    ${top5Html}
    ${recomendadosHtml}
    ${restoHtml}
  `;
  setTimeout(() => activarDragSliders(), 100);
}

function construirSliderCardConNumero(libro) {
  return `
    <div class="ranking-slider-card">
      <p class="ranking-slider-card-numero">#${libro.posicion}</p>
      ${libro.linkPortada
        ? `<img src="${libro.linkPortada}" alt="${libro.nombreLibro}" onerror="this.style.display='none'" />`
        : `<div style="width:100px; height:140px; background:var(--rosa-claro); border-radius:var(--radio); display:flex; align-items:center; justify-content:center; font-size:32px;">📖</div>`}
      <p class="ranking-slider-card-titulo">${libro.nombreLibro}</p>
      <p class="ranking-slider-card-autor">por ${libro.nombreAutor}</p>
      <p style="font-size:11px; color:var(--bordo); font-weight:700;">★ ${libro.promedio?.toFixed(1) ?? '—'}</p>
    </div>
  `;
}

function construirSliderCard(libro, categoria) {
  const metrica = categoria === 'masLeido'
    ? `${libro.totalReseñas} reseñas`
    : `★ ${libro.promedio?.toFixed(1)}`;

  return `
    <div class="ranking-slider-card">
      ${libro.linkPortada
        ? `<img src="${libro.linkPortada}" alt="${libro.nombreLibro}" onerror="this.style.display='none'" />`
        : `<div style="width:100px; height:140px; background:var(--rosa-claro); border-radius:var(--radio); display:flex; align-items:center; justify-content:center; font-size:32px;">📖</div>`}
      <p class="ranking-slider-card-titulo">${libro.nombreLibro}</p>
      <p class="ranking-slider-card-autor">por ${libro.nombreAutor}</p>
      <p style="font-size:11px; color:var(--bordo); font-weight:700;">${metrica}</p>
    </div>
  `;
}

function construirTopItem(libro) {
  return `
    <div class="ranking-top-item">
      <p class="ranking-top-item-pos">#${libro.posicion}</p>
      ${libro.linkPortada
        ? `<img src="${libro.linkPortada}" alt="${libro.nombreLibro}" onerror="this.style.display='none'" />`
        : `<div style="width:52px; height:72px; background:var(--rosa-claro); border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:22px;">📖</div>`}
      <div class="ranking-top-item-info">
        <p class="ranking-top-item-titulo">${libro.nombreLibro}</p>
        <p class="ranking-top-item-autor">por ${libro.nombreAutor}</p>
      </div>
      <p class="ranking-top-item-puntaje">★ ${libro.promedio?.toFixed(1)}</p>
    </div>
  `;
}
function activarDragSliders() {
  document.querySelectorAll('.ranking-slider').forEach(slider => {
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', e => {
      isDown = true;
      slider.style.cursor = 'grabbing';
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => {
      isDown = false;
      slider.style.cursor = 'grab';
    });
    slider.addEventListener('mouseup', () => {
      isDown = false;
      slider.style.cursor = 'grab';
    });
    slider.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      slider.scrollLeft = scrollLeft - walk;
    });

    slider.style.cursor = 'grab';
  });
}
function moverCarruselResenadores(dir) {
  const carrusel = document.getElementById('carrusel-resenadores');
  if (!carrusel) return;
  carrusel.scrollBy({ left: dir * 110, behavior: 'smooth' });
}
function _toggleVerMasLiga(idResto, boton, cantidadResto) {
  const contenedor = document.getElementById(idResto);
  if (!contenedor) return;
  const estaOculto = contenedor.style.display === 'none';
  contenedor.style.display = estaOculto ? '' : 'none';
  boton.textContent = estaOculto ? 'Ver menos' : `Ver ${cantidadResto} más`;
}
// ────────────────────────────────────────────────────────────
// ABANDONAR CAMPAÑA (DNF)
// ────────────────────────────────────────────────────────────

/**
 * Abre el modal para abandonar una campaña (DNF).
 * Usa el sistema de modales propio del sitio (mostrarModal/cerrarModales).
 *
 * @param {string} idPostulacion
 * @param {string} nombreLibro
 * @param {string} nombreAutor
 */
function abrirModalDNF(idPostulacion, nombreLibro, nombreAutor) {
  document.getElementById('dnf-id-postulacion').value = idPostulacion;
  document.getElementById('dnf-nombre-libro').textContent = nombreLibro || '';
  document.getElementById('dnf-motivo').value = '';
  document.getElementById('dnf-char-count').textContent = '0';
  ocultarMensajes('dnf-error');

  mostrarModal('modal-dnf');
}

/**
 * Actualiza el contador de caracteres del textarea de motivo DNF.
 * Se llama desde el oninput del textarea en el HTML.
 */
function actualizarContadorDNF() {
  const textarea = document.getElementById('dnf-motivo');
  const contador = document.getElementById('dnf-char-count');
  if (textarea && contador) contador.textContent = textarea.value.length;
}

/**
 * Confirma el abandono de la campaña (DNF).
 * Se llama desde el botón "Confirmar abandono" del modal.
 */
async function confirmarDNF() {
  ocultarMensajes('dnf-error');

  const idPostulacion = document.getElementById('dnf-id-postulacion')?.value;
  const motivo = document.getElementById('dnf-motivo')?.value?.trim();

  if (!motivo) {
    mostrarMensajeError('dnf-error', 'Por favor, contanos por qué decidiste abandonar esta lectura.');
    return;
  }

  toggleBoton('btn-confirmar-dnf', false, 'Procesando...');

  const { data, error } = await supabaseClient.rpc('abandonar_postulacion', {
  p_postulacion: idPostulacion,
  p_motivo: motivo
});

toggleBoton('btn-confirmar-dnf', true, '', 'Confirmar abandono');

if (error || data?.error) {
  mostrarMensajeError('dnf-error', data?.error || 'Error al abandonar la campaña.');
  return;
}

  cerrarModales();
  mostrarToast('Campaña abandonada correctamente.', 'ok');

  await cargarArcsActivos(Sesion.email());
  await cargarHistorialReseñador(Sesion.email());
  await cargarEstadisticasReseñador(Sesion.email());
}
