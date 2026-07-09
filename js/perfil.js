// ============================================================
// perfil.js — Indómita Love Club
// Carga, muestra y guarda el perfil del usuario logueado.
// Maneja campos según rol: autores ven biblioteca, reseñadores ven descripción lectora.
// ============================================================


// ────────────────────────────────────────────────────────────
// CARGAR PERFIL (vista fija embebida en la pestaña "Perfil")
// ────────────────────────────────────────────────────────────

/**
 * Carga el perfil PÚBLICO propio y lo pinta embebido en la pestaña "Perfil"
 * (mismo diseño que el modal de perfil público, con sufijo '-propio').
 * Se llama automáticamente desde ui.js cuando se muestra la sección 'perfil'.
 * También se vuelve a llamar después de guardar cambios en el modal de edición.
 */
async function cargarPerfil() {
  const usuario = Sesion.obtener();
  const rol     = Sesion.rol();
  if (!usuario) return;

  if (rol === 'autor') {
    if (!_idAutorPerfilActual) {
      const { data: idAut, error: errId } = await supabaseClient.rpc('obtener_id_autor_por_email', { p_email: Sesion.email() });
      if (errId || !idAut || idAut.error) {
        _estadoPerfilPublico('error', '-propio');
        return;
      }
      _idAutorPerfilActual = idAut.id;
    }
    await _cargarPerfilAutor(_idAutorPerfilActual, '-propio');

  } else if (rol === 'reseñador') {
    if (!_idReseñadorPerfilActual) {
      const { data: idRes, error: errId } = await supabaseClient.rpc('obtener_id_resenador_por_email', { p_email: Sesion.email() });
      if (errId || !idRes || idRes.error) {
        _estadoPerfilPublico('error', '-propio');
        return;
      }
      _idReseñadorPerfilActual = idRes.id;
      _bibliotecaEsPropia = true;
    }
    await _cargarPerfilReseñador(_idReseñadorPerfilActual, '-propio');
  }
}


// ────────────────────────────────────────────────────────────
// CARGAR FORMULARIO DE EDICIÓN (modal "Editar perfil")
// ────────────────────────────────────────────────────────────

/**
 * Carga los datos del usuario logueado y rellena el formulario de EDICIÓN
 * (el que vive ahora en #modal-editar-perfil). Se llama al abrir ese modal
 * desde el botón "✏️ Editar perfil".
 * Muestra u oculta campos del form según el rol del usuario.
 */
