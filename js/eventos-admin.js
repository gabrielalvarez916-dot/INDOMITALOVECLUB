// ============================================================
// eventos-admin.js — Indómita Love Club
// Gestión de eventos (ej: "El Primer Beso") desde el panel admin.
// Archivo independiente: no modifica ninguna función existente.
//
// v2 (Fase 2 del rediseño de eventos):
//   - El formulario ahora se organiza en pestañas (Datos generales /
//     Retos / Imágenes básicas / Tema visual) en vez de un solo bloque
//     largo, para que sea más fácil de leer y cargar.
//   - Se agrega la sección "Tema visual" (mascota, partícula de
//     celebración, mapa con 4 nodos, secreto flotante), que se guarda
//     en la columna `tema` de la tabla eventos.
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

const _PARTICULAS_DISPONIBLES = ['confeti', 'corazones', 'nieve', 'chocolate'];

// Estado en memoria del formulario de alta/edición (fuente de verdad para retos anidados)
let _eventoFormState = null;

// Pestaña activa del formulario ('general' | 'retos' | 'imagenes' | 'tema')
let _eventoFormTabActiva = 'general';

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
    retos: { autor: [], reseñador: [] },
    tema: {
      mascota: {
        imagenActual: '',
        mensajes: [] // [{ accion: '', texto: '' }]
      },
      particula: 'confeti',
      mapa: {
        fondoActual: '',
        veloActual: '',
        nodos: [
          { x: 20, y: 70 },
          { x: 45, y: 50 },
          { x: 65, y: 65 },
          { x: 80, y: 30 }
        ]
      },
      secreto: {
        imagenActual: '',
        puntos: 5,
        frecuenciaMin: 30
      }
    }
  };
}

/**
 * Carga la sección de Eventos en el panel admin: formulario + lista.
 * Se llama al mostrar el tab "Eventos".
 */
