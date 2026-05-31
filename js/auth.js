// ============================================================
// auth.js — Indómita Love Club
// Login con Google OAuth, registro, manejo de sesión
// ============================================================


// ────────────────────────────────────────────────────────────
// INICIALIZACIÓN DE GOOGLE IDENTITY SERVICES
// ────────────────────────────────────────────────────────────

// ID de cliente de Google OAuth
// Lo obtenés de Google Cloud Console → Credenciales → ID de cliente OAuth
const GOOGLE_CLIENT_ID = '431980349307-jej7h0sfqdu88k5arl3atp8891jduk55.apps.googleusercontent.com';

// Variable global para guardar el token de Google temporalmente
// durante el proceso de registro (entre paso 1 y paso 2)
let _tokenGooglePendiente = null;
let _emailGooglePendiente = null;
let _nombreGooglePendiente = null;
let _apellidoGooglePendiente = null;

/**
 * Se ejecuta automáticamente cuando la librería de Google carga.
 * Inicializa Google Identity Services con el Client ID.
 */
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
}


// ────────────────────────────────────────────────────────────
// FLUJO DE LOGIN
// ────────────────────────────────────────────────────────────

/**
 * Se llama cuando el usuario hace clic en "Ingresar con Google".
 * Abre el popup de selección de cuenta de Google.
 */
