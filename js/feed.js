// ============================================================
// feed.js — Indómita Love Club
// Feed público de campañas, filtros, detalle, postulación
// ============================================================


// ────────────────────────────────────────────────────────────
// VARIABLES GLOBALES DEL FEED
// ────────────────────────────────────────────────────────────

// Guarda todas las campañas cargadas para filtrar sin volver a llamar al backend
let _campañasTodas = [];


// ────────────────────────────────────────────────────────────
// CARGAR FEED
// ────────────────────────────────────────────────────────────

/**
 * Carga las campañas activas desde el backend y las muestra en el feed.
 * Se llama automáticamente cuando se muestra la sección feed.
 */
async function cargarFeed() {
  const grid = document.getElementById('feed-grid');
  const cargando = document.getElementById('feed-cargando');
  const vacio = document.getElementById('feed-vacio');

  // Muestra spinner, oculta grid y estado vacío
  toggleElemento('feed-cargando', true);
  toggleElemento('feed-grid', false);
  toggleElemento('feed-vacio', false);

  const resultado = await llamarBackend('listarCampanasFeed', {});

  toggleElemento('feed-cargando', false);

  if (!resultado.ok) {
    toggleElemento('feed-vacio', true);
    if (vacio) {
      vacio.innerHTML = `
        <p class="estado-vacio-icono">⚠️</p>
        <p class="estado-vacio-texto">Error al cargar campañas</p>
        <p class="estado-vacio-sub">${resultado.mensaje}</p>
        <button class="btn-secundario" onclick="cargarFeed()" style="margin-top:16px;">Reintentar</button>
      `;
    }
    return;
  }

  _campañasTodas = resultado.datos.campañas || [];

  if (_campañasTodas.length === 0) {
    toggleElemento('feed-vacio', true);
    return;
  }

  renderizarFeed(_campañasTodas);
}

/**
 * Renderiza las cards de campaña en el grid.
 *
 * @param {Array} campañas — array de objetos de campaña
 */
function renderizarFeed(campañas) {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  if (campañas.length === 0) {
    toggleElemento('feed-grid', false);
    toggleElemento('feed-vacio', true);
    return;
  }

  grid.innerHTML = campañas.map(c => construirCardCampaña(c)).join('');
  toggleElemento('feed-grid', true, 'grid');
  toggleElemento('feed-vacio', false);
}


// ────────────────────────────────────────────────────────────
// FILTROS
// ────────────────────────────────────────────────────────────

/**
 * Filtra las campañas por texto y género.
 * Se llama en tiempo real mientras el usuario escribe o cambia el filtro.
 */
function filtrarFeed() {
  const textoBuscar = (document.getElementById('filtro-buscar')?.value || '').toLowerCase().trim();
  const generoFiltro = (document.getElementById('filtro-genero')?.value || '').toLowerCase().trim();

  let campañasFiltradas = _campañasTodas;

  // Filtra por texto (busca en título y autor)
  if (textoBuscar) {
    campañasFiltradas = campañasFiltradas.filter(c =>
      c.nombreLibro.toLowerCase().includes(textoBuscar) ||
      c.nombreAutor.toLowerCase().includes(textoBuscar)
    );
  }

  // Filtra por género
  if (generoFiltro) {
    campañasFiltradas = campañasFiltradas.filter(c =>
      c.genero && c.genero.toLowerCase().includes(generoFiltro)
    );
  }

  renderizarFeed(campañasFiltradas);
}


// ────────────────────────────────────────────────────────────
// CARD DE CAMPAÑA
// ────────────────────────────────────────────────────────────

/**
 * Construye el HTML de una card de campaña para el feed.
 *
 * @param {Object} c — datos de la campaña
 * @returns {string} HTML de la card
 */