async function cargarFormularioEdicionPerfil() {
  const usuario = Sesion.obtener();
  const rol     = Sesion.rol();
  if (!usuario) return;

  ocultarMensajes('perfil-error', 'perfil-ok');

  ajustarFormularioPorRol(rol);

  const { data: perfilRaw, error } = await supabaseClient
    .from('usuarios')
    .select('*, avatares(imagen_url)')
    .eq('id', usuario.id)
    .single();

  if (error || !perfilRaw) {
    mostrarMensajeError('perfil-error', error?.message || 'Error al cargar el perfil.');
    return;
  }

  const perfil = {
    alias: perfilRaw.alias,
    pais: perfilRaw.pais,
    ciudad: perfilRaw.ciudad,
    generos: perfilRaw.generos,
    descripcionLector: perfilRaw.descripcion_lector,
    instagram: perfilRaw.instagram,
    tiktok: perfilRaw.tiktok,
    amazon: perfilRaw.amazon,
    tropesFavoritos: perfilRaw.tropes_favoritos,
    fotoPerfil: perfilRaw.avatares?.imagen_url
  };

  rellenarFormularioPerfil(perfil);

  if (rol === 'reseñador' && perfil.tropesFavoritos) {
    const tropesArray = tropesTextoAArray(perfil.tropesFavoritos);
    renderizarSelectorTropes('perfil-tropes-contenedor', 'perfil', tropesArray);
  }

  if (rol === 'autor') {
    toggleElemento('seccion-biblioteca', true);
    await cargarBibliotecaPanel(usuario.id);
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
 * Se llama desde el submit del form-perfil (ahora dentro de #modal-editar-perfil).
 * Al guardar con éxito: cierra el modal de edición y repinta la vista fija
 * de la pestaña "Perfil" con los datos actualizados, sin recargar nada.
 *
 * @param {Event} event
 */
async function guardarPerfil(event) {
  event.preventDefault();
  ocultarMensajes('perfil-error', 'perfil-ok');

  const usuario = Sesion.obtener();
  const rol     = Sesion.rol();

  const datos = {
    alias:    document.getElementById('perfil-alias')?.value?.trim(),
    pais:     document.getElementById('perfil-pais')?.value?.trim(),
    ciudad:   document.getElementById('perfil-ciudad')?.value?.trim(),
    instagram: document.getElementById('perfil-instagram')?.value?.trim(),
    tiktok:   document.getElementById('perfil-tiktok')?.value?.trim(),
    amazon:   document.getElementById('perfil-amazon')?.value?.trim(),
  };

  if (rol === 'reseñador') {
    datos.generos           = document.getElementById('perfil-generos')?.value?.trim();
    datos.descripcionLector = document.getElementById('perfil-descripcion')?.value?.trim();
    datos.tropesFavoritos   = obtenerTropesComoTexto('perfil');
  }

  if (!datos.alias) {
    mostrarMensajeError('perfil-error', 'El alias es obligatorio.');
    return;
  }

  const { error } = await supabaseClient
    .from('usuarios')
    .update({
      alias: datos.alias,
      pais: datos.pais,
      ciudad: datos.ciudad,
      instagram: datos.instagram,
      tiktok: datos.tiktok,
      amazon: datos.amazon,
      generos: datos.generos,
      descripcion_lector: datos.descripcionLector,
      tropes_favoritos: datos.tropesFavoritos
    })
    .eq('id', usuario.id);

  if (error) {
    mostrarMensajeError('perfil-error', error.message || 'Error al guardar el perfil.');
    return;
  }

  Sesion.guardar({ ...usuario, ...datos });
  const aliasEl = document.getElementById('usuario-alias');
  if (aliasEl) aliasEl.textContent = datos.alias;

  mostrarMensajeOk('perfil-ok', '¡Perfil guardado correctamente!');

  // Cierra el modal de edición y repinta la vista fija de la pestaña "Perfil"
  // con los datos ya actualizados, sin pantallas en blanco ni recargar nada.
  setTimeout(() => {
    cerrarModales();
    ocultarMensajes('perfil-ok');
    cargarPerfil();
  }, 900);
}


// ────────────────────────────────────────────────────────────
// SELECTOR DE AVATAR
// ────────────────────────────────────────────────────────────

let _avataresDisponibles = [];
let _avatarSeleccionado = null; // ahora guarda el ID numérico del avatar, no una URL

async function cargarAvatares() {
  if (_avataresDisponibles.length > 0) return _avataresDisponibles; // ya cacheado

  const { data, error } = await supabaseClient
    .from('avatares')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando avatares:', error);
    return [];
  }

  _avataresDisponibles = data || [];
  return _avataresDisponibles;
}

/**
 * Abre el modal de selección de avatar y renderiza el grid.
 */
async function abrirSelectorAvatar() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;

  const avatares = await cargarAvatares();
  const fotoActualUrl = document.getElementById('perfil-foto')?.src || '';
  grid.innerHTML = '';
  _avatarSeleccionado = null;

  avatares.forEach((avatar) => {
    const img = document.createElement('img');
    img.src       = avatar.imagen_url;
    img.alt       = `Avatar ${avatar.id}`;
    img.className = 'avatar-opcion' + (fotoActualUrl === avatar.imagen_url ? ' seleccionado' : '');
    img.dataset.id = avatar.id;

    img.onclick = () => {
      document.querySelectorAll('.avatar-opcion').forEach(el => el.classList.remove('seleccionado'));
      img.classList.add('seleccionado');
      _avatarSeleccionado = avatar.id;
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

  const usuario = Sesion.obtener();

  const { error } = await supabaseClient
    .from('usuarios')
    .update({ avatar_id: _avatarSeleccionado })
    .eq('id', usuario.id);

  if (error) {
    mostrarMensajeError('avatar-error', error.message || 'Error al guardar el avatar.');
    return;
  }

  const avatarElegido = _avataresDisponibles.find(a => a.id === _avatarSeleccionado);
  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl && avatarElegido) fotoEl.src = avatarElegido.imagen_url;

  Sesion.guardar({ ...usuario, fotoPerfil: avatarElegido?.imagen_url });

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

  const usuario   = Sesion.obtener();
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

  const { error: errorPerfil } = await supabaseClient
    .from('usuarios')
    .update({
      pais: datos.pais,
      ciudad: datos.ciudad,
      instagram: datos.instagram,
      tiktok: datos.tiktok,
      amazon: datos.amazon,
      descripcion_lector: datos.descripcionLector,
      generos: datos.generos
    })
    .eq('id', usuario.id);

  if (errorPerfil) {
    mostrarMensajeError('completar-error', errorPerfil.message || 'Error al guardar el perfil.');
    return;
  }

  Sesion.guardar({ ...usuario, ...datos });

  const { error: errorPostulacion } = await supabaseClient
    .from('postulaciones')
    .insert({
      id_campana: idCampana,
      id_usuario_resenador: usuario.id,
      acepta_confidencialidad: true
    });

  if (errorPostulacion) {
    mostrarMensajeError('completar-error', errorPostulacion.message || 'Error al postularse.');
    return;
  }

  cerrarModales();
  mostrarToast('¡Perfil completado y postulación enviada!', 'ok');

  if (typeof cargarFeed === 'function') cargarFeed();
}
