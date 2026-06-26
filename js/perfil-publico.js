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

  // Muestra el modal con estado de carga inmediatamente
  _mostrarModalPerfilPublico();
  _estadoPerfilPublico('cargando');

  try {
    if (rol === 'autor') {
      await _cargarPerfilAutor(id);
    } else if (rol === 'reseñador') {
      await _cargarPerfilReseñador(id);
    }
  } catch (e) {
    _estadoPerfilPublico('error');
  }
}


// ────────────────────────────────────────────────────────────
// CARGA DE PERFIL AUTOR
// ────────────────────────────────────────────────────────────

async function _cargarPerfilAutor(idAutor) {
  const [resPerfil, resLibros, resCampañas] = await Promise.all([
    llamarBackend('obtenerPerfilPublicoAutor',   { idAutor }),
    llamarBackend('listarLibrosPerfilPublico',    { idAutor }),
    llamarBackend('listarCampañasActivasPorAutor', { idAutor }),
  ]);

  if (!resPerfil.ok) {
    _estadoPerfilPublico('error');
    return;
  }

  const perfil   = resPerfil.datos.perfil;
  const libros   = resLibros.ok   ? (resLibros.datos.libros   || []) : [];
  const campañas = resCampañas.ok ? (resCampañas.datos.campañas || []) : [];

  _pintarPerfilAutor(perfil, libros, campañas);
  _estadoPerfilPublico('autor');
}


// ────────────────────────────────────────────────────────────
// CARGA DE PERFIL RESEÑADOR
// ────────────────────────────────────────────────────────────

async function _cargarPerfilReseñador(idReseñador) {
  const [resPerfil, resPostulaciones] = await Promise.all([
    llamarBackend('obtenerPerfilReseñador',               { idReseñador }),
    llamarBackend('listarPostulacionesPublicasReseñador', { idReseñador }),
  ]);

  if (!resPerfil.ok) {
    _estadoPerfilPublico('error');
    return;
  }

  const perfil        = resPerfil.datos.perfil;
  const postulaciones = resPostulaciones.ok
    ? (resPostulaciones.datos.postulaciones || [])
    : [];

  _pintarPerfilReseñador(perfil, postulaciones);
  _estadoPerfilPublico('reseñador');
}


// ────────────────────────────────────────────────────────────
// PINTAR: PERFIL AUTOR
// ────────────────────────────────────────────────────────────

function _pintarPerfilAutor(perfil, libros, campañas) {
  // Cabecera común
  _pintarCabeceraComun(perfil, '-r');

  // Libros
  const librosCont = document.getElementById('pp-autor-libros');
  if (librosCont) {
    if (libros.length === 0) {
      librosCont.innerHTML = '<p class="pp-vacio">Sin libros cargados aún.</p>';
    } else {
      librosCont.innerHTML = libros.map(libro => {
        const badge = libro.cantidadReseñas >= 5
          ? '<span class="pp-badge pp-badge-destacado">⭐ +5 reseñas</span>'
          : '';
        return `
          <div class="pp-libro-card">
            ${libro.portada ? `<img src="${libro.portada}" alt="${_esc(libro.titulo)}" class="pp-libro-portada" />` : '<div class="pp-libro-portada pp-portada-placeholder">📖</div>'}
            <div class="pp-libro-info">
              <p class="pp-libro-titulo">${_esc(libro.titulo)} ${badge}</p>
              ${libro.genero ? `<p class="pp-libro-genero">${_esc(libro.genero)}</p>` : ''}
              ${libro.amazon ? `<a href="${_esc(libro.amazon)}" target="_blank" class="pp-link-externo">Ver en Amazon →</a>` : ''}
            </div>
          </div>`;
      }).join('');
    }
  }

  // Campañas activas
  const campañasCont = document.getElementById('pp-autor-campanas');
  if (campañasCont) {
    if (campañas.length === 0) {
      campañasCont.innerHTML = '<p class="pp-vacio">Sin campañas activas en este momento.</p>';
    } else {
      campañasCont.innerHTML = campañas.map(c => `
        <div class="pp-campana-card">
          <p class="pp-campana-titulo">${_esc(c.nombreLibro)}</p>
          ${c.fechaLimite ? `<p class="pp-campana-fecha">Fecha límite: ${_esc(c.fechaLimite)}</p>` : ''}
          <button class="btn-secundario btn-sm" onclick="verDetalleCampana('${_esc(c.id)}'); cerrarModalPerfilPublico();">
            Ver campaña
          </button>
        </div>`).join('');
    }
  }
}


// ────────────────────────────────────────────────────────────
// PINTAR: PERFIL RESEÑADOR
// ────────────────────────────────────────────────────────────

function _pintarPerfilReseñador(perfil, postulaciones) {
  // Cabecera común
  _pintarCabeceraComun(perfil);

  // Badge de nivel (siempre visible)
  const nivelCont = document.getElementById('pp-reseñador-nivel');
  if (nivelCont) {
    const nivel = perfil.nivel || perfil.nivelActual || '—';
    nivelCont.innerHTML = `<span class="pp-badge pp-badge-nivel">📚 ${_esc(String(nivel))}</span>`;
  }

  // Badge ranking + completion (solo si ≥5 reseñas entregadas)
  const rankingCont = document.getElementById('pp-reseñador-ranking');
  if (rankingCont) {
    const totalResenas = perfil.totalReseñas || perfil.reseñasEntregadas || 0;
    if (totalResenas >= 5) {
      const ranking    = perfil.rankingTexto || perfil.ranking || '';
      const completion = perfil.completionRate != null
        ? Math.round(perfil.completionRate) + '%'
        : null;
      rankingCont.innerHTML = `
        ${ranking    ? `<span class="pp-badge pp-badge-ranking">🏆 ${_esc(String(ranking))}</span>` : ''}
        ${completion ? `<span class="pp-badge pp-badge-completion">✅ ${completion} completado</span>` : ''}
      `;
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
        }[p.estado] || 'pp-estado-pendiente';

        return `
          <div class="pp-post-fila">
            <span class="pp-post-libro">${_esc(p.nombreLibro || p.tituloLibro || '—')}</span>
            <span class="pp-estado ${estadoClase}">${_esc(p.estado || '—')}</span>
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
    avatarEl.src = perfil.fotoPerfil || '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK';
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
