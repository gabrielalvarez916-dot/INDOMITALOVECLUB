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
let _portadaPrecargadaCampana = null; // URL de portada existente cuando se precarga un libro de la biblioteca

function convertirLinkDrive(url) {
  if (!url) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
  return url;
}

/**
 * Devuelve el mes actual en formato 'YYYY-MM', igual al que se
 * usa en las tablas de ranking (mes_año).
 *
 * @returns {string}
 */
function _mesActual() {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${año}-${mes}`;
}

/**
 * Calcula el porcentaje de coincidencia entre los tropes de una
 * campaña y los tropes favoritos de un reseñador.
 *
 * @param {string} tropesCampana  — texto de tropes de la campaña (c.tropes)
 * @param {string} tropesUsuario  — texto de tropes favoritos del usuario (u.tropes_favoritos)
 * @returns {number|null} porcentaje 0-100, o null si falta algún dato
 */
function _coincidenciaTropes(tropesCampana, tropesUsuario) {
  if (!tropesCampana || !tropesUsuario) return null;

  const arrCampana  = tropesTextoAArray(tropesCampana);
  const arrUsuario  = tropesTextoAArray(tropesUsuario);

  if (arrCampana.length === 0 || arrUsuario.length === 0) return null;

  const setUsuario = new Set(arrUsuario.map(t => t.toLowerCase().trim()));
  const coincidencias = arrCampana.filter(t => setUsuario.has(t.toLowerCase().trim())).length;

  return Math.round((coincidencias / arrCampana.length) * 100);
}

function _labelLiga(codigo) {
  switch (codigo) {
    case 'diamante': return 'Liga Diamante';
    case 'oro':      return 'Liga Oro';
    case 'plata':    return 'Liga Plata';
    default:         return 'Liga Bronce';
  }
}

/**
 * Convierte una fila de la tabla `campanas` (snake_case, tal cual la
 * devuelve Supabase) al objeto camelCase que usa el panel del autor.
 *
 * @param {Object} c — fila cruda de Supabase
 * @returns {Object}
 */
function _mapCampana(c) {
  return {
    id:                c.id,
    idUsuarioAutor:    c.id_usuario_autor,
    idLibro:           c.id_libro,
    nombreLibro:       c.nombre_libro,
    nombreAutor:       c.nombre_autor,
    sinopsis:          c.sinopsis,
    tropes:            c.tropes,
    genero:            c.genero,
    linkPortada:       c.link_portada,
    linkAmazon:        c.link_amazon_libro,
    cuposTotal:        c.cupos_total,
    cuposDisponibles:  c.cupos_disponibles,
    fechaInicio:       c.fecha_inicio,
    fechaLimite:       c.fecha_limite,
    estado:            c.estado,
    mesAño:            c.mes_año,
    modalidadLectura:  c.modalidad_lectura,
    plataformasResena: c.plataformas_resena,
    creadoEn:          c.creado_en
  };
}

// ────────────────────────────────────────────────────────────
// CARGAR PANEL AUTOR
// ────────────────────────────────────────────────────────────

/**
 * Carga todos los datos del panel del autor.
 * Se llama automáticamente cuando se muestra la sección panel-autor.
 */
async function cargarPanelAutor() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  await Promise.all([
    cargarEstadisticasAutor(user.id),
    cargarCampañasAutor(user.id),
    cargarHistorialAutor(user.id),
    cargarPlanAutor(user.id),
    cargarBibliotecaPanel(user.id)
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
async function cargarEstadisticasAutor(idUsuario) {
  const contenedor = document.getElementById('autor-stats');
  if (!contenedor) return;

  const { data: campañas } = await supabaseClient
    .from('campanas')
    .select('id, estado')
    .eq('id_usuario_autor', idUsuario);

  const idsCampanas = (campañas || []).map(c => c.id);
  const campañasActivas = (campañas || []).filter(c => c.estado === 'activa').length;

  let reseñasRecibidas = 0, promedioCalificaciones = null, reseñadoresAprobados = 0;

  if (idsCampanas.length > 0) {
    const { count } = await supabaseClient
      .from('postulaciones')
      .select('id', { count: 'exact', head: true })
      .in('id_campana', idsCampanas)
      .eq('estado', 'aprobada');
    reseñadoresAprobados = count ?? 0;

    const { data: resenas } = await supabaseClient
      .from('resenas')
      .select('puntuacion_libro')
      .in('id_campana', idsCampanas);

    reseñasRecibidas = resenas?.length || 0;
    const puntuaciones = (resenas || []).map(r => r.puntuacion_libro).filter(p => p != null);
    promedioCalificaciones = puntuaciones.length > 0
      ? puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length
      : null;
  }

  const s = { campañasActivas, reseñasRecibidas, reseñadoresAprobados, promedioCalificaciones };

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
async function cargarCampañasAutor(idUsuario) {
  const contenedor = document.getElementById('autor-campanas-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient
    .from('campanas')
    .select('*')
    .eq('id_usuario_autor', idUsuario)
    .eq('estado', 'activa')
    .order('creado_en', { ascending: false });

  if (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  _campañasAutor = (data || []).map(_mapCampana);

  if (_campañasAutor.length > 0) {
    const ids = _campañasAutor.map(c => c.id);

    const { data: postulacionesPend } = await supabaseClient
      .from('postulaciones')
      .select('id_campana')
      .in('id_campana', ids)
      .eq('estado', 'pendiente');

    const { data: resenasEnt } = await supabaseClient
      .from('resenas')
      .select('id_campana')
      .in('id_campana', ids);

    _campañasAutor.forEach(c => {
      c.postulacionesPendientes = (postulacionesPend || []).filter(p => p.id_campana === c.id).length;
      c.reseñasEntregadas = (resenasEnt || []).filter(r => r.id_campana === c.id).length;
    });
  }

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

  const campanaActual = _campañasAutor.find(c => c.id === idCampana);

  const { data, error } = await supabaseClient
    .from('postulaciones')
    .select(`
     id, estado, motivo_abandono,
      usuarios!postulaciones_id_usuario_resenador_fkey (
        id, alias, pais, ciudad, instagram, tiktok, amazon, tropes_favoritos, descripcion_lector,
        avatares ( imagen_url )
      )
    `)
    .eq('id_campana', idCampana)
    .order('fecha_postulacion', { ascending: false });

  if (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  const idsResenadores = (data || []).map(p => p.usuarios?.id).filter(Boolean);
  const mesActual = _mesActual();

  const [{ data: rankings }, { data: insignias }] = await Promise.all([
    supabaseClient.from('ranking').select('id_usuario_resenador, posicion, porcentaje_completion, puntos_mensuales, categoria').in('id_usuario_resenador', idsResenadores).eq('mes_año', mesActual),
    supabaseClient.from('insignias').select('id_usuario, tipo, codigo').in('id_usuario', idsResenadores)
  ]);

  _postulacionesAutor = (data || []).map(p => {
    const u = p.usuarios;
    const rankingUsuario = (rankings || []).find(r => r.id_usuario_resenador === u?.id);
    return {
      idPostulacion: p.id,
      idCampana,
      estado: p.estado,
      motivoAbandonoPrivado: p.motivo_abandono,
      descripcionLector: u?.descripcion_lector,
      reseñador: u ? {
        id: u.id,
        alias: u.alias,
        pais: u.pais,
        ciudad: u.ciudad,
        instagram: u.instagram,
        tiktok: u.tiktok,
        amazon: u.amazon,
        fotoPerfil: u.avatares?.imagen_url || null,
        labelNivel: rankingUsuario ? _labelLiga(rankingUsuario.categoria) : null,
        coincidenciaTropes: _coincidenciaTropes(campanaActual?.tropes, u.tropes_favoritos),
        ranking: rankingUsuario ? {
          posicion: rankingUsuario.posicion,
          completion: rankingUsuario.porcentaje_completion,
          puntaje: rankingUsuario.puntos_mensuales
        } : null,
        badges: (insignias || []).filter(i => i.id_usuario === u.id)
      } : null
    };
  });

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
  ` : p.estado === 'abandonada' ? `
    <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:12px 16px; margin-top:12px; border-radius:0 4px 4px 0;">
      <p style="font-weight:600; color:#856404; margin:0 0 8px;">Campaña abandonada</p>
      ${p.motivoAbandonoPrivado ? `<p style="font-size:13px; color:#856404; margin:0; font-style:italic;">"${p.motivoAbandonoPrivado}"</p>` : ''}
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
            <p class="postulacion-alias" ${r?.id ? `onclick="abrirPerfilPublico('${r.id}', 'reseñador')" style="cursor:pointer;"` : ''}>${r?.alias || 'Usuario no disponible'}</p>
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
  const postulacionActual = _postulacionesAutor.find(p => p.idPostulacion === idPostulacion);

  const cambios = {
    estado: accion === 'aprobar' ? 'aprobada' : 'rechazada',
    fecha_respuesta: new Date().toISOString()
  };

  if (accion === 'aprobar') {
    const fechaLimiteEntrega = new Date();
    fechaLimiteEntrega.setDate(fechaLimiteEntrega.getDate() + 30);
    cambios.fecha_limite_entrega = fechaLimiteEntrega.toISOString();
  }

  const { error } = await supabaseClient
    .from('postulaciones')
    .update(cambios)
    .eq('id', idPostulacion);

  if (error) {
    mostrarToast('Error al procesar la postulación.', 'error');
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

  const { data, error } = await supabaseClient
    .from('resenas')
    .select(`
      id, fecha_entrega, link_instagram, link_tiktok, link_amazon, link_goodreads, comentarios, puntuacion_autor,
      usuarios!resenas_id_usuario_resenador_fkey ( id, alias )
    `)
    .eq('id_campana', idCampana)
    .order('fecha_entrega', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  const reseñas = (data || []).map(r => ({
    idReseña: r.id,
    fechaEntrega: r.fecha_entrega,
    linkInstagram: r.link_instagram,
    linkTikTok: r.link_tiktok,
    linkAmazon: r.link_amazon,
    linkGoodreads: r.link_goodreads,
    comentarios: r.comentarios,
    puntuacion: r.puntuacion_autor,
    reseñador: r.usuarios ? { id: r.usuarios.id, alias: r.usuarios.alias } : null
  }));

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
    <p style="font-weight:600; ${r.reseñador?.id ? 'cursor:pointer; color:var(--bordo);' : ''}"
   ${r.reseñador?.id ? `onclick="abrirPerfilPublico('${r.reseñador.id}', 'reseñador')"` : ''}>
  ${r.reseñador?.alias || 'Reseñador'}
</p>
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
  const { error } = await supabaseClient
    .from('resenas')
    .update({ puntuacion_autor: puntuacion, fecha_puntuacion: new Date().toISOString() })
    .eq('id', idResena);

  if (error) {
    mostrarToast('Error al calificar.', 'error');
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

  const { error } = await supabaseClient
    .from('resenas')
    .update({ puntuacion_autor: parseInt(puntuacion), fecha_puntuacion: new Date().toISOString() })
    .eq('id', idResena);

  if (error) {
    mostrarMensajeError('calificar-error', error.message);
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
async function cargarHistorialAutor(idUsuario) {
  const contenedor = document.getElementById('autor-historial-lista');
  if (!contenedor) return;

  const { data, error } = await supabaseClient
    .from('campanas')
    .select('*')
    .eq('id_usuario_autor', idUsuario)
    .in('estado', ['finalizada', 'cancelada'])
    .order('fecha_limite', { ascending: false });

  if (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  _historialAutor = (data || []).map(_mapCampana);

  if (_historialAutor.length > 0) {
    const ids = _historialAutor.map(c => c.id);
    const { data: resenasEnt } = await supabaseClient
      .from('resenas').select('id_campana').in('id_campana', ids);
    _historialAutor.forEach(c => {
      c.reseñasEntregadas = (resenasEnt || []).filter(r => r.id_campana === c.id).length;
    });
  }

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
    <div class="campana-panel-acciones">
      <button class="btn-secundario btn-sm btn-full" onclick="verReseñasCampana('${c.id}', '${c.nombreLibro}')">Ver reseñas</button>
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
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { error } = await supabaseClient.rpc('cancelar_campana_propia', {
    p_id_campana: idCampana
  });

  if (error) {
    mostrarToast(error.message || 'Error al cancelar la campaña.', 'error');
    return;
  }

  mostrarToast('Campaña cancelada.', 'ok');
  await cargarCampañasAutor(user.id);
  await cargarEstadisticasAutor(user.id);
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

  const plataformasValidas = ['Amazon', 'Goodreads', 'Instagram', 'TikTok'];
if (!plataformasSeleccionadas.every(p => plataformasValidas.includes(p))) {
  const errPlat = document.getElementById('plataformas-error');
  if (errPlat) { errPlat.textContent = 'Plataforma de reseña inválida.'; errPlat.style.display = 'block'; }
  toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
  return;
}

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const archivoPortada = document.getElementById('nc-link-portada')?.files?.[0];
  let linkPortada = _portadaPrecargadaCampana;
  if (archivoPortada) {
    try {
      linkPortada = await subirImagen('PORTADAS', `${user.id}/${crypto.randomUUID()}`, archivoPortada);
    } catch (errPortada) {
      toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
      mostrarMensajeError('nc-error', errPortada.message);
      return;
    }
  }

  if (!linkPortada) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', 'La portada es obligatoria.');
    return;
  }

  const datos = {
    nombreLibro:       document.getElementById('nc-nombre-libro')?.value?.trim(),
    nombreAutor:       document.getElementById('nc-nombre-autor')?.value?.trim(),
    sinopsis:          document.getElementById('nc-sinopsis')?.value?.trim(),
    genero:            document.getElementById('nc-genero')?.value?.trim(),
    tropes:            obtenerTropesComoTexto('nc'),
    linkPortada:       linkPortada,
    linkEpub:          document.getElementById('nc-link-epub')?.value?.trim(),
    linkPdf:           document.getElementById('nc-link-pdf')?.value?.trim(),
    linkAmazon:        document.getElementById('nc-link-amazon')?.value?.trim(),
    cuposTotal:        parseInt(document.getElementById('nc-cupos')?.value),
    modalidadLectura:  document.querySelector('input[name="nc-modalidad-lectura"]:checked')?.value || 'visor',
    plataformasResena: plataformasSeleccionadas
  };

  const { data: campanaCreada, error } = await supabaseClient
    .from('campanas')
    .insert({
      id_usuario_autor:   user.id,
      nombre_libro:       datos.nombreLibro,
      nombre_autor:       datos.nombreAutor,
      sinopsis:           datos.sinopsis,
      genero:             datos.genero,
      tropes:             datos.tropes,
      link_portada:       datos.linkPortada,
      link_amazon_libro:  datos.linkAmazon,
      cupos_total:        datos.cuposTotal,
      modalidad_lectura:  datos.modalidadLectura,
      plataformas_resena: datos.plataformasResena
    })
    .select()
    .single();

  if (error) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', error.message);
    return;
  }

  const { error: errorArchivos } = await supabaseClient
    .from('campanas_archivos')
    .insert({
      id_campana: campanaCreada.id,
      link_epub: datos.linkEpub,
      link_pdf: datos.linkPdf
    });

  toggleBoton('btn-crear-campana', true, '', 'Crear campaña');

  if (errorArchivos) {
    mostrarMensajeError('nc-error', errorArchivos.message);
    return;
  }

  mostrarMensajeOk('nc-ok', '¡Campaña creada exitosamente!');
  document.getElementById('form-nueva-campana')?.reset();

  setTimeout(async () => {
    cerrarModales();
    await cargarCampañasAutor(user.id);
    await cargarEstadisticasAutor(user.id);
  }, 1500);
}


// ────────────────────────────────────────────────────────────
// PLAN
// ────────────────────────────────────────────────────────────

async function cargarPlanAutor(idUsuario) {
  const contenedor = document.getElementById('autor-plan-info');
  if (!contenedor) return;

  const { data: u, error } = await supabaseClient
    .from('usuarios')
    .select('plan, fecha_vencimiento_plan')
    .eq('id', idUsuario)
    .single();

  if (error || !u) return;
  const plan = u.plan || 'free';
  const fechaVenc = u.fecha_vencimiento_plan || '';
  
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
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    mostrarToast('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.', 'error');
    return;
  }

  const moneda = confirm('¿Pagás desde Argentina?\n\nAceptar = Mercado Pago (ARS)\nCancelar = PayPal (USD)')
    ? 'ARS'
    : 'USD';

  const funcion = moneda === 'ARS' ? 'crear-suscripcion' : 'crear-suscripcion-paypal';

  const { data, error } = await supabaseClient.functions.invoke(funcion, {
    body: { plan },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error || !data?.ok) {
    let mensaje = data?.error || error?.message || 'Error al iniciar el pago.';
    if (error?.context && typeof error.context.json === 'function') {
      try {
        const bodyReal = await error.context.json();
        mensaje = `${bodyReal.error || mensaje} | DETALLE: ${JSON.stringify(bodyReal.detalle || bodyReal)}`;
      } catch (e) {}
    }
    alert('ERROR DE PAGO (copiá este texto completo):\n\n' + mensaje);
    return;
  }

  mostrarToast('Te llevamos a completar el pago. Cuando se confirme, tu plan se activa solo.', 'ok');
  window.open(data.urlPago, '_blank');
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
async function cargarBibliotecaPanel(idUsuario) {
  const contenedor = document.getElementById('biblioteca-lista');
  if (!contenedor) return;

  const { data, error } = await supabaseClient
    .from('libros')
    .select('*')
    .eq('id_usuario_autor', idUsuario)
    .eq('eliminado', false)
    .order('fecha_carga', { ascending: false });

  if (error) return;

  _librosAutor = (data || []).map(l => ({
    id: l.id,
    titulo: l.titulo,
    sinopsisBreve: l.sinopsis_breve,
    sinopsis: l.sinopsis_breve,
    genero: l.genero,
    tropes: l.tropes,
    linkPortada: l.link_portada,
    linkAmazon: l.link_amazon
  }));
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

  const titulo = document.getElementById('libro-titulo')?.value?.trim();
  if (!titulo) {
    mostrarMensajeError('libro-error', 'El título es obligatorio.');
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const archivoPortada = document.getElementById('libro-portada')?.files?.[0];
  let linkPortada = null;
  if (archivoPortada) {
    try {
      linkPortada = await subirImagen('PORTADAS', `${user.id}/${crypto.randomUUID()}`, archivoPortada);
    } catch (errPortada) {
      mostrarMensajeError('libro-error', errPortada.message);
      return;
    }
  }

  const datos = {
    titulo:         titulo,
    sinopsisBreve:  document.getElementById('libro-sinopsis')?.value?.trim(),
    genero:         document.getElementById('libro-genero')?.value?.trim(),
    tropes: obtenerTropesComoTexto('libro'),
    linkPortada: linkPortada,
    linkAmazon:     document.getElementById('libro-amazon')?.value?.trim()
  };

  const { error } = await supabaseClient.from('libros').insert({
    id_usuario_autor: user.id,
    titulo: datos.titulo,
    sinopsis_breve: datos.sinopsisBreve,
    genero: datos.genero,
    tropes: datos.tropes,
    link_portada: datos.linkPortada,
    link_amazon: datos.linkAmazon
  });

  if (error) {
    mostrarMensajeError('libro-error', error.message);
    return;
  }

  document.getElementById('form-nuevo-libro')?.reset();
  cerrarModales();
  mostrarToast('Libro agregado a tu biblioteca.', 'ok');
  await cargarBibliotecaPanel(user.id);
}

/**
 * Elimina un libro de la biblioteca del autor.
 *
 * @param {string} idLibro
 * @param {string} titulo
 */
async function eliminarLibroAutor(idLibro, titulo) {
  if (!confirm(`¿Eliminar "${titulo}" de tu biblioteca?`)) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { error } = await supabaseClient
    .from('libros')
    .update({ eliminado: true })
    .eq('id', idLibro);

  if (error) {
    mostrarToast('Error al eliminar el libro.', 'error');
    return;
  }

  mostrarToast('Libro eliminado.', 'ok');
  await cargarBibliotecaPanel(user.id);
}
// ────────────────────────────────────────────────────────────
// SELECTOR DE LIBRO EN NUEVA CAMPAÑA
// ────────────────────────────────────────────────────────────

async function inicializarModalNuevaCampana() {
  renderizarSelectorTropes('nc-tropes-contenedor', 'nc');

   // Muestra la fecha de cierre calculada (hoy + 30 días). Ya no la elige el autor.
  const fechaCierre = new Date();
  fechaCierre.setDate(fechaCierre.getDate() + 30);
  const infoFecha = document.getElementById('nc-fecha-limite-info');
  if (infoFecha) {
    infoFecha.textContent = `Tu campaña estará activa hasta el ${fechaCierre.toLocaleDateString('es-AR')}.`;
  }

  const selector = document.getElementById('nc-libro-selector');
  if (!selector) return;

  const libros = _librosAutor;
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

  const previewPortada = document.getElementById('nc-portada-preview');

  if (!idLibro) {
    document.getElementById('nc-nombre-libro').value = '';
    document.getElementById('nc-nombre-autor').value = '';
    document.getElementById('nc-sinopsis').value     = '';
    document.getElementById('nc-genero').value       = '';
    document.getElementById('nc-link-portada').value = '';
    document.getElementById('nc-link-amazon').value  = '';
    _portadaPrecargadaCampana = null;
    if (previewPortada) previewPortada.innerHTML = '';
    renderizarSelectorTropes('nc-tropes-contenedor', 'nc');
    return;
  }

  const libro = _librosAutor.find(l => l.id === idLibro);
  if (!libro) return;

  document.getElementById('nc-nombre-libro').value = libro.titulo      || '';
  document.getElementById('nc-nombre-autor').value = Sesion.obtener()?.alias || '';
  document.getElementById('nc-sinopsis').value     = libro.sinopsis    || '';
  document.getElementById('nc-genero').value       = libro.genero      || '';
  document.getElementById('nc-link-portada').value = '';
  document.getElementById('nc-link-amazon').value  = libro.linkAmazon  || '';

  // La portada del libro ya está subida a Storage; se reutiliza si el autor
  // no elige un archivo nuevo en el input de portada de la campaña.
  _portadaPrecargadaCampana = libro.linkPortada || null;
  if (previewPortada) {
    previewPortada.innerHTML = libro.linkPortada
      ? `<img src="${libro.linkPortada}" alt="Portada del libro" style="max-width:120px; display:block; margin-top:8px; border-radius:6px;" />`
      : '';
  }

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
async function abrirEditarCampana(idCampana) {
  const campana = _campañasAutor.find(c => c.id === idCampana);
  if (!campana) return;

  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = `Editar campaña — ${campana.nombreLibro}`;
  if (footer) footer.innerHTML = '';

  if (body) body.innerHTML = `
    <form id="form-editar-campana">
      <div class="form-grupo">
        <label class="form-label">Nombre del libro</label>
        <input type="text" class="form-input" value="${campana.nombreLibro}" disabled />
      </div>
      <div class="form-grupo">
        <label class="form-label">Autor</label>
        <input type="text" class="form-input" value="${campana.nombreAutor}" disabled />
      </div>
      <div class="form-grupo">
        <label class="form-label">Sinopsis</label>
        <textarea id="ec-sinopsis" class="form-textarea" rows="4">${campana.sinopsis || ''}</textarea>
      </div>
      <div class="form-grupo">
        <label class="form-label">Género</label>
        <input type="text" id="ec-genero" class="form-input" value="${campana.genero || ''}" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Portada</label>
        ${campana.linkPortada ? `<img src="${campana.linkPortada}" alt="Portada actual" style="max-width:120px; display:block; margin-bottom:8px; border-radius:6px;" />` : ''}
        <input type="file" id="ec-link-portada" class="form-input" accept="image/jpeg,image/png,image/webp" />
        <p class="form-hint">Dejá vacío para no cambiar la portada actual.</p>
      </div>
      <div class="form-grupo">
        <label class="form-label">Link EPUB</label>
        <input type="url" id="ec-link-epub" class="form-input" value="" placeholder="Dejá vacío para no cambiar" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Link PDF</label>
        <input type="url" id="ec-link-pdf" class="form-input" value="" placeholder="Dejá vacío para no cambiar" />
      </div>
      <div id="ec-error" class="mensaje-error" style="display:none;"></div>
      <div id="ec-ok" class="mensaje-ok" style="display:none;"></div>
      <div class="modal-footer">
        <button type="button" class="btn-secundario" onclick="cerrarModales()">Cancelar</button>
        <button type="button" class="btn-primario" onclick="guardarEditarCampana('${idCampana}')">Guardar cambios</button>
      </div>
    </form>
  `;
}

async function guardarEditarCampana(idCampana) {
  ocultarMensajes('ec-error', 'ec-ok');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const archivoPortada = document.getElementById('ec-link-portada')?.files?.[0];
  let linkPortada;
  if (archivoPortada) {
    try {
      linkPortada = await subirImagen('PORTADAS', `${user.id}/${crypto.randomUUID()}`, archivoPortada);
    } catch (errPortada) {
      mostrarMensajeError('ec-error', errPortada.message);
      return;
    }
  }

  const datos = {
    sinopsis: document.getElementById('ec-sinopsis')?.value?.trim(),
    genero: document.getElementById('ec-genero')?.value?.trim(),
    linkEpub: document.getElementById('ec-link-epub')?.value?.trim(),
    linkPdf: document.getElementById('ec-link-pdf')?.value?.trim()
  };

  const cambiosCampana = {
    sinopsis: datos.sinopsis,
    genero: datos.genero
  };
  if (linkPortada) cambiosCampana.link_portada = linkPortada;

  const { error } = await supabaseClient
    .from('campanas')
    .update(cambiosCampana)
    .eq('id', idCampana);

  if (error) {
    mostrarMensajeError('ec-error', error.message);
    return;
  }

  // Solo toca campanas_archivos si el autor escribió algo nuevo.
  // "Dejá vacío para no cambiar" → si está vacío, no se manda nada.
  if (datos.linkEpub || datos.linkPdf) {
    const cambiosArchivos = {};
    if (datos.linkEpub) cambiosArchivos.link_epub = datos.linkEpub;
    if (datos.linkPdf)  cambiosArchivos.link_pdf  = datos.linkPdf;

    const { error: errorArchivos } = await supabaseClient
      .from('campanas_archivos')
      .update(cambiosArchivos)
      .eq('id_campana', idCampana);

    if (errorArchivos) {
      mostrarMensajeError('ec-error', errorArchivos.message);
      return;
    }
  }

  mostrarMensajeOk('ec-ok', '¡Campaña actualizada correctamente!');
  setTimeout(async () => {
    cerrarModales();
    await cargarCampañasAutor(user.id);
  }, 1500);
}
async function abrirEditarLibro(idLibro) {
  const libro = _librosAutor.find(l => l.id === idLibro);
  if (!libro) return;

  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = `Editar libro — ${libro.titulo}`;
  if (footer) footer.innerHTML = '';

  if (body) body.innerHTML = `
    <form id="form-editar-libro">
      <div class="form-grupo">
        <label class="form-label">Título</label>
        <input type="text" class="form-input" value="${libro.titulo}" disabled />
      </div>
      <div class="form-grupo">
        <label class="form-label">Sinopsis</label>
        <textarea id="el-sinopsis" class="form-textarea" rows="4">${libro.sinopsis || ''}</textarea>
      </div>
      <div class="form-grupo">
        <label class="form-label">Género</label>
        <input type="text" id="el-genero" class="form-input" value="${libro.genero || ''}" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Portada</label>
        ${libro.linkPortada ? `<img src="${libro.linkPortada}" alt="Portada actual" style="max-width:120px; display:block; margin-bottom:8px; border-radius:6px;" />` : ''}
        <input type="file" id="el-link-portada" class="form-input" accept="image/jpeg,image/png,image/webp" />
        <p class="form-hint">Dejá vacío para no cambiar la portada actual.</p>
      </div>
      <div id="el-error" class="mensaje-error" style="display:none;"></div>
      <div id="el-ok" class="mensaje-ok" style="display:none;"></div>
      <div class="modal-footer">
        <button type="button" class="btn-secundario" onclick="cerrarModales()">Cancelar</button>
        <button type="button" class="btn-primario" onclick="guardarEditarLibro('${idLibro}')">Guardar cambios</button>
      </div>
    </form>
  `;
}

async function guardarEditarLibro(idLibro) {
  ocultarMensajes('el-error', 'el-ok');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const archivoPortada = document.getElementById('el-link-portada')?.files?.[0];
  let linkPortada;
  if (archivoPortada) {
    try {
      linkPortada = await subirImagen('PORTADAS', `${user.id}/${crypto.randomUUID()}`, archivoPortada);
    } catch (errPortada) {
      mostrarMensajeError('el-error', errPortada.message);
      return;
    }
  }

  const datos = {
    sinopsisBreve: document.getElementById('el-sinopsis')?.value?.trim(),
    genero:        document.getElementById('el-genero')?.value?.trim()
  };

  const cambiosLibro = {
    sinopsis_breve: datos.sinopsisBreve,
    genero: datos.genero
  };
  if (linkPortada) cambiosLibro.link_portada = linkPortada;

  const { error } = await supabaseClient
    .from('libros')
    .update(cambiosLibro)
    .eq('id', idLibro);

  if (error) {
    mostrarMensajeError('el-error', error.message);
    return;
  }

  mostrarMensajeOk('el-ok', '¡Libro actualizado correctamente!');
  setTimeout(async () => {
    cerrarModales();
    await cargarBibliotecaPanel(user.id);
  }, 1500);
}
/**
 * Carga y muestra el ranking de libros con sellos de campaña.
 */
async function cargarRankingLibros() {
  const contenedor = document.getElementById('ranking-libros-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const idsLibros = _librosAutor.map(l => l.id);

  if (idsLibros.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📊</p>
        <p class="estado-vacio-texto">No tenés libros en el ranking todavía.</p>
      </div>
    `;
    return;
  }

  const { data, error } = await supabaseClient
    .from('ranking_libros')
    .select('*')
    .in('id_libro', idsLibros)
    .order('promedio_puntuacion', { ascending: false });

  if (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  const libros = (data || []).map(l => ({
    nombreLibro: l.nombre_libro,
    promedioPuntuacion: l.promedio_puntuacion,
    cantidadPuntuaciones: l.cantidad_puntuaciones,
    selloCampaña: l.sello_campaña
  }));

  if (libros.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-icono">📊</p>
        <p class="estado-vacio-texto">No tenés libros en el ranking todavía.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <table class="ranking-tabla">
      <thead>
        <tr>
          <th>Libro</th>
          <th>Promedio</th>
          <th>Reseñas</th>
          <th>Sello</th>
        </tr>
      </thead>
      <tbody>
        ${libros.map((l, i) => `
          <tr>
            <td><strong>${_esc(l.nombreLibro)}</strong></td>
            <td>⭐ ${l.promedioPuntuacion ? l.promedioPuntuacion.toFixed(2) : '—'}</td>
            <td>${l.cantidadPuntuaciones || 0}</td>
            <td>
              ${l.selloCampaña 
                ? `<span class="pp-badge pp-badge-sello pp-sello-${_esc(l.selloCampaña)}">
                    ${_iconoSello(l.selloCampaña)} ${_labelSello(l.selloCampaña)}
                  </span>`
                : '—'
              }
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
