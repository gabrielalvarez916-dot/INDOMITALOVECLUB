// ============================================================
// admin-impersonar.js — Indómita Love Club
// ============================================================

let _impersonarEmailObjetivo = null;
let _impersonarEmailAdminReal = null;

const _llamarBackendOriginal = llamarBackend;

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

async function iniciarImpersonacion(emailObjetivo) {
  const emailAdmin = Sesion.email();
  if (!emailAdmin) {
    mostrarToast('No se pudo identificar tu sesión de admin.', 'error');
    return;
  }

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

  // Actualiza el header con el rol del usuario impersonado
  if (typeof mostrarHeaderLogueado === 'function') {
    mostrarHeaderLogueado({
      alias: resultado.datos.alias || emailObjetivo,
      email: resultado.datos.email,
      rol:   resultado.datos.rol
    });
  }

  if (typeof mostrarSeccion === 'function') {
    mostrarSeccion('feed');
  }
} // ← esta llave faltaba

function salirImpersonacion() {
  _impersonarEmailObjetivo = null;
  _impersonarEmailAdminReal = null;
  ocultarBannerImpersonacion();
  location.reload();
}

function impersonacionActiva() {
  return _impersonarEmailObjetivo !== null;
}

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

  document.body.style.paddingTop = '50px';

  document.getElementById('btn-salir-impersonacion').onclick = salirImpersonacion;
}

function ocultarBannerImpersonacion() {
  const banner = document.getElementById('banner-impersonacion');
  if (banner) {
    banner.remove();
    document.body.style.paddingTop = '';
  }
}
