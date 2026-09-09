// ============================================================
// visor.js — Indómita Love Club
// Visor de EPUB con Epub.js y PDF con PDF.js
// Usa el proxy /api/drive para evitar CORS con Google Drive
// ============================================================


// ────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ────────────────────────────────────────────────────────────

var VISOR_CONFIG = {
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  pdfLib:    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  epubLib: 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js',
  jszipLib: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
};

// Estado global del visor
var _visorPdf  = null;
var _visorEpub = null;
var _pdfPaginaActual = 1;
var _pdfTotalPaginas = 0;
var _visorIdPostulacion = null; // para el tracker automático de seguimiento de lectura
var _timeoutProgresoLectura = null;
var _visorClaveLS = null; // clave de localStorage para recordar en qué página/posición se quedó
var _visorIdCampana = null;
var _visorFormatoActual = null;
var _resaltandoActivo = false;
var _visorResaltados = []; // resaltados guardados de esta campaña/formato

function _visorObtenerClaveLS(idCampana, formato) {
  return 'indomita_visor_pos_' + formato + '_' + idCampana;
}


// ────────────────────────────────────────────────────────────
// TRACKER AUTOMÁTICO DE PROGRESO DE LECTURA
// (para el panel "Seguimiento de reseñadores" del autor — ver
// progreso_lectura / actualizar_progreso_lectura_auto en Supabase)
// ────────────────────────────────────────────────────────────

function avisarProgresoLecturaAuto(posicionActual, posicionTotal, formato, posicionDetalle) {
  if (!_visorIdPostulacion) return; // se abrió el visor sin postulación asociada
  if (_timeoutProgresoLectura) clearTimeout(_timeoutProgresoLectura);
  _timeoutProgresoLectura = setTimeout(async () => {
    try {
      await supabaseClient.rpc('actualizar_progreso_lectura_auto', {
        p_id_postulacion: _visorIdPostulacion,
        p_posicion_actual: posicionActual ?? null,
        p_posicion_total: posicionTotal ?? null,
        p_formato: formato ?? null,
        p_posicion_detalle: posicionDetalle != null ? String(posicionDetalle) : null,
      });
    } catch (e) {
      // silencioso: no debe interrumpir la lectura si falla la red
      console.error('Error mandando progreso de lectura:', e);
    }
  }, 400);
}

// Trae la última posición guardada en Supabase para esta postulación (viaja entre dispositivos)
async function obtenerProgresoLecturaGuardado(idPostulacion, formatoEsperado) {
  if (!idPostulacion) return null;
  try {
    const { data, error } = await supabaseClient
      .from('progreso_lectura')
      .select('formato, posicion_detalle')
      .eq('id_postulacion', idPostulacion)
      .maybeSingle();
    if (error || !data) return null;
    if (formatoEsperado && data.formato && data.formato !== formatoEsperado) return null;
    return data.posicion_detalle || null;
  } catch (e) {
    console.error('Error leyendo progreso de lectura guardado:', e);
    return null;
  }
}


// ────────────────────────────────────────────────────────────
// EXTRAER ID DE DRIVE
// ────────────────────────────────────────────────────────────

