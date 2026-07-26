// ============================================================
// tutorial.js — Indómita Love Club
// Tutorial de bienvenida (onboarding) para autor / reseñador.
// Se muestra una única vez por usuario (flag tutorial_bienvenida_visto).
//
// Cómo funciona:
// - El modal de la mascota (#modal-tutorial-mascota) NO se mueve nunca,
//   siempre queda fijo en el centro de la pantalla.
// - Lo que se mueve es el "globo" (#tutorial-globo): un puntero flotante
//   que se posiciona sobre el elemento real de la UI al que apunta cada
//   paso, abriendo antes la pantalla/panel correspondiente si hace falta.
// - El mapeo paso → elemento a señalar es fijo en TUTORIAL_PASOS_CONFIG,
//   no se edita desde el admin. Lo que se edita en el admin (imagen,
//   título, texto) se trae desde Supabase (tabla tutoriales_bienvenida).
// ============================================================

// ────────────────────────────────────────────────────────────
// GATES DE ACTIVACIÓN — condiciones que hay que cumplir para
// poder avanzar (y salir) de ciertos pasos del tutorial.
// Cada gate es async y devuelve true/false. Se corren contra
// Supabase en el momento (sin flags guardados: siempre reflejan
// el estado real, así que si el usuario ya cumplió la condición
// en una sesión anterior, el paso se destraba solo).
// ────────────────────────────────────────────────────────────

async function _tutGatePostulacionReseñador(idUsuario) {
  const { count, error } = await supabaseClient
    .from('postulaciones')
    .select('id', { count: 'exact', head: true })
    .eq('id_usuario_resenador', idUsuario);
  if (error) { console.error('Error gate postulación:', error); return false; }
  return (count || 0) > 0;
}

async function _tutGatePerfilReseñador(idUsuario) {
  const [{ data: usuario, error: errUsuario }, { count, error: errGeneros }] = await Promise.all([
    supabaseClient.from('usuarios').select('descripcion_lector').eq('id', idUsuario).maybeSingle(),
    supabaseClient.from('usuario_generos').select('id_genero', { count: 'exact', head: true }).eq('id_usuario', idUsuario)
  ]);
  if (errUsuario || errGeneros) { console.error('Error gate perfil reseñador:', errUsuario || errGeneros); return false; }
  const tieneDescripcion = !!(usuario?.descripcion_lector && usuario.descripcion_lector.trim().length > 0);
  const tieneGeneros = (count || 0) > 0;
  return tieneDescripcion && tieneGeneros;
}

async function _tutGateAvatarAutor(idUsuario) {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('avatar_id')
    .eq('id', idUsuario)
    .maybeSingle();
  if (error) { console.error('Error gate avatar:', error); return false; }
  return data?.avatar_id != null;
}

async function _tutGateLibroAutor(idUsuario) {
  const { count, error } = await supabaseClient
    .from('libros')
    .select('id', { count: 'exact', head: true })
    .eq('id_usuario_autor', idUsuario)
    .eq('eliminado', false);
  if (error) { console.error('Error gate libro:', error); return false; }
  return (count || 0) > 0;
}

async function _tutGateCampanaAutor(idUsuario) {
  const { count, error } = await supabaseClient
    .from('campanas')
    .select('id', { count: 'exact', head: true })
    .eq('id_usuario_autor', idUsuario);
  if (error) { console.error('Error gate campaña:', error); return false; }
  return (count || 0) > 0;
}

