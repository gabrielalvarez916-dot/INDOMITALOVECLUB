// ============================================================
// eventos.js — Indómita Love Club
// Motor GENÉRICO de eventos. No contiene datos de ningún evento
// puntual: esos viven enteramente en la tabla public.eventos de
// Supabase (nombre, textos, imágenes, retos).
// Este archivo sabe cómo:
//   1. Detectar si hay un evento activo y mostrarlo (modal + animación)
//   2. Renderizar la página del evento (retos, progreso, insignia)
//   3. Registrar acciones "directas" (sin hoja propia en Sheets)
//   4. Disparar la animación final cuando el usuario completa el evento
//
// Para agregar un evento nuevo en el futuro:
//   - Cargar su fila en la tabla eventos de Supabase (activo = false)
//   - Cuando se quiera lanzar: poner su activo = true (esto exige que
//     el anterior esté en false, hay un índice único en la tabla que
//     solo permite un evento activo a la vez).
//   - No hace falta tocar ni un archivo de código para esto.
//
// FIX (Fase 4, auditoría):
//   - _renderBarraProgresoEvento() y _renderTiempoRestanteEvento()
//     estaban declaradas ADENTRO del template literal de
//     renderPaginaEvento(), es decir, eran texto, no código. Se
//     movieron a la sección HELPERS.
//   - _asegurarWidgetFlotanteEvento() y _actualizarWidgetFlotanteEvento()
//     estaban pegadas 3 veces, cada una anidada dentro de otra función
//     (con alcance local, nunca invocadas). Se dejó una sola copia,
//     a nivel de módulo, y se agregaron los 3 llamados que faltaban.
// ============================================================


// ────────────────────────────────────────────────────────────
// Título fijo del bloque "historia" del evento. Es el mismo rótulo
// para cualquier evento; el texto de abajo sí cambia por evento y
// viene de Supabase (columna historia de la fila activa).
// ────────────────────────────────────────────────────────────

const _EVENTOS_TITULO_HISTORIA = '¿De qué trata?';


// ────────────────────────────────────────────────────────────
// ESTADO INTERNO DEL MÓDULO
// ────────────────────────────────────────────────────────────

const _EventosState = {
  eventoActivo: null,     // objeto de datos del evento activo (si hay uno)
  progreso: null,         // datos de progreso devueltos por el backend
  rol: null,              // rol del usuario actual ('autor' | 'reseñador')
  idUsuario: null         // ID_Usuario actual (Sesion.obtener().id)
};


// ────────────────────────────────────────────────────────────
// 1. DETECCIÓN AL CARGAR LA APP
// Llamar a esta función una vez, después de que el usuario esté
// logueado (ej. al final de completarLogin() y de verificarSesionActiva()
// en auth.js — falta enganchar ese llamado ahí).
// ────────────────────────────────────────────────────────────

async function inicializarEventos() {
  try {
    const usuario = Sesion.obtener();
    if (!usuario || !usuario.id || !usuario.rol) return;

    // Solo reseñador y autor tienen retos de evento (admin no participa)
    if (usuario.rol !== 'autor' && usuario.rol !== 'reseñador') return;

    _EventosState.idUsuario = usuario.id;
    _EventosState.rol = usuario.rol;

    // Ya no se manda p_id_evento: la función busca sola el evento
    // con activo = true en Supabase y devuelve sus datos + progreso.
    const { data: resultado, error } = await supabaseClient.rpc('inicializar_evento_usuario', {
      p_usuario: usuario.id,
      p_rol: usuario.rol
    });

    if (error || !resultado || !resultado.activo) {
      _ocultarBotonNavEvento();
      _actualizarWidgetFlotanteEvento();
      return;
    }

    _EventosState.eventoActivo = resultado.evento;
    _EventosState.progreso = resultado.progreso;

    _mostrarBotonNavEvento(resultado.evento);
    _actualizarWidgetFlotanteEvento();

    if (!resultado.modalVisto) {
      _mostrarModalInicioEvento(resultado.evento);
    }

  } catch (e) {
    console.error('Error al inicializar eventos:', e);
  }
}


