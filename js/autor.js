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
let _reseñasCampanaActual = []; // cache de reseñas mostradas en el modal "Ver reseñas"

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
    idGenero:          c.id_genero,
    idSubgenero:       c.id_subgenero,
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
    cargarBibliotecaPanel(user.id),
    cargarCreditosAutor(user.id)
  ]);
}


// ────────────────────────────────────────────────────────────
// CRÉDITOS (por bajo rendimiento — se descuentan en Impulsar campaña)
// ────────────────────────────────────────────────────────────

/**
 * Muestra, chico y en una sola línea arriba de las cards de campañas activas,
 * el total de créditos vigentes del autor (otorgados por bajo rendimiento).
 * No se muestra en ningún otro lado del panel.
 */
async function cargarCreditosAutor(idUsuario) {
  const contenedor = document.getElementById('autor-creditos-banner');
  if (!contenedor) return;

  const { data, error } = await supabaseClient
    .from('creditos_autor')
    .select('monto, monto_usado, fecha_vencimiento')
    .eq('id_usuario_autor', idUsuario)
    .eq('estado', 'vigente')
    .order('fecha_vencimiento', { ascending: true });

  if (error || !data || data.length === 0) {
    contenedor.innerHTML = '';
    return;
  }

  const disponibles = data.reduce((acc, c) => acc + (Number(c.monto) - Number(c.monto_usado || 0)), 0);
  if (disponibles <= 0) {
    contenedor.innerHTML = '';
    return;
  }

  const proximoVencimiento = formatearFechaAmigable(data[0].fecha_vencimiento);

  contenedor.innerHTML = `
    <div class="creditos-autor-banner">
      🎁 Tenés <strong>${Math.round(disponibles).toLocaleString('es-AR')} créditos</strong> disponibles · vencen el ${proximoVencimiento}
    </div>
  `;
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
    { icono: '📣', valor: s.campañasActivas ?? 0, label: 'Campañas activas', variante: 'bordo' },
    { icono: '⭐', valor: s.reseñasRecibidas ?? 0, label: 'Reseñas recibidas', variante: 'dorado' },
    { icono: '👥', valor: s.reseñadoresAprobados ?? 0, label: 'Reseñadores aprobados', variante: 'rosa' },
    { icono: '📊', valor: s.promedioCalificaciones ? s.promedioCalificaciones.toFixed(1) : '—', label: 'Promedio de calificaciones', variante: 'crema' }
  ];

  contenedor.innerHTML = stats.map(s => `
    <div class="stat-card-v2 stat-card-v2--${s.variante}">
      <div class="stat-card-v2-header">${s.label}</div>
      <div class="stat-card-v2-body">
        <div class="stat-card-v2-icono">${s.icono}</div>
        <p class="stat-card-v2-numero">${s.valor}</p>
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

  // Se mantiene en "Activas" mientras estado='activa' O todavía tenga
  // seguimiento pendiente (postulación aprobada, sin reseña, con plazo
  // vigente) — así no desaparece del panel apenas cierra el feed, aunque
  // sigan quedando reseñadores leyendo dentro de su propio plazo.
  const { data, error } = await supabaseClient.rpc('obtener_campanas_activas_autor');

  if (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  _campañasAutor = (data || []).map(_mapCampana);

  if (_campañasAutor.length > 0) {
    const ids = _campañasAutor.map(c => c.id);

    const { data: tropesRows } = await supabaseClient
      .from('campana_tropes')
      .select('id_campana, tropes ( id, nombre )')
      .in('id_campana', ids);

    const tropesPorCampana = {};
    (tropesRows || []).forEach(row => {
      if (!tropesPorCampana[row.id_campana]) tropesPorCampana[row.id_campana] = [];
      if (row.tropes) tropesPorCampana[row.id_campana].push({ id: row.tropes.id, nombre: row.tropes.nombre });
    });

    const { data: subgenerosRows } = await supabaseClient
      .from('campana_subgeneros')
      .select('id_campana, id_subgenero')
      .in('id_campana', ids);

    const subgenerosPorCampana = {};
    (subgenerosRows || []).forEach(row => {
      if (!subgenerosPorCampana[row.id_campana]) subgenerosPorCampana[row.id_campana] = [];
      subgenerosPorCampana[row.id_campana].push(row.id_subgenero);
    });

    _campañasAutor.forEach(c => {
      c.tropesCatalogo = tropesPorCampana[c.id] || [];
      c.idsSubgeneros = subgenerosPorCampana[c.id] || [];
    });

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

    const { data: impulsosRows } = await supabaseClient
      .from('impulsos_campana')
      .select('id_campana, estado')
      .in('id_campana', ids);

    _campañasAutor.forEach(c => {
      c.impulso = (impulsosRows || []).find(i => i.id_campana === c.id) || null;
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
 * Determina si una campaña todavía está dentro de la ventana permitida
 * para ser cancelada por el autor (5 días desde su creación).
 *
 * @param {string} creadoEn — timestamp ISO de creación de la campaña
 * @returns {boolean}
 */
function _puedeCancelarCampana(creadoEn) {
  if (!creadoEn) return true;
  const limiteMs = 5 * 24 * 60 * 60 * 1000; // 5 días
  return (Date.now() - new Date(creadoEn).getTime()) <= limiteMs;
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
          ${c.estado === 'activa' ? `
          <button class="btn-secundario btn-sm btn-full" onclick="verPostulacionesCampana('${c.id}', '${c.nombreLibro}')">Ver postulaciones</button>
          <button class="btn-secundario btn-sm btn-full" onclick="verSeguimientoLectura('${c.id}', '${c.nombreLibro}')">👀 Seguimiento de reseñadores</button>
          <button class="btn-secundario btn-sm btn-full" onclick="verReseñasCampana('${c.id}', '${c.nombreLibro}')">Ver reseñas</button>
          ${botonImpulsarCampanaHtml(c)}
          <button class="btn-secundario btn-sm btn-full" onclick="compartirCampana('${c.id}', '${c.nombreLibro}')">📤 Compartir</button>
          <button class="btn-secundario btn-sm btn-full" onclick="abrirEditarCampana('${c.id}')">✏️ Editar campaña</button>
          ${_puedeCancelarCampana(c.creadoEn)
            ? `<button class="btn-secundario btn-sm btn-full btn-peligro" onclick="confirmarCancelarCampana('${c.id}', '${c.nombreLibro}')">Cancelar campaña</button>`
            : ''}
          ` : `
          <button class="btn-secundario btn-sm btn-full" onclick="verSeguimientoLectura('${c.id}', '${c.nombreLibro}')">👀 Seguimiento de reseñadores</button>
          <button class="btn-secundario btn-sm btn-full" onclick="verReseñasCampana('${c.id}', '${c.nombreLibro}')">Ver reseñas</button>
          `}
        </div>
      </div>
    </div>
  `;
}

/**
 * Arma el botón (o badge de estado) de "Impulsar campaña" para una card.
 * Solo se puede impulsar una vez por campaña.
 */
function botonImpulsarCampanaHtml(c) {
  if (!c.impulso) {
    return `<button class="btn-primario btn-sm btn-full btn-impulsar-campana" onclick="abrirModalImpulsarCampana('${c.id}')">🚀 Impulsar campaña</button>`;
  }
  const textos = {
    pendiente: '🚀 Impulso pendiente de pago',
    pagado: '🚀 Impulso activo',
    rechazado: 'Impulso no aprobado'
  };
  return `<span class="badge-impulso-estado">${textos[c.impulso.estado] || 'Impulso solicitado'}</span>`;
}

/**
 * Abre el modal explicativo de "Impulsar campaña" (reutiliza el modal
 * genérico modal-detalle-campana) con el texto comercial, el precio
 * según configuración y el descuento por créditos disponibles.
 */
