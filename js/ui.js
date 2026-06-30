// ============================================================
// ui.js — Indómita Love Club
// Navegación, secciones, modales, tabs, utilidades visuales
// ============================================================


// ────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ────────────────────────────────────────────────────────────

/**
 * Se ejecuta cuando el DOM está listo.
 * Decide qué mostrar según si hay sesión activa o no.
 */
document.addEventListener('DOMContentLoaded', () => {
  const usuario = Sesion.obtener();

  if (usuario) {
    mostrarHeaderLogueado(usuario);
    mostrarSeccion('feed');
    setTimeout(() => {
      if (typeof verificarModalActualizacion === 'function') {
        verificarModalActualizacion();
      }
    }, 100);
  } else {
    // No hay sesión: muestra pantalla de login
    mostrarHeaderDeslogueado();
    mostrarSeccion('login');
  }

  // Si el link trae ?campana=ID, abre el detalle automáticamente
  const params = new URLSearchParams(window.location.search);
  const idCampanaURL = params.get('campana');
  if (idCampanaURL && typeof verDetalleCampaña === 'function') {
    setTimeout(() => verDetalleCampaña(idCampanaURL), 300);
  }
});

// ────────────────────────────────────────────────────────────
// NAVEGACIÓN ENTRE SECCIONES
// ────────────────────────────────────────────────────────────

/**
 * Muestra una sección y oculta todas las demás.
 * Es la función central de navegación de toda la app.
 *
 * Secciones disponibles:
 * 'login' | 'feed' | 'panel-autor' | 'panel-resenador' | 'perfil' | 'admin'
 *
 * @param {string} nombre — nombre de la sección sin el prefijo 'seccion-'
 */
function mostrarSeccion(nombre) {
  // Lista de todas las secciones del HTML
  const secciones = [
    'login',
    'feed',
    'panel-autor',
    'panel-resenador',
    'perfil',
    'faq-autor',
    'admin',
    'biblioteca-resenador',
    'evento'
  ];

  // Oculta todas
  secciones.forEach(s => {
    const el = document.getElementById(`seccion-${s}`);
    if (el) el.style.display = 'none';
  });

  // Muestra la solicitada
  const objetivo = document.getElementById(`seccion-${nombre}`);
  if (!objetivo) {
    console.error(`Sección no encontrada: seccion-${nombre}`);
    return;
  }

  // Login usa flex para centrar, el resto block
  objetivo.style.display = nombre === 'login' ? 'flex' : 'block';

  // Scroll al tope
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Acciones específicas al mostrar cada sección
  switch (nombre) {
    case 'feed':
      if (typeof cargarFeed === 'function') cargarFeed();
      break;
    case 'panel-autor':
      if (typeof cargarPanelAutor === 'function') cargarPanelAutor();
      break;
    case 'panel-resenador':
      if (typeof cargarPanelResenador === 'function') cargarPanelResenador();
      break;
    case 'perfil':
      if (typeof cargarPerfil === 'function') cargarPerfil();
      break;
    case 'faq-autor':                                                    // ← AGREGAR
      if (typeof cargarFaqAutor === 'function') cargarFaqAutor();        // ← AGREGAR
      break;          
    case 'admin':
      if (typeof cargarAdmin === 'function') cargarAdmin();
      break;
  case 'biblioteca-resenador':
      if (typeof cargarBibliotecaSeccion === 'function') cargarBibliotecaSeccion();
      break;
    case 'evento':
      if (typeof renderPaginaEvento === 'function') renderPaginaEvento();
      break;
  }
}

/**
 * Muestra el panel correcto según el rol del usuario logueado.
 * Se llama desde el botón "Mi panel" del header.
 */
function mostrarPanelRol() {
  const rol = Sesion.rol();
  if (rol === 'autor') mostrarSeccion('panel-autor');
  else if (rol === 'reseñador') mostrarSeccion('panel-resenador');
  else if (rol === 'admin') mostrarSeccion('admin');
  else mostrarSeccion('login');
}


// ────────────────────────────────────────────────────────────
// HEADER
// ────────────────────────────────────────────────────────────

/**
 * Actualiza el header para mostrar el usuario logueado.
 * Muestra el alias, oculta el botón Ingresar, muestra botones de nav.
 *
 * @param {Object} usuario — datos del usuario de Sesion.obtener()
 */
