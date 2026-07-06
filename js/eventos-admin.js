// ============================================================
// eventos-admin.js — Indómita Love Club
// Gestión de eventos (ej: "El Primer Beso") desde el panel admin.
// Archivo independiente: no modifica ninguna función existente.
// ============================================================

let _eventosAdmin = [];

// Campos de imagen que puede tener un evento (bucket EVENTOS, path {id_evento}/{campo})
const _CAMPOS_IMAGENES_EVENTO = [
  { campo: 'banner',          label: 'Banner' },
  { campo: 'fondo',           label: 'Fondo' },
  { campo: 'iconoBeso',       label: 'Ícono' },
  { campo: 'insigniaGris',    label: 'Insignia (gris — no conseguida)' },
  { campo: 'insigniaColor',   label: 'Insignia (color — conseguida)' },
  { campo: 'decoracionModal', label: 'Decoración del modal' }
];

// Estado en memoria del formulario de alta/edición (fuente de verdad para retos anidados)
let _eventoFormState = null;

function _eventoFormVacio() {
  return {
    idOriginal: null, // si no es null, estamos editando (el id no se puede cambiar)
    id: '',
    nombre: '',
    activoPorFecha: false,
    fechaInicio: '',
    fechaFin: '',
    textoModal: '',
    historia: '',
    imagenesActuales: {}, // URLs ya subidas (al editar)
    retos: { autor: [], resenador: [] }
  };
}

/**
 * Carga la sección de Eventos en el panel admin: formulario + lista.
 * Se llama al mostrar el tab "Eventos".
 */
async function cargarEventosAdmin() {
  _eventoFormState = _eventoFormVacio();
  renderizarFormEvento();
  await refrescarListaEventos();
}

// ────────────────────────────────────────────────────────────
// FORMULARIO DE ALTA / EDICIÓN
// ────────────────────────────────────────────────────────────

function renderizarFormEvento() {
  const contenedor = document.getElementById('admin-eventos-form-contenedor');
  if (!contenedor) return;

  const s = _eventoFormState;
  const editando = !!s.idOriginal;

  contenedor.innerHTML = `
    <h3 class="panel-titulo" style="font-size:20px;">${editando ? `Editar evento — ${s.idOriginal}` : 'Nuevo evento'}</h3>
    <form id="form-evento-admin" onsubmit="guardarEventoAdmin(event)">
      <div class="form-fila">
        <div class="form-grupo">
          <label class="form-label">ID del evento *</label>
          <input type="text" id="ev-id" class="form-input" value="${s.id}" placeholder="ej: primer_beso"
            oninput="_eventoFormState.id = this.value" ${editando ? 'disabled' : ''} required />
          ${editando ? '<p class="form-hint">El ID no se puede modificar una vez creado.</p>' : ''}
        </div>
        <div class="form-grupo">
          <label class="form-label">Nombre *</label>
          <input type="text" id="ev-nombre" class="form-input" value="${s.nombre}"
            oninput="_eventoFormState.nombre = this.value" required />
        </div>
      </div>

      <div class="form-grupo">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="ev-activo-por-fecha" ${s.activoPorFecha ? 'checked' : ''}
            onchange="_eventoFormState.activoPorFecha = this.checked" />
          Activar/desactivar automáticamente según fecha
        </label>
        <p class="form-hint">Si lo dejás sin marcar, el control es 100% manual (con el switch de la lista).</p>
      </div>

      <div class="form-fila">
        <div class="form-grupo">
          <label class="form-label">Fecha de inicio</label>
          <input type="date" id="ev-fecha-inicio" class="form-input" value="${s.fechaInicio || ''}"
            oninput="_eventoFormState.fechaInicio = this.value" />
        </div>
        <div class="form-grupo">
          <label class="form-label">Fecha de fin</label>
          <input type="date" id="ev-fecha-fin" class="form-input" value="${s.fechaFin || ''}"
            oninput="_eventoFormState.fechaFin = this.value" />
        </div>
      </div>

      <div class="form-grupo">
        <label class="form-label">Texto del modal</label>
        <textarea id="ev-texto-modal" class="form-textarea" rows="3"
          oninput="_eventoFormState.textoModal = this.value">${s.textoModal || ''}</textarea>
      </div>
      <div class="form-grupo">
        <label class="form-label">Historia (¿de qué trata?)</label>
        <textarea id="ev-historia" class="form-textarea" rows="4"
          oninput="_eventoFormState.historia = this.value">${s.historia || ''}</textarea>
      </div>

      <h4 class="panel-titulo" style="font-size:16px; margin-top:20px;">Imágenes</h4>
      <div class="form-fila" style="flex-wrap:wrap;">
        ${_CAMPOS_IMAGENES_EVENTO.map(({ campo, label }) => `
          <div class="form-grupo" style="min-width:220px;">
            <label class="form-label">${label}</label>
            ${s.imagenesActuales[campo] ? `<img src="${s.imagenesActuales[campo]}" alt="${label}" style="max-width:100px; display:block; margin-bottom:6px; border-radius:6px;" onerror="this.style.display='none'" />` : ''}
            <input type="file" id="ev-img-${campo}" class="form-input" accept="image/jpeg,image/png,image/webp" />
          </div>
        `).join('')}
      </div>
      <p class="form-hint">Dejá vacío el campo de imagen para mantener la que ya está subida.</p>

      <h4 class="panel-titulo" style="font-size:16px; margin-top:20px;">Retos — Autor</h4>
      <div id="ev-retos-autor">${_construirBloqueRetosRol('autor')}</div>
      <button type="button" class="btn-secundario btn-sm" onclick="agregarRetoAdmin('autor')">+ Agregar reto (autor)</button>

      <h4 class="panel-titulo" style="font-size:16px; margin-top:20px;">Retos — Reseñador</h4>
      <div id="ev-retos-resenador">${_construirBloqueRetosRol('resenador')}</div>
      <button type="button" class="btn-secundario btn-sm" onclick="agregarRetoAdmin('resenador')">+ Agregar reto (reseñador)</button>

      <div id="evento-error" class="mensaje-error" style="display:none; margin-top:16px;"></div>
      <div id="evento-ok" class="mensaje-ok" style="display:none;"></div>
      <div style="margin-top:16px; display:flex; gap:10px;">
        <button type="submit" class="btn-primario" id="btn-guardar-evento">${editando ? 'Guardar cambios' : 'Crear evento'}</button>
        ${editando ? `<button type="button" class="btn-secundario" onclick="cargarEventosAdmin()">Cancelar edición</button>` : ''}
      </div>
    </form>
  `;
}

