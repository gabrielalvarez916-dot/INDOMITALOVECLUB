// ============================================================
// feed.js — Indómita Love Club
// Feed público de campañas, filtros, detalle, postulación
// ============================================================

function renderizarFeed(campañas) {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  if (campañas.length === 0) {
    // ... código existente
    return;
  }

  // AGREGA ESTO: muestra las cards SIN esperar a que carguen las imágenes
  grid.innerHTML = campañas.map(c => construirCardCampaña(c)).join('');
  
  // Y carga las imágenes de fondo después
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

  // Carga el banner publicitario (no bloquea el resto del feed)
  cargarBannerPublicitario();

  const resultado = await llamarBackend('listarCampanasFeed', { email: Sesion.email() || '' });

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
// CARD DE CAMPAÑA
// ────────────────────────────────────────────────────────────

function construirCardCampaña(c) {
  const rol = Sesion.rol();

  const portadaHtml = c.linkPortada
  ? `<img class="campana-portada-lista" src="${c.linkPortada}" alt="${c.nombreLibro}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="campana-portada-lista-placeholder" style="display:none">📖</div>`
  : `<div class="campana-portada-lista-placeholder">📖</div>`;

  const tropesHtml = c.tropes
    ? c.tropes.split(',').slice(0, 3).map(t =>
        `<span class="campana-trope">${t.trim()}</span>`
      ).join('')
    : '';

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
        ${c.coincidenciaTropes !== undefined ? `
        <div style="margin:6px 0;">
          <span style="font-size:12px; font-weight:600; color:var(--bordo);">
            🎯 ${c.coincidenciaTropes}% coincidencia
          </span>
          <div style="background:var(--crema-oscura); border-radius:20px; height:5px; margin-top:3px;">
            <div style="background:var(--bordo); width:${c.coincidenciaTropes}%; height:5px; border-radius:20px;"></div>
          </div>
        </div>` : ''}
       <div class="campana-tropes">
      ${tropesHtml}</div>
${requisitosHtml}
        ${c.rankingLibro ? `
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
${c.plataformasReseña && c.plataformasReseña.length > 0
  ? `<p style="font-size:13px; margin-top:8px;">
       📋 <strong>Requisitos:</strong> Contar con cuenta activa en ${c.plataformasReseña.join(' y ')}
     </p>`
  : ''}
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
        <p style="font-size:13px;">${c.modalidadLectura === 'descarga' ? '⬇️ <strong>Aclaración:</strong> Se lee con descarga del archivo' : '📖 <strong>Aclaración:</strong> Se lee en el visor (sin descarga)'}</p>
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

  const campaña = _campañasTodas.find(c => c.id === idCampaña);
  if (campaña && campaña.plataformasReseña && campaña.plataformasReseña.length > 0) {
    const usuario = Sesion.obtener();
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
      mostrarToast(`Para postularte necesitás cargar tu perfil de ${faltantes.join(' y ')} en tu perfil.`, 'error');
      return;
    }
  }

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
    mezclar(conPortada);
    const campañasSlider = conPortada.slice(0, 5);
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

    const icoReloj = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const icoSilla = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0Z"/><path d="M6 19v2"/><path d="M18 19v2"/></svg>`;

    return `
      <div class="slide" onclick="verDetalleCampaña('${c.id}')">
        <div class="slide-portada-wrap">
          ${portadaHtml}
        </div>
        <div class="slide-info">
          ${c.genero ? `<span class="slide-genero">${c.genero}</span>` : ''}
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
    const resultado = await llamarBackend('listarBannersActivos', {});
    if (!resultado.ok) return;

    banners = resultado.datos.banners || [];
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

function cargarBannerPublicitario() {
  BannerPublicitario.cargar();
}
function abrirPerfilAutorFeed(event, idAutor) {
  event.stopPropagation();
  event.preventDefault();
  abrirPerfilPublico(idAutor, 'autor');
}