function mostrarHeaderLogueado(usuario) {
  // Oculta botón de login
  const btnLogin = document.getElementById('btn-login-header');
  if (btnLogin) btnLogin.style.display = 'none';

  // Muestra menú de usuario
  const menuUsuario = document.getElementById('usuario-menu');
  if (menuUsuario) menuUsuario.style.display = 'flex';

  // Pone el alias o nombre
  const aliasEl = document.getElementById('usuario-alias');
  if (aliasEl) {
    aliasEl.textContent = usuario.alias || usuario.nombre || usuario.email;
  }

  // Muestra botón Mi panel
  const navPanel = document.getElementById('nav-panel');
  if (navPanel) navPanel.style.display = 'inline-block';

  // Muestra botón Mi perfil
  const navPerfil = document.getElementById('nav-perfil');
  if (navPerfil) navPerfil.style.display = 'inline-block';

   // Muestra botón FAQ solo si es autor
  const navFaqAutor = document.getElementById('nav-faq-autor');
  if (navFaqAutor) {
    navFaqAutor.style.display = usuario.rol === 'autor' ? 'inline-block' : 'none';
  }

  // Muestra botón Admin solo si es admin
  const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) {
    navAdmin.style.display = usuario.rol === 'admin' ? 'inline-block' : 'none';
  }
}

/**
 * Actualiza el header para el estado deslogueado.
 * Muestra el botón Ingresar, oculta el menú de usuario.
 */
function mostrarHeaderDeslogueado() {
  detenerNotificaciones(); 
  const btnLogin = document.getElementById('btn-login-header');
  if (btnLogin) btnLogin.style.display = 'inline-block';

  const menuUsuario = document.getElementById('usuario-menu');
  if (menuUsuario) menuUsuario.style.display = 'none';

  const navPanel = document.getElementById('nav-panel');
  if (navPanel) navPanel.style.display = 'none';

  const navPerfil = document.getElementById('nav-perfil');
  if (navPerfil) navPerfil.style.display = 'none';

  const navFaqAutor = document.getElementById('nav-faq-autor');
  if (navFaqAutor) navFaqAutor.style.display = 'none';

 const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) navAdmin.style.display = 'none';

  const navEvento = document.getElementById('nav-evento');
  if (navEvento) navEvento.style.display = 'none';
}


// ────────────────────────────────────────────────────────────
// MODALES
// ────────────────────────────────────────────────────────────

/**
 * Abre un modal específico.
 * Activa el overlay y el modal indicado.
 *
 * @param {string} idModal — ID del elemento modal en el HTML
 */
function mostrarModal(idModal) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById(idModal);

  if (!modal) {
    console.error(`Modal no encontrado: ${idModal}`);
    return;
  }

 if (overlay) overlay.classList.add('activo');
  modal.classList.add('activo');

  // Evita scroll del body mientras el modal está abierto
  document.body.style.overflow = 'hidden';

  // Inicializa los selectores de tropes según el modal
 if (idModal === 'modal-nuevo-libro') {
    if (typeof renderizarSelectorTropes === 'function') {
      renderizarSelectorTropes('libro-tropes-contenedor', 'libro');
    }
  }
 if (idModal === 'modal-nueva-campana') {
    if (typeof inicializarModalNuevaCampana === 'function') {
      inicializarModalNuevaCampana();
    }
  }
}  // ← ESTA LLAVE CIERRA mostrarModal

/**
 * Cierra todos los modales abiertos
 * Se llama desde el botón ✕ de cada modal y desde el overlay.
 */
function cerrarModales() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('activo');

  // Cierra todos los modales activos
  document.querySelectorAll('.modal.activo').forEach(modal => {
    modal.classList.remove('activo');
  });

  // Restaura el scroll
  document.body.style.overflow = '';
}

/**
 * Cierra el modal si el usuario presiona Escape.
 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModales();
});


// ────────────────────────────────────────────────────────────
// TABS
// ────────────────────────────────────────────────────────────

/**
 * Cambia el tab activo dentro de un panel.
 * Desactiva todos los tabs y contenidos del grupo,
 * luego activa el tab clickeado y su contenido.
 *
 * @param {HTMLElement} tabClickeado — el botón tab que se clickeó
 * @param {string} idContenido — ID del div de contenido a mostrar
 */