function _construirBloqueRetosRol(rol) {
  const retos = _eventoFormState.retos[rol];
  if (retos.length === 0) {
    return `<p class="form-hint">Sin retos cargados para este rol.</p>`;
  }
  return retos.map((reto, idx) => `
    <div class="lista-item" style="flex-direction:column; align-items:stretch; margin-bottom:12px;">
      <div class="form-fila">
        <div class="form-grupo">
          <label class="form-label">ID del reto</label>
          <input type="text" class="form-input" value="${reto.id || ''}"
            oninput="_eventoFormState.retos['${rol}'][${idx}].id = this.value" placeholder="ej: RETO_AUT_1" />
        </div>
        <div class="form-grupo">
          <label class="form-label">Orden</label>
          <input type="number" class="form-input" value="${reto.orden ?? idx + 1}" min="1"
            oninput="_eventoFormState.retos['${rol}'][${idx}].orden = parseInt(this.value, 10)" />
        </div>
        <div class="form-grupo">
          <label class="form-label">Puntos</label>
          <input type="number" class="form-input" value="${reto.puntos ?? 0}" min="0"
            oninput="_eventoFormState.retos['${rol}'][${idx}].puntos = parseInt(this.value, 10)" />
        </div>
      </div>
      <div class="form-grupo">
        <label class="form-label">Nombre del reto</label>
        <input type="text" class="form-input" value="${reto.nombre || ''}"
          oninput="_eventoFormState.retos['${rol}'][${idx}].nombre = this.value" placeholder="ej: El encuentro" />
      </div>

      <p class="form-label" style="margin-top:8px;">Sub-retos</p>
      ${_construirBloqueSubRetos(rol, idx)}
      <div style="margin-top:6px;">
        <button type="button" class="btn-secundario btn-sm" onclick="agregarSubRetoAdmin('${rol}', ${idx})">+ Agregar sub-reto</button>
        <button type="button" class="btn-secundario btn-sm btn-peligro" onclick="quitarRetoAdmin('${rol}', ${idx})">Quitar este reto</button>
      </div>
    </div>
  `).join('');
}

