// ============================================================
// resenador.js — Indómita Love Club
// Panel del reseñador: postulaciones, ARCs activos,
// historial, ranking, cargar reseña
// ============================================================


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

  const resultado = await llamarBackend('obtenerPerfil', { email });
  if (!resultado.ok) return;

  const u = resultado.datos.perfil;

  contenedor.innerHTML = `
    <div class="stat-card">
      <span class="stat-numero">${u.totalReseñasHistoricas ?? 0}</span>
      <span class="stat-label">Reseñas totales</span>
    </div>
    <div class="stat-card">
      <span class="stat-numero">${u.labelNivel || 'Nuevo miembro'}</span>
      <span class="stat-label">Nivel</span>
    </div>
    <div class="stat-card">
      <span class="stat-numero">${u.ranking ? u.ranking.posicion : '—'}</span>
      <span class="stat-label">Posición ranking</span>
    </div>
    <div class="stat-card">
      <span class="stat-numero">${u.ranking ? u.ranking.porcentajeCompletion + '%' : '—'}</span>
      <span class="stat-label">Completion este mes</span>
    </div>
  `;
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

  const resultado = await llamarBackend('listarPostulacionesReseñador', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  _postulacionesReseñador = resultado.datos.postulaciones || [];

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

  const portadaHtml = c.linkPortada
    ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="lista-item-portada" onerror="this.style.display='none'" />`
    : '';

  const linksLibro = p.estado === 'aprobada' && (c.linkEpub || c.linkPdf) ? `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
      ${c.linkEpub ? `<button class="btn-secundario btn-sm" onclick="abrirVisorEpub('${c.linkEpub}', '${c.nombreLibro}')">📖 Leer EPUB</button>` : ''}
      ${c.linkPdf  ? `<button class="btn-secundario btn-sm" onclick="abrirVisorPdf('${c.linkPdf}', '${c.nombreLibro}')">📄 Leer PDF</button>`   : ''}
    </div>
  ` : '';

  return `
    <div class="lista-item">
      ${portadaHtml}
      <div class="lista-item-body">
        <p class="lista-item-titulo">${c.nombreLibro}</p>
        <p class="lista-item-meta">por ${c.nombreAutor}</p>
        ${badgeEstado(p.estado)}
        ${p.estado === 'aprobada' ? `<p style="font-size:12px; color:var(--gris-suave); margin-top:4px;">Fecha límite: ${formatearFechaAmigable(c.fechaLimite)}</p>` : ''}
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

  const resultado = await llamarBackend('listarPostulacionesReseñador', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  // Filtra solo postulaciones aprobadas en campañas activas
  _arcsActivosReseñador = (resultado.datos.postulaciones || []).filter(p =>
    p.estado === 'aprobada' &&
    p.campaña &&
    p.campaña.estado === 'activa'
  );

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

  contenedor.innerHTML = _arcsActivosReseñador.map(p => construirCardArcActivo(p)).join('');
}

/**
 * Construye la card de un ARC activo para el panel del reseñador.
 *
 * @param {Object} p — datos de la postulación aprobada
 * @returns {string} HTML de la card
 */
function construirCardArcActivo(p) {
  const c = p.campaña;

  return `
    <div class="lista-item">
      ${c.linkPortada ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="lista-item-portada" onerror="this.style.display='none'" />` : ''}
      <div class="lista-item-body">
        <p class="lista-item-titulo">${c.nombreLibro}</p>
        <p class="lista-item-meta">por ${c.nombreAutor}</p>
        <p style="font-size:12px; color:var(--gris-suave); margin:4px 0;">
          Fecha límite: <strong>${formatearFechaAmigable(c.fechaLimite)}</strong>
        </p>
        <div class="lista-item-acciones">
          ${c.linkEpub ? `<button class="btn-secundario btn-sm" onclick="abrirVisorEpub('${c.linkEpub}', '${c.nombreLibro}')">📖 Leer EPUB</button>` : ''}
          ${c.linkPdf  ? `<button class="btn-secundario btn-sm" onclick="abrirVisorPdf('${c.linkPdf}', '${c.nombreLibro}')">📄 Leer PDF</button>`   : ''}
          <button class="btn-primario btn-sm" onclick="abrirCargarResena('${c.id}')">Cargar reseña</button>
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
function abrirCargarResena(idCampaña) {
  const inputCampaña = document.getElementById('resena-id-campana');
  if (inputCampaña) inputCampaña.value = idCampaña;

  // Limpia el formulario
  limpiarFormulario('form-cargar-resena');
  ocultarMensajes('resena-error', 'resena-ok');

  mostrarModal('modal-cargar-resena');
}

/**
 * Envía la reseña al backend.
 * Se llama desde el submit del modal.
 *
 * @param {Event} event
 */
async function enviarResena(event) {
  event.preventDefault();
  ocultarMensajes('resena-error', 'resena-ok');

  const idCampaña = document.getElementById('resena-id-campana')?.value;

  const datos = {
    linkInstagram: document.getElementById('resena-instagram')?.value?.trim(),
    linkTikTok:    document.getElementById('resena-tiktok')?.value?.trim(),
    linkAmazon:    document.getElementById('resena-amazon')?.value?.trim(),
    linkGoodreads: document.getElementById('resena-goodreads')?.value?.trim(),
    comentarios:   document.getElementById('resena-comentarios')?.value?.trim()
  };

  const resultado = await llamarBackend('cargarReseña', {
    email: Sesion.email(),
    idCampana: idCampaña,
    datos
  });

  if (!resultado.ok) {
    mostrarMensajeError('resena-error', resultado.mensaje);
    return;
  }

  mostrarMensajeOk('resena-ok', '¡Reseña cargada correctamente!');

  setTimeout(async () => {
    cerrarModales();
    mostrarToast('¡Reseña enviada! El autor recibirá una notificación.', 'ok');
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

  const resultado = await llamarBackend('listarReseñasReseñador', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  _historialReseñador = resultado.datos.reseñas || [];

  if (_historialReseñador.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📖</p>
        <p class="estado-vacio-texto">Todavía no entregaste ninguna reseña.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = _historialReseñador.map(r => construirCardHistorialReseña(r)).join('');
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

  const resultado = await llamarBackend('obtenerPosicionReseñador', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const d = resultado.datos;

  if (!d.enRanking) {
    contenedor.innerHTML = `
      <div class="ranking-info">
        <p class="estado-vacio-icono">🏅</p>
        <p class="estado-vacio-texto">Todavía no participás en el ranking de este mes.</p>
        <p class="estado-vacio-sub">Necesitás al menos una campaña aprobada para aparecer en el ranking.</p>
      </div>
    `;
    return;
  }

  const usuario = Sesion.obtener();
  const nivel = usuario?.nivel || '';
  if (nivel === 'nuevo_miembro') {
    contenedor.innerHTML = `
      <div class="ranking-info">
        <p class="estado-vacio-icono">🌱</p>
        <p class="estado-vacio-texto">Todavía sos nuevo miembro.</p>
        <p class="estado-vacio-sub">Necesitás 5 reseñas históricas para aparecer en el ranking.</p>
      </div>
    `;
    return;
  }

  const badgesHtml = badgesRanking(d.badges);

  contenedor.innerHTML = `
    <div class="ranking-info">
      <div class="ranking-posicion">#${d.posicion}</div>
      <p class="ranking-posicion-label">en el ranking de ${d.mes}</p>
      ${badgesHtml ? `<div style="margin:12px 0;">${badgesHtml}</div>` : ''}
      <div class="ranking-stats">
        <div class="ranking-stat-item">
          <p class="ranking-stat-numero">${d.completion?.toFixed(1) ?? '—'}%</p>
          <p class="ranking-stat-label">Completion</p>
        </div>
        <div class="ranking-stat-item">
          <p class="ranking-stat-numero">${d.promedio?.toFixed(1) ?? '—'}</p>
          <p class="ranking-stat-label">Promedio nota</p>
        </div>
        <div class="ranking-stat-item">
          <p class="ranking-stat-numero">${d.entregadas ?? 0}</p>
          <p class="ranking-stat-label">Reseñas entregadas</p>
        </div>
        <div class="ranking-stat-item">
          <p class="ranking-stat-numero">${d.puntaje?.toFixed(1) ?? '—'}</p>
          <p class="ranking-stat-label">Puntaje final</p>
        </div>
      </div>
      ${d.badges?.top5 ? `<p style="margin-top:20px; font-size:14px; color:var(--bordo); font-weight:700;">🏆 Sos Top 5 este mes — tenés postulaciones ilimitadas y aprobación automática.</p>` : ''}
    </div>
  `;
}
