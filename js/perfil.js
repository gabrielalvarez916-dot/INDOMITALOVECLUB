// ============================================================
// perfil.js — Indómita Love Club
// Carga, muestra y guarda el perfil del usuario logueado.
// Maneja campos según rol: autores ven biblioteca, reseñadores ven descripción lectora.
// ============================================================


// ────────────────────────────────────────────────────────────
// CARGAR PERFIL
// ────────────────────────────────────────────────────────────

/**
 * Carga el perfil del usuario logueado y rellena el formulario.
 * Se llama automáticamente desde ui.js cuando se muestra la sección 'perfil'.
 * Muestra u oculta campos según el rol del usuario.
 */
async function cargarPerfil() {
  const email = Sesion.email();
  const rol   = Sesion.rol();
  if (!email) return;

  ocultarMensajes('perfil-error', 'perfil-ok');

  // Ajusta el formulario según el rol ANTES de cargar datos
  ajustarFormularioPorRol(rol);

  const resultado = await llamarBackend('obtenerPerfil', { email });

  if (!resultado.ok) {
    mostrarMensajeError('perfil-error', resultado.mensaje || 'Error al cargar el perfil.');
    return;
  }

  const perfil = resultado.datos.perfil;
  rellenarFormularioPerfil(perfil);

  // Si es reseñador, carga los tropes guardados
  // FIX: esto estaba suelto fuera de la función, lo movemos aquí
  if (rol === 'reseñador' && perfil.tropesFavoritos) {
    const tropesArray = tropesTextoAArray(perfil.tropesFavoritos);
    renderizarSelectorTropes('perfil-tropes-contenedor', 'perfil', tropesArray);
  }

  // Si es autor, carga también la biblioteca
  if (rol === 'autor') {
    toggleElemento('seccion-biblioteca', true);
    await cargarBibliotecaPanel(email);
  } else {
    toggleElemento('seccion-biblioteca', false);
  }
}


// ────────────────────────────────────────────────────────────
// AJUSTAR FORMULARIO SEGÚN ROL
// ────────────────────────────────────────────────────────────

/**
 * Muestra u oculta campos del formulario según el rol del usuario.
 *
 * Autores:
 *   - NO ven descripción lectora ni géneros favoritos (son campos de reseñadores)
 *   - SÍ ven la sección biblioteca
 *
 * Reseñadores:
 *   - SÍ ven descripción lectora y géneros favoritos
 *   - NO ven la sección biblioteca
 *
 * @param {string} rol — 'autor' | 'reseñador' | 'admin'
 */
function ajustarFormularioPorRol(rol) {
  const esAutor     = rol === 'autor';
  const esReseñador = rol === 'reseñador';
  toggleElemento('seccion-biblioteca',   esAutor);
  toggleElemento('grupo-generos',        esReseñador);
  toggleElemento('grupo-descripcion',    esReseñador);
  toggleElemento('grupo-tropes-perfil',  esReseñador);
  if (esReseñador) {
    renderizarSelectorTropes('perfil-tropes-contenedor', 'perfil', []);
  }
  }



// ────────────────────────────────────────────────────────────
// RELLENAR FORMULARIO
// ────────────────────────────────────────────────────────────

/**
 * Rellena los campos del formulario con los datos del perfil.
 *
 * @param {Object} perfil — datos del perfil del backend
 */
function rellenarFormularioPerfil(perfil) {
  const setVal = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.value = valor || '';
  };

  setVal('perfil-alias',       perfil.alias);
  setVal('perfil-pais',        perfil.pais);
  setVal('perfil-ciudad',      perfil.ciudad);
  setVal('perfil-generos',     perfil.generos);
  setVal('perfil-descripcion', perfil.descripcionLector);
  setVal('perfil-instagram',   perfil.instagram);
  setVal('perfil-tiktok',      perfil.tiktok);
  setVal('perfil-amazon',      perfil.amazon);

  // Foto de perfil
  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl && perfil.fotoPerfil) {
    fotoEl.src = perfil.fotoPerfil;
  }
}


// ────────────────────────────────────────────────────────────
// GUARDAR PERFIL
// ────────────────────────────────────────────────────────────

/**
 * Guarda los cambios del perfil en el backend.
 * Se llama desde el submit del form-perfil.
 *
 * @param {Event} event
 */
