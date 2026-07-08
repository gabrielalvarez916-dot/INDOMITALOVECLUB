// ============================================================
// perfil-publico.js — Indómita Love Club
// Perfiles públicos clickeables de autores y reseñadores.
// Uso: abrirPerfilPublico(id, 'autor') | abrirPerfilPublico(id, 'reseñador')
// ============================================================


// ────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA PRINCIPAL
// ────────────────────────────────────────────────────────────

/**
 * Abre el modal de perfil público según el rol.
 * @param {string} id    — idUsuario del autor o reseñador
 * @param {string} rol   — 'autor' | 'reseñador'
 */
async function abrirPerfilPublico(id, rol) {
  if (!id || !rol) return;

  _mostrarModalPerfilPublico();
  _estadoPerfilPublico('cargando');

  try {
    if (rol === 'autor') {
      await _cargarPerfilAutor(id);
      if (Sesion.rol() === 'reseñador' && typeof registrarAccionEventoSiCorresponde === 'function') {
        registrarAccionEventoSiCorresponde('revisar_perfil_autor');
      }
    } else if (rol === 'reseñador') {
      await _cargarPerfilReseñador(id);
      if (Sesion.rol() === 'autor' && typeof registrarAccionEventoSiCorresponde === 'function') {
        registrarAccionEventoSiCorresponde('revisar_perfil_reseñador');
      }
    }
  } catch (e) {
    _estadoPerfilPublico('error');
  }
}


// ────────────────────────────────────────────────────────────
// CARGA DE PERFIL AUTOR
// ────────────────────────────────────────────────────────────

async function _cargarPerfilAutor(idAutor) {
  const [{ data: perfil, error: errPerfil }, { data: libros }, { data: campañas }] = await Promise.all([
    supabaseClient.rpc('obtener_perfil_publico_autor', { p_id_autor: idAutor }),
    supabaseClient.rpc('listar_libros_perfil_publico',  { p_id_autor: idAutor }),
    supabaseClient.rpc('listar_campanas_activas_por_autor', { p_id_autor: idAutor })
  ]);

  if (errPerfil || !perfil || perfil.error) {
    _estadoPerfilPublico('error');
    return;
  }

  perfil.miembroDesde = perfil.fechaRegistro;

  _pintarPerfilAutor(perfil, libros || [], campañas || [], perfil);
  _estadoPerfilPublico('autor');
}


// ────────────────────────────────────────────────────────────
// CARGA DE PERFIL RESEÑADOR
// ────────────────────────────────────────────────────────────

let _idReseñadorPerfilActual = null;
let _bibliotecaEsPropia = false;
let _bibliotecaLibrosLeidosCache = [];

async function _cargarPerfilReseñador(idReseñador) {
  _idReseñadorPerfilActual = idReseñador;
  const [{ data: perfil, error: errPerfil }, { data: ultimosLibros }] = await Promise.all([
    supabaseClient.rpc('obtener_perfil_resenador', { p_id_resenador: idReseñador }),
    supabaseClient.rpc('obtener_ultimos_libros_leidos', { p_id_resenador: idReseñador })
  ]);
  if (errPerfil || !perfil || perfil.error) {
    _estadoPerfilPublico('error');
    return;
  }
  _pintarPerfilReseñador(perfil, []);
  _pintarEncabezadoHistorico({
    ...perfil,
    miembroDesde: perfil.fechaRegistro,
    reseñasEntregadas: perfil.totalLibrosLeidos
  });
  _pintarUltimosLibros(ultimosLibros || []);
  _estadoPerfilPublico('reseñador');
  _evaluarBotonesVerMas();
}

// ────────────────────────────────────────────────────────────
// BOTONES "VER MÁS" (descripción y tropes del perfil reseñador)
// ────────────────────────────────────────────────────────────

/**
 * Revisa si la descripción o los tropes están recortados visualmente
 * (overflow), y si es así, muestra el botón "Ver más" correspondiente.
 * Se llama después de pintar el perfil del reseñador.
 */