function _construirBloqueSubRetos(rol, retoIdx) {
  const subRetos = _eventoFormState.retos[rol][retoIdx].subRetos || [];
  if (subRetos.length === 0) {
    return `<p class="form-hint">Sin sub-retos.</p>`;
  }
  return subRetos.map((sub, subIdx) => `
    <div class="form-fila" style="margin-bottom:6px; align-items:flex-end;">
      <div class="form-grupo">
        <label class="form-label">ID</label>
        <input type="text" class="form-input" value="${sub.id || ''}"
          oninput="_eventoFormState.retos['${rol}'][${retoIdx}].subRetos[${subIdx}].id = this.value" placeholder="ej: SUB_AUT_1_1" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Meta</label>
        <input type="number" class="form-input" value="${sub.meta ?? 1}" min="1"
          oninput="_eventoFormState.retos['${rol}'][${retoIdx}].subRetos[${subIdx}].meta = parseInt(this.value, 10)" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Acción</label>
        <input type="text" class="form-input" value="${sub.accion || ''}"
          oninput="_eventoFormState.retos['${rol}'][${retoIdx}].subRetos[${subIdx}].accion = this.value" placeholder="ej: crear_campana" />
      </div>
      <div class="form-grupo" style="flex:2;">
        <label class="form-label">Descripción</label>
        <input type="text" class="form-input" value="${sub.descripcion || ''}"
          oninput="_eventoFormState.retos['${rol}'][${retoIdx}].subRetos[${subIdx}].descripcion = this.value" placeholder="ej: Cargar una campaña de tu libro" />
      </div>
      <button type="button" class="btn-secundario btn-sm btn-peligro" onclick="quitarSubRetoAdmin('${rol}', ${retoIdx}, ${subIdx})">✕</button>
    </div>
  `).join('');
}

function agregarRetoAdmin(rol) {
  _eventoFormState.retos[rol].push({
    id: '', orden: _eventoFormState.retos[rol].length + 1, nombre: '', puntos: 0, subRetos: []
  });
  document.getElementById(`ev-retos-${rol}`).innerHTML = _construirBloqueRetosRol(rol);
}

function quitarRetoAdmin(rol, idx) {
  _eventoFormState.retos[rol].splice(idx, 1);
  document.getElementById(`ev-retos-${rol}`).innerHTML = _construirBloqueRetosRol(rol);
}

function agregarSubRetoAdmin(rol, retoIdx) {
  _eventoFormState.retos[rol][retoIdx].subRetos.push({ id: '', meta: 1, accion: '', descripcion: '' });
  document.getElementById(`ev-retos-${rol}`).innerHTML = _construirBloqueRetosRol(rol);
}

function quitarSubRetoAdmin(rol, retoIdx, subIdx) {
  _eventoFormState.retos[rol][retoIdx].subRetos.splice(subIdx, 1);
  document.getElementById(`ev-retos-${rol}`).innerHTML = _construirBloqueRetosRol(rol);
}

/**
 * Guarda (crea o edita) el evento del formulario.
 *
 * @param {Event} event
 */
async function guardarEventoAdmin(event) {
  event.preventDefault();
  ocultarMensajes('evento-error', 'evento-ok');
  toggleBoton('btn-guardar-evento', false, 'Guardando...');

  const s = _eventoFormState;
  const idEvento = (s.idOriginal || s.id || '').trim();

  if (!idEvento) {
    toggleBoton('btn-guardar-evento', true, '', s.idOriginal ? 'Guardar cambios' : 'Crear evento');
    mostrarMensajeError('evento-error', 'El ID del evento es obligatorio.');
    return;
  }

  // Subir las imágenes nuevas que se hayan elegido; conservar las existentes.
  const imagenes = { ...s.imagenesActuales };
  for (const { campo } of _CAMPOS_IMAGENES_EVENTO) {
    const archivo = document.getElementById(`ev-img-${campo}`)?.files?.[0];
    if (archivo) {
      try {
        imagenes[campo] = await subirImagen('EVENTOS', `${idEvento}/${campo}`, archivo);
      } catch (errImg) {
        toggleBoton('btn-guardar-evento', true, '', s.idOriginal ? 'Guardar cambios' : 'Crear evento');
        mostrarMensajeError('evento-error', `Error en imagen "${campo}": ${errImg.message}`);
        return;
      }
    }
  }

  const { data: resultado, error } = await supabaseClient.rpc('admin_guardar_evento', {
    p_id: idEvento,
    p_nombre: s.nombre,
    p_fecha_inicio: s.fechaInicio || null,
    p_fecha_fin: s.fechaFin || null,
    p_retos: s.retos,
    p_texto_modal: s.textoModal || null,
    p_historia: s.historia || null,
    p_imagenes: imagenes,
    p_activo_por_fecha: !!s.activoPorFecha
  });

  toggleBoton('btn-guardar-evento', true, '', s.idOriginal ? 'Guardar cambios' : 'Crear evento');

  if (error) {
    mostrarMensajeError('evento-error', error.message);
    return;
  }

  mostrarMensajeOk('evento-ok', '¡Evento guardado correctamente!');
  await refrescarListaEventos();
  setTimeout(() => cargarEventosAdmin(), 1200);
}