function cambiarTab(tabClickeado, idContenido) {
  // Encuentra el contenedor de tabs padre
  const contenedorTabs = tabClickeado.closest('.tabs');
  if (!contenedorTabs) return;

  // Desactiva todos los tabs del mismo grupo
  contenedorTabs.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('activo');
  });

  // Activa el tab clickeado
  tabClickeado.classList.add('activo');

  // Oculta todos los contenidos de tabs que son hermanos del contenedor
  const panelPadre = contenedorTabs.parentElement;
  if (panelPadre) {
    panelPadre.querySelectorAll('.tab-contenido').forEach(contenido => {
      contenido.classList.remove('activo');
    });
  }

  // Muestra el contenido correspondiente
  const contenidoObjetivo = document.getElementById(idContenido);
  if (contenidoObjetivo) {
    contenidoObjetivo.classList.add('activo');
  }
}


// ────────────────────────────────────────────────────────────
// CERRAR SESIÓN
// ────────────────────────────────────────────────────────────

/**
 * Cierra la sesión del usuario.
 * Limpia la sesión local, actualiza el header y va al login.
 */
function cerrarSesion() {
  detenerNotificaciones();
  // Si Google está cargado, revoca el token
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }

  Sesion.cerrar();
  mostrarHeaderDeslogueado();
  mostrarSeccion('login');
}


// ────────────────────────────────────────────────────────────
// ESTRELLAS (calificación de reseñas)
// ────────────────────────────────────────────────────────────

/**
 * Maneja la selección de estrellas en el modal de calificación.
 * Colorea las estrellas hasta la seleccionada.
 *
 * @param {number} valor — del 1 al 5
 */
function seleccionarEstrella(valor) {
  const estrellas = document.querySelectorAll('.estrella');
  const label = document.getElementById('estrellas-label');
  const inputPuntuacion = document.getElementById('calificar-puntuacion');

  const labels = {
    1: 'Necesita mejorar',
    2: 'Regular',
    3: 'Buena',
    4: 'Muy buena',
    5: 'Excelente'
  };

  estrellas.forEach((estrella, index) => {
    if (index < valor) {
      estrella.classList.add('activa');
    } else {
      estrella.classList.remove('activa');
    }
  });

  if (label) label.textContent = labels[valor] || '';
  if (inputPuntuacion) inputPuntuacion.value = valor;
}


// ────────────────────────────────────────────────────────────
// UTILIDADES VISUALES
// ────────────────────────────────────────────────────────────

/**
 * Muestra un toast (notificación temporal) en la pantalla.
 * Desaparece solo después de 3 segundos.
 *
 * @param {string} mensaje
 * @param {string} tipo — 'ok' | 'error'
 */
