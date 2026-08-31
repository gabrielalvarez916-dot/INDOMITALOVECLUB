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
  await _cargarCampanasParaBanner();
}

/**
 * Actualiza los contadores de banners activos por espacio (Feed,
 * Panel reseñador Espacio 1, Panel reseñador Espacio 2), para que no
 * haga falta contarlos a mano en la lista de abajo.
 */
function _actualizarContadoresBanner() {
  const contenedor = document.getElementById('banner-contadores');
  if (!contenedor) return;

  const activos = _bannersAdmin.filter(b => b.activo);
  const nFeed = activos.filter(b => b.ubicacion !== 'panel_resenador').length;
  const nEsp1 = activos.filter(b => b.ubicacion === 'panel_resenador' && b.slot !== 2).length;
  const nEsp2 = activos.filter(b => b.ubicacion === 'panel_resenador' && b.slot === 2).length;

  const badge = (texto, n) => `<span class="badge">${texto} (${n})</span>`;

  contenedor.innerHTML =
    badge('Feed', nFeed) +
    badge('Panel reseñador · Espacio 1', nEsp1) +
    badge('Panel reseñador · Espacio 2', nEsp2);
}

/**
 * Muestra el campo de link externo o el de campaña según lo elegido,
 * asegurando que solo uno de los dos se envíe (son excluyentes).
 */
function _actualizarDestinoBanner() {
  const tipo = document.getElementById('banner-tipo-destino')?.value;
  const grupoLink = document.getElementById('banner-grupo-link');
  const grupoCampana = document.getElementById('banner-grupo-campana');
  if (!grupoLink || !grupoCampana) return;

  grupoLink.style.display = tipo === 'link' ? 'block' : 'none';
  grupoCampana.style.display = tipo === 'campana' ? 'block' : 'none';

  if (tipo !== 'link') document.getElementById('banner-link-destino').value = '';
  if (tipo !== 'campana') document.getElementById('banner-id-campana').value = '';
}

/**
 * Carga el desplegable de campañas activas para elegir como destino del banner.
 *
 * @param {string} idSelect - id del <select> a llenar (default: el del form de creación)
 * @param {string} [valorPreseleccionado] - id de campaña a dejar seleccionada
 */
async function _cargarCampanasParaBanner(idSelect = 'banner-id-campana', valorPreseleccionado = null) {
  const select = document.getElementById(idSelect);
  if (!select) return;

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_campanas');

  if (error || !resultado || resultado.error) {
    select.innerHTML = '<option value="">Error al cargar campañas</option>';
    return;
  }

  const campanas = (resultado.campañas || []).filter(c => c.estado === 'activa' && (c.cuposDisponibles ?? 0) > 0);

  if (campanas.length === 0) {
    select.innerHTML = '<option value="">No hay campañas activas</option>';
    return;
  }

  select.innerHTML = '<option value="">Elegí una campaña</option>' +
    campanas.map(c => `<option value="${c.id}" ${valorPreseleccionado === c.id ? 'selected' : ''}>${c.nombreLibro}</option>`).join('');
}

/**
 * Renderiza el formulario para crear un banner nuevo.
 */