function iniciarLoginGoogle() {
  if (typeof google === 'undefined' || !google.accounts) {
    mostrarMensajeError('login-error', 'Error al cargar Google. Recargá la página.');
    toggleElemento('login-error', true);
    return;
  }

  ocultarMensajes('login-error');

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

/**
 * Callback que llama Google después de que el usuario selecciona su cuenta.
 * Recibe el token JWT con los datos del usuario.
 *
 * @param {Object} respuesta — respuesta de Google con el credential (JWT)
 */
async function manejarRespuestaGoogle(respuesta) {
  if (!respuesta.credential) {
    mostrarErrorLogin('No se recibió respuesta de Google. Intentá nuevamente.');
    return;
  }

  const token = respuesta.credential;

  // Decodifica el JWT para obtener nombre y email (sin verificar, solo para UI)
  const datosGoogle = decodificarJWT(token);
  if (!datosGoogle) {
    mostrarErrorLogin('Error al procesar los datos de Google.');
    return;
  }

  // Guarda datos temporalmente para el paso 2 (registro)
  _tokenGooglePendiente = token;
  _emailGooglePendiente = datosGoogle.email;
  _nombreGooglePendiente = datosGoogle.given_name || datosGoogle.name?.split(' ')[0] || '';
  _apellidoGooglePendiente = datosGoogle.family_name || datosGoogle.name?.split(' ').slice(1).join(' ') || '';

  // Llama al backend para verificar si el usuario existe
  toggleElemento('login-cargando', true);
  toggleElemento('login-paso1', false);

  const resultado = await llamarBackend('loginConGoogle', {
    email: _emailGooglePendiente,
    googleToken: token
  });

  if (!resultado.ok) {
    mostrarErrorLogin(resultado.mensaje || 'Error al iniciar sesión.');
    return;
  }

  if (resultado.datos.esNuevo) {
    // Usuario nuevo: muestra paso 2 para elegir rol
    mostrarPasoEleccionRol();
  } else {
    // Usuario existente: inicia sesión directo
    completarLogin(resultado.datos.usuario);
  }
}

/**
 * Muestra el paso 2 del login: elección de rol.
 */
function mostrarPasoEleccionRol() {
  toggleElemento('login-cargando', false);
  toggleElemento('login-paso1', false);
  toggleElemento('login-paso2', true);
}

/**
 * Se llama cuando el usuario elige su rol en el paso 2.
 * Registra el usuario nuevo en el backend.
 *
 * @param {string} rol — 'autor' o 'reseñador'
 */
async function seleccionarRol(rol) {
  if (!_tokenGooglePendiente || !_emailGooglePendiente) {
    mostrarErrorLogin('Sesión expirada. Intentá ingresar nuevamente.');
    resetearLogin();
    return;
  }

  // Muestra spinner
  toggleElemento('login-paso2', false);
  toggleElemento('login-cargando', true);
  ocultarMensajes('login-error');

  const resultado = await llamarBackend('registrarUsuario', {
    email: _emailGooglePendiente,
    nombre: _nombreGooglePendiente,
    apellido: _apellidoGooglePendiente,
    rol: rol,
    googleToken: _tokenGooglePendiente
  });

  if (!resultado.ok) {
    mostrarErrorLogin(resultado.mensaje || 'Error al registrarse.');
    return;
  }

  // Limpia datos temporales
  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;
  _nombreGooglePendiente = null;
  _apellidoGooglePendiente = null;

  completarLogin(resultado.datos.usuario);
}

/**
 * Finaliza el proceso de login.
 * Guarda la sesión, actualiza el header y redirige al destino correcto.
 *
 * @param {Object} usuario — datos del usuario del backend
 */
function completarLogin(usuario) {
  // Guarda sesión local
  Sesion.guardar(usuario);

  // Actualiza el header
  mostrarHeaderLogueado(usuario);

  // Limpia datos temporales
  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;

  // Redirige según el rol
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

  mostrarToast(`¡Bienvenida, ${usuario.alias || usuario.nombre}!`, 'ok');
}


// ────────────────────────────────────────────────────────────
// VERIFICACIÓN DE SESIÓN
// ────────────────────────────────────────────────────────────

/**
 * Verifica con el backend que la sesión guardada siga siendo válida.
 * Se llama al cargar la página si hay sesión en sessionStorage.
 * Si el backend dice que la sesión es inválida, cierra la sesión local.
 */
async function verificarSesionActiva() {
  const usuario = Sesion.obtener();
  if (!usuario) return;

  const resultado = await llamarBackend('verificarSesion', {
    email: usuario.email
  });

  if (!resultado.ok) {
    // Sesión inválida: cierra sesión y va al login
    Sesion.cerrar();
    mostrarHeaderDeslogueado();
    mostrarSeccion('login');
    return;
  }

  // Actualiza los datos del usuario en sesión (puede haber cambiado el plan, nivel, etc.)
  Sesion.guardar(resultado.datos.usuario);
  mostrarHeaderLogueado(resultado.datos.usuario);
}


// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

/**
 * Muestra un error en la pantalla de login y resetea al paso 1.
 *
 * @param {string} mensaje
 */
function mostrarErrorLogin(mensaje) {
  toggleElemento('login-cargando', false);
  toggleElemento('login-paso1', true);
  toggleElemento('login-paso2', false);
  mostrarMensajeError('login-error', mensaje);
  toggleElemento('login-error', true);
}

/**
 * Resetea el formulario de login al estado inicial.
 */
function resetearLogin() {
  toggleElemento('login-paso1', true);
  toggleElemento('login-paso2', false);
  toggleElemento('login-cargando', false);
  ocultarMensajes('login-error');
  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;
  _nombreGooglePendiente = null;
  _apellidoGooglePendiente = null;
}

/**
 * Decodifica un JWT sin verificar la firma.
 * Solo para extraer datos del payload (nombre, email).
 * La verificación real la hace el backend con la API de Google.
 *
 * @param {string} token — JWT de Google
 * @returns {Object|null} payload del JWT o null si falla
 */
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
// CONECTAR BOTÓN DE LOGIN AL HTML
// ────────────────────────────────────────────────────────────

/**
 * Conecta el botón "Ingresar con Google" del HTML a la función de login.
 * Se ejecuta cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', () => {
  const btnGoogle = document.getElementById('btn-google-login');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', iniciarLoginGoogle);
  }

  const btnLoginHeader = document.getElementById('btn-login-header');
  if (btnLoginHeader) {
    btnLoginHeader.addEventListener('click', () => mostrarSeccion('login'));
  }

  // Verifica sesión activa si hay datos guardados
  if (Sesion.activa()) {
    verificarSesionActiva();
  }
});
