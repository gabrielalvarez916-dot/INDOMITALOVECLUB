// ============================================================
// tropes.js — Indómita Love Club
// Componente reutilizable de selección de tropes.
// Se usa en: modal-nuevo-libro y modal-nueva-campana.
// ============================================================

// ============================================================
// ESTADO EN MEMORIA (por prefijo, para poder tener libro y campaña abiertos a la vez)
// ============================================================
const _tropesEstado = {}; // { [prefijo]: { idGenero, idSubgenero, tropesDisponibles: [], seleccionados: [] } }

function _estado(prefijo) {
  if (!_tropesEstado[prefijo]) {
    _tropesEstado[prefijo] = { idGenero: null, idSubgenero: null, tropesDisponibles: [], seleccionados: [] };
  }
  return _tropesEstado[prefijo];
}

async function _cargarGeneros() {
  const { data, error } = await supabaseClient
    .from('generos')
    .select('id, nombre, tiene_subgenero')
    .eq('activo', true)
    .order('orden');
  if (error) { console.error('Error cargando generos:', error); return []; }
  return data;
}

async function _cargarSubgeneros(idGenero) {
  const { data, error } = await supabaseClient
    .from('subgeneros')
    .select('id, nombre')
    .eq('id_genero', idGenero)
    .eq('activo', true)
    .order('orden');
  if (error) { console.error('Error cargando subgeneros:', error); return []; }
  return data;
}

async function _buscarTropes(idGenero, textoBusqueda) {
  let query = supabaseClient
    .from('tropes')
    .select('id, nombre')
    .eq('id_genero', idGenero)
    .eq('activo', true);

  if (textoBusqueda && textoBusqueda.trim()) {
    query = query.ilike('nombre', `%${textoBusqueda.trim()}%`);
  }

  const { data, error } = await query.order('orden').limit(20);
  if (error) { console.error('Error buscando tropes:', error); return []; }
  return data;
}

/**
 * Busca tropes en varios géneros a la vez (usado en el perfil del reseñador,
 * donde puede tener más de un género favorito).
 */
async function _buscarTropesPorGeneros(idsGenero, textoBusqueda) {
  if (!idsGenero || idsGenero.length === 0) return [];

  let query = supabaseClient
    .from('tropes')
    .select('id, nombre, id_genero')
    .in('id_genero', idsGenero)
    .eq('activo', true);

  if (textoBusqueda && textoBusqueda.trim()) {
    query = query.ilike('nombre', `%${textoBusqueda.trim()}%`);
  }

  const { data, error } = await query.order('orden').limit(20);
  if (error) { console.error('Error buscando tropes:', error); return []; }
  return data;
}


// ────────────────────────────────────────────────────────────
// RENDERIZAR SELECTOR DE TROPES
// ────────────────────────────────────────────────────────────

/**
 * Renderiza el flujo nuevo: género → subgénero (si aplica) → buscador de tropes.
 *
 * @param {string} contenedorId
 * @param {string} prefijo
 * @param {object} valoresIniciales — { id_genero, id_subgenero, tropes: [{id, nombre}] } (para edición)
 */
async function renderizarSelectorTropes(contenedorId, prefijo, valoresIniciales = {}) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  const estado = _estado(prefijo);
  estado.idGenero = valoresIniciales.id_genero || null;
  estado.idSubgenero = valoresIniciales.id_subgenero || null;
  estado.seleccionados = valoresIniciales.tropes ? [...valoresIniciales.tropes] : [];

  const generos = await _cargarGeneros();

  contenedor.innerHTML = `
    <div class="tropes-flujo">
      <div class="form-group">
        <label>Género</label>
        <select id="${prefijo}-select-genero" class="form-input" onchange="onCambioGenero('${prefijo}')">
          <option value="">Seleccioná un género...</option>
          ${generos.map(g => `
            <option value="${g.id}" data-tiene-subgenero="${g.tiene_subgenero}" ${estado.idGenero === g.id ? 'selected' : ''}>
              ${g.nombre}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group" id="${prefijo}-contenedor-subgenero" style="display:none;">
        <label>Subgénero</label>
        <select id="${prefijo}-select-subgenero" class="form-input" onchange="onCambioSubgenero('${prefijo}')">
          <option value="">Seleccioná un subgénero...</option>
        </select>
      </div>

      <div class="form-group" id="${prefijo}-contenedor-buscador-tropes" style="display:none;">
        <label>Tropes</label>
        <div class="tropes-buscador-wrapper">
          <input
            type="text"
            id="${prefijo}-buscador-tropes"
            class="form-input"
            placeholder="Buscá un trope..."
            autocomplete="off"
            oninput="onBuscarTropes('${prefijo}')"
            onfocus="onBuscarTropes('${prefijo}')"
          />
          <div class="tropes-dropdown" id="${prefijo}-dropdown-tropes" style="display:none;"></div>
        </div>
        <div class="tropes-seleccionados-preview" id="${prefijo}-tropes-preview"></div>
      </div>
    </div>
  `;

  // Precarga para edición: si ya venía un género, disparar la cascada
  if (estado.idGenero) {
    const opt = contenedor.querySelector(`#${prefijo}-select-genero option[value="${estado.idGenero}"]`);
    const tieneSubgenero = opt && opt.dataset.tieneSubgenero === 'true';
    document.getElementById(`${prefijo}-contenedor-buscador-tropes`).style.display = 'block';

    if (tieneSubgenero) {
      document.getElementById(`${prefijo}-contenedor-subgenero`).style.display = 'block';
      const subs = await _cargarSubgeneros(estado.idGenero);
      const selectSub = document.getElementById(`${prefijo}-select-subgenero`);
      selectSub.innerHTML = `
        <option value="">Seleccioná un subgénero...</option>
        ${subs.map(s => `<option value="${s.id}" ${estado.idSubgenero === s.id ? 'selected' : ''}>${s.nombre}</option>`).join('')}
      `;
    }

    renderizarChipsTropes(prefijo);
  }
}