function mostrarToast(mensaje, tipo = 'ok') {
  // Elimina toast anterior si existe
  const toastExistente = document.getElementById('toast-global');
  if (toastExistente) toastExistente.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-global';
  toast.textContent = mensaje;
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: ${tipo === 'ok' ? '#27AE60' : '#C0392B'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: Lato, sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    max-width: 400px;
    text-align: center;
    animation: fadeInToast 0.3s ease;
  `;

  // Agrega animación
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes fadeInToast {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Desaparece después de 3 segundos
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 3000);
}

/**
 * Muestra u oculta un elemento por su ID.
 *
 * @param {string} id
 * @param {boolean} visible
 * @param {string} displayTipo — 'block' | 'flex' | 'grid' (por defecto 'block')
 */
function toggleElemento(id, visible, displayTipo = 'block') {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? displayTipo : 'none';
}

/**
 * Muestra un mensaje de error dentro de un formulario.
 *
 * @param {string} idElemento — ID del div de error
 * @param {string} mensaje
 */
function mostrarMensajeError(idElemento, mensaje) {
  const el = document.getElementById(idElemento);
  if (el) {
    el.textContent = mensaje;
    el.style.display = 'block';
  }
}

/**
 * Muestra un mensaje de éxito dentro de un formulario.
 *
 * @param {string} idElemento — ID del div de ok
 * @param {string} mensaje
 */
function mostrarMensajeOk(idElemento, mensaje) {
  const el = document.getElementById(idElemento);
  if (el) {
    el.textContent = mensaje;
    el.style.display = 'block';
  }
}

/**
 * Oculta todos los mensajes de error y ok de un formulario.
 *
 * @param {...string} ids — IDs de los elementos a ocultar
 */
function ocultarMensajes(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  });
}

/**
 * Habilita o deshabilita un botón y cambia su texto.
 * Útil para mostrar "Cargando..." mientras se espera respuesta del backend.
 *
 * @param {string} idBoton
 * @param {boolean} habilitado
 * @param {string} textoDeshabilitado — texto mientras está deshabilitado
 * @param {string} textoHabilitado — texto original del botón
 */
function toggleBoton(idBoton, habilitado, textoDeshabilitado = 'Cargando...', textoHabilitado = '') {
  const btn = document.getElementById(idBoton);
  if (!btn) return;
  btn.disabled = !habilitado;
  if (!habilitado) {
    btn.dataset.textoOriginal = textoHabilitado || btn.textContent;
    btn.textContent = textoDeshabilitado;
  } else {
    btn.textContent = textoHabilitado || btn.dataset.textoOriginal || btn.textContent;
  }
}

/**
 * Formatea una fecha DD/MM/YYYY para mostrar de forma amigable.
 * Ejemplo: "15/05/2026" → "15 de mayo de 2026"
 *
 * @param {string} fechaStr
 * @returns {string}
 */
function formatearFechaAmigable(fechaStr) {
  if (!fechaStr) return '';
  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];
  try {
    // Intenta formato DD/MM/YYYY
    const partes = fechaStr.toString().split('/');
    if (partes.length >= 2) {
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1;
      const año = partes[2] ? parseInt(partes[2]) : new Date().getFullYear();
      return `${dia} de ${meses[mes]} de ${año}`;
    }
    // Intenta formato ISO
    const fecha = new Date(fechaStr);
    if (!isNaN(fecha)) {
      return `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }
    return fechaStr;
  } catch {
    return fechaStr;
  }
}

/**
 * Devuelve el HTML de un badge de estado.
 *
 * @param {string} estado — 'activa' | 'pendiente' | 'aprobada' | 'rechazada' | 'finalizada' | 'cancelada'
 * @returns {string} HTML del badge
 */
function badgeEstado(estado) {
  const labels = {
    'activa':     'Activa',
    'pendiente':  'Pendiente',
    'aprobada':   'Aprobada',
    'rechazada':  'Rechazada',
    'finalizada': 'Finalizada',
    'cancelada':  'Cancelada'
  };
  return `<span class="badge badge-${estado}">${labels[estado] || estado}</span>`;
}

/**
 * Devuelve el HTML del badge de nivel de un reseñador.
 *
 * @param {string} nivel
 * @param {string} labelNivel
 * @returns {string} HTML del badge
 */
function badgeNivel(nivel, labelNivel) {
  if (nivel === 'nuevo_miembro') return '';
  return `<span class="badge badge-nivel">${labelNivel}</span>`;
}

/**
 * Devuelve los badges de Top5, Top20 y Destacado en HTML.
 *
 * @param {Object} badges — { top5, top20, destacado }
 * @returns {string} HTML de los badges
 */
function badgesRanking(badges) {
  if (!badges) return '';
  let html = '';
  if (badges.top5) html += `<span class="badge badge-top5">🏆 Top 5</span> `;
  if (badges.top20) html += `<span class="badge badge-top20">⭐ Top 20</span> `;
  if (badges.destacado) html += `<span class="badge badge-destacado">✨ Destacada</span> `;
  return html;
}

/**
 * Trunca un texto largo agregando "..." al final.
 *
 * @param {string} texto
 * @param {number} maxCaracteres
 * @returns {string}
 */
function truncarTexto(texto, maxCaracteres = 120) {
  if (!texto) return '';
  if (texto.length <= maxCaracteres) return texto;
  return texto.substring(0, maxCaracteres).trim() + '...';
}

/**
 * Limpia todos los campos de un formulario por su ID.
 *
 * @param {string} idForm
 */
function limpiarFormulario(idForm) {
  const form = document.getElementById(idForm);
  if (form) form.reset();
}