function _evaluarBotonesVerMas() {
  requestAnimationFrame(() => {
    const descripcionEl = document.getElementById('pp-reseñador-descripcion');
    const btnDescripcion = document.getElementById('pp-btn-vermas-descripcion');
    if (descripcionEl && btnDescripcion) {
      const estaTruncado = descripcionEl.scrollHeight > descripcionEl.clientHeight + 1;
      btnDescripcion.style.display = estaTruncado ? 'inline-block' : 'none';
    }

    const tropesEl = document.getElementById('pp-reseñador-tropes');
    const btnTropes = document.getElementById('pp-btn-vermas-tropes');
    if (tropesEl && btnTropes) {
      const estaTruncado = tropesEl.scrollHeight > tropesEl.clientHeight + 1;
      btnTropes.style.display = estaTruncado ? 'inline-block' : 'none';
    }
  });
}
/**
 * Expande o contrae el bloque de descripción o tropes al hacer
 * clic en "Ver más" / "Ver menos".
 * @param {'descripcion'|'tropes'} bloque
 */
function _toggleVerMas(bloque) {
  const mapaElementos = {
    descripcion: { contenido: 'pp-reseñador-descripcion', boton: 'pp-btn-vermas-descripcion' },
    tropes:      { contenido: 'pp-reseñador-tropes',      boton: 'pp-btn-vermas-tropes' }
  };

  const config = mapaElementos[bloque];
  if (!config) return;

  const contenidoEl = document.getElementById(config.contenido);
  const botonEl = document.getElementById(config.boton);
  if (!contenidoEl || !botonEl) return;

  // pp-texto-truncado / pp-tropes-truncado quedan SIEMPRE puestas;
  // solo togglear pp-expandido, que es la que sobreescribe el recorte.
  const expandido = contenidoEl.classList.toggle('pp-expandido');
  botonEl.textContent = expandido ? 'Ver menos' : 'Ver más';
}

// ────────────────────────────────────────────────────────────
// PINTAR: PERFIL AUTOR
// ────────────────────────────────────────────────────────────

function _pintarPerfilAutor(perfil, libros, campañas, gamif) {
  // Cabecera común
  _pintarCabeceraComun(perfil, '');

  // Miembro desde
  const miembroDesdeEl = document.getElementById('pp-autor-miembro-desde');
  if (miembroDesdeEl) {
    miembroDesdeEl.textContent = perfil.miembroDesde
      ? `Miembro desde ${formatearFechaAmigable(perfil.miembroDesde)}`
      : '';
  }

  // ═══ GAMIFICACIÓN ═══
  if (gamif) {
    const gamifCont = document.getElementById('pp-autor-gamificacion');
    if (gamifCont) {
      gamifCont.innerHTML = _renderGamificacionAutor(gamif);
      gamifCont.parentElement.style.display = '';
    }
  }

  // Libros — cards estilo Goodreads, igual que en reseñador
  const librosCont = document.getElementById('pp-autor-libros');
  if (librosCont) {
    if (libros.length === 0) {
      librosCont.innerHTML = '<p class="pp-vacio">Sin libros cargados aún.</p>';
    } else {
      librosCont.innerHTML = libros.map(libro => _renderCardLibroAutor(libro)).join('');
    }
  }

  // Campañas activas — cards con portada
  const campañasCont = document.getElementById('pp-autor-campanas');
  if (campañasCont) {
    if (campañas.length === 0) {
      campañasCont.innerHTML = '<p class="pp-vacio">Sin campañas activas en este momento.</p>';
    } else {
      campañasCont.innerHTML = campañas.map(c => {
        const portadaUrl = c.linkPortada
          ? (c.linkPortada.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + c.linkPortada : c.linkPortada)
          : '';
        return `
          <div class="pp-libro-goodreads-card">
              <div class="pp-portada-con-sello">
                ${portadaUrl
                  ? `<img src="${_esc(portadaUrl)}" alt="${_esc(c.nombreLibro)}" class="pp-libro-goodreads-portada" />`
                  : '<div class="pp-libro-goodreads-portada pp-portada-placeholder">📖</div>'}
                ${c.sello ? `
                  <span class="pp-sello-flotante pp-sello-${_esc(c.sello)}">
                    ${_iconoSello(c.sello)} ${_labelSello(c.sello)}
                  </span>
                ` : ''}
              </div>
              <div class="pp-libro-goodreads-info">
                <p class="pp-libro-goodreads-titulo">${_esc(c.nombreLibro)}</p>
              ${c.fechaLimite ? `<p class="pp-libro-goodreads-fecha">Fecha límite: ${formatearFechaAmigable(c.fechaLimite)}</p>` : ''}
              <button class="btn-secundario btn-sm" style="margin-top:8px;" onclick="cerrarModalPerfilPublico(); verDetalleCampaña('${_esc(c.id)}');">
                Ver campaña
              </button>
            </div>
          </div>`;
      }).join('');
    }
  }
}

