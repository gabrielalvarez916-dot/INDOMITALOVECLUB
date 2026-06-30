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

function iniciarLoginGoogle() {
  if (typeof google === 'undefined' || !google.accounts) {
    _mostrarMensajeError('login-error', 'Error al cargar Google. Recargá la página.');
    _toggleElemento('login-error', true);
    return;
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

  const datosGoogle = decodificarJWT(token);
  if (!datosGoogle) {
    mostrarErrorLogin('Error al procesar los datos de Google.');
    return;
  }

  _tokenGooglePendiente = token;
  _emailGooglePendiente = datosGoogle.email;
  _nombreGooglePendiente = datosGoogle.given_name || datosGoogle.name?.split(' ')[0] || '';
  _apellidoGooglePendiente = datosGoogle.family_name || datosGoogle.name?.split(' ').slice(1).join(' ') || '';

  _toggleElemento('login-cargando', true);
  _toggleElemento('login-paso1', false);

const resultado = await llamarBackend('loginConGoogle', {
  email: _emailGooglePendiente,
  googleToken: token
});


  if (!resultado.ok) {
    mostrarErrorLogin(resultado.mensaje || 'Error al iniciar sesión.');
    return;
  }

  if (resultado.datos.esNuevo) {
    mostrarPasoEleccionRol();
  } else {
    completarLogin(resultado.datos.usuario);
  }
}

function mostrarPasoEleccionRol() {
  _toggleElemento('login-cargando', false);
  _toggleElemento('login-paso1', false);
  _toggleElemento('login-paso2', true);

  const inputNombre = document.getElementById('paso2-nombre');
  const inputApellido = document.getElementById('paso2-apellido');
  if (inputNombre) inputNombre.value = _nombreGooglePendiente || '';
  if (inputApellido) inputApellido.value = _apellidoGooglePendiente || '';
}

async function seleccionarRol(rol) {
  if (!_tokenGooglePendiente || !_emailGooglePendiente) {
    mostrarErrorLogin('Sesión expirada. Intentá ingresar nuevamente.');
    resetearLogin();
    return;
  }

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

  const resultado = await llamarBackend('registrarUsuario', {
    email: _emailGooglePendiente,
    nombre: nombre,
    apellido: apellido,
    rol: rol,
    googleToken: _tokenGooglePendiente
  });

  if (!resultado.ok) {
    mostrarErrorLogin(resultado.mensaje || 'Error al registrarse.');
    return;
  }

  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;
  _nombreGooglePendiente = null;
  _apellidoGooglePendiente = null;

  completarLogin(resultado.datos.usuario);
}

function completarLogin(usuario) {
  Sesion.guardar(usuario);
  mostrarHeaderLogueado(usuario);
  iniciarNotificaciones();
  verificarModalActualizacion();

  _tokenGooglePendiente = null;
  _emailGooglePendiente = null;

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

async function verificarSesionActiva() {
  const usuario = Sesion.obtener();
  if (!usuario) return;
  const resultado = await llamarBackend('verificarSesion', {
    email: usuario.email
  });
  if (!resultado.ok) {
    Sesion.cerrar();
    mostrarHeaderDeslogueado();
    mostrarSeccion('login');
    return;
  }
  Sesion.guardar(resultado.datos.usuario);
  mostrarHeaderLogueado(resultado.datos.usuario);
  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl && resultado.datos.usuario.fotoPerfil) {
    fotoEl.src = resultado.datos.usuario.fotoPerfil;
  }
}



// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

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
  if (!usuario || !usuario.email) return;

  const tipoActualizacion = 'actualizacion_junio_2026';

  const resultado = await llamarBackend('verificarModalVisto', {
    email: usuario.email,
    tipoActualizacion: tipoActualizacion
  });

  if (resultado.ok && resultado.datos.debeVerModal) {
    mostrarModalActualizaciones(tipoActualizacion);
  }
}

function mostrarModalActualizaciones(tipoActualizacion) {
  const modal = document.getElementById('modal-actualizaciones');
  const overlay = document.getElementById('modal-overlay');
  const contenedor = document.getElementById('modal-actualizaciones-contenido');
  const btnEntendido = document.getElementById('btn-modal-actualizaciones-entendido');

  if (!modal || !overlay || !contenedor || !btnEntendido) {
    return;
  }

 contenedor.innerHTML = `
<p>Estamos emocionad@s de compartirte todas las mejoras que integramos en estos últimos días. Acá está el resumen de lo nuevo:</p>

<p style="margin-top:16px;"><strong>📱 PERFILES PÚBLICOS DE RESEÑADOR Y AUTOR</strong></p>
<p>Ahora cada reseñador y aut@r tiene un perfil público que muestra su trayectoria, reseñas entregadas, calificaciones y redes sociales.</p>
<p>✓ Los puedes encontrar:
  <br>• Desde las tarjetas de campañas (clickeá en el aut@r)
  <br>• En el perfil de cualquier reseñador desde las reseñas</p>
<p>Mostrá tu trabajo y conectá con la comunidad 💜</p>

<p style="margin-top:16px;"><strong>📅 FECHAS LÍMITE: CLARIFICAMOS LA DIFERENCIA</strong></p>
<p><strong>PARA RESEÑADORES:</strong>
  <br>• Fecha de Postulación: hasta cuándo pueden postularse a la campaña
  <br>• Fecha de Entrega: 30 días desde que el aut@r aprueba tu postulación</p>
<p><strong>PARA AUTORES:</strong>
  <br>• Ven ambas fechas en el panel para cada reseñador aprobado
  <br>• La fecha de entrega es fija: 30 días desde la aprobación</p>

<p style="margin-top:16px;"><strong>🔗 COMPARTIR CAMPAÑA (Aut@res)</strong></p>
<p>Ahora cada campaña activa tiene un botón COMPARTIR para difundir tu campaña fácilmente en redes.</p>

<p style="margin-top:16px;"><strong>✏️ EDITAR CAMPAÑAS Y LIBROS (Aut@res)</strong></p>
<p>Mientras tu campaña está activa, podés actualizar los datos de tu libro sin perder postulaciones. Cuando la campaña venza, necesitarás crear una nueva.</p>

<p style="margin-top:16px;"><strong>🐛 BUGS CORREGIDOS</strong></p>
<p>✓ Portadas que no se mostraban correctamente<br>✓ Errores en la carga de reseñas<br>✓ Problemas en dispositivos móviles<br>✓ Mejoras de velocidad</p>

<p style="margin-top:16px; color:#888; font-size:13px;">¿Dudas? Respondé el mail o usá el botón de soporte 💬</p>
`;
  
  overlay.style.display = 'block';
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';

  btnEntendido.onclick = () => {
    registrarModalVisto(tipoActualizacion);
  };
}

async function registrarModalVisto(tipoActualizacion) {
  const usuario = Sesion.obtener();
  if (!usuario) return;

  const resultado = await llamarBackend('registrarModalVisto', {
    email: usuario.email,
    tipoActualizacion: tipoActualizacion
  });

  if (resultado.ok) {
    const modal = document.getElementById('modal-actualizaciones');
    const overlay = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
}

