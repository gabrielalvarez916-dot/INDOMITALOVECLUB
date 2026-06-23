// ============================================================
// admin-impersonar.js — Indómita Love Club
// Modo "impersonar usuario" para diagnóstico y soporte del admin.
//
// IMPORTANTE: este archivo NO modifica config.js ni ui.js.
// Envuelve la función global llamarBackend() para inyectar el
// email del usuario impersonado y un marcador de trazabilidad,
// sin tocar el archivo original.
//
// Debe cargarse en index.html DESPUÉS de config.js y ANTES
// de los demás scripts que usan llamarBackend (admin.js, etc).
// ============================================================

let _impersonarEmailObjetivo = null;
let _impersonarEmailAdminReal = null;

// Guarda una referencia a la función original antes de envolverla
const _llamarBackendOriginal = llamarBackend;

/**
 * Versión envuelta de llamarBackend. Si hay una impersonación activa,
 * fuerza el email a ser el del usuario impersonado y agrega el campo
 * _adminImpersonando para que el backend lo registre y, si corresponde,
 * bloquee acciones de pago.
 *
 * Si no hay impersonación activa, se comporta exactamente igual que
 * la función original — cero cambio de comportamiento para el resto
 * de la app en uso normal.
 */
llamarBackend = async function (accion, datos = {}) {
  if (_impersonarEmailObjetivo) {
    datos = {
      ...datos,
      email: _impersonarEmailObjetivo,
      _adminImpersonando: _impersonarEmailAdminReal
    };
  }
  return _llamarBackendOriginal(accion, datos);
};


// ────────────────────────────────────────────────────────────
// CONTROL DE IMPERSONACIÓN
// ────────────────────────────────────────────────────────────

/**
 * Inicia el modo impersonación para el email indicado.
 * Llama al backend para validar permisos antes de activar nada
 * del lado del frontend.
 *
 * @param {string} emailObjetivo — usuario que se va a impersonar
 */
async function iniciarImpersonacion(emailObjetivo) {
  const emailAdmin = Sesion.email();
  if (!emailAdmin) {
    mostrarToast('No se pudo identificar tu sesión de admin.', 'error');
    return;
  }

  // Llama directo a la función original (todavía no hay impersonación activa)
  const resultado = await _llamarBackendOriginal('adminIniciarImpersonacion', {
    email: emailAdmin,
    emailObjetivo
  });

  if (!resultado.ok) {
    mostrarToast(resultado.mensaje || 'No se pudo iniciar la impersonación.', 'error');
    return;
  }

  _impersonarEmailObjetivo = emailObjetivo;
  _impersonarEmailAdminReal = emailAdmin;

  mostrarBannerImpersonacion(resultado.datos.alias || emailObjetivo);
  mostrarToast(`Ahora estás viendo la plataforma como ${resultado.datos.alias || emailObjetivo}.`, 'ok');

  // Recarga la sección actual para reflejar los datos del usuario impersonado
  if (typeof mostrarSeccion === 'function') {
    mostrarSeccion('feed');
  } else {
    location.reload();
  }

/**
 * Sale del modo impersonación y vuelve a la sesión de admin normal.
 */
function salirImpersonacion() {
  _impersonarEmailObjetivo = null;
  _impersonarEmailAdminReal = null;
  ocultarBannerImpersonacion();
  location.reload();
}

/**
 * Indica si el modo impersonación está activo actualmente.
 * @returns {boolean}
 */
function impersonacionActiva() {
  return _impersonarEmailObjetivo !== null;
}


// ────────────────────────────────────────────────────────────
// BANNER VISUAL (creado dinámicamente, sin tocar index.html ni ui.js)
// ────────────────────────────────────────────────────────────

/**
 * Crea e inserta el banner fijo que indica que el modo
 * impersonación está activo, con un botón para salir.
 *
 * @param {string} nombreObjetivo — alias o email a mostrar en el banner
 */
function mostrarBannerImpersonacion(nombreObjetivo) {
  if (document.getElementById('banner-impersonacion')) return;

  const banner = document.createElement('div');
  banner.id = 'banner-impersonacion';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #c0392b; color: white; text-align: center;
    padding: 10px 16px; font-weight: 700; font-family: sans-serif;
    font-size: 14px; display: flex; align-items: center;
    justify-content: center; gap: 16px; flex-wrap: wrap;
  `;
  banner.innerHTML = `
    <span>🔴 Modo admin — Viendo la plataforma como: ${nombreObjetivo}</span>
    <button id="btn-salir-impersonacion" style="
      background: white; color: #c0392b; border: none;
      padding: 4px 14px; border-radius: 6px; font-weight: 700;
      font-size: 13px; cursor: pointer;
    ">Salir del modo admin</button>
  `;
  document.body.prepend(banner);

  // Empuja el contenido hacia abajo para que el banner no tape el header
  document.body.style.paddingTop = banner.offsetHeight + 'px';

  document.getElementById('btn-salir-impersonacion').onclick = salirImpersonacion;
}

/**
 * Elimina el banner de impersonación si existe.
 */
function ocultarBannerImpersonacion() {
  const banner = document.getElementById('banner-impersonacion');
  if (banner) {
    banner.remove();
    document.body.style.paddingTop = '';
  }
}
