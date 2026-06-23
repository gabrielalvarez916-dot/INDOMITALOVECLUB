// ============================================================
// autor.js — Indómita Love Club
// Panel del autor: campañas, postulaciones, historial, plan, biblioteca
// ============================================================


// ────────────────────────────────────────────────────────────
// VARIABLES GLOBALES DEL PANEL AUTOR
// ────────────────────────────────────────────────────────────

let _campañasAutor      = [];
let _postulacionesAutor = [];
let _historialAutor     = [];
let _librosAutor        = [];

function convertirLinkDrive(url) {
  if (!url) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
  return url;
}

// ────────────────────────────────────────────────────────────
// CARGAR PANEL AUTOR
// ────────────────────────────────────────────────────────────

/**
 * Carga todos los datos del panel del autor.
 * Se llama automáticamente cuando se muestra la sección panel-autor.
 */
async function cargarPanelAutor() {
  const email = Sesion.email();
  if (!email) return;

  await Promise.all([
    cargarEstadisticasAutor(email),
    cargarCampañasAutor(email),
    cargarHistorialAutor(email),
    cargarPlanAutor(email),
    cargarBibliotecaPanel(email)
  ]);
}


// ────────────────────────────────────────────────────────────
// ESTADÍSTICAS
// ────────────────────────────────────────────────────────────

/**
 * Carga y muestra las estadísticas del autor en el panel.
 *
 * @param {string} email
 */
async function cargarEstadisticasAutor(email) {
  const contenedor = document.getElementById('autor-stats');
  if (!contenedor) return;

  const resultado = await llamarBackend('estadisticasAutor', { email });
  if (!resultado.ok) return;

  const s = resultado.datos;

  const stats = [
    { icono: '📣', valor: s.campañasActivas ?? 0, label: 'Campañas activas' },
    { icono: '⭐', valor: s.reseñasRecibidas ?? 0, label: 'Reseñas recibidas' },
    { icono: '👥', valor: s.reseñadoresAprobados ?? 0, label: 'Reseñadores aprobados' },
    { icono: '📊', valor: s.promedioCalificaciones ? s.promedioCalificaciones.toFixed(1) : '—', label: 'Promedio de calificaciones' }
  ];

  contenedor.innerHTML = stats.map(s => `
    <div style="
      background: var(--blanco);
      border: 1px solid var(--gris-borde);
      border-radius: var(--radio-grande);
      padding: 24px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: var(--sombra-card);
    ">
      <div style="
        width: 52px; height: 52px;
        background: var(--rosa-claro);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; flex-shrink: 0;
      ">${s.icono}</div>
      <div>
        <p style="font-family:var(--fuente-titulo); font-size:32px; font-weight:700; color:var(--bordo); line-height:1; margin-bottom:4px;">${s.valor}</p>
        <p style="font-size:12px; color:var(--gris-suave); font-weight:600; text-transform:uppercase; letter-spacing:0.4px; margin:0;">${s.label}</p>
      </div>
    </div>
  `).join('');
}


// ────────────────────────────────────────────────────────────
// CAMPAÑAS ACTIVAS
// ────────────────────────────────────────────────────────────

/**
 * Carga las campañas activas del autor.
 *
 * @param {string} email
 */
