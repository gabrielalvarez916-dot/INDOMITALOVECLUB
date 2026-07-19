// ============================================================
// admin-impersonar.js — Indómita Love Club
// ============================================================

const _IMPERSONACION_BACKUP_KEY = 'impersonacion_backup_admin';
let _impersonarSesionId = null;
let _impersonarRolObjetivo = null;

/**
 * Inicia la impersonación: guarda la sesión real del admin,
 * pide a la Edge Function que valide + audite + genere una
 * sesión real para el usuario objetivo, y la activa.
 *
 * @param {string} emailObjetivo
 */
async function iniciarImpersonacion(emailObjetivo) {
  const usuarioAdmin = Sesion.obtener();
  const { data: sesionActual } = await supabaseClient.auth.getSession();

  if (!usuarioAdmin || !sesionActual?.session) {
    mostrarToast('No se pudo identificar tu sesión de admin.', 'error');
    return;
  }

  // 1) Backup de la sesión real del admin (sobrevive a un refresh).
  sessionStorage.setItem(_IMPERSONACION_BACKUP_KEY, JSON.stringify({
    accessToken: sesionActual.session.access_token,
    refreshToken: sesionActual.session.refresh_token,
    usuarioAdmin
  }));

  const motivo = prompt(`¿Motivo para ver la plataforma como ${emailObjetivo}? (opcional)`) || null;

  // 2) La Edge Function valida (admin_iniciar_impersonacion), audita
  //    y mintea un magic link para el usuario objetivo.
  const { data: resultado, error } = await supabaseClient.functions.invoke('iniciar-impersonacion', {
    body: { emailObjetivo, motivo }
  });

  if (error || !resultado?.ok) {
    mostrarToast(resultado?.error || error?.message || 'No se pudo iniciar la impersonación.', 'error');
    sessionStorage.removeItem(_IMPERSONACION_BACKUP_KEY);
    return;
  }

  // 3) Canjeamos el token_hash por una sesión real del usuario objetivo.
  const { error: errorOtp } = await supabaseClient.auth.verifyOtp({
    token_hash: resultado.tokenHash,
    type: 'magiclink'
  });

  if (errorOtp) {
    mostrarToast('No se pudo activar la sesión del usuario objetivo.', 'error');
    sessionStorage.removeItem(_IMPERSONACION_BACKUP_KEY);
    return;
  }

  // 4) Ahora la sesión de Supabase ES la del usuario objetivo.
  //    Traemos su perfil completo (igual que hace verificarSesionActiva)
  //    para que Sesion quede con todos los datos reales, no solo email/rol.
  const { data: perfilObjetivo, error: errorPerfil } = await supabaseClient
    .from('usuarios')
    .select('*')
    .eq('id', resultado.usuarioObjetivo.id)
    .maybeSingle();

  if (errorPerfil || !perfilObjetivo) {
    mostrarToast('No se pudo cargar el perfil del usuario objetivo.', 'error');
    sessionStorage.removeItem(_IMPERSONACION_BACKUP_KEY);
    return;
  }

  _impersonarSesionId = resultado.sesionId;
  _impersonarRolObjetivo = perfilObjetivo.rol;

  Sesion.guardar(perfilObjetivo);
  mostrarHeaderLogueado(perfilObjetivo);
  mostrarBannerImpersonacion(perfilObjetivo.alias || perfilObjetivo.email);
  mostrarToast(`Ahora estás viendo la plataforma como ${perfilObjetivo.alias || perfilObjetivo.email}.`, 'ok');

  if (typeof mostrarSeccion === 'function') {
    mostrarSeccion('feed');
  }
}

/**
 * Sale del modo impersonación: restaura la sesión real del admin
 * (tokens + perfil) y cierra el registro de auditoría.
 */
async function salirImpersonacion() {
  const backupRaw = sessionStorage.getItem(_IMPERSONACION_BACKUP_KEY);

  if (backupRaw) {
    const backup = JSON.parse(backupRaw);

    await supabaseClient.auth.setSession({
      access_token: backup.accessToken,
      refresh_token: backup.refreshToken
    });
    // auth.uid() ya vuelve a ser el admin real acá.
    await supabaseClient.rpc('admin_finalizar_impersonacion');

    Sesion.guardar(backup.usuarioAdmin);
    sessionStorage.removeItem(_IMPERSONACION_BACKUP_KEY);
  }

  _impersonarSesionId = null;
  _impersonarRolObjetivo = null;

  ocultarBannerImpersonacion();
  location.reload();
}

function impersonacionActiva() {
  return sessionStorage.getItem(_IMPERSONACION_BACKUP_KEY) !== null;
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

  const header = document.getElementById('header');
  if (header) header.style.marginTop = '50px';

  document.getElementById('btn-salir-impersonacion').onclick = salirImpersonacion;
}

function ocultarBannerImpersonacion() {
  const banner = document.getElementById('banner-impersonacion');
  if (banner) {
    banner.remove();
    const header = document.getElementById('header');
    if (header) header.style.marginTop = '';
  }
}

function mostrarPanelRol() {
  const rol = _impersonarRolObjetivo || Sesion.rol();
  if (rol === 'autor') mostrarSeccion('panel-autor');
  else if (rol === 'reseñador') mostrarSeccion('panel-resenador');
  else if (rol === 'editorial') mostrarSeccion('panel-autor');
  else if (rol === 'admin') mostrarSeccion('admin');
  else mostrarSeccion('login');
}