function renderizarFormBanner() {
  const contenedor = document.getElementById('admin-banners-form-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div id="banner-contadores" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;"></div>
    <h3 class="panel-titulo" style="font-size:20px;">Agregar banner</h3>
    <form id="form-nuevo-banner" onsubmit="crearBannerAdmin(event)">
      <div class="form-grupo">
        <label class="form-label">Ubicación</label>
        <select id="banner-ubicacion" class="form-input" onchange="_actualizarHintBanner()">
          <option value="feed">Feed (banner ancho arriba de todo)</option>
          <option value="panel_resenador">Panel del reseñador (columna lateral, formato historia)</option>
        </select>
      </div>
      <div class="form-grupo" id="banner-grupo-slot" style="display:none;">
        <label class="form-label">Espacio</label>
        <select id="banner-slot" class="form-input">
          <option value="1">Espacio 1 (de arriba)</option>
          <option value="2">Espacio 2 (de abajo)</option>
        </select>
      </div>
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
        <label class="form-label">Destino al hacer click</label>
        <select id="banner-tipo-destino" class="form-input" onchange="_actualizarDestinoBanner()">
          <option value="ninguno">Sin destino (no clickeable)</option>
          <option value="link">Link externo (Instagram, WhatsApp, etc.)</option>
          <option value="campana">Abrir una campaña del feed</option>
        </select>
      </div>
      <div class="form-grupo" id="banner-grupo-link">
        <label class="form-label">Link de destino</label>
        <input type="url" id="banner-link-destino" class="form-input" placeholder="https://instagram.com/indomitaloveclub" />
      </div>
      <div class="form-grupo" id="banner-grupo-campana" style="display:none;">
        <label class="form-label">Campaña</label>
        <select id="banner-id-campana" class="form-input">
          <option value="">Cargando campañas...</option>
        </select>
      </div>
      <div class="form-grupo">
        <label class="form-label">Orden (menor número aparece primero)</label>
        <input type="number" id="banner-orden" class="form-input" value="0" min="0" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Duración en pantalla (segundos)</label>
        <input type="number" id="banner-duracion" class="form-input" value="10" min="1" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Desactivar automáticamente el (opcional)</label>
        <input type="datetime-local" id="banner-fecha-fin" class="form-input" />
        <p class="form-info">Si lo dejás vacío, el banner se queda activo hasta que lo apagues a mano.</p>
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
  const ubicacion = document.getElementById('banner-ubicacion')?.value;
  const hint = document.getElementById('banner-hint');
  const label = document.getElementById('banner-archivo-label');
  const input = document.getElementById('banner-archivo');
  const grupoSlot = document.getElementById('banner-grupo-slot');
  if (!hint || !label || !input) return;

  _limpiarUrlSubidaBanner();

  if (grupoSlot) grupoSlot.style.display = ubicacion === 'panel_resenador' ? 'block' : 'none';

  const medida = ubicacion === 'panel_resenador' ? '1080x1920px (formato historia, vertical 9:16)' : '1200x300px';

  if (tipo === 'video') {
    hint.innerHTML = `Tamaño recomendado: ${medida}. El video se muestra sin sonido, en loop automático.`;
    label.textContent = 'Archivo de video (.mp4) *';
    input.setAttribute('accept', 'video/mp4');
  } else {
    hint.innerHTML = `Tamaño recomendado: ${medida}. Si subís un GIF, se va a animar solo.`;
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

  const tipoDestino = document.getElementById('banner-tipo-destino')?.value;
  const linkDestino = tipoDestino === 'link' ? document.getElementById('banner-link-destino')?.value?.trim() : null;
  const idCampana = tipoDestino === 'campana' ? document.getElementById('banner-id-campana')?.value : null;

  if (tipoDestino === 'campana' && !idCampana) {
    mostrarMensajeError('banner-error', 'Elegí una campaña.');
    toggleBoton('btn-crear-banner', true, '', 'Subir y agregar banner');
    if (estado) estado.textContent = '';
    return;
  }

  const orden = document.getElementById('banner-orden')?.value;
  const duracion = document.getElementById('banner-duracion')?.value;
  const ubicacion = document.getElementById('banner-ubicacion')?.value === 'panel_resenador' ? 'panel_resenador' : 'feed';
  const slot = document.getElementById('banner-slot')?.value === '2' ? 2 : 1;
  const fechaFinInput = document.getElementById('banner-fecha-fin')?.value;
  const fechaFin = fechaFinInput ? new Date(fechaFinInput).toISOString() : null;

  const { data: resultado, error } = await supabaseClient.rpc('admin_crear_banner', {
    p_imagen_url: urlPublica,
    p_link_destino: linkDestino,
    p_orden: orden ? parseInt(orden, 10) : 0,
    p_tipo: tipo,
    p_duracion_segundos: duracion ? parseInt(duracion, 10) : 10,
    p_id_campana: idCampana || null,
    p_ubicacion: ubicacion,
    p_slot: slot,
    p_fecha_fin: fechaFin
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
  document.getElementById('banner-duracion').value = '10';
  _actualizarDestinoBanner();
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
    _actualizarContadoresBanner();
    return;
  }

  contenedor.innerHTML = `
    <h3 class="panel-titulo" style="font-size:20px; margin-bottom:14px;">Banners cargados</h3>
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${_bannersAdmin.map(b => construirCardBannerAdmin(b)).join('')}
    </div>
  `;
  _actualizarContadoresBanner();
}

/**
 * Construye la card de un banner para el panel admin.
 *
 * @param {Object} b
 * @returns {string} HTML de la card
 */
function construirCardBannerAdmin(b) {
  // El feed es un banner ancho (1200x300 ≈ 4:1) y el panel del reseñador es
  // formato historia, vertical (1080x1920 ≈ 9:16). Cada miniatura respeta la
  // proporción real de su espacio para que se vea completa y se entienda de
  // qué campaña es, en vez de recortarla siempre en una franja horizontal.
  const esPanelResenador = b.ubicacion === 'panel_resenador';
  const estiloMiniatura = esPanelResenador
    ? 'width:68px; height:121px; object-fit:cover; border-radius:6px; background:var(--crema); flex-shrink:0;'
    : 'width:160px; height:40px; object-fit:cover; border-radius:6px; background:var(--crema); flex-shrink:0;';

  const miniatura = b.tipo === 'video'
    ? `<video src="${b.imagenUrl}" muted loop playsinline autoplay preload="auto" style="${estiloMiniatura}" onerror="this.style.display='none'"></video>`
    : `<img src="${b.imagenUrl}" alt="Banner" style="${estiloMiniatura}" onerror="this.style.display='none'" />`;

  const fechaFinTexto = b.fechaFin ? `⏰ Se apaga solo el ${formatearFechaAmigable(b.fechaFin)}` : '';

  return `
    <div class="lista-item" style="align-items:center;">
      ${miniatura}
      <div class="lista-item-body">
        <p class="lista-item-meta" style="margin-bottom:4px;">
          ${b.activo ? '<span class="badge badge-activa">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}
          &nbsp;${b.tipo === 'video' ? '<span class="badge">🎬 Video</span>' : '<span class="badge">🖼️ Imagen</span>'}
          &nbsp;<span class="badge">${b.ubicacion === 'panel_resenador' ? `📱 Panel reseñador · Espacio ${b.slot === 2 ? 2 : 1}` : '🏠 Feed'}</span>
          &nbsp;Orden: ${b.orden ?? 0}
          &nbsp;Duración: ${b.duracionSegundos ?? 10}s
        </p>
        ${fechaFinTexto ? `<p class="lista-item-meta" style="margin:0;">${fechaFinTexto}</p>` : ''}
        ${b.linkDestino ? `<p class="lista-item-meta" style="margin:0;">Destino: <a href="${b.linkDestino}" target="_blank" class="red-link">${truncarTexto(b.linkDestino, 50)}</a></p>` : ''}
        ${b.idCampana ? `<p class="lista-item-meta" style="margin:0;">Destino: campaña "${b.nombreCampana || 'sin nombre'}"</p>` : ''}
        ${!b.linkDestino && !b.idCampana ? '<p class="lista-item-meta" style="margin:0;">Sin destino</p>' : ''}
        <div id="banner-editar-${b.id}"></div>
        <div class="lista-item-acciones">
          <button class="btn-secundario btn-sm" onclick="abrirEditarBannerAdmin('${b.id}')">Editar</button>
          <button class="btn-secundario btn-sm" onclick="toggleBannerAdmin('${b.id}', ${!b.activo})">${b.activo ? 'Desactivar' : 'Activar'}</button>
          <button class="btn-secundario btn-sm btn-peligro" onclick="eliminarBannerAdmin('${b.id}')">Eliminar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Abre (o cierra si ya está abierto) el mini-formulario de edición inline
 * de un banner: link/campaña, orden y duración. La imagen y el tipo
 * (imagen/video) no se editan acá — para eso hay que crear un banner nuevo.
 *
 * @param {string} idBanner
 */
async function abrirEditarBannerAdmin(idBanner) {
  const contenedor = document.getElementById(`banner-editar-${idBanner}`);
  if (!contenedor) return;

  if (contenedor.innerHTML.trim() !== '') {
    contenedor.innerHTML = '';
    return;
  }

  const b = _bannersAdmin.find(x => x.id === idBanner);
  if (!b) return;

  const tipoDestinoActual = b.idCampana ? 'campana' : (b.linkDestino ? 'link' : 'ninguno');

  contenedor.innerHTML = `
    <div style="background:var(--crema); border-radius:8px; padding:12px; margin:10px 0; display:flex; flex-direction:column; gap:10px;">
      <div class="form-grupo" style="margin:0;">
        <label class="form-label">Ubicación</label>
        <select id="banner-edit-ubicacion-${idBanner}" class="form-input" onchange="_actualizarSlotEditBanner('${idBanner}')">
          <option value="feed" ${b.ubicacion !== 'panel_resenador' ? 'selected' : ''}>Feed</option>
          <option value="panel_resenador" ${b.ubicacion === 'panel_resenador' ? 'selected' : ''}>Panel del reseñador</option>
        </select>
      </div>
      <div class="form-grupo" id="banner-edit-grupo-slot-${idBanner}" style="margin:0; display:${b.ubicacion === 'panel_resenador' ? 'block' : 'none'};">
        <label class="form-label">Espacio</label>
        <select id="banner-edit-slot-${idBanner}" class="form-input">
          <option value="1" ${b.slot !== 2 ? 'selected' : ''}>Espacio 1 (de arriba)</option>
          <option value="2" ${b.slot === 2 ? 'selected' : ''}>Espacio 2 (de abajo)</option>
        </select>
      </div>
      <div class="form-grupo" style="margin:0;">
        <label class="form-label">Destino al hacer click</label>
        <select id="banner-edit-tipo-destino-${idBanner}" class="form-input" onchange="_actualizarDestinoEditBanner('${idBanner}')">
          <option value="ninguno" ${tipoDestinoActual === 'ninguno' ? 'selected' : ''}>Sin destino (no clickeable)</option>
          <option value="link" ${tipoDestinoActual === 'link' ? 'selected' : ''}>Link externo</option>
          <option value="campana" ${tipoDestinoActual === 'campana' ? 'selected' : ''}>Abrir una campaña del feed</option>
        </select>
      </div>
      <div class="form-grupo" id="banner-edit-grupo-link-${idBanner}" style="margin:0; display:${tipoDestinoActual === 'link' ? 'block' : 'none'};">
        <label class="form-label">Link de destino</label>
        <input type="url" id="banner-edit-link-${idBanner}" class="form-input" value="${b.linkDestino || ''}" />
      </div>
      <div class="form-grupo" id="banner-edit-grupo-campana-${idBanner}" style="margin:0; display:${tipoDestinoActual === 'campana' ? 'block' : 'none'};">
        <label class="form-label">Campaña</label>
        <select id="banner-edit-campana-${idBanner}" class="form-input">
          <option value="">Cargando campañas...</option>
        </select>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="form-grupo" style="margin:0; flex:1;">
          <label class="form-label">Orden</label>
          <input type="number" id="banner-edit-orden-${idBanner}" class="form-input" value="${b.orden ?? 0}" min="0" />
        </div>
        <div class="form-grupo" style="margin:0; flex:1;">
          <label class="form-label">Duración (seg)</label>
          <input type="number" id="banner-edit-duracion-${idBanner}" class="form-input" value="${b.duracionSegundos ?? 10}" min="1" />
        </div>
      </div>
      <div class="form-grupo" style="margin:0;">
        <label class="form-label">Desactivar automáticamente el (opcional)</label>
        <input type="datetime-local" id="banner-edit-fecha-fin-${idBanner}" class="form-input" value="${b.fechaFin ? _isoAFechaLocalInput(b.fechaFin) : ''}" />
        <p class="form-info">Dejalo vacío y borrá el valor si querés que quede activo hasta apagarlo a mano.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-primario btn-sm" onclick="guardarEditarBannerAdmin('${idBanner}')">Guardar cambios</button>
        <button class="btn-secundario btn-sm" onclick="abrirEditarBannerAdmin('${idBanner}')">Cancelar</button>
      </div>
    </div>
  `;

  await _cargarCampanasParaBanner(`banner-edit-campana-${idBanner}`, b.idCampana);
}

/**
 * Convierte un timestamp ISO (como viene de Supabase) al formato que
 * espera un <input type="datetime-local">, en hora local del navegador.
 * @param {string} iso
 * @returns {string}
 */
function _isoAFechaLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Muestra el campo de link o el de campaña dentro del form de edición
 * inline, según lo elegido (son excluyentes).
 *
 * @param {string} idBanner
 */
function _actualizarDestinoEditBanner(idBanner) {
  const tipo = document.getElementById(`banner-edit-tipo-destino-${idBanner}`)?.value;
  const grupoLink = document.getElementById(`banner-edit-grupo-link-${idBanner}`);
  const grupoCampana = document.getElementById(`banner-edit-grupo-campana-${idBanner}`);
  if (!grupoLink || !grupoCampana) return;

  grupoLink.style.display = tipo === 'link' ? 'block' : 'none';
  grupoCampana.style.display = tipo === 'campana' ? 'block' : 'none';
}

/**
 * Muestra u oculta el selector de espacio (1/2) en el form de edición
 * inline según la ubicación elegida (solo aplica a panel_resenador).
 *
 * @param {string} idBanner
 */
function _actualizarSlotEditBanner(idBanner) {
  const ubicacion = document.getElementById(`banner-edit-ubicacion-${idBanner}`)?.value;
  const grupoSlot = document.getElementById(`banner-edit-grupo-slot-${idBanner}`);
  if (!grupoSlot) return;
  grupoSlot.style.display = ubicacion === 'panel_resenador' ? 'block' : 'none';
}

/**
 * Guarda los cambios del mini-formulario de edición de un banner.
 *
 * @param {string} idBanner
 */
async function guardarEditarBannerAdmin(idBanner) {
  const tipoDestino = document.getElementById(`banner-edit-tipo-destino-${idBanner}`)?.value;
  const linkDestino = tipoDestino === 'link' ? document.getElementById(`banner-edit-link-${idBanner}`)?.value?.trim() : null;
  const idCampana = tipoDestino === 'campana' ? document.getElementById(`banner-edit-campana-${idBanner}`)?.value : null;
  const orden = document.getElementById(`banner-edit-orden-${idBanner}`)?.value;
  const duracion = document.getElementById(`banner-edit-duracion-${idBanner}`)?.value;
  const ubicacion = document.getElementById(`banner-edit-ubicacion-${idBanner}`)?.value === 'panel_resenador' ? 'panel_resenador' : 'feed';
  const slot = document.getElementById(`banner-edit-slot-${idBanner}`)?.value === '2' ? 2 : 1;
  const fechaFinInput = document.getElementById(`banner-edit-fecha-fin-${idBanner}`)?.value;
  const fechaFin = fechaFinInput ? new Date(fechaFinInput).toISOString() : null;

  if (tipoDestino === 'campana' && !idCampana) {
    mostrarToast('Elegí una campaña.', 'error');
    return;
  }

  const { data: resultado, error } = await supabaseClient.rpc('admin_editar_banner', {
    p_id_banner: idBanner,
    p_link_destino: linkDestino,
    p_orden: orden ? parseInt(orden, 10) : 0,
    p_duracion_segundos: duracion ? parseInt(duracion, 10) : 10,
    p_id_campana: idCampana || null,
    p_ubicacion: ubicacion,
    p_slot: slot,
    p_fecha_fin: fechaFin,
    p_limpiar_fecha_fin: !fechaFinInput
  });

  if (error || !resultado || resultado.error) {
    mostrarToast(resultado?.error || 'Error al guardar los cambios.', 'error');
    return;
  }

  mostrarToast('Banner actualizado.', 'ok');
  await refrescarListaBanners();
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
