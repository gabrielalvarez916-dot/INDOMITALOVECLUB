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
    idCampana: idCampaña
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

  const visoresHtml = '';

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

  const resultadoPerfil = await llamarBackend('completarDatosPostulacion', {
    email: Sesion.email(),
    pais:              datos.pais,
    ciudad:            datos.ciudad,
    instagram:         datos.instagram,
    tiktok:            datos.tiktok,
    amazon:            datos.amazon,
    descripcionLector: datos.descripcionLector,
    generos:           datos.generos
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
    idCampana: idCampaña,
    aceptaConfidencialidad: true
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'Error al postularse.', 'error');
    return;
  }

  mostrarToast('¡Te postulaste exitosamente! El autor revisará tu perfil.', 'ok');
}

/* ============================================================
   FEED REDISEÑO — Slider hero + Lista vertical + Ticker
   Agregar al final de styles.css
   ============================================================ */

/* ── Slider Hero ──────────────────────────────────────────── */
.feed-slider {
  position: relative;
  overflow: hidden;
  background: var(--crema-suave);
  border-radius: var(--radio-grande);
  margin-bottom: 0;
  min-height: 420px;
}

.slide {
  display: none;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  padding: 48px 48px 48px 56px;
  gap: 32px;
  min-height: 420px;
}

.slide.activo { display: grid; }

/* Info lado izquierdo */
.slide-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slide-genero {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--bordo);
  background: transparent;
  padding: 0;
}

.slide-titulo {
  font-family: var(--fuente-titulo);
  font-size: 52px;
  font-weight: 700;
  color: var(--bordo-oscuro);
  line-height: 1.05;
  letter-spacing: -0.5px;
  margin: 0;
}

.slide-autor {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--gris-texto);
}

.slide-tropes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slide-trope {
  border: 1px solid var(--gris-borde);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--gris-texto);
  background: var(--blanco);
}

.slide-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 0;
  border-top: 1px solid var(--crema-oscura);
  border-bottom: 1px solid var(--crema-oscura);
}

.slide-meta-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--gris-suave);
}

.slide-meta-item strong {
  font-size: 16px;
  font-weight: 700;
  color: var(--bordo-oscuro);
  display: block;
  line-height: 1.2;
}

.slide-meta-icono {
  width: 36px;
  height: 36px;
  border: 1px solid var(--crema-oscura);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: var(--blanco);
}

.slide-acciones {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-postular {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--bordo);
  color: var(--crema);
  border: none;
  padding: 13px 28px;
  border-radius: var(--radio);
  font-family: var(--fuente-texto);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: var(--transicion);
}

.btn-postular:hover {
  background: var(--bordo-oscuro);
  transform: translateY(-1px);
  box-shadow: var(--sombra);
}

/* Portada lado derecho — efecto 3D */
.slide-portada-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 900px;
}

.slide-portada-3d {
  width: 220px;
  height: 310px;
  object-fit: cover;
  border-radius: 4px 10px 10px 4px;
  transform: rotateY(-18deg) rotateX(3deg);
  box-shadow:
    -8px 0 0 rgba(0,0,0,0.08),
    -16px 8px 32px rgba(74, 16, 32, 0.22),
    4px 4px 24px rgba(74, 16, 32, 0.12);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.slide-portada-3d:hover {
  transform: rotateY(-8deg) rotateX(1deg) scale(1.03);
  box-shadow:
    -6px 0 0 rgba(0,0,0,0.06),
    -20px 12px 40px rgba(74, 16, 32, 0.28),
    6px 6px 28px rgba(74, 16, 32, 0.15);
}

/* Navegación del slider */
.slide-nav {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 16px 0 8px;
}

.slide-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--crema-oscura);
  border: none;
  cursor: pointer;
  transition: var(--transicion);
  padding: 0;
}

.slide-dot.activo {
  background: var(--bordo);
  width: 24px;
  border-radius: 4px;
}

.slide-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--blanco);
  border: 1px solid var(--crema-oscura);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  color: var(--bordo);
  transition: var(--transicion);
  z-index: 2;
}

