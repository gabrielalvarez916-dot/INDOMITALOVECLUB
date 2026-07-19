// ============================================================
// auth.js — Indómita Love Club
// Login con Google OAuth, registro, manejo de sesión
// ============================================================


// ────────────────────────────────────────────────────────────
// FUNCIONES UI BÁSICAS (no dependen de ui.js)
// ────────────────────────────────────────────────────────────

function _ocultarMensajes(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
}

function _toggleElemento(id, visible, tipo = 'block') {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? tipo : 'none';
}

function _mostrarMensajeError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}


// ────────────────────────────────────────────────────────────
// INICIALIZACIÓN DE GOOGLE IDENTITY SERVICES
// ────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = '431980349307-jej7h0sfqdu88k5arl3atp8891jduk55.apps.googleusercontent.com';

let _tokenGooglePendiente = null;
let _emailGooglePendiente = null;
let _nombreGooglePendiente = null;
let _apellidoGooglePendiente = null;
let _googleInicializado = false;

window.onload = () => {
  if (typeof google !== 'undefined' && google.accounts) {
    inicializarGoogle();
  }
};

function inicializarGoogle() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: manejarRespuestaGoogle,
    auto_select: false,
    cancel_on_tap_outside: true
  });
  _googleInicializado = true;
}




// ────────────────────────────────────────────────────────────
// FLUJO DE LOGIN
// ────────────────────────────────────────────────────────────

function iniciarLoginGoogle() {
  if (typeof google === 'undefined' || !google.accounts) {
    _mostrarMensajeError('login-error', 'Error al cargar Google. Recargá la página.');
    _toggleElemento('login-error', true);
    return;
  }

  if (!_googleInicializado) {
    inicializarGoogle(); // ← se asegura de inicializar justo antes de renderizar
  }

  _ocultarMensajes('login-error');

  const div = document.getElementById('google-btn-container');
  if (!div) return;

  div.innerHTML = '';
  google.accounts.id.renderButton(div, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    width: 280
  });

  setTimeout(() => {
    const btn = div.querySelector('div[role=button]');
    if (btn) btn.click();
  }, 100);
}

async function manejarRespuestaGoogle(respuesta) {
  if (!respuesta.credential) {
    mostrarErrorLogin('No se recibió respuesta de Google. Intentá nuevamente.');
    return;
  }

  const token = respuesta.credential;
  const datosGoogle = decodificarJWT(token); // solo para precargar nombre/apellido en el paso 2

  _nombreGooglePendiente = datosGoogle?.given_name || datosGoogle?.name?.split(' ')[0] || '';
  _apellidoGooglePendiente = datosGoogle?.family_name || datosGoogle?.name?.split(' ').slice(1).join(' ') || '';

  _toggleElemento('login-cargando', true);
  _toggleElemento('login-paso1', false);

  // 1. Login real contra Supabase (verifica el token del lado del servidor)
  const { data, error } = await supabaseClient.auth.signInWithIdToken({
    provider: 'google',
    token: token
  });

  if (error) {
    mostrarErrorLogin('Error al iniciar sesión: ' + error.message);
    return;
  }

  // 2. ¿Ya tiene perfil en la tabla usuarios?
  const { data: perfil, error: errorPerfil } = await supabaseClient
    .from('usuarios')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (errorPerfil) {
    mostrarErrorLogin('Error al verificar perfil: ' + errorPerfil.message);
    return;
  }

  if (!perfil || !perfil.rol) {
    mostrarPasoEleccionRol(); // usuario nuevo o incompleto, falta elegir rol
  } else {
    await completarLogin(perfil);
  }
}

async function seleccionarRol(rol) {
  const nombre = document.getElementById('paso2-nombre')?.value.trim();
  const apellido = document.getElementById('paso2-apellido')?.value.trim();

  if (!nombre || !apellido) {
    mostrarErrorLogin('Nombre y apellido son obligatorios.');
    _toggleElemento('login-paso2', true);
    return;
  }

  _toggleElemento('login-paso2', false);
  _toggleElemento('login-cargando', true);
  _ocultarMensajes('login-error');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    mostrarErrorLogin('Sesión expirada. Intentá ingresar nuevamente.');
    resetearLogin();
    return;
  }

  const { data: nuevoPerfil, error } = await supabaseClient
    .from('usuarios')
    .upsert({
      id: user.id,
      email: user.email,
      nombre: nombre,
      apellido: apellido,
      rol: rol
    })
    .select()
    .single();
  
  if (error) {
    mostrarErrorLogin('Error al registrarse: ' + error.message);
    return;
  }

  await completarLogin(nuevoPerfil);
}

