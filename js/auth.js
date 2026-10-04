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

  const datosNuevoUsuario = {
    id: user.id,
    email: user.email,
    nombre: nombre,
    apellido: apellido,
    rol: rol
  };

  // Autor y editorial arrancan en su plan free correspondiente.
  // Reseñador no maneja plan, así que no le seteamos nada.
  if (rol === 'autor') {
    datosNuevoUsuario.plan = 'free';
  } else if (rol === 'editorial') {
    datosNuevoUsuario.plan = 'editorial_free';
  }

  const { data: nuevoPerfil, error } = await supabaseClient
    .from('usuarios')
    .upsert(datosNuevoUsuario)
    .select()
    .single();
  
  if (error) {
    mostrarErrorLogin('Error al registrarse: ' + error.message);
    return;
  }

  // Referidos: si entró por el link de un autor, queda registrado (si falla, no frena el registro).
  await registrarReferidoPendiente();

  // Vendedores: código escrito a mano o guardado del link ?v=CODIGO (solo autores y editoriales).
  if (rol === 'autor' || rol === 'editorial') {
    await registrarCodigoVendedorPendiente();
  }

  await completarLogin(nuevoPerfil);
}

async function registrarReferidoPendiente() {
  try {
    const guardado = JSON.parse(localStorage.getItem('ref_codigo') || 'null');
    localStorage.removeItem('ref_codigo');
    if (!guardado?.c || !guardado?.t) return;
    if ((Date.now() - guardado.t) > 30 * 24 * 60 * 60 * 1000) return; // el link vale 30 días
    await supabaseClient.rpc('registrar_referido', { p_codigo: guardado.c });
  } catch (e) {
    console.error('Error registrando referido:', e);
  }
}

async function registrarCodigoVendedorPendiente() {
  try {
    const escrito = (document.getElementById('paso2-codigo-vendedor')?.value || '').trim().toUpperCase();
    let codigo = escrito;
    if (!codigo) {
      const guardado = JSON.parse(localStorage.getItem('vend_codigo') || 'null');
      if (guardado?.c && guardado?.t && (Date.now() - guardado.t) <= 30 * 24 * 60 * 60 * 1000) {
        codigo = guardado.c;
      }
    }
    localStorage.removeItem('vend_codigo');
    if (!codigo) return;

    const { data, error } = await supabaseClient.rpc('registrar_codigo_vendedor', { p_codigo: codigo });
    if (error) throw error;
    // Si lo escribió a mano y no existe, se le avisa; el registro sigue igual (queda por rotación).
    if (escrito && data === 'codigo_invalido') {
      mostrarToast('El código de vendedor no es válido. Te registramos igual.', 'advertencia');
    }
  } catch (e) {
    console.error('Error registrando código de vendedor:', e);
  }
}

async function completarLogin(usuario) {
  Sesion.guardar(usuario);

  if (await _sitioEnMantenimiento(usuario.email)) {
    _mostrarPantallaMantenimiento();
    return;
  }

  mostrarHeaderLogueado(usuario);
  iniciarNotificaciones();
  iniciarBandejaSoporteUsuario();
  if (typeof inicializarEventos === 'function' && typeof _EventosState !== 'undefined') {
    _EventosState.promesaInit = inicializarEventos();
  }

  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;

  if (usuario.rol !== 'admin' && !(await perfilEstaCompleto(usuario))) {
    if (typeof mostrarGatePerfilObligatorio === 'function') {
      mostrarGatePerfilObligatorio(usuario, () => _continuarOnboarding(usuario));
    }
    return;
  }

  verificarModalActualizacion();
  redirigirSegunRol(usuario);
  mostrarToast(`👀 Mirá quién volvió. Bienvenida, ${usuario.alias || usuario.nombre}.`, 'ok');
  _continuarOnboarding(usuario);
}

// ────────────────────────────────────────────────────────────
// ORQUESTADOR DE ONBOARDING — evita que Wizard, Tutorial, Modal de
// Evento Nuevo y Aviso de Completar Perfil se superpongan o se
// disparen "de fondo" (el bug de siempre). Un solo lugar decide el
// orden y cada paso solo avanza al siguiente cuando el anterior
// realmente se cerró.
//
// Orden:
//   - Usuarios NUEVOS (con wizard pendiente): Wizard → Tutorial → Evento
//     (el wizard ya llama a _continuarOnboarding cuando termina, ver
//     mostrarGatePerfilObligatorio más arriba)
//   - Usuarios VIEJOS / con perfil ya completo: Tutorial → Evento →
//     Aviso de completar perfil (este último va al final a propósito:
//     tiene un botón que saca al usuario a editar su perfil, así que no
//     tiene sentido meterlo en medio del tutorial o antes del evento).
// ────────────────────────────────────────────────────────────