/**
 * Card de libro para el perfil público de autor — mismo estilo
 * "Goodreads" que ya usamos para libros de reseñador, pero con
 * género y puntuación promedio global en vez de estrellas de 1-5
 * fijas y fecha de entrega.
 */
function _renderCardLibroAutor(libro) {
  const portadaUrl = libro.portada
    ? (libro.portada.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + libro.portada : libro.portada)
    : '';

  const badge = libro.cantidadReseñas >= 5
    ? '<span class="pp-badge pp-badge-destacado">⭐ +5 reseñas</span>'
    : '';

  const puntuacionHtml = libro.puntuacionPromedio !== null && libro.puntuacionPromedio !== undefined
    ? `<p class="pp-libro-puntuacion">⭐ ${libro.puntuacionPromedio.toFixed(1)}</p>`
    : '';

  return `
    <div class="pp-libro-goodreads-card">
      ${portadaUrl
        ? `<img src="${_esc(portadaUrl)}" alt="${_esc(libro.titulo)}" class="pp-libro-goodreads-portada" />`
        : '<div class="pp-libro-goodreads-portada pp-portada-placeholder">📖</div>'}
      <div class="pp-libro-goodreads-info">
        <p class="pp-libro-goodreads-titulo">${_esc(libro.titulo)} ${badge}</p>
        ${libro.genero ? `<p class="pp-libro-goodreads-autor">${_esc(libro.genero)}</p>` : ''}
        ${puntuacionHtml}
        ${libro.amazon ? `<a href="${_esc(libro.amazon)}" target="_blank" class="pp-link-externo">Ver en Amazon →</a>` : ''}
      </div>
    </div>`;
}
// ═══ HELPERS GAMIFICACIÓN (AUTOR) ═══

function _renderGamificacionAutor(gamif) {
  const insigniasHtml = gamif.insignias && gamif.insignias.length > 0
    ? gamif.insignias.map(i => `
        <div class="pp-insignia-item" title="${_esc(i.codigo)}">
          <span class="pp-insignia-icono">${_iconoInsignia(i.tipo)}</span>
          <span class="pp-insignia-label">${_esc(_labelInsigniaAutor(i))}</span>
        </div>
      `).join('')
    : '<p class="pp-vacio">Sin insignias aún</p>';

  return `
    <div class="pp-bloque pp-encabezado-historico">
      <div class="pp-badges-fila">
        <span class="pp-badge pp-badge-nivel">📚 ${_esc(gamif.labelNivel || 'Nuevo Miembro')}</span>
        <span class="pp-badge pp-badge-completion">⭐ ${gamif.puntosHistoricos || 0} pts</span>
      </div>
    </div>

    <div class="pp-bloque">
      <p class="pp-bloque-titulo">Insignias</p>
      <div class="pp-insignias-grid">${insigniasHtml}</div>
    </div>
  `;
}

function _iconoSello(codigo) {
  const iconos = {
    legendaria:  '🏆',
    destacada:   '⭐',
    muy_exitosa: '✨',
    exitosa:     '💫'
  };
  return iconos[codigo] || '📖';
}

function _labelSello(codigo) {
  const labels = {
    legendaria:  'Legendaria',
    destacada:   'Destacada',
    muy_exitosa: 'Muy exitosa',
    exitosa:     'Exitosa'
  };
  return labels[codigo] || '';
}

function _iconoInsignia(tipo) {
  const iconos = {
    nivel_autor:      '📚',
    hito_campañas:    '🎖️',
    sello_campaña:    '⭐',
    evento:           '🎉'
  };
  return iconos[tipo] || '🏅';
}

function _labelInsigniaAutor(insignia) {
  // insignia.codigo es algo como "nivel_autor_sensei" o "hito_campañas_campañas_5"
  const partes = (insignia.codigo || '').split('_');
  return partes.slice(-1)[0].replace(/([A-Z])/g, ' $1').trim() || insignia.codigo;
}
// ────────────────────────────────────────────────────────────
// PINTAR: PERFIL RESEÑADOR
// ────────────────────────────────────────────────────────────

