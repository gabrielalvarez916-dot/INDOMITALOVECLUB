// ============================================================
// buscador-perfiles.js — Indómita Love Club
// Búsqueda de perfiles en tiempo real con autocomplete
// ============================================================

const BuscadorPerfiles = (() => {
  let debounceTimer = null;
  const TIEMPO_DEBOUNCE = 300; // ms
  let ultimoQuery = '';

  /**
   * Inicializa el buscador
   * Se llama cuando carga la página
   */
  function init() {
    const input = document.getElementById('buscador-perfiles-input');
    if (!input) return;

    // Event listeners
    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleFocus);
    document.addEventListener('click', handleClickAfuera);
  }

  /**
   * Maneja el evento input con debounce
   */
  function handleInput(e) {
    const query = e.target.value.trim();

    // Limpia el timer anterior
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      cerrarDropdown();
      ultimoQuery = '';
      return;
    }

    // Si el query es igual al anterior, no busca de nuevo
    if (query === ultimoQuery) return;

    // Muestra estado de cargando
    mostrarCargando();

    // Espera TIEMPO_DEBOUNCE ms antes de buscar
    debounceTimer = setTimeout(() => {
      buscar(query);
      ultimoQuery = query;
    }, TIEMPO_DEBOUNCE);
  }

  /**
   * Cuando el input recibe focus y hay un query anterior,
   * vuelve a mostrar los resultados
   */
  function handleFocus(e) {
    const query = e.target.value.trim();
    if (query.length >= 2) {
      abrirDropdown();
    }
  }

  /**
   * Cierra el dropdown si haces clic afuera
   */
  function handleClickAfuera(e) {
    const container = document.querySelector('.buscador-perfiles-container');
    if (container && !container.contains(e.target)) {
      cerrarDropdown();
    }
  }

  /**
   * Llama al backend para buscar perfiles
   */
  async function buscar(query) {
    try {
      const { data: perfiles, error } = await supabaseClient.rpc('buscar_perfiles', { p_query: query });

      if (error) {
        console.error(error);
        mostrarError('Error al buscar perfiles');
        return;
      }

      renderizarResultados(perfiles || [], query);
      
    } catch (error) {
      console.error('Error en búsqueda:', error);
      mostrarError('Error al buscar perfiles');
    }
  }

  /**
   * Renderiza los resultados en el dropdown
   */
  function renderizarResultados(perfiles, query) {
    const lista = document.getElementById('buscador-perfiles-lista');
    if (!lista) return;

    if (perfiles.length === 0) {
      lista.innerHTML = `<div class="buscador-perfiles-item-vacio">No encontramos resultados para "${query}"</div>`;
      abrirDropdown();
      return;
    }

    lista.innerHTML = perfiles.map(perfil => construirItemPerfil(perfil)).join('');

    // Agrega event listeners a los items
    lista.querySelectorAll('.buscador-perfiles-item').forEach(item => {
      item.addEventListener('click', () => {
        const idUsuario = item.dataset.id;
        const rol = item.dataset.rol;
        seleccionarPerfil(idUsuario, rol);
      });
    });

    abrirDropdown();
  }

  /**
   * Construye el HTML de un item de perfil
   */
  function construirItemPerfil(perfil) {
    const fotoHtml = perfil.fotoPerfil
      ? `<img src="${perfil.fotoPerfil}" alt="${perfil.alias}" class="buscador-perfiles-item-foto" onerror="this.style.display='none'" />`
      : `<div class="buscador-perfiles-item-foto">👤</div>`;

    return `
      <li class="buscador-perfiles-item" data-id="${perfil.id}" data-rol="${perfil.rol}">
        ${fotoHtml}
        <div class="buscador-perfiles-item-info">
          <div class="buscador-perfiles-item-alias">${perfil.alias}</div>
          <div class="buscador-perfiles-item-rol">${perfil.rol}</div>
        </div>
      </li>
    `;
  }

  /**
   * Cuando el usuario hace clic en un perfil
   */
  function seleccionarPerfil(idUsuario, rol) {
    cerrarDropdown();
    limpiarInput();
    abrirPerfilPublico(idUsuario, rol);
  }

  /**
   * Abre el dropdown
   */
  function abrirDropdown() {
    const dropdown = document.getElementById('buscador-perfiles-dropdown');
    if (dropdown) {
      dropdown.style.display = 'block';
    }
  }

  /**
   * Cierra el dropdown
   */
  function cerrarDropdown() {
    const dropdown = document.getElementById('buscador-perfiles-dropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  }

  /**
   * Limpia el input
   */
  function limpiarInput() {
    const input = document.getElementById('buscador-perfiles-input');
    if (input) {
      input.value = '';
    }
    ultimoQuery = '';
  }

  /**
   * Muestra estado de cargando
   */
  function mostrarCargando() {
    const lista = document.getElementById('buscador-perfiles-lista');
    if (lista) {
      lista.innerHTML = `
        <div class="buscador-perfiles-item-cargando">
          <span class="buscador-perfiles-spinner"></span>Buscando...
        </div>
      `;
    }
    abrirDropdown();
  }

  /**
   * Muestra un mensaje de error
   */
  function mostrarError(mensaje) {
    const lista = document.getElementById('buscador-perfiles-lista');
    if (lista) {
      lista.innerHTML = `<div class="buscador-perfiles-item-vacio">⚠️ ${mensaje}</div>`;
    }
    abrirDropdown();
  }

  return { init };
})();

// Inicializa el buscador cuando carga el feed
document.addEventListener('DOMContentLoaded', () => {
  BuscadorPerfiles.init();
});