// ────────────────────────────────────────────────────────────
// LISTADO
// ────────────────────────────────────────────────────────────

async function refrescarListaEventos() {
  const contenedor = document.getElementById('admin-eventos-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: resultado, error } = await supabaseClient.rpc('admin_listar_eventos');

  if (error || !resultado || resultado.error) {
    contenedor.innerHTML = `<p class="mensaje-error">${resultado?.error || 'Error al cargar los eventos.'}</p>`;
    return;
  }

  _eventosAdmin = resultado.eventos || [];

  if (_eventosAdmin.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">No hay eventos cargados todavía.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <h3 class="panel-titulo" style="font-size:20px; margin-bottom:14px;">Eventos cargados</h3>
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${_eventosAdmin.map(e => _construirCardEventoAdmin(e)).join('')}
    </div>
  `;
}

function _construirCardEventoAdmin(e) {
  return `
    <div class="lista-item" style="align-items:center;">
      ${e.imagenes?.banner ? `<img src="${e.imagenes.banner}" alt="${e.nombre}" style="width:160px; height:60px; object-fit:cover; border-radius:6px; background:var(--crema); flex-shrink:0;" onerror="this.style.display='none'" />` : ''}
      <div class="lista-item-body">
        <p class="lista-item-meta" style="margin-bottom:4px;">
          <strong>${e.nombre}</strong>
          &nbsp;${e.activo ? '<span class="badge badge-activa">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}
        </p>
        <p class="lista-item-meta" style="margin:0;">ID: ${e.id} · ${e.fechaInicio || '¿?'} → ${e.fechaFin || '¿?'} ${e.activoPorFecha ? '(auto por fecha)' : '(manual)'}</p>
        <div class="lista-item-acciones">
          <button class="btn-secundario btn-sm" onclick="editarEventoAdmin('${e.id}')">Editar</button>
          <button class="btn-secundario btn-sm" onclick="activarEventoAdmin('${e.id}')" ${e.activo ? 'disabled' : ''}>Activar</button>
          <button class="btn-secundario btn-sm btn-peligro" onclick="eliminarEventoAdmin('${e.id}')" ${e.activo ? 'disabled title="Desactivalo primero"' : ''}>Eliminar</button>
        </div>
      </div>
    </div>
  `;
}

function editarEventoAdmin(idEvento) {
  const e = _eventosAdmin.find(ev => ev.id === idEvento);
  if (!e) return;

  _eventoFormState = {
    idOriginal: e.id,
    id: e.id,
    nombre: e.nombre || '',
    activoPorFecha: !!e.activoPorFecha,
    fechaInicio: e.fechaInicio || '',
    fechaFin: e.fechaFin || '',
    textoModal: e.textoModal || '',
    historia: e.historia || '',
    imagenesActuales: e.imagenes || {},
    retos: {
      autor: (e.retos?.autor || []).map(r => ({ ...r, subRetos: (r.subRetos || []).map(sr => ({ ...sr })) })),
      resenador: (e.retos?.resenador || []).map(r => ({ ...r, subRetos: (r.subRetos || []).map(sr => ({ ...sr })) }))
    }
  };
  renderizarFormEvento();
  document.getElementById('admin-eventos-form-contenedor')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Activa un evento (desactiva automáticamente cualquier otro que estuviera activo).
 *
 * @param {string} idEvento
 */
async function activarEventoAdmin(idEvento) {
  if (!confirm('¿Activar este evento? Se desactivará cualquier otro evento activo.')) return;

  const { error } = await supabaseClient.rpc('admin_activar_evento', { p_id_evento: idEvento });

  if (error) {
    mostrarToast(error.message, 'error');
    return;
  }

  mostrarToast('Evento activado.', 'ok');
  await refrescarListaEventos();
}

/**
 * Elimina un evento, con confirmación previa. Bloqueado si está activo.
 *
 * @param {string} idEvento
 */
async function eliminarEventoAdmin(idEvento) {
  if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;

  const { error } = await supabaseClient.rpc('admin_eliminar_evento', { p_id_evento: idEvento });

  if (error) {
    mostrarToast(error.message, 'error');
    return;
  }

  mostrarToast('Evento eliminado.', 'ok');
  await refrescarListaEventos();
}