const _PASOS_AUTOR_EDITORIAL = [
  { destino: 'btn-editar-perfil', abrir: () => {
      mostrarSeccion('perfil');
      setTimeout(() => {
        mostrarModal('modal-editar-perfil');
        if (typeof cargarFormularioEdicionPerfil === 'function') cargarFormularioEdicionPerfil();
      }, 50);
    },
    gate: _tutGateAvatarAutor,
    mensajeBloqueo: 'Elegí un avatar para tu perfil (botón "Cambiar avatar") para poder continuar.' },
  { destino: 'btn-agregar-libro-biblioteca-autor', abrir: () => {
      mostrarSeccion('biblioteca-autor');
      setTimeout(() => mostrarModal('modal-nuevo-libro'), 400);
    },
    gate: _tutGateLibroAutor,
    mensajeBloqueo: 'Cargá tu primer libro para poder continuar.' },
  { destino: 'btn-nueva-campana', abrir: () => {
      mostrarPanelRol();
      setTimeout(() => mostrarModal('modal-nueva-campana'), 400);
    },
    gate: _tutGateCampanaAutor,
    mensajeBloqueo: 'Creá tu primera campaña para poder continuar.' },
  { destino: 'nav-campanas', abrir: () => mostrarSeccion('feed') },
  { destino: 'tabbtn-campanas-activas', abrir: () => mostrarPanelRol() },
  { destino: 'tabbtn-postulaciones-autor', abrir: () => {
      mostrarPanelRol();
      setTimeout(() => document.getElementById('tabbtn-postulaciones-autor')?.click(), 50);
    } },
  { destino: 'tabbtn-plan', abrir: () => {
      mostrarPanelRol();
      setTimeout(() => document.getElementById('tabbtn-plan')?.click(), 50);
    } },
  { destino: 'nav-evento', abrir: () => mostrarSeccion('evento') },
  { destino: null, abrir: () => {} }
];

const TUTORIAL_PASOS_CONFIG = {
  'reseñador': [
    { destino: 'nav-campanas', abrir: () => mostrarSeccion('feed'),
      gate: _tutGatePostulacionReseñador,
      mensajeBloqueo: 'Postulate a un libro desde acá para poder continuar.' },
    { destino: 'btn-editar-perfil', abrir: () => {
        mostrarSeccion('perfil');
        setTimeout(() => {
          mostrarModal('modal-editar-perfil');
          if (typeof cargarFormularioEdicionPerfil === 'function') cargarFormularioEdicionPerfil();
        }, 50);
      },
      gate: _tutGatePerfilReseñador,
      mensajeBloqueo: 'Elegí tus géneros favoritos y contanos algo sobre vos como lector@ para poder continuar.' },
    { destino: 'nav-panel', abrir: () => mostrarPanelRol() },
    { destino: 'tabbtn-ranking-resenador', abrir: () => {
        mostrarPanelRol();
        setTimeout(() => document.getElementById('tabbtn-ranking-resenador')?.click(), 50);
      } },
    { destino: 'bib-titulo-seccion', abrir: () => mostrarSeccion('biblioteca-resenador') },
    { destino: 'nav-evento', abrir: () => mostrarSeccion('evento') },
    { destino: null, abrir: () => {} }
  ],
  'autor': _PASOS_AUTOR_EDITORIAL,
  'editorial': _PASOS_AUTOR_EDITORIAL
};

let _tutorialScrollHandler = null;

const _TutorialState = {
  activo: false,
  rol: null,
  pasos: [],       // datos cargados de Supabase (imagen, título, texto) por paso; incluye paso 0 = intro
  indice: 0,       // índice del paso actual (0-based, corresponde a pasos 1..6)
  enIntro: false,  // true mientras se muestra la pantalla de bienvenida (paso 0, antes del globo)
  gateBloqueando: false // true mientras el paso actual tiene una condición de activación sin cumplir
};

// ────────────────────────────────────────────────────────────
// INICIO — llamar desde completarLogin() en auth.js
// ────────────────────────────────────────────────────────────