// ────────────────────────────────────────────────────────────
// 2. BOTÓN "VER EVENTO" EN EL NAV
// TODO ID HTML: confirmar el id real del botón en el nav de cada
// rol. Asumo 'nav-btn-evento' como contenedor único reutilizado
// para ambos roles (autor y reseñador), oculto por default en el HTML.
// ────────────────────────────────────────────────────────────

function _mostrarBotonNavEvento(evento) {
  const btn = document.getElementById('nav-evento'); // sigue convención de nav-panel/nav-perfil/nav-admin
  if (!btn) return;
  btn.style.display = 'inline-block';
  btn.textContent = `💋 ${evento.nombre}`;
  btn.onclick = () => mostrarSeccion('evento'); // requiere case 'evento' en mostrarSeccion() (ui.js)
}

function _ocultarBotonNavEvento() {
  const btn = document.getElementById('nav-evento');
  if (btn) btn.style.display = 'none';
}


// ────────────────────────────────────────────────────────────
// 3. MODAL DE INICIO DEL EVENTO (con animación "besos cayendo")
// TODO ID HTML: confirmar ids de modal-evento-inicio, overlay,
// contenedor de texto y botón de cierre. Sigo el mismo patrón que
// mostrarModalActualizaciones() en auth.js (overlay + modal + body
// scroll lock), reutilizando #modal-overlay si es genérico.
// ────────────────────────────────────────────────────────────

function _mostrarModalInicioEvento(evento) {
  const contenedor = document.getElementById('modal-evento-inicio-contenido'); // TODO ID HTML
  const btnEntendido = document.getElementById('btn-modal-evento-entendido'); // TODO ID HTML

  if (!document.getElementById('modal-evento-inicio') || !contenedor || !btnEntendido) {
    console.warn('Faltan elementos del modal de evento en el HTML.');
    return;
  }

  contenedor.innerHTML = `
    <img src="${evento.imagenes.iconoBeso}" alt="" class="evento-modal-decoracion" />
    <h2 class="evento-modal-titulo">${evento.nombre}</h2>
    <p class="evento-modal-texto">${_escaparHtml(evento.textoModal).replace(/\n/g, '<br>')}</p>
  `;

  mostrarModal('modal-evento-inicio'); // patrón real de ui.js (classList 'activo')
  _iniciarAnimacionBesosCayendo(evento);

 btnEntendido.onclick = async () => {
    await supabaseClient.rpc('marcar_modal_evento_visto', {
      p_usuario: _EventosState.idUsuario,
      p_id_evento: evento.id
    });
    cerrarModales();
    _detenerAnimacionBesosCayendo();
    mostrarSeccion('evento');
  };
}

/**
 * Animación decorativa: íconos de beso cayendo dentro del modal.
 * TODO ID HTML: confirmar id del contenedor donde se inyectan los
 * elementos de la animación (asumo '#evento-modal-animacion', un
 * div absoluto/overflow-hidden dentro del modal).
 */
let _intervaloBesosCayendo = null;

function _iniciarAnimacionBesosCayendo(evento) {
  const contenedor = document.getElementById('evento-modal-animacion'); // TODO ID HTML
  if (!contenedor) return;

  contenedor.innerHTML = '';
  _detenerAnimacionBesosCayendo();

  _intervaloBesosCayendo = setInterval(() => {
    const beso = document.createElement('img');
    beso.src = evento.imagenes.iconoBeso;
    beso.className = 'evento-beso-cayendo';
    beso.style.left = `${Math.random() * 100}%`;
    beso.style.animationDuration = `${2 + Math.random() * 2}s`;
    beso.style.opacity = `${0.5 + Math.random() * 0.5}`;
    contenedor.appendChild(beso);

    setTimeout(() => beso.remove(), 4000);
  }, 300);
}

function _detenerAnimacionBesosCayendo() {
  if (_intervaloBesosCayendo) {
    clearInterval(_intervaloBesosCayendo);
    _intervaloBesosCayendo = null;
  }
}


// ────────────────────────────────────────────────────────────
// 4. PÁGINA DEL EVENTO (sección completa con los retos)
// TODO ID HTML: confirmar id del contenedor de la sección 'evento'
// y agregar el case correspondiente en mostrarSeccion() (ui.js).
// Asumo '#seccion-evento' siguiendo el patrón de otras secciones.
// ────────────────────────────────────────────────────────────

