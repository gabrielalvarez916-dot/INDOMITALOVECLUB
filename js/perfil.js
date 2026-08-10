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

  } else if (rol === 'editorial') {
    if (!_idEditorialPerfilActual) {
      const { data: idEdi, error: errId } = await supabaseClient.rpc('obtener_id_editorial_por_email', { p_email: Sesion.email() });
      if (errId || !idEdi || idEdi.error) {
        _estadoPerfilPublico('error', '-propio');
        return;
      }
      _idEditorialPerfilActual = idEdi.id;
    }
    await _cargarPerfilEditorial(_idEditorialPerfilActual, '-propio');
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
    idGenero: perfilRaw.id_genero,
    idSubgenero: perfilRaw.id_subgenero,
    sitioWeb: perfilRaw.sitio_web,
    fotoPerfil: perfilRaw.avatares?.imagen_url
  };

  rellenarFormularioPerfil(perfil);

  if (rol === 'reseñador') {
    const { data: tropesRows } = await supabaseClient
      .from('usuario_tropes')
      .select('tropes ( id, nombre, id_genero )')
      .eq('id_usuario', usuario.id);

    const tropesCatalogo = (tropesRows || []).map(row => row.tropes).filter(Boolean);

    const [{ data: generosRows }, { data: subgenerosRows }] = await Promise.all([
      supabaseClient.from('usuario_generos').select('id_genero').eq('id_usuario', usuario.id),
      supabaseClient.from('usuario_subgeneros').select('id_subgenero').eq('id_usuario', usuario.id)
    ]);

    await renderizarGenerosCheckboxPerfil(
      (generosRows || []).map(r => r.id_genero),
      (subgenerosRows || []).map(r => r.id_subgenero)
    );

    renderizarBuscadorTropesFavoritos(tropesCatalogo);
  }

  if (rol === 'autor' || rol === 'editorial') {
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
  const esEditorial = rol === 'editorial';
  toggleElemento('seccion-biblioteca',   esAutor || esEditorial);
  toggleElemento('grupo-generos',        esEditorial);
  toggleElemento('grupo-descripcion',    esReseñador || esEditorial);
  toggleElemento('grupo-tropes-perfil',  esReseñador);
  toggleElemento('grupo-generos-resenador', esReseñador);
  toggleElemento('grupo-sitio-web',      esEditorial);

  const labelGeneros = document.getElementById('label-generos');
  if (labelGeneros) labelGeneros.textContent = esEditorial ? 'Géneros que trabajamos' : 'Géneros favoritos';

 const labelDescripcion = document.getElementById('label-descripcion');
  if (labelDescripcion) labelDescripcion.textContent = esEditorial ? 'Presentación' : 'Descripción lectora';

  const campoDescripcion = document.getElementById('perfil-descripcion');
  if (campoDescripcion) {
    campoDescripcion.placeholder = esEditorial
      ? 'Contanos sobre tu editorial: qué publican, hace cuánto están, qué las distingue...'
      : 'Contanos quién sos como lect@r...';
  }

  const campoGeneros = document.getElementById('perfil-generos');
  if (campoGeneros) {
    campoGeneros.placeholder = esEditorial
      ? 'Romance, Dark Romance, Fantasía romántica...'
      : 'Romance, Dark Romance, Fantasía...';
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
  setVal('perfil-sitio-web',   perfil.sitioWeb);

  // Foto de perfil
  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl && perfil.fotoPerfil) {
    fotoEl.src = perfil.fotoPerfil;
  }
}


// ────────────────────────────────────────────────────────────
// GÉNEROS Y SUBGÉNEROS FAVORITOS (reseñador) — selección múltiple
// Reutiliza _cargarGeneros() / _cargarSubgeneros() de tropes.js.
// ────────────────────────────────────────────────────────────

let _generosSeleccionadosPerfil = [];
let _subgenerosSeleccionadosPerfil = [];
let _generosCatalogoCachePerfil = [];

async function renderizarGenerosCheckboxPerfil(idsGenerosIniciales = [], idsSubgenerosIniciales = []) {
  _generosSeleccionadosPerfil = [...idsGenerosIniciales];
  _subgenerosSeleccionadosPerfil = [...idsSubgenerosIniciales];
  _generosCatalogoCachePerfil = await _cargarGeneros();

  const contenedor = document.getElementById('perfil-generos-checkboxes');
  if (!contenedor) return;

  contenedor.innerHTML = _generosCatalogoCachePerfil.map(g => `
    <label class="tropes-checkbox-label">
      <input type="checkbox" value="${g.id}" data-tiene-subgenero="${g.tiene_subgenero}"
        ${_generosSeleccionadosPerfil.includes(g.id) ? 'checked' : ''}
        onchange="onToggleGeneroPerfil(this)" />
      ${g.nombre}
    </label>
  `).join('');

  await renderizarSubgenerosCheckboxPerfil();
}

