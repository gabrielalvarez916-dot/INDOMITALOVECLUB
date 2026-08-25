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
  progresoComunitario: null, // progreso de la meta comunitaria (solo evento GranMaraton)
  rol: null,              // rol del usuario actual ('autor' | 'reseñador')
  idUsuario: null,        // ID_Usuario actual (Sesion.obtener().id)
  timerSecreto: null,     // Fase 7: id del setTimeout del secreto flotante
  timerCountdown: null,    // id del setInterval del contador días/horas/minutos
  timerPolling: null,   //
  promesaInit: null,       // promesa de inicializarEventos(), para poder esperarla desde el orquestador de onboarding
  modalPendiente: false,   // true si hay un modal de inicio de evento sin ver, pendiente de mostrarse en la secuencia de onboarding
  eventoParaModal: null    // datos del evento a mostrar en el modal pendiente
};

// Callback del orquestador de onboarding (auth.js) que hay que avisar
// cuando el modal de inicio de evento se cierra (o cuando no había nada
// que mostrar). Ver mostrarModalEventoSiCorrespondeYAvanzar().
let _EventosOnFinalizarCallback = null;

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

    // Autor, reseñador y editorial tienen retos de evento (admin no participa)
if (usuario.rol !== 'autor' && usuario.rol !== 'reseñador' && usuario.rol !== 'editorial') return;

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
      _detenerTimerSecretoEvento();
      _detenerTimerCountdownEvento();
      _detenerPollingEventoGlobal();   // ← LÍNEA NUEVA
      _restablecerColorTemaEvento();
      _EventosState.modalPendiente = false;
      _EventosState.eventoParaModal = null;
      return;
    }

    _EventosState.eventoActivo = resultado.evento;
    _EventosState.progreso = resultado.progreso;

    _aplicarColorTemaEvento(resultado.evento);
    _mostrarBotonNavEvento(resultado.evento);
    _actualizarWidgetFlotanteEvento();
    _iniciarTimerSecretoEvento(resultado.evento);
    _iniciarTimerCountdownEvento();
    _iniciarPollingEventoGlobal();   // ← LÍNEA NUEVA

    // IMPORTANTE: ya NO se muestra el modal acá directamente. Antes esto
    // disparaba el modal apenas terminaba esta llamada (sin esperar a que
    // el wizard/tutorial terminaran), y como el modal de evento usa el
    // sistema genérico de modales (z-index bajo), quedaba abierto "de
    // fondo" tapado por el wizard/tutorial y aparecía de golpe después,
    // fuera de orden. Ahora solo guardamos que está pendiente; quien
    // decide CUÁNDO mostrarlo es el orquestador de onboarding en auth.js,
    // vía mostrarModalEventoSiCorrespondeYAvanzar().
    _EventosState.modalPendiente = !resultado.modalVisto;
    _EventosState.eventoParaModal = resultado.evento;

  } catch (e) {
    console.error('Error al inicializar eventos:', e);
    _EventosState.modalPendiente = false;
    _EventosState.eventoParaModal = null;
  }
}