async function abrirModalImpulsarCampana(idCampana) {
  const campana = _campañasAutor.find(c => c.id === idCampana);
  if (!campana || campana.impulso) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  mostrarModal('modal-detalle-campana');
  const titulo = document.getElementById('modal-detalle-titulo');
  const body = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');
  if (titulo) titulo.textContent = `Impulsar campaña — ${campana.nombreLibro}`;
  if (footer) footer.innerHTML = '';
  if (body) body.innerHTML = `<p class="form-hint">Cargando...</p>`;

  const { data: config } = await supabaseClient
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['IMPULSO_PRECIO_ARS', 'IMPULSO_PRECIO_USD', 'IMPULSO_DURACION_DIAS_SLIDER', 'IMPULSO_COMPATIBILIDAD_MINIMA']);
  const val = (clave, fallback) => (config || []).find(c => c.clave === clave)?.valor ?? fallback;
  const precioArs = parseInt(val('IMPULSO_PRECIO_ARS', '6000'));
  const precioUsd = parseFloat(val('IMPULSO_PRECIO_USD', '4'));
  const dias = val('IMPULSO_DURACION_DIAS_SLIDER', '7');
  const compatMin = val('IMPULSO_COMPATIBILIDAD_MINIMA', '70');

  const creditos = await _obtenerCreditosDisponiblesAutor(user.id);
  const creditosTotales = creditos.reduce((acc, c) => acc + c.disponible, 0);

  if (body) body.innerHTML = `
    <div class="impulsar-campana-intro">
      <p style="margin-bottom:10px;">Dale a <strong>${campana.nombreLibro}</strong> la visibilidad que se merece. <strong>Impulsar campaña</strong> es la forma más rápida de completar tus cupos, y hace tres cosas por vos en un solo paso:</p>
      <ul style="margin:0 0 14px 0; padding-left:20px; line-height:1.6;">
        <li>📌 <strong>Portada destacada:</strong> tu libro pasa al slider principal de la app durante ${dias} días, lo primero que ven los reseñadores al entrar.</li>
        <li>📣 <strong>Difusión en redes:</strong> publicitamos tu campaña una vez en las redes oficiales de Indómita Love Club.</li>
        <li>💌 <strong>Notificación directa:</strong> avisamos a los reseñadores con mejor compatibilidad con tu libro (${compatMin}% o más) — tantos como cupos libres tengas — para que se postulen enseguida.</li>
      </ul>
      <p class="form-hint" style="margin-bottom:14px;">Cada campaña puede impulsarse una única vez, así que elegí bien el momento.</p>
      <div class="creditos-autor-banner" style="margin-bottom:10px;">
        Precio del impulso: <strong>$${precioArs.toLocaleString('es-AR')} ARS</strong> (autores nacionales) o <strong>USD ${precioUsd}</strong> (internacionales)
      </div>
      ${creditosTotales > 0
        ? `<div class="creditos-autor-banner">🎁 Tenés <strong>${Math.round(creditosTotales).toLocaleString('es-AR')} créditos</strong> disponibles — se descuentan automáticamente del precio.</div>`
        : ''}
      <p class="form-hint" style="margin-top:10px;">⏳ El impulso no se activa al instante: en breve te enviamos el link de pago para coordinarlo y, una vez confirmado, lo activamos.</p>
      <div id="impulsar-error" class="mensaje-error" style="display:none; margin-top:10px;"></div>
      <div id="impulsar-ok" class="mensaje-ok" style="display:none; margin-top:10px;"></div>
    </div>
  `;
  if (footer) footer.innerHTML = `
    <button type="button" class="btn-secundario" onclick="cerrarModales()">Cancelar</button>
    <button type="button" class="btn-primario" id="btn-confirmar-impulso" onclick="confirmarImpulsarCampana('${idCampana}', ${precioArs}, ${precioUsd})">Confirmar impulso</button>
  `;
}

/**
 * Suma los créditos vigentes (no vencidos) de un autor, con su saldo disponible cada uno.
 */
async function _obtenerCreditosDisponiblesAutor(idUsuario) {
  const { data } = await supabaseClient
    .from('creditos_autor')
    .select('id, monto, monto_usado, fecha_vencimiento')
    .eq('id_usuario_autor', idUsuario)
    .eq('estado', 'vigente')
    .order('fecha_vencimiento', { ascending: true });

  return (data || [])
    .map(c => ({
      id: c.id,
      monto: Number(c.monto),
      montoUsado: Number(c.monto_usado || 0),
      disponible: Number(c.monto) - Number(c.monto_usado || 0)
    }))
    .filter(c => c.disponible > 0);
}

/**
 * Confirma el impulso: pregunta la moneda (mismo patrón que la suscripción de plan),
 * aplica el descuento de créditos disponibles y deja la solicitud pendiente de pago
 * para que el admin la active manualmente desde el panel.
 */
