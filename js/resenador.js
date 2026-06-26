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
      <span class="stat-icono-corazon">♥</span>
      <span class="stat-numero">${u.totalReseñas ?? 0}</span>
      <span class="stat-label">Reseñas totales</span>
    </div>
    <div class="stat-card">
      <span class="stat-icono-corazon">♥</span>
      <span class="stat-numero stat-nivel">${u.labelNivel?.split(' ')[0] || 'Nuevo'}</span>
      <span class="stat-badge-nivel">${u.labelNivel || 'Nuevo en la comunidad'}</span>
    </div>
    <div class="stat-card">
      <span class="stat-icono-corazon">♥</span>
      <span class="stat-numero">${u.ranking ? u.ranking.posicion : '—'}</span>
      <span class="stat-label">Posición ranking</span>
    </div>
    <div class="stat-card">
      <span class="stat-icono-corazon">♥</span>
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
    <div class="postulacion-resena-card">
      ${c.linkPortada ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="postulacion-resena-portada" onerror="this.style.display='none'" />` : '<div class="postulacion-resena-portada postulacion-resena-portada--vacia">📖</div>'}
      <div class="postulacion-resena-info">
        <div class="postulacion-resena-header">
          <p class="postulacion-resena-titulo">${c.nombreLibro}</p>
          ${badgeEstado(p.estado)}
        </div>
        <p class="postulacion-resena-autor">por ${c.nombreAutor}</p>
        ${p.estado === 'aprobada' ? `<p class="postulacion-resena-fecha">📅 Fecha límite para entregar: ${formatearFechaAmigable(p.fechaLimiteEntrega || c.fechaLimite)}</p>` : ''}
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

 return `
    <div class="arc-card">
      <div class="arc-card-portada-wrap">
        ${c.linkPortada
          ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="arc-card-portada" onerror="this.style.display='none'" />`
          : `<div class="arc-card-portada arc-card-portada--vacia">📖</div>`}
      </div>
      <div class="arc-card-body">
        <p class="arc-card-titulo">${c.nombreLibro}</p>
        <p class="arc-card-autor">por ${c.nombreAutor}</p>
        <p class="arc-card-fecha">📅 Vence el ${formatearFechaAmigable(p.fechaLimiteEntrega || c.fechaLimite)}</p>
        <div class="arc-card-acciones">
          ${c.linkEpub ? `<button class="btn-primario btn-full" onclick="abrirVisorEpub('${c.linkEpub}', '${c.nombreLibro}')">Leer EPUB</button>` : ''}
          ${c.linkPdf  ? `<button class="btn-secundario btn-full" onclick="abrirVisorPdf('${c.linkPdf}', '${c.nombreLibro}')">Leer PDF</button>`   : ''}
          <button class="btn-secundario btn-full arc-btn-resena" onclick="abrirCargarResena('${c.id}')">✓ Entregar reseña</button>
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
  limpiarFormulario('form-cargar-resena');  // ← primero limpiás

  const inputCampaña = document.getElementById('resena-id-campana');
  if (inputCampaña) inputCampaña.value = idCampaña;  // ← después guardás el ID
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

  console.log('enviando resena - idCampaña:', idCampaña);
console.log('enviando resena - datos:', JSON.stringify(datos));

  const resultado = await llamarBackend('cargarReseña', {
  email:                Sesion.email(),
  idCampana:            idCampaña,
  'datos.linkInstagram': datos.linkInstagram  || '',
  'datos.linkTikTok':    datos.linkTikTok     || '',
  'datos.linkAmazon':    datos.linkAmazon     || '',
  'datos.linkGoodreads': datos.linkGoodreads  || '',
  'datos.comentarios':   datos.comentarios    || '',
  'datos.puntuacionLibro': datos.puntuacionLibro || ''
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

  const resultado = await llamarBackend('obtenerRankingReseñadores', {});

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const { mes, destacados, top5, top20, miPosicion } = resultado.datos;

  // Estado vacío: sin participantes
  if (!destacados || destacados.length === 0) {
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

  // Top 5
  const top5Html = top5 && top5.length > 0 ? `
    <div class="ranking-resenadores-seccion">
      <h4 class="ranking-seccion-titulo">Top 5</h4>
      <div class="ranking-top-lista">
        ${top5.map(r => `
          <div class="ranking-resenador-top-item ranking-resenador-top-item--destacado">
            <p class="ranking-top-item-pos">#${r.posicion}</p>
            <img src="${r.avatar || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'}" alt="${r.alias}" class="ranking-resenador-top-avatar" onerror="this.src='/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'" />
            <div class="ranking-top-item-info">
              <p class="ranking-top-item-titulo"
   ${r.id ? `onclick="abrirPerfilPublico('${r.id}', 'reseñador')" style="cursor:pointer;"` : ''}>
  ${r.alias}
</p>
              <span class="ranking-resenador-badge-nivel">${r.labelNivel || 'Novato'}</span>
            </div>
            <div style="text-align:right;">
              <p class="ranking-top-item-puntaje">★ ${r.promedio?.toFixed(1) ?? '—'}</p>
              <p style="font-size:11px; color:var(--gris-suave);">${r.completion ?? '—'}%</p>
            </div>
          </div>
        `).join('')}
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
            <span class="ranking-resenador-badge-nivel">${r.labelNivel || 'Novato'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:22px; font-weight:700; color:var(--bordo); margin-bottom:20px; font-style:italic;">Ranking — ${mes}</h3>
    ${destacadosHtml}
    ${top5Html}
    ${top20Html}
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
  const { mes, recomendados, masLeidos, top5 } = resultado.datos;

  contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:24px; font-weight:700; color:var(--bordo); margin-bottom:24px;">Ranking — ${mes}</h3>

    <div style="margin-bottom:28px;">
      <h4 class="ranking-seccion-titulo">⭐ Recomendados por lectores</h4>
      <div class="ranking-slider">
        ${recomendados.length === 0
          ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
          : recomendados.slice(0, 5).map(l => construirSliderCard(l, 'recomendado')).join('')}
      </div>
    </div>

    <div style="margin-bottom:32px;">
      <h4 class="ranking-seccion-titulo">📚 Más leídos</h4>
      <div class="ranking-slider">
        ${masLeidos.length === 0
          ? '<p class="estado-vacio-sub">Sin datos suficientes todavía.</p>'
          : masLeidos.slice(0, 5).map(l => construirSliderCard(l, 'masLeido')).join('')}
      </div>
    </div>

    <div>
      <h4 class="ranking-seccion-titulo">🏆 Top 5</h4>
      <div class="ranking-top-lista">
        ${top5.length === 0
          ? '<p class="estado-vacio-sub">No hay libros con 5 reseñas todavía.</p>'
          : top5.map(l => construirTopItem(l)).join('')}
      </div>
    </div>
  `;
  setTimeout(() => activarDragSliders(), 100);
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