function _continuarOnboarding(usuario) {
  if (!usuario || usuario.rol === 'admin' || usuario.rol === 'vendedor') return;
  _pasoTutorialOnboarding(usuario);
}

function _pasoTutorialOnboarding(usuario) {
  if (typeof inicializarTutorialBienvenida === 'function') {
    inicializarTutorialBienvenida(usuario, () => _pasoEventoOnboarding(usuario));
  } else {
    _pasoEventoOnboarding(usuario);
  }
}

function _pasoEventoOnboarding(usuario) {
  if (typeof mostrarModalEventoSiCorrespondeYAvanzar === 'function') {
    mostrarModalEventoSiCorrespondeYAvanzar(() => _pasoAvisoPerfilOnboarding(usuario));
  } else {
    _pasoAvisoPerfilOnboarding(usuario);
  }
}

function _pasoAvisoPerfilOnboarding(usuario) {
  const esCuentaNueva = typeof _esCuentaNueva === 'function' && _esCuentaNueva(usuario);
  // A las cuentas nuevas ya las cubrió el wizard bloqueante: no les
  // mostramos también el aviso de "completar perfil".
  if (!esCuentaNueva && typeof verificarAvisoPerfilIncompleto === 'function') {
    verificarAvisoPerfilIncompleto(usuario);
  }
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
  iniciarBandejaSoporteUsuario();
  if (typeof inicializarEventos === 'function' && typeof _EventosState !== 'undefined') {
    _EventosState.promesaInit = inicializarEventos();
  }

  if (perfil.rol !== 'admin' && !(await perfilEstaCompleto(perfil))) {
    if (typeof mostrarGatePerfilObligatorio === 'function') {
      mostrarGatePerfilObligatorio(perfil, () => _continuarOnboarding(perfil));
    }
    return;
  }

  _continuarOnboarding(perfil);
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

  // Si vino por un link de vendedor (?v=CODIGO), precarga el código.
  const inputCodigo = document.getElementById('paso2-codigo-vendedor');
  if (inputCodigo && !inputCodigo.value) {
    try {
      const guardado = JSON.parse(localStorage.getItem('vend_codigo') || 'null');
      if (guardado?.c && guardado?.t && (Date.now() - guardado.t) <= 30 * 24 * 60 * 60 * 1000) {
        inputCodigo.value = guardado.c;
      }
    } catch (e) {}
  }
}

function mostrarErrorLogin(mensaje) {
  _toggleElemento('login-cargando', false);
  _toggleElemento('login-paso1', true);
  _toggleElemento('login-paso2', false);
  _toggleElemento('login-vendedor', false);
  _mostrarMensajeError('login-error', mensaje);
  _toggleElemento('login-error', true);
}

function resetearLogin() {
  _toggleElemento('login-paso1', true);
  _toggleElemento('login-paso2', false);
  _toggleElemento('login-vendedor', false);
  _toggleElemento('login-cargando', false);
  _ocultarMensajes('login-error');
  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;
  _nombreGooglePendiente = null;
  _apellidoGooglePendiente = null;
}


// ────────────────────────────────────────────────────────────
// INGRESO SOLO PARA VENDEDORES (mail + contraseña)
// Para vendedores que no pueden usar Google (ej: cuentas Yahoo).
// Solo funciona si el admin ya cargó el mail como vendedor
// (vendedores_pendientes) o si el usuario ya es vendedor.
// ────────────────────────────────────────────────────────────

let _vendModoCrear = false;

function mostrarLoginVendedor() {
  _ocultarMensajes('login-error');
  _toggleElemento('login-paso1', false);
  _toggleElemento('login-paso2', false);
  _toggleElemento('login-vendedor', true);
}

function alternarCrearCuentaVendedor() {
  _vendModoCrear = !_vendModoCrear;
  _toggleElemento('vend-login-extra', _vendModoCrear);
  const btn = document.getElementById('vend-login-btn');
  const tog = document.getElementById('vend-login-toggle');
  const pass = document.getElementById('vend-login-pass');
  if (btn) btn.textContent = _vendModoCrear ? 'Crear mi cuenta' : 'Ingresar';
  if (tog) tog.textContent = _vendModoCrear ? 'Ya tengo cuenta: ingresar' : 'Es mi primera vez: crear mi cuenta';
  if (pass) pass.setAttribute('autocomplete', _vendModoCrear ? 'new-password' : 'current-password');
  _ocultarMensajes('login-error');
}

function _errorVendedor(msg) {
  _toggleElemento('login-cargando', false);
  _toggleElemento('login-vendedor', true);
  _mostrarMensajeError('login-error', msg);
  _toggleElemento('login-error', true);
}