function _pintarPerfilReseñador(perfil, postulaciones) {
  // Cabecera común
  _pintarCabeceraComun(perfil, '-r');

  // Badge de nivel (siempre visible)
  const nivelCont = document.getElementById('pp-reseñador-nivel');
  if (nivelCont) {
    const nivel = perfil.nivel || perfil.nivelActual || '—';
    nivelCont.innerHTML = `<span class="pp-badge pp-badge-nivel">📚 ${_esc(String(nivel))}</span>`;
  }

  const rankingCont = document.getElementById('pp-reseñador-ranking');
  if (rankingCont) {
    const badges = [];
    if (perfil.posicionRanking)  badges.push(`<span class="pp-badge pp-badge-ranking">🏆 #${_esc(String(perfil.posicionRanking))}</span>`);
    if (perfil.puntosMensuales)  badges.push(`<span class="pp-badge pp-badge-completion">⭐ ${_esc(String(perfil.puntosMensuales))} pts</span>`);
    if (perfil.completion)       badges.push(`<span class="pp-badge pp-badge-completion">✅ ${_esc(String(Math.round(perfil.completion)))}% completado</span>`);
    if (perfil.categoria) {
      const labelCat = {
        top5: '🏆 Top 5', top20: '🥈 Top 20',
        diamante: '💎 Diamante', oro: '🥇 Oro',
        plata: '🥈 Plata', bronce: '🥉 Bronce'
      }[perfil.categoria] || perfil.categoria;
      badges.push(`<span class="pp-badge pp-badge-nivel">${_esc(labelCat)}</span>`);
    }

    if (badges.length > 0) {
      rankingCont.innerHTML = badges.join('');
      rankingCont.style.display = 'flex';
    } else {
      rankingCont.style.display = 'none';
    }
  }


  // Géneros y tropes favoritos
  const generosCont = document.getElementById('pp-reseñador-generos');
  if (generosCont) {
    if (perfil.generos) {
      generosCont.innerHTML = `<p class="pp-etiquetas">${_esc(perfil.generos)}</p>`;
      generosCont.closest('.pp-bloque')?.style.removeProperty('display');
    } else {
      generosCont.closest('.pp-bloque')?.style.setProperty('display', 'none');
    }
  }

  // Descripción lectora
const descripcionEl = document.getElementById('pp-reseñador-descripcion');
if (descripcionEl) {
  const bloqueDescripcion = document.getElementById('pp-bloque-descripcion');
if (perfil.descripcionLector) {
    descripcionEl.textContent = perfil.descripcionLector;
    if (bloqueDescripcion) bloqueDescripcion.style.display = '';
  } else {
    if (bloqueDescripcion) bloqueDescripcion.style.display = 'none';
  }
}
  
  const tropesCont = document.getElementById('pp-reseñador-tropes');
  if (tropesCont) {
    if (perfil.tropesFavoritos) {
      const tropesArr = perfil.tropesFavoritos.split(',').map(t => t.trim()).filter(Boolean);
      tropesCont.innerHTML = tropesArr.map(t => `<span class="pp-trope">${_esc(t)}</span>`).join('');
      tropesCont.closest('.pp-bloque')?.style.removeProperty('display');
    } else {
      tropesCont.closest('.pp-bloque')?.style.setProperty('display', 'none');
    }
  }

  // Postulaciones últimos 6 meses
  const postCont = document.getElementById('pp-reseñador-postulaciones');
  if (postCont) {
    if (postulaciones.length === 0) {
      postCont.innerHTML = '<p class="pp-vacio">Sin actividad reciente.</p>';
    } else {
      postCont.innerHTML = postulaciones.map(p => {
        const estadoClase = {
          'Pendiente':  'pp-estado-pendiente',
          'Aprobado':   'pp-estado-aprobado',
          'Reseñado':   'pp-estado-reseñado',
        }[p.badgeEstado] || 'pp-estado-pendiente';
        return `
          <div class="pp-post-fila">
            <span class="pp-post-libro">${_esc(p.campaña?.nombreLibro || '—')}</span>
            <span class="pp-estado ${estadoClase}">${_esc(p.badgeEstado || '—')}</span>
          </div>`;
      }).join('');
    }
  }
}

// ────────────────────────────────────────────────────────────
// PINTAR: CABECERA COMÚN (avatar, alias, país, ciudad, redes)
// ────────────────────────────────────────────────────────────