function construirCardCampaña(c) {
  const cuposTexto = c.cuposDisponibles > 0
    ? `<span>${c.cuposDisponibles}</span> cupos disponibles`
    : `<span style="color:#C0392B">Sin cupos</span>`;

  const portadaHtml = c.linkPortada
    ? `<img class="campana-portada" src="${c.linkPortada}" alt="${c.nombreLibro}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="campana-portada-placeholder" style="display:none">📖</div>`
    : `<div class="campana-portada-placeholder">📖</div>`;

  const generoHtml = c.genero
    ? `<span class="campana-genero">${c.genero}</span>`
    : '';

  const tropesHtml = c.tropes
    ? `<p class="campana-sinopsis" style="font-size:12px; color:var(--gris-suave); margin-bottom:8px;">${truncarTexto(c.tropes, 60)}</p>`
    : '';

  // Botón postularse solo para reseñadores logueados
  const rol = Sesion.rol();
  let botonHtml = '';

  if (rol === 'reseñador') {
    if (c.cuposDisponibles > 0) {
      botonHtml = `<button class="btn-primario btn-sm" onclick="event.stopPropagation(); iniciarPostulacion('${c.id}')">Postularme</button>`;
    } else {
      botonHtml = `<button class="btn-secundario btn-sm" disabled style="opacity:0.5; cursor:not-allowed;">Sin cupos</button>`;
    }
  } else if (!rol) {
    // No logueado: muestra botón que invita a ingresar
    botonHtml = `<button class="btn-secundario btn-sm" onclick="event.stopPropagation(); mostrarSeccion('login')">Ingresá para postularte</button>`;
  }

  return `
    <div class="campana-card" onclick="verDetalleCampaña('${c.id}')">
      ${portadaHtml}
      <div class="campana-body">
        ${generoHtml}
        <h3 class="campana-titulo">${c.nombreLibro}</h3>
        <p class="campana-autor">por ${c.nombreAutor}</p>
        <p class="campana-sinopsis">${truncarTexto(c.sinopsis, 120)}</p>
        ${tropesHtml}
        <div class="campana-footer">
          <span class="campana-cupos">${cuposTexto}</span>
          <span style="font-size:11px; color:var(--gris-suave)">Hasta ${formatearFechaAmigable(c.fechaLimite)}</span>
        </div>
        ${botonHtml ? `<div style="margin-top:12px;">${botonHtml}</div>` : ''}
      </div>
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// DETALLE DE CAMPAÑA
// ────────────────────────────────────────────────────────────

/**
 * Abre el modal de detalle de una campaña.
 * Llama al backend para obtener el detalle completo.
 * Si el reseñador está aprobado, también muestra links de EPUB y PDF.
 *
 * @param {string} idCampaña
 */
async function verDetalleCampaña(idCampaña) {
  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = 'Cargando...';
  if (body) body.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
  if (footer) footer.innerHTML = '';

  const email = Sesion.email();
  const resultado = await llamarBackend('obtenerDetalleCampana', {
    email: email || '',
    idCampaña
  });

  if (!resultado.ok) {
    if (body) body.innerHTML = `<p class="mensaje-error">${resultado.mensaje}</p>`;
    return;
  }

  const c = resultado.datos.campaña;
  if (titulo) titulo.textContent = c.nombreLibro;

  // Construye el cuerpo del modal
  const portadaHtml = c.linkPortada
    ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" style="width:100%; max-height:300px; object-fit:cover; border-radius:8px; margin-bottom:20px;" onerror="this.style.display='none'" />`
    : '';

  const visoresHtml = (c.linkEpub || c.linkPdf) ? `
    <div style="display:flex; gap:10px; margin:16px 0; flex-wrap:wrap;">
      ${c.linkEpub ? `<button class="btn-secundario btn-sm" onclick="abrirVisorEpub('${c.linkEpub}', '${c.nombreLibro}')">📖 Leer EPUB</button>` : ''}
      ${c.linkPdf ? `<button class="btn-secundario btn-sm" onclick="abrirVisorPdf('${c.linkPdf}', '${c.nombreLibro}')">📄 Leer PDF</button>` : ''}
    </div>
  ` : '';

  const amazonHtml = c.linkAmazon
    ? `<a href="${c.linkAmazon}" target="_blank" class="btn-secundario btn-sm" style="display:inline-block; margin-top:8px;">🛒 Ver en Amazon</a>`
    : '';

  if (body) {
    body.innerHTML = `
      ${portadaHtml}
      <p style="font-size:13px; color:var(--gris-suave); margin-bottom:4px;">por ${c.nombreAutor}</p>
      ${c.genero ? `<span class="campana-genero">${c.genero}</span>` : ''}
      <p style="margin:16px 0; font-size:14px; line-height:1.6;">${c.sinopsis}</p>
      ${c.tropes ? `<p style="font-size:13px; color:var(--gris-suave);"><strong>Tropes:</strong> ${c.tropes}</p>` : ''}
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--crema-oscura);">
        <p style="font-size:13px;"><strong>Cupos disponibles:</strong> ${c.cuposDisponibles} de ${c.cuposTotal}</p>
        <p style="font-size:13px;"><strong>Fecha límite:</strong> ${formatearFechaAmigable(c.fechaLimite)}</p>
      </div>
      ${visoresHtml}
      ${amazonHtml}
    `;
  }

  // Footer con botón postularse
  const rol = Sesion.rol();
  if (footer) {
    if (rol === 'reseñador' && c.cuposDisponibles > 0) {
      footer.innerHTML = `<button class="btn-primario" onclick="cerrarModales(); iniciarPostulacion('${c.id}')">Postularme a esta campaña</button>`;
    } else if (!rol) {
      footer.innerHTML = `<button class="btn-primario" onclick="cerrarModales(); mostrarSeccion('login')">Ingresá para postularte</button>`;
    }
  }
}