async function obtenerUrlLibro(idCampana, formato) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      mostrarErrorVisor('Tu sesión expiró. Volvé a iniciar sesión y probá de nuevo.');
      return null;
    }

    const { data, error } = await supabaseClient.functions.invoke('obtener-url-libro', {
      body: { id_campana: idCampana, formato }
    });

    if (error || !data?.url) {
      mostrarErrorVisor((data && data.error) || 'No se pudo generar el link de lectura.');
      return null;
    }
    return data.url;
  } catch (e) {
    console.error('Error obteniendo URL del libro:', e);
    mostrarErrorVisor('No se pudo generar el link de lectura.');
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// DESCARGAR LIBRO (modalidad descarga)
// ────────────────────────────────────────────────────────────
async function descargarLibro(idCampana, tituloLibro, formato) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) { mostrarToast('💅 Tu sesión decidió tomarse un descanso. Iniciá sesión de nuevo.', 'error'); return; }

    const { data, error } = await supabaseClient.functions.invoke('obtener-url-libro', {
      body: { id_campana: idCampana, formato, modo: 'descarga' }
    });

    if (error || !data?.url) {
      mostrarToast((data && data.error) || '🫣 Tenemos el libro. Nos falta que el link coopere.', 'error');
      return;
    }

    const a = document.createElement('a');
    a.href = data.url;
    a.download = `${tituloLibro}.${formato}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('Error descargando el libro:', e);
    mostrarToast('🫣 Tenemos el libro. Nos falta que el link coopere.', 'error');
  }
}

// ────────────────────────────────────────────────────────────
// RESALTADOS DE LECTURA (resaltados_lectura en Supabase)
// ────────────────────────────────────────────────────────────

async function _resaltadosCargar(idCampana, formato) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { _visorResaltados = []; return; }
    const { data, error } = await supabaseClient
      .from('resaltados_lectura')
      .select('id, cita, color, ubicacion, creado_en')
      .eq('id_campana', idCampana)
      .eq('formato', formato)
      .eq('id_usuario', session.user.id)
      .order('creado_en', { ascending: true });
    _visorResaltados = (!error && data) ? data : [];
  } catch (e) {
    console.error('Error cargando resaltados:', e);
    _visorResaltados = [];
  }
  _resaltadosRenderizarLista();
}

async function _resaltadosGuardar(cita, ubicacion, color) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { mostrarToast('Tu sesión expiró. Volvé a iniciar sesión.', 'error'); return; }
    const fila = {
      id_usuario: session.user.id,
      id_campana: _visorIdCampana,
      formato: _visorFormatoActual,
      cita: String(cita).slice(0, 2000),
      color: color || 'amarillo',
      ubicacion: ubicacion || {},
    };
    const { data, error } = await supabaseClient.from('resaltados_lectura').insert(fila).select().single();
    if (error) { mostrarToast('No se pudo guardar el resaltado.', 'error'); return; }
    _visorResaltados.push(data);
    _resaltadosRenderizarLista();
    if (_visorFormatoActual === 'epub') _resaltadosPintarEpub();
    else if (_visorFormatoActual === 'pdf') _pdfPintarResaltados(_pdfPaginaActual);
    mostrarToast('✨ Frase resaltada', 'exito');
  } catch (e) {
    console.error('Error guardando resaltado:', e);
    mostrarToast('No se pudo guardar el resaltado.', 'error');
  }
}

async function eliminarResaltado(idResaltado) {
  try {
    const { error } = await supabaseClient.from('resaltados_lectura').delete().eq('id', idResaltado);
    if (error) { mostrarToast('No se pudo eliminar el resaltado.', 'error'); return; }
    const eliminado = _visorResaltados.find(r => r.id === idResaltado);
    // Se remueve la anotación puntual ANTES de sacarlo del array: una vez
    // filtrado, _resaltadosPintarEpub() ya no vuelve a iterarlo, así que
    // nunca le llamaría remove() a este cfi en particular y la marca
    // quedaba pintada para siempre aunque el resaltado ya no existiera.
    if (_visorFormatoActual === 'epub' && _visorEpub && _epubRendicionActual && eliminado?.ubicacion?.cfi) {
      try { _epubRendicionActual.annotations.remove(eliminado.ubicacion.cfi, 'highlight'); } catch (e) {}
    }
    _visorResaltados = _visorResaltados.filter(r => r.id !== idResaltado);
    _resaltadosRenderizarLista();
    if (_visorFormatoActual === 'epub' && _visorEpub) _resaltadosPintarEpub();
    else if (_visorFormatoActual === 'pdf' && _visorPdf) await renderizarPaginaPdf(_pdfPaginaActual);
  } catch (e) {
    console.error('Error eliminando resaltado:', e);
  }
}

function toggleModoResaltar() {
  _resaltandoActivo = !_resaltandoActivo;
  const btn = document.getElementById('visor-btn-resaltar');
  if (btn) btn.classList.toggle('activo', _resaltandoActivo);
  const contenido = document.getElementById('visor-contenido');
  if (contenido) contenido.classList.toggle('visor-modo-resaltar', _resaltandoActivo);
  if (_visorFormatoActual === 'epub') _epubActualizarSelectable();
  if (!_resaltandoActivo) _ocultarPopupResaltar();
}

function toggleListaResaltados() {
  const panel = document.getElementById('visor-panel-resaltados');
  if (!panel) return;
  const abrir = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = abrir ? 'block' : 'none';
}

function _resaltadosRenderizarLista() {
  const cont = document.getElementById('visor-lista-resaltados');
  const contador = document.getElementById('visor-resaltados-contador');
  if (contador) contador.textContent = _visorResaltados.length ? String(_visorResaltados.length) : '';
  if (!cont) return;
  if (!_visorResaltados.length) {
    cont.innerHTML = '<p style="font-size:13px;color:var(--gris-suave);padding:12px;text-align:center;">Todavía no resaltaste ninguna frase. Activá "Resaltar" y seleccioná texto.</p>';
    return;
  }
  const coloresMapa = { amarillo:'#F5D547', rosa:'#F2A6C1', celeste:'#A6D4F2', verde:'#A6E3B8' };
  cont.innerHTML = _visorResaltados.map(r => `
    <div class="visor-resaltado-item" style="border-left:4px solid ${coloresMapa[r.color] || coloresMapa.amarillo}; padding:8px 10px; margin-bottom:8px; background:var(--blanco,#fff); border-radius:6px;">
      <p style="font-size:13px; color:var(--negro,#2A2A2A); margin:0 0 6px;">"${(r.cita || '').replace(/</g,'&lt;')}"</p>
      <div style="display:flex; gap:10px;">
        <button class="btn-secundario btn-sm" onclick="irAResaltado('${r.id}')">Ir a la frase</button>
        <button class="btn-secundario btn-sm" onclick="eliminarResaltado('${r.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

var _epubContenidosActivos = [];
var _epubRendicionActual = null;

// Habilita/deshabilita la selección de texto dentro de cada iframe de capítulo
// del EPUB según el modo "Resaltar". Fuera de ese modo, sigue todo bloqueado
// (fricción anti-copia existente).
function _epubActualizarSelectable() {
  _epubContenidosActivos.forEach((contents) => {
    try {
      contents.window.getSelection().removeAllRanges();
      contents.document.documentElement.classList.toggle('visor-resaltando', _resaltandoActivo);
    } catch (e) {}
  });
}