function _pintarCabeceraComun(perfil, sufijo = '') {
  const avatarEl = document.getElementById('pp-avatar' + sufijo);
  if (avatarEl) {
    const _resolverAvatar = (url) => {
  if (!url) return '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK';
  if (url.startsWith('/')) return 'https://indomitaloveclub.vercel.app' + url;
  return url;
};
avatarEl.src = _resolverAvatar(perfil.avatarUrl);
    avatarEl.alt = perfil.alias || 'Avatar';
  }

  const aliasEl = document.getElementById('pp-alias' + sufijo);
  if (aliasEl) aliasEl.textContent = perfil.alias || '—';

  const ubicacionEl = document.getElementById('pp-ubicacion' + sufijo);
  if (ubicacionEl) {
    const partes = [perfil.ciudad, perfil.pais].filter(Boolean);
    ubicacionEl.textContent = partes.length ? partes.join(', ') : '';
    ubicacionEl.style.display = partes.length ? '' : 'none';
  }

  // Redes sociales
  const redesEl = document.getElementById('pp-redes' + sufijo);
  if (redesEl) {
    const redes = [];
    if (perfil.instagram) redes.push(`<a href="${_esc(perfil.instagram)}" target="_blank" class="pp-red-link pp-red-instagram">Instagram</a>`);
    if (perfil.tiktok)    redes.push(`<a href="${_esc(perfil.tiktok)}"    target="_blank" class="pp-red-link pp-red-tiktok">TikTok</a>`);
    if (perfil.amazon)    redes.push(`<a href="${_esc(perfil.amazon)}"    target="_blank" class="pp-red-link pp-red-amazon">Amazon</a>`);
    redesEl.innerHTML = redes.join('');
    redesEl.style.display = redes.length ? '' : 'none';
  }
}

// ────────────────────────────────────────────────────────────
// CONTROL DEL MODAL
// ────────────────────────────────────────────────────────────

function _mostrarModalPerfilPublico() {
  mostrarModal('modal-perfil-publico');
}

function cerrarModalPerfilPublico() {
  cerrarModales();
}

/**
 * Controla qué sub-bloque se muestra dentro del modal.
 * @param {'cargando'|'error'|'autor'|'reseñador'} estado
 */
function _estadoPerfilPublico(estado) {
  const bloques = ['pp-cargando', 'pp-error', 'pp-bloque-autor', 'pp-bloque-reseñador'];
  bloques.forEach(id => toggleElemento(id, false));

  const mapa = {
    cargando:  'pp-cargando',
    error:     'pp-error',
    autor:     'pp-bloque-autor',
    reseñador: 'pp-bloque-reseñador',
  };

  if (mapa[estado]) toggleElemento(mapa[estado], true);
}


// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

/** Escapa HTML para evitar XSS al insertar datos del backend */
function _esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _pintarEncabezadoHistorico(encabezado) {
  if (!encabezado) return;

  const badgeCont = document.getElementById('pp-r-badge-historico');
  if (badgeCont) {
    badgeCont.innerHTML = encabezado.labelBadgeHistorico
      ? `<span class="pp-badge pp-badge-nivel">🏅 ${_esc(encabezado.labelBadgeHistorico)}</span>`
      : '';
  }

  const miembroDesdeEl = document.getElementById('pp-r-miembro-desde');
  if (miembroDesdeEl) {
    miembroDesdeEl.textContent = encabezado.miembroDesde
      ? `Miembro desde ${formatearFechaAmigable(encabezado.miembroDesde)}`
      : '';
  }

  const statsCont = document.getElementById('pp-r-stats');
  if (statsCont) {
    const completionRedondeado = Math.round(encabezado.completionHistorico || 0);
    const calificacionRedondeada = encabezado.calificacionPromedio
      ? encabezado.calificacionPromedio.toFixed(1)
      : '—';

    statsCont.innerHTML = `
      <div class="pp-stat-item">
        <span class="pp-stat-valor">${encabezado.reseñasEntregadas || 0}</span>
        <span class="pp-stat-label">Reseñas entregadas</span>
      </div>
      <div class="pp-stat-item">
        <span class="pp-stat-valor">${calificacionRedondeada}${encabezado.calificacionPromedio ? ' ★' : ''}</span>
        <span class="pp-stat-label">Calificación promedio</span>
      </div>
      <div class="pp-stat-item">
        <span class="pp-stat-valor">${completionRedondeado}%</span>
        <span class="pp-stat-label">Completion histórico</span>
      </div>
      <div class="pp-stat-item">
        <span class="pp-stat-valor">${_esc(encabezado.labelLigaActual || '—')}</span>
        <span class="pp-stat-label">Liga actual</span>
      </div>
    `;
  }

  const insigniasCont = document.getElementById('pp-r-insignias');
  if (insigniasCont) {
    const insignias = encabezado.insignias || [];
    if (insignias.length === 0) {
      insigniasCont.innerHTML = '<p class="pp-vacio">Todavía sin insignias.</p>';
    } else {
      insigniasCont.innerHTML = insignias.map(i => `
        <div class="pp-insignia-item" title="${_esc(i.codigo)}">
          <span class="pp-insignia-icono">${_iconoPorTipoInsignia(i.tipo)}</span>
          <span class="pp-insignia-label">${_esc(_labelInsignia(i))}</span>
        </div>
      `).join('');
    }
  }
}