// ────────────────────────────────────────────────────────────
// POSTULACIÓN
// ────────────────────────────────────────────────────────────

/**
 * Inicia el proceso de postulación a una campaña.
 * Si el reseñador ya tiene datos completos, abre el modal de confirmación.
 * Si es la primera vez, abre el modal para completar el perfil.
 *
 * @param {string} idCampaña
 */
async function iniciarPostulacion(idCampaña) {
  const email = Sesion.email();
  if (!email) {
    mostrarSeccion('login');
    return;
  }

  const usuario = Sesion.obtener();

  // Verifica si ya tiene datos de perfil completos
  if (!usuario.pais || !usuario.ciudad) {
    // Primera postulación: pide completar perfil
    const inputCampaña = document.getElementById('completar-id-campana');
    if (inputCampaña) inputCampaña.value = idCampaña;
    mostrarModal('modal-completar-perfil');
  } else {
    // Ya tiene perfil: va directo al modal de postulación
    await confirmarPostulacion(idCampaña);
  }
}

/**
 * Guarda el perfil del reseñador y luego se postula.
 * Se llama desde el formulario del modal completar-perfil.
 *
 * @param {Event} event
 */
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

  // Guarda perfil en backend
  const resultadoPerfil = await llamarBackend('completarDatosPostulacion', {
    email: Sesion.email(),
    datos
  });

  if (!resultadoPerfil.ok) {
    mostrarMensajeError('completar-error', resultadoPerfil.mensaje);
    return;
  }

  // Actualiza sesión local con los nuevos datos
  const usuarioActual = Sesion.obtener();
  Sesion.guardar({ ...usuarioActual, ...datos });

  cerrarModales();
  await confirmarPostulacion(idCampaña);
}

/**
 * Envía la postulación al backend.
 * Muestra confirmación o error.
 *
 * @param {string} idCampaña
 */
async function confirmarPostulacion(idCampaña) {
  const email = Sesion.email();

  const resultado = await llamarBackend('postularse', {
    email,
    idCampaña,
    aceptaConfidencialidad: true
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al postularse.', 'error');
    return;
  }

  mostrarToast('¡Te postulaste exitosamente! El autor revisará tu perfil.', 'ok');
}