// ────────────────────────────────────────────────────────────
// PASO "EVENTO" DE LA SECUENCIA DE ONBOARDING
// Llamado por el orquestador (auth.js) cuando le toca el turno al
// evento. Espera a que inicializarEventos() haya terminado (por si
// la RPC todavía no volvió), muestra el modal si corresponde, y
// avisa a onFinalizar cuando termina (se cierra el modal, o de una
// si no había nada que mostrar).
// ────────────────────────────────────────────────────────────
async function mostrarModalEventoSiCorrespondeYAvanzar(onFinalizar) {
  try {
    if (_EventosState.promesaInit) await _EventosState.promesaInit;
  } catch (e) {
    console.error('Error esperando inicialización de eventos:', e);
  }

  if (_EventosState.modalPendiente && _EventosState.eventoParaModal) {
    _EventosOnFinalizarCallback = onFinalizar || null;
    _mostrarModalInicioEvento(_EventosState.eventoParaModal);
  } else {
    onFinalizar?.();
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
  btn.textContent = '💋 Evento';
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
  document.getElementById('evento-widget-flotante')?.style.setProperty('display', 'none', 'important');
  _iniciarAnimacionBesosCayendo(evento);

 btnEntendido.onclick = async () => {
    await supabaseClient.rpc('marcar_modal_evento_visto', {
      p_usuario: _EventosState.idUsuario,
      p_id_evento: evento.id
    });
    _EventosState.modalPendiente = false;
    cerrarModales();
    _detenerAnimacionBesosCayendo();
    mostrarSeccion('evento');

    const cb = _EventosOnFinalizarCallback;
    _EventosOnFinalizarCallback = null;
    cb?.();
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

/**
 * Única fuente de verdad para refrescar el progreso del evento activo
 * contra el backend, sin importar en qué pantalla esté el usuario.
 * Antes, la detección de "reto recién completado" (partícula global +
 * mensaje de mascota) vivía SOLO adentro de renderPaginaEvento(), así
 * que si el usuario completaba un reto desde otra pantalla, nunca se
 * enteraba. Ahora esta función corre siempre, la llame quien la llame.
 */
async function _refrescarProgresoEventoGlobal() {
  const { data: resultado, error } = await supabaseClient.rpc('inicializar_evento_usuario', {
    p_usuario: _EventosState.idUsuario,
    p_rol: _EventosState.rol
  });

  if (error || !resultado || !resultado.activo) {
    _EventosState.eventoActivo = null;
    _EventosState.progreso = null;
    _EventosState.progresoComunitario = null;
    _actualizarWidgetFlotanteEvento();
    _restablecerColorTemaEvento();
    return { resultado, recienCompletado: false };
  }

  _EventosState.eventoActivo = resultado.evento;
  const evento = _EventosState.eventoActivo;
  _aplicarColorTemaEvento(evento);

  // Meta comunitaria: SOLO existe para el evento "La Gran Maratón".
  // En cualquier otro evento, progresoComunitario queda en null y el
  // contador comunitario no se renderiza (ver _renderBarraProgresoComunitario).
  if (evento.id === 'GranMaraton') {
    const { data: comunitario } = await supabaseClient.rpc('obtener_progreso_comunitario', {
      p_id_evento: evento.id
    });
    _EventosState.progresoComunitario = comunitario || null;
  } else {
    _EventosState.progresoComunitario = null;
  }

  const progresoAnterior = _EventosState.progreso;
  _EventosState.progreso = resultado.progreso;
  const progreso = _EventosState.progreso;

  const yaEstabaCompleto = progresoAnterior && progresoAnterior.eventoCompleto;
  const recienCompletado = progreso.eventoCompleto && !yaEstabaCompleto;

  if (progresoAnterior) {
    progreso.retos.forEach((reto, i) => {
      const retoAnterior = progresoAnterior.retos[i];
      if (reto.completo && retoAnterior && !retoAnterior.completo) {
        window.dispatchEvent(new CustomEvent('evento:retoCompletado', {
          detail: { reto, indice: i, evento, imagen: evento.tema?.particula?.imagen }
        }));
        _mostrarMensajeMascotaSiCorresponde(evento, reto);
      }
    });
  }

  _actualizarWidgetFlotanteEvento();

  return { resultado, recienCompletado };
}

async function renderPaginaEvento(datosFrescos) {
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

  const { resultado, recienCompletado } = datosFrescos || await _refrescarProgresoEventoGlobal();

  if (!resultado || !resultado.activo) {
    contenedor.innerHTML = `<p class="evento-vacio">Este evento ya finalizó.</p>`;
    return;
  }

  const evento = _EventosState.eventoActivo;
  const progreso = _EventosState.progreso;

  const tieneMapaVisual = !!(evento.tema?.mapa?.fondo && Array.isArray(evento.tema?.mapa?.nodos) && evento.tema.mapa.nodos.length > 0);
  const bloqueInsignia = `
    <div class="evento-insignia-preview">
      <img src="${progreso.eventoCompleto ? evento.imagenes.insigniaColor : evento.imagenes.insigniaGris}" alt="Insignia ${evento.nombre}" />
      <p>${progreso.eventoCompleto ? '¡Insignia conseguida!' : `Puntos acumulados: ${progreso.puntosAcumulados}`}</p>
    </div>
  `;

  const bloqueProgreso = `
    <div class="evento-progreso-wrap">
      ${_renderBarraProgresoComunitario()}
      ${_renderBarraProgresoEvento()}
      ${_renderTiempoRestanteEvento()}
    </div>
  `;

  contenedor.innerHTML = `
    <div class="evento-banner" style="background-image:url('${evento.imagenes.banner}')">
      <h1>${evento.nombre}</h1>
    </div>

    <div class="evento-historia">
      <h3>${_EVENTOS_TITULO_HISTORIA}</h3>
      <p>${evento.historia}</p>
    </div>

    ${bloqueInsignia}
    ${bloqueProgreso}

    ${_renderMapaOListaRetos(evento, progreso)}
  `;
  
  // En renderPaginaEvento(), donde dice:
if (tieneMapaVisual) {
  document.getElementById('evento-mapa-detalle').innerHTML =
    _renderDetalleNodoMapa(progreso, _indicePrimerRetoActivo(progreso), evento.tema.mapa.nodos);
  _ajustarPopoverDentroDelMapa(); // ← AGREGAR esta línea
}

  _actualizarWidgetFlotanteEvento();
  if (recienCompletado) {
    _mostrarAnimacionEventoCompletado(evento, progreso);
  }
}

// Registro de minijuegos por número de orden del reto (1 a 5, Jardín de
// Primavera). Cada función vive en eventos-juegos.js y se autoregistra acá.
// Convención OBLIGATORIA para el panel admin de este evento: el subReto
// en la posición 0 (el primero) de cada reto es SIEMPRE el "juego", y su
// campo Acción debe cargarse exactamente como 'juego1_completado',
// 'juego2_completado', ... 'juego5_completado' (según el orden del reto).
/**
 * Cierra el modal de un minijuego de evento. A diferencia de cerrarModales()
 * simple, esto SIEMPRE refresca el progreso y re-renderiza el mapa — así,
 * si el usuario abandona el juego a la mitad (sin ganarlo), la carta vuelve
 * a mostrarse boca abajo (dorso) en vez de quedar visualmente "dada vuelta"
 * por la animación previa al juego. Si en cambio ya lo había ganado, la
 * carta va a mostrar correctamente el reto pendiente.
 */
function _cerrarModalJuegoEvento() {
  cerrarModales();
  _refrescarProgresoEventoGlobal().then((datosFrescos) => {
    const seccionEvento = document.getElementById('seccion-evento');
    if (seccionEvento && seccionEvento.style.display !== 'none') {
      renderPaginaEvento(datosFrescos);
    }
  });
}

const EventosJuegos = {};

function _renderCardReto(reto) {
  const estadoClase = reto.completo
    ? 'evento-reto--completo'
    : reto.desbloqueado
      ? 'evento-reto--activo'
      : 'evento-reto--bloqueado';

  // Un reto solo "es un juego" si su primer sub-reto tiene EXACTAMENTE la
  // acción juego{orden}_completado (no alcanza con que coincida el número
  // de orden, porque otros eventos como GranMaraton también numeran sus
  // retos 1, 2, 3... y no deben mostrar el botón Jugar).
  const subRetoJuego = reto.subRetos && reto.subRetos[0];
  const esAccionDeJuego = !!subRetoJuego && subRetoJuego.accion === `juego${reto.orden}_completado`;
  const juegoFn = esAccionDeJuego ? EventosJuegos[reto.orden] : null;
  const tieneJuego = !!juegoFn;

  const subRetosParaLista = tieneJuego ? reto.subRetos.slice(1) : reto.subRetos;

  return `
    <div class="evento-reto ${estadoClase}">
      <div class="evento-reto-header">
        <span class="evento-reto-nombre">${reto.nombre}</span>
        <span class="evento-reto-puntos">+${reto.puntos} pts</span>
      </div>
      ${!reto.desbloqueado ? `<p class="evento-reto-bloqueado-msg">🔒 Completá el reto anterior para desbloquear</p>` : ''}
      ${tieneJuego && reto.desbloqueado ? `
        <div class="evento-reto-juego">
          ${subRetoJuego.completo
            ? `<p class="evento-subreto evento-subreto--completo"><span class="evento-subreto-check">✓</span><span class="evento-subreto-desc">${subRetoJuego.descripcion}</span></p>`
            : `<button type="button" class="btn-primario btn-sm" onclick="EventosJuegos[${reto.orden}]()">🎮 Jugar</button>`}
        </div>
      ` : ''}
      ${(!tieneJuego || subRetoJuego.completo) ? `
      <ul class="evento-subretos-lista">
        ${subRetosParaLista.map(sub => `
          <li class="evento-subreto ${sub.completo ? 'evento-subreto--completo' : ''}">
            <span class="evento-subreto-check">${sub.completo ? '✓' : '○'}</span>
            <span class="evento-subreto-desc">${sub.descripcion}</span>
            <span class="evento-subreto-progreso">${sub.cantidadActual}/${sub.meta}</span>
          </li>
        `).join('')}
      </ul>` : ''}
    </div>
  `;
}

/**
 * Decide si mostrar el mapa nuevo (Fase 3) o la lista vieja, según si
 * el evento tiene tema.mapa cargado. Eventos viejos (sin tema) siguen
 * viendo la lista de tarjetas de siempre.
 */
function _renderMapaOListaRetos(evento, progreso) {
  if (evento.tema?.mapa?.tipo === 'cartas') {
    return _renderMapaCartas(progreso, evento.tema?.mapa?.fondo || '', evento.tema?.mapa?.frente || '');
  }

  const nodos = evento.tema?.mapa?.nodos;
  const tieneMapa = evento.tema?.mapa?.fondo && Array.isArray(nodos) && nodos.length > 0;

  if (!tieneMapa) {
    return `<div class="evento-retos-lista">${progreso.retos.map(reto => _renderCardReto(reto)).join('')}</div>`;
  }
  return _renderMapaRetos(evento, progreso, nodos);
}

// ────────────────────────────────────────────────────────────
// Mapa tipo "cartas": una carta genérica por reto, en fila horizontal.
// - Bloqueada (🔒): hasta completar el reto anterior, no se puede tocar.
// - Desbloqueada, juego sin ganar (🌸): al tocarla se da vuelta con
//   animación y arranca DIRECTO el juego (sin botón intermedio).
// - Juego ganado pero falta el reto real (revisar perfil, postularse,
//   etc.): la carta queda dada vuelta mostrando esa consigna pendiente
//   adentro, ya no es clickeable (esa acción se hace en otra parte de
//   la plataforma).
// - Reto 100% completo (juego + reto real): la carta queda dada vuelta
//   mostrando un tilde grande, de forma permanente.
// ────────────────────────────────────────────────────────────

// Un ícono por juego, relacionado a la temática de cada reto (en vez del
// mismo genérico para los 5). Si en el futuro hay más de 5 retos, cae a
// una flor genérica como default.
const _ICONOS_CARTA_MAPA = {
  1: '🌱', // El primer brote — memoria de tapas
  2: '🌿', // Raíces enredadas — ordenar portadas
  3: '🌸', // Flores gemelas — memotest de parejas
  4: '🌼', // Polen y pétalos — unir tropes con portadas
  5: '🌻', // El jardín florecido — memoria rápida
};

function _renderMapaCartas(progreso, fondo, imagenFrente) {
  const total = progreso.retos.length;
  const estiloFrenteCarta = imagenFrente
    ? `background-image:linear-gradient(rgba(255,255,255,0.45), rgba(255,255,255,0.45)), url('${imagenFrente}'); background-size:cover; background-position:center;`
    : 'background:#fff;';
  const cartas = progreso.retos.map((reto, idx) => {
    const subRetoJuego = reto.subRetos && reto.subRetos[0];
    const juegoGanado = !!subRetoJuego?.completo;
    const retoPendiente = (reto.subRetos || []).slice(1).find(sr => !sr.completo);
    const iconoJuego = _ICONOS_CARTA_MAPA[reto.orden] || '✨';

    const estado = reto.completo ? 'completo' : reto.desbloqueado ? 'activo' : 'bloqueado';
    // Se ve "dada vuelta" apenas se gana el juego (para mostrar el reto
    // pendiente adentro), y se queda así para siempre una vez completo.
    const yaRevelada = juegoGanado || reto.completo;
    const puedeJugar = reto.desbloqueado && subRetoJuego && !juegoGanado && !!EventosJuegos[reto.orden];

    // El reto real (no el juego) es siempre subRetos[1]; se usa tanto para
    // mostrar lo que falta como, una vez completo, lo que se cumplió — así
    // la carta nunca queda "vacía" (solo un ✓) y siempre se puede leer qué
    // reto fue el que se resolvió.
    const retoReal = (reto.subRetos || [])[1];

    let contenidoFrente; // lo que se ve del lado revelado
    if (reto.completo) {
      contenidoFrente = `
        <div style="padding:14px; text-align:center;">
          <span style="font-size:34px; display:block; margin-bottom:8px; color:var(--bordo, #8B1A2B);">✓</span>
          ${retoReal ? `<span style="font-size:15px; line-height:1.3; color:var(--gris-texto, #2A2A2A); font-weight:600;">${_escaparHtml(retoReal.descripcion)}</span>` : ''}
        </div>
      `;
    } else if (juegoGanado && retoPendiente) {
      contenidoFrente = `
        <div style="padding:14px; text-align:center;">
          <span style="font-size:34px; display:block; margin-bottom:8px;">🎯</span>
          <span style="font-size:15px; line-height:1.3; color:var(--gris-texto, #2A2A2A); font-weight:600;">${_escaparHtml(retoPendiente.descripcion)}</span>
        </div>
      `;
    } else {
      contenidoFrente = `<span style="font-size:34px; font-weight:700; color:var(--gris-texto, #2A2A2A);">✓</span>`;
    }

    // La última carta (5ta) ocupa las dos columnas y queda centrada abajo.
    const esUltima = idx === total - 1;
    const estiloItem = esUltima
      ? 'text-align:center; width:150px; grid-column:1 / -1; justify-self:center;'
      : 'text-align:center; width:150px;';

    return `
      <div class="evento-carta-mapa-item" style="${estiloItem}">
        <div id="evento-carta-mapa-${reto.orden}"
          class="evento-carta-mapa evento-carta-mapa--${estado}"
          data-orden="${reto.orden}"
          data-desbloqueado="${reto.desbloqueado ? '1' : '0'}"
          data-juego-ganado="${juegoGanado ? '1' : '0'}"
          onclick="_tocarCartaMapaEvento(${reto.orden})"
          style="position:relative; width:100%; aspect-ratio:2/3; margin:0 auto; perspective:600px; cursor:${puedeJugar ? 'pointer' : 'default'};">
          <div style="position:absolute; inset:0; transition:transform 0.5s; transform-style:preserve-3d; transform:${yaRevelada ? 'rotateY(180deg)' : 'rotateY(0deg)'};">
            <div style="position:absolute; inset:0; backface-visibility:hidden; border-radius:14px; background:linear-gradient(135deg, var(--evento-color, #e05a8a), var(--evento-color, #e05a8a)); display:flex; align-items:center; justify-content:center; font-size:50px; box-shadow:0 4px 14px rgba(0,0,0,0.18); opacity:${reto.desbloqueado ? '1' : '0.55'};">
              ${reto.desbloqueado ? iconoJuego : '🔒'}
            </div>
            <div style="position:absolute; inset:0; backface-visibility:hidden; transform:rotateY(180deg); border-radius:14px; ${estiloFrenteCarta} border:2px solid var(--evento-color, #e05a8a); display:flex; align-items:center; justify-content:center;">
              ${contenidoFrente}
            </div>
          </div>
        </div>
        <p style="font-size:13px; color:var(--gris-texto); font-weight:600; text-shadow:0 1px 4px rgba(255,255,255,0.85); margin-top:8px; line-height:1.25;">${_escaparHtml(reto.nombre)}</p>
      </div>
    `;
  }).join('');

  return `
    <div class="evento-mapa-cartas-contenedor">
      ${fondo ? `<img class="evento-mapa-fondo" src="${fondo}" alt="" />` : ''}
      <div class="evento-mapa-cartas-fila" style="position:relative; z-index:1; display:grid; grid-template-columns:repeat(2, 1fr); justify-items:center; gap:20px 16px; max-width:360px; padding:18px 10px;">
        ${cartas}
      </div>
    </div>
  `;
}

/**
 * Al tocar una carta desbloqueada con el juego todavía sin ganar: la
 * da vuelta con animación y, apenas termina, arranca directo el juego
 * de ese reto. Si está bloqueada, o el juego ya se ganó (con o sin el
 * reto real completo), no hace nada — ahí la carta solo muestra info.
 */
function _tocarCartaMapaEvento(orden) {
  const el = document.getElementById(`evento-carta-mapa-${orden}`);
  if (!el) return;
  if (el.dataset.desbloqueado !== '1' || el.dataset.juegoGanado === '1') return;
  if (typeof EventosJuegos[orden] !== 'function') return;

  const interior = el.firstElementChild;
  if (interior) interior.style.transform = 'rotateY(180deg)';

  setTimeout(() => {
    EventosJuegos[orden]();
  }, 500);
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
      <div id="evento-mapa-detalle"></div>
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

// En _seleccionarNodoMapaEvento():
function _seleccionarNodoMapaEvento(idx) {
  const contenedor = document.getElementById('evento-mapa-detalle');
  const nodos = _EventosState.eventoActivo?.tema?.mapa?.nodos;
  if (contenedor) {
    contenedor.innerHTML = _renderDetalleNodoMapa(_EventosState.progreso, idx, nodos);
    _ajustarPopoverDentroDelMapa(); // ← AGREGAR esta línea
  }
}
// DESPUÉS:
function _renderDetalleNodoMapa(progreso, idx, nodos) {
  const reto = progreso.retos[idx];
  if (!reto || !nodos || !nodos[idx]) return '';
  const n = nodos[idx];
  const abrirHaciaIzquierda = n.x > 50;
  const abrirHaciaArriba = n.y > 50;
  const tx = abrirHaciaIzquierda ? '-100%' : '0';
  const ty = abrirHaciaArriba ? 'calc(-100% - 14px)' : '14px';
  return `
    <div class="evento-mapa-popover" style="left:${n.x}%; top:${n.y}%; transform: translate(${tx}, ${ty});">
      ${_renderCardReto(reto)}
    </div>
  `;
}

/**
 * Corrige la posición del popover del reto si, después de insertarlo en
 * el DOM, se sale del contenedor del mapa (por ejemplo un nodo muy
 * pegado al borde izquierdo/derecho o arriba/abajo del todo). Se corre
 * DESPUÉS de insertar el HTML porque necesita medir el tamaño real ya
 * renderizado (que cambia según el ancho de pantalla).
 */
function _ajustarPopoverDentroDelMapa() {
  const contenedor = document.querySelector('.evento-mapa-contenedor');
  const popover = document.querySelector('.evento-mapa-popover');
  if (!contenedor || !popover) return;

  // Reseteamos cualquier corrección previa antes de medir de nuevo
  popover.style.marginLeft = '0px';
  popover.style.marginTop = '0px';

  const rectContenedor = contenedor.getBoundingClientRect();
  const rectPopover = popover.getBoundingClientRect();

  const margen = 8; // separación mínima respecto al borde del mapa
  let corrimientoX = 0;
  let corrimientoY = 0;

  if (rectPopover.left < rectContenedor.left + margen) {
    corrimientoX = (rectContenedor.left + margen) - rectPopover.left;
  } else if (rectPopover.right > rectContenedor.right - margen) {
    corrimientoX = (rectContenedor.right - margen) - rectPopover.right;
  }

  if (rectPopover.top < rectContenedor.top + margen) {
    corrimientoY = (rectContenedor.top + margen) - rectPopover.top;
  } else if (rectPopover.bottom > rectContenedor.bottom - margen) {
    corrimientoY = (rectContenedor.bottom - margen) - rectPopover.bottom;
  }

  if (corrimientoX !== 0) popover.style.marginLeft = `${corrimientoX}px`;
  if (corrimientoY !== 0) popover.style.marginTop = `${corrimientoY}px`;
}


// ────────────────────────────────────────────────────────────
// 5. ANIMACIÓN DE EVENTO COMPLETADO (insignia ganada)
// TODO ID HTML: confirmar ids del modal de "evento completado".
// Reutilizo el patrón del modal de inicio.
// ────────────────────────────────────────────────────────────

function _mostrarAnimacionEventoCompletado(evento, progreso) {
  const contenedor = document.getElementById('modal-evento-completado-contenido'); // TODO ID HTML

  if (!document.getElementById('modal-evento-completado') || !contenedor) {
    mostrarToast(`💅 Completaste "${evento.nombre}". +${progreso.puntosAcumulados} puntos. Nos gusta esta versión tuya.`, 'ok');
    return;
  }

  contenedor.innerHTML = `
    <img src="${evento.imagenes.insigniaColor}" alt="Insignia" class="evento-insignia-grande" />
    <h2>¡Completaste ${evento.nombre}!</h2>
    <p>Ganaste la insignia exclusiva y +${progreso.puntosAcumulados} puntos.</p>
    <button id="btn-cerrar-evento-completado" class="btn btn-primario">¡Genial!</button>
  `;

  mostrarModal('modal-evento-completado'); // patrón real de ui.js
  _dispararParticulaEvento(evento.tema?.particula?.imagen, 'evento-completado-animacion');

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

   // Refresca progreso SIEMPRE (esto ya dispara mascota/partícula si
    // corresponde, sin importar la pantalla) — sin bloquear la UI:
    // no se espera (no await), así la acción del usuario no queda
    // colgada esperando la respuesta de Supabase.
    _refrescarProgresoEventoGlobal().then((datosFrescos) => {
      const seccionEvento = document.getElementById('seccion-evento');
      if (seccionEvento && seccionEvento.style.display !== 'none') {
        renderPaginaEvento(datosFrescos);
      }
    });
    
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

// ── Color personalizado por evento (tema.colorPrincipal) ─────
// Se aplica como variables CSS en <html> para que lo usen tanto los
// elementos dentro de #seccion-evento (nodos, barra, contador) como
// los widgets flotantes que viven fuera de esa sección (agregados
// directo a document.body, como el widget flotante y el secreto).
const _EVENTO_COLOR_DEFAULT = '#e05a8a';

function _hexARgbString(hex) {
  const limpio = (hex || '').replace('#', '');
  const valido = /^[0-9a-fA-F]{6}$/.test(limpio) ? limpio : 'e05a8a';
  const r = parseInt(valido.substring(0, 2), 16);
  const g = parseInt(valido.substring(2, 4), 16);
  const b = parseInt(valido.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function _aplicarColorTemaEvento(evento) {
  const color = evento?.tema?.colorPrincipal || _EVENTO_COLOR_DEFAULT;
  document.documentElement.style.setProperty('--evento-color', color);
  document.documentElement.style.setProperty('--evento-color-rgb', _hexARgbString(color));
}

function _restablecerColorTemaEvento() {
  document.documentElement.style.setProperty('--evento-color', _EVENTO_COLOR_DEFAULT);
  document.documentElement.style.setProperty('--evento-color-rgb', _hexARgbString(_EVENTO_COLOR_DEFAULT));
}

const _CONFETI_GENERICO = ['🎉', '✨', '🎊'];

function _dispararParticulaEvento(imagenUrl, idContenedor) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;

  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      let el;
      if (imagenUrl) {
        el = document.createElement('img');
        el.src = imagenUrl;
        el.className = 'evento-particula-cayendo evento-particula-cayendo--img';
      } else {
        el = document.createElement('span');
        el.textContent = _CONFETI_GENERICO[Math.floor(Math.random() * _CONFETI_GENERICO.length)];
        el.className = 'evento-particula-cayendo';
        el.style.fontSize = `${14 + Math.random() * 10}px`;
      }
      el.style.left = `${Math.random() * 100}%`;
      el.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
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
    fechaFin: evento.fechaFin ?? null,
    diasRestantes: evento.diasRestantes ?? null,
    retosCompletados,
    retosTotales,
    retosRestantes: retosTotales - retosCompletados,
    porcentaje: retosTotales ? Math.round((retosCompletados / retosTotales) * 100) : 0,
    puntosAcumulados: progreso.puntosAcumulados,
    eventoCompleto: progreso.eventoCompleto
  };
}

// Contador comunitario: SOLO se muestra si el evento activo es
// "La Gran Maratón" (id === 'GranMaraton'). En cualquier otro evento
// (o si no hay progresoComunitario cargado) devuelve '' y no se ve nada.
function _renderBarraProgresoComunitario() {
  const evento = _EventosState.eventoActivo;
  const pc = _EventosState.progresoComunitario;

  if (!evento || evento.id !== 'GranMaraton') return '';
  if (!pc || !pc.esComunitario) return '';

  const metaAlcanzada = pc.porcentaje >= 100;

  return `
    <div class="evento-progreso-comunitario">
      <p class="evento-progreso-comunitario-titulo">🌍 Meta comunitaria</p>
      <div class="evento-barra-progreso evento-barra-progreso--comunitario">
        <div class="evento-barra-progreso-relleno" style="width:${pc.porcentaje}%;"></div>
        <span class="evento-barra-progreso-texto">${pc.puntosAcumulados}/${pc.metaComunitaria} pts · ${pc.porcentaje}%</span>
      </div>
      <p class="evento-progreso-comunitario-sub">
        ${metaAlcanzada ? '¡Meta comunitaria alcanzada! 🎉' : 'Puntos sumados entre tod@s l@s autores y reseñador@s'}
      </p>
    </div>
  `;
}

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

// El evento vale todo el día de `fechaFin` y corta a las 00:00 hora
// Argentina (UTC-3 fijo) del día siguiente. fechaFin llega como 'YYYY-MM-DD'.
function _finEventoTimestamp(fechaFin) {
  const [y, m, d] = fechaFin.split('-').map(Number);
  return Date.UTC(y, m - 1, d + 1, 3, 0, 0);
}

function _renderTiempoRestanteEvento() {
  const r = _resumenEvento();
  if (!r || !r.fechaFin) return '';

  const restanteMs = _finEventoTimestamp(r.fechaFin) - Date.now();
  if (restanteMs <= 0) {
    return `<p class="evento-tiempo-restante" id="evento-tiempo-restante-texto">¡Último momento!</p>`;
  }

  const totalMinutos = Math.floor(restanteMs / 60000);
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
  const minutos = totalMinutos % 60;

  return `<p class="evento-tiempo-restante" id="evento-tiempo-restante-texto">${dias}d ${horas}h ${minutos}m restantes</p>`;
}

// Actualiza solo el texto del contador cada 1 minuto, sin re-renderizar
// toda la página del evento (evita perder scroll, inputs, etc.)
function _actualizarTextoCountdownEvento() {
  const el = document.getElementById('evento-tiempo-restante-texto');
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = _renderTiempoRestanteEvento();
  el.textContent = tmp.firstElementChild?.textContent || '';
}

function _iniciarTimerCountdownEvento() {
  _detenerTimerCountdownEvento();
  _EventosState.timerCountdown = setInterval(_actualizarTextoCountdownEvento, 60000);
}

function _detenerTimerCountdownEvento() {
  if (_EventosState.timerCountdown) {
    clearInterval(_EventosState.timerCountdown);
    _EventosState.timerCountdown = null;
  }
}

// Polling global: revisa el progreso del evento cada 20s sin importar
// en qué pantalla esté el usuario ni qué acción haya hecho. Es lo único
// que garantiza que la mascota aparezca SIEMPRE, incluso si el reto se
// completó por una acción que no pasa por
// registrarAccionEventoSiCorresponde() (crear campaña, publicar
// reseña, subir libro, etc.)
function _iniciarPollingEventoGlobal() {
  _detenerPollingEventoGlobal();
  _EventosState.timerPolling = setInterval(() => {
    _refrescarProgresoEventoGlobal();
  }, 20000);
}

function _detenerPollingEventoGlobal() {
  if (_EventosState.timerPolling) {
    clearInterval(_EventosState.timerPolling);
    _EventosState.timerPolling = null;
  }
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

function _asegurarWidgetMascotaEvento() {
  if (!document.getElementById('evento-mascota-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'evento-mascota-backdrop';
    backdrop.style.display = 'none';
    backdrop.onclick = _cerrarMensajeMascota;
    document.body.appendChild(backdrop);
  }
  if (document.getElementById('evento-widget-mascota')) return;
  const div = document.createElement('div');
  div.id = 'evento-widget-mascota';
  div.style.display = 'none';
  document.body.appendChild(div);
}

function _mostrarMensajeMascota(evento, texto) {
  _asegurarWidgetMascotaEvento();
  const widget = document.getElementById('evento-widget-mascota');
  const backdrop = document.getElementById('evento-mascota-backdrop');
  const imagen = evento.tema?.mascota?.imagen || '';

  widget.innerHTML = `
    ${imagen ? `<img src="${imagen}" alt="" class="evento-mascota-imagen" />` : ''}
    <p class="evento-mascota-texto">${_escaparHtml(texto)}</p>
    <button type="button" class="evento-mascota-cerrar" onclick="_cerrarMensajeMascota()">✕</button>
  `;
  widget.style.display = 'flex';
  backdrop.style.display = 'block';
}

function _cerrarMensajeMascota() {
  const widget = document.getElementById('evento-widget-mascota');
  const backdrop = document.getElementById('evento-mascota-backdrop');
  if (widget) widget.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
}

function _mostrarMensajeMascotaSiCorresponde(evento, reto) {
  const mensajes = evento.tema?.mascota?.mensajes;
  const texto = mensajes?.[reto.id]
    || `¡Completaste ${reto.nombre}! ¡Conseguiste ${reto.puntos} pts!`;
  _mostrarMensajeMascota(evento, texto);
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
  _dispararParticulaEvento(e.detail.imagen, 'evento-particula-pantalla-completa');
});

// ────────────────────────────────────────────────────────────
// 8. SECRETO FLOTANTE (Fase 7)
// Objeto (ej. chocolate) que aparece cada tanto en pantalla mientras
// el usuario tiene un evento activo, según tema.secreto.frecuenciaMin.
// Al clickearlo, suma tema.secreto.puntos y se reprograma la próxima
// aparición. Si el evento no tiene tema.secreto.imagen cargada, no
// hace nada (evento sin secreto configurado).
// ────────────────────────────────────────────────────────────

function _detenerTimerSecretoEvento() {
  if (_EventosState.timerSecreto) {
    clearTimeout(_EventosState.timerSecreto);
    _EventosState.timerSecreto = null;
  }
  _ocultarSecretoFlotante();
}

function _iniciarTimerSecretoEvento(evento) {
  _detenerTimerSecretoEvento();

  const imagenSecreto = evento.tema?.secreto?.imagen;
  if (!imagenSecreto) return; // este evento no tiene secreto configurado

  const frecuenciaMin = evento.tema.secreto.frecuenciaMin || 30;
  // Variación aleatoria (mitad a una vez y media de la frecuencia) para
  // que no sea siempre exacto y predecible.
  const minMs = frecuenciaMin * 60 * 1000 * 0.5;
  const maxMs = frecuenciaMin * 60 * 1000 * 1.5;
  const espera = minMs + Math.random() * (maxMs - minMs);

  _EventosState.timerSecreto = setTimeout(() => {
    _mostrarSecretoFlotante(evento);
  }, espera);
}

function _asegurarWidgetSecretoEvento() {
  if (document.getElementById('evento-secreto-flotante')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'evento-secreto-flotante';
  btn.className = 'evento-secreto-flotante';
  btn.style.display = 'none';
  btn.onclick = _clickSecretoEvento;
  document.body.appendChild(btn);
}

function _mostrarSecretoFlotante(evento) {
  _asegurarWidgetSecretoEvento();
  const btn = document.getElementById('evento-secreto-flotante');
  btn.innerHTML = `<img src="${evento.tema.secreto.imagen}" alt="" class="evento-secreto-flotante-imagen" />`;
  btn.style.left = `${5 + Math.random() * 80}%`;
  btn.style.top = `${15 + Math.random() * 60}%`;
  btn.style.display = 'block';
}

function _ocultarSecretoFlotante() {
  const btn = document.getElementById('evento-secreto-flotante');
  if (btn) btn.style.display = 'none';
}

async function _clickSecretoEvento() {
  const evento = _EventosState.eventoActivo;
  if (!evento) return;

  _ocultarSecretoFlotante();

  try {
    await supabaseClient.rpc('registrar_accion_directa_evento', {
      p_usuario: _EventosState.idUsuario,
      p_id_evento: evento.id,
      p_accion: 'secreto_encontrado'
    });

    mostrarToast(`😏 No deberías haber encontrado esto. Pero bueno... +${evento.tema.secreto.puntos} puntos.`, 'ok');

    const seccionEvento = document.getElementById('seccion-evento');
    if (seccionEvento && seccionEvento.style.display !== 'none') {
      renderPaginaEvento();
    } else {
      _actualizarWidgetFlotanteEvento();
    }
  } catch (e) {
    console.error('Error registrando secreto encontrado:', e);
  }

  // Programa la próxima aparición del secreto.
  _iniciarTimerSecretoEvento(evento);
}