function _iconoPorTipoInsignia(tipo) {
  const iconos = {
    badge_historico: '🏅',
    hito_resenas:    '📚',
    top5:            '🏆',
    top20:           '🥈',
    liga:            '🎖️',
    completion:      '✅',
    reto:            '🔥',
    evento:          '🎉'
  };
  return iconos[tipo] || '⭐';
}

function _labelInsignia(insignia) {
  const partes = (insignia.codigo || '').split('_').join(' ');
  return partes.charAt(0).toUpperCase() + partes.slice(1);
}

function _pintarUltimosLibros(libros) {
  const cont = document.getElementById('pp-r-ultimos-libros');
  if (!cont) return;

  if (libros.length === 0) {
    cont.innerHTML = '<p class="pp-vacio">Todavía no reseñó ningún libro.</p>';
    return;
  }

  cont.innerHTML = libros.map(l => _renderCardLibroGoodreads(l)).join('');
}

function _renderCardLibroGoodreads(libro) {
  const portadaUrl = libro.linkPortada
    ? (libro.linkPortada.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + libro.linkPortada : libro.linkPortada)
    : '';

  const estrellas = '★'.repeat(libro.puntuacionLibro || 0) + '☆'.repeat(5 - (libro.puntuacionLibro || 0));

  return `
    <div class="pp-libro-goodreads-card">
      ${portadaUrl
        ? `<img src="${_esc(portadaUrl)}" alt="${_esc(libro.nombreLibro)}" class="pp-libro-goodreads-portada" />`
        : '<div class="pp-libro-goodreads-portada pp-portada-placeholder">📖</div>'}
      <div class="pp-libro-goodreads-info">
        <p class="pp-libro-goodreads-titulo">${_esc(libro.nombreLibro || '—')}</p>
        <p class="pp-libro-goodreads-autor">${_esc(libro.nombreAutor || '')}</p>
        <p class="pp-libro-goodreads-estrellas">${estrellas}</p>
        ${libro.fechaEntrega ? `<p class="pp-libro-goodreads-fecha">${formatearFechaAmigable(libro.fechaEntrega)}</p>` : ''}
      </div>
    </div>
  `;
}

function _renderCardLibroSimple(item, tipo) {
  const portadaUrl = item.linkPortada
    ? (item.linkPortada.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + item.linkPortada : item.linkPortada)
    : '';

  const etiqueta = tipo === 'dnf'
    ? '<span class="pp-badge pp-badge-dnf">DNF</span>'
    : '<span class="pp-badge pp-badge-leyendo">Leyendo</span>';

  return `
    <div class="pp-libro-goodreads-card">
      ${portadaUrl
        ? `<img src="${_esc(portadaUrl)}" alt="${_esc(item.nombreLibro)}" class="pp-libro-goodreads-portada" />`
        : '<div class="pp-libro-goodreads-portada pp-portada-placeholder">📖</div>'}
      <div class="pp-libro-goodreads-info">
        <p class="pp-libro-goodreads-titulo">${_esc(item.nombreLibro || '—')} ${etiqueta}</p>
        <p class="pp-libro-goodreads-autor">${_esc(item.nombreAutor || '')}</p>
      </div>
    </div>
  `;
}

