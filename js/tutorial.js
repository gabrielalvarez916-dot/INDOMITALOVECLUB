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

const TUTORIAL_PASOS_CONFIG = {
  'reseñador': [
    { destino: 'nav-campanas', abrir: () => mostrarSeccion('feed') },
    { destino: 'btn-editar-perfil', abrir: () => {
        mostrarSeccion('perfil');
        setTimeout(() => {
          mostrarModal('modal-editar-perfil');
          if (typeof cargarFormularioEdicionPerfil === 'function') cargarFormularioEdicionPerfil();
        }, 50);
      } },
    { destino: 'tabbtn-mis-postulaciones', abrir: () => mostrarPanelRol() },
    { destino: 'tabbtn-ranking-resenador', abrir: () => {
        mostrarPanelRol();
        setTimeout(() => document.getElementById('tabbtn-ranking-resenador')?.click(), 50);
      } },
    { destino: 'bib-titulo-seccion', abrir: () => mostrarSeccion('biblioteca-resenador') },
    { destino: 'nav-evento', abrir: () => mostrarSeccion('evento') }
  ],
  'autor': [
    { destino: 'nav-campanas', abrir: () => mostrarSeccion('feed') },
    { destino: 'tabbtn-campanas-activas', abrir: () => mostrarPanelRol() },
    { destino: 'tabbtn-postulaciones-autor', abrir: () => {
        mostrarPanelRol();
        setTimeout(() => document.getElementById('tabbtn-postulaciones-autor')?.click(), 50);
      } },
    { destino: 'tabbtn-ranking-libros', abrir: () => {
        mostrarPanelRol();
        setTimeout(() => document.getElementById('tabbtn-ranking-libros')?.click(), 50);
      } },
    { destino: 'tabbtn-plan', abrir: () => {
        mostrarPanelRol();
        setTimeout(() => document.getElementById('tabbtn-plan')?.click(), 50);
      } },
    { destino: 'nav-evento', abrir: () => mostrarSeccion('evento') },
    { destino: 'btn-nueva-campana', abrir: () => mostrarPanelRol() }
  ]
};

let _tutorialScrollHandler = null;

const _TutorialState = {
  activo: false,
  rol: null,
  pasos: [],       // datos cargados de Supabase (imagen, título, texto) por paso; incluye paso 0 = intro
  indice: 0,       // índice del paso actual (0-based, corresponde a pasos 1..6)
  enIntro: false   // true mientras se muestra la pantalla de bienvenida (paso 0, antes del globo)
};

// ────────────────────────────────────────────────────────────
// INICIO — llamar desde completarLogin() en auth.js
// ────────────────────────────────────────────────────────────

async function inicializarTutorialBienvenida(usuario) {
  try {
    if (!usuario || usuario.rol === 'admin') return;
    if (usuario.tutorial_bienvenida_visto) return;
    if (usuario.rol !== 'autor' && usuario.rol !== 'reseñador') return;

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

function _mostrarPasoTutorial() {
  const config = TUTORIAL_PASOS_CONFIG[_TutorialState.rol];
  const datos = _TutorialState.pasos.find(p => p.numero_paso === _TutorialState.indice + 1);
  const pasoConfig = config[_TutorialState.indice];

  if (!datos || !pasoConfig) {
    cerrarTutorialBienvenida();
    return;
  }

  // 1. Abre la pantalla/panel correspondiente
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

  mostrarModal('modal-tutorial-mascota');

  // 3. Mueve el globo hacia el elemento destino (con margen para que la
  //    pantalla/panel termine de renderizar tras el "abrir()").
  setTimeout(() => _posicionarGloboTutorial(pasoConfig.destino), 150);
}

function pasoSiguienteTutorial() {
  if (_TutorialState.enIntro) {
    _TutorialState.enIntro = false;
    _mostrarPasoTutorial();
    return;
  }

  const config = TUTORIAL_PASOS_CONFIG[_TutorialState.rol];
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

function pasoAnteriorTutorial() {
  if (_TutorialState.indice === 0) return;
  _TutorialState.indice--;
  _mostrarPasoTutorial();
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

  destino.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