async function inicializarTutorialBienvenida(usuario) {
  try {
    if (!usuario || usuario.rol === 'admin') return;
    if (usuario.tutorial_bienvenida_visto) return;
    if (usuario.rol !== 'autor' && usuario.rol !== 'reseñador' && usuario.rol !== 'editorial') return;

    const { data: pasos, error } = await supabaseClient.rpc('obtener_tutorial_bienvenida', {
      p_rol: usuario.rol
    });

    if (error || !pasos || pasos.length === 0) return;

    _TutorialState.activo = true;
    _TutorialState.rol = usuario.rol;
    _TutorialState.pasos = pasos.sort((a, b) => a.numero_paso - b.numero_paso);
    _TutorialState.indice = 0;
    _TutorialState.enIntro = true;

   _asegurarWidgetGloboTutorial();
    document.getElementById('btn-soporte-flotante')?.style.setProperty('display', 'none');
    document.getElementById('evento-widget-flotante')?.style.setProperty('display', 'none');
    _mostrarIntroTutorial();
  } catch (e) {
    console.error('Error inicializando tutorial de bienvenida:', e);
  }
}

// ────────────────────────────────────────────────────────────
// NAVEGACIÓN ENTRE PASOS
// ────────────────────────────────────────────────────────────

function _mostrarIntroTutorial() {
  const intro = _TutorialState.pasos.find(p => p.numero_paso === 0);
  if (!intro) { _TutorialState.enIntro = false; _mostrarPasoTutorial(); return; }

  _ocultarGloboTutorial();
  _TutorialState.gateBloqueando = false;
  _ocultarMensajeBloqueoTutorial();
  _actualizarVisibilidadCerrarTutorial();

  document.getElementById('tutorial-mascota-titulo').textContent = intro.titulo || '';
  document.getElementById('tutorial-mascota-texto').textContent = intro.texto || '';
  document.getElementById('tutorial-mascota-imagen').src = intro.imagen_mascota || '';
  document.getElementById('tutorial-mascota-paso-contador').textContent = '';

  const btnAnterior = document.getElementById('btn-tutorial-anterior');
  const btnSiguiente = document.getElementById('btn-tutorial-siguiente');
  if (btnAnterior) btnAnterior.style.display = 'none';
  if (btnSiguiente) btnSiguiente.textContent = 'Empezar tutorial';

  mostrarModal('modal-tutorial-mascota');
}

async function _mostrarPasoTutorial() {
  const config = TUTORIAL_PASOS_CONFIG[_TutorialState.rol];
  const datos = _TutorialState.pasos.find(p => p.numero_paso === _TutorialState.indice + 1);
  const pasoConfig = config[_TutorialState.indice];

  if (!datos || !pasoConfig) {
    cerrarTutorialBienvenida();
    return;
  }

  // 1. Cierra cualquier modal que haya quedado abierto de un paso anterior
  //    (ej: "Editar perfil"), sin cerrar el modal del tutorial (ya protegido en cerrarModales()).
  cerrarModales();

  // 2. Abre la pantalla/panel correspondiente
  try { pasoConfig.abrir(); } catch (e) { console.error('Error abriendo paso del tutorial:', e); }

  // 2. Llena el modal fijo de la mascota
  document.getElementById('tutorial-mascota-titulo').textContent = datos.titulo || '';
  document.getElementById('tutorial-mascota-texto').textContent = datos.texto || '';
  document.getElementById('tutorial-mascota-imagen').src = datos.imagen_mascota || '';
  document.getElementById('tutorial-mascota-paso-contador').textContent =
    `Paso ${_TutorialState.indice + 1} de ${config.length}`;

  const btnAnterior = document.getElementById('btn-tutorial-anterior');
  const btnSiguiente = document.getElementById('btn-tutorial-siguiente');
  if (btnAnterior) btnAnterior.style.display = 'inline-block';
  if (btnSiguiente) btnSiguiente.textContent = _TutorialState.indice === config.length - 1 ? '¡Listo!' : 'Siguiente';

  // Mientras este paso tenga un gate, arrancamos asumiendo que está bloqueado
  // (se corrige apenas resuelve el chequeo real contra Supabase más abajo).
  _TutorialState.gateBloqueando = !!pasoConfig.gate;
  _ocultarMensajeBloqueoTutorial();
  _actualizarVisibilidadCerrarTutorial();

  mostrarModal('modal-tutorial-mascota');

  // 3. Mueve el globo hacia el elemento destino (con margen para que la
  //    pantalla/panel termine de renderizar tras el "abrir()").
  setTimeout(() => _posicionarGloboTutorial(pasoConfig.destino), 400);

  // 4. Si el paso tiene gate, lo chequeamos ya mismo por si el usuario ya
  //    cumplió la condición antes (ej: en una sesión previa) — así no lo
  //    dejamos bloqueado innecesariamente.
  if (pasoConfig.gate) {
    const indiceDeEstePaso = _TutorialState.indice;
    const idUsuario = Sesion.obtener()?.id;
    const cumple = idUsuario ? await pasoConfig.gate(idUsuario) : false;
    // Si el usuario ya avanzó/cerró el tutorial mientras esperábamos la respuesta, no pisamos nada.
    if (_TutorialState.activo && !_TutorialState.enIntro && _TutorialState.indice === indiceDeEstePaso) {
      _TutorialState.gateBloqueando = !cumple;
      _actualizarVisibilidadCerrarTutorial();
    }
  }
}