// Reemplaza la función abrirBiblioteca() existente
async function abrirBiblioteca(idReseñadorOverride) {
  const idReseñador = idReseñadorOverride || _idReseñadorPerfilActual;
  if (!idReseñador) return;

  _idReseñadorPerfilActual = idReseñador;
  _bibliotecaEsPropia = false;  // ← viene del perfil público de otra persona

  cerrarModales();

  mostrarSeccion('biblioteca-resenador');
}

// Función nueva — se llama desde ui.js cuando se navega a 'biblioteca-resenador'
async function cargarBibliotecaSeccion() {
  if (!_idReseñadorPerfilActual) {
    const email = Sesion.email();
    if (!email) return;

    const { data: idRes, error: errId } = await supabaseClient.rpc('obtener_id_resenador_por_email', { p_email: email });
    if (errId || !idRes || idRes.error) {
      _estadoBibliotecaSeccion('error');
      return;
    }
    _idReseñadorPerfilActual = idRes.id;
    _bibliotecaEsPropia = true;  // ← se resolvió desde la sesión propia
  }

  // Título: "Mi biblioteca" si es la propia, o el alias de la otra persona
  const tituloEl = document.getElementById('bib-titulo-seccion');
  if (tituloEl) {
    tituloEl.textContent = _bibliotecaEsPropia ? 'Mi biblioteca' : 'Biblioteca';
  }

  _estadoBibliotecaSeccion('cargando');

  try {
    const { data: biblioteca, error: errBib } = await supabaseClient.rpc('obtener_biblioteca_resenador', {
      p_id_resenador: _idReseñadorPerfilActual
    });

    if (errBib || !biblioteca || biblioteca.error) {
      _estadoBibliotecaSeccion('error');
      return;
    }

    _pintarBiblioteca(biblioteca);
    _estadoBibliotecaSeccion('contenido');

  } catch (e) {
    _estadoBibliotecaSeccion('error');
  }
}

// Control de estados para la sección (no modal)
function _estadoBibliotecaSeccion(estado) {
  const mapa = {
    cargando: 'bib-cargando',
    error:    'bib-error',
    contenido:'bib-contenido'
  };
  ['bib-cargando', 'bib-error', 'bib-contenido'].forEach(id => toggleElemento(id, false));
  if (mapa[estado]) toggleElemento(mapa[estado], true);
}

function cerrarModalBiblioteca() {
  cerrarModales();
}

function _estadoBiblioteca(estado) {
  const bloques = ['bib-cargando', 'bib-error', 'bib-contenido'];
  bloques.forEach(id => toggleElemento(id, false));

  const mapa = { cargando: 'bib-cargando', error: 'bib-error', contenido: 'bib-contenido' };
  if (mapa[estado]) toggleElemento(mapa[estado], true);
}

function _pintarBiblioteca(datos) {
  const { leyendoActualmente = [], dnf = [], librosLeidos = [] } = datos;

  _bibliotecaLibrosLeidosCache = librosLeidos;

  const tbrCont = document.getElementById('bib-leyendo-actualmente');
  if (tbrCont) {
    tbrCont.innerHTML = leyendoActualmente.length === 0
      ? '<p class="estante-vacio">Sin lecturas en curso.</p>'
      : leyendoActualmente.map(item => _renderLibroEstante(item, false)).join('');
  }

  const leidosCont = document.getElementById('bib-libros-leidos');
  if (leidosCont) {
    leidosCont.innerHTML = librosLeidos.length === 0
      ? '<p class="estante-vacio">Todavía no reseñó ningún libro.</p>'
      : librosLeidos.map(l => _renderLibroEstante(l, true, l.idResena)).join('');
  }

  const dnfCont = document.getElementById('bib-dnf');
  if (dnfCont) {
    dnfCont.innerHTML = dnf.length === 0
      ? '<p class="estante-vacio">Sin abandonos.</p>'
      : dnf.map(item => _renderLibroEstante(item, false)).join('');
  }
}

/**
 * Card de libro para la estantería (Parte A). Si esClickeable=true (libros
 * leídos), abre el modal de Reseña interna (Parte C) al tocarlo.
 */