async function guardarPerfil(event) {
  event.preventDefault();
  ocultarMensajes('perfil-error', 'perfil-ok');

  const email = Sesion.email();
  const rol   = Sesion.rol();

  const datos = {
    alias:    document.getElementById('perfil-alias')?.value?.trim(),
    pais:     document.getElementById('perfil-pais')?.value?.trim(),
    ciudad:   document.getElementById('perfil-ciudad')?.value?.trim(),
    instagram: document.getElementById('perfil-instagram')?.value?.trim(),
    tiktok:   document.getElementById('perfil-tiktok')?.value?.trim(),
    amazon:   document.getElementById('perfil-amazon')?.value?.trim(),
  };

  // Campos solo de reseñadores
  if (rol === 'reseñador') {
    datos.generos           = document.getElementById('perfil-generos')?.value?.trim();
    datos.descripcionLector = document.getElementById('perfil-descripcion')?.value?.trim();
    // FIX: una sola llamada al backend, tropesFavoritos va junto con editarPerfil
    datos.tropesFavoritos   = obtenerTropesComoTexto('perfil');
  }

  if (!datos.alias) {
    mostrarMensajeError('perfil-error', 'El alias es obligatorio.');
    return;
  }

  const resultado = await llamarBackend('editarPerfil', {
    email,
    alias:             datos.alias,
    pais:              datos.pais,
    ciudad:            datos.ciudad,
    instagram:         datos.instagram,
    tiktok:            datos.tiktok,
    amazon:            datos.amazon,
    generos:           datos.generos,
    descripcionLector: datos.descripcionLector,
    tropesFavoritos:   datos.tropesFavoritos
  });

  if (!resultado.ok) {
    mostrarMensajeError('perfil-error', resultado.mensaje || 'Error al guardar el perfil.');
    return;
  }

  // Actualiza sesión
  const sesionActual = Sesion.obtener();
  if (sesionActual) {
    Sesion.guardar({
      ...sesionActual,
      alias:             datos.alias,
      pais:              datos.pais,
      ciudad:            datos.ciudad,
      instagram:         datos.instagram,
      tiktok:            datos.tiktok,
      amazon:            datos.amazon,
      generos:           datos.generos,
      descripcionLector: datos.descripcionLector,
    });
    const aliasEl = document.getElementById('usuario-alias');
    if (aliasEl) aliasEl.textContent = datos.alias;
  }

  mostrarMensajeOk('perfil-ok', '¡Perfil guardado correctamente!');
  setTimeout(() => ocultarMensajes('perfil-ok'), 3000);
} // FIX: cierre correcto de guardarPerfil


// ────────────────────────────────────────────────────────────
// SELECTOR DE AVATAR
// ────────────────────────────────────────────────────────────

const AVATARES = [
  '14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK',
  '1hbw_3J9q_9nppXZGkfPMXifjHMKzAfYI',
  '1vqTplcfpDAtbGqgWLdunsuIHDqyu7BUn',
  '1qEPNQOsz7dYS4zD8pYPIhaD54IkGjsYj',
  '1aN9v7S8W5Zu8gJfPcyzBLv63VMb8cOJ8',
  '1ncv_MR_W0wQX9cMW4T38t2KMcmMrpfPJ',
  '1qwH_XLzW0Pa1GR4q4Xk5KMv1R_slyRHe',
  '1ZR5EtoXqvKpPGsoHIHaB0ijV3StihvLD',
  '1xjLbwGrTsunvPqStKcSDpRhwYChEG-2r',
  '1hWQ8zLiXY5CcbbcS1H1PIDXEA7eZBP2D',
  '1fofj8nvmZ5b0DeX1Bu6tE0JcvMwBaDnG',
  '1rFm0xSGcDnumNHdPra8b5Qjs-Ips1Yv7',
  '1pbSw-V95tbq1xKuqzjWMuhQJIEVktlTY',
  '1FuWwmI-Ipxsg7TeJwCdgL4X04GJhgRTf',
  '18LMYQLqppH3j4f2B5EcJCC5meKHygB5-',
  '1ptD4HGSSZ_JJQv2PYwYnNbK1OItF15Lv',
  '17tIY8MWZvNy391tJLj9qWHSA3y0bDdoX',
  '1ETXG8zsbyGCBKb5eQRhrDVIL-N4al7-D',
  '1vebFQcAKaCrR64NO8jMvZM_VsbPRm--x',
  '1_3u_Ep3_26gM-xQMHwuQoXym-yL7_gkW',
  '1XTnl4Y0YK4WBYC2-Ud7Yu5GUkEvRgK3u',
  '18WZPoUzsYpecOzKtyInYiDeWMcdmOSAb',
  '1fkcDOxLq8D5X4YqT5WWsEajO-TZlToYH',
  '19MPn3LFIS-mdJwv3Xgy6F4601U2Phfkz',
  '16ynVYeweir3LeRP_4Wm5q_03T0T7Zm-9',
  '1LPPEg1dFBEZSeK0oO2wR8UdlRmls-Fj7',
  '1c3n6ILGsXNpoIO9mi_Wkij5I8y1V-BhP',
  '1UeFp2kzn9ZQxU7bWx3HhvC3e4sfherU0',
  '1lbI5Qi4B1LOggnP-5kRS5Rr6qq3UxSji',
  '1jJhXD8dMo7VvKkL9sh_6zo4_Zx42pmt8',
  '1Cez9bj5QCzZcYtL7pQZsDyWaBB9Kd0s4',
  '1Hu-CsIfOvsxNsI3HjG6N91PtVichRn9f',
  '1zeAkLLiq3rVvvTUKJO_iCB3XvJ6TLmvg',
  '1_XHh03PT2KvUtMI-s02CM1sSj4SAT5jB',
  '1OKRSRq8MoN5dyGdVYxyl5_KTuDy4FgQD'
].map(id => `/api/drive?id=${id}`);