async function enviarLoginVendedor() {
  const email = (document.getElementById('vend-login-email')?.value || '').trim().toLowerCase();
  const pass = document.getElementById('vend-login-pass')?.value || '';
  const nombre = (document.getElementById('vend-login-nombre')?.value || '').trim();
  const apellido = (document.getElementById('vend-login-apellido')?.value || '').trim();

  _ocultarMensajes('login-error');
  if (!email || !pass) { _errorVendedor('Completá el mail y la contraseña.'); return; }
  if (_vendModoCrear) {
    if (pass.length < 8) { _errorVendedor('La contraseña tiene que tener al menos 8 caracteres.'); return; }
    if (!nombre || !apellido) { _errorVendedor('Nombre y apellido son obligatorios.'); return; }
  }

  _toggleElemento('login-vendedor', false);
  _toggleElemento('login-cargando', true);

  let sesion = null;

  if (_vendModoCrear) {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password: pass,
      options: { data: { nombre, apellido }, emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if (error) { _errorVendedor('No se pudo crear la cuenta: ' + error.message); return; }
    sesion = data?.session || null;
    if (!sesion) {
      _toggleElemento('login-cargando', false);
      _toggleElemento('login-vendedor', true);
      mostrarToast('Te mandamos un mail para confirmar tu cuenta. Confirmalo y después ingresá con tu contraseña.', 'ok');
      alternarCrearCuentaVendedor();
      return;
    }
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (error) {
      const msg = /confirm/i.test(error.message)
        ? 'Tenés que confirmar tu mail primero. Revisá tu bandeja (y el spam).'
        : 'Mail o contraseña incorrectos.';
      _errorVendedor(msg);
      return;
    }
    sesion = data.session;
  }

  // Activa la cuenta como vendedor (solo si el admin ya habilitó ese mail)
  const { error: errAct } = await supabaseClient.rpc('vendedor_activar_cuenta', {
    p_nombre: nombre || null, p_apellido: apellido || null
  });
  if (errAct) {
    await supabaseClient.auth.signOut();
    _errorVendedor(/habilitado/i.test(errAct.message)
      ? 'Este mail no está habilitado como vendedor. Pedile a Indómita que lo habilite.'
      : 'No se pudo activar tu cuenta: ' + errAct.message);
    return;
  }

  const { data: perfil, error: errPerfil } = await supabaseClient
    .from('usuarios').select('*').eq('id', sesion.user.id).maybeSingle();
  if (errPerfil || !perfil || perfil.rol !== 'vendedor') {
    await supabaseClient.auth.signOut();
    _errorVendedor('No se pudo cargar tu perfil de vendedor.');
    return;
  }

  await completarLogin(perfil);
}

async function olvideContrasenaVendedor() {
  const email = (document.getElementById('vend-login-email')?.value || '').trim().toLowerCase();
  if (!email) { _errorVendedor('Escribí tu mail arriba y volvé a tocar "Olvidé mi contraseña".'); return; }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) { _errorVendedor('No se pudo enviar el mail: ' + error.message); return; }
  mostrarToast('Si el mail existe, te mandamos un link para cambiar la contraseña.', 'ok');
}


// Si el vendedor llega desde el link de "Olvidé mi contraseña", le pedimos la nueva.
supabaseClient.auth.onAuthStateChange(async (evento) => {
  if (evento !== 'PASSWORD_RECOVERY') return;
  const nueva = window.prompt('Elegí tu nueva contraseña (mínimo 8 caracteres):');
  if (!nueva || nueva.length < 8) {
    mostrarToast('La contraseña no se cambió. Pedí el link de nuevo.', 'advertencia');
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password: nueva });
  mostrarToast(error ? 'No se pudo cambiar la contraseña: ' + error.message : 'Contraseña actualizada.', error ? 'advertencia' : 'ok');
});

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
// GATE OBLIGATORIO DE PERFIL COMPLETO (wizard por pasos)
// La lógica de pasos, render y guardado vive en js/wizard-onboarding.js.
// Acá solo queda el chequeo de si falta algo, reusado por completarLogin()
// y verificarSesionActiva().
// ────────────────────────────────────────────────────────────

async function perfilEstaCompleto(usuario) {
  if (!usuario) return false;
  return (await obtenerPasoWizardPendiente(usuario)) === null;
}

function redirigirSegunRol(usuario) {
  switch (usuario.rol) {
    case 'autor':
      mostrarSeccion('panel-autor');
      break;
    case 'reseñador':
      mostrarSeccion('feed');
      break;
    case 'editorial':
      mostrarSeccion('panel-autor');
      break;
    case 'admin':
      mostrarSeccion('admin-panel');
      break;
    case 'vendedor':
      mostrarSeccion('panel-vendedor');
      break;
    default:
      mostrarSeccion('feed');
  }

  // Si el login se disparó porque el autor vino de un link con
  // ?ir=panel-autor&impulsar=ID (ej: mail "Impulsá tu campaña") y no
  // tenía sesión guardada, retoma ese redirect ahora que ya se logueó.
  if (typeof _manejarRedirectImpulsarDesdeURL === 'function') {
    _manejarRedirectImpulsarDesdeURL();
  }
}