/**
 * Se dispara al elegir género: muestra/oculta subgénero y habilita el buscador.
 */
async function onCambioGenero(prefijo) {
  const estado = _estado(prefijo);
  const select = document.getElementById(`${prefijo}-select-genero`);
  const idGenero = select.value ? parseInt(select.value, 10) : null;
  const opt = select.options[select.selectedIndex];
  const tieneSubgenero = opt && opt.dataset.tieneSubgenero === 'true';

  estado.idGenero = idGenero;
  estado.idSubgenero = null;
  estado.seleccionados = []; // cambiar de género invalida los tropes elegidos (son de otro género)

  const contSub = document.getElementById(`${prefijo}-contenedor-subgenero`);
  const contBuscador = document.getElementById(`${prefijo}-contenedor-buscador-tropes`);

  if (!idGenero) {
    contSub.style.display = 'none';
    contBuscador.style.display = 'none';
    renderizarChipsTropes(prefijo);
    return;
  }

  if (tieneSubgenero) {
    contSub.style.display = 'block';
    const subs = await _cargarSubgeneros(idGenero);
    const selectSub = document.getElementById(`${prefijo}-select-subgenero`);
    selectSub.innerHTML = `
      <option value="">Seleccioná un subgénero...</option>
      ${subs.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('')}
    `;
    contBuscador.style.display = 'none'; // hasta elegir subgénero, no mostramos tropes
  } else {
    contSub.style.display = 'none';
    contBuscador.style.display = 'block';
  }

  renderizarChipsTropes(prefijo);
}

/**
 * Se dispara al elegir subgénero: habilita el buscador de tropes.
 */
function onCambioSubgenero(prefijo) {
  const estado = _estado(prefijo);
  const select = document.getElementById(`${prefijo}-select-subgenero`);
  estado.idSubgenero = select.value ? parseInt(select.value, 10) : null;

  const contBuscador = document.getElementById(`${prefijo}-contenedor-buscador-tropes`);
  contBuscador.style.display = select.value ? 'block' : 'none';
}

/**
 * Busca tropes en Supabase mientras el usuario escribe y pinta el dropdown.
 */
let _debounceBusquedaTropes = {};
async function onBuscarTropes(prefijo) {
  clearTimeout(_debounceBusquedaTropes[prefijo]);
  _debounceBusquedaTropes[prefijo] = setTimeout(async () => {
    const estado = _estado(prefijo);
    const input = document.getElementById(`${prefijo}-buscador-tropes`);
    const dropdown = document.getElementById(`${prefijo}-dropdown-tropes`);
    if (!estado.idGenero) return;

    const resultados = await _buscarTropes(estado.idGenero, input.value);
    const idsYaSeleccionados = estado.seleccionados.map(t => t.id);
    const disponibles = resultados.filter(t => !idsYaSeleccionados.includes(t.id));

    if (disponibles.length === 0) {
      dropdown.innerHTML = `<div class="tropes-dropdown-vacio">Sin resultados</div>`;
    } else {
      dropdown.innerHTML = disponibles.map(t => `
        <div class="tropes-dropdown-item" onclick="seleccionarTrope('${prefijo}', ${t.id}, '${t.nombre.replace(/'/g, "\\'")}')">
          ${t.nombre}
        </div>
      `).join('');
    }
    dropdown.style.display = 'block';
  }, 250);
}

/**
 * Agrega un trope elegido del dropdown a la selección.
 */