async function cargarEventosAdmin() {
  _eventoFormState = _eventoFormVacio();
  _eventoFormTabActiva = 'general';
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

      ${_construirTabsNav()}

      <div id="panel-tab-general" style="display:${_eventoFormTabActiva === 'general' ? 'block' : 'none'};">
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
      </div>

      <div id="panel-tab-retos" style="display:${_eventoFormTabActiva === 'retos' ? 'block' : 'none'};">
        <h4 class="panel-titulo" style="font-size:16px;">Retos — Autor</h4>
        <div id="ev-retos-autor">${_construirBloqueRetosRol('autor')}</div>
        <button type="button" class="btn-secundario btn-sm" onclick="agregarRetoAdmin('autor')">+ Agregar reto (autor)</button>

        <h4 class="panel-titulo" style="font-size:16px; margin-top:20px;">Retos — Reseñador</h4>
        <div id="ev-retos-reseñador">${_construirBloqueRetosRol('reseñador')}</div>
        <button type="button" class="btn-secundario btn-sm" onclick="agregarRetoAdmin('reseñador')">+ Agregar reto (reseñador)</button>
      </div>

      <div id="panel-tab-imagenes" style="display:${_eventoFormTabActiva === 'imagenes' ? 'block' : 'none'};">
        <h4 class="panel-titulo" style="font-size:16px;">Imágenes</h4>
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
      </div>

      <div id="panel-tab-tema" style="display:${_eventoFormTabActiva === 'tema' ? 'block' : 'none'};">
        ${_construirSeccionTema()}
      </div>

      <div id="evento-error" class="mensaje-error" style="display:none; margin-top:16px;"></div>
      <div id="evento-ok" class="mensaje-ok" style="display:none;"></div>
      <div style="margin-top:16px; display:flex; gap:10px;">
        <button type="submit" class="btn-primario" id="btn-guardar-evento">${editando ? 'Guardar cambios' : 'Crear evento'}</button>
        ${editando ? `<button type="button" class="btn-secundario" onclick="cargarEventosAdmin()">Cancelar edición</button>` : ''}
      </div>
    </form>
  `;
}

// ────────────────────────────────────────────────────────────
// PESTAÑAS
// ────────────────────────────────────────────────────────────

function _construirTabsNav() {
  const tabs = [
    { id: 'general', label: 'Datos generales' },
    { id: 'retos', label: 'Retos' },
    { id: 'imagenes', label: 'Imágenes básicas' },
    { id: 'tema', label: 'Tema visual' }
  ];
  return `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; border-bottom:1px solid #e5d5d0; padding-bottom:10px;">
      ${tabs.map(tab => `
        <button type="button" id="tab-btn-${tab.id}" class="btn-secundario btn-sm"
          style="${_eventoFormTabActiva === tab.id ? 'background:#e05a8a; color:#fff; border-color:#e05a8a;' : ''}"
          onclick="cambiarTabEventoAdmin('${tab.id}')">${tab.label}</button>
      `).join('')}
    </div>
  `;
}

/**
 * Cambia la pestaña activa del formulario sin reconstruir el HTML
 * (solo muestra/oculta paneles), para no perder archivos ya elegidos
 * en los <input type="file"> de otras pestañas.
 */
function cambiarTabEventoAdmin(tab) {
  _eventoFormTabActiva = tab;
  ['general', 'retos', 'imagenes', 'tema'].forEach(t => {
    const panel = document.getElementById(`panel-tab-${t}`);
    const boton = document.getElementById(`tab-btn-${t}`);
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
    if (boton) {
      boton.style.background = (t === tab) ? '#e05a8a' : '';
      boton.style.color = (t === tab) ? '#fff' : '';
      boton.style.borderColor = (t === tab) ? '#e05a8a' : '';
    }
  });
}

// ────────────────────────────────────────────────────────────
// RETOS (sin cambios de comportamiento respecto a la versión anterior)
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// TEMA VISUAL (nuevo — Fase 2)
// ────────────────────────────────────────────────────────────

function _construirSeccionTema() {
  const t = _eventoFormState.tema;

  return `
    <h4 class="panel-titulo" style="font-size:16px;">Partícula de celebración</h4>
    <div class="form-grupo">
      <select id="ev-tema-particula" class="form-input" onchange="_eventoFormState.tema.particula = this.value">
        ${_PARTICULAS_DISPONIBLES.map(p => `<option value="${p}" ${t.particula === p ? 'selected' : ''}>${_capitalizarAdmin(p)}</option>`).join('')}
      </select>
      <p class="form-hint">Se dispara en pantalla cada vez que el usuario completa un reto.</p>
    </div>

    <h4 class="panel-titulo" style="font-size:16px; margin-top:22px;">Mascota</h4>
    <div class="form-fila" style="flex-wrap:wrap;">
      <div class="form-grupo" style="min-width:220px;">
        <label class="form-label">Imagen de la mascota</label>
        ${t.mascota.imagenActual ? `<img src="${t.mascota.imagenActual}" alt="Mascota" style="max-width:100px; display:block; margin-bottom:6px; border-radius:6px;" onerror="this.style.display='none'" />` : ''}
        <input type="file" id="ev-tema-mascota-img" class="form-input" accept="image/jpeg,image/png,image/webp" />
      </div>
    </div>
    <p class="form-label" style="margin-top:8px;">Mensajes de la mascota</p>
    <p class="form-hint">Usá el mismo texto que pusiste en "Acción" en algún sub-reto (pestaña Retos) para que la mascota hable justo cuando el usuario haga eso. Ej: acción <code>postular_campana</code> → mensaje "¡Te postulaste a una campaña!".</p>
    <div id="ev-tema-mascota-mensajes">${_construirBloqueMensajesMascota()}</div>
    <button type="button" class="btn-secundario btn-sm" onclick="agregarMensajeMascotaAdmin()">+ Agregar mensaje</button>

    <h4 class="panel-titulo" style="font-size:16px; margin-top:22px;">Mapa de retos</h4>
    <div class="form-fila" style="flex-wrap:wrap;">
      <div class="form-grupo" style="min-width:220px;">
        <label class="form-label">Fondo del mapa</label>
        ${t.mapa.fondoActual ? `<img src="${t.mapa.fondoActual}" alt="Fondo del mapa" style="max-width:140px; display:block; margin-bottom:6px; border-radius:6px;" onerror="this.style.display='none'" />` : ''}
        <input type="file" id="ev-tema-mapa-fondo" class="form-input" accept="image/jpeg,image/png,image/webp" />
      </div>
      <div class="form-grupo" style="min-width:220px;">
        <label class="form-label">Velo (zonas no alcanzadas)</label>
        ${t.mapa.veloActual ? `<img src="${t.mapa.veloActual}" alt="Velo del mapa" style="max-width:140px; display:block; margin-bottom:6px; border-radius:6px;" onerror="this.style.display='none'" />` : ''}
        <input type="file" id="ev-tema-mapa-velo" class="form-input" accept="image/jpeg,image/png,image/webp" />
      </div>
    </div>

    <p class="form-label" style="margin-top:14px;">Posición de los 4 nodos (% sobre el fondo)</p>
    <div style="position:relative; width:100%; max-width:420px; aspect-ratio:16/10; background:#f4e9e4; border-radius:8px; overflow:hidden; margin-bottom:10px;">
      ${t.mapa.fondoActual ? `<img src="${t.mapa.fondoActual}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;" onerror="this.style.display='none'" />` : `<p class="form-hint" style="padding:10px;">Subí un fondo para previsualizar los nodos aquí.</p>`}
      ${t.mapa.nodos.map((n, i) => `
        <div id="mapa-nodo-marker-${i}" style="position:absolute; left:${n.x}%; top:${n.y}%; width:22px; height:22px; margin:-11px; border-radius:50%; background:#e05a8a; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border:2px solid white;">${i + 1}</div>
      `).join('')}
    </div>
    <div class="form-fila" style="flex-wrap:wrap;">
      ${t.mapa.nodos.map((n, i) => `
        <div class="form-grupo" style="min-width:160px;">
          <label class="form-label">Nodo ${i + 1} — X / Y (%)</label>
          <div style="display:flex; gap:6px;">
            <input type="number" min="0" max="100" class="form-input" value="${n.x}"
              oninput="_actualizarNodoMapaAdmin(${i}, 'x', this.value)" />
            <input type="number" min="0" max="100" class="form-input" value="${n.y}"
              oninput="_actualizarNodoMapaAdmin(${i}, 'y', this.value)" />
          </div>
        </div>
      `).join('')}
    </div>

    <h4 class="panel-titulo" style="font-size:16px; margin-top:22px;">Secreto flotante</h4>
    <div class="form-fila" style="flex-wrap:wrap; align-items:flex-end;">
      <div class="form-grupo" style="min-width:220px;">
        <label class="form-label">Imagen del secreto</label>
        ${t.secreto.imagenActual ? `<img src="${t.secreto.imagenActual}" alt="Secreto" style="max-width:100px; display:block; margin-bottom:6px; border-radius:6px;" onerror="this.style.display='none'" />` : ''}
        <input type="file" id="ev-tema-secreto-img" class="form-input" accept="image/jpeg,image/png,image/webp" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Puntos al encontrarlo</label>
        <input type="number" min="0" class="form-input" value="${t.secreto.puntos}"
          oninput="_eventoFormState.tema.secreto.puntos = parseInt(this.value, 10) || 0" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Frecuencia aprox. (minutos)</label>
        <input type="number" min="1" class="form-input" value="${t.secreto.frecuenciaMin}"
          oninput="_eventoFormState.tema.secreto.frecuenciaMin = parseInt(this.value, 10) || 30" />
      </div>
    </div>
  `;
}

function _construirBloqueMensajesMascota() {
  const mensajes = _eventoFormState.tema.mascota.mensajes;
  if (mensajes.length === 0) {
    return `<p class="form-hint">Sin mensajes cargados.</p>`;
  }
  return mensajes.map((m, idx) => `
    <div class="form-fila" style="margin-bottom:6px; align-items:flex-end;">
      <div class="form-grupo">
        <label class="form-label">Acción</label>
        <input type="text" class="form-input" value="${m.accion || ''}"
          oninput="_eventoFormState.tema.mascota.mensajes[${idx}].accion = this.value" placeholder="ej: postular_campana" />
      </div>
      <div class="form-grupo" style="flex:2;">
        <label class="form-label">Mensaje</label>
        <input type="text" class="form-input" value="${m.texto || ''}"
          oninput="_eventoFormState.tema.mascota.mensajes[${idx}].texto = this.value" placeholder="ej: ¡Te postulaste a una campaña!" />
      </div>
      <button type="button" class="btn-secundario btn-sm btn-peligro" onclick="quitarMensajeMascotaAdmin(${idx})">✕</button>
    </div>
  `).join('');
}

function agregarMensajeMascotaAdmin() {
  _eventoFormState.tema.mascota.mensajes.push({ accion: '', texto: '' });
  document.getElementById('ev-tema-mascota-mensajes').innerHTML = _construirBloqueMensajesMascota();
}

function quitarMensajeMascotaAdmin(idx) {
  _eventoFormState.tema.mascota.mensajes.splice(idx, 1);
  document.getElementById('ev-tema-mascota-mensajes').innerHTML = _construirBloqueMensajesMascota();
}

/**
 * Actualiza la posición (x o y, en %) de un nodo del mapa, tanto en el
 * estado como en el marcador visual de la vista previa (sin re-renderizar
 * todo el formulario, para no perder archivos ya elegidos).
 */
function _actualizarNodoMapaAdmin(idx, eje, valor) {
  const num = Math.max(0, Math.min(100, parseInt(valor, 10) || 0));
  _eventoFormState.tema.mapa.nodos[idx][eje] = num;
  const marcador = document.getElementById(`mapa-nodo-marker-${idx}`);
  if (marcador) marcador.style[eje === 'x' ? 'left' : 'top'] = `${num}%`;
}

function _capitalizarAdmin(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convierte el jsonb `tema` tal como viene de admin_listar_eventos
 * (puede venir vacío `{}` en eventos viejos) al formato que usa el
 * estado del formulario.
 */
function _normalizarTemaCargado(temaCrudo) {
  const base = _eventoFormVacio().tema;
  if (!temaCrudo || typeof temaCrudo !== 'object') return base;

  const nodosCrudos = temaCrudo.mapa?.nodos;
  const nodosValidos = Array.isArray(nodosCrudos) && nodosCrudos.length === 4
    ? nodosCrudos.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 }))
    : base.mapa.nodos;

  return {
    mascota: {
      imagenActual: temaCrudo.mascota?.imagen || '',
      mensajes: Object.entries(temaCrudo.mascota?.mensajes || {}).map(([accion, texto]) => ({ accion, texto }))
    },
    particula: temaCrudo.particula || base.particula,
    mapa: {
      fondoActual: temaCrudo.mapa?.fondo || '',
      veloActual: temaCrudo.mapa?.velo || '',
      nodos: nodosValidos
    },
    secreto: {
      imagenActual: temaCrudo.secreto?.imagen || '',
      puntos: temaCrudo.secreto?.puntos ?? base.secreto.puntos,
      frecuenciaMin: temaCrudo.secreto?.frecuenciaMin ?? base.secreto.frecuenciaMin
    }
  };
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
  const textoBoton = s.idOriginal ? 'Guardar cambios' : 'Crear evento';

  if (!idEvento) {
    toggleBoton('btn-guardar-evento', true, '', textoBoton);
    mostrarMensajeError('evento-error', 'El ID del evento es obligatorio.');
    return;
  }

  // Imágenes básicas (banner, fondo, ícono, insignias, decoración modal).
  const imagenes = { ...s.imagenesActuales };
  for (const { campo } of _CAMPOS_IMAGENES_EVENTO) {
    const archivo = document.getElementById(`ev-img-${campo}`)?.files?.[0];
    if (archivo) {
      try {
        imagenes[campo] = await subirImagen('EVENTOS', `${idEvento}/${campo}`, archivo);
      } catch (errImg) {
        toggleBoton('btn-guardar-evento', true, '', textoBoton);
        mostrarMensajeError('evento-error', `Error en imagen "${campo}": ${errImg.message}`);
        return;
      }
    }
  }

  // Imágenes del tema visual (mascota, fondo/velo del mapa, secreto).
  let imagenMascota = s.tema.mascota.imagenActual;
  let imagenMapaFondo = s.tema.mapa.fondoActual;
  let imagenMapaVelo = s.tema.mapa.veloActual;
  let imagenSecreto = s.tema.secreto.imagenActual;

  const subidasTema = [
    { inputId: 'ev-tema-mascota-img', path: 'tema/mascota', asignar: (url) => (imagenMascota = url) },
    { inputId: 'ev-tema-mapa-fondo', path: 'tema/mapaFondo', asignar: (url) => (imagenMapaFondo = url) },
    { inputId: 'ev-tema-mapa-velo', path: 'tema/mapaVelo', asignar: (url) => (imagenMapaVelo = url) },
    { inputId: 'ev-tema-secreto-img', path: 'tema/secreto', asignar: (url) => (imagenSecreto = url) }
  ];

  for (const { inputId, path, asignar } of subidasTema) {
    const archivo = document.getElementById(inputId)?.files?.[0];
    if (archivo) {
      try {
        asignar(await subirImagen('EVENTOS', `${idEvento}/${path}`, archivo));
      } catch (errImg) {
        toggleBoton('btn-guardar-evento', true, '', textoBoton);
        mostrarMensajeError('evento-error', `Error en imagen de tema "${path}": ${errImg.message}`);
        return;
      }
    }
  }

  const tema = {
    mascota: {
      imagen: imagenMascota || '',
      mensajes: (s.tema.mascota.mensajes || [])
        .filter(m => m.accion && m.accion.trim())
        .reduce((acc, m) => { acc[m.accion.trim()] = m.texto || ''; return acc; }, {})
    },
    particula: s.tema.particula || 'confeti',
    mapa: {
      fondo: imagenMapaFondo || '',
      velo: imagenMapaVelo || '',
      nodos: s.tema.mapa.nodos
    },
    secreto: {
      imagen: imagenSecreto || '',
      puntos: s.tema.secreto.puntos || 0,
      frecuenciaMin: s.tema.secreto.frecuenciaMin || 30
    }
  };

  const { data: resultado, error } = await supabaseClient.rpc('admin_guardar_evento', {
    p_id: idEvento,
    p_nombre: s.nombre,
    p_fecha_inicio: s.fechaInicio || null,
    p_fecha_fin: s.fechaFin || null,
    p_retos: s.retos,
    p_texto_modal: s.textoModal || null,
    p_historia: s.historia || null,
    p_imagenes: imagenes,
    p_activo_por_fecha: !!s.activoPorFecha,
    p_tema: tema
  });

  toggleBoton('btn-guardar-evento', true, '', textoBoton);

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

  _eventoFormTabActiva = 'general';
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
      reseñador: (e.retos?.reseñador || []).map(r => ({ ...r, subRetos: (r.subRetos || []).map(sr => ({ ...sr })) }))
    },
    tema: _normalizarTemaCargado(e.tema)
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