async function renderPaginaEvento() {
  const contenedor = document.getElementById('seccion-evento');
  if (!contenedor) return;

  if (!_EventosState.eventoActivo) {
    contenedor.innerHTML = `<p class="evento-vacio">No hay ningún evento activo en este momento.</p>`;
    return;
  }

    // ← AGREGAR: pantalla de carga mientras se espera al backend
  contenedor.innerHTML = `
    <div class="cargando-container">
      <div class="spinner"></div>
      <p>Cargando evento...</p>
    </div>
  `;

  // Refresca el evento y el progreso al entrar a la página (puede haber
  // cambiado desde que se cargó la app: otro admin activó un evento
  // nuevo, o el usuario aprobó un reseñador, etc.)
  const { data: resultado, error } = await supabaseClient.rpc('inicializar_evento_usuario', {
    p_usuario: _EventosState.idUsuario,
    p_rol: _EventosState.rol
  });

  if (error || !resultado || !resultado.activo) {
    contenedor.innerHTML = `<p class="evento-vacio">Este evento ya finalizó.</p>`;
    _actualizarWidgetFlotanteEvento();
    return;
  }

  _EventosState.eventoActivo = resultado.evento;
  const evento = _EventosState.eventoActivo;

  const progresoAnterior = _EventosState.progreso;
  _EventosState.progreso = resultado.progreso;
  const progreso = _EventosState.progreso;

  const yaEstabaCompleto = progresoAnterior && progresoAnterior.eventoCompleto;
  const recienCompletado = progreso.eventoCompleto && !yaEstabaCompleto;

  // Fase 5: detecta reto por reto (no solo el evento entero) comparando
  // contra el progreso anterior, y dispara el evento global desacoplado.
  if (progresoAnterior) {
    progreso.retos.forEach((reto, i) => {
      const retoAnterior = progresoAnterior.retos[i];
      if (reto.completo && retoAnterior && !retoAnterior.completo) {
        window.dispatchEvent(new CustomEvent('evento:retoCompletado', {
          detail: { reto, indice: i, evento, tipo: evento.tema?.particula }
        }));
      }
    });
  }

  contenedor.innerHTML = `
    <div class="evento-banner" style="background-image:url('${evento.imagenes.banner}')">
      <h1>${evento.nombre}</h1>
    </div>

    <div class="evento-historia">
      <h3>${_EVENTOS_TITULO_HISTORIA}</h3>
      <p>${evento.historia}</p>
    </div>

    <div class="evento-insignia-preview">
      <img src="${progreso.eventoCompleto ? evento.imagenes.insigniaColor : evento.imagenes.insigniaGris}" alt="Insignia ${evento.nombre}" />
      <p>${progreso.eventoCompleto ? '¡Insignia conseguida!' : `Puntos acumulados: ${progreso.puntosAcumulados}`}</p>
    </div>

    <div class="evento-progreso-wrap">
      ${_renderBarraProgresoEvento()}
      ${_renderTiempoRestanteEvento()}
    </div>

    ${_renderMapaOListaRetos(evento, progreso)}
    <div id="evento-mapa-detalle"></div>
  `;

  document.getElementById('evento-mapa-detalle').innerHTML =
  _renderDetalleNodoMapa(progreso, _indicePrimerRetoActivo(progreso));

  _actualizarWidgetFlotanteEvento();

  if (recienCompletado) {
    _mostrarAnimacionEventoCompletado(evento, progreso);
  }
}

