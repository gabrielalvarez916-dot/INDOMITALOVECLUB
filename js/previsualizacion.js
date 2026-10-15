// ============================================================
// previsualizacion.js — Indómita Love Club
// Previsualización de archivos (EPUB/PDF) y de portada para el autor, en
// "Nueva campaña" y "Editar campaña". Réplica de lo que ya existe en la
// app mobile (VisorModal en modo previsualización + PortadaPreviewModal).
//
// - EPUB/PDF recién elegidos (todavía sin subir): se leen directo del input
//   con el mismo visor que usan las reseñadoras (visor.js), sin pedir nada
//   al backend, sin guardar progreso ni resaltados.
// - EPUB/PDF ya subidos (solo en Editar): "Ver el actual", con la URL firmada
//   de obtener-url-libro (esa función ya autoriza al autor de la campaña).
// - Portada: la portada en grande (sombra y lomo) y debajo en miniatura,
//   como la ven las reseñadoras en el feed.
//
// Depende de visor.js (crearModalVisor, configurarModalVisor, inicializarEpub,
// inicializarPdf, obtenerUrlLibro, mostrarErrorVisor, cargarLibreria*).
// ============================================================

var _prevArchivosActuales = { idCampana: null, epub: false, pdf: false };
var _prevUrlPortadaLocal = {}; // prefijo ('nc' | 'ec') -> object URL vigente, para liberarlo al cambiar

// ────────────────────────────────────────────────────────────
// VISOR EN MODO PREVISUALIZACIÓN
// ────────────────────────────────────────────────────────────

async function prevAbrirVisor({ formato, titulo, archivo, idCampana }) {
  if (formato !== 'epub' && formato !== 'pdf') return;

  crearModalVisor();

  // Modo previsualización: sin postulación, sin campaña, sin clave de
  // posición guardada y sin resaltados → visor.js no escribe nada.
  _visorModoPrevisualizacion = true;
  _visorIdPostulacion = null;
  _visorIdCampana = null;
  _visorFormatoActual = formato;
  _visorClaveLS = null;
  _resaltandoActivo = false;
  _visorResaltados = [];

  configurarModalVisor('👁 Previsualización: ' + (titulo || (archivo && archivo.name) || ''), formato);

  ['visor-btn-resaltar', 'visor-btn-lista-resaltados'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = 'none';
  });

  const modalVisor = document.getElementById('modal-visor');
  if (modalVisor) modalVisor.classList.add('modal--anidado'); // por encima del formulario
  mostrarModal('modal-visor');

  const cargaLibrerias = formato === 'pdf'
    ? cargarLibreriaPdf()
    : cargarLibreriaJszip().then(cargarLibreriaEpub);

  let fuente;
  try {
    if (archivo) {
      const [buffer] = await Promise.all([archivo.arrayBuffer(), cargaLibrerias]);
      fuente = buffer;
    } else {
      const [url] = await Promise.all([obtenerUrlLibro(idCampana, formato), cargaLibrerias]);
      if (!url) return; // obtenerUrlLibro ya mostró el error en el visor
      fuente = url;
    }
  } catch (e) {
    console.error('Error preparando la previsualización:', e);
    mostrarErrorVisor('No se pudo abrir el archivo para previsualizarlo. Probá elegirlo de nuevo.');
    return;
  }

  if (!_visorModoPrevisualizacion) return; // lo cerraron mientras cargaba

  if (formato === 'pdf') await inicializarPdf(fuente);
  else await inicializarEpub(fuente);
}

function prevCerrarVisor() {
  if (_visorEpub) { try { _visorEpub.destroy(); } catch (e) {} _visorEpub = null; }
  if (_visorPdf)  { try { _visorPdf.destroy();  } catch (e) {} _visorPdf  = null; }
  _pdfPaginaActual = 1;
  _pdfTotalPaginas = 0;
  _visorFormatoActual = null;
  _resaltandoActivo = false;
  _visorResaltados = [];
  _epubContenidosActivos = [];
  _epubRendicionActual = null;
  _visorModoPrevisualizacion = false;

  const canvas  = document.getElementById('visor-canvas');
  const epubDiv = document.getElementById('visor-epub');
  if (canvas)  { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  if (epubDiv) epubDiv.innerHTML = '';

  // El overlay es compartido con el formulario que quedó abierto atrás:
  // se le saca el fondo del visor para que vuelva a verse como siempre.
  const overlay = document.getElementById('modal-overlay');
  if (overlay) TEMAS_VISOR.forEach((t) => overlay.classList.remove('visor-tema-' + t));

  ['visor-btn-resaltar', 'visor-btn-lista-resaltados'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = '';
  });

  const modalVisor = document.getElementById('modal-visor');
  if (modalVisor) {
    modalVisor.classList.remove('activo');
    modalVisor.classList.remove('modal--anidado');
  }
}

