// ============================================================
// feed.js — Indómita Love Club
// Feed público de campañas, filtros, detalle, postulación
// ============================================================


// ────────────────────────────────────────────────────────────
// VARIABLES GLOBALES DEL FEED
// ────────────────────────────────────────────────────────────

let _campañasTodas = [];


// ────────────────────────────────────────────────────────────
// CARGAR FEED
// ────────────────────────────────────────────────────────────

async function cargarFeed() {
  const grid = document.getElementById('feed-grid');
  const cargando = document.getElementById('feed-cargando');
  const vacio = document.getElementById('feed-vacio');

  toggleElemento('feed-cargando', true);
  toggleElemento('feed-grid', false);
  toggleElemento('feed-vacio', false);
  toggleElemento('feed-lista-titulo', false);
  toggleElemento('feed-ticker', false);

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
  Slider.init();
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
  const generoFiltro = (document.getElementById('filtro-genero')?.value || '').toLowerCase().trim();

  let campañasFiltradas = _campañasTodas;

  if (textoBuscar) {
    campañasFiltradas = campañasFiltradas.filter(c =>
      c.nombreLibro.toLowerCase().includes(textoBuscar) ||
      c.nombreAutor.toLowerCase().includes(textoBuscar)
    );
  }

  if (generoFiltro) {
    campañasFiltradas = campañasFiltradas.filter(c =>
      c.genero && c.genero.toLowerCase().includes(generoFiltro)
    );
  }

  renderizarFeed(campañasFiltradas);
}


// ────────────────────────────────────────────────────────────
// CARD DE CAMPAÑA — imagen simple, sin efecto libro
// ────────────────────────────────────────────────────────────