async function completarLogin(usuario) {
  Sesion.guardar(usuario);

  if (await _sitioEnMantenimiento(usuario.email)) {
    _mostrarPantallaMantenimiento();
    return;
  }

  mostrarHeaderLogueado(usuario);
  iniciarNotificaciones();
  if (typeof inicializarEventos === 'function') inicializarEventos();

  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;

  if (usuario.rol !== 'admin' && !perfilEstaCompleto(usuario)) {
    mostrarGatePerfilObligatorio(usuario);
    return;
  }

  verificarModalActualizacion();
  redirigirSegunRol(usuario);
  mostrarToast(`¡Bienvenida, ${usuario.alias || usuario.nombre}!`, 'ok');
  if (typeof inicializarTutorialBienvenida === 'function') inicializarTutorialBienvenida(usuario);
}

// ────────────────────────────────────────────────────────────
// VERIFICACIÓN DE SESIÓN
// ────────────────────────────────────────────────────────────

async function verificarSesionActiva() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    Sesion.cerrar();
    mostrarHeaderDeslogueado();
    mostrarSeccion('login');
    return;
  }

  const { data: perfil, error } = await supabaseClient
    .from('usuarios')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !perfil || !perfil.rol) {
    Sesion.cerrar();
    mostrarHeaderDeslogueado();
    mostrarSeccion('login');
    return;
  }

  Sesion.guardar(perfil);

  if (await _sitioEnMantenimiento(perfil.email)) {
    _mostrarPantallaMantenimiento();
    return;
  }

  mostrarHeaderLogueado(perfil);
  iniciarNotificaciones();
  if (typeof inicializarEventos === 'function') inicializarEventos();

  if (perfil.rol !== 'admin' && !perfilEstaCompleto(perfil)) {
    mostrarGatePerfilObligatorio(perfil);
  }
}

// ────────────────────────────────────────────────────────────
// MODO MANTENIMIENTO
// ────────────────────────────────────────────────────────────

async function _sitioEnMantenimiento(emailUsuario) {
  const { data: configRows, error } = await supabaseClient
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['mantenimiento_activo', 'mantenimiento_usuarios_excluidos']);

  if (error || !configRows) return false;

  const activo = configRows.find(r => r.clave === 'mantenimiento_activo')?.valor === 'true';
  if (!activo) return false;

  const excluidos = (configRows.find(r => r.clave === 'mantenimiento_usuarios_excluidos')?.valor || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  return !excluidos.includes((emailUsuario || '').toLowerCase());
}

