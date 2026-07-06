// ============================================================
// eventos.js — Indómita Love Club
// Motor GENÉRICO de eventos. No contiene datos de ningún evento
// puntual: esos viven en archivos tipo evento_primer_beso.js.
// Este archivo sabe cómo:
//   1. Detectar si hay un evento activo y mostrarlo (modal + animación)
//   2. Renderizar la página del evento (retos, progreso, insignia)
//   3. Registrar acciones "directas" (sin hoja propia en Sheets)
//   4. Disparar la animación final cuando el usuario completa el evento
//
// Para agregar un evento nuevo en el futuro:
//   - Crear su archivo de datos (mismo formato que EVENTO_PRIMER_BESO)
//   - Agregarlo al array EVENTOS_REGISTRADOS más abajo
//   - Crear su .gs en el backend con la misma estructura
//   - El resto (UI, animaciones, conteo) ya funciona solo.
// ============================================================


// ────────────────────────────────────────────────────────────
// REGISTRO DE EVENTOS DISPONIBLES EN EL FRONTEND
// Agregar acá cada nuevo evento (su objeto de datos, definido en
// su propio archivo tipo evento_NOMBRE.js, cargado antes que este
// script en el HTML).
// ────────────────────────────────────────────────────────────

const EVENTOS_REGISTRADOS = [
  // EVENTO_PRIMER_BESO debe estar definido por evento_primer_beso.js,
  // cargado ANTES que eventos.js en el HTML.
  typeof EVENTO_PRIMER_BESO !== 'undefined' ? EVENTO_PRIMER_BESO : null
].filter(Boolean);


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

    // Busca, de los eventos registrados en el frontend, cuál está
    // marcado como activo localmente (chequeo rápido, sin pegarle
    // al backend si ni siquiera el frontend lo tiene activo).
    const candidato = EVENTOS_REGISTRADOS.find(ev => _eventoActivoLocal(ev));
    if (!candidato) {
      _ocultarBotonNavEvento();
      return;
    }

    _EventosState.idUsuario = usuario.id;
    _EventosState.rol = usuario.rol;

    const { data: resultado, error } = await supabaseClient.rpc('inicializar_evento_usuario', {
      p_usuario: usuario.id,
      p_rol: usuario.rol,
      p_id_evento: candidato.id
    });

    if (error || !resultado || !resultado.activo) {
      _ocultarBotonNavEvento();
      return;
    }

    _EventosState.eventoActivo = candidato;
    _EventosState.progreso = resultado.progreso;

    _mostrarBotonNavEvento(candidato);

    if (!resultado.modalVisto) {
      _mostrarModalInicioEvento(candidato);
    }

  } catch (e) {
    console.error('Error al inicializar eventos:', e);
  }
}

/**
 * Chequeo local rápido (sin backend) de si un evento debería
 * estar activo, según sus propios flags de fecha/activo.
 * Es solo para decidir si vale la pena consultar al backend;
 * la validación real y definitiva siempre la hace el backend.
 */
function _eventoActivoLocal(evento) {
  if (!evento.activo) return false;
  if (!evento.activoPorFecha) return true;

  const ahora = new Date();
  const inicio = new Date(evento.fechaInicio);
  const fin = new Date(evento.fechaFin);
  // fin inclusive hasta las 23:59:59 del día de fin
  fin.setHours(23, 59, 59, 999);

  return ahora >= inicio && ahora <= fin;
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

  const evento = _EventosState.eventoActivo;

    // ← AGREGAR: pantalla de carga mientras se espera al backend
  contenedor.innerHTML = `
    <div class="cargando-container">
      <div class="spinner"></div>
      <p>Cargando evento...</p>
    </div>
  `;

  // Refresca el progreso al entrar a la página (puede haber cambiado
  // desde que se cargó la app, ej. el usuario aprobó un reseñador)
  const { data: resultado, error } = await supabaseClient.rpc('inicializar_evento_usuario', {
    p_usuario: _EventosState.idUsuario,
    p_rol: _EventosState.rol,
    p_id_evento: evento.id
  });

  if (error || !resultado || !resultado.activo) {
    contenedor.innerHTML = `<p class="evento-vacio">Este evento ya finalizó.</p>`;
    return;
  }

  const progresoAnterior = _EventosState.progreso;
  _EventosState.progreso = resultado.progreso;
  const progreso = _EventosState.progreso;

  const yaEstabaCompleto = progresoAnterior && progresoAnterior.eventoCompleto;
  const recienCompletado = progreso.eventoCompleto && !yaEstabaCompleto;

  contenedor.innerHTML = `
    <div class="evento-banner" style="background-image:url('${evento.imagenes.banner}')">
      <h1>${evento.nombre}</h1>
    </div>

    <div class="evento-historia">
      <h3>${evento.historia.titulo || ''}</h3>
      <p>${evento.historia.texto || evento.historia}</p>
    </div>

    <div class="evento-insignia-preview">
      <img src="${progreso.eventoCompleto ? evento.imagenes.insigniaColor : evento.imagenes.insigniaGris}" alt="Insignia ${evento.nombre}" />
      <p>${progreso.eventoCompleto ? '¡Insignia conseguida!' : `Puntos acumulados: ${progreso.puntosAcumulados}`}</p>
    </div>

    <div class="evento-retos-lista">
      ${progreso.retos.map(reto => _renderCardReto(reto)).join('')}
    </div>
  `;

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
    }

  } catch (e) {
    console.error('Error registrando acción de evento:', e);
  }
}


// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function _escaparHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
