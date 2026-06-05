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

  contenedor.innerHTML = `
    <div class="stat-card">
      <span class="stat-numero">${s.campañasActivas ?? 0}</span>
      <span class="stat-label">Campañas activas</span>
    </div>
    <div class="stat-card">
     <span class="stat-numero">${s.reseñasRecibidas ?? 0}</span>
<span class="stat-label">Reseñas recibidas</span>
    </div>
    <div class="stat-card">
     <span class="stat-numero">${s.reseñadoresAprobados ?? 0}</span>
<span class="stat-label">Reseñadores aprobados</span>
    </div>
    <div class="stat-card">
      <span class="stat-numero">${s.promedioCalificaciones ? s.promedioCalificaciones.toFixed(1) : '—'}</span>
      <span class="stat-label">Promedio de calificaciones</span>
    </div>
  `;
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
    <div class="campana-card-panel">
      <div class="campana-card-panel-header">
        ${c.linkPortada ? `<img src="${c.linkPortada}" alt="${c.nombreLibro}" class="campana-thumb" onerror="this.style.display='none'" />` : ''}
        <div class="campana-card-panel-info">
          <h3 class="campana-titulo">${c.nombreLibro}</h3>
          <p class="campana-autor">por ${c.nombreAutor}</p>
          ${badgeEstado(c.estado)}
        </div>
      </div>
      <div class="campana-card-panel-stats">
        <span>${c.cuposTotal - c.cuposDisponibles} / ${c.cuposTotal} reseñad@res</span>
        <span>Hasta ${formatearFechaAmigable(c.fechaLimite)}</span>
      </div>
      <div class="barra-progreso">
        <div class="barra-progreso-fill" style="width:${porcentajeOcupacion}%"></div>
      </div>
      <div class="campana-card-panel-acciones">
        <button class="btn-secundario btn-sm" onclick="verPostulacionesCampana('${c.id}', '${c.nombreLibro}')">Ver postulaciones</button>
        <button class="btn-secundario btn-sm" onclick="verReseñasCampana('${c.id}', '${c.nombreLibro}')">Ver reseñas</button>
        <button class="btn-secundario btn-sm btn-peligro" onclick="confirmarCancelarCampana('${c.id}', '${c.nombreLibro}')">Cancelar</button>
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
    <button class="btn-primario btn-sm" onclick="accionPostulacion('${p.idPostulacion}', 'aprobar')">Aprobar</button>
    <button class="btn-secundario btn-sm btn-peligro" onclick="accionPostulacion('${p.idPostulacion}', 'rechazar')">Rechazar</button>
  ` : '';

  const rankingHtml = r?.ranking?.posicion ? `
    <p class="postulacion-ranking">
      🏅 <strong>#${r.ranking.posicion}</strong> en el ranking
      · ${r.ranking.completion?.toFixed(0) ?? '—'}% completion
      · Puntaje: ${r.ranking.puntaje?.toFixed(1) ?? '—'}
    </p>
  ` : '';

  const badgesHtml = badgesRanking(r?.badges);

  return `
    <div class="postulacion-card">
      <div class="postulacion-card-header">
        <div>
          <p class="postulacion-alias"><strong>${r?.alias || p.email}</strong></p>
          <p class="postulacion-meta">${r?.pais || ''}${r?.ciudad ? `, ${r.ciudad}` : ''} · Nivel: ${r?.labelNivel || '—'}</p>
        </div>
        ${badgeEstado(p.estado)}
      </div>
      ${badgesHtml ? `<div style="margin:6px 0; display:flex; gap:6px; flex-wrap:wrap;">${badgesHtml}</div>` : ''}
      ${rankingHtml}
      ${p.descripcionLector ? `<p class="postulacion-descripcion">${truncarTexto(p.descripcionLector, 150)}</p>` : ''}
      <div class="postulacion-redes">
        ${r?.instagram ? `<a href="${r.instagram}" target="_blank" class="red-link">Instagram</a>` : ''}
        ${r?.tiktok    ? `<a href="${r.tiktok}"    target="_blank" class="red-link">TikTok</a>`    : ''}
        ${r?.amazon    ? `<a href="${r.amazon}"    target="_blank" class="red-link">Amazon</a>`    : ''}
      </div>
      ${botonesAccion ? `<div class="postulacion-acciones">${botonesAccion}</div>` : ''}
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
        <p style="font-weight:600;">${r.aliasReseñador || r.emailReseñador}</p>
        <p style="font-size:12px; color:var(--gris-suave);">Entregada: ${formatearFechaAmigable(r.fechaEntrega)}</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin:8px 0;">
          ${r.linkInstagram ? `<a href="${r.linkInstagram}" target="_blank" class="red-link">Instagram</a>` : ''}
          ${r.linkTiktok    ? `<a href="${r.linkTiktok}"    target="_blank" class="red-link">TikTok</a>`    : ''}
          ${r.linkAmazon    ? `<a href="${r.linkAmazon}"    target="_blank" class="red-link">Amazon</a>`    : ''}
          ${r.linkGoodreads ? `<a href="${r.linkGoodreads}" target="_blank" class="red-link">Goodreads</a>` : ''}
        </div>
        ${r.comentarios ? `<p style="font-size:13px; color:var(--gris-suave);">"${r.comentarios}"</p>` : ''}
        ${r.puntuacionAutor
          ? `<p style="font-size:13px;">Tu calificación: ${'★'.repeat(r.puntuacionAutor)}${'☆'.repeat(5 - r.puntuacionAutor)}</p>`
          : `<button class="btn-secundario btn-sm" style="margin-top:8px;" onclick="abrirCalificarReseña('${r.id}', '${r.aliasReseñador || r.emailReseñador}')">Calificar reseña</button>`
        }
      </div>
    `).join('');
  }
}

/**
 * Abre el modal de calificación de una reseña.
 *
 * @param {string} idResena
 * @param {string} nombreReseñador
 */
function abrirCalificarReseña(idResena, nombreReseñador) {
  cerrarModales();

  const inputId     = document.getElementById('calificar-id-resena');
  const labelNombre = document.getElementById('calificar-nombre-resenador');
  const inputPunt   = document.getElementById('calificar-puntuacion');

  if (inputId)     inputId.value     = idResena;
  if (labelNombre) labelNombre.textContent = `Calificando la reseña de ${nombreReseñador}`;
  if (inputPunt)   inputPunt.value   = '';

  // Resetea las estrellas
  document.querySelectorAll('.estrella').forEach(e => e.classList.remove('activa'));
  const label = document.getElementById('estrellas-label');
  if (label) label.textContent = 'Seleccioná una puntuación';

  ocultarMensajes('calificar-error', 'calificar-ok');
  mostrarModal('modal-calificar-resena');
}

/**
 * Envía la calificación de una reseña al backend.
 * Se llama desde el botón del modal.
 */
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

  const datos = {
    nombreLibro:  document.getElementById('nc-nombre-libro')?.value?.trim(),
    nombreAutor:  document.getElementById('nc-nombre-autor')?.value?.trim(),
    sinopsis:     document.getElementById('nc-sinopsis')?.value?.trim(),
    genero:       document.getElementById('nc-genero')?.value?.trim(),
   tropes: obtenerTropesComoTexto('nc'),
   linkPortada:  convertirLinkDrive(document.getElementById('nc-link-portada')?.value?.trim()),
    linkEpub:     document.getElementById('nc-link-epub')?.value?.trim(),
    linkPdf:      document.getElementById('nc-link-pdf')?.value?.trim(),
    linkAmazon:   document.getElementById('nc-link-amazon')?.value?.trim(),
    cuposTotal:   parseInt(document.getElementById('nc-cupos')?.value),
    fechaLimite:  document.getElementById('nc-fecha-limite')?.value?.trim()
  };

 const resultado = await llamarBackend('crearCampana', {
    email:        Sesion.email(),
    nombreLibro:  datos.nombreLibro,
    nombreAutor:  datos.nombreAutor,
    sinopsis:     datos.sinopsis,
    genero:       datos.genero,
    tropes:       datos.tropes,
    linkPortada:  datos.linkPortada,
    linkEpub:     datos.linkEpub,
    linkPdf:      datos.linkPdf,
    linkAmazon:   datos.linkAmazon,
    cuposTotal:   datos.cuposTotal,
    fechaLimite:  datos.fechaLimite
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

/**
 * Carga y muestra la información del plan actual del autor.
 *
 * @param {string} email
 */
async function cargarPlanAutor(email) {
  const contenedor = document.getElementById('autor-plan-info');
  if (!contenedor) return;

  const resultado = await llamarBackend('obtenerPerfil', { email });
  if (!resultado.ok) return;

  const u = resultado.datos.perfil;
  const plan = u.plan || 'free';
  const estadoPlan = u.estadoPlan || '';
  const fechaVenc  = u.fechaVencimientoPlan || '';

  const limites = {
    free:    { campañas: 1,  reseñadores: 10  },
    basic:   { campañas: 3,  reseñadores: 50  },
    premium: { campañas: 5,  reseñadores: 100 }
  };

  const l = limites[plan] || limites.free;

  contenedor.innerHTML = `
    <div class="plan-actual">
      <div class="plan-nombre">
        <span class="badge badge-plan">Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
        ${estadoPlan === 'activo' && fechaVenc ? `<span style="font-size:13px; color:var(--gris-suave);">Válido hasta ${formatearFechaAmigable(fechaVenc)}</span>` : ''}
      </div>
      <div class="plan-limites">
        <p>📋 Hasta <strong>${l.campañas}</strong> campaña${l.campañas > 1 ? 's' : ''} por mes</p>
        <p>👥 Hasta <strong>${l.reseñadores}</strong> reseñad@r${l.reseñadores > 1 ? 'es' : ''} por mes</p>
      </div>
    </div>

    ${plan !== 'premium' ? `
      <div class="plan-upgrade">
        <p class="plan-upgrade-titulo">¿Querés más alcance?</p>
        <div class="planes-opciones">
          ${plan === 'free' ? `
            <div class="plan-opcion">
              <p class="plan-opcion-nombre">Basic</p>
              <p class="plan-opcion-detalle">3 campañas · 50 reseñad@res</p>
              <button class="btn-primario btn-sm" onclick="iniciarPago('basic')">Contratar</button>
            </div>
          ` : ''}
          <div class="plan-opcion">
            <p class="plan-opcion-nombre">Premium</p>
            <p class="plan-opcion-detalle">5 campañas · 100 reseñad@res</p>
            <button class="btn-primario btn-sm" onclick="iniciarPago('premium')">Contratar</button>
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Inicia el flujo de pago para un plan.
 * Pregunta la moneda y redirige a la pasarela externa.
 *
 * @param {string} plan — 'basic' o 'premium'
 */
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