async function confirmarImpulsarCampana(idCampana, precioArs, precioUsd) {
  const btn = document.getElementById('btn-confirmar-impulso');
  ocultarMensajes('impulsar-error', 'impulsar-ok');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const moneda = confirm('¿Pagás desde Argentina?\n\nAceptar = Pesos argentinos (ARS)\nCancelar = Dólares (USD)')
    ? 'ARS' : 'USD';

  if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

  try {
    const { data: config } = await supabaseClient
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['VALOR_CREDITO_ARS', 'VALOR_CREDITO_USD']);
    const val = (clave, fallback) => (config || []).find(c => c.clave === clave)?.valor ?? fallback;
    const valorCredito = parseFloat(val(moneda === 'ARS' ? 'VALOR_CREDITO_ARS' : 'VALOR_CREDITO_USD', moneda === 'ARS' ? '1' : '0.67'));

    const precioLista = moneda === 'ARS' ? precioArs : precioUsd;
    const creditosDisponibles = await _obtenerCreditosDisponiblesAutor(user.id);
    const totalDisponible = creditosDisponibles.reduce((acc, c) => acc + c.disponible, 0);

    const creditosNecesarios = Math.min(totalDisponible, precioLista / valorCredito);
    const descuento = creditosNecesarios * valorCredito;
    const montoAPagar = Math.max(0, Math.round((precioLista - descuento) * 100) / 100);

    // Descuenta los créditos consumidos (FIFO por vencimiento más próximo).
    let restante = creditosNecesarios;
    for (const c of creditosDisponibles) {
      if (restante <= 0) break;
      const usar = Math.min(c.disponible, restante);
      restante -= usar;
      const nuevoMontoUsado = c.montoUsado + usar;
      await supabaseClient
        .from('creditos_autor')
        .update({
          monto_usado: nuevoMontoUsado,
          estado: nuevoMontoUsado >= c.monto ? 'usado' : 'vigente'
        })
        .eq('id', c.id);
    }

    const { data: impulsoCreado, error } = await supabaseClient
      .from('impulsos_campana')
      .insert({
        id_campana: idCampana,
        id_usuario_autor: user.id,
        moneda,
        precio_lista: precioLista,
        creditos_aplicados: Math.round(creditosNecesarios * 100) / 100,
        monto_a_pagar: montoAPagar,
        estado: 'pendiente'
      })
      .select('id')
      .single();

    if (error) throw error;

    const ok = document.getElementById('impulsar-ok');

    // Si es ARS y queda un saldo a pagar, la Edge Function genera el link
    // de Mercado Pago y le manda el mail al autor automáticamente. Para USD
    // (o si el monto quedó en $0 por créditos) sigue el flujo manual de siempre.
    if (moneda === 'ARS' && montoAPagar > 0) {
      const { error: errLink } = await supabaseClient.functions.invoke('crear-link-campana', {
        body: { id_impulso: impulsoCreado.id }
      });

      if (errLink) {
        const detalle = await _leerErrorEdgeFunction(errLink, 'No pudimos generar el link de pago automáticamente.');
        console.error('Error generando link de pago del impulso:', detalle);
        if (ok) {
          ok.textContent = `Tu solicitud quedó registrada, pero no pudimos generarte el link de pago automáticamente. En breve te lo mandamos por mail para coordinar la activación.`;
          ok.style.display = 'block';
        }
      } else if (ok) {
        ok.textContent = `¡Listo! Te enviamos un mail con el link de pago de $${montoAPagar.toLocaleString('es-AR')} ARS. Una vez que se acredite el pago, activamos el impulso.`;
        ok.style.display = 'block';
      }
    } else if (ok) {
      ok.textContent = `¡Listo! Tu solicitud quedó registrada. Esto no se activa automáticamente: en breve te vamos a enviar el link de pago de ${moneda === 'ARS' ? '$' : 'USD '}${montoAPagar.toLocaleString('es-AR')} para coordinar la activación del impulso.`;
      ok.style.display = 'block';
    }

    setTimeout(async () => {
      cerrarModales();
      await cargarCampañasAutor(user.id);
      await cargarCreditosAutor(user.id);
    }, 2000);
  } catch (err) {
    const errDiv = document.getElementById('impulsar-error');
    if (errDiv) {
      errDiv.textContent = 'No pudimos registrar el impulso: ' + (err.message || 'intentá de nuevo.');
      errDiv.style.display = 'block';
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar impulso'; }
  }
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

  const { data, error } = await supabaseClient
    .from('postulaciones')
    .select(`
     id, estado, motivo_abandono, fecha_limite_entrega,
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

  const [{ data: rankings }, { data: insignias }, confiabilidades, matches] = await Promise.all([
    supabaseClient.from('ranking').select('id_usuario_resenador, posicion, puntos_mensuales, categoria').in('id_usuario_resenador', idsResenadores).eq('mes_año', mesActual),
    supabaseClient.from('insignias').select('id_usuario, tipo, codigo').in('id_usuario', idsResenadores),
    Promise.all(idsResenadores.map(id =>
      supabaseClient.rpc('calcular_confiabilidad', { p_usuario: id }).then(r => ({ id, confiabilidad: r.data }))
    )),
    Promise.all(idsResenadores.map(id =>
      supabaseClient.rpc('obtener_match_resenador_campana', { p_id_usuario: id, p_id_campana: idCampana }).then(r => ({ id, valor: r.data }))
    ))
  ]);

  _postulacionesAutor = (data || []).map(p => {
    const u = p.usuarios;
    const rankingUsuario = (rankings || []).find(r => r.id_usuario_resenador === u?.id);
    const confiabilidadUsuario = (confiabilidades || []).find(c => c.id === u?.id)?.confiabilidad || null;
    return {
      idPostulacion: p.id,
      idCampana,
      estado: p.estado,
      motivoAbandonoPrivado: p.motivo_abandono,
      fechaLimiteEntrega: p.fecha_limite_entrega,
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
        match: (matches || []).find(m => m.id === u?.id)?.valor ?? null,
        ranking: rankingUsuario ? {
          posicion: rankingUsuario.posicion,
          puntaje: rankingUsuario.puntos_mensuales
        } : null,
        confiabilidad: confiabilidadUsuario,
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
  ` : p.estado === 'aprobada' && p.fechaLimiteEntrega ? `
    <div style="background:var(--rosa-claro); border-left:4px solid var(--bordo); padding:10px 16px; margin-top:12px; border-radius:0 4px 4px 0;">
      <p style="font-size:13px; color:#2A2A2A; margin:0;">📅 Fecha límite de entrega de ${r?.alias || 'este reseñador'}: <strong>${formatearFechaAmigable(p.fechaLimiteEntrega)}</strong></p>
    </div>
  ` : p.estado === 'abandonada' ? `
    <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:12px 16px; margin-top:12px; border-radius:0 4px 4px 0;">
      <p style="font-weight:600; color:#856404; margin:0 0 8px;">Campaña abandonada</p>
      ${p.motivoAbandonoPrivado ? `<p style="font-size:13px; color:#856404; margin:0; font-style:italic;">"${p.motivoAbandonoPrivado}"</p>` : ''}
    </div>
  ` : '';

 const COLORES_CONFIABILIDAD = {
    gris:     { emoji: '⚪', label: 'Sin historial' },
    rojo:     { emoji: '🔴', label: 'Baja' },
    amarillo: { emoji: '🟡', label: 'Media' },
    azul:     { emoji: '🔵', label: 'Alta' },
    verde:    { emoji: '🟢', label: 'Muy alta' }
  };
  const conf = r?.confiabilidad;
  const confInfo = COLORES_CONFIABILIDAD[conf?.color] || COLORES_CONFIABILIDAD.gris;
  const confiabilidadHtml = conf ? `
    <p class="postulacion-confiabilidad">
      ${confInfo.emoji} Confiabilidad: <strong>${conf.sinHistorial ? confInfo.label : conf.puntaje}</strong>
    </p>
  ` : '';

  const rankingHtml = r?.ranking?.posicion ? `
    <p class="postulacion-ranking">
      🏅 <strong>#${r.ranking.posicion}</strong> en el ranking
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
          ${p.reseñador?.match != null ? `
            <p class="postulacion-tropes-match">${p.reseñador.match.emoji} <strong>${p.reseñador.match.score}%</strong> · ${p.reseñador.match.label}</p>
          ` : ''}
        </div>
      </div>
      ${badgesHtml ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0;">${badgesHtml}</div>` : ''}
      ${rankingHtml}
      ${confiabilidadHtml}
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
    mostrarToast(error.message || '👀 La decisión quedó en suspenso. Algo salió mal.', 'error');
    return;
  }

  const aliasReseñadorPostulacion = postulacionActual?.alias || 'El/la reseñador(a)';
  mostrarToast(accion === 'aprobar' ? `😈 ${aliasReseñadorPostulacion} está dentro. Ahora esperemos que haga lo suyo.` : '💅 Esta vez dijiste que no. Decisiones difíciles.', 'ok');

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
      id, fecha_entrega, link_instagram, link_tiktok, link_amazon, link_goodreads, comentarios, puntuacion_autor, puntuacion_libro,
      moods, frase_favorita_1, frase_favorita_2, frase_favorita_3,
      rating_romance, rating_spice, rating_drama, rating_estilo, rating_tension, rating_ritmo, rating_worldbuilding,
      usuarios!resenas_id_usuario_resenador_fkey (
        id, alias,
        avatares ( imagen_url )
      )
    `)
    .eq('id_campana', idCampana)
    .order('fecha_entrega', { ascending: false });

  if (error) {
    if (body) body.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    return;
  }

  const campanaRef = _campañasAutor.find(c => c.id === idCampana) || _historialAutor.find(c => c.id === idCampana);
  const linkPortada = campanaRef?.linkPortada || null;

  _reseñasCampanaActual = (data || []).map(r => ({
    idReseña: r.id,
    fechaEntrega: r.fecha_entrega,
    linkInstagram: r.link_instagram,
    linkTikTok: r.link_tiktok,
    linkAmazon: r.link_amazon,
    linkGoodreads: r.link_goodreads,
    comentarios: r.comentarios,
    puntuacion: r.puntuacion_autor,
    puntuacionLibro: r.puntuacion_libro,
    moods: r.moods || [],
    frase1: r.frase_favorita_1,
    frase2: r.frase_favorita_2,
    frase3: r.frase_favorita_3,
    ratingRomance: r.rating_romance,
    ratingSpice: r.rating_spice,
    ratingDrama: r.rating_drama,
    ratingEstilo: r.rating_estilo,
    ratingTension: r.rating_tension,
    ratingRitmo: r.rating_ritmo,
    ratingWorldbuilding: r.rating_worldbuilding,
    nombreLibro: nombreLibro,
    nombreAutor: campanaRef?.nombreAutor || null,
    linkPortada: linkPortada,
    reseñador: r.usuarios ? {
      id: r.usuarios.id,
      alias: r.usuarios.alias,
      fotoPerfil: r.usuarios.avatares?.imagen_url || null
    } : null
  }));

  if (_reseñasCampanaActual.length === 0) {
    if (body) body.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">Todavía no hay reseñas entregadas.</p>
      </div>
    `;
    return;
  }

  if (body) {
    body.innerHTML = `
      <div class="resenas-carpetas-grid">
        ${_reseñasCampanaActual.map(r => construirCardResenaCarpeta(r, linkPortada)).join('')}
      </div>
    `;
  }
}

// ────────────────────────────────────────────────────────────
// SEGUIMIENTO DE LECTURA
// Lista de reseñadores aprobados en una campaña con su progreso de
// lectura (fecha límite, estado, última actividad). Usa el RPC
// obtener_seguimiento_lectura (ver migración crear_progreso_lectura /
// rpc_seguimiento_lectura_campana en Supabase); combina el tracker
// automático del visor (EPUB/PDF) con el reporte manual de campañas de
// descarga (botón "Anunciar avances" del reseñador).
// ────────────────────────────────────────────────────────────

// Aviso temporal: la función es nueva (lanzada 09/08/2026), así que va a
// haber reseñadores que ya estén leyendo pero todavía figuren en "No
// empezado" hasta que abran el visor de nuevo o manden un aviso manual.
// Se autodesactiva sola pasada una semana, no hace falta tocar nada acá.
// (Misma fecha de corte que en la app mobile, ver SeguimientoLecturaModal.js.)
const FECHA_LIMITE_AVISO_SEGUIMIENTO = new Date('2026-08-16T00:00:00Z');