function seleccionarTrope(prefijo, id, nombre) {
  const estado = _estado(prefijo);
  if (!estado.seleccionados.some(t => t.id === id)) {
    estado.seleccionados.push({ id, nombre });
  }
  document.getElementById(`${prefijo}-buscador-tropes`).value = '';
  document.getElementById(`${prefijo}-dropdown-tropes`).style.display = 'none';
  renderizarChipsTropes(prefijo);
}

/**
 * Quita un trope de la selección.
 */
function quitarTrope(prefijo, id) {
  const estado = _estado(prefijo);
  estado.seleccionados = estado.seleccionados.filter(t => t.id !== id);
  renderizarChipsTropes(prefijo);
}


// ────────────────────────────────────────────────────────────
// PREVIEW DE TROPES SELECCIONADOS
// ────────────────────────────────────────────────────────────

/**
 * Genera el HTML del preview de tropes seleccionados (chips con botón "quitar").
 *
 * @param {string} prefijo
 */
function renderizarChipsTropes(prefijo) {
  const preview = document.getElementById(`${prefijo}-tropes-preview`);
  if (!preview) return;

  const estado = _estado(prefijo);

  if (estado.seleccionados.length === 0) {
    preview.innerHTML = `<p class="tropes-preview-vacio">Ningún trope seleccionado todavía.</p>`;
    return;
  }

  preview.innerHTML = `
    <p class="tropes-preview-label">Seleccionados:</p>
    <div class="tropes-tags">
      ${estado.seleccionados.map(t => `
        <span class="tropes-tag">
          ${t.nombre}
          <button type="button" class="tropes-tag-quitar" onclick="quitarTrope('${prefijo}', ${t.id})">×</button>
        </span>
      `).join('')}
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// ETIQUETA DE GÉNERO / SUBGÉNERO (para mostrar en cards, feed, perfil, etc.)
// ────────────────────────────────────────────────────────────

let _cacheGenerosPromise = null;
let _cacheSubgenerosPromise = null;

/**
 * Trae y cachea en memoria TODOS los géneros del catálogo (son pocos).
 * Se reutiliza durante toda la sesión de la página.
 */
function _obtenerCacheGeneros() {
  if (!_cacheGenerosPromise) {
    _cacheGenerosPromise = supabaseClient
      .from('generos')
      .select('id, nombre')
      .then(({ data, error }) => {
        if (error) { console.error('Error cargando cache de generos:', error); return []; }
        return data || [];
      });
  }
  return _cacheGenerosPromise;
}

/**
 * Trae y cachea en memoria TODOS los subgéneros del catálogo (son pocos).
 */
function _obtenerCacheSubgeneros() {
  if (!_cacheSubgenerosPromise) {
    _cacheSubgenerosPromise = supabaseClient
      .from('subgeneros')
      .select('id, nombre')
      .then(({ data, error }) => {
        if (error) { console.error('Error cargando cache de subgeneros:', error); return []; }
        return data || [];
      });
  }
  return _cacheSubgenerosPromise;
}

/**
 * Devuelve la etiqueta de género/subgénero lista para mostrar
 * (ej: "Romance · Dark Romance" o solo "Fantasía" si el género no tiene subgénero).
 * Devuelve null si no hay id_genero (para que quien la use pueda hacer fallback
 * al texto viejo en libros/campañas no migrados).
 *
 * @param {number|null} idGenero
 * @param {number|null} idSubgenero
 * @returns {Promise<string|null>}
 */
async function obtenerEtiquetaGenero(idGenero, idSubgenero) {
  if (!idGenero) return null;

  const generos = await _obtenerCacheGeneros();
  const genero = generos.find(g => g.id === idGenero);
  if (!genero) return null;

  if (!idSubgenero) return genero.nombre;

  const subgeneros = await _obtenerCacheSubgeneros();
  const subgenero = subgeneros.find(s => s.id === idSubgenero);
  return subgenero ? `${genero.nombre} · ${subgenero.nombre}` : genero.nombre;
}



/**
 * Devuelve { id_genero, id_subgenero, idsTropes } para guardar:
 * - id_genero / id_subgenero van directo en la fila de libros/campanas
 * - idsTropes es el array de integer para insertar en libro_tropes / campana_tropes
 */
function obtenerSeleccionTropes(prefijo) {
  const estado = _estado(prefijo);
  return {
    id_genero: estado.idGenero,
    id_subgenero: estado.idSubgenero,
    idsTropes: estado.seleccionados.map(t => t.id)
  };
}

/**
 * Convierte un string de tropes guardado en el formato viejo (texto libre)
 * a un array, solo para mostrar en modo lectura libros/usuarios sin migrar.
 * No se usa para guardar nada nuevo.
 *
 * @param {string} texto — 'Enemigos a Amantes, Fake Dating, ...'
 * @returns {string[]}
 */
function tropesTextoAArray(texto) {
  if (!texto) return [];
  return texto.split(',').map(t => t.trim()).filter(Boolean);
}