function _renderCardReto(reto) {
  const estadoClase = reto.completo
    ? 'evento-reto--completo'
    : reto.desbloqueado
      ? 'evento-reto--activo'
      : 'evento-reto--bloqueado';

  return `
    <div class="evento-reto ${estadoClase}">
      <div class="evento-reto-header">
        <span class="evento-reto-nombre">${reto.nombre}</span>
        <span class="evento-reto-puntos">+${reto.puntos} pts</span>
      </div>
      ${!reto.desbloqueado ? `<p class="evento-reto-bloqueado-msg">🔒 Completá el reto anterior para desbloquear</p>` : ''}
      <ul class="evento-subretos-lista">
        ${reto.subRetos.map(sub => `
          <li class="evento-subreto ${sub.completo ? 'evento-subreto--completo' : ''}">
            <span class="evento-subreto-check">${sub.completo ? '✓' : '○'}</span>
            <span class="evento-subreto-desc">${sub.descripcion}</span>
            <span class="evento-subreto-progreso">${sub.cantidadActual}/${sub.meta}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

/**
 * Decide si mostrar el mapa nuevo (Fase 3) o la lista vieja, según si
 * el evento tiene tema.mapa cargado. Eventos viejos (sin tema) siguen
 * viendo la lista de tarjetas de siempre.
 */
function _renderMapaOListaRetos(evento, progreso) {
  const nodos = evento.tema?.mapa?.nodos;
  const tieneMapa = evento.tema?.mapa?.fondo && Array.isArray(nodos) && nodos.length === 4;

  if (!tieneMapa) {
    return `<div class="evento-retos-lista">${progreso.retos.map(reto => _renderCardReto(reto)).join('')}</div>`;
  }
  return _renderMapaRetos(evento, progreso, nodos);
}

// Radio de revelado del velo alrededor de cada nodo desbloqueado (0 a 1, fracción del mapa)
const _EVENTO_MAPA_RADIO_VELO = 0.16;

function _renderMapaRetos(evento, progreso, nodos) {
  const maskId = `evento-velo-mask-${evento.id}`;

  const circulosRevelados = progreso.retos.map((reto, i) => {
    if (!reto.desbloqueado || !nodos[i]) return '';
    const n = nodos[i];
    return `<circle cx="${n.x / 100}" cy="${n.y / 100}" r="${_EVENTO_MAPA_RADIO_VELO}" fill="black" />`;
  }).join('');

  const marcadores = progreso.retos.map((reto, i) => {
    const n = nodos[i];
    if (!n) return '';
    const estado = reto.completo ? 'completo' : reto.desbloqueado ? 'activo' : 'bloqueado';
    const contenido = reto.completo ? '✓' : (reto.desbloqueado ? (i + 1) : '🔒');
    return `
      <button type="button"
        class="evento-mapa-nodo evento-mapa-nodo--${estado}"
        style="left:${n.x}%; top:${n.y}%;"
        onclick="_seleccionarNodoMapaEvento(${i})"
        ${!reto.desbloqueado ? 'disabled' : ''}
        aria-label="${_escaparHtml(reto.nombre)}">
        <span class="evento-mapa-nodo-contenido">${contenido}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="evento-mapa-contenedor">
      <img class="evento-mapa-fondo" src="${evento.tema.mapa.fondo}" alt="" />
      ${evento.tema.mapa.velo ? `
        <svg width="0" height="0" style="position:absolute;">
          <defs>
            <mask id="${maskId}" maskContentUnits="objectBoundingBox">
              <rect x="0" y="0" width="1" height="1" fill="white" />
              ${circulosRevelados}
            </mask>
          </defs>
        </svg>
        <img class="evento-mapa-velo" src="${evento.tema.mapa.velo}" alt=""
          style="mask:url(#${maskId}); -webkit-mask:url(#${maskId});" />
      ` : ''}
      <div class="evento-mapa-nodos">${marcadores}</div>
    </div>
  `;
}

function _indicePrimerRetoActivo(progreso) {
  const idx = progreso.retos.findIndex(r => r.desbloqueado && !r.completo);
  if (idx !== -1) return idx;
  for (let i = progreso.retos.length - 1; i >= 0; i--) {
    if (progreso.retos[i].desbloqueado) return i;
  }
  return 0;
}

function _seleccionarNodoMapaEvento(idx) {
  const contenedor = document.getElementById('evento-mapa-detalle');
  if (contenedor) contenedor.innerHTML = _renderDetalleNodoMapa(_EventosState.progreso, idx);
}

function _renderDetalleNodoMapa(progreso, idx) {
  const reto = progreso.retos[idx];
  return reto ? _renderCardReto(reto) : '';
}


// ────────────────────────────────────────────────────────────
// 5. ANIMACIÓN DE EVENTO COMPLETADO (insignia ganada)
// TODO ID HTML: confirmar ids del modal de "evento completado".
// Reutilizo el patrón del modal de inicio.
// ────────────────────────────────────────────────────────────

function _mostrarAnimacionEventoCompletado(evento, progreso) {
  const contenedor = document.getElementById('modal-evento-completado-contenido'); // TODO ID HTML

  if (!document.getElementById('modal-evento-completado') || !contenedor) {
    mostrarToast(`¡Completaste el evento ${evento.nombre}! +${progreso.puntosAcumulados} puntos`, 'ok');
    return;
  }

  contenedor.innerHTML = `
    <img src="${evento.imagenes.insigniaColor}" alt="Insignia" class="evento-insignia-grande" />
    <h2>¡Completaste ${evento.nombre}!</h2>
    <p>Ganaste la insignia exclusiva y +${progreso.puntosAcumulados} puntos.</p>
    <button id="btn-cerrar-evento-completado" class="btn btn-primario">¡Genial!</button>
  `;

  mostrarModal('modal-evento-completado'); // patrón real de ui.js
  _dispararParticulaEvento(evento.tema?.particula, 'evento-completado-animacion');

  document.getElementById('btn-cerrar-evento-completado').onclick = () => {
    cerrarModales();
  };
}

// ────────────────────────────────────────────────────────────
// 6. REGISTRO DE ACCIONES DIRECTAS
// Llamar a esta función desde los puntos del frontend donde ocurren
// acciones sin hoja propia: revisar_perfil_autor, revisar_perfil_reseñador,
// leer_pdf. Es fire-and-forget: no bloquea la UI ni rompe el flujo
// si el evento no está activo (el backend ya valida internamente,
// pero acá cortamos antes para no spamear llamadas innecesarias).
//
// Uso: registrarAccionEventoSiCorresponde('revisar_perfil_autor');
// ────────────────────────────────────────────────────────────

async function registrarAccionEventoSiCorresponde(accion) {
  try {
    if (!_EventosState.eventoActivo || !_EventosState.idUsuario) return;

    await supabaseClient.rpc('registrar_accion_directa_evento', {
      p_usuario: _EventosState.idUsuario,
      p_id_evento: _EventosState.eventoActivo.id,
      p_accion: accion
    });

    // Refresca el progreso local en silencio (no repinta la UI a menos
    // que el usuario esté parado en la página del evento)
    const seccionEvento = document.getElementById('seccion-evento');
    if (seccionEvento && seccionEvento.style.display !== 'none') {
      renderPaginaEvento();
    } else {
      _actualizarWidgetFlotanteEvento();
    }

  } catch (e) {
    console.error('Error registrando acción de evento:', e);
  }
}

/**
 * Devuelve el HTML del resumen de evento para insertar en la página
 * de perfil. Llamar desde tu función de render de perfil, ej:
 *   document.getElementById('perfil-evento-resumen').innerHTML = renderResumenEventoPerfil();
 * TODO ID HTML: confirmar el id del contenedor en tu perfil.js.
 */
function renderResumenEventoPerfil() {
  const r = _resumenEvento();
  if (!r) return '';
  return `
    <div class="perfil-evento-resumen">
      <p class="perfil-evento-resumen-titulo">💋 ${r.nombre}</p>
      <div class="evento-barra-progreso">
        <div class="evento-barra-progreso-relleno" style="width:${r.porcentaje}%;"></div>
      </div>
      <p class="perfil-evento-resumen-datos">${r.retosCompletados}/${r.retosTotales} retos · ${r.puntosAcumulados} pts ${r.diasRestantes !== null ? `· ${r.diasRestantes}d restantes` : ''}</p>
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function _escaparHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const _EVENTO_PARTICULAS_VALIDAS = ['confeti', 'corazones', 'nieve', 'chocolate'];

function _dispararParticulaEvento(tipo, idContenedor) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;

  const particula = _EVENTO_PARTICULAS_VALIDAS.includes(tipo) ? tipo : 'confeti';
  const emojis = {
    confeti: ['🎉', '✨', '🎊'],
    corazones: ['💕', '💖', '💗'],
    nieve: ['❄️', '❅', '❆'],
    chocolate: ['🍫', '🍬']
  };
  const set = emojis[particula];

  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      const el = document.createElement('span');
      el.textContent = set[Math.floor(Math.random() * set.length)];
      el.className = 'evento-particula-cayendo';
      el.style.left = `${Math.random() * 100}%`;
      el.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
      el.style.fontSize = `${14 + Math.random() * 10}px`;
      contenedor.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }, i * 60);
  }
}


/**
 * Única fuente de verdad para las 4 piezas de la Fase 4 (barra de
 * progreso, tiempo restante, widget flotante, resumen en perfil).
 * Se recalcula cada vez que cambia _EventosState (no se cachea entre
 * refrescos, para no mostrar datos viejos).
 */
function _resumenEvento() {
  const evento = _EventosState.eventoActivo;
  const progreso = _EventosState.progreso;
  if (!evento || !progreso) return null;

  const retosTotales = progreso.retos.length;
  const retosCompletados = progreso.retos.filter(r => r.completo).length;

  return {
    id: evento.id,
    nombre: evento.nombre,
    diasRestantes: evento.diasRestantes ?? null,
    retosCompletados,
    retosTotales,
    retosRestantes: retosTotales - retosCompletados,
    porcentaje: retosTotales ? Math.round((retosCompletados / retosTotales) * 100) : 0,
    puntosAcumulados: progreso.puntosAcumulados,
    eventoCompleto: progreso.eventoCompleto
  };
}

// FIX: barra de progreso y tiempo restante — antes quedaban declaradas
// adentro del template literal de renderPaginaEvento() y nunca existían
// como funciones reales (ReferenceError al llamarlas).
function _renderBarraProgresoEvento() {
  const r = _resumenEvento();
  if (!r) return '';
  return `
    <div class="evento-barra-progreso">
      <div class="evento-barra-progreso-relleno" style="width:${r.porcentaje}%;"></div>
      <span class="evento-barra-progreso-texto">${r.retosCompletados}/${r.retosTotales} retos · ${r.porcentaje}%</span>
    </div>
  `;
}

function _renderTiempoRestanteEvento() {
  const r = _resumenEvento();
  if (!r || r.diasRestantes === null) return '';
  const texto = r.diasRestantes === 0 ? '¡Último día!' : r.diasRestantes === 1 ? '1 día restante' : `${r.diasRestantes} días restantes`;
  return `<p class="evento-tiempo-restante">${texto}</p>`;
}

// FIX: widget flotante — antes estaba pegado 3 veces, cada copia anidada
// dentro de otra función (alcance local, nunca invocada). Ahora es una
// sola función de módulo, llamada desde inicializarEventos(),
// renderPaginaEvento() y registrarAccionEventoSiCorresponde().
function _asegurarWidgetFlotanteEvento() {
  if (document.getElementById('evento-widget-flotante')) return;
  const div = document.createElement('div');
  div.id = 'evento-widget-flotante';
  div.style.display = 'none';
  div.onclick = () => mostrarSeccion('evento');
  document.body.appendChild(div);
}

function _actualizarWidgetFlotanteEvento() {
  _asegurarWidgetFlotanteEvento();
  const widget = document.getElementById('evento-widget-flotante');
  const r = _resumenEvento();

  if (!r) { widget.style.display = 'none'; return; }

  widget.style.display = 'flex';
  widget.innerHTML = `
    <span class="evento-widget-nombre">💋 ${r.nombre}</span>
    <span class="evento-widget-dato">${r.diasRestantes ?? '?'}d</span>
    <span class="evento-widget-dato">${r.retosRestantes} retos</span>
    <button type="button" class="evento-widget-boton" onclick="event.stopPropagation(); mostrarSeccion('evento');">Ver evento</button>
  `;
}

// ────────────────────────────────────────────────────────────
// 7. ANIMACIÓN GLOBAL (Fase 5) — se ve sin importar la sección,
// porque #header-animacion-global está siempre en el DOM.
// ────────────────────────────────────────────────────────────

window.addEventListener('evento:retoCompletado', (e) => {
  _dispararParticulaEvento(e.detail.tipo, 'header-animacion-global');
});