.slide-arrow:hover {
  background: var(--bordo);
  color: var(--crema);
  border-color: var(--bordo);
}

.slide-arrow-prev { left: 12px; }
.slide-arrow-next { right: 12px; }

/* ── Ticker ───────────────────────────────────────────────── */
.feed-ticker {
  background: var(--bordo);
  overflow: hidden;
  padding: 10px 0;
  margin: 0;
}

.feed-ticker-track {
  display: flex;
  gap: 0;
  animation: ticker-scroll 20s linear infinite;
  white-space: nowrap;
  width: max-content;
}

.feed-ticker-track:hover { animation-play-state: paused; }

.feed-ticker-item {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--crema);
  padding: 0 28px;
  opacity: 0.9;
}

.feed-ticker-sep {
  color: rgba(245, 236, 215, 0.35);
  font-size: 14px;
}

@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ── Lista vertical de campañas ───────────────────────────── */
.feed-lista-titulo {
  font-family: var(--fuente-titulo);
  font-size: 22px;
  font-weight: 700;
  color: var(--bordo);
  margin: 32px 0 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--crema-oscura);
}

.campanas-lista-vertical {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.campana-card-horizontal {
  background: var(--blanco);
  border: 1px solid var(--crema-oscura);
  border-radius: var(--radio-grande);
  display: grid;
  grid-template-columns: 130px 1fr;
  overflow: hidden;
  transition: var(--transicion);
  cursor: pointer;
}

.campana-card-horizontal:hover {
  box-shadow: var(--sombra-fuerte);
  transform: translateY(-2px);
  border-color: var(--crema-oscura);
}

.campana-card-horizontal .campana-portada-lista {
  width: 130px;
  height: 175px;
  object-fit: cover;
  display: block;
}

.campana-portada-lista-placeholder {
  width: 130px;
  height: 175px;
  background: linear-gradient(135deg, var(--crema) 0%, var(--crema-oscura) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  flex-shrink: 0;
}

.campana-card-horizontal .campana-info {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.campana-card-horizontal .campana-titulo {
  font-family: var(--fuente-titulo);
  font-size: 20px;
  font-weight: 700;
  color: var(--bordo-oscuro);
  letter-spacing: 0.2px;
  line-height: 1.2;
  margin: 0;
}

.campana-card-horizontal .campana-autor {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--gris-suave);
  margin: 0;
}

.campana-card-horizontal .campana-tropes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0;
}

.campana-card-horizontal .campana-trope {
  border: 1px solid var(--gris-borde);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--gris-texto);
}

.campana-card-horizontal .campana-datos {
  display: flex;
  gap: 24px;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--crema-oscura);
  margin-top: 4px;
  flex-wrap: wrap;
}

.campana-dato {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.campana-dato-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--gris-suave);
}

.campana-dato-valor {
  font-size: 15px;
  font-weight: 700;
  color: var(--bordo-oscuro);
}

.campana-dato-sep {
  width: 1px;
  height: 28px;
  background: var(--crema-oscura);
}

/* ── Responsive feed rediseño ─────────────────────────────── */
@media (max-width: 768px) {
  .slide {
    grid-template-columns: 1fr;
    padding: 32px 24px;
    min-height: auto;
  }

  .slide-portada-wrap { order: -1; }

  .slide-portada-3d {
    width: 160px;
    height: 225px;
    transform: rotateY(-12deg) rotateX(2deg);
  }

  .slide-titulo { font-size: 36px; }

  .campana-card-horizontal {
    grid-template-columns: 100px 1fr;
  }

  .campana-card-horizontal .campana-portada-lista {
    width: 100px;
    height: 140px;
  }

  .campana-portada-lista-placeholder {
    width: 100px;
    height: 140px;
  }

  .campana-card-horizontal .campana-titulo { font-size: 16px; }
  .campana-card-horizontal .campana-datos { gap: 12px; }
}

@media (max-width: 480px) {
  .slide { padding: 24px 16px; }
  .slide-titulo { font-size: 28px; }
  .slide-portada-3d { width: 130px; height: 183px; }
}