function _epubCapturarSeleccion(contents) {
  if (!_resaltandoActivo) return;
  try {
    const sel = contents.window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { _ocultarPopupResaltar(); return; }
    const rango = sel.getRangeAt(0);
    const cfiRange = contents.cfiFromRange(rango);
    const texto = sel.toString().trim();
    const rect = rango.getBoundingClientRect();
    const iframeEl = contents.document.defaultView.frameElement;
    const rectIframe = iframeEl ? iframeEl.getBoundingClientRect() : { left: 0, top: 0 };
    _mostrarPopupResaltar(rectIframe.left + rect.left + rect.width / 2, rectIframe.top + rect.top, (color) => {
      _resaltadosGuardar(texto, { cfi: cfiRange }, color);
      sel.removeAllRanges();
    });
  } catch (e) { console.error('Error capturando selección EPUB:', e); }
}

function _resaltadosPintarEpub() {
  if (!_epubRendicionActual) return;
  try {
    _visorResaltados.forEach((r) => {
      if (!r.ubicacion || !r.ubicacion.cfi) return;
      try {
        _epubRendicionActual.annotations.remove(r.ubicacion.cfi, 'highlight');
      } catch (e) {}
      const coloresMapa = { amarillo:'rgba(245,213,71,.55)', rosa:'rgba(242,166,193,.55)', celeste:'rgba(166,212,242,.55)', verde:'rgba(166,227,184,.55)' };
      _epubRendicionActual.annotations.add('highlight', r.ubicacion.cfi, {}, null, 'visor-marca-resaltado', {
        fill: coloresMapa[r.color] || coloresMapa.amarillo, 'fill-opacity': '1', 'mix-blend-mode': 'multiply'
      });
    });
  } catch (e) { console.error('Error pintando resaltados EPUB:', e); }
}

function _mostrarPopupResaltar(x, y, onElegirColor) {
  const popup = document.getElementById('visor-popup-resaltar');
  const contenedor = document.getElementById('visor-contenido');
  if (!popup || !contenedor) return;
  const rectContenedor = contenedor.getBoundingClientRect();
  popup.style.left = Math.max(8, x - rectContenedor.left - 60) + 'px';
  popup.style.top = Math.max(8, y - rectContenedor.top - 44) + 'px';
  popup.style.display = 'flex';
  popup.querySelectorAll('.visor-swatch').forEach((btn) => {
    btn.onclick = () => { onElegirColor(btn.dataset.color); _ocultarPopupResaltar(); };
  });
}

function _ocultarPopupResaltar() {
  const popup = document.getElementById('visor-popup-resaltar');
  if (popup) popup.style.display = 'none';
}

async function irAResaltado(idResaltado) {
  const r = _visorResaltados.find(x => x.id === idResaltado);
  if (!r) return;
  if (_visorFormatoActual === 'epub' && r.ubicacion && r.ubicacion.cfi && _visorEpub) {
    const rendicion = _visorEpub.rendition || _epubRendicionActual;
    if (rendicion) await rendicion.display(r.ubicacion.cfi);
  } else if (_visorFormatoActual === 'pdf' && r.ubicacion && r.ubicacion.pagina) {
    _pdfPaginaActual = r.ubicacion.pagina;
    await renderizarPaginaPdf(_pdfPaginaActual);
    actualizarControlesPdf();
  }
  toggleListaResaltados();
}

// ────────────────────────────────────────────────────────────
// ABRIR VISOR EPUB
// ────────────────────────────────────────────────────────────
async function abrirVisorEpub(idCampana, tituloLibro, idPostulacion) {
  if (!idCampana) { mostrarToast('💀 El EPUB decidió no colaborar. Qué inoportuno.', 'error'); return; }
  _visorIdPostulacion = idPostulacion || null;
  _visorIdCampana = idCampana;
  _visorFormatoActual = 'epub';
  _resaltandoActivo = false;
  _visorClaveLS = _visorObtenerClaveLS(idCampana, 'epub');
  crearModalVisor();
  _resaltadosCargar(idCampana, 'epub');
  configurarModalVisor(tituloLibro, 'epub');
  mostrarModal('modal-visor');
  await cargarLibreriaJszip();
await cargarLibreriaEpub();

  // Reseñador: flujo offline (licencia + IndexedDB cifrado). Autor: igual que siempre.
  if (Sesion.rol() === 'reseñador' && typeof obtenerLibroConOffline === 'function') {
    const resultado = await obtenerLibroConOffline(idCampana, 'epub', idPostulacion);
    if (resultado.error) { mostrarErrorVisor(resultado.error); return; }
    await inicializarEpub(resultado.arrayBuffer);
    return;
  }

  const url = await obtenerUrlLibro(idCampana, 'epub');
  if (!url) return;
  await inicializarEpub(url);
}

// ────────────────────────────────────────────────────────────
// ABRIR VISOR PDF
// ────────────────────────────────────────────────────────────