async function pasoSiguienteTutorial() {
  if (_TutorialState.enIntro) {
    _TutorialState.enIntro = false;
    _mostrarPasoTutorial();
    return;
  }

  const config = TUTORIAL_PASOS_CONFIG[_TutorialState.rol];
  const pasoConfigActual = config[_TutorialState.indice];

  if (pasoConfigActual?.gate) {
    const btnSiguiente = document.getElementById('btn-tutorial-siguiente');
    const idUsuario = Sesion.obtener()?.id;

    if (btnSiguiente) { btnSiguiente.disabled = true; btnSiguiente.dataset.textoOriginal = btnSiguiente.textContent; btnSiguiente.textContent = 'Verificando...'; }

    const cumple = idUsuario ? await pasoConfigActual.gate(idUsuario) : false;

    if (btnSiguiente) { btnSiguiente.disabled = false; btnSiguiente.textContent = btnSiguiente.dataset.textoOriginal || 'Siguiente'; }

    // El tutorial pudo haberse cerrado mientras esperábamos la respuesta (ej: el usuario cerró sesión).
    if (!_TutorialState.activo) return;

    if (!cumple) {
      _TutorialState.gateBloqueando = true;
      _mostrarMensajeBloqueoTutorial(pasoConfigActual.mensajeBloqueo);
      _actualizarVisibilidadCerrarTutorial();
      return;
    }

    _TutorialState.gateBloqueando = false;
    _ocultarMensajeBloqueoTutorial();
    _actualizarVisibilidadCerrarTutorial();
  }

  if (_TutorialState.indice >= config.length - 1) {
    cerrarTutorialBienvenida();
    return;
  }
  _TutorialState.indice++;
  _mostrarPasoTutorial();
}

function pasoAnteriorTutorial() {
  if (_TutorialState.enIntro) return;
  if (_TutorialState.indice === 0) {
    _TutorialState.enIntro = true;
    _mostrarIntroTutorial();
    return;
  }
  _TutorialState.indice--;
  _mostrarPasoTutorial();
}

// ────────────────────────────────────────────────────────────
// GATES — mensaje de bloqueo y control del botón cerrar (✕)
// ────────────────────────────────────────────────────────────

function _mostrarMensajeBloqueoTutorial(mensaje) {
  const el = document.getElementById('tutorial-mascota-bloqueo');
  if (!el) return;
  el.textContent = mensaje || 'Completá lo que te pedimos en este paso para poder continuar.';
  el.style.display = 'block';
}

function _ocultarMensajeBloqueoTutorial() {
  const el = document.getElementById('tutorial-mascota-bloqueo');
  if (el) el.style.display = 'none';
}

