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
  <h3 style="font-family:var(--fuente-titulo); font-size:24px; font-weight:700; color:var(--bordo); margin-bottom:24px;">Ranking de libros — ${mes}</h3>

  <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:12px;">📚 Más leídos</h4>
  <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:12px; margin-bottom:28px;">
    ${masLeidos.length === 0
      ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
      : masLeidos.slice(0, 10).map(l => `
          <div style="flex-shrink:0; width:90px; display:flex; flex-direction:column; gap:6px;">
            ${l.linkPortada
              ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" style="width:90px; height:126px; object-fit:cover; border-radius:8px; box-shadow:var(--sombra-card);" onerror="this.style.display='none'" />`
              : `<div style="width:90px; height:126px; background:var(--crema); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:24px;">📖</div>`}
            <p style="font-size:11px; font-weight:700; color:var(--bordo-oscuro); line-height:1.3; margin:0;">${l.nombreLibro}</p>
            <p style="font-size:10px; color:var(--gris-suave); margin:0;">${l.nombreAutor}</p>
          </div>
        `).join('')}
  </div>

  <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:12px;">⭐ Recomendados por lectores</h4>
  <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:12px; margin-bottom:28px;">
    ${recomendados.length === 0
      ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
      : recomendados.slice(0, 10).map(l => `
          <div style="flex-shrink:0; width:90px; display:flex; flex-direction:column; gap:6px;">
            ${l.linkPortada
              ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" style="width:90px; height:126px; object-fit:cover; border-radius:8px; box-shadow:var(--sombra-card);" onerror="this.style.display='none'" />`
              : `<div style="width:90px; height:126px; background:var(--crema); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:24px;">📖</div>`}
            <p style="font-size:11px; font-weight:700; color:var(--bordo-oscuro); line-height:1.3; margin:0;">${l.nombreLibro}</p>
            <p style="font-size:10px; color:var(--gris-suave); margin:0;">${l.nombreAutor}</p>
          </div>
        `).join('')}
  </div>

  <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:12px;">🏆 Top 5</h4>
  <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:28px;">
    ${top5.length === 0
      ? '<p class="estado-vacio-sub">No hay libros con 5 reseñas todavía.</p>'
      : top5.map((l, i) => `
          <div style="display:grid; grid-template-columns:28px 52px 1fr auto; align-items:center; gap:12px; background:var(--rosa-claro); border:1px solid var(--rosa); border-left:4px solid var(--bordo); border-radius:var(--radio-grande); padding:10px 14px; box-shadow:var(--sombra-card);">
            <p style="font-family:var(--fuente-titulo); font-size:20px; font-weight:700; color:var(--bordo); margin:0;">${i + 1}</p>
            ${l.linkPortada
              ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" style="width:52px; height:72px; object-fit:cover; border-radius:5px;" onerror="this.style.display='none'" />`
              : `<div style="width:52px; height:72px; background:var(--crema); border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:20px;">📖</div>`}
            <div style="min-width:0;">
              <p style="font-family:var(--fuente-titulo); font-size:14px; font-weight:700; color:var(--bordo-oscuro); font-style:italic; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.nombreLibro}</p>
              <p style="font-size:11px; color:var(--gris-suave); margin:2px 0 0;">${l.nombreAutor}</p>
            </div>
            <p style="font-size:13px; font-weight:700; color:var(--bordo); white-space:nowrap; margin:0;">⭐ ${l.promedioPuntuacion?.toFixed(1) ?? '—'}</p>
          </div>
        `).join('')}
  </div>

  ${top20.length > 5 ? `
  <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:12px;">Top 20</h4>
  <div style="display:flex; flex-direction:column; gap:10px;">
    ${top20.slice(5).map((l, i) => `
        <div style="display:grid; grid-template-columns:28px 52px 1fr auto; align-items:center; gap:12px; background:var(--blanco); border:1px solid var(--gris-borde); border-radius:var(--radio-grande); padding:10px 14px; box-shadow:var(--sombra-card);">
          <p style="font-family:var(--fuente-titulo); font-size:20px; font-weight:700; color:var(--bordo); margin:0;">${i + 6}</p>
          ${l.linkPortada
            ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" style="width:52px; height:72px; object-fit:cover; border-radius:5px;" onerror="this.style.display='none'" />`
            : `<div style="width:52px; height:72px; background:var(--crema); border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:20px;">📖</div>`}
          <div style="min-width:0;">
            <p style="font-family:var(--fuente-titulo); font-size:14px; font-weight:700; color:var(--bordo-oscuro); font-style:italic; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.nombreLibro}</p>
            <p style="font-size:11px; color:var(--gris-suave); margin:2px 0 0;">${l.nombreAutor}</p>
          </div>
          <p style="font-size:13px; font-weight:700; color:var(--bordo); white-space:nowrap; margin:0;">⭐ ${l.promedioPuntuacion?.toFixed(1) ?? '—'}</p>
        </div>
      `).join('')}
  </div>` : ''}
`;


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

  limpiarFormulario('form-cargar-resena');
  ocultarMensajes('resena-error', 'resena-ok');

  document.getElementById('resena-puntuacion-libro').value = '';
  document.getElementById('resena-estrellas-label').textContent = 'Sin calificar';
  document.querySelectorAll('#resena-estrellas-container .estrella').forEach(e => e.classList.remove('activa'));

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
    linkInstagram:    document.getElementById('resena-instagram')?.value?.trim(),
    linkTikTok:       document.getElementById('resena-tiktok')?.value?.trim(),
    linkAmazon:       document.getElementById('resena-amazon')?.value?.trim(),
    linkGoodreads:    document.getElementById('resena-goodreads')?.value?.trim(),
    comentarios:      document.getElementById('resena-comentarios')?.value?.trim(),
    puntuacionLibro:  document.getElementById('resena-puntuacion-libro')?.value || ''
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
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📚</p>
        <p class="estado-vacio-texto">Todavía no hay libros en el ranking.</p>
        <p class="estado-vacio-sub">El ranking se arma cuando los libros acumulan al menos 3 reseñas.</p>
      </div>
    `;
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

  const resultado = await llamarBackend('obtenerPosicionReseñador', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const d = resultado.datos;

  if (!d.enRanking) {
    contenedor.innerHTML = `
      <div class="ranking-vacio">
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
  const params = mesAño ? { mesAño } : {};
  const resultado = await llamarBackend('obtenerRankingLibros', params);
  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }
  const { mes, recomendados, masLeidos, top5, top20 } = resultado.datos;

  contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:24px; font-weight:700; color:var(--bordo); margin-bottom:24px;">Ranking de libros — ${mes}</h3>

    <div style="margin-bottom:32px;">
      <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:4px;">🏆 Top 5</h4>
      <p style="font-size:12px; color:var(--gris-suave); margin-bottom:16px;">Fórmula: 40% completion + 60% puntuación — mínimo 5 reseñas</p>
      ${top5.length === 0
        ? '<p class="estado-vacio-sub">No hay libros con 5 reseñas todavía.</p>'
        : top5.map(l => construirCardRankingLibro(l, 'top5')).join('')}
    </div>

    ${top20.length > 5 ? `
    <div style="margin-bottom:32px;">
      <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:16px;">Top 20</h4>
      ${top20.slice(5).map(l => construirCardRankingLibro(l, 'top20')).join('')}
    </div>` : ''}

    <div style="margin-bottom:32px;">
      <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:4px;">⭐ Recomendados por lectores</h4>
      <p style="font-size:12px; color:var(--gris-suave); margin-bottom:16px;">Mayor puntuación promedio este mes</p>
      ${recomendados.length === 0
        ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
        : recomendados.slice(0, 5).map(l => construirCardRankingLibro(l, 'recomendado')).join('')}
    </div>

    <div>
      <h4 style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); font-style:italic; margin-bottom:4px;">📚 Más leídos</h4>
      <p style="font-size:12px; color:var(--gris-suave); margin-bottom:16px;">Más reseñas recibidas este mes</p>
      ${masLeidos.length === 0
        ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
        : masLeidos.slice(0, 5).map(l => construirCardRankingLibro(l, 'masLeido')).join('')}
    </div>
  `;
}

function construirCardRankingLibro(libro, categoria) {
  const esTop5 = categoria === 'top5';

  const portada = libro.linkPortada
    ? `<img src="${libro.linkPortada}" alt="${libro.nombreLibro}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; flex-shrink:0; border:2px solid ${esTop5 ? 'var(--bordo)' : 'var(--gris-borde)'};" onerror="this.style.display='none'" />`
    : `<div style="width:44px; height:44px; border-radius:50%; background:var(--rosa-claro); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">📖</div>`;

  const metrica = categoria === 'masLeido'
    ? `<p style="font-size:12px; color:var(--gris-suave); margin:0;">${libro.totalReseñas} reseñas · ${libro.completion?.toFixed(0)}%</p>`
    : categoria === 'recomendado'
    ? `<p style="font-size:12px; color:var(--gris-suave); margin:0;">${libro.promedio?.toFixed(1)} ★ · ${libro.totalReseñas} reseñas</p>`
    : `<div style="text-align:right;"><p style="font-size:14px; font-weight:700; color:var(--bordo); margin:0;">★ ${libro.promedio?.toFixed(1)}</p><p style="font-size:12px; color:var(--gris-suave); margin:0;">${libro.completion?.toFixed(0)}%</p></div>`;

  return `
    <div style="
      background: ${esTop5 ? 'var(--rosa-claro)' : 'var(--blanco)'};
      border: 1px solid ${esTop5 ? 'var(--rosa)' : 'var(--gris-borde)'};
      border-left: ${esTop5 ? '4px solid var(--bordo)' : '1px solid var(--gris-borde)'};
      border-radius: var(--radio-grande);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 10px;
      box-shadow: var(--sombra-card);
    ">
      <p style="font-family:var(--fuente-titulo); font-size:${esTop5 ? '20px' : '16px'}; font-weight:700; color:var(--bordo); min-width:32px; margin:0;">#${libro.posicion}</p>
      ${portada}
      <div style="flex:1; min-width:0;">
        <p style="font-family:var(--fuente-titulo); font-size:15px; font-weight:700; color:var(--bordo-oscuro); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${libro.nombreLibro}</p>
        <p style="font-size:12px; color:var(--gris-suave); margin:0;">por ${libro.nombreAutor}</p>
      </div>
      ${metrica}
    </div>
  `;
}