async function abrirVisorPdf(idCampana, tituloLibro, idPostulacion) {
  if (!idCampana) { mostrarToast('😈 El PDF no apareció. Y sin PDF, no hacemos magia.', 'error'); return; }
  _visorIdPostulacion = idPostulacion || null;
  _visorIdCampana = idCampana;
  _visorFormatoActual = 'pdf';
  _resaltandoActivo = false;
  _visorClaveLS = _visorObtenerClaveLS(idCampana, 'pdf');

  crearModalVisor();
  _resaltadosCargar(idCampana, 'pdf');
  configurarModalVisor(tituloLibro, 'pdf');
  mostrarModal('modal-visor');

  await cargarLibreriaPdf();

  const esResenador = Sesion.rol() === 'reseñador';
  if (esResenador && typeof obtenerLibroConOffline === 'function') {
    const resultado = await obtenerLibroConOffline(idCampana, 'pdf', idPostulacion);
    if (resultado.error) { mostrarErrorVisor(resultado.error); return; }
    await inicializarPdf(resultado.arrayBuffer);
  } else {
    const url = await obtenerUrlLibro(idCampana, 'pdf');
    if (!url) return;
    await inicializarPdf(url);
  }

  if (esResenador && typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('leer_pdf');
  }
}


// ────────────────────────────────────────────────────────────
// EPUB
// ────────────────────────────────────────────────────────────

async function inicializarEpub(fuente) {
  const epubDiv  = document.getElementById('visor-epub');
  const cargando = document.getElementById('visor-cargando');

  if (!epubDiv) return;

  try {
    if (_visorEpub) { try { _visorEpub.destroy(); } catch {} _visorEpub = null; }

    epubDiv.innerHTML = '';
    if (cargando) cargando.style.display = 'flex';
    epubDiv.style.display = 'block';
epubDiv.style.visibility = 'hidden';

    // "fuente" puede ser una url (autor, como siempre) o un ArrayBuffer ya descifrado (reseñador, offline)
    let arrayBuffer = fuente;
    if (!(fuente instanceof ArrayBuffer)) {
      const respuesta = await fetch(fuente);
      if (!respuesta.ok) throw new Error('No se pudo descargar el EPUB (' + respuesta.status + ')');
      arrayBuffer = await respuesta.arrayBuffer();
    }
_visorEpub = ePub(arrayBuffer, { openAs: 'binary' });

    const rendicion = _visorEpub.renderTo(epubDiv, {
      width:  '100%',
      height: '100%',
      spread: 'none',
      flow:   'paginated'
    });

    // El contenido de cada capítulo vive en un iframe aparte (documento distinto);
    // el CSS/JS del modal no lo alcanza, hay que inyectarlo por cada capítulo que se renderiza.
    // OJO: antes esto era una regla fija con selector '*' bloqueando selección
    // en TODO el documento. Al activar "Resaltar" se intentaba habilitar
    // selección de nuevo, pero solo se aplicaba como estilo inline en el
    // <body> (ver contents.css en _epubActualizarSelectable) — la regla '*'
    // seguía matcheando cada <p>/<span> hijo directamente con la misma
    // prioridad (!important), así que ganaba siempre el bloqueo y jamás se
    // podía seleccionar una sola letra, aunque el botón se pusiera rojo.
    // Ahora la regla depende de clases en <html> que si se pueden togglear
    // de verdad sobre el árbol completo.
    rendicion.themes.default({
      '.visor-anti-copia *': {
        'user-select': 'none !important',
        '-webkit-user-select': 'none !important',
        '-webkit-touch-callout': 'none !important'
      },
      '.visor-anti-copia.visor-resaltando *': {
        'user-select': 'text !important',
        '-webkit-user-select': 'text !important',
        '-webkit-touch-callout': 'default !important'
      }
    });
    _epubContenidosActivos = [];
    rendicion.hooks.content.register((contents) => {
      try {
        const doc = contents.document;
        _epubContenidosActivos.push(contents);
        doc.documentElement.classList.add('visor-anti-copia');
        if (_resaltandoActivo) doc.documentElement.classList.add('visor-resaltando');
        doc.addEventListener('contextmenu', (e) => e.preventDefault());
        doc.addEventListener('selectstart', (e) => { if (!_resaltandoActivo) e.preventDefault(); });
        doc.addEventListener('copy', (e) => e.preventDefault());
        doc.addEventListener('mouseup', () => _epubCapturarSeleccion(contents));
        contents.window.addEventListener('touchend', () => setTimeout(() => _epubCapturarSeleccion(contents), 50));
      } catch (e) {}
    });

    // Tracker automático: capítulo actual / total de capítulos (spine).
    // No es un % exacto de páginas leídas, pero alcanza para ubicar
    // "no empezado / leyendo / por la mitad / finalizado" sin generar el
    // índice pesado de locations de epub.js.
    rendicion.on('relocated', function (loc) {
      if (loc && loc.start) {
        const totalCapitulos = (_visorEpub.spine && _visorEpub.spine.length) || 0;
        avisarProgresoLecturaAuto(loc.start.index, totalCapitulos, 'epub', loc.start.cfi);
        if (_visorClaveLS) {
          try { localStorage.setItem(_visorClaveLS, loc.start.cfi); } catch (e) {}
        }
      }
    });

    _epubRendicionActual = rendicion;
    _visorEpub.rendition = rendicion;

    let posicionGuardada = await obtenerProgresoLecturaGuardado(_visorIdPostulacion, 'epub');
    if (!posicionGuardada && _visorClaveLS) {
      try { posicionGuardada = localStorage.getItem(_visorClaveLS); } catch (e) {}
    }
    await rendicion.display(posicionGuardada || undefined);
    _resaltadosPintarEpub();
    rendicion.on('rendered', () => _resaltadosPintarEpub());

    if (cargando) cargando.style.display = 'none';
    epubDiv.style.visibility = 'visible';

    // Controles de navegación
    const btnAnterior  = document.getElementById('visor-anterior');
    const btnSiguiente = document.getElementById('visor-siguiente');
    const ctrlEpub     = document.getElementById('visor-controles-epub');

    if (ctrlEpub)     ctrlEpub.style.display = 'flex';
    if (btnAnterior)  btnAnterior.onclick = () => rendicion.prev();
    if (btnSiguiente) btnSiguiente.onclick = () => rendicion.next();

  } catch (e) {
    console.error('Error EPUB:', e);
    if (cargando) cargando.style.display = 'none';
    epubDiv.style.visibility = 'visible';
    mostrarErrorVisor('No se pudo cargar el EPUB.');
  }
}


