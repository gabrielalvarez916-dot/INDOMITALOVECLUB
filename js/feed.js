// ============================================================
// feed.js — Indómita Love Club
// Feed público de campañas, filtros, detalle, postulación
// ============================================================

// ────────────────────────────────────────────────────────────
// VARIABLES GLOBALES DEL FEED
// ────────────────────────────────────────────────────────────

let _campañasTodas = [];
let _intervaloVariabilidadFeed = null;
const INTERVALO_VARIABILIDAD_FEED_MS = 3 * 60 * 1000; // cada 3 minutos se reordenan al azar

function mezclarArray(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ────────────────────────────────────────────────────────────
// CARGAR FEED
// ────────────────────────────────────────────────────────────

// "Todas las campañas" NUNCA se ordena por coincidencia: es puro azar
// (se reparte de nuevo cada tanto tiempo), lo único fijo es que las
// campañas sin cupo quedan siempre debajo de todo.
function ordenarFeed(campañas) {
  const conCupo = mezclarArray(campañas.filter(c => c.cuposDisponibles > 0));
  const sinCupo = mezclarArray(campañas.filter(c => c.cuposDisponibles <= 0));
  return [...conCupo, ...sinCupo];
}

// Variabilidad: cada tanto tiempo se vuelve a barajar "Todas las campañas"
// (sin tocar "Solo para vos", que se rige por coincidencia + cupo).
function iniciarVariabilidadFeed() {
  if (_intervaloVariabilidadFeed) clearInterval(_intervaloVariabilidadFeed);
  _intervaloVariabilidadFeed = setInterval(() => {
    const seccionFeed = document.getElementById('seccion-feed');
    if (!seccionFeed || seccionFeed.style.display === 'none') return;
    if (!_campañasTodas || _campañasTodas.length === 0) return;
    _campañasTodas = ordenarFeed(_campañasTodas);
    filtrarFeed();
  }, INTERVALO_VARIABILIDAD_FEED_MS);
}

async function cargarFeed() {
  const vacio = document.getElementById('feed-vacio');
  toggleElemento('feed-cargando', true);
  toggleElemento('feed-grid', false);
  toggleElemento('feed-vacio', false);
  toggleElemento('feed-lista-titulo', false);
  toggleElemento('feed-ticker', false);
  const soloParaVosWrapper = document.getElementById('solo-para-vos-wrapper');
  if (soloParaVosWrapper) soloParaVosWrapper.style.display = 'none';
  cargarBannerPublicitario();
  cargarTickerEvento();
  poblarFiltroGenero();

  // impulsos_campana tiene RLS que solo deja leer al autor dueño del
  // impulso (auth.uid() = id_usuario_autor) — un reseñador consultando la
  // tabla directo siempre recibía 0 filas, así que el boost pagado nunca
  // se veía en el feed de lectores. Se usa el RPC obtener_campanas_impulsadas
  // (security definer) que expone solo id_campana + fecha_fin_slider de los
  // impulsos vigentes, sin abrir el resto de la tabla.
  const [{ data: campanas, error }, { data: impulsosVigentes }] = await Promise.all([
    supabaseClient
      .from('campanas')
      .select('*')
      .eq('estado', 'activa')
      .order('creado_en', { ascending: false }),
    supabaseClient.rpc('obtener_campanas_impulsadas')
  ]);
  const idsCampanasImpulsadas = new Set((impulsosVigentes || []).map(i => i.id_campana));

  toggleElemento('feed-cargando', false);

  if (error) {
    toggleElemento('feed-vacio', true);
    if (vacio) {
      vacio.innerHTML = `
        <p class="estado-vacio-icono">⚠️</p>
        <p class="estado-vacio-texto">Error al cargar campañas</p>
        <p class="estado-vacio-sub">${error.message}</p>
        <button class="btn-secundario" onclick="cargarFeed()" style="margin-top:16px;">Reintentar</button>
      `;
    }
    return;
  }

  const idsLibros = [...new Set((campanas || []).map(c => c.id_libro).filter(Boolean))];
  let rankingsPorLibro = {};
  if (idsLibros.length > 0) {
    const { data: rankings } = await supabaseClient
      .from('ranking_libros_historico')
      .select('*')
      .in('id_libro', idsLibros);
    (rankings || []).forEach(r => { rankingsPorLibro[r.id_libro] = r; });
  }

  const idsCampanas = (campanas || []).map(c => c.id);
  let archivosPorCampana = {};
  if (idsCampanas.length > 0) {
    const { data: archivos } = await supabaseClient
      .from('campanas_archivos')
      .select('*')
      .in('id_campana', idsCampanas);
    (archivos || []).forEach(a => { archivosPorCampana[a.id_campana] = a; });
  }

  let tropesPorCampana = {};
  if (idsCampanas.length > 0) {
    const { data: tropesRows } = await supabaseClient
      .from('campana_tropes')
      .select('id_campana, tropes ( nombre )')
      .in('id_campana', idsCampanas);
    (tropesRows || []).forEach(row => {
      if (!tropesPorCampana[row.id_campana]) tropesPorCampana[row.id_campana] = [];
      if (row.tropes) tropesPorCampana[row.id_campana].push(row.tropes.nombre);
    });
  }

  let subgenerosPorCampana = {};
  if (idsCampanas.length > 0) {
    const { data: subgenerosRows } = await supabaseClient
      .from('campana_subgeneros')
      .select('id_campana, id_subgenero')
      .in('id_campana', idsCampanas);
    (subgenerosRows || []).forEach(row => {
      if (!subgenerosPorCampana[row.id_campana]) subgenerosPorCampana[row.id_campana] = [];
      subgenerosPorCampana[row.id_campana].push(row.id_subgenero);
    });
  }

  _campañasTodas = await Promise.all(
    (campanas || []).map(c => normalizarCampana(c, rankingsPorLibro[c.id_libro], archivosPorCampana[c.id], tropesPorCampana[c.id], subgenerosPorCampana[c.id], idsCampanasImpulsadas.has(c.id)))
  );
  if (_campañasTodas.length === 0) {
    toggleElemento('feed-vacio', true);
    return;
  }

  _campañasTodas = ordenarFeed(_campañasTodas);

  renderizarFeed(_campañasTodas);
  Slider.init();
  renderizarSoloParaVos();
  iniciarVariabilidadFeed();
}

// ────────────────────────────────────────────────────────────
// SOLO PARA VOS
// ────────────────────────────────────────────────────────────

function renderizarSoloParaVos() {
  const wrapper = document.getElementById('solo-para-vos-wrapper');
  const scroll = document.getElementById('solo-para-vos-scroll');
  if (!wrapper || !scroll) return;

  if (Sesion.rol() !== 'reseñador') {
    wrapper.style.display = 'none';
    return;
  }

  // Nunca entran campañas sin química (matchScore <= 50, tier 👎).
  // Prioridad: primero las que tienen cupo (por mayor coincidencia).
  // Si con eso no se llegan a 5, se completa con las que no tienen cupo
  // (también ordenadas por mayor coincidencia).
  const conChimica = c => typeof c.matchScore === 'number' && c.matchScore > 50;

  const conCupo = _campañasTodas
    .filter(c => conChimica(c) && c.cuposDisponibles > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  const sinCupo = _campañasTodas
    .filter(c => conChimica(c) && c.cuposDisponibles <= 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  const candidatas = [...conCupo, ...sinCupo].slice(0, 5);

  if (candidatas.length === 0) {
    wrapper.style.display = 'none';
    return;
  }

  scroll.innerHTML = candidatas.map(c => `
    <div class="solo-para-vos-card" onclick="verDetalleCampaña('${c.id}')">
      ${c.linkPortada
        ? `<img class="solo-para-vos-portada" src="${c.linkPortada}" alt="${c.nombreLibro}" />`
        : `<div class="solo-para-vos-portada-placeholder">📖</div>`}
      <p class="solo-para-vos-card-titulo">${c.nombreLibro}</p>
      <p class="solo-para-vos-card-match">${c.matchEmoji} ${c.matchLabel} · ${c.matchScore}%</p>
      <div class="solo-para-vos-card-boton-wrap">${botonSoloParaVosHtml(c)}</div>
    </div>
  `).join('');

  wrapper.style.display = 'block';
}

/**
 * Botón "Postularme" para las cards del slider Solo para vos.
 * Misma lógica que en las cards de "Todas las campañas": si está vencida
 * o sin archivo válido queda deshabilitado, si no tiene cupo se avisa,
 * y si todo está OK dispara el mismo flujo de postulación de siempre
 * (iniciarPostulacion), sin abrir el modal (el click en la card sí lo abre).
 */
function botonSoloParaVosHtml(c) {
  if (c.estaVencida) {
    return `<button class="btn-secundario btn-sm" disabled style="width:100%; opacity:0.5; cursor:not-allowed;">Campaña cerrada</button>`;
  }
  if (!c.tieneArchivo) {
    return `<button class="btn-secundario btn-sm" disabled style="width:100%; opacity:0.5; cursor:not-allowed;">Postularme</button>`;
  }
  if (c.cuposDisponibles > 0) {
    return `<button class="btn-primario btn-sm" style="width:100%;" onclick="event.stopPropagation(); iniciarPostulacion('${c.id}')">Postularme</button>`;
  }
  return `<button class="btn-secundario btn-sm" disabled style="width:100%; opacity:0.5; cursor:not-allowed;">Sin cupos</button>`;
}

async function normalizarCampana(c, ranking, archivo, tropesCatalogo, idsSubgenero, impulsada = false) {
  const usuario = Sesion.obtener();
  const hoy = new Date();
  const fechaLimite = new Date(c.fecha_limite);

  let match;
  if (usuario?.rol === 'reseñador' && usuario.id) {
    const { data, error } = await supabaseClient
      .rpc('obtener_match_resenador_campana', {
        p_id_usuario: usuario.id,
        p_id_campana: c.id
      });
    if (!error) match = data;
  }

  const etiquetaGenero = await obtenerEtiquetaGeneroMulti(c.id_genero, idsSubgenero && idsSubgenero.length > 0 ? idsSubgenero : (c.id_subgenero ? [c.id_subgenero] : []));

 return {
    id: c.id,
    idAutor: c.id_usuario_autor,
    nombreLibro: c.nombre_libro,
    nombreAutor: c.nombre_autor,
    sinopsis: c.sinopsis,
   tropes: c.tropes,
    tropesCatalogo: tropesCatalogo || [],
    genero: etiquetaGenero || c.genero, // fallback al texto viejo si la campaña no está migrada
    idGenero: c.id_genero,
    idSubgenero: c.id_subgenero,
    idsSubgeneros: idsSubgenero || [],
    linkPortada: c.link_portada,
    portadaValida: !!c.link_portada,
    impulsada,
    linkAmazon: c.link_amazon_libro,
    cuposDisponibles: c.cupos_disponibles,
    cuposTotal: c.cupos_total,
    fechaLimite: c.fecha_limite,
    estaVencida: fechaLimite < hoy,
    modalidadLectura: c.modalidad_lectura,
    plataformasReseña: c.plataformas_resena || [],
    matchScore: match?.score,
    matchEmoji: match?.emoji,
    matchLabel: match?.label,
    matchDestacado: match?.destacado,
    linkEpub: archivo?.link_epub || null,
    linkPdf: archivo?.link_pdf || null,
    tieneArchivo: !!(archivo?.link_epub || archivo?.link_pdf),
    rankingLibro: ranking ? {
      esTop5: ranking.es_top5,
      esTop20: ranking.es_top20,
      promedio: ranking.promedio_puntuacion,
      totalReseñas: ranking.total_resenas
    } : undefined
  };
}

function renderizarFeed(campañas) {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  if (campañas.length === 0) {
    toggleElemento('feed-grid', false);
    toggleElemento('feed-lista-titulo', false);
    toggleElemento('feed-ticker', false);
    toggleElemento('feed-vacio', true);
    return;
  }

  grid.innerHTML = campañas.map(c => construirCardCampaña(c)).join('');

  // Carga las imágenes de fondo con lazy loading
  setTimeout(() => {
    grid.querySelectorAll('img').forEach(img => {
      img.loading = 'lazy'; // Carga solo cuando se ve
    });
  }, 0);

  toggleElemento('feed-grid', true);
  toggleElemento('feed-lista-titulo', true);
  toggleElemento('feed-ticker', true);
  toggleElemento('feed-vacio', false);
}


// ────────────────────────────────────────────────────────────
// FILTROS
// ────────────────────────────────────────────────────────────

function filtrarFeed() {
  const textoBuscar = (document.getElementById('filtro-buscar')?.value || '').toLowerCase().trim();
  const idGeneroFiltro = document.getElementById('filtro-genero')?.value || '';

  let campañasFiltradas = _campañasTodas;

  if (textoBuscar) {
    campañasFiltradas = campañasFiltradas.filter(c =>
      c.nombreLibro.toLowerCase().includes(textoBuscar) ||
      c.nombreAutor.toLowerCase().includes(textoBuscar)
    );
  }

  if (idGeneroFiltro) {
    campañasFiltradas = campañasFiltradas.filter(c =>
      c.idGenero === parseInt(idGeneroFiltro, 10)
    );
  }

  renderizarFeed(campañasFiltradas);
}

/**
 * Llena el <select> de filtro de género con el catálogo real de generos
 * (antes tenía una lista vieja hardcodeada que no coincidía con la tabla `generos`).
 */
async function poblarFiltroGenero() {
  const select = document.getElementById('filtro-genero');
  if (!select) return;

  const { data, error } = await supabaseClient
    .from('generos')
    .select('id, nombre')
    .eq('activo', true)
    .order('orden');

  if (error) { console.error('Error cargando generos para el filtro:', error); return; }

  select.innerHTML = `
    <option value="">Todos los géneros</option>
    ${(data || []).map(g => `<option value="${g.id}">${g.nombre}</option>`).join('')}
  `;
}


// ────────────────────────────────────────────────────────────
// CARD DE CAMPAÑA
// ────────────────────────────────────────────────────────────

function construirCardCampaña(c) {
  const rol = Sesion.rol();

  const portadaHtml = c.linkPortada
  ? `<img class="campana-portada-lista" src="${c.linkPortada}" alt="${c.nombreLibro}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="campana-portada-lista-placeholder" style="display:none">📖</div>`
  : `<div class="campana-portada-lista-placeholder">📖</div>`;

 const listaTropes = (c.tropesCatalogo && c.tropesCatalogo.length > 0)
    ? c.tropesCatalogo
    : tropesTextoAArray(c.tropes); // fallback para campañas viejas sin catálogo

  const tropesHtml = listaTropes.slice(0, 3).map(t =>
    `<span class="campana-trope">${t}</span>`
  ).join('');

const iconoPlataforma = { Amazon: '🛒', TikTok: '🎵', Instagram: '📸', Goodreads: '📚' };
const requisitosHtml = c.plataformasReseña && c.plataformasReseña.length > 0
 ? `<p style="font-size:12px; color:var(--bordo); background:var(--rosa-claro); padding:4px 10px; border-radius:20px; margin:4px 0; display:inline-block;">
       📋 <strong>Requisitos:</strong> Cuenta activa en
       ${c.plataformasReseña.map(p => `${iconoPlataforma[p.trim()] || ''}${p.trim()}`).join(' y ')}
     </p>`
  : '';

let botonHtml = '';
  if (c.estaVencida) {
    botonHtml = `<button class="btn-secundario btn-sm" disabled style="opacity:0.5; cursor:not-allowed;">Campaña cerrada</button>`;
  } else if (!c.tieneArchivo) {
    botonHtml = `
      <button class="btn-secundario btn-sm" disabled style="opacity:0.5; cursor:not-allowed;">Postularme</button>
      <p style="font-size:11px; color:var(--bordo); margin-top:4px;">Este autor aún no ha cargado el libro correctamente.</p>
    `;
  } else if (rol === 'reseñador') {
    if (c.cuposDisponibles > 0) {
      botonHtml = `<button class="btn-primario btn-sm" onclick="event.stopPropagation(); iniciarPostulacion('${c.id}')">Postularme</button>`;
    } else {
      botonHtml = `<button class="btn-secundario btn-sm" disabled style="opacity:0.5; cursor:not-allowed;">Sin cupos</button>`;
    }
  } else if (!rol) {
    botonHtml = `<button class="btn-secundario btn-sm" onclick="event.stopPropagation(); mostrarSeccion('login')">Ingresá para postularte</button>`;
  }
  
  const icoSilla = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0Z"/><path d="M6 19v2"/><path d="M18 19v2"/></svg>`;
  const icoReloj = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  return `
    <div class="campana-card-horizontal${c.estaVencida ? ' campana-vencida' : ''}" onclick="verDetalleCampaña('${c.id}')">
      ${portadaHtml}
      <div class="campana-info">
<p class="campana-autor"
   ${c.idAutor ? `onclick="abrirPerfilAutorFeed(event, '${c.idAutor}')" style="cursor:pointer;"` : ''}>
  ${c.nombreAutor}
</p>
        <h3 class="campana-titulo">${c.nombreLibro}</h3>
        ${c.genero ? `<span class="campana-genero">${c.genero}</span>` : ''}
        ${c.matchScore !== undefined ? `
        <div style="margin:6px 0;">
          <span style="font-size:12px; font-weight:600; color:var(--bordo);">
            ${c.matchEmoji} ${c.matchLabel} · ${c.matchScore}%
          </span>
          <div style="background:var(--crema-oscura); border-radius:20px; height:5px; margin-top:3px;">
            <div style="background:var(--bordo); width:${c.matchScore}%; height:5px; border-radius:20px;"></div>
          </div>
        </div>` : ''}
       <div class="campana-tropes">
      ${tropesHtml}</div>
${requisitosHtml}
        ${c.rankingLibro && c.rankingLibro.totalReseñas > 0 ? `
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin:2px 0;">
            ${c.rankingLibro.esTop5  ? `<span class="badge badge-top5">🏆 Top 5</span>` : ''}
            ${c.rankingLibro.esTop20 && !c.rankingLibro.esTop5 ? `<span class="badge badge-top20">⭐ Top 20</span>` : ''}
            <span style="font-size:11px; color:var(--gris-suave);">⭐ ${c.rankingLibro.promedio?.toFixed(1) ?? '—'} · ${c.rankingLibro.totalReseñas} reseña${c.rankingLibro.totalReseñas !== 1 ? 's' : ''}</span>
          </div>` : ''}
          ${c.modalidadLectura === 'descarga'
            ? '<p class="campana-aclaracion">⬇️ <strong>Aclaración:</strong> Se lee con descarga</p>'
            : '<p class="campana-aclaracion">📖 <strong>Aclaración:</strong> Se lee en visor (sin descarga)</p>'}
          <div class="campana-dato">
            <span class="campana-dato-label">${icoSilla}Cupos</span>
            <span class="campana-dato-valor">${c.cuposDisponibles > 0 ? c.cuposDisponibles : '—'}</span>
          </div>
          <div class="campana-dato">
            <span class="campana-dato-label">${icoReloj}Fecha límite</span>
            <span class="campana-dato-valor">${formatearFechaAmigable(c.fechaLimite)}</span>
          </div>
          ${botonHtml ? `<div class="campana-dato-sep"></div><div class="campana-dato" style="margin-left:auto;">${botonHtml}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// DETALLE DE CAMPAÑA
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// BLOQUE "RESEÑAS OBTENIDAS" (estilo Amazon) — dentro del modal de
// detalle de campaña (feed). Muestra promedio + desglose por estrella,
// promedio de moods/spice/drama, y el listado de reseñas individuales
// (alias + estrellas + comentario — solo si tiene comentario).
// ────────────────────────────────────────────────────────────

function _barraDesgloseEstrellas(conteos, total) {
  return [5, 4, 3, 2, 1].map(n => {
    const cant = conteos[n] || 0;
    const pct = total > 0 ? Math.round((cant / total) * 100) : 0;
    return `
      <div class="resenas-barra-fila">
        <span class="resenas-barra-label">${n} ★</span>
        <div class="resenas-barra-fondo"><div class="resenas-barra-relleno" style="width:${pct}%;"></div></div>
        <span class="resenas-barra-cant">${cant}</span>
      </div>
    `;
  }).join('');
}

async function _construirBloqueReseñasLibro(idCampaña, idLibro) {
  // Junta las reseñas de TODAS las campañas del mismo libro (id_libro),
  // no solo de esta campaña puntual — para cuando el libro tuvo varios
  // relanzamientos y la mayoría de las reseñas quedaron en campañas
  // anteriores ya vencidas.
  let idsCampanas = [idCampaña];
  if (idLibro) {
    const { data: campanasDelLibro } = await supabaseClient
      .from('campanas')
      .select('id')
      .eq('id_libro', idLibro);
    if (campanasDelLibro && campanasDelLibro.length > 0) {
      idsCampanas = campanasDelLibro.map(c => c.id);
    }
  }

  const { data, error } = await supabaseClient
    .from('resenas')
    .select(`
      puntuacion_libro, comentarios, moods,
      rating_romance, rating_spice, rating_drama, rating_estilo, rating_tension, rating_ritmo, rating_worldbuilding,
      usuarios!resenas_id_usuario_resenador_fkey ( id, alias, avatares ( imagen_url ) )
    `)
    .in('id_campana', idsCampanas);

  if (error || !data || data.length === 0) {
    return `
      <div class="resenas-obtenidas-bloque">
        <p class="resenas-obtenidas-titulo">Reseñas obtenidas</p>
        <p class="estado-vacio-texto" style="font-size:13px;">Todavía no hay reseñas para este libro.</p>
      </div>
    `;
  }

  const conValoracion = data.filter(r => r.puntuacion_libro != null);
  const total = conValoracion.length;
  const promedio = total > 0 ? conValoracion.reduce((s, r) => s + r.puntuacion_libro, 0) / total : 0;

  const conteos = {};
  conValoracion.forEach(r => { conteos[r.puntuacion_libro] = (conteos[r.puntuacion_libro] || 0) + 1; });

  // Promedio de los 7 ratings decorativos (mismos que la reseña interna: romance, spice, drama, estilo, tension, ritmo, worldbuilding)
  const CATEGORIAS_RATING = ['romance', 'spice', 'drama', 'estilo', 'tension', 'ritmo', 'worldbuilding'];
  const promediosRating = {};
  CATEGORIAS_RATING.forEach(cat => {
    const campo = 'rating_' + cat;
    const conValor = data.filter(r => r[campo] != null);
    promediosRating[cat] = conValor.length > 0 ? conValor.reduce((s, r) => s + r[campo], 0) / conValor.length : null;
  });
  const hayRatings = Object.values(promediosRating).some(v => v !== null);

  const conteoMoods = {};
  data.forEach(r => (r.moods || []).forEach(m => { conteoMoods[m] = (conteoMoods[m] || 0) + 1; }));
  const moodsOrdenados = Object.entries(conteoMoods).sort((a, b) => b[1] - a[1]);

  const reseñasConComentario = data.filter(r => r.comentarios && r.comentarios.trim() !== '');

  return `
    <div class="resenas-obtenidas-bloque">
      <p class="resenas-obtenidas-titulo">Reseñas obtenidas</p>

      <div class="resenas-obtenidas-resumen">
        <span class="resenas-obtenidas-promedio">⭐ ${promedio.toFixed(1)}</span>
        <span class="resenas-obtenidas-total">${total} valoraci${total === 1 ? 'ón' : 'ones'}</span>
      </div>

      <div class="resenas-obtenidas-desglose">
        ${_barraDesgloseEstrellas(conteos, total)}
      </div>

      ${(moodsOrdenados.length > 0 || hayRatings) ? `
        <div class="resenas-obtenidas-extras">
          ${moodsOrdenados.length > 0 ? `
            <div class="resenas-obtenidas-moods">
              ${moodsOrdenados.map(([m, c]) => `<span class="badge-mood">${_esc(_LABELS_MOODS[m] || m)} · ${c}</span>`).join('')}
            </div>
          ` : ''}
          ${hayRatings ? `
            <div class="resenas-obtenidas-ratings-internos">
              ${CATEGORIAS_RATING.filter(cat => promediosRating[cat] !== null).map(cat => `
                <span class="rating-interno">${_ICONOS_RATING_DECORATIVO[cat]} ${cat[0].toUpperCase() + cat.slice(1)}: <strong>${promediosRating[cat].toFixed(1)}</strong></span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${reseñasConComentario.length > 0 ? `
        <div class="resenas-obtenidas-lista">
          ${reseñasConComentario.map(r => `
            <div class="resenas-obtenidas-item">
              <div class="resenas-obtenidas-item-header" ${r.usuarios?.id ? `onclick="abrirPerfilPublico('${r.usuarios.id}', 'reseñador')" style="cursor:pointer;"` : ''}>
                <img class="resenas-obtenidas-item-avatar" src="${r.usuarios?.avatares?.imagen_url || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK'}" alt="" onerror="this.style.visibility='hidden'" />
                <span class="resenas-obtenidas-item-alias">${_esc(r.usuarios?.alias || 'Reseñador@')}</span>
                <span class="resenas-obtenidas-item-estrellas">${'★'.repeat(r.puntuacion_libro || 0)}${'☆'.repeat(5 - (r.puntuacion_libro || 0))}</span>
              </div>
              <p class="resenas-obtenidas-item-comentario">${_esc(r.comentarios)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

async function verDetalleCampaña(idCampaña) {
  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = 'Cargando...';
  if (body) body.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
  if (footer) footer.innerHTML = '';

  const { data: campanaRaw, error } = await supabaseClient
    .from('campanas')
    .select('*')
    .eq('id', idCampaña)
    .single();

  if (error || !campanaRaw) {
    if (body) body.innerHTML = `<p class="mensaje-error">${error?.message || 'Campaña no encontrada'}</p>`;
    return;
  }

  const { data: archivoRaw } = await supabaseClient
    .from('campanas_archivos')
    .select('*')
    .eq('id_campana', idCampaña)
    .maybeSingle();

  const { data: tropesRaw } = await supabaseClient
    .from('campana_tropes')
    .select('tropes ( nombre )')
    .eq('id_campana', idCampaña);

  const tropesCatalogoDetalle = (tropesRaw || []).map(t => t.tropes?.nombre).filter(Boolean);

  const { data: subgenerosRaw } = await supabaseClient
    .from('campana_subgeneros')
    .select('id_subgenero')
    .eq('id_campana', idCampaña);

  const idsSubgeneroDetalle = (subgenerosRaw || []).map(s => s.id_subgenero);

  const c = await normalizarCampana(campanaRaw, undefined, archivoRaw, tropesCatalogoDetalle, idsSubgeneroDetalle);
  if (titulo) titulo.textContent = c.nombreLibro;

  let posicionRanking = null;
  if (campanaRaw.id_libro) {
    const { data: rankingLibroRaw } = await supabaseClient
      .from('ranking_libros_historico')
      .select('pos_top')
      .eq('id_libro', campanaRaw.id_libro)
      .maybeSingle();
    posicionRanking = rankingLibroRaw?.pos_top ?? null;
  }

  const portadaHtml = c.linkPortada
    ? `
      <div style="position:relative; margin-bottom:20px;">
        <img src="${c.linkPortada}" alt="${c.nombreLibro}" style="width:100%; max-height:300px; object-fit:cover; border-radius:8px; display:block;" onerror="this.style.display='none'" />
        ${posicionRanking ? `<span class="tag-ranking-portada">🏆 #${posicionRanking}</span>` : ''}
      </div>
    `
    : '';

  const amazonHtml = c.linkAmazon
    ? `<a href="${c.linkAmazon}" target="_blank" class="btn-secundario btn-sm" style="display:inline-block; margin-top:8px;">🛒 Ver en Amazon</a>`
    : '';

  const bloqueReseñasHtml = await _construirBloqueReseñasLibro(idCampaña, campanaRaw.id_libro);

  if (body) {
    body.innerHTML = `
      ${portadaHtml}
      <p style="font-size:13px; color:var(--gris-suave); margin-bottom:4px;">por ${c.nombreAutor}</p>
      ${c.genero ? `<span class="campana-genero">${c.genero}</span>` : ''}
      <p style="margin:16px 0; font-size:14px; line-height:1.6;">${c.sinopsis}</p>
    ${(c.tropesCatalogo && c.tropesCatalogo.length > 0)
        ? `<p style="font-size:13px; color:var(--gris-suave);"><strong>Tropes:</strong> ${c.tropesCatalogo.join(', ')}</p>`
        : (c.tropes ? `<p style="font-size:13px; color:var(--gris-suave);"><strong>Tropes:</strong> ${c.tropes}</p>` : '')}
${c.plataformasReseña && c.plataformasReseña.length > 0
  ? `<p style="font-size:13px; margin-top:8px;">
       📋 <strong>Requisitos:</strong> Contar con cuenta activa en ${c.plataformasReseña.join(' y ')}
     </p>`
  : ''}
      ${Sesion.rol() === 'reseñador' && c.matchScore !== undefined ? `
        <div style="margin:12px 0;">
          <p style="font-size:13px; font-weight:600; color:var(--bordo); margin-bottom:4px;">
            ${c.matchEmoji} ${c.matchLabel} · ${c.matchScore}% de coincidencia
          </p>
          <div style="background:var(--crema-oscura); border-radius:20px; height:6px;">
            <div style="background:var(--bordo); width:${c.matchScore}%; height:6px; border-radius:20px;"></div>
          </div>
        </div>` : ''}
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--crema-oscura);">
        <p style="font-size:13px;"><strong>Cupos disponibles:</strong> ${c.cuposDisponibles} de ${c.cuposTotal}</p>
        <p style="font-size:13px;"><strong>Fecha límite:</strong> ${formatearFechaAmigable(c.fechaLimite)}</p>
        <p style="font-size:13px;">${c.modalidadLectura === 'descarga' ? '⬇️ <strong>Aclaración:</strong> Se lee con descarga del archivo' : '📖 <strong>Aclaración:</strong> Se lee en el visor (sin descarga)'}</p>
      </div>
      ${amazonHtml}
      ${bloqueReseñasHtml}
    `;
  }

  const rol = Sesion.rol();
  if (footer) {
    if (!c.tieneArchivo) {
      footer.innerHTML = `
        <div style="text-align:center;">
          <button class="btn-primario" disabled style="opacity:0.5; cursor:not-allowed;">Postularme a esta campaña</button>
          <p style="font-size:12px; color:var(--bordo); margin-top:6px;">Este autor aún no ha cargado el libro correctamente.</p>
        </div>
      `;
    } else if (rol === 'reseñador' && c.cuposDisponibles > 0) {
      footer.innerHTML = `<button class="btn-primario" onclick="cerrarModales(); iniciarPostulacion('${c.id}')">Postularme a esta campaña</button>`;
    } else if (!rol) {
      footer.innerHTML = `<button class="btn-primario" onclick="cerrarModales(); mostrarSeccion('login')">Ingresá para postularte</button>`;
    }
  }

  if (typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('revisar_modal_info_campana_feed');
  }
}


// ────────────────────────────────────────────────────────────
// POSTULACIÓN
// ────────────────────────────────────────────────────────────

async function iniciarPostulacion(idCampaña) {
  const email = Sesion.email();
  if (!email) {
    mostrarSeccion('login');
    return;
  }

  const usuario = Sesion.obtener();

  if (!usuario.pais || !usuario.ciudad) {
    const inputCampaña = document.getElementById('completar-id-campana');
    if (inputCampaña) inputCampaña.value = idCampaña;
    mostrarModal('modal-completar-perfil');
  } else {
    await confirmarPostulacion(idCampaña);
  }
}

async function guardarPerfilYPostularse(event) {
  event.preventDefault();

  const idCampaña = document.getElementById('completar-id-campana')?.value;
  if (!idCampaña) return;

  ocultarMensajes('completar-error');

  const datos = {
    pais:        document.getElementById('completar-pais')?.value?.trim(),
    ciudad:      document.getElementById('completar-ciudad')?.value?.trim(),
    instagram:   document.getElementById('completar-instagram')?.value?.trim(),
    tiktok:      document.getElementById('completar-tiktok')?.value?.trim(),
    amazon:      document.getElementById('completar-amazon')?.value?.trim(),
    descripcionLector: document.getElementById('completar-descripcion')?.value?.trim(),
    generos:     document.getElementById('completar-generos')?.value?.trim()
  };

  if (!datos.pais || !datos.ciudad) {
    mostrarMensajeError('completar-error', 'País y ciudad son obligatorios.');
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { error: errorPerfil } = await supabaseClient
    .from('usuarios')
    .update({
      pais:               datos.pais,
      ciudad:             datos.ciudad,
      instagram:          datos.instagram,
      tiktok:             datos.tiktok,
      amazon:             datos.amazon,
      descripcion_lector: datos.descripcionLector,
      generos:            datos.generos
    })
    .eq('id', user.id);

  if (errorPerfil) {
    mostrarMensajeError('completar-error', errorPerfil.message);
    return;
  }

  const usuarioActual = Sesion.obtener();
  Sesion.guardar({ ...usuarioActual, ...datos });

  cerrarModales();
  await confirmarPostulacion(idCampaña);
}

async function confirmarPostulacion(idCampaña) {
  const usuario = Sesion.obtener();

  const campaña = _campañasTodas.find(c => c.id === idCampaña);

  if (campaña && !campaña.tieneArchivo) {
    mostrarToast('😭 El libro todavía no llegó. Estamos tan confundidos como vos.', 'error');
    return;
  }

  if (campaña && campaña.plataformasReseña && campaña.plataformasReseña.length > 0) {
    const mapeo = {
      Amazon:    usuario.amazon,
      TikTok:    usuario.tiktok,
      Instagram: usuario.instagram
    };
    const faltantes = campaña.plataformasReseña
      .map(p => p.trim())
      .filter(p => p !== 'Goodreads')
      .filter(p => !mapeo[p]);

    if (faltantes.length > 0) {
      mostrarToast(`👀 Te falta ${faltantes.join(' y ')}. No podemos mandarte a la batalla así.`, 'error');
      return;
    }
  }

  const { error } = await supabaseClient.rpc('crear_postulacion', {
    p_campana: idCampaña
  });

  if (error) {
    mostrarToast(error.message || '😈 La postulación dijo "hoy no". Probá de nuevo.', 'error');
    return;
  }

  mostrarToast(`💅 Te postulaste a "${campaña?.nombreLibro || 'la campaña'}". Ahora que el autor decida tu destino.`, 'ok');
if (campaña?.matchScore >= 70 && typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('postular_alta_coincidencia');
  }
}

// ────────────────────────────────────────────────────────────
// SLIDER
// ────────────────────────────────────────────────────────────

const Slider = (() => {
  let slides = [];
  let dots = [];
  let actual = 0;
  let timer = null;
  const INTERVALO = 5000;

  function init() {
    const sliderEl = document.getElementById('feed-slider');
    const navEl = document.getElementById('slide-nav');
    if (!sliderEl || !navEl) return;

    const conPortada = _campañasTodas.filter(c => c.portadaValida);

    // Las campañas con impulso vigente entran SIEMPRE al slider (no compiten
    // por el sorteo al azar). El resto de los slots hasta completar 5 se
    // sortea igual que siempre entre las que no están impulsadas.
    const impulsadas = conPortada.filter(c => c.impulsada);
    const resto = conPortada.filter(c => !c.impulsada);
    mezclar(impulsadas);
    mezclar(resto);
    const campañasSlider = [...impulsadas, ...resto].slice(0, 5);

    if (campañasSlider.length === 0) return;

    const slidesHtml = campañasSlider.map(c => construirSlide(c)).join('');
    sliderEl.insertAdjacentHTML('beforeend', slidesHtml);

    navEl.innerHTML = campañasSlider.map((_, i) =>
      `<button class="slide-dot${i === 0 ? ' activo' : ''}" aria-label="Slide ${i + 1}"></button>`
    ).join('');

    slides = Array.from(sliderEl.querySelectorAll('.slide'));
    dots   = Array.from(navEl.querySelectorAll('.slide-dot'));

    mostrar(0);
    iniciarAutoplay();

    const prev = sliderEl.querySelector('.slide-arrow-prev');
    const next = sliderEl.querySelector('.slide-arrow-next');
    if (prev) prev.addEventListener('click', () => { ir(actual - 1); reiniciarAutoplay(); });
    if (next) next.addEventListener('click', () => { ir(actual + 1); reiniciarAutoplay(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { ir(i); reiniciarAutoplay(); }));

    sliderEl.addEventListener('mouseenter', () => clearInterval(timer));
    sliderEl.addEventListener('mouseleave', () => iniciarAutoplay());
  }

  function construirSlide(c) {
    const rol = Sesion.rol();

   const portadaHtml = c.linkPortada
  ? `<div class="slide-libro-3d" onclick="verDetalleCampaña('${c.id}')">
       <img class="slide-libro-tapa" src="${c.linkPortada}" alt="${c.nombreLibro}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:2px 6px 6px 2px;" />
       <div class="slide-libro-sombra"></div>
     </div>`
  : `<div class="slide-libro-3d" onclick="verDetalleCampaña('${c.id}')">
       <div style="position:absolute;inset:0;background:var(--crema-oscura);display:flex;align-items:center;justify-content:center;font-size:64px;border-radius:2px 6px 6px 2px;">📖</div>
       <div class="slide-libro-sombra"></div>
     </div>`;

   const listaTropesSlide = (c.tropesCatalogo && c.tropesCatalogo.length > 0)
      ? c.tropesCatalogo
      : tropesTextoAArray(c.tropes);

    const tropesHtml = listaTropesSlide.slice(0, 4).map(t =>
      `<span class="slide-trope">${t}</span>`
    ).join('');

   let botonHtml = '';
    if (!c.tieneArchivo) {
      botonHtml = `
        <button class="btn-postular" disabled style="opacity:0.5; cursor:not-allowed;">Postularme →</button>
        <p style="font-size:11px; color:var(--bordo); margin-top:4px;">Este autor aún no ha cargado el libro correctamente.</p>
      `;
    } else if (rol === 'reseñador' && c.cuposDisponibles > 0) {
      botonHtml = `<button class="btn-postular" onclick="event.stopPropagation(); iniciarPostulacion('${c.id}')">Postularme →</button>`;
    } else if (!rol) {
      botonHtml = `<button class="btn-postular" onclick="event.stopPropagation(); mostrarSeccion('login')">Ingresá para postularte →</button>`;
    }

    const icoReloj = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const icoSilla = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0Z"/><path d="M6 19v2"/><path d="M18 19v2"/></svg>`;

    return `
      <div class="slide" onclick="verDetalleCampaña('${c.id}')">
        <div class="slide-portada-wrap">
          ${portadaHtml}
        </div>
        <div class="slide-info">
          ${c.genero ? `<span class="slide-genero">${c.genero}</span>` : ''}
          ${c.impulsada ? `<span class="badge" style="background:#FFF3CD;color:#7A5B00;margin-left:6px;">🚀 Impulsada</span>` : ''}
          <h2 class="slide-titulo">${c.nombreLibro}</h2>
          <p class="slide-autor">por ${c.nombreAutor}</p>
          ${tropesHtml ? `<div class="slide-tropes">${tropesHtml}</div>` : ''}
          <div class="slide-meta-linea">
            <span class="slide-meta-dato">${icoReloj} ${formatearFechaAmigable(c.fechaLimite)}</span>
            <span class="slide-meta-sep">|</span>
            <span class="slide-meta-dato">${icoSilla} ${c.cuposDisponibles > 0 ? c.cuposDisponibles + ' lugares disponibles' : 'Sin cupos'}</span>
          </div>
          <div class="slide-acciones">${botonHtml}</div>
        </div>
      </div>
    `;
  }

  function mezclar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function mostrar(i) {
    slides.forEach((s, idx) => s.classList.toggle('activo', idx === i));
    dots.forEach((d, idx)   => d.classList.toggle('activo', idx === i));
    actual = i;
  }

  function ir(i) {
    const total = slides.length;
    mostrar((i + total) % total);
  }

  function iniciarAutoplay() {
    clearInterval(timer);
    timer = setInterval(() => ir(actual + 1), INTERVALO);
  }

  function reiniciarAutoplay() {
    clearInterval(timer);
    iniciarAutoplay();
  }

  return { init };
})();
// ────────────────────────────────────────────────────────────
// BANNER PUBLICITARIO
// ────────────────────────────────────────────────────────────

const BannerPublicitario = (() => {
  let banners = [];
  let actual = 0;
  let timer = null;
  const INTERVALO = 6000;

 async function cargar() {
    const { data, error } = await supabaseClient
      .from('banners')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) return;

    banners = (data || []).map(b => ({
      imagenUrl: b.imagen_url,
      linkDestino: b.link_destino
    }));
    const wrapper = document.getElementById('banner-publicitario-wrapper');

    if (banners.length === 0) {
      if (wrapper) wrapper.style.display = 'none';
      return;
    }

    renderizar();
    if (wrapper) wrapper.style.display = 'block';
  }

  function renderizar() {
    const contenedor = document.getElementById('banner-publicitario');
    const nav = document.getElementById('banner-publicitario-nav');
    if (!contenedor) return;

    contenedor.innerHTML = banners.map((b, i) => `
      <div class="banner-publicitario-slide${i === 0 ? ' activo' : ''}" id="banner-slide-${i}">
        ${b.linkDestino
          ? `<a href="${b.linkDestino}" target="_blank" rel="noopener"><img src="${b.imagenUrl}" alt="Banner publicitario" /></a>`
          : `<img src="${b.imagenUrl}" alt="Banner publicitario" />`}
      </div>
    `).join('');

    if (nav) {
      if (banners.length > 1) {
        nav.innerHTML = banners.map((_, i) =>
          `<button class="banner-publicitario-dot${i === 0 ? ' activo' : ''}" id="banner-dot-${i}" aria-label="Banner ${i + 1}"></button>`
        ).join('');
        nav.querySelectorAll('.banner-publicitario-dot').forEach((dot, i) => {
          dot.addEventListener('click', () => { mostrar(i); reiniciarAutoplay(); });
        });
        iniciarAutoplay();
      } else {
        nav.innerHTML = '';
      }
    }
  }

  function mostrar(i) {
    document.querySelectorAll('.banner-publicitario-slide').forEach((s, idx) => {
      s.classList.toggle('activo', idx === i);
    });
    document.querySelectorAll('.banner-publicitario-dot').forEach((d, idx) => {
      d.classList.toggle('activo', idx === i);
    });
    actual = i;
  }

  function iniciarAutoplay() {
    clearInterval(timer);
    if (banners.length <= 1) return;
    timer = setInterval(() => {
      mostrar((actual + 1) % banners.length);
    }, INTERVALO);
  }

  function reiniciarAutoplay() {
    iniciarAutoplay();
  }

  return { cargar };
})();

async function cargarTickerEvento() {
  const track = document.getElementById('feed-ticker-track');
  if (!track) return;

  const { data: evento } = await supabaseClient
    .from('eventos')
    .select('nombre, tema')
    .eq('activo', true)
    .maybeSingle();

  const imgParticula = evento?.tema?.particula?.imagen;

  const iconoHtml = imgParticula
    ? `<img src="${imgParticula}" alt="" class="feed-ticker-particula" />`
    : '✨';

  const texto = evento
    ? `${iconoHtml} Nuevo evento: ${evento.nombre}`
    : 'Nueva campaña';

  const itemHtml = `<span class="feed-ticker-item">${texto}</span><span class="feed-ticker-sep">✦</span>`;
  track.innerHTML = itemHtml.repeat(8);
}

function cargarBannerPublicitario() {
  BannerPublicitario.cargar();
}
function abrirPerfilAutorFeed(event, idAutor) {
  event.stopPropagation();
  event.preventDefault();
  abrirPerfilPublico(idAutor, 'autor');
}