function construirCardCampaña(c) {
  const rol = Sesion.rol();

  const portadaHtml = c.linkPortada
    ? `<img class="campana-portada-lista" src="${c.linkPortada}" alt="${c.nombreLibro}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="campana-portada-lista-placeholder" style="display:none">📖</div>`
    : `<div class="campana-portada-lista-placeholder">📖</div>`;

  const tropesHtml = c.tropes
    ? c.tropes.split(',').slice(0, 3).map(t =>
        `<span class="campana-trope">${t.trim()}</span>`
      ).join('')
    : '';

  let botonHtml = '';
  if (rol === 'reseñador') {
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
    <div class="campana-card-horizontal" onclick="verDetalleCampaña('${c.id}')">
      ${portadaHtml}
      <div class="campana-info">
        <p class="campana-autor">${c.nombreAutor}</p>
        <h3 class="campana-titulo">${c.nombreLibro}</h3>
        ${c.genero ? `<span class="campana-genero">${c.genero}</span>` : ''}
        ${c.coincidenciaTropes !== undefined ? `
        <div style="margin:8px 0;">
          <span style="font-size:13px; font-weight:600; color:var(--bordo);">
            🎯 ${c.coincidenciaTropes}% de coincidencia con tus tropes
          </span>
          <div style="background:var(--crema-oscura); border-radius:20px; height:6px; margin-top:4px;">
            <div style="background:var(--bordo); width:${c.coincidenciaTropes}%; height:6px; border-radius:20px;"></div>
          </div>
        </div>` : ''}
        <div class="campana-tropes">${tropesHtml}</div>
        ${c.rankingLibro ? `
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0;">
            ${c.rankingLibro.esTop5  ? `<span class="badge badge-top5">🏆 Top 5</span>` : ''}
            ${c.rankingLibro.esTop20 && !c.rankingLibro.esTop5 ? `<span class="badge badge-top20">⭐ Top 20</span>` : ''}
            <span style="font-size:12px; color:var(--gris-suave);">⭐ ${c.rankingLibro.promedio?.toFixed(1) ?? '—'} · ${c.rankingLibro.totalReseñas} reseña${c.rankingLibro.totalReseñas !== 1 ? 's' : ''}</span>
          </div>` : ''}
        <div class="campana-datos">
          <div class="campana-dato">
            <span class="campana-dato-label">${icoSilla}Cupos</span>
            <span class="campana-dato-valor">${c.cuposDisponibles > 0 ? c.cuposDisponibles : '—'}</span>
          </div>
          <div class="campana-dato-sep"></div>
          <div class="campana-dato">
            <span class="campana-dato-label">${icoReloj}Fecha límite</span>
            <span class="campana-dato-valor">${formatearFechaAmigable(c.fechaLimite)}</span>
          </div>
          <div class="campana-dato-sep"></div>
          <div class="campana-dato" style="margin-left:auto;">
            ${botonHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// DETALLE DE CAMPAÑA
// ────────────────────────────────────────────────────────────

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

  const portadaHtml = c.linkPortada
    ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" style="width:100%; max-height:300px; object-fit:cover; border-radius:8px; margin-bottom:20px;" onerror="this.style.display='none'" />`
    : '';

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
      ${Sesion.rol() === 'reseñador' && c.coincidenciaTropes !== undefined ? `
        <div style="margin:12px 0;">
          <p style="font-size:13px; font-weight:600; color:var(--bordo); margin-bottom:4px;">
            🎯 ${c.coincidenciaTropes}% de coincidencia con tus tropes favoritos
          </p>
          <div style="background:var(--crema-oscura); border-radius:20px; height:6px;">
            <div style="background:var(--bordo); width:${c.coincidenciaTropes}%; height:6px; border-radius:20px;"></div>
          </div>
        </div>` : ''}
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--crema-oscura);">
        <p style="font-size:13px;"><strong>Cupos disponibles:</strong> ${c.cuposDisponibles} de ${c.cuposTotal}</p>
        <p style="font-size:13px;"><strong>Fecha límite:</strong> ${formatearFechaAmigable(c.fechaLimite)}</p>
      </div>
      ${amazonHtml}
    `;
  }

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

  const usuarioActual = Sesion.obtener();
  Sesion.guardar({ ...usuarioActual, ...datos });

  cerrarModales();
  await confirmarPostulacion(idCampaña);
}

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


// ────────────────────────────────────────────────────────────
// SLIDER — portada con efecto libro 3D
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

    const campañasSlider = _campañasTodas.slice(0, 5);
    if (campañasSlider.length === 0) return;

    mezclar(campañasSlider);

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
      ? `<div class="slide-libro-3d">
           <img class="slide-libro-tapa" src="${c.linkPortada}" alt="${c.nombreLibro}" />
           <div class="slide-libro-lomo"></div>
           <div class="slide-libro-paginas"></div>
           <div class="slide-libro-sombra"></div>
         </div>`
      : `<div class="slide-libro-3d">
           <div class="slide-libro-tapa" style="background:var(--crema-oscura);display:flex;align-items:center;justify-content:center;font-size:64px;">📖</div>
           <div class="slide-libro-lomo" style="--portada-url: url('${c.linkPortada}')"></div>
           <div class="slide-libro-paginas"></div>
           <div class="slide-libro-sombra"></div>
         </div>`;

    const tropesHtml = c.tropes
      ? c.tropes.split(',').slice(0, 4).map(t =>
          `<span class="slide-trope">${t.trim()}</span>`
        ).join('')
      : '';

    let botonHtml = '';
    if (rol === 'reseñador' && c.cuposDisponibles > 0) {
      botonHtml = `<button class="btn-postular" onclick="event.stopPropagation(); iniciarPostulacion('${c.id}')">Postularme →</button>`;
    } else if (!rol) {
      botonHtml = `<button class="btn-postular" onclick="event.stopPropagation(); mostrarSeccion('login')">Ingresá para postularte →</button>`;
    }

    const icoReloj = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const icoSilla = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0Z"/><path d="M6 19v2"/><path d="M18 19v2"/></svg>`;

    return `
      <div class="slide" onclick="verDetalleCampaña('${c.id}')">
        <div class="slide-info">
          ${c.genero ? `<span class="slide-genero">${c.genero}</span>` : ''}
          <h2 class="slide-titulo">${c.nombreLibro}</h2>
          <p class="slide-autor">por ${c.nombreAutor}</p>
          ${tropesHtml ? `<div class="slide-tropes">${tropesHtml}</div>` : ''}
          <div class="slide-meta">
            <div class="slide-meta-item">
              <div class="slide-meta-icono">${icoReloj}</div>
              <div>
                <strong>${formatearFechaAmigable(c.fechaLimite)}</strong>
                fecha límite
              </div>
            </div>
            <div class="slide-meta-item">
              <div class="slide-meta-icono">${icoSilla}</div>
              <div>
                <strong>${c.cuposDisponibles > 0 ? c.cuposDisponibles : 'Sin'} cupos</strong>
                disponibles
              </div>
            </div>
          </div>
          <div class="slide-acciones">${botonHtml}</div>
        </div>
        <div class="slide-portada-wrap">
          ${portadaHtml}
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