let _avatarSeleccionado = null;

/**
 * Abre el modal de selección de avatar y renderiza el grid.
 */
function abrirSelectorAvatar() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;

  const fotoActual = document.getElementById('perfil-foto')?.src || '';
  grid.innerHTML = '';
  _avatarSeleccionado = null;

  AVATARES.forEach((url, i) => {
    const img = document.createElement('img');
    img.src       = url;
    img.alt       = `Avatar ${i + 1}`;
    img.className = 'avatar-opcion' + (fotoActual.includes(url) ? ' seleccionado' : '');
    img.dataset.url = url;

    img.onclick = () => {
      document.querySelectorAll('.avatar-opcion').forEach(el => el.classList.remove('seleccionado'));
      img.classList.add('seleccionado');
      _avatarSeleccionado = url;
    };

    grid.appendChild(img);
  });

  mostrarModal('modal-selector-avatar');
}

/**
 * Guarda el avatar elegido en el backend y actualiza la UI.
 */
async function guardarAvatar() {
  ocultarMensajes('avatar-error');

  if (!_avatarSeleccionado) {
    mostrarMensajeError('avatar-error', 'Seleccioná un avatar antes de guardar.');
    return;
  }

  const email = Sesion.email();

  const resultado = await llamarBackend('editarPerfil', {
    email,
    fotoPerfil: _avatarSeleccionado,
    soloFoto: true
  });

  if (!resultado.ok) {
    mostrarMensajeError('avatar-error', resultado.mensaje || 'Error al guardar el avatar.');
    return;
  }

  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl) fotoEl.src = _avatarSeleccionado;

  const sesionActual = Sesion.obtener();
  Sesion.guardar({ ...sesionActual, fotoPerfil: _avatarSeleccionado });

  cerrarModales();
  mostrarToast('¡Avatar actualizado!', 'ok');
  _avatarSeleccionado = null;
}


// ────────────────────────────────────────────────────────────
// GUARDAR PERFIL Y POSTULARSE (primera vez)
// ────────────────────────────────────────────────────────────

/**
 * Guarda el perfil del reseñador y luego lo postula a una campaña.
 * Se usa cuando se postula por primera vez y le falta completar datos.
 * Se llama desde el submit del modal-completar-perfil.
 *
 * @param {Event} event
 */
async function guardarPerfilYPostularse(event) {
  event.preventDefault();
  ocultarMensajes('completar-error');

  const email     = Sesion.email();
  const idCampana = document.getElementById('completar-id-campana')?.value;

  const datos = {
    pais:              document.getElementById('completar-pais')?.value?.trim(),
    ciudad:            document.getElementById('completar-ciudad')?.value?.trim(),
    instagram:         document.getElementById('completar-instagram')?.value?.trim(),
    tiktok:            document.getElementById('completar-tiktok')?.value?.trim(),
    amazon:            document.getElementById('completar-amazon')?.value?.trim(),
    descripcionLector: document.getElementById('completar-descripcion')?.value?.trim(),
    generos:           document.getElementById('completar-generos')?.value?.trim(),
  };

  if (!datos.pais || !datos.ciudad) {
    mostrarMensajeError('completar-error', 'País y ciudad son obligatorios.');
    return;
  }

  // Primero guarda el perfil
  const resultadoPerfil = await llamarBackend('editarPerfil', {
  email,
  pais:              datos.pais,
  ciudad:            datos.ciudad,
  instagram:         datos.instagram,
  tiktok:            datos.tiktok,
  amazon:            datos.amazon,
  descripcionLector: datos.descripcionLector,
  generos:           datos.generos,
});

  if (!resultadoPerfil.ok) {
    mostrarMensajeError('completar-error', resultadoPerfil.mensaje || 'Error al guardar el perfil.');
    return;
  }

  // Actualiza sesión
  const usuarioActual = Sesion.obtener();
  Sesion.guardar({ ...usuarioActual, ...datos });

  // Luego se postula
 const resultadoPostulacion = await llamarBackend('postularse', {
    email,
    idCampana,
    aceptaConfidencialidad: true
  });

  if (!resultadoPostulacion.ok) {
    mostrarMensajeError('completar-error', resultadoPostulacion.mensaje || 'Error al postularse.');
    return;
  }

  cerrarModales();
  mostrarToast('¡Perfil completado y postulación enviada!', 'ok');

  // Recarga el feed para reflejar el cambio
  if (typeof cargarFeed === 'function') cargarFeed();
}
