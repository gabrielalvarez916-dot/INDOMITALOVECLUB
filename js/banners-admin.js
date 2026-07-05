// ============================================================
// banners-admin.js — Indómita Love Club
// Gestión de banners publicitarios desde el panel admin.
// Archivo independiente: no modifica ninguna función existente.
// ============================================================

let _bannersAdmin = [];

/**
 * Carga la sección de Banners en el panel admin: formulario + lista.
 * Se llama al mostrar el tab "Banners".
 */
async function cargarBannersAdmin() {
  renderizarFormBanner();
  await refrescarListaBanners();
}

/**
 * Renderiza el formulario para crear un banner nuevo.
 */
function renderizarFormBanner() {
  const contenedor = document.getElementById('admin-banners-form-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <h3 class="panel-titulo" style="font-size:20px;">Agregar banner</h3>
    <p class="form-info">
      Tamaño recomendado de la imagen: 1200x300px. Subí la imagen a Drive,
      compartila como "Cualquier usuario con el enlace" y pegá el link acá.
    </p>
    <form id="form-nuevo-banner" onsubmit="crearBannerAdmin(event)">
      <div class="form-grupo">
        <label class="form-label">Link de la imagen *</label>
        <input type="url" id="banner-imagen-url" class="form-input" required placeholder="https://drive.google.com/..." />
      </div>
      <div class="form-grupo">
        <label class="form-label">Link de destino (opcional)</label>
        <input type="url" id="banner-link-destino" class="form-input" placeholder="https://instagram.com/indomitaloveclub" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Orden (menor número aparece primero)</label>
        <input type="number" id="banner-orden" class="form-input" value="0" min="0" />
      </div>
      <div id="banner-error" class="mensaje-error" style="display:none;"></div>
      <div id="banner-ok" class="mensaje-ok" style="display:none;"></div>
      <button type="submit" class="btn-primario" id="btn-crear-banner">Agregar banner</button>
    </form>
  `;
}

/**
 * Crea un banner nuevo desde el formulario.
 *
 * @param {Event} event
 */
async function crearBannerAdmin(event) {
  event.preventDefault();
  ocultarMensajes('banner-error', 'banner-ok');
  toggleBoton('btn-crear-banner', false, 'Creando...');

  const imagenUrl = convertirLinkDrive(document.getElementById('banner-imagen-url')?.value?.trim());
  const linkDestino = document.getElementById('banner-link-destino')?.value?.trim();
  const orden = document.getElementById('banner-orden')?.value;

  const { data: resultado, error } = await supabaseClient.rpc('admin_crear_banner', {
    p_imagen_url: imagenUrl,
    p_link_destino: linkDestino,
    p_orden: orden ? parseInt(orden, 10) : 0
  });

  toggleBoton('btn-crear-banner', true, '', 'Agregar banner');

  if (error || !resultado || resultado.error) {
    mostrarMensajeError('banner-error', resultado?.error || 'Error al crear el banner.');
    return;
  }

  mostrarMensajeOk('banner-ok', '¡Banner creado correctamente!');
  document.getElementById('form-nuevo-banner')?.reset();
  document.getElementById('banner-orden').value = '0';

  await refrescarListaBanners();
}

/**
 * Pide a Supabase la lista completa de banners y la renderiza.
 */
async function refrescarListaBanners() {
  const contenedor = document.getElementById('admin-banners-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_banners');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar los banners.'}</p>`;
    return;
  }

  _bannersAdmin = resultado.banners || [];

  if (_bannersAdmin.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">No hay banners cargados todavía.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <h3 class="panel-titulo" style="font-size:20px; margin-bottom:14px;">Banners cargados</h3>
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${_bannersAdmin.map(b => construirCardBannerAdmin(b)).join('')}
    </div>
  `;
}

/**
 * Construye la card de un banner para el panel admin.
 *
 * @param {Object} b
 * @returns {string} HTML de la card
 */
function construirCardBannerAdmin(b) {
  return `
    <div class="lista-item" style="align-items:center;">
      <img src="${b.imagenUrl}" alt="Banner" style="width:160px; height:40px; object-fit:cover; border-radius:6px; background:var(--crema); flex-shrink:0;" onerror="this.style.display='none'" />
      <div class="lista-item-body">
        <p class="lista-item-meta" style="margin-bottom:4px;">
          ${b.activo ? '<span class="badge badge-activa">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}
          &nbsp;Orden: ${b.orden ?? 0}
        </p>
        ${b.linkDestino ? `<p class="lista-item-meta" style="margin:0;">Destino: <a href="${b.linkDestino}" target="_blank" class="red-link">${truncarTexto(b.linkDestino, 50)}</a></p>` : '<p class="lista-item-meta" style="margin:0;">Sin link de destino</p>'}
        <div class="lista-item-acciones">
          <button class="btn-secundario btn-sm" onclick="toggleBannerAdmin('${b.id}', ${!b.activo})">${b.activo ? 'Desactivar' : 'Activar'}</button>
          <button class="btn-secundario btn-sm btn-peligro" onclick="eliminarBannerAdmin('${b.id}')">Eliminar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Activa o desactiva un banner.
 *
 * @param {string} idBanner
 * @param {boolean} nuevoEstado
 */
async function toggleBannerAdmin(idBanner, nuevoEstado) {
  const { data: resultado, error } = await supabaseClient.rpc('admin_toggle_banner', {
    p_id_banner: idBanner,
    p_activo: nuevoEstado
  });

  if (error || !resultado || resultado.error) {
    mostrarToast(resultado?.error || 'Error al cambiar el estado del banner.', 'error');
    return;
  }

  mostrarToast(nuevoEstado ? 'Banner activado.' : 'Banner desactivado.', 'ok');
  await refrescarListaBanners();
}

/**
 * Elimina un banner, con confirmación previa.
 *
 * @param {string} idBanner
 */
async function eliminarBannerAdmin(idBanner) {
  if (!confirm('¿Eliminar este banner? Esta acción no se puede deshacer.')) return;

  const { data: resultado, error } = await supabaseClient.rpc('admin_eliminar_banner', {
    p_id_banner: idBanner
  });

  if (error || !resultado || resultado.error) {
    mostrarToast(resultado?.error || 'Error al eliminar el banner.', 'error');
    return;
  }

  mostrarToast('Banner eliminado.', 'ok');
  await refrescarListaBanners();
}
