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
    <form id="form-nuevo-banner" onsubmit="crearBannerAdmin(event)">
      <div class="form-grupo">
        <label class="form-label">Tipo de banner</label>
        <select id="banner-tipo" class="form-input" onchange="_actualizarHintBanner()">
          <option value="imagen">Imagen (jpg, png, gif animado)</option>
          <option value="video">Video (mp4)</option>
        </select>
      </div>
      <p class="form-info" id="banner-hint">
        Tamaño recomendado: 1200x300px.
      </p>
      <div class="form-grupo">
        <label class="form-label" id="banner-archivo-label">Archivo de imagen *</label>
        <input type="file" id="banner-archivo" class="form-input" accept="image/jpeg,image/png,image/gif" required onchange="_limpiarUrlSubidaBanner()" />
        <input type="hidden" id="banner-imagen-url" />
        <p id="banner-subida-estado" style="font-size:13px; color:var(--gris-suave); margin-top:6px;"></p>
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
      <button type="submit" class="btn-primario" id="btn-crear-banner">Subir y agregar banner</button>
    </form>
  `;
}

/**
 * Si el usuario cambia de archivo después de haber subido uno, limpia la
 * URL ya subida para forzar que se vuelva a subir el archivo correcto.
 */
function _limpiarUrlSubidaBanner() {
  const oculto = document.getElementById('banner-imagen-url');
  if (oculto) oculto.value = '';
  const estado = document.getElementById('banner-subida-estado');
  if (estado) estado.textContent = '';
}

/**
 * Cambia el texto de ayuda del form según si el banner es imagen o video.
 * Un link de Google Drive normal (el que ya usamos para imágenes) NO sirve
 * para video: Drive lo convierte en una miniatura fija, no en un archivo
 * reproducible. Para video hace falta un link directo a un .mp4 (por
 * ejemplo alojado en el mismo storage que usamos para las portadas/PDFs).
 */
function _actualizarHintBanner() {
  const tipo = document.getElementById('banner-tipo')?.value;
  const hint = document.getElementById('banner-hint');
  const label = document.getElementById('banner-archivo-label');
  const input = document.getElementById('banner-archivo');
  if (!hint || !label || !input) return;

  _limpiarUrlSubidaBanner();

  if (tipo === 'video') {
    hint.innerHTML = `Tamaño recomendado: 1200x300px. El video se muestra sin sonido, en loop automático.`;
    label.textContent = 'Archivo de video (.mp4) *';
    input.setAttribute('accept', 'video/mp4');
  } else {
    hint.innerHTML = `Tamaño recomendado: 1200x300px. Si subís un GIF, se va a animar solo.`;
    label.textContent = 'Archivo de imagen *';
    input.setAttribute('accept', 'image/jpeg,image/png,image/gif');
  }
}

/**
 * Sube un archivo de banner (imagen o video) directo a R2, usando la
 * Edge Function subir-banner (flujo: presignar → PUT directo a R2).
 * Devuelve la URL pública final del archivo ya subido.
 *
 * @param {File} archivo
 * @returns {Promise<string>} URL pública
 */
async function _subirArchivoBanner(archivo) {
  const formato = (archivo.name.split('.').pop() || '').toLowerCase();

  const { data: presign, error: errPresign } = await supabaseClient.functions.invoke('subir-banner', {
    body: { formato }
  });

  if (errPresign || !presign?.url) {
    const detalle = await _leerErrorEdgeFunction(errPresign, 'No se pudo iniciar la subida del archivo.');
    throw new Error(detalle);
  }

  const respPut = await fetch(presign.url, {
    method: 'PUT',
    headers: { 'Content-Type': presign.content_type },
    body: archivo
  });

  if (!respPut.ok) {
    throw new Error(`Error al subir el archivo (HTTP ${respPut.status}). Probá de nuevo.`);
  }

  return presign.public_url;
}

/**
 * Crea un banner nuevo desde el formulario: primero sube el archivo
 * elegido a R2, y con la URL pública que devuelve crea el banner.
 *
 * @param {Event} event
 */
async function crearBannerAdmin(event) {
  event.preventDefault();
  ocultarMensajes('banner-error', 'banner-ok');

  const tipo = document.getElementById('banner-tipo')?.value === 'video' ? 'video' : 'imagen';
  const archivo = document.getElementById('banner-archivo')?.files?.[0];
  const estado = document.getElementById('banner-subida-estado');

  if (!archivo) {
    mostrarMensajeError('banner-error', 'Elegí un archivo primero.');
    return;
  }

  toggleBoton('btn-crear-banner', false, 'Subiendo archivo...');
  if (estado) estado.textContent = `Subiendo ${archivo.name}…`;

  let urlPublica;
  try {
    urlPublica = await _subirArchivoBanner(archivo);
  } catch (e) {
    toggleBoton('btn-crear-banner', true, '', 'Subir y agregar banner');
    mostrarMensajeError('banner-error', e.message || 'Error al subir el archivo.');
    if (estado) estado.textContent = '';
    return;
  }

  if (estado) estado.textContent = '¡Archivo subido! Creando banner...';
  toggleBoton('btn-crear-banner', false, 'Creando banner...');

  const linkDestino = document.getElementById('banner-link-destino')?.value?.trim();
  const orden = document.getElementById('banner-orden')?.value;

  const { data: resultado, error } = await supabaseClient.rpc('admin_crear_banner', {
    p_imagen_url: urlPublica,
    p_link_destino: linkDestino,
    p_orden: orden ? parseInt(orden, 10) : 0,
    p_tipo: tipo
  });

  toggleBoton('btn-crear-banner', true, '', 'Subir y agregar banner');

  if (error || !resultado || resultado.error) {
    mostrarMensajeError('banner-error', resultado?.error || 'Error al crear el banner.');
    if (estado) estado.textContent = '';
    return;
  }

  mostrarMensajeOk('banner-ok', '¡Banner creado correctamente!');
  document.getElementById('form-nuevo-banner')?.reset();
  document.getElementById('banner-orden').value = '0';
  if (estado) estado.textContent = '';

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