/**
 * Oculta el botón ✕ del modal del tutorial mientras el tutorial esté activo,
 * para que no se pueda salir en ningún paso hasta terminarlo. Antes solo se
 * ocultaba durante los pasos con gate sin cumplir, así que en cualquier paso
 * sin gate (la mayoría) se podía cerrar el tutorial igual — ya no.
 */
function _actualizarVisibilidadCerrarTutorial() {
  const btnCerrar = document.querySelector('#modal-tutorial-mascota .modal-cerrar');
  if (!btnCerrar) return;
  btnCerrar.style.display = _TutorialState.activo ? 'none' : '';
}

async function cerrarTutorialBienvenida() {
  _TutorialState.activo = false;
  _ocultarGloboTutorial();
  cerrarModales();

  document.getElementById('btn-soporte-flotante')?.style.removeProperty('display');
  document.getElementById('evento-widget-flotante')?.style.removeProperty('display');

  try {
    await supabaseClient.rpc('marcar_tutorial_bienvenida_visto');
  } catch (e) {
    console.error('Error marcando tutorial como visto:', e);
  }
}

// ────────────────────────────────────────────────────────────
// EL GLOBO (puntero flotante que se mueve, no la mascota)
// ────────────────────────────────────────────────────────────

function _asegurarWidgetGloboTutorial() {
  if (document.getElementById('tutorial-globo')) return;
  const globo = document.createElement('div');
  globo.id = 'tutorial-globo';
  globo.style.cssText = `
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    display: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 3px solid var(--color-primario, #ff4d8d);
    box-shadow: 0 0 0 6px rgba(255,77,141,0.25);
    animation: tutorialGloboPulso 1.1s infinite;
    transition: top 0.3s ease, left 0.3s ease;
  `;
  document.body.appendChild(globo);

  if (!document.getElementById('tutorial-globo-estilos')) {
    const estilo = document.createElement('style');
    estilo.id = 'tutorial-globo-estilos';
    estilo.textContent = `
      @keyframes tutorialGloboPulso {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.25); opacity: 0.6; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(estilo);
  }
}

function _posicionarGloboTutorial(idElementoDestino) {
  const globo = document.getElementById('tutorial-globo');
  const destino = document.getElementById(idElementoDestino);

  document.querySelectorAll('.tutorial-destino-resaltado').forEach(el =>
    el.classList.remove('tutorial-destino-resaltado')
  );

  _quitarListenerScrollTutorial();

  if (!globo || !destino) {
    if (globo) globo.style.display = 'none';
    return;
  }

  destino.scrollIntoView({ behavior: 'auto', block: 'center' });

  const actualizarPosicionGlobo = () => {
    const rect = destino.getBoundingClientRect();
    globo.style.top = `${rect.top + rect.height / 2 - 17}px`;
    globo.style.left = `${rect.left + rect.width / 2 - 17}px`;
  };

  setTimeout(() => {
    actualizarPosicionGlobo();
    globo.style.display = 'block';
    destino.classList.add('tutorial-destino-resaltado');

    _tutorialScrollHandler = actualizarPosicionGlobo;
    window.addEventListener('scroll', _tutorialScrollHandler, true);
    window.addEventListener('resize', _tutorialScrollHandler);
  }, 250);
}

function _quitarListenerScrollTutorial() {
  if (_tutorialScrollHandler) {
    window.removeEventListener('scroll', _tutorialScrollHandler, true);
    window.removeEventListener('resize', _tutorialScrollHandler);
    _tutorialScrollHandler = null;
  }
}

function _ocultarGloboTutorial() {
  const globo = document.getElementById('tutorial-globo');
  if (globo) globo.style.display = 'none';
  document.querySelectorAll('.tutorial-destino-resaltado').forEach(el =>
    el.classList.remove('tutorial-destino-resaltado')
  );
  _quitarListenerScrollTutorial();
}