// ────────────────────────────────────────────────────────────
// PDF
// ────────────────────────────────────────────────────────────

async function inicializarPdf(fuente) {
  const canvas   = document.getElementById('visor-canvas');
  const cargando = document.getElementById('visor-cargando');

  if (!canvas) return;

  try {
    if (cargando) cargando.style.display = 'flex';
    canvas.style.display = 'none';

    pdfjsLib.GlobalWorkerOptions.workerSrc = VISOR_CONFIG.pdfWorker;

    // "fuente" puede ser una url (autor, como siempre) o un ArrayBuffer ya descifrado (reseñador, offline)
    const origenPdf = fuente instanceof ArrayBuffer ? { data: fuente } : fuente;
    _visorPdf = await pdfjsLib.getDocument(origenPdf).promise;
    _pdfTotalPaginas = _visorPdf.numPages;

    let paginaInicial = 1;
    const posicionRemota = await obtenerProgresoLecturaGuardado(_visorIdPostulacion, 'pdf');
    if (posicionRemota) {
      const remota = parseInt(posicionRemota, 10);
      if (!isNaN(remota) && remota >= 1 && remota <= _pdfTotalPaginas) paginaInicial = remota;
    } else if (_visorClaveLS) {
      try {
        const guardada = parseInt(localStorage.getItem(_visorClaveLS), 10);
        if (!isNaN(guardada) && guardada >= 1 && guardada <= _pdfTotalPaginas) paginaInicial = guardada;
      } catch (e) {}
    }
    _pdfPaginaActual = paginaInicial;

    if (cargando) cargando.style.display = 'none';
    canvas.style.display = 'block';

    await renderizarPaginaPdf(paginaInicial);
    actualizarControlesPdf();

    const ctrlPdf = document.getElementById('visor-controles-pdf');
    if (ctrlPdf) ctrlPdf.style.display = 'flex';

  } catch (e) {
    console.error('Error PDF:', e);
    if (cargando) cargando.style.display = 'none';
    mostrarErrorVisor('No se pudo cargar el PDF. Verificá que el archivo esté compartido en Drive como "Cualquiera con el link puede ver".');
  }
}

async function renderizarPaginaPdf(numero) {
  if (!_visorPdf) return;
  const canvas  = document.getElementById('visor-canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;

  const pagina      = await _visorPdf.getPage(numero);
  const contenedor  = document.getElementById('visor-contenido');
  const ancho       = (contenedor && contenedor.clientWidth > 48) ? contenedor.clientWidth - 48 : 600;
  const viewport    = pagina.getViewport({ scale: 1 });
  const escala      = ancho / viewport.width;
  const vp          = pagina.getViewport({ scale: escala });

  const dpr = window.devicePixelRatio || 1;

  canvas.width  = vp.width * dpr;
  canvas.height = vp.height * dpr;
  canvas.style.width  = vp.width + 'px';
  canvas.style.height = vp.height + 'px';

  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  await pagina.render({ canvasContext: context, viewport: vp }).promise;
  await _pdfRenderizarTextLayer(pagina, vp, numero);

  avisarProgresoLecturaAuto(numero, _pdfTotalPaginas, 'pdf', numero);
  if (_visorClaveLS) {
    try { localStorage.setItem(_visorClaveLS, String(numero)); } catch (e) {}
  }
}

// Capa de texto invisible (posicionada igual que el canvas) para poder
// seleccionar frases del PDF con el mouse/dedo. pdfjsLib.renderTextLayer
// es parte del build UMD de pdf.js (no requiere pdf_viewer.js aparte).
async function _pdfRenderizarTextLayer(pagina, vp, numeroPagina) {
  const capa = document.getElementById('visor-textlayer');
  const canvas = document.getElementById('visor-canvas');
  if (!capa || !canvas || typeof pdfjsLib === 'undefined' || !pdfjsLib.renderTextLayer) {
    if (capa) capa.style.display = 'none';
    return;
  }
  try {
    capa.innerHTML = '';
    capa.style.width = canvas.style.width;
    capa.style.height = canvas.style.height;
    capa.style.left = canvas.offsetLeft + 'px';
    capa.style.top = canvas.offsetTop + 'px';
    capa.style.display = 'block';
    capa.dataset.pagina = String(numeroPagina);

    // OJO: sin esto, renderTextLayer dibuja los spans de texto desalineados
    // respecto al canvas (pdf.js 3.x exige esta variable para calcular bien
    // las posiciones). Sin alinear bien, el usuario "selecciona" sobre un
    // hueco vacío de la capa invisible: window.getSelection() siempre viene
    // colapsado y el popup de colores nunca llega a aparecer.
    capa.style.setProperty('--scale-factor', vp.scale);

    const textContent = await pagina.getTextContent();
    const tarea = pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: capa,
      viewport: vp,
      textDivs: [],
    });
    if (tarea && tarea.promise) await tarea.promise;

    // pdf.js pisa width/height del contenedor con un calc(var(--scale-factor)*...)
    // propio (ver setLayerDimensions en su código fuente). Si esa cuenta falla o
    // da 0 en algún navegador, la capa de texto queda invisible y sin tamaño y
    // no se puede seleccionar nada. Forzamos acá el tamaño real en píxeles fijos
    // (el mismo que ya usa el canvas, que sabemos que sí funciona) para no
    // depender de que ese calc() interno resuelva bien.
    capa.style.width = canvas.style.width;
    capa.style.height = canvas.style.height;

    if (!capa.dataset.listenerListo) {
      capa.dataset.listenerListo = '1';
      capa.addEventListener('mouseup', () => _pdfCapturarSeleccion());
      capa.addEventListener('touchend', () => setTimeout(_pdfCapturarSeleccion, 50));
    }

    // Repinta los resaltados guardados de esta página. Se hace acá (no en
    // renderizarPaginaPdf) porque capa.innerHTML se vació arriba, así que
    // hay que esperar a que existan los spans nuevos antes de colorearlos.
    _pdfPintarResaltados(numeroPagina);
  } catch (e) {
    console.error('Error armando capa de texto del PDF:', e);
  }
}