async function onToggleGeneroPerfil(checkbox) {
  const idGenero = parseInt(checkbox.value, 10);
  if (checkbox.checked) {
    if (!_generosSeleccionadosPerfil.includes(idGenero)) _generosSeleccionadosPerfil.push(idGenero);
  } else {
    _generosSeleccionadosPerfil = _generosSeleccionadosPerfil.filter(id => id !== idGenero);
    const subs = await _cargarSubgeneros(idGenero);
    const idsSubsDeEsteGenero = subs.map(s => s.id);
    _subgenerosSeleccionadosPerfil = _subgenerosSeleccionadosPerfil.filter(id => !idsSubsDeEsteGenero.includes(id));
    // al destildar un género, se descartan los tropes favoritos que pertenecían a ese género
    _tropesFavoritosPerfil = _tropesFavoritosPerfil.filter(t => t.id_genero !== idGenero);
    renderizarChipsTropesFavoritos();
  }
  await renderizarSubgenerosCheckboxPerfil();
}

async function renderizarSubgenerosCheckboxPerfil() {
  const contenedor = document.getElementById('perfil-subgeneros-contenedor');
  if (!contenedor) return;

  const generosConSubgenero = _generosCatalogoCachePerfil
    .filter(g => g.tiene_subgenero && _generosSeleccionadosPerfil.includes(g.id));

  if (generosConSubgenero.length === 0) {
    contenedor.innerHTML = '';
    return;
  }

  const bloques = await Promise.all(generosConSubgenero.map(async genero => {
    const subs = await _cargarSubgeneros(genero.id);
    return `
      <div class="form-grupo" style="margin-top:10px;">
        <label class="form-label" style="font-size:12px;">Subgéneros de ${genero.nombre}</label>
        <div class="tropes-checkboxes">
          ${subs.map(s => `
            <label class="tropes-checkbox-label">
              <input type="checkbox" value="${s.id}"
                ${_subgenerosSeleccionadosPerfil.includes(s.id) ? 'checked' : ''}
                onchange="onToggleSubgeneroPerfil(this)" />
              ${s.nombre}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }));

  contenedor.innerHTML = bloques.join('');
}

function onToggleSubgeneroPerfil(checkbox) {
  const idSubgenero = parseInt(checkbox.value, 10);
  if (checkbox.checked) {
    if (!_subgenerosSeleccionadosPerfil.includes(idSubgenero)) _subgenerosSeleccionadosPerfil.push(idSubgenero);
  } else {
    _subgenerosSeleccionadosPerfil = _subgenerosSeleccionadosPerfil.filter(id => id !== idSubgenero);
  }
}

function obtenerSeleccionGenerosPerfil() {
  return {
    idsGeneros: [..._generosSeleccionadosPerfil],
    idsSubgeneros: [..._subgenerosSeleccionadosPerfil]
  };
}


// ────────────────────────────────────────────────────────────
// TROPES FAVORITOS (reseñador) — buscador sin desplegable de género,
// busca en todos los géneros ya tildados arriba.
// ────────────────────────────────────────────────────────────

let _tropesFavoritosPerfil = []; // [{id, nombre, id_genero}]
let _debounceBusquedaTropesFavoritos;