const LABELS_ESTADO_LECTURA = {
  no_empezado: 'No empezado',
  leyendo: 'Leyendo',
  mitad: 'Por la mitad',
  finalizado: 'Finalizado',
  entregada: 'Reseña entregada',
  vencida: 'Vencida sin entrega',
  abandonada: 'Abandonó (DNF)'
};

// Colores replicados exactos de COLORES_ESTADO en SeguimientoLecturaModal.js
// (mobile), para que el seguimiento se vea igual en ambas plataformas.
const COLORES_ESTADO_LECTURA = {
  no_empezado: '#999999',   // gris
  leyendo: '#3498DB',       // celeste
  mitad: '#2E4C9E',         // azul
  finalizado: '#8E44AD',    // violeta
  entregada: '#27AE60',     // verde
  vencida: '#C0392B',       // rojo
  abandonada: '#8B1A2B'     // bordo
};

/**
 * "Hace X" relativo simple para la última actividad de lectura — no hace
 * falta más precisión que días/horas acá.
 * @param {string|null} fechaStr
 */
function _haceTiempoLectura(fechaStr) {
  if (!fechaStr) return 'Sin actividad todavía';
  const diffMs = Date.now() - new Date(fechaStr).getTime();
  const horas = Math.floor(diffMs / 3_600_000);
  if (horas < 1) return 'Hace menos de una hora';
  if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
}

/**
 * Abre el modal de "Seguimiento de reseñadores" para una campaña activa.
 * Reutiliza el modal genérico modal-detalle-campana (mismo patrón que
 * verReseñasCampana / verPostulacionesCampana).
 * @param {string} idCampana
 * @param {string} nombreLibro
 */