async function cargarCampañasAutor(email) {
  const contenedor = document.getElementById('autor-campanas-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const resultado = await llamarBackend('listarCampanasAutor', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  _campañasAutor = resultado.datos.campañas || [];

  if (_campañasAutor.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📚</p>
        <p class="estado-vacio-texto">No tenés campañas activas.</p>
        <p class="estado-vacio-sub">Creá tu primera campaña para empezar a recibir reseñas.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = _campañasAutor.map(c => construirCardCampañaAutor(c)).join('');
}

/**
 * Construye la card de una campaña activa para el panel del autor.
 *
 * @param {Object} c — datos de la campaña
 * @returns {string} HTML de la card
 */
function construirCardCampañaAutor(c) {
  const porcentajeOcupacion = c.cuposTotal > 0
    ? Math.round(((c.cuposTotal - c.cuposDisponibles) / c.cuposTotal) * 100)
    : 0;

  return `
    <div class="campana-panel-card">
      <div class="campana-panel-portada">
        ${c.linkPortada
          ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" onerror="this.style.display='none'" />`
          : `<div class="campana-panel-portada-placeholder">📖</div>`}
        ${badgeEstado(c.estado)}
      </div>
      <div class="campana-panel-body">
        <p class="campana-panel-titulo">${c.nombreLibro}</p>
        <p class="campana-panel-autor">por ${c.nombreAutor}</p>
        <div class="campana-panel-meta">
          <span>📅 Hasta ${formatearFechaAmigable(c.fechaLimite)}</span>
          ${c.postulacionesPendientes > 0 ? `<span>⏳ ${c.postulacionesPendientes} pendiente${c.postulacionesPendientes !== 1 ? 's' : ''}</span>` : ''}
          ${c.reseñasEntregadas > 0 ? `<span>📝 ${c.reseñasEntregadas} reseña${c.reseñasEntregadas !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="barra-progreso">
          <div class="barra-progreso-fill" style="width:${porcentajeOcupacion}%"></div>
        </div>
        <p class="campana-panel-cupos">${c.cuposTotal - c.cuposDisponibles} / ${c.cuposTotal} reseñad@res</p>
        <div class="campana-panel-acciones">
          <button class="btn-secundario btn-sm btn-full" onclick="verPostulacionesCampana('${c.id}', '${c.nombreLibro}')">Ver postulaciones</button>
          <button class="btn-secundario btn-sm btn-full" onclick="verReseñasCampana('${c.id}', '${c.nombreLibro}')">Ver reseñas</button>
          <button class="btn-secundario btn-sm btn-full" onclick="compartirCampana('${c.id}', '${c.nombreLibro}')">📤 Compartir</button>
          <button class="btn-secundario btn-sm btn-full" onclick="abrirEditarCampana('${c.id}')">✏️ Editar campaña</button>
          <button class="btn-secundario btn-sm btn-full btn-peligro" onclick="confirmarCancelarCampana('${c.id}', '${c.nombreLibro}')">Cancelar campaña</button>
        </div>
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────
// POSTULACIONES
// ────────────────────────────────────────────────────────────

/**
 * Muestra las postulaciones de una campaña específica en el tab de postulaciones.
 *
 * @param {string} idCampana
 * @param {string} nombreLibro
 */
async function verPostulacionesCampana(idCampana, nombreLibro) {
  cambiarTab(
    document.querySelector('.tab:nth-child(2)'),
    'tab-postulaciones'
  );

  const contenedor = document.getElementById('autor-postulaciones-lista');
  if (!contenedor) return;

  contenedor.innerHTML = `<p class="seccion-subtitulo">Postulaciones para <strong>${nombreLibro}</strong></p><div class="cargando-container"><div class="spinner"></div></div>`;

  const resultado = await llamarBackend('listarPostulacionesCampana', {
    email: Sesion.email(),
    idCampana
  });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  _postulacionesAutor = resultado.datos.postulaciones || [];

  if (_postulacionesAutor.length === 0) {
    contenedor.innerHTML = `
      <p class="seccion-subtitulo">Postulaciones para <strong>${nombreLibro}</strong></p>
      <div class="estado-vacio">
        <p class="estado-vacio-texto">No hay postulaciones todavía.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <p class="seccion-subtitulo">Postulaciones para <strong>${nombreLibro}</strong></p>
    ${_postulacionesAutor.map(p => construirCardPostulacion(p)).join('')}
  `;
}

/**
 * Construye la card de una postulación para el panel del autor.
 *
 * @param {Object} p — datos de la postulación
 * @returns {string} HTML de la card
 */
function construirCardPostulacion(p) {
  const r = p.reseñador;

  const botonesAccion = p.estado === 'pendiente' ? `
    <div class="postulacion-acciones">
      <button class="btn-primario btn-sm" onclick="accionPostulacion('${p.idPostulacion}', 'aprobar')">Aprobar</button>
      <button class="btn-secundario btn-sm btn-peligro" onclick="accionPostulacion('${p.idPostulacion}', 'rechazar')">Rechazar</button>
    </div>
  ` : '';

  const rankingHtml = r?.ranking?.posicion ? `
    <p class="postulacion-ranking">
      🏅 <strong>#${r.ranking.posicion}</strong> en el ranking
      · ${r.ranking.completion?.toFixed(0) ?? '—'}% completion
      · Puntaje: ${r.ranking.puntaje?.toFixed(1) ?? '—'}
    </p>
  ` : '';

  const badgesHtml = badgesRanking(r?.badges);

  const iniciales = r?.alias
    ? r.alias.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

const avatarHtml = r?.fotoPerfil
  ? `<img src="${r.fotoPerfil}" class="postulacion-avatar-img" onerror="this.style.display='none'" />`
  : `<div class="postulacion-avatar">${iniciales}</div>`;

  const redesHtml = [
    r?.instagram ? `<a href="${r.instagram}" target="_blank" class="postulacion-red-link" title="Instagram">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
    </a>` : '',
    r?.tiktok ? `<a href="${r.tiktok}" target="_blank" class="postulacion-red-link" title="TikTok">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 106.34 6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/></svg>
    </a>` : '',
    r?.amazon ? `<a href="${r.amazon}" target="_blank" class="postulacion-red-link" title="Amazon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.935 14.825C18.537 16.611 15.07 17.563 12.074 17.563c-4.131 0-7.85-1.528-10.661-4.073-.221-.2-.023-.472.242-.317 3.036 1.768 6.789 2.83 10.668 2.83 2.615 0 5.492-.543 8.14-1.667.4-.17.733.263.472.489z"/><path d="M21.877 13.733c-.301-.387-1.99-.183-2.75-.092-.231.028-.266-.173-.058-.319 1.347-.947 3.558-.674 3.815-.357.258.319-.067 2.534-1.332 3.594-.194.162-.379.076-.293-.139.285-.71.922-2.3.618-2.687z"/></svg>
    </a>` : ''
  ].filter(Boolean).join('');
  
  return `
    <div class="postulacion-card">
      <div class="postulacion-card-top">
        ${avatarHtml}
        <div class="postulacion-info">
          <div class="postulacion-info-header">
            <p class="postulacion-alias">${r?.alias || p.email}</p>
            ${badgeEstado(p.estado)}
          </div>
          <p class="postulacion-meta">${r?.pais || ''}${r?.ciudad ? `, ${r.ciudad}` : ''} · Nivel: ${r?.labelNivel || '—'}</p>
          ${p.reseñador?.coincidenciaTropes != null ? `
            <p class="postulacion-tropes-match">🎯 <strong>${p.reseñador.coincidenciaTropes}%</strong> coincidencia de tropes</p>
          ` : ''}
        </div>
      </div>
      ${badgesHtml ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0;">${badgesHtml}</div>` : ''}
      ${rankingHtml}
      ${p.descripcionLector ? `<p class="postulacion-descripcion">${truncarTexto(p.descripcionLector, 150)}</p>` : ''}
     ${redesHtml ? `<div class="postulacion-redes">${redesHtml}</div>` : ''}
      ${botonesAccion}
    </div>
  `;
}
/**
 * Aprueba o rechaza una postulación.
 *
 * @param {string} idPostulacion
 * @param {string} accion — 'aprobar' o 'rechazar'
 */
async function accionPostulacion(idPostulacion, accion) {
  const actionBackend = accion === 'aprobar' ? 'aprobarPostulacion' : 'rechazarPostulacion';

  const resultado = await llamarBackend(actionBackend, {
    email: Sesion.email(),
    idPostulacion
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al procesar la postulación.', 'error');
    return;
  }

  mostrarToast(accion === 'aprobar' ? 'Postulación aprobada.' : 'Postulación rechazada.', 'ok');

  // Recarga las postulaciones
  const postulacion = _postulacionesAutor.find(p => p.id === idPostulacion);
  if (postulacion) {
    await verPostulacionesCampana(postulacion.idCampana, postulacion.nombreLibro || '');
  }
}


// ────────────────────────────────────────────────────────────
// RESEÑAS DE UNA CAMPAÑA
// ────────────────────────────────────────────────────────────

/**
 * Muestra las reseñas entregadas de una campaña en un modal.
 *
 * @param {string} idCampana
 * @param {string} nombreLibro
 */
async function verReseñasCampana(idCampana, nombreLibro) {
  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = `Reseñas — ${nombreLibro}`;
  if (body)   body.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
  if (footer) footer.innerHTML = '';

  const resultado = await llamarBackend('listarReseñasCampaña', {
    email: Sesion.email(),
    idCampana
  });

  if (!resultado.ok) {
    if (body) body.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const reseñas = resultado.datos.reseñas || [];

  if (reseñas.length === 0) {
    if (body) body.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">Todavía no hay reseñas entregadas.</p>
      </div>
    `;
    return;
  }

  if (body) {
   body.innerHTML = reseñas.map(r => `
  <div class="resena-card" style="border-bottom:1px solid var(--crema-oscura); padding:16px 0;">
    <p style="font-weight:600;">${r.reseñador?.alias || 'Reseñador'}</p>
    <p style="font-size:12px; color:var(--gris-suave);">Entregada: ${formatearFechaAmigable(r.fechaEntrega)}</p>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin:8px 0;">
      ${r.linkInstagram ? `<a href="${r.linkInstagram}" target="_blank" class="red-link">Instagram</a>` : ''}
      ${r.linkTikTok    ? `<a href="${r.linkTikTok}"    target="_blank" class="red-link">TikTok</a>`    : ''}
      ${r.linkAmazon    ? `<a href="${r.linkAmazon}"    target="_blank" class="red-link">Amazon</a>`    : ''}
      ${r.linkGoodreads ? `<a href="${r.linkGoodreads}" target="_blank" class="red-link">Goodreads</a>` : ''}
    </div>
    ${r.comentarios ? `<p style="font-size:13px; color:var(--gris-suave);">"${r.comentarios}"</p>` : ''}
   ${r.puntuacion
  ? `<p style="font-size:13px;">Tu calificación: ${'★'.repeat(r.puntuacion)}${'☆'.repeat(5 - r.puntuacion)}</p>`
  : `<div style="margin-top:8px;">
      <p style="font-size:13px; margin-bottom:6px;">Calificá esta reseña:</p>
      <div style="display:flex; gap:6px;">
     ${[1,2,3,4,5].map(n => `
  <button 
    onclick="calificarDirecto('${r.idReseña}', ${n}, this)" 
    style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--gris-borde);">★</button>
`).join('')}
      </div>
    </div>`
}
  </div>
`).join('');
  }
}

async function calificarDirecto(idResena, puntuacion, boton) {
  const resultado = await llamarBackend('calificarReseña', {
    email: Sesion.email(),
    idResena,
    puntuacion
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al calificar.', 'error');
    return;
  }

  // Reemplaza las estrellas por la calificación guardada
  const contenedor = boton.parentElement;
  contenedor.parentElement.innerHTML = `
    <p style="font-size:13px;">Tu calificación: ${'★'.repeat(puntuacion)}${'☆'.repeat(5 - puntuacion)}</p>
  `;

  mostrarToast('¡Reseña calificada!', 'ok');
}
async function enviarCalificacion() {
  const idResena    = document.getElementById('calificar-id-resena')?.value;
  const puntuacion  = document.getElementById('calificar-puntuacion')?.value;

  if (!puntuacion) {
    mostrarMensajeError('calificar-error', 'Seleccioná una puntuación antes de confirmar.');
    return;
  }

  const resultado = await llamarBackend('calificarReseña', {
    email: Sesion.email(),
    idResena,
    puntuacion: parseInt(puntuacion)
  });

  if (!resultado.ok) {
    mostrarMensajeError('calificar-error', resultado.mensaje);
    return;
  }

  mostrarMensajeOk('calificar-ok', '¡Reseña calificada!');
  setTimeout(() => cerrarModales(), 1500);
}


// ────────────────────────────────────────────────────────────
// HISTORIAL
// ────────────────────────────────────────────────────────────

/**
 * Carga el historial de campañas finalizadas y canceladas del autor.
 *
 * @param {string} email
 */
async function cargarHistorialAutor(email) {
  const contenedor = document.getElementById('autor-historial-lista');
  if (!contenedor) return;

  const resultado = await llamarBackend('historialCampanasAutor', { email });

  if (!resultado.ok) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  _historialAutor = resultado.datos.campañas || [];

  if (_historialAutor.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">No tenés campañas en el historial todavía.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = _historialAutor.map(c => `
    <div class="campana-card-panel campana-card-historial">
      <div class="campana-card-panel-header">
        <div>
          <h3 class="campana-titulo">${c.nombreLibro}</h3>
          <p class="campana-autor">por ${c.nombreAutor}</p>
        </div>
        ${badgeEstado(c.estado)}
      </div>
      <div class="campana-card-panel-stats">
        <span>${c.reseñasEntregadas ?? '—'} reseñas entregadas</span>
        <span>Finalizó ${formatearFechaAmigable(c.fechaLimite)}</span>
      </div>
    </div>
  `).join('');
}


// ────────────────────────────────────────────────────────────
// CANCELAR CAMPAÑA
// ────────────────────────────────────────────────────────────

/**
 * Pide confirmación antes de cancelar una campaña.
 *
 * @param {string} idCampana
 * @param {string} nombreLibro
 */
function confirmarCancelarCampana(idCampana, nombreLibro) {
  if (!confirm(`¿Cancelar la campaña "${nombreLibro}"? Esta acción no se puede deshacer.`)) return;
  cancelarCampanaAutor(idCampana);
}

/**
 * Cancela una campaña del autor.
 *
 * @param {string} idCampana
 */
async function cancelarCampanaAutor(idCampana) {
  const resultado = await llamarBackend('cancelarCampana', {
    email: Sesion.email(),
    idCampana
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al cancelar la campaña.', 'error');
    return;
  }

  mostrarToast('Campaña cancelada.', 'ok');
  await cargarCampañasAutor(Sesion.email());
  await cargarEstadisticasAutor(Sesion.email());
}


// ────────────────────────────────────────────────────────────
// CREAR CAMPAÑA
// ────────────────────────────────────────────────────────────

/**
 * Envía el formulario de nueva campaña al backend.
 * Se llama desde el submit del form en el modal.
 *
 * @param {Event} event
 */
async function crearNuevaCampana(event) {
  event.preventDefault();

  ocultarMensajes('nc-error', 'nc-ok');
  toggleBoton('btn-crear-campana', false, 'Creando...');

  // Validar plataformas
  const plataformasSeleccionadas = Array.from(
    document.querySelectorAll('input[name="plataformas"]:checked')
  ).map(cb => cb.value);

  if (plataformasSeleccionadas.length < 1 || plataformasSeleccionadas.length > 2) {
    const errPlat = document.getElementById('plataformas-error');
    if (errPlat) { errPlat.textContent = 'Elegí entre 1 y 2 plataformas.'; errPlat.style.display = 'block'; }
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    return;
  } else {
    const errPlat = document.getElementById('plataformas-error');
    if (errPlat) errPlat.style.display = 'none';
  }
// Validar que los links de Drive sean públicos
  const linkPortadaTmp = convertirLinkDrive(document.getElementById('nc-link-portada')?.value?.trim());
  const linkEpubTmp    = document.getElementById('nc-link-epub')?.value?.trim();
  const linkPdfTmp     = document.getElementById('nc-link-pdf')?.value?.trim();

  toggleBoton('btn-crear-campana', false, 'Verificando links...');

  const validacionLinks = await llamarBackend('validarLinksCampana', {
    linkPortada: linkPortadaTmp,
    linkEpub: linkEpubTmp,
    linkPdf: linkPdfTmp
  });

  if (!validacionLinks.ok) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    const nombres = validacionLinks.linksInvalidos.join(', ');
    mostrarMensajeError('nc-error', `El link de ${nombres} no es público. Verificá que esté compartido como "Cualquier usuario con el enlace" en Google Drive.`);
    return;
  }
  
  const datos = {
    nombreLibro:      document.getElementById('nc-nombre-libro')?.value?.trim(),
    nombreAutor:      document.getElementById('nc-nombre-autor')?.value?.trim(),
    sinopsis:         document.getElementById('nc-sinopsis')?.value?.trim(),
    genero:           document.getElementById('nc-genero')?.value?.trim(),
    tropes:           obtenerTropesComoTexto('nc'),
    linkPortada:      convertirLinkDrive(document.getElementById('nc-link-portada')?.value?.trim()),
    linkEpub:         document.getElementById('nc-link-epub')?.value?.trim(),
    linkPdf:          document.getElementById('nc-link-pdf')?.value?.trim(),
    linkAmazon:       document.getElementById('nc-link-amazon')?.value?.trim(),
    cuposTotal:       parseInt(document.getElementById('nc-cupos')?.value),
    fechaLimite:      document.getElementById('nc-fecha-limite')?.value?.trim(),
    modalidadLectura: document.querySelector('input[name="nc-modalidad-lectura"]:checked')?.value || 'visor',
    plataformasResena: plataformasSeleccionadas
  };

  const resultado = await llamarBackend('crearCampana', {
    email:             Sesion.email(),
    nombreLibro:       datos.nombreLibro,
    nombreAutor:       datos.nombreAutor,
    sinopsis:          datos.sinopsis,
    genero:            datos.genero,
    tropes:            datos.tropes,
    linkPortada:       datos.linkPortada,
    linkEpub:          datos.linkEpub,
    linkPdf:           datos.linkPdf,
    linkAmazon:        datos.linkAmazon,
    cuposTotal:        datos.cuposTotal,
    fechaLimite:       datos.fechaLimite,
    modalidadLectura:  datos.modalidadLectura,
    plataformasResena: datos.plataformasResena
  });

  toggleBoton('btn-crear-campana', true, '', 'Crear campaña');

  if (!resultado.ok) {
    mostrarMensajeError('nc-error', resultado.mensaje);
    return;
  }

  mostrarMensajeOk('nc-ok', '¡Campaña creada exitosamente!');
  document.getElementById('form-nueva-campana')?.reset();

  setTimeout(async () => {
    cerrarModales();
    await cargarCampañasAutor(Sesion.email());
    await cargarEstadisticasAutor(Sesion.email());
  }, 1500);
}


// ────────────────────────────────────────────────────────────
// PLAN
// ────────────────────────────────────────────────────────────

async function cargarPlanAutor(email) {
  const contenedor = document.getElementById('autor-plan-info');
  if (!contenedor) return;
  const resultado = await llamarBackend('obtenerPerfil', { email });
  if (!resultado.ok) return;
  const u = resultado.datos.perfil;
  const plan = u.plan || 'free';
  const fechaVenc = u.fechaVencimientoPlan || '';

  const planes = [
    {
      id: 'free',
      nombre: 'Free',
      precio: '$0',
      subprecio: 'Para empezar',
      beneficios: ['1 campaña por mes', 'Hasta 10 reseñadores'],
      esPremium: false
    },
    {
      id: 'basic',
      nombre: 'Basic',
      precio: '$20.000',
      subprecio: '$190.000/año',
      beneficios: ['3 campañas por mes', 'Hasta 50 reseñadores'],
      esPremium: false
    },
    {
      id: 'premium',
      nombre: 'Premium',
      precio: '$40.000',
      subprecio: '$380.000/año',
      beneficios: ['5 campañas por mes', 'Hasta 100 reseñadores'],
      esPremium: true
    }
  ];

  contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:24px; font-weight:700; color:var(--bordo); font-style:italic; text-align:center; margin-bottom:24px;">Elegí tu plan</h3>
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${planes.map(p => {
        const esActual = p.id === plan;
        const esMenor = (p.id === 'free' && (plan === 'basic' || plan === 'premium')) || (p.id === 'basic' && plan === 'premium');
        return `
          <div style="
            background: ${p.esPremium ? 'var(--bordo)' : 'var(--blanco)'};
            border: ${esActual ? '2px solid var(--bordo)' : '1px solid var(--gris-borde)'};
            border-radius: var(--radio-grande);
            padding: 20px 22px;
            display: grid;
            grid-template-columns: 1fr auto auto;
            align-items: center;
            gap: 16px;
            box-shadow: var(--sombra-card);
          ">
            <div>
              <span style="
                display: inline-block;
                background: ${p.esPremium ? 'rgba(255,255,255,0.2)' : 'var(--rosa-claro)'};
                color: ${p.esPremium ? 'var(--blanco)' : 'var(--bordo)'};
                font-size: 11px; font-weight: 700; padding: 3px 12px;
                border-radius: var(--radio-pill); margin-bottom: 8px;
              ">${p.nombre}${esActual ? ' ✓' : ''}</span>
              <p style="font-family:var(--fuente-titulo); font-size:28px; font-weight:700; color:${p.esPremium ? 'var(--blanco)' : 'var(--gris-texto)'}; line-height:1.1; margin-bottom:2px;">${p.precio}<span style="font-size:14px; font-weight:400;">/mes</span></p>
              <p style="font-size:12px; color:${p.esPremium ? 'rgba(255,255,255,0.7)' : 'var(--gris-suave)'}; margin-bottom:0;">${p.subprecio}</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${p.beneficios.map(b => `
                <p style="font-size:13px; color:${p.esPremium ? 'var(--blanco)' : 'var(--gris-texto)'}; display:flex; align-items:center; gap:6px; margin:0;">
                  <span style="color:${p.esPremium ? 'rgba(255,255,255,0.8)' : 'var(--bordo)'};">✓</span> ${b}
                </p>
              `).join('')}
            </div>
            <div>
              ${esActual
                ? `<button class="btn-sm" disabled style="background:${p.esPremium ? 'rgba(255,255,255,0.2)' : 'var(--rosa-claro)'}; color:${p.esPremium ? 'var(--blanco)' : 'var(--bordo)'}; border:none; padding:8px 16px; border-radius:var(--radio-pill); font-weight:700; font-size:13px; cursor:default;">Plan actual</button>`
                : esMenor
                ? ''
                : `<button class="btn-sm" onclick="iniciarPago('${p.id}')" style="background:${p.esPremium ? 'var(--blanco)' : 'var(--bordo)'}; color:${p.esPremium ? 'var(--bordo)' : 'var(--blanco)'}; border:none; padding:8px 16px; border-radius:var(--radio-pill); font-weight:700; font-size:13px; cursor:pointer;">Elegir ${p.nombre}</button>`
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${fechaVenc ? `<p style="text-align:center; font-size:12px; color:var(--gris-suave); margin-top:16px;">Plan activo hasta ${formatearFechaAmigable(fechaVenc)}</p>` : ''}
  `;
}
async function iniciarPago(plan) {
  const moneda = confirm('¿Pagás desde Argentina?\n\nAceptar = Mercado Pago (ARS)\nCancelar = Stripe (USD)')
    ? 'ARS'
    : 'USD';

  const resultado = await llamarBackend('solicitarPlan', {
    email: Sesion.email(),
    planSolicitado: plan,
    moneda,
    metodoPago: moneda === 'ARS' ? 'mercadopago' : 'stripe'
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al iniciar el pago.', 'error');
    return;
  }

  // Guarda el idPago para cuando vuelva de la pasarela
  sessionStorage.setItem('idPagoPendiente', resultado.datos.idPago);
  sessionStorage.setItem('planPendiente', plan);

  // Redirige a la pasarela externa
  window.open(resultado.datos.urlPago, '_blank');

  // Muestra el formulario para subir comprobante
  setTimeout(() => mostrarFormComprobante(resultado.datos.idPago), 1000);
}

/**
 * Muestra el modal para subir el comprobante de pago.
 *
 * @param {string} idPago
 */
function mostrarFormComprobante(idPago) {
  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = 'Subir comprobante de pago';
  if (footer) footer.innerHTML = '';

  if (body) {
    body.innerHTML = `
      <p class="form-info">Completá el pago en la ventana que se abrió y luego subí el comprobante acá.</p>
      <p class="form-info" style="color:var(--gris-suave); font-size:13px;">La activación del plan puede demorar hasta 24 horas hábiles.</p>

      <div class="form-grupo" style="margin-top:20px;">
        <label class="form-label">Link del comprobante *</label>
        <input type="url" id="comprobante-url" class="form-input" placeholder="https://drive.google.com/... o link de captura" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Monto pagado</label>
        <input type="text" id="comprobante-monto" class="form-input" placeholder="Ej: 5000" />
      </div>

      <div id="comprobante-error" class="mensaje-error" style="display:none;"></div>
      <div id="comprobante-ok" class="mensaje-ok" style="display:none;"></div>

      <div style="margin-top:20px; display:flex; gap:10px;">
        <button class="btn-secundario" onclick="cerrarModales()">Cancelar</button>
        <button class="btn-primario" onclick="subirComprobanteAutor('${idPago}')">Enviar comprobante</button>
      </div>
    `;
  }
}

/**
 * Sube el comprobante de pago al backend.
 *
 * @param {string} idPago
 */
async function subirComprobanteAutor(idPago) {
  const comprobanteUrl = document.getElementById('comprobante-url')?.value?.trim();
  const monto          = document.getElementById('comprobante-monto')?.value?.trim();

  if (!comprobanteUrl) {
    mostrarMensajeError('comprobante-error', 'El link del comprobante es obligatorio.');
    return;
  }

  const resultado = await llamarBackend('subirComprobante', {
    email: Sesion.email(),
    idPago,
    comprobanteUrl,
    monto
  });

  if (!resultado.ok) {
    mostrarMensajeError('comprobante-error', resultado.mensaje);
    return;
  }

  mostrarMensajeOk('comprobante-ok', '¡Comprobante enviado! El admin verificará tu pago pronto.');
  sessionStorage.removeItem('idPagoPendiente');
  sessionStorage.removeItem('planPendiente');

  setTimeout(() => cerrarModales(), 2000);
}


// ────────────────────────────────────────────────────────────
// BIBLIOTECA (desde panel)
// ────────────────────────────────────────────────────────────

/**
 * Carga la biblioteca del autor en el tab de plan.
 * Se muestra solo en la sección de perfil.
 *
 * @param {string} email
 */
async function cargarBibliotecaPanel(email) {
  const contenedor = document.getElementById('biblioteca-lista');
  if (!contenedor) return;

  const resultado = await llamarBackend('listarLibrosAutor', { email });
  if (!resultado.ok) return;

  _librosAutor = resultado.datos.libros || [];
  renderizarBiblioteca(_librosAutor);
}

/**
 * Renderiza la lista de libros de la biblioteca.
 *
 * @param {Array} libros
 */
function renderizarBiblioteca(libros) {
  const contenedor = document.getElementById('biblioteca-lista');
  if (!contenedor) return;

  if (libros.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">No tenés libros en tu biblioteca.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = libros.map(l => `
    <div class="libro-card">
      ${l.linkPortada ? `<img src="${l.linkPortada}" alt="${l.titulo}" class="libro-thumb" onerror="this.style.display='none'" />` : ''}
      <div class="libro-info">
        <p class="libro-titulo"><strong>${l.titulo}</strong></p>
        ${l.genero ? `<p class="libro-meta">${l.genero}</p>` : ''}
        ${l.sinopsisBreve ? `<p class="libro-sinopsis">${truncarTexto(l.sinopsisBreve, 100)}</p>` : ''}
      </div>
      <div class="libro-acciones">
        <button class="btn-secundario btn-sm" onclick="abrirEditarLibro('${l.id}')">Editar</button>
 <button class="btn-secundario btn-sm" onclick="eliminarLibroAutor('${l.id}', '${l.titulo}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

/**
 * Agrega un libro a la biblioteca del autor.
 * Se llama desde el submit del modal.
 *
 * @param {Event} event
 */
async function agregarLibro(event) {
  event.preventDefault();

  ocultarMensajes('libro-error');

  const datos = {
    titulo:         document.getElementById('libro-titulo')?.value?.trim(),
    sinopsisBreve:  document.getElementById('libro-sinopsis')?.value?.trim(),
    genero:         document.getElementById('libro-genero')?.value?.trim(),
    tropes: obtenerTropesComoTexto('libro'),
   linkPortada: convertirLinkDrive(document.getElementById('libro-portada')?.value?.trim()),
    linkAmazon:     document.getElementById('libro-amazon')?.value?.trim()
  };

  if (!datos.titulo) {
    mostrarMensajeError('libro-error', 'El título es obligatorio.');
    return;
  }

 const resultado = await llamarBackend('agregarLibro', {
    email:         Sesion.email(),
    titulo:        datos.titulo,
    sinopsisBreve: datos.sinopsisBreve,
    genero:        datos.genero,
    tropes:        datos.tropes,
    linkPortada:   datos.linkPortada,
    linkAmazon:    datos.linkAmazon
});

  if (!resultado.ok) {
    mostrarMensajeError('libro-error', resultado.mensaje);
    return;
  }

  document.getElementById('form-nuevo-libro')?.reset();
  cerrarModales();
  mostrarToast('Libro agregado a tu biblioteca.', 'ok');
  await cargarBibliotecaPanel(Sesion.email());
}

/**
 * Elimina un libro de la biblioteca del autor.
 *
 * @param {string} idLibro
 * @param {string} titulo
 */
async function eliminarLibroAutor(idLibro, titulo) {
  if (!confirm(`¿Eliminar "${titulo}" de tu biblioteca?`)) return;

  const resultado = await llamarBackend('eliminarLibro', {
    email: Sesion.email(),
    idLibro
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al eliminar el libro.', 'error');
    return;
  }

  mostrarToast('Libro eliminado.', 'ok');
  await cargarBibliotecaPanel(Sesion.email());
}
// ────────────────────────────────────────────────────────────
// SELECTOR DE LIBRO EN NUEVA CAMPAÑA
// ────────────────────────────────────────────────────────────

async function inicializarModalNuevaCampana() {
  renderizarSelectorTropes('nc-tropes-contenedor', 'nc');

  const selector = document.getElementById('nc-libro-selector');
  if (!selector) return;

  const resultado = await llamarBackend('listarLibrosAutor', { email: Sesion.email() });
  if (!resultado.ok) return;

  const libros = resultado.datos.libros || [];
  libros.forEach(l => {
    const option = document.createElement('option');
    option.value = l.id;
    option.textContent = l.titulo;
    selector.appendChild(option);
  });
}

function precargarLibroEnCampana() {
  const selector = document.getElementById('nc-libro-selector');
  const idLibro  = selector?.value;

  if (!idLibro) {
    document.getElementById('nc-nombre-libro').value = '';
    document.getElementById('nc-nombre-autor').value = '';
    document.getElementById('nc-sinopsis').value     = '';
    document.getElementById('nc-genero').value       = '';
    document.getElementById('nc-link-portada').value = '';
    document.getElementById('nc-link-amazon').value  = '';
    renderizarSelectorTropes('nc-tropes-contenedor', 'nc');
    return;
  }

  const libro = _librosAutor.find(l => l.id === idLibro);
  if (!libro) return;

  document.getElementById('nc-nombre-libro').value = libro.titulo      || '';
  document.getElementById('nc-nombre-autor').value = Sesion.obtener()?.alias || '';
  document.getElementById('nc-sinopsis').value     = libro.sinopsis    || '';
  document.getElementById('nc-genero').value       = libro.genero      || '';
  document.getElementById('nc-link-portada').value = libro.linkPortada || '';
  document.getElementById('nc-link-amazon').value  = libro.linkAmazon  || '';

  const tropesArray = tropesTextoAArray(libro.tropes || '');
  renderizarSelectorTropes('nc-tropes-contenedor', 'nc', tropesArray);
}
function construirCardRankingSlider(l) {
  const portada = l.linkPortada
    ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" onerror="this.style.display='none'" />`
    : `<div style="width:100px;height:140px;background:var(--crema);border-radius:var(--radio);display:flex;align-items:center;justify-content:center;font-size:28px;">📖</div>`;
  return `
    <div class="ranking-slider-card">
      ${portada}
      <p class="ranking-slider-card-titulo">${l.nombreLibro}</p>
      <p class="ranking-slider-card-autor">${l.nombreAutor}</p>
    </div>
  `;
}

function construirItemRankingTop(l, posicion) {
  const portada = l.linkPortada
    ? `<img src="${l.linkPortada}" alt="${l.nombreLibro}" onerror="this.style.display='none'" />`
    : `<div style="width:52px;height:72px;background:var(--crema);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:20px;">📖</div>`;
  return `
    <div class="ranking-top-item">
      <span class="ranking-top-item-pos">${posicion}</span>
      ${portada}
      <div class="ranking-top-item-info">
        <p class="ranking-top-item-titulo">${l.nombreLibro}</p>
        <p class="ranking-top-item-autor">${l.nombreAutor}</p>
      </div>
      <span class="ranking-top-item-puntaje">⭐ ${l.promedioPuntuacion?.toFixed(1) ?? '—'}</span>
    </div>
  `;
}
/**
 * Comparte una campaña por redes sociales o copia el link.
 * En celular abre el menú nativo de compartir del sistema.
 * En computadora copia el texto + link al portapapeles.
 *
 * @param {string} idCampana
 * @param {string} nombreLibro
 */
async function compartirCampana(idCampana, nombreLibro) {
  const url = `${CONFIG.FRONTEND_URL}/?campana=${idCampana}`;
  const texto = `¡Postulate para reseñar "${nombreLibro}"! 📖✨`;

  // Si el dispositivo soporta compartir nativo (celular)
  if (navigator.share) {
    try {
      await navigator.share({
        title: nombreLibro,
        text: texto,
        url: url
      });
    } catch (e) {
      // El usuario cerró el menú de compartir sin elegir nada, no es un error real
    }
    return;
  }

  // En computadora: copia al portapapeles
  try {
    await navigator.clipboard.writeText(`${texto} ${url}`);
    mostrarToast('¡Link copiado! Pegalo donde quieras.', 'ok');
  } catch (e) {
    mostrarToast('No se pudo copiar el link. Copialo manualmente: ' + url, 'error');
  }
}