// Pinta (con background-color) los spans de la capa de texto que
// coinciden con la cita de cada resaltado guardado para esta página.
// A diferencia del EPUB (que tiene CFIs exactos vía epub.js), acá solo
// tenemos el texto plano + el número de página, así que hay que
// encontrar dónde cae ese texto dentro de los spans que arma pdf.js.
function _pdfPintarResaltados(numeroPagina) {
  const capa = document.getElementById('visor-textlayer');
  if (!capa) return;
  const resaltadosPagina = _visorResaltados.filter(
    (r) => r.ubicacion && r.ubicacion.pagina === numeroPagina
  );
  if (!resaltadosPagina.length) return;

  const spans = Array.prototype.slice.call(capa.querySelectorAll('span'));
  if (!spans.length) return;

  let fullText = '';
  const offsets = [];
  spans.forEach((sp) => {
    const start = fullText.length;
    fullText += sp.textContent || '';
    offsets.push({ span: sp, start, end: fullText.length });
  });

  // Índice "compacto" (sin espacios) -> índice real en fullText. pdf.js no
  // siempre deja los mismos espacios/saltos de línea entre spans que el
  // texto tal cual lo guardamos al seleccionarlo, así que buscar la cita
  // literal puede fallar; comparando sin espacios es mucho más confiable.
  let compacto = '';
  const mapa = [];
  for (let i = 0; i < fullText.length; i++) {
    if (!/\s/.test(fullText[i])) {
      compacto += fullText[i];
      mapa.push(i);
    }
  }

  const coloresMapa = { amarillo:'rgba(245,213,71,.55)', rosa:'rgba(242,166,193,.55)', celeste:'rgba(166,212,242,.55)', verde:'rgba(166,227,184,.55)' };

  resaltadosPagina.forEach((r) => {
    const buscado = String(r.cita || '').replace(/\s+/g, '');
    if (!buscado) return;
    const idxCompacto = compacto.indexOf(buscado);
    if (idxCompacto === -1) return; // texto no encontrado en esta página (no debería pasar, pero no rompemos nada)
    const iniReal = mapa[idxCompacto];
    const finReal = mapa[idxCompacto + buscado.length - 1] + 1;
    offsets.forEach((o) => {
      if (o.end > iniReal && o.start < finReal) {
        o.span.style.backgroundColor = coloresMapa[r.color] || coloresMapa.amarillo;
        o.span.style.borderRadius = '2px';
        o.span.dataset.resaltadoId = r.id;
      }
    });
  });
}

function _pdfCapturarSeleccion() {
  if (!_resaltandoActivo) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) { _ocultarPopupResaltar(); return; }
  const texto = sel.toString().trim();
  const capa = document.getElementById('visor-textlayer');
  const pagina = capa ? parseInt(capa.dataset.pagina, 10) : _pdfPaginaActual;
  const rango = sel.getRangeAt(0);
  const rect = rango.getBoundingClientRect();
  _mostrarPopupResaltar(rect.left + rect.width / 2, rect.top, (color) => {
    _resaltadosGuardar(texto, { pagina }, color);
    sel.removeAllRanges();
  });
}

async function pdfPaginaAnterior() {
  if (_pdfPaginaActual <= 1) return;
  _pdfPaginaActual--;
  await renderizarPaginaPdf(_pdfPaginaActual);
  actualizarControlesPdf();
  document.getElementById('visor-contenido')?.scrollTo(0, 0);
}

async function pdfPaginaSiguiente() {
  if (_pdfPaginaActual >= _pdfTotalPaginas) return;
  _pdfPaginaActual++;
  await renderizarPaginaPdf(_pdfPaginaActual);
  actualizarControlesPdf();
  document.getElementById('visor-contenido')?.scrollTo(0, 0);
}