// Lo llama cerrarModales() (ui.js) antes de cerrar nada: si hay una
// previsualización abierta, se cierra SOLO ella y el formulario queda como
// estaba (✕, clic afuera y Escape pasan todos por ahí).
function cerrarPrevisualizacionSiHay() {
  const modalPortada = document.getElementById('modal-portada-preview');
  if (modalPortada && modalPortada.classList.contains('activo')) {
    modalPortada.classList.remove('activo');
    return true;
  }
  if (typeof _visorModoPrevisualizacion !== 'undefined' && _visorModoPrevisualizacion) {
    prevCerrarVisor();
    return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────────
// PORTADA
// ────────────────────────────────────────────────────────────

function crearModalPortadaPreview() {
  if (document.getElementById('modal-portada-preview')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-portada-preview" class="modal modal--anidado">
      <div class="modal-header">
        <h3 class="modal-titulo">Previsualización de portada</h3>
        <button class="modal-cerrar" onclick="cerrarModales()">✕</button>
      </div>
      <div class="prev-portada-body">
        <div class="prev-portada-libro">
          <img id="prev-portada-grande" alt="Portada" />
          <span class="prev-portada-lomo"></span>
        </div>
        <p id="prev-portada-titulo" class="prev-portada-titulo"></p>
        <p class="prev-portada-seccion">Así se ve chiquita, como en el feed</p>
        <div class="prev-portada-minis">
          <img id="prev-portada-mini" class="prev-portada-mini" alt="Portada en miniatura" />
          <img id="prev-portada-mini-chico" class="prev-portada-mini-chico" alt="Portada en miniatura chica" />
        </div>
        <p class="prev-portada-ayuda">Si el título o el nombre del autor no se leen en la miniatura, conviene ajustar la portada: es lo primero que ven las reseñadoras al elegir.</p>
      </div>
    </div>
  `);
}

function prevAbrirPortada(src, titulo) {
  if (!src) return;
  crearModalPortadaPreview();
  ['prev-portada-grande', 'prev-portada-mini', 'prev-portada-mini-chico'].forEach((id) => {
    const img = document.getElementById(id);
    if (img) img.src = src;
  });
  const tituloEl = document.getElementById('prev-portada-titulo');
  if (tituloEl) tituloEl.textContent = titulo || '';
  mostrarModal('modal-portada-preview');
}

// Muestra la portada recién elegida (todavía sin subir) como miniatura del
// formulario; si se vacía el input, vuelve a la portada que había antes.
function prevRenderMiniaturaPortada(prefijo, archivo) {
  const contenedor = document.getElementById(prefijo + '-portada-preview');
  if (!contenedor) return;

  if (_prevUrlPortadaLocal[prefijo]) {
    URL.revokeObjectURL(_prevUrlPortadaLocal[prefijo]);
    _prevUrlPortadaLocal[prefijo] = null;
  }

  let src = '';
  if (archivo) {
    src = URL.createObjectURL(archivo);
    _prevUrlPortadaLocal[prefijo] = src;
  } else if (prefijo === 'nc') {
    src = (typeof _portadaPrecargadaCampana !== 'undefined' && _portadaPrecargadaCampana) || '';
  } else {
    src = contenedor.dataset.srcOriginal || '';
  }

  contenedor.innerHTML = '';
  if (src) {
    const img = document.createElement('img');
    img.className = 'prev-portada-miniatura';
    img.alt = 'Portada';
    img.src = src;
    contenedor.appendChild(img);
  }
}

function prevTituloLibro(prefijo) {
  const id = prefijo === 'nc' ? 'nc-nombre-libro' : 'ec-nombre-libro';
  return (document.getElementById(id) || {}).value || '';
}

// ────────────────────────────────────────────────────────────
// BOTONES DE ARCHIVOS
// ────────────────────────────────────────────────────────────

// Nueva campaña: el botón aparece solo cuando hay un archivo elegido.
function prevRefrescarBotonesNueva() {
  [['epub', 'nc-archivo-epub'], ['pdf', 'nc-archivo-pdf']].forEach(([formato, idInput]) => {
    const btn = document.getElementById('nc-btn-prev-' + formato);
    if (!btn) return;
    const hayArchivo = !!document.getElementById(idInput)?.files?.[0];
    btn.hidden = !hayArchivo;
  });
}

function prevArchivoNueva(formato) {
  const archivo = document.getElementById('nc-archivo-' + formato)?.files?.[0];
  if (!archivo) return;
  prevAbrirVisor({ formato, titulo: prevTituloLibro('nc'), archivo });
}

// Editar campaña: archivo nuevo elegido → "Previsualizar"; si no, y ya hay
// uno subido → "Ver el actual"; si no hay ninguno, el botón no aparece.
function prevRefrescarBotonesEditar() {
  [['epub', 'ec-archivo-epub', 'EPUB'], ['pdf', 'ec-archivo-pdf', 'PDF']].forEach(([formato, idInput, nombre]) => {
    const btn = document.getElementById('ec-btn-prev-' + formato);
    if (!btn) return;
    const hayArchivoNuevo = !!document.getElementById(idInput)?.files?.[0];
    const hayActual = !!_prevArchivosActuales[formato];
    if (hayArchivoNuevo) {
      btn.dataset.modo = 'nuevo';
      btn.textContent = '👁 Previsualizar ' + nombre;
      btn.hidden = false;
    } else if (hayActual) {
      btn.dataset.modo = 'actual';
      btn.textContent = '👁 Ver el ' + nombre + ' actual';
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  });
}

function prevArchivoEditar(formato) {
  const btn = document.getElementById('ec-btn-prev-' + formato);
  if (!btn) return;
  const titulo = prevTituloLibro('ec');
  if (btn.dataset.modo === 'actual') {
    prevAbrirVisor({ formato, titulo, idCampana: _prevArchivosActuales.idCampana });
    return;
  }
  const archivo = document.getElementById('ec-archivo-' + formato)?.files?.[0];
  if (archivo) prevAbrirVisor({ formato, titulo, archivo });
}

// Se llama al final de abrirEditarCampana (autor.js).
async function prevInicializarEditar(idCampana) {
  _prevArchivosActuales = { idCampana: idCampana, epub: false, pdf: false };
  prevRefrescarBotonesEditar();
  try {
    const { data } = await supabaseClient
      .from('campanas_archivos')
      .select('link_epub, link_pdf')
      .eq('id_campana', idCampana)
      .maybeSingle();
    if (_prevArchivosActuales.idCampana !== idCampana) return; // se abrió otra campaña mientras tanto
    _prevArchivosActuales.epub = !!data?.link_epub;
    _prevArchivosActuales.pdf  = !!data?.link_pdf;
  } catch (e) {
    console.error('Error consultando archivos actuales de la campaña:', e);
  }
  prevRefrescarBotonesEditar();
}

// ────────────────────────────────────────────────────────────
// EVENTOS (delegados: el formulario de Editar se arma dinámicamente)
// ────────────────────────────────────────────────────────────

document.addEventListener('change', (e) => {
  const id = e.target && e.target.id;
  if (id === 'nc-archivo-epub' || id === 'nc-archivo-pdf') prevRefrescarBotonesNueva();
  else if (id === 'ec-archivo-epub' || id === 'ec-archivo-pdf') prevRefrescarBotonesEditar();
  else if (id === 'nc-link-portada') prevRenderMiniaturaPortada('nc', e.target.files && e.target.files[0]);
  else if (id === 'ec-link-portada') prevRenderMiniaturaPortada('ec', e.target.files && e.target.files[0]);
});

// reset() no dispara "change": después de limpiar el formulario de Nueva
// campaña se vuelven a esconder los botones y se limpia la miniatura local.
document.addEventListener('reset', (e) => {
  if (!e.target || e.target.id !== 'form-nueva-campana') return;
  setTimeout(() => {
    prevRefrescarBotonesNueva();
    if (_prevUrlPortadaLocal.nc) {
      URL.revokeObjectURL(_prevUrlPortadaLocal.nc);
      _prevUrlPortadaLocal.nc = null;
      const contenedor = document.getElementById('nc-portada-preview');
      if (contenedor) contenedor.innerHTML = '';
    }
  }, 0);
});

document.addEventListener('click', (e) => {
  const img = e.target && e.target.closest ? e.target.closest('#nc-portada-preview img, #ec-portada-preview img') : null;
  if (!img) return;
  const prefijo = img.closest('#nc-portada-preview') ? 'nc' : 'ec';
  prevAbrirPortada(img.src, prevTituloLibro(prefijo));
});