// mostrarGatePerfilObligatorio(usuario) ahora vive en js/wizard-onboarding.js
// y arma el wizard de pasos en vez de un formulario único.

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

  verificarSesionActiva(); 
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

  // Alcance por rol: 'todos' y 'existentes' aplican a cualquier rol (a 'existentes'
  // los usuarios nuevos ya quedan excluidos aparte, al elegir rol por primera vez).
  // 'resenador' / 'autor' / 'editorial' solo aplican a ese rol puntual.
  const ROL_A_ALCANCE = { 'reseñador': 'resenador', 'autor': 'autor', 'editorial': 'editorial' };
  if (modal.alcance !== 'todos' && modal.alcance !== 'existentes') {
    if (ROL_A_ALCANCE[usuario.rol] !== modal.alcance) return;
  }

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

// A dónde navega cada código de destino guardado en el modal.
// Separado por grupo porque "Biblioteca" y "Ranking" son secciones distintas
// según el rol (ej: biblioteca-autor vs biblioteca-resenador).
const DESTINOS_BOTON_MODAL_AUTOR_EDITORIAL = {
  panel: () => { if (typeof mostrarPanelRol === 'function') mostrarPanelRol(); },
  feed: () => { if (typeof mostrarSeccion === 'function') mostrarSeccion('feed'); },
  biblioteca: () => { if (typeof abrirMiBibliotecaAutor === 'function') abrirMiBibliotecaAutor(); },
  ranking: () => {
    if (typeof mostrarPanelRol === 'function') mostrarPanelRol();
    setTimeout(() => document.getElementById('tabbtn-ranking-libros')?.click(), 50);
  },
  evento: () => { if (typeof mostrarSeccion === 'function') mostrarSeccion('evento'); }
};

const DESTINOS_BOTON_MODAL_RESENADOR = {
  perfil: () => { if (typeof mostrarSeccion === 'function') mostrarSeccion('perfil'); },
  feed: () => { if (typeof mostrarSeccion === 'function') mostrarSeccion('feed'); },
  biblioteca: () => { if (typeof abrirMiBiblioteca === 'function') abrirMiBiblioteca(); },
  ranking: () => {
    if (typeof mostrarPanelRol === 'function') mostrarPanelRol();
    setTimeout(() => document.getElementById('tabbtn-ranking-resenador')?.click(), 50);
  },
  evento: () => { if (typeof mostrarSeccion === 'function') mostrarSeccion('evento'); }
};

function mostrarModalActualizaciones(modal) {
  const modalEl = document.getElementById('modal-actualizaciones');
  const overlay = document.getElementById('modal-overlay');
  const contenedor = document.getElementById('modal-actualizaciones-contenido');
  const btnEntendido = document.getElementById('btn-modal-actualizaciones-entendido');
  const btnAccion = document.getElementById('btn-modal-actualizaciones-accion');

  if (!modalEl || !overlay || !contenedor || !btnEntendido) return;

  contenedor.innerHTML = `
    ${modal.imagen_url ? `<img src="${modal.imagen_url}" alt="" style="max-width:100%; border-radius:12px; margin-bottom:16px; display:block;" />` : ''}
    <div>${_escaparHtmlModal(modal.texto).replace(/\n/g, '<br>')}</div>
  `;

  overlay.style.display = 'block';
  modalEl.style.display = 'block';
  document.body.style.overflow = 'hidden';

  // Botón de acción (opcional): navega según el rol del usuario y además marca el modal como visto.
  const usuario = Sesion.obtener();
  const rolADestino = { 'reseñador': modal.boton_destino_resenador, 'autor': modal.boton_destino_autor_editorial, 'editorial': modal.boton_destino_autor_editorial };
  const destino = usuario ? rolADestino[usuario.rol] : null;
  const mapaDestinos = usuario?.rol === 'reseñador' ? DESTINOS_BOTON_MODAL_RESENADOR : DESTINOS_BOTON_MODAL_AUTOR_EDITORIAL;

  if (btnAccion) {
    if (modal.boton_texto && destino && mapaDestinos[destino]) {
      btnAccion.textContent = modal.boton_texto;
      btnAccion.style.display = '';
      btnAccion.onclick = () => {
        registrarModalVisto(modal.id);
        mapaDestinos[destino]();
      };
    } else {
      btnAccion.style.display = 'none';
    }
  }

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