function renderizarBuscadorTropesFavoritos(tropesIniciales = []) {
  _tropesFavoritosPerfil = [...tropesIniciales];
  const contenedor = document.getElementById('perfil-tropes-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="tropes-buscador-wrapper">
      <input
        type="text"
        id="perfil-buscador-tropes-favoritos"
        class="form-input"
        placeholder="Buscá un trope..."
        autocomplete="off"
        oninput="onBuscarTropesFavoritos()"
        onfocus="onBuscarTropesFavoritos()"
      />
      <div class="tropes-dropdown" id="perfil-dropdown-tropes-favoritos" style="display:none;"></div>
    </div>
    <div class="tropes-seleccionados-preview" id="perfil-tropes-favoritos-preview"></div>
  `;
  renderizarChipsTropesFavoritos();
}

async function onBuscarTropesFavoritos() {
  clearTimeout(_debounceBusquedaTropesFavoritos);
  _debounceBusquedaTropesFavoritos = setTimeout(async () => {
    const input = document.getElementById('perfil-buscador-tropes-favoritos');
    const dropdown = document.getElementById('perfil-dropdown-tropes-favoritos');
    if (!input || !dropdown) return;

    if (_generosSeleccionadosPerfil.length === 0) {
      dropdown.innerHTML = `<div class="tropes-dropdown-vacio">Elegí al menos un género favorito para buscar tropes.</div>`;
      dropdown.style.display = 'block';
      return;
    }

    const resultados = await _buscarTropesPorGeneros(_generosSeleccionadosPerfil, input.value);
    const idsYaSeleccionados = _tropesFavoritosPerfil.map(t => t.id);
    const disponibles = resultados.filter(t => !idsYaSeleccionados.includes(t.id));

    dropdown.innerHTML = disponibles.length === 0
      ? `<div class="tropes-dropdown-vacio">Sin resultados</div>`
      : disponibles.map(t => `
          <div class="tropes-dropdown-item" onclick="seleccionarTropeFavorito(${t.id}, '${t.nombre.replace(/'/g, "\\'")}', ${t.id_genero})">
            ${t.nombre}
          </div>
        `).join('');
    dropdown.style.display = 'block';
  }, 250);
}

function seleccionarTropeFavorito(id, nombre, idGenero) {
  if (!_tropesFavoritosPerfil.some(t => t.id === id)) {
    _tropesFavoritosPerfil.push({ id, nombre, id_genero: idGenero });
  }
  document.getElementById('perfil-buscador-tropes-favoritos').value = '';
  document.getElementById('perfil-dropdown-tropes-favoritos').style.display = 'none';
  renderizarChipsTropesFavoritos();
}

function quitarTropeFavorito(id) {
  _tropesFavoritosPerfil = _tropesFavoritosPerfil.filter(t => t.id !== id);
  renderizarChipsTropesFavoritos();
}

function renderizarChipsTropesFavoritos() {
  const preview = document.getElementById('perfil-tropes-favoritos-preview');
  if (!preview) return;

  if (_tropesFavoritosPerfil.length === 0) {
    preview.innerHTML = `<p class="tropes-preview-vacio">Ningún trope seleccionado todavía.</p>`;
    return;
  }

  preview.innerHTML = `
    <p class="tropes-preview-label">Seleccionados:</p>
    <div class="tropes-tags">
      ${_tropesFavoritosPerfil.map(t => `
        <span class="tropes-tag">
          ${t.nombre}
          <button type="button" class="tropes-tag-quitar" onclick="quitarTropeFavorito(${t.id})">×</button>
        </span>
      `).join('')}
    </div>
  `;
}

function obtenerTropesFavoritosPerfil() {
  return _tropesFavoritosPerfil.map(t => t.id);
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

 let idsTropesFavoritosPerfil = null;
  let seleccionGenerosPerfil = null;
  if (rol === 'reseñador') {
    datos.generos           = document.getElementById('perfil-generos')?.value?.trim();
    datos.descripcionLector = document.getElementById('perfil-descripcion')?.value?.trim();
    idsTropesFavoritosPerfil = obtenerTropesFavoritosPerfil();
    seleccionGenerosPerfil   = obtenerSeleccionGenerosPerfil();
  }
  
  if (rol === 'editorial') {
    datos.generos           = document.getElementById('perfil-generos')?.value?.trim();
    datos.descripcionLector = document.getElementById('perfil-descripcion')?.value?.trim();
    datos.sitioWeb          = document.getElementById('perfil-sitio-web')?.value?.trim();
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
      sitio_web: datos.sitioWeb
    })
    .eq('id', usuario.id);

  if (error) {
    mostrarMensajeError('perfil-error', error.message || 'Error al guardar el perfil.');
    return;
  }

  if (rol === 'reseñador' && idsTropesFavoritosPerfil) {
    await supabaseClient.from('usuario_tropes').delete().eq('id_usuario', usuario.id);

    if (idsTropesFavoritosPerfil.length > 0) {
      const { error: errorTropesPerfil } = await supabaseClient
        .from('usuario_tropes')
        .insert(idsTropesFavoritosPerfil.map(idTrope => ({
          id_usuario: usuario.id,
          id_trope: idTrope
        })));

      if (errorTropesPerfil) {
        console.error('Error guardando tropes del perfil:', errorTropesPerfil);
      }
    }
  }

  if (rol === 'reseñador' && seleccionGenerosPerfil) {
    await supabaseClient.from('usuario_generos').delete().eq('id_usuario', usuario.id);
    await supabaseClient.from('usuario_subgeneros').delete().eq('id_usuario', usuario.id);

    if (seleccionGenerosPerfil.idsGeneros.length > 0) {
      const { error: errorGenerosPerfil } = await supabaseClient
        .from('usuario_generos')
        .insert(seleccionGenerosPerfil.idsGeneros.map(idGenero => ({
          id_usuario: usuario.id,
          id_genero: idGenero
        })));
      if (errorGenerosPerfil) console.error('Error guardando géneros del perfil:', errorGenerosPerfil);
    }

    if (seleccionGenerosPerfil.idsSubgeneros.length > 0) {
      const { error: errorSubgenerosPerfil } = await supabaseClient
        .from('usuario_subgeneros')
        .insert(seleccionGenerosPerfil.idsSubgeneros.map(idSubgenero => ({
          id_usuario: usuario.id,
          id_subgenero: idSubgenero
        })));
      if (errorSubgenerosPerfil) console.error('Error guardando subgéneros del perfil:', errorSubgenerosPerfil);
    }
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
  mostrarToast('Nuevo look desbloqueado. Te queda bien. 👀', 'ok');

  if (typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('cambiar_avatar');
  }

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
  mostrarToast('😈 Perfil completo y primera postulación enviada. Ahora cruzá los dedos, criatura.', 'ok');

  if (typeof cargarFeed === 'function') cargarFeed();
}