async function verSeguimientoLectura(idCampana, nombreLibro) {
  mostrarModal('modal-detalle-campana');

  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = `Seguimiento de reseñadores — ${nombreLibro}`;
  if (body)   body.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
  if (footer) footer.innerHTML = '';

  const { data, error } = await supabaseClient.rpc('obtener_seguimiento_lectura', {
    p_id_campana: idCampana
  });

  if (error) {
    if (body) body.innerHTML = `<p class="mensaje-error">${error.message || 'No se pudo cargar el seguimiento.'}</p>`;
    return;
  }

  const lista = data || [];

  const avisoHtml = new Date() < FECHA_LIMITE_AVISO_SEGUIMIENTO ? `
    <div style="background:var(--rosa-claro); border-radius:8px; padding:10px 14px; margin-bottom:16px;">
      <p style="font-size:12px; color:var(--bordo); line-height:1.5; margin:0;">
        ℹ️ Esta función es nueva: recién está empezando a captar avances. Que alguien figure
        "No empezado" no significa que no esté leyendo — va a actualizarse solo a medida que
        abran el libro o manden un aviso.
      </p>
    </div>
  ` : '';

  if (lista.length === 0) {
    if (body) body.innerHTML = `
      ${avisoHtml}
      <div class="estado-vacio">
        <p class="estado-vacio-texto">Todavía no tenés reseñadores aprobados en esta campaña.</p>
      </div>
    `;
    return;
  }

  const filasHtml = lista.map(r => {
    const vencida = r.fecha_limite_entrega && new Date() > new Date(r.fecha_limite_entrega);
    const avatarHtml = r.avatar_url
      ? `<img src="${r.avatar_url}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`
      : `<div style="width:40px;height:40px;border-radius:50%;background:var(--crema);display:flex;align-items:center;justify-content:center;">👤</div>`;
    const estado = r.estado || 'no_empezado';

    // Botón "Dar un toque": solo tiene sentido si todavía no entregó la
    // reseña (dar_toque_seguimiento ya valida esto server-side, pero acá
    // evitamos mostrarlo directamente en esos casos). Respeta el cooldown
    // de 10 días que aplica la función.
    const puedeToque = !['entregada', 'abandonada'].includes(estado);
    const enCooldown = r.ultimo_toque && (new Date() - new Date(r.ultimo_toque)) < (10 * 24 * 60 * 60 * 1000);
    const diasRestantes = enCooldown
      ? Math.ceil((new Date(r.ultimo_toque).getTime() + 10 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;

    const toqueHtml = puedeToque
      ? (enCooldown
          ? `<span style="font-size:10px; color:var(--gris-suave); white-space:nowrap;">Ya le diste un toque · esperá ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}</span>`
          : `<button class="btn-secundario btn-sm" style="white-space:nowrap;" onclick="darToqueSeguimiento('${r.id_postulacion}', this)">👉 Dar un toque</button>`)
      : '';

    return `
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--gris-borde); padding:12px 0;">
        ${avatarHtml}
        <div style="flex:1;">
          <p style="font-size:13px; font-weight:700; color:var(--gris-texto); margin:0;">${r.alias || ''}</p>
          <p style="font-size:11px; color:${vencida ? 'var(--error)' : 'var(--gris-medio)'}; font-weight:${vencida ? '700' : '400'}; margin:2px 0 0;">
            📅 Vence ${formatearFechaAmigable(r.fecha_limite_entrega)}
          </p>
          <p style="font-size:11px; color:var(--gris-suave); margin:2px 0 0;">${_haceTiempoLectura(r.ultima_actividad)}</p>
        </div>
        <span style="background:${COLORES_ESTADO_LECTURA[estado] || '#999999'}; color:#fff; font-size:10px; font-weight:700; border-radius:999px; padding:4px 10px; white-space:nowrap;">
          ${LABELS_ESTADO_LECTURA[estado] || estado}
        </span>
        ${toqueHtml}
      </div>
    `;
  }).join('');

  if (body) body.innerHTML = `${avisoHtml}<div>${filasHtml}</div>`;
}

/**
 * Le da un "toque" a un reseñador desde el modal de seguimiento: manda una
 * notificación de recordatorio (con texto según su estado de lectura actual).
 * Limitado a un toque cada 10 días por postulación, validado en el server
 * (dar_toque_seguimiento) — acá solo reflejamos el resultado.
 *
 * @param {string} idPostulacion
 * @param {HTMLElement} btn — botón clickeado, para deshabilitarlo mientras corre
 */
async function darToqueSeguimiento(idPostulacion, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

  const { data: resultado, error } = await supabaseClient.rpc('dar_toque_seguimiento', {
    p_id_postulacion: idPostulacion
  });

  if (error || !resultado?.ok) {
    mostrarToast(resultado?.error || error?.message || '❌ Ni el toque quiso llegar. Qué desastre.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '👉 Dar un toque'; }
    return;
  }

  mostrarToast('🔔 Toque enviado. A ver si aparece esa reseña…', 'ok');
  if (btn) {
    btn.outerHTML = '<span style="font-size:10px; color:var(--gris-suave); white-space:nowrap;">Ya le diste un toque · esperá 10 días</span>';
  }
}

/**
 * Construye una card de reseña con formato "carpeta": portada de fondo,
 * pestaña con avatar + alias del reseñador, y body con fecha, estrellas y botón.
 *
 * @param {Object} r — reseña normalizada
 * @param {string|null} linkPortada — portada del libro de la campaña
 * @returns {string} HTML de la card
 */
function construirCardResenaCarpeta(r, linkPortada) {
  const iniciales = r.reseñador?.alias
    ? r.reseñador.alias.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const avatarHtml = r.reseñador?.fotoPerfil
    ? `<img src="${r.reseñador.fotoPerfil}" class="resena-carpeta-tab-avatar" onerror="this.style.display='none'" />`
    : `<div class="resena-carpeta-tab-avatar-fallback">${iniciales}</div>`;

  const ratingHtml = r.puntuacion
    ? `<div class="resena-carpeta-estrellas" id="resena-rating-${r.idReseña}">${'★'.repeat(r.puntuacion)}${'☆'.repeat(5 - r.puntuacion)}</div>`
    : `<div id="resena-rating-${r.idReseña}">
        <button type="button" class="btn-secundario btn-sm btn-full" onclick="abrirModalCalificar('${r.idReseña}', '${(r.reseñador?.alias || 'este reseñador').replace(/'/g, "\\'")}')">Calificar reseña</button>
      </div>`;

  return `
    <div class="resena-carpeta">
      <div class="resena-carpeta-portada-wrap">
        ${linkPortada
          ? `<img src="${linkPortada}" class="resena-carpeta-portada" onerror="this.style.display='none'" />`
          : `<div class="resena-carpeta-portada-placeholder">📖</div>`}
        <div class="resena-carpeta-tab">
          ${avatarHtml}
          <span class="resena-carpeta-tab-alias" ${r.reseñador?.id ? `onclick="abrirPerfilPublico('${r.reseñador.id}', 'reseñador')" style="cursor:pointer;"` : ''}>${r.reseñador?.alias || 'Reseñador'}</span>
        </div>
      </div>
      <div class="resena-carpeta-body">
        <p class="resena-carpeta-fecha">Entregada: ${formatearFechaAmigable(r.fechaEntrega)}</p>
        ${ratingHtml}
        <button class="btn-secundario btn-sm btn-full resena-carpeta-btn-comentarios" onclick="abrirResenaInternaAutor('${r.idReseña}')">Ver reseña completa</button>
      </div>
    </div>
  `;
}

/**
 * Abre el modal de solo lectura "Reseña interna" (el mismo componente que usa
 * el reseñador para ver sus propias reseñas leídas) con el detalle completo
 * de una reseña entregada, visto desde el panel del autor.
 * @param {string} idResena
 */
function abrirResenaInternaAutor(idResena) {
  const r = (_reseñasCampanaActual || []).find(x => x.idReseña === idResena);
  if (!r) return;

  _pintarResenaInterna({
    portadaUrl: r.linkPortada,
    nombreLibro: r.nombreLibro,
    nombreAutor: r.nombreAutor,
    puntuacionLibro: r.puntuacionLibro,
    fechaEntrega: r.fechaEntrega,
    moods: r.moods,
    frases: [r.frase1, r.frase2, r.frase3],
    ratings: {
      romance: r.ratingRomance,
      spice: r.ratingSpice,
      drama: r.ratingDrama,
      estilo: r.ratingEstilo,
      tension: r.ratingTension,
      ritmo: r.ratingRitmo,
      worldbuilding: r.ratingWorldbuilding
    },
    comentario: r.comentarios,
    links: {
      instagram: r.linkInstagram,
      tiktok: r.linkTikTok,
      amazon: r.linkAmazon,
      goodreads: r.linkGoodreads
    }
  });
}

/**
 * Abre el modal de calificación por afirmaciones SI/NO para una reseña.
 * Cada SI suma una estrella (0 a 5).
 */
function abrirModalCalificar(idResena, alias) {
  document.getElementById('calificar-id-resena').value = idResena;
  const nombreEl = document.getElementById('calificar-nombre-resenador');
  if (nombreEl) nombreEl.textContent = `Reseña de ${alias}`;

  // Reset de respuestas
  _respuestasCalificacion = {};
  document.querySelectorAll('#calificar-afirmaciones .btn-si-no').forEach(b => b.classList.remove('activo'));
  const label = document.getElementById('estrellas-label');
  if (label) label.textContent = '0 de 5 respondidas';
  document.getElementById('calificar-puntuacion').value = '';
  ocultarMensajes('calificar-error', 'calificar-ok');

  mostrarModal('modal-calificar-resena');
}

let _respuestasCalificacion = {};

/**
 * Registra la respuesta SI/NO de una afirmación y recalcula la puntuación.
 * @param {number} pregunta — número de afirmación (1 a 5)
 * @param {boolean} valor — true = SI, false = NO
 */
function responderAfirmacion(pregunta, valor, boton) {
  _respuestasCalificacion[pregunta] = valor;

  const fila = boton.closest('.calificar-afirmacion-fila');
  fila.querySelectorAll('.btn-si-no').forEach(b => b.classList.remove('activo'));
  boton.classList.add('activo');

  const respondidas = Object.keys(_respuestasCalificacion).length;
  const puntuacion  = Object.values(_respuestasCalificacion).filter(v => v === true).length;

  // La puntuación se calcula y se guarda igual que siempre (cada SI = 1 estrella),
  // pero no se muestra esa conversión acá: solo el progreso de respuestas.
  document.getElementById('calificar-puntuacion').value = puntuacion;
  const label = document.getElementById('estrellas-label');
  if (label) {
    label.textContent = `${respondidas} de 5 respondidas`;
  }
}

async function enviarCalificacion() {
  const idResena  = document.getElementById('calificar-id-resena')?.value;
  const respondidas = Object.keys(_respuestasCalificacion).length;

  if (respondidas < 5) {
    mostrarMensajeError('calificar-error', 'Respondé las 5 afirmaciones antes de confirmar.');
    return;
  }

  const puntuacion = Object.values(_respuestasCalificacion).filter(v => v === true).length;

  const { error } = await supabaseClient
    .from('resenas')
    .update({ puntuacion_autor: puntuacion, fecha_puntuacion: new Date().toISOString() })
    .eq('id', idResena);

  if (error) {
    mostrarMensajeError('calificar-error', error.message);
    return;
  }

  const contenedor = document.getElementById(`resena-rating-${idResena}`);
  if (contenedor) {
    contenedor.outerHTML = `<div class="resena-carpeta-estrellas" id="resena-rating-${idResena}">${'★'.repeat(puntuacion)}${'☆'.repeat(5 - puntuacion)}</div>`;
  }
  const r = (_reseñasCampanaActual || []).find(x => x.idReseña === idResena);
  if (r) r.puntuacion = puntuacion;

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

  contenedor.innerHTML = _historialAutor.map(c => {
    const variante = c.estado === 'cancelada' ? 'cancelada' : 'finalizada';
    const icono = c.estado === 'cancelada' ? '✕' : '✓';
    return `
    <div class="campana-card-historial campana-card-historial--${variante}">
      <div class="campana-card-panel-header">
        <div class="campana-card-historial-titulo-wrap">
          <div class="campana-card-historial-icono">${icono}</div>
          <div class="campana-card-historial-textos">
            <h3 class="campana-titulo">${c.nombreLibro}</h3>
            <p class="campana-autor">por ${c.nombreAutor}</p>
          </div>
        </div>
        ${badgeEstado(c.estado)}
      </div>
      <div class="campana-card-panel-body">
        <div class="campana-card-panel-stats">
          <span>${c.reseñasEntregadas ?? '—'} reseñas entregadas</span>
          <span>Finalizó ${formatearFechaAmigable(c.fechaLimite)}</span>
        </div>
        <div class="campana-panel-acciones">
          <button class="btn-secundario btn-sm btn-full" onclick="verReseñasCampana('${c.id}', '${c.nombreLibro}')">Ver reseñas</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
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
    mostrarToast(error.message || '😏 La campaña se niega a morir. Probá de nuevo.', 'error');
    return;
  }

  mostrarToast('💅 Listo. La campaña pasó oficialmente a mejor vida.', 'ok');
  await cargarCampañasAutor(user.id);
  await cargarEstadisticasAutor(user.id);
}

// ────────────────────────────────────────────────────────────
// CREAR CAMPAÑA
// ────────────────────────────────────────────────────────────

/**
 * Sube un archivo (PDF o EPUB) directo a R2 para una campaña, usando
 * la Edge Function subir-archivo-libro (flujo: presignar → PUT → confirmar).
 *
 * @param {string} idCampana
 * @param {'pdf'|'epub'} formato
 * @param {File} archivo
 */
async function _leerErrorEdgeFunction(error, mensajePorDefecto) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const bodyReal = await error.context.json();
      return bodyReal?.detalle
        ? `${bodyReal.error || mensajePorDefecto} | DETALLE: ${bodyReal.detalle}${bodyReal.codigo ? ' (' + bodyReal.codigo + ')' : ''}`
        : (bodyReal?.error || mensajePorDefecto);
    } catch (e) {
      return mensajePorDefecto;
    }
  }
  return error?.message || mensajePorDefecto;
}

async function subirArchivoLibro(idCampana, formato, archivo) {
  const { data: presign, error: errPresign } = await supabaseClient.functions.invoke('subir-archivo-libro', {
    body: { accion: 'presignar', id_campana: idCampana, formato }
  });

  if (errPresign || !presign?.url) {
    const detalle = await _leerErrorEdgeFunction(errPresign, `No se pudo iniciar la subida del ${formato.toUpperCase()}.`);
    throw new Error(detalle);
  }

  const respPut = await fetch(presign.url, {
    method: 'PUT',
    headers: { 'Content-Type': presign.content_type },
    body: archivo
  });

  if (!respPut.ok) {
    throw new Error(`Error al subir el archivo ${formato.toUpperCase()} (HTTP ${respPut.status}). Probá de nuevo.`);
  }

  const { data: confirm, error: errConfirm } = await supabaseClient.functions.invoke('subir-archivo-libro', {
    body: { accion: 'confirmar', id_campana: idCampana, formato }
  });

  if (errConfirm || !confirm?.ok) {
    const detalle = await _leerErrorEdgeFunction(errConfirm, `No se pudo confirmar la subida del ${formato.toUpperCase()}.`);
    throw new Error(detalle);
  }
}

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

const archivoEpub = document.getElementById('nc-archivo-epub')?.files?.[0];
  const archivoPdf   = document.getElementById('nc-archivo-pdf')?.files?.[0];

  if (!archivoEpub || !archivoPdf) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', 'Subí el archivo EPUB y el archivo PDF.');
    return;
  }

  const seleccionTropes = obtenerSeleccionTropes('nc');

  if (!seleccionTropes.id_genero) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', 'Elegí un género para la campaña.');
    return;
  }

  if (seleccionTropes.idsTropes.length === 0) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', 'Elegí al menos un trope para la campaña.');
    return;
  }

  const datos = {
    nombreLibro:       document.getElementById('nc-nombre-libro')?.value?.trim(),
    nombreAutor:       document.getElementById('nc-nombre-autor')?.value?.trim(),
    sinopsis:          document.getElementById('nc-sinopsis')?.value?.trim(),
    idGenero:          seleccionTropes.id_genero,
    idSubgenero:       seleccionTropes.id_subgenero,
    linkPortada:       linkPortada,
    linkAmazon:        document.getElementById('nc-link-amazon')?.value?.trim(),
    cuposTotal:        parseInt(document.getElementById('nc-cupos')?.value),
    modalidadLectura:  document.querySelector('input[name="nc-modalidad-lectura"]:checked')?.value || 'visor',
    plataformasResena: plataformasSeleccionadas,
    tipoColaboracion:  document.querySelector('input[name="nc-tipo-colaboracion"]:checked')?.value || 'digital',
    alcanceEnvio:      document.querySelector('input[name="nc-alcance-envio"]:checked')?.value || null
  };

  const { data: campanaCreada, error } = await supabaseClient
    .from('campanas')
    .insert({
      id_usuario_autor:   user.id,
      nombre_libro:       datos.nombreLibro,
      nombre_autor:       datos.nombreAutor,
      sinopsis:           datos.sinopsis,
      id_genero:          datos.idGenero,
      id_subgenero:       datos.idSubgenero,
      link_portada:       datos.linkPortada,
      link_amazon_libro:  datos.linkAmazon,
      cupos_total:        datos.cuposTotal,
      modalidad_lectura:  datos.modalidadLectura,
      plataformas_resena: datos.plataformasResena,
      tipo_colaboracion:  datos.tipoColaboracion,
      alcance_envio:      datos.tipoColaboracion === 'digital' ? null : datos.alcanceEnvio
    })
    .select()
    .single();

  if (error) {
    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', error.message);
    return;
  }

  if (seleccionTropes.idsTropes.length > 0) {
    const { error: errorTropes } = await supabaseClient
      .from('campana_tropes')
      .insert(seleccionTropes.idsTropes.map(idTrope => ({
        id_campana: campanaCreada.id,
        id_trope: idTrope
      })));

    if (errorTropes) {
      // La campaña ya se creó; no la revertimos por esto, pero lo dejamos en consola.
      console.error('Error guardando tropes de la campaña:', errorTropes);
    }
  }

  if (seleccionTropes.idsSubgeneros.length > 0) {
    const { error: errorSubgeneros } = await supabaseClient
      .from('campana_subgeneros')
      .insert(seleccionTropes.idsSubgeneros.map(idSubgenero => ({
        id_campana: campanaCreada.id,
        id_subgenero: idSubgenero
      })));

    if (errorSubgeneros) {
      console.error('Error guardando subgéneros de la campaña:', errorSubgeneros);
    }
  }

 try {
    await subirArchivoLibro(campanaCreada.id, 'epub', archivoEpub);
    await subirArchivoLibro(campanaCreada.id, 'pdf', archivoPdf);
  } catch (errArchivo) {
    // Si falla la subida, cancelamos la campaña recién creada para que
    // no quede "activa" y visible en el feed sin archivos cargados.
    await supabaseClient
      .from('campanas')
      .update({ estado: 'cancelada' })
      .eq('id', campanaCreada.id);

    toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
    mostrarMensajeError('nc-error', `Hubo un error al subir los archivos (${errArchivo.message}). La campaña no se publicó — volvé a intentar crearla.`);
    return;
  }

  toggleBoton('btn-crear-campana', true, '', 'Crear campaña');
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

  const esEditorial = Sesion.rol() === 'editorial';

  let planes;

  if (esEditorial) {
    // Los valores de editorial vienen de `configuracion` para no hardcodear precios/límites.
    const { data: config } = await supabaseClient
      .from('configuracion')
      .select('clave, valor')
      .in('clave', [
        'PRECIO_EDITORIAL_PLUS_ARS',
        'PLAN_EDITORIAL_FREE_CAMPANAS',
        'PLAN_EDITORIAL_FREE_RESENADORES',
        'PLAN_EDITORIAL_PLUS_CAMPANAS',
        'PLAN_EDITORIAL_PLUS_RESENADORES'
      ]);

    const val = (clave, fallback) => (config || []).find(c => c.clave === clave)?.valor ?? fallback;

    const precioPlus       = parseInt(val('PRECIO_EDITORIAL_PLUS_ARS', '60000'));
    const campanasFree     = val('PLAN_EDITORIAL_FREE_CAMPANAS', '5');
    const resenadoresFree  = val('PLAN_EDITORIAL_FREE_RESENADORES', '40');
    const campanasPlus     = val('PLAN_EDITORIAL_PLUS_CAMPANAS', '-1');
    const resenadoresPlus  = val('PLAN_EDITORIAL_PLUS_RESENADORES', '-1');

    planes = [
      {
        id: 'editorial_free',
        nombre: 'Free',
        precio: '$0',
        subprecio: 'Para empezar',
        beneficios: [
          `${campanasFree} campañas por mes`,
          `Hasta ${resenadoresFree} reseñadores`
        ],
        esPremium: false
      },
      {
        id: 'editorial_plus',
        nombre: 'Editorial Plus',
        precio: `$${precioPlus.toLocaleString('es-AR')}`,
        subprecio: 'Facturación mensual',
        beneficios: [
          campanasPlus === '-1' ? 'Campañas ilimitadas' : `${campanasPlus} campañas por mes`,
          resenadoresPlus === '-1' ? 'Reseñadores ilimitados' : `Hasta ${resenadoresPlus} reseñadores`
        ],
        esPremium: true
      }
    ];
  } else {
    // ── Autor: exactamente igual que antes, sin ningún cambio ──
    planes = [
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
  }

  contenedor.innerHTML = `
    <h3 style="font-family:var(--fuente-titulo); font-size:24px; font-weight:700; color:var(--bordo); font-style:italic; text-align:center; margin-bottom:24px;">Elegí tu plan</h3>
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${planes.map(p => {
        const esActual = p.id === plan;
        const esMenor = (p.id === 'free' && (plan === 'basic' || plan === 'premium')) || (p.id === 'basic' && plan === 'premium') || (p.id === 'editorial_free' && plan === 'editorial_plus');
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
                : p.proximamente
                ? `<button class="btn-sm" disabled style="background:rgba(255,255,255,0.15); color:var(--blanco); border:none; padding:8px 16px; border-radius:var(--radio-pill); font-weight:700; font-size:13px; cursor:default; opacity:0.7;">Próximamente</button>`
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
  const moneda = confirm('¿Pagás desde Argentina?\n\nAceptar = Mercado Pago (ARS)\nCancelar = PayPal (USD)')
    ? 'ARS'
    : 'USD';

  const funcion = moneda === 'ARS' ? 'crear-suscripcion' : 'crear-suscripcion-paypal';
  const body = { plan };

  if (moneda === 'ARS') {
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let payerEmail = prompt(
      '¿Con qué mail vas a pagar en Mercado Pago?\n(Puede ser distinto al mail de tu cuenta de Indómita)'
    );
    payerEmail = payerEmail?.trim();

    if (!payerEmail || !regexEmail.test(payerEmail)) {
      mostrarToast('👀 ¿Y tu mail de Mercado Pago? Lo necesitamos para seguir.', 'error');
      return;
    }

    body.payerEmail = payerEmail;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    mostrarToast('💅 Tu sesión decidió tomarse un descanso. Iniciá sesión de nuevo.', 'error');
    return;
  }

  toggleBoton('btn-crear-campana', false, 'Redirigiendo a Mercado Pago...'); // opcional, feedback visual

  const { data, error } = await supabaseClient.functions.invoke(funcion, {
    body,
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

  // En vez de abrir pestaña nueva: redirigimos la misma pestaña. No hay
  // pop-up que un navegador pueda bloquear porque no estamos abriendo
  // ninguna ventana nueva.
  window.location.href = data.urlPago;
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
  const { data, error } = await supabaseClient
    .from('libros')
    .select('*')
    .eq('id_usuario_autor', idUsuario)
    .eq('eliminado', false)
    .order('fecha_carga', { ascending: false });

  if (error) return;

  const idsLibros = (data || []).map(l => l.id);
  let tropesPorLibro = {};
  let subgenerosPorLibro = {};
  if (idsLibros.length > 0) {
    const { data: tropesRows } = await supabaseClient
      .from('libro_tropes')
      .select('id_libro, tropes ( id, nombre )')
      .in('id_libro', idsLibros);
    (tropesRows || []).forEach(row => {
      if (!tropesPorLibro[row.id_libro]) tropesPorLibro[row.id_libro] = [];
      if (row.tropes) tropesPorLibro[row.id_libro].push({ id: row.tropes.id, nombre: row.tropes.nombre });
    });

    const { data: subgenerosRows } = await supabaseClient
      .from('libro_subgeneros')
      .select('id_libro, id_subgenero')
      .in('id_libro', idsLibros);
    (subgenerosRows || []).forEach(row => {
      if (!subgenerosPorLibro[row.id_libro]) subgenerosPorLibro[row.id_libro] = [];
      subgenerosPorLibro[row.id_libro].push(row.id_subgenero);
    });
  }

  _librosAutor = await Promise.all((data || []).map(async l => ({
    id: l.id,
    titulo: l.titulo,
    sinopsisBreve: l.sinopsis_breve,
    sinopsis: l.sinopsis_breve,
    genero: (await obtenerEtiquetaGenero(l.id_genero, l.id_subgenero)) || l.genero, // fallback al texto viejo si no está migrado
    idGenero: l.id_genero,
    idSubgenero: l.id_subgenero,
    idsSubgeneros: subgenerosPorLibro[l.id] || [],
    tropes: l.tropes,
    tropesCatalogo: tropesPorLibro[l.id] || [],
    linkPortada: l.link_portada,
    linkAmazon: l.link_amazon
  })));

  const contenedor = document.getElementById('biblioteca-lista');
  if (contenedor) renderizarBiblioteca(_librosAutor);
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

  const seleccionTropes = obtenerSeleccionTropes('libro');

  if (!seleccionTropes.id_genero) {
    mostrarMensajeError('libro-error', 'Elegí un género para el libro.');
    return;
  }

  const datos = {
    titulo:         titulo,
    sinopsisBreve:  document.getElementById('libro-sinopsis')?.value?.trim(),
    idGenero:       seleccionTropes.id_genero,
    idSubgenero:    seleccionTropes.id_subgenero,
    linkPortada: linkPortada,
    linkAmazon:     document.getElementById('libro-amazon')?.value?.trim()
  };

  const { data: libroCreado, error } = await supabaseClient.from('libros').insert({
    id_usuario_autor: user.id,
    titulo: datos.titulo,
    sinopsis_breve: datos.sinopsisBreve,
    id_genero: datos.idGenero,
    id_subgenero: datos.idSubgenero,
    link_portada: datos.linkPortada,
    link_amazon: datos.linkAmazon
  })
    .select()
    .single();

  if (error) {
    mostrarMensajeError('libro-error', error.message);
    return;
  }

  if (seleccionTropes.idsTropes.length > 0) {
    const { error: errorTropes } = await supabaseClient
      .from('libro_tropes')
      .insert(seleccionTropes.idsTropes.map(idTrope => ({
        id_libro: libroCreado.id,
        id_trope: idTrope
      })));

    if (errorTropes) {
      console.error('Error guardando tropes del libro:', errorTropes);
    }
  }

  if (seleccionTropes.idsSubgeneros.length > 0) {
    const { error: errorSubgeneros } = await supabaseClient
      .from('libro_subgeneros')
      .insert(seleccionTropes.idsSubgeneros.map(idSubgenero => ({
        id_libro: libroCreado.id,
        id_subgenero: idSubgenero
      })));

    if (errorSubgeneros) {
      console.error('Error guardando subgéneros del libro:', errorSubgeneros);
    }
  }

  document.getElementById('form-nuevo-libro')?.reset();
  cerrarModales();
  mostrarToast('👀 Libro agregado. Ahora queremos verlo en una campaña.', 'ok');
  await cargarBibliotecaPanel(user.id);
  if (typeof cargarBibliotecaAutorSeccion === 'function') await cargarBibliotecaAutorSeccion();
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
    mostrarToast('🫠 El libro no se quiso ir. Qué insistente.', 'error');
    return;
  }

mostrarToast('😈 Libro eliminado. Lo que pasó con ese libro queda entre vos y vos.', 'ok');
  await cargarBibliotecaPanel(user.id);
  if (typeof cargarBibliotecaAutorSeccion === 'function') await cargarBibliotecaAutorSeccion();
}

// ────────────────────────────────────────────────────────────
// SELECTOR DE LIBRO EN NUEVA CAMPAÑA
// ────────────────────────────────────────────────────────────

async function inicializarModalNuevaCampana() {
  await renderizarSelectorTropes('nc-tropes-contenedor', 'nc');

   // Muestra la fecha de cierre calculada (hoy + 30 días). Ya no la elige el autor.
  const fechaCierre = new Date();
  fechaCierre.setDate(fechaCierre.getDate() + 30);
  const infoFecha = document.getElementById('nc-fecha-limite-info');
  if (infoFecha) {
    infoFecha.textContent = `Tu campaña estará activa hasta el ${fechaCierre.toLocaleDateString('es-AR')}.`;
  }

  // Si tiene cupos de regalo por reconexión, avisa que se suman al límite de su plan
  const hintRegalo = document.getElementById('nc-cupos-regalo-hint');
  if (hintRegalo) {
    hintRegalo.style.display = 'none';
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const { data: usuarioRow } = await supabaseClient
        .from('usuarios')
        .select('cupos_regalo_disponibles')
        .eq('id', user.id)
        .maybeSingle();
      const cupos = usuarioRow?.cupos_regalo_disponibles ?? 0;
      if (cupos > 0) {
        hintRegalo.textContent = `🎁 Tenés ${cupos} reseñad@r${cupos === 1 ? '' : 'es'} de regalo: se suman al límite de tu plan en esta campaña.`;
        hintRegalo.style.display = 'block';
      }
    }
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

async function precargarLibroEnCampana() {
  const selector = document.getElementById('nc-libro-selector');
  const idLibro  = selector?.value;

  const previewPortada = document.getElementById('nc-portada-preview');

  if (!idLibro) {
    document.getElementById('nc-nombre-libro').value = '';
    document.getElementById('nc-nombre-autor').value = '';
    document.getElementById('nc-sinopsis').value     = '';
    document.getElementById('nc-link-portada').value = '';
    document.getElementById('nc-link-amazon').value  = '';
    _portadaPrecargadaCampana = null;
    if (previewPortada) previewPortada.innerHTML = '';
    await renderizarSelectorTropes('nc-tropes-contenedor', 'nc');
    return;
  }

  const libro = _librosAutor.find(l => l.id === idLibro);
  if (!libro) return;

  document.getElementById('nc-nombre-libro').value = libro.titulo      || '';
  document.getElementById('nc-nombre-autor').value = Sesion.obtener()?.alias || '';
  document.getElementById('nc-sinopsis').value     = libro.sinopsis    || '';
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

  await renderizarSelectorTropes('nc-tropes-contenedor', 'nc', {
    id_genero: libro.idGenero,
    id_subgenero: libro.idSubgenero,
    tropes: libro.tropesCatalogo || []
  });
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
      if (typeof registrarAccionEventoSiCorresponde === 'function') {
        registrarAccionEventoSiCorresponde('compartir_campana');
      }
    } catch (e) {
      // El usuario cerró el menú de compartir sin elegir nada, no es un error real
    }
    return;
  }
  // En computadora: copia al portapapeles
  try {
    await navigator.clipboard.writeText(`${texto} ${url}`);
    mostrarToast('🔥 Link copiado. Ahora a hacer ruido.', 'ok');
    if (typeof registrarAccionEventoSiCorresponde === 'function') {
      registrarAccionEventoSiCorresponde('compartir_campana');
    }
  } catch (e) {
    mostrarToast('😈 El link se rebeló. Copialo manualmente: ' + url, 'error');
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
        <div id="ec-tropes-contenedor"></div>
      </div>
      <div class="form-grupo">
        <label class="form-label">Portada</label>
        ${campana.linkPortada ? `<img src="${campana.linkPortada}" alt="Portada actual" style="max-width:120px; display:block; margin-bottom:8px; border-radius:6px;" />` : ''}
        <input type="file" id="ec-link-portada" class="form-input" accept="image/jpeg,image/png,image/webp" />
        <p class="form-hint">Dejá vacío para no cambiar la portada actual.</p>
      </div>
      <div class="form-grupo">
  <label class="form-label">Archivo EPUB</label>
  <input type="file" id="ec-archivo-epub" class="form-input" accept=".epub,application/epub+zip" />
  <p class="form-hint">Dejá vacío para no reemplazar el EPUB actual.</p>
</div>
<div class="form-grupo">
  <label class="form-label">Archivo PDF</label>
  <input type="file" id="ec-archivo-pdf" class="form-input" accept=".pdf,application/pdf" />
  <p class="form-hint">Dejá vacío para no reemplazar el PDF actual.</p>
</div>
      <div id="ec-error" class="mensaje-error" style="display:none;"></div>
      <div id="ec-ok" class="mensaje-ok" style="display:none;"></div>
      <div class="modal-footer">
        <button type="button" class="btn-secundario" onclick="cerrarModales()">Cancelar</button>
        <button type="button" class="btn-primario" onclick="guardarEditarCampana('${idCampana}')">Guardar cambios</button>
      </div>
    </form>
  `;

  await renderizarSelectorTropes('ec-tropes-contenedor', 'ec', {
    id_genero: campana.idGenero,
    ids_subgenero: campana.idsSubgeneros && campana.idsSubgeneros.length > 0
      ? campana.idsSubgeneros
      : (campana.idSubgenero ? [campana.idSubgenero] : []),
    tropes: campana.tropesCatalogo || []
  });
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

  const seleccionTropes = obtenerSeleccionTropes('ec');

  if (!seleccionTropes.id_genero) {
    mostrarMensajeError('ec-error', 'Elegí un género para la campaña.');
    return;
  }

  if (seleccionTropes.idsTropes.length === 0) {
    mostrarMensajeError('ec-error', 'Elegí al menos un trope para la campaña.');
    return;
  }

  const datos = {
    sinopsis: document.getElementById('ec-sinopsis')?.value?.trim(),
    idGenero: seleccionTropes.id_genero,
    idSubgenero: seleccionTropes.id_subgenero
  };
  const archivoEpubNuevo = document.getElementById('ec-archivo-epub')?.files?.[0];
  const archivoPdfNuevo  = document.getElementById('ec-archivo-pdf')?.files?.[0];
  const cambiosCampana = {
    sinopsis: datos.sinopsis,
    id_genero: datos.idGenero,
    id_subgenero: datos.idSubgenero
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

  // Reemplaza los tropes de la campaña: borra los anteriores y carga los elegidos ahora.
  const { error: errorBorrarTropes } = await supabaseClient
    .from('campana_tropes')
    .delete()
    .eq('id_campana', idCampana);

  if (errorBorrarTropes) {
    console.error('Error borrando tropes previos de la campaña:', errorBorrarTropes);
  }

  if (seleccionTropes.idsTropes.length > 0) {
    const { error: errorTropes } = await supabaseClient
      .from('campana_tropes')
      .insert(seleccionTropes.idsTropes.map(idTrope => ({
        id_campana: idCampana,
        id_trope: idTrope
      })));

    if (errorTropes) {
      console.error('Error guardando tropes de la campaña:', errorTropes);
    }
  }

  // Reemplaza los subgéneros de la campaña: borra los anteriores y carga los elegidos ahora.
  const { error: errorBorrarSubgeneros } = await supabaseClient
    .from('campana_subgeneros')
    .delete()
    .eq('id_campana', idCampana);

  if (errorBorrarSubgeneros) {
    console.error('Error borrando subgéneros previos de la campaña:', errorBorrarSubgeneros);
  }

  if (seleccionTropes.idsSubgeneros.length > 0) {
    const { error: errorSubgeneros } = await supabaseClient
      .from('campana_subgeneros')
      .insert(seleccionTropes.idsSubgeneros.map(idSubgenero => ({
        id_campana: idCampana,
        id_subgenero: idSubgenero
      })));

    if (errorSubgeneros) {
      console.error('Error guardando subgéneros de la campaña:', errorSubgeneros);
    }
  }

  // Solo sube archivos si el autor eligió uno nuevo.
  // Vacío = no reemplazar el archivo actual.
  try {
    if (archivoEpubNuevo) await subirArchivoLibro(idCampana, 'epub', archivoEpubNuevo);
    if (archivoPdfNuevo)  await subirArchivoLibro(idCampana, 'pdf', archivoPdfNuevo);
  } catch (errArchivo) {
    mostrarMensajeError('ec-error', errArchivo.message);
    return;
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
        <div id="el-tropes-contenedor"></div>
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

  await renderizarSelectorTropes('el-tropes-contenedor', 'el', {
    id_genero: libro.idGenero,
    ids_subgenero: libro.idsSubgeneros && libro.idsSubgeneros.length > 0
      ? libro.idsSubgeneros
      : (libro.idSubgenero ? [libro.idSubgenero] : []),
    tropes: libro.tropesCatalogo || []
  });
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

  const seleccionTropes = obtenerSeleccionTropes('el');

  if (!seleccionTropes.id_genero) {
    mostrarMensajeError('el-error', 'Elegí un género para el libro.');
    return;
  }

  const datos = {
    sinopsisBreve: document.getElementById('el-sinopsis')?.value?.trim(),
    idGenero: seleccionTropes.id_genero,
    idSubgenero: seleccionTropes.id_subgenero
  };

  const cambiosLibro = {
    sinopsis_breve: datos.sinopsisBreve,
    id_genero: datos.idGenero,
    id_subgenero: datos.idSubgenero
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

  // Reemplaza los tropes del libro: borra los anteriores y carga los elegidos ahora.
  const { error: errorBorrarTropes } = await supabaseClient
    .from('libro_tropes')
    .delete()
    .eq('id_libro', idLibro);

  if (errorBorrarTropes) {
    console.error('Error borrando tropes previos del libro:', errorBorrarTropes);
  }

  if (seleccionTropes.idsTropes.length > 0) {
    const { error: errorTropes } = await supabaseClient
      .from('libro_tropes')
      .insert(seleccionTropes.idsTropes.map(idTrope => ({
        id_libro: idLibro,
        id_trope: idTrope
      })));

    if (errorTropes) {
      console.error('Error guardando tropes del libro:', errorTropes);
    }
  }

  // Reemplaza los subgéneros del libro: borra los anteriores y carga los elegidos ahora.
  // (El trigger de la base propaga automáticamente este cambio a la campaña activa del libro, si tiene una.)
  const { error: errorBorrarSubgeneros } = await supabaseClient
    .from('libro_subgeneros')
    .delete()
    .eq('id_libro', idLibro);

  if (errorBorrarSubgeneros) {
    console.error('Error borrando subgéneros previos del libro:', errorBorrarSubgeneros);
  }

  if (seleccionTropes.idsSubgeneros.length > 0) {
    const { error: errorSubgeneros } = await supabaseClient
      .from('libro_subgeneros')
      .insert(seleccionTropes.idsSubgeneros.map(idSubgenero => ({
        id_libro: idLibro,
        id_subgenero: idSubgenero
      })));

    if (errorSubgeneros) {
      console.error('Error guardando subgéneros del libro:', errorSubgeneros);
    }
  }

  mostrarMensajeOk('el-ok', '¡Libro actualizado correctamente!');
  setTimeout(async () => {
    cerrarModales();
    await cargarBibliotecaPanel(user.id);
    if (typeof cargarBibliotecaAutorSeccion === 'function') await cargarBibliotecaAutorSeccion();
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