function _mostrarPantallaMantenimiento() {
  document.body.innerHTML = `
    <div style="display:flex;height:100vh;align-items:center;justify-content:center;text-align:center;font-family:sans-serif;padding:20px;">
      <div>
        <h1>Estamos actualizando el sistema</h1>
        <p>Volvé en unos minutos, ya casi terminamos.</p>
      </div>
    </div>`;
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function mostrarPasoEleccionRol() {
  _toggleElemento('login-cargando', false);
  _toggleElemento('login-paso1', false);
  _toggleElemento('login-paso2', true);

  const inputNombre = document.getElementById('paso2-nombre');
  const inputApellido = document.getElementById('paso2-apellido');
  if (inputNombre) inputNombre.value = _nombreGooglePendiente || '';
  if (inputApellido) inputApellido.value = _apellidoGooglePendiente || '';
}

function mostrarErrorLogin(mensaje) {
  _toggleElemento('login-cargando', false);
  _toggleElemento('login-paso1', true);
  _toggleElemento('login-paso2', false);
  _mostrarMensajeError('login-error', mensaje);
  _toggleElemento('login-error', true);
}

function resetearLogin() {
  _toggleElemento('login-paso1', true);
  _toggleElemento('login-paso2', false);
  _toggleElemento('login-cargando', false);
  _ocultarMensajes('login-error');
  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;
  _nombreGooglePendiente = null;
  _apellidoGooglePendiente = null;
}

function decodificarJWT(token) {
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const payload = JSON.parse(atob(partes[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch (e) {
    console.error('Error decodificando JWT:', e);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// GATE OBLIGATORIO DE PERFIL COMPLETO
// ────────────────────────────────────────────────────────────

function perfilEstaCompleto(usuario) {
  if (!usuario) return false;
  return !!(usuario.alias && usuario.pais && usuario.ciudad);
}

function redirigirSegunRol(usuario) {
  switch (usuario.rol) {
    case 'autor':
      mostrarSeccion('panel-autor');
      break;
    case 'reseñador':
      mostrarSeccion('feed');
      break;
    case 'admin':
      mostrarSeccion('admin');
      break;
    default:
      mostrarSeccion('feed');
  }
}

function mostrarGatePerfilObligatorio(usuario) {
  let overlay = document.getElementById('gate-perfil-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gate-perfil-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center;
      z-index:99999; padding:20px;
    `;
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:28px; max-width:420px; width:100%; max-height:90vh; overflow-y:auto;">
      <h2 style="margin-bottom:8px;">Completá tu perfil</h2>
      <p style="font-size:13px; color:#777; margin-bottom:16px;">Necesitamos estos datos antes de que puedas seguir usando la plataforma.</p>
      <form id="form-gate-perfil">
        <div class="form-grupo">
          <label class="form-label">Alias</label>
          <input type="text" id="gate-alias" class="form-input" required />
        </div>
        <div class="form-grupo">
          <label class="form-label">País</label>
          <input type="text" id="gate-pais" class="form-input" required />
        </div>
        <div class="form-grupo">
          <label class="form-label">Ciudad</label>
          <input type="text" id="gate-ciudad" class="form-input" required />
        </div>
        <div id="gate-perfil-error" class="mensaje-error" style="display:none;"></div>
        <button type="submit" class="btn-primario btn-full" style="margin-top:12px;">Guardar y continuar</button>
      </form>
    </div>
  `;

  document.body.style.overflow = 'hidden';

  const form = document.getElementById('form-gate-perfil');
  form.onsubmit = (e) => guardarPerfilObligatorio(e, usuario);
}

async function guardarPerfilObligatorio(event, usuario) {
  event.preventDefault();
  _ocultarMensajes('gate-perfil-error');

  const alias  = document.getElementById('gate-alias')?.value.trim();
  const pais   = document.getElementById('gate-pais')?.value.trim();
  const ciudad = document.getElementById('gate-ciudad')?.value.trim();

  if (!alias || !pais || !ciudad) {
    _mostrarMensajeError('gate-perfil-error', 'Todos los campos son obligatorios.');
    return;
  }

  const { data: perfilActualizado, error } = await supabaseClient
    .from('usuarios')
    .update({ alias, pais, ciudad })
    .eq('id', usuario.id)
    .select()
    .single();

  if (error) {
    _mostrarMensajeError('gate-perfil-error', error.message);
    return;
  }

  const overlay = document.getElementById('gate-perfil-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';

  Sesion.guardar(perfilActualizado);
  verificarModalActualizacion();
  redirigirSegunRol(perfilActualizado);
  mostrarToast(`¡Bienvenida, ${perfilActualizado.alias}!`, 'ok');
}

// ────────────────────────────────────────────────────────────
// CONECTAR BOTÓN DE LOGIN AL HTML
// ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const btnGoogle = document.getElementById('btn-google-login');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', iniciarLoginGoogle);
  }

  const btnLoginHeader = document.getElementById('btn-login-header');
  if (btnLoginHeader) {
    btnLoginHeader.addEventListener('click', () => mostrarSeccion('login'));
  }

  if (Sesion.activa()) {
    verificarSesionActiva();
  }
});
// ────────────────────────────────────────────────────────────
// MODAL DE ACTUALIZACIONES
// ────────────────────────────────────────────────────────────

async function verificarModalActualizacion() {
  const usuario = Sesion.obtener();
  if (!usuario) return;

  // Busca el modal marcado como activo (si hay alguno)
  const { data: modal, error } = await supabaseClient
    .from('modales_actualizacion')
    .select('*')
    .eq('activo', true)
    .maybeSingle();

  if (error || !modal) return; // no hay ningún modal activo, no mostramos nada

  // ¿Este usuario ya vio ESTE modal en particular? (usamos su id como "tipo")
  const { data: yaVisto, error: errorVisto } = await supabaseClient
    .from('modal_actualizaciones')
    .select('id')
    .eq('id_usuario', usuario.id)
    .eq('tipo_actualizacion', modal.id)
    .maybeSingle();

  if (errorVisto) {
    console.error('Error verificando modal:', errorVisto);
    return;
  }

  if (!yaVisto) {
    mostrarModalActualizaciones(modal);
  }
}

function mostrarModalActualizaciones(modal) {
  const modalEl = document.getElementById('modal-actualizaciones');
  const overlay = document.getElementById('modal-overlay');
  const contenedor = document.getElementById('modal-actualizaciones-contenido');
  const btnEntendido = document.getElementById('btn-modal-actualizaciones-entendido');

  if (!modalEl || !overlay || !contenedor || !btnEntendido) return;

  contenedor.innerHTML = `
    ${modal.imagen_url ? `<img src="${modal.imagen_url}" alt="" style="max-width:100%; border-radius:12px; margin-bottom:16px; display:block;" />` : ''}
    <div>${_escaparHtmlModal(modal.texto).replace(/\n/g, '<br>')}</div>
  `;

  overlay.style.display = 'block';
  modalEl.style.display = 'block';
  document.body.style.overflow = 'hidden';

  btnEntendido.onclick = () => {
    registrarModalVisto(modal.id);
  };
}

async function registrarModalVisto(idModal) {
  const usuario = Sesion.obtener();
  if (!usuario) return;

  const { error } = await supabaseClient
    .from('modal_actualizaciones')
    .insert({
      id_usuario: usuario.id,
      tipo_actualizacion: idModal
    });

  if (!error) {
    const modal = document.getElementById('modal-actualizaciones');
    const overlay = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  } else {
    console.error('Error registrando modal visto:', error);
  }
}

function _escaparHtmlModal(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