function actualizarControlesPdf() {
  const contador    = document.getElementById('visor-pagina-contador');
  const btnAnterior = document.getElementById('visor-pdf-anterior');
  const btnSiguiente = document.getElementById('visor-pdf-siguiente');
  if (contador)     contador.textContent = `${_pdfPaginaActual} / ${_pdfTotalPaginas}`;
  if (btnAnterior)  btnAnterior.disabled = _pdfPaginaActual <= 1;
  if (btnSiguiente) btnSiguiente.disabled = _pdfPaginaActual >= _pdfTotalPaginas;
}


// ────────────────────────────────────────────────────────────
// MODAL
// ────────────────────────────────────────────────────────────

function crearModalVisor() {
  if (document.getElementById('modal-visor')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-visor" class="modal">
      <div class="modal-header">
        <h3 class="modal-titulo" id="visor-titulo">Leyendo...</h3>
        <button class="modal-cerrar" onclick="cerrarVisor()">✕</button>
      </div>
      <div class="modal-header" style="padding:8px 20px; gap:10px; justify-content:flex-end; border-top:1px solid var(--crema-oscura);">
        <button class="btn-secundario btn-sm" id="visor-btn-resaltar" onclick="toggleModoResaltar()" title="Seleccioná texto para resaltarlo">🖍️ Resaltar</button>
        <button class="btn-secundario btn-sm" id="visor-btn-lista-resaltados" onclick="toggleListaResaltados()">📌 Mis frases <span id="visor-resaltados-contador"></span></button>
      </div>
      <div id="visor-contenido" style="padding:0 20px 20px; height:68vh; overflow-y:auto; position:relative;">
        <div id="visor-cargando" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px;">
          <div class="spinner"></div>
          <p style="color:var(--gris-suave); font-size:14px;">Cargando archivo...</p>
        </div>
        <canvas id="visor-canvas" style="display:none; width:100%; border-radius:4px;"></canvas>
        <div id="visor-textlayer" style="display:none; position:absolute; top:0; left:0; overflow:hidden; line-height:1; transform-origin:0 0;"></div>
        <div id="visor-epub" style="display:none; height:100%;"></div>
        <div id="visor-error" style="display:none; text-align:center; padding:40px;">
          <p style="font-size:48px; margin-bottom:16px;">⚠️</p>
          <p id="visor-error-msg" style="font-family:var(--fuente-titulo); font-size:17px; color:var(--bordo); margin-bottom:12px;"></p>
          <p style="font-size:13px; color:var(--gris-suave);">El archivo debe estar compartido como<br><strong>"Cualquiera con el link puede ver"</strong></p>
        </div>
        <div id="visor-popup-resaltar" style="display:none; position:absolute; z-index:20; background:var(--bordo,#8B1A2B); border-radius:10px; padding:8px; box-shadow:0 4px 12px rgba(0,0,0,.25); gap:6px; align-items:center;">
          <button data-color="amarillo" class="visor-swatch" style="background:#F5D547"></button>
          <button data-color="rosa" class="visor-swatch" style="background:#F2A6C1"></button>
          <button data-color="celeste" class="visor-swatch" style="background:#A6D4F2"></button>
          <button data-color="verde" class="visor-swatch" style="background:#A6E3B8"></button>
        </div>
      </div>
      <div id="visor-panel-resaltados" style="display:none; position:absolute; top:56px; right:20px; left:20px; bottom:20px; background:var(--crema-suave); border:1px solid var(--crema-oscura); border-radius:12px; padding:14px; overflow-y:auto; z-index:15;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong style="font-size:14px;">Frases resaltadas</strong>
          <button class="modal-cerrar" onclick="toggleListaResaltados()">✕</button>
        </div>
        <div id="visor-lista-resaltados"></div>
      </div>
      <div id="visor-controles-pdf" style="display:none; align-items:center; justify-content:center; gap:16px; padding:12px 20px; border-top:1px solid var(--crema-oscura); background:var(--crema-suave); border-radius:0 0 16px 16px;">
        <button class="btn-secundario btn-sm" id="visor-pdf-anterior" onclick="pdfPaginaAnterior()">← Anterior</button>
        <span id="visor-pagina-contador" style="font-size:14px; font-weight:600; min-width:80px; text-align:center;"></span>
        <button class="btn-secundario btn-sm" id="visor-pdf-siguiente" onclick="pdfPaginaSiguiente()">Siguiente →</button>
      </div>
      <div id="visor-controles-epub" style="display:none; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1px solid var(--crema-oscura); background:var(--crema-suave); border-radius:0 0 16px 16px;">
        <button class="btn-secundario btn-sm" id="visor-anterior">← Anterior</button>
        <span style="font-size:12px; color:var(--gris-suave);">Navegá con las flechas</span>
        <button class="btn-secundario btn-sm" id="visor-siguiente">Siguiente →</button>
      </div>
    </div>
  `);

  if (!document.getElementById('visor-styles')) {
    const style = document.createElement('style');
    style.id = 'visor-styles';
    style.textContent = `
      #modal-visor { max-width:860px; width:95%; max-height:96vh; overflow:hidden; }
      #visor-contenido::-webkit-scrollbar { width:6px; }
      #visor-contenido::-webkit-scrollbar-track { background:var(--crema-suave); }
      #visor-contenido::-webkit-scrollbar-thumb { background:var(--crema-oscura); border-radius:3px; }
      @media (max-width:768px) {
        #modal-visor { width:100%; max-width:100%; max-height:100vh; top:0; left:0; transform:none; border-radius:0; }
        #visor-contenido { height:78vh; }
      }
      /* Fricciones anti-copia: no frenan a alguien decidido, pero evitan el copiado casual.
         Se desactivan solo dentro de #visor-textlayer (capa invisible sobre el PDF) y dentro
         del iframe del EPUB cuando el modo "Resaltar" está activo (ver _epubActualizarSelectable). */
      #visor-contenido, #visor-contenido * { user-select:none !important; -webkit-user-select:none !important; -moz-user-select:none !important; -webkit-touch-callout:none !important; }
      #visor-contenido.visor-modo-resaltar #visor-textlayer, #visor-contenido.visor-modo-resaltar #visor-textlayer * {
        user-select:text !important; -webkit-user-select:text !important; -moz-user-select:text !important;
        -webkit-touch-callout:default !important;
      }
      #visor-textlayer { color:transparent; user-select:none; }
      #visor-textlayer span { position:absolute; white-space:pre; cursor:text; transform-origin:0% 0%; }
      #visor-textlayer span::selection { background:rgba(245,213,71,.55); }
      #visor-btn-resaltar.activo { background:var(--bordo,#8B1A2B); color:#fff; }
      #visor-popup-resaltar { display:none; }
      #visor-popup-resaltar .visor-swatch { width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.2); cursor:pointer; padding:0; }
      .visor-marca-resaltado { background:rgba(245,213,71,.55); border-radius:2px; }
      @media print {
        #modal-visor, #modal-visor * { display:none !important; visibility:hidden !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const visorContenido = document.getElementById('visor-contenido');
  if (visorContenido && !visorContenido.dataset.friccionesListas) {
    visorContenido.dataset.friccionesListas = '1';
    visorContenido.addEventListener('contextmenu', (e) => e.preventDefault());
    visorContenido.addEventListener('selectstart', (e) => { if (!_resaltandoActivo) e.preventDefault(); });
    visorContenido.addEventListener('dragstart', (e) => e.preventDefault());
    visorContenido.addEventListener('copy', (e) => e.preventDefault());
    // Ctrl/Cmd+P, Ctrl/Cmd+S dentro del visor
    visorContenido.addEventListener('keydown', (e) => {
      const combo = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'P' || e.key === 'S');
      if (combo) e.preventDefault();
    });
  }
}