function _renderLibroEstante(item, esClickeable, idResena) {
  const portadaUrl = item.linkPortada
    ? (item.linkPortada.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + item.linkPortada : item.linkPortada)
    : '';

  const clase = esClickeable ? 'estante-libro estante-libro--clickeable' : 'estante-libro';
  const onclick = esClickeable ? ` onclick="abrirResenaInterna('${_esc(idResena)}')"` : '';

  return `
    <div class="${clase}"${onclick}>
      ${portadaUrl
        ? `<img src="${_esc(portadaUrl)}" alt="${_esc(item.nombreLibro)}" class="estante-libro-portada" onerror="this.style.display='none'" />`
        : '<div class="estante-libro-portada-placeholder">📖</div>'}
      <p class="estante-libro-titulo">${_esc(item.nombreLibro || '—')}</p>
    </div>
  `;
}
// ────────────────────────────────────────────────────────────
// MODAL: RESEÑA INTERNA (solo lectura, Parte C)
// ────────────────────────────────────────────────────────────

const _LABELS_MOODS = {
  divertido: '😄 Divertido',
  nostalgico: '🕰️ Nostálgico',
  adictivo: '🔥 Adictivo',
  reconfortante: '🤍 Reconfortante',
  intenso: '⚡ Intenso'
};

const _ICONOS_RATING_DECORATIVO = {
  romance: '♥',
  spice: '🌶️',
  drama: '🎭',
  estilo: '✒️'
};

/**
 * Abre el modal de solo lectura con el detalle de la Reseña interna
 * de un libro ya leído. Se llama al tocar un libro en "Leídos".
 * @param {string} idResena
 */
function abrirResenaInterna(idResena) {
  const r = _bibliotecaLibrosLeidosCache.find(l => l.idResena === idResena);
  if (!r) return;

  const portadaUrl = r.linkPortada
    ? (r.linkPortada.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + r.linkPortada : r.linkPortada)
    : '';

  const portadaEl = document.getElementById('ri-portada');
  portadaEl.style.display = '';
  portadaEl.src = portadaUrl;
  document.getElementById('ri-titulo').textContent = r.nombreLibro || '';
  document.getElementById('ri-autor').textContent = 'por ' + (r.nombreAutor || '');

  const puntuacion = r.puntuacionLibro || 0;
  document.getElementById('ri-estrellas').textContent = puntuacion
    ? '★'.repeat(puntuacion) + '☆'.repeat(5 - puntuacion)
    : 'Sin calificar';

  document.getElementById('ri-fecha-postulacion').textContent = r.fechaPostulacion ? formatearFechaAmigable(r.fechaPostulacion) : '—';
  document.getElementById('ri-fecha-entrega').textContent = r.fechaEntrega ? formatearFechaAmigable(r.fechaEntrega) : '—';

  const moodsCont = document.getElementById('ri-moods');
  const moods = r.moods || [];
  if (moods.length === 0) {
    document.getElementById('ri-moods-grupo').style.display = 'none';
  } else {
    document.getElementById('ri-moods-grupo').style.display = '';
    moodsCont.innerHTML = moods.map(m => `<span class="mood-chip-solo-lectura">${_esc(_LABELS_MOODS[m] || m)}</span>`).join('');
  }

  const frasesCont = document.getElementById('ri-frases');
  const frases = [r.fraseFavorita1, r.fraseFavorita2, r.fraseFavorita3].filter(Boolean);
  if (frases.length === 0) {
    document.getElementById('ri-frases-grupo').style.display = 'none';
  } else {
    document.getElementById('ri-frases-grupo').style.display = '';
    frasesCont.innerHTML = frases.map(f => `<p class="resena-interna-frase">"${_esc(f)}"</p>`).join('');
  }

  const ratings = {
    romance: r.ratingRomance,
    spice: r.ratingSpice,
    drama: r.ratingDrama,
    estilo: r.ratingEstilo
  };
  const hayRatings = Object.values(ratings).some(v => v);
  if (!hayRatings) {
    document.getElementById('ri-ratings-grupo').style.display = 'none';
  } else {
    document.getElementById('ri-ratings-grupo').style.display = '';
    Object.entries(ratings).forEach(([cat, valor]) => {
      const cont = document.getElementById('ri-rating-' + cat);
      const icono = _ICONOS_RATING_DECORATIVO[cat];
      const v = valor || 0;
      cont.innerHTML = Array.from({ length: 5 }, (_, i) =>
        `<span class="rating-decorativo-btn${i < v ? ' activo' : ''}">${icono}</span>`
      ).join('');
    });
  }

  mostrarModal('modal-resena-interna');
}