function configurarModalVisor(titulo, tipo) {
  const ids = ['visor-cargando','visor-canvas','visor-textlayer','visor-epub','visor-error','visor-controles-pdf','visor-controles-epub','visor-panel-resaltados'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  _ocultarPopupResaltar();

  const tituloEl = document.getElementById('visor-titulo');
  if (tituloEl) tituloEl.textContent = titulo;

  const cargando = document.getElementById('visor-cargando');
  if (cargando) cargando.style.display = 'flex';

  const contenido = document.getElementById('visor-contenido');
  if (contenido) contenido.style.overflowY = tipo === 'epub' ? 'hidden' : 'auto';
}

function mostrarErrorVisor(mensaje) {
  ['visor-cargando','visor-canvas','visor-epub'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const errorDiv = document.getElementById('visor-error');
  const errorMsg = document.getElementById('visor-error-msg');
  if (errorMsg) errorMsg.textContent = mensaje || 'No se pudo cargar el archivo.';
  if (errorDiv) errorDiv.style.display = 'block';
}

function cerrarVisor() {
  if (_visorEpub) { try { _visorEpub.destroy(); } catch {} _visorEpub = null; }
  if (_visorPdf)  { try { _visorPdf.destroy();  } catch {} _visorPdf  = null; }
  _pdfPaginaActual = 1;
  _pdfTotalPaginas = 0;
  _visorIdPostulacion = null;
  _visorIdCampana = null;
  _visorFormatoActual = null;
  _resaltandoActivo = false;
  _visorResaltados = [];
  _epubContenidosActivos = [];
  _epubRendicionActual = null;
  _visorClaveLS = null;
  if (_timeoutProgresoLectura) { clearTimeout(_timeoutProgresoLectura); _timeoutProgresoLectura = null; }
  const canvas  = document.getElementById('visor-canvas');
  const epubDiv = document.getElementById('visor-epub');
  if (canvas)  { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0,0,canvas.width,canvas.height); }
  if (epubDiv) epubDiv.innerHTML = '';
  cerrarModales();
}


// ────────────────────────────────────────────────────────────
// CARGA DINÁMICA DE LIBRERÍAS
// ────────────────────────────────────────────────────────────

function cargarLibreriaPdf() {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = VISOR_CONFIG.pdfLib;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function cargarLibreriaEpub() {
  return new Promise((resolve, reject) => {
    if (typeof ePub !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = VISOR_CONFIG.epubLib;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function cargarLibreriaJszip() {
  return new Promise((resolve, reject) => {
    if (typeof JSZip !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = VISOR_CONFIG.jszipLib;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Exponer funciones globalmente
window.abrirVisorEpub = abrirVisorEpub;
window.abrirVisorPdf  = abrirVisorPdf;
window.descargarLibro = descargarLibro;
window.pdfPaginaAnterior  = pdfPaginaAnterior;
window.pdfPaginaSiguiente = pdfPaginaSiguiente;
window.cerrarVisor    = cerrarVisor;
window.toggleModoResaltar     = toggleModoResaltar;
window.toggleListaResaltados  = toggleListaResaltados;
window.eliminarResaltado      = eliminarResaltado;
window.irAResaltado           = irAResaltado;
