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
  epubLib: 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js'
};

// Estado global del visor
var _visorPdf  = null;
var _visorEpub = null;
var _pdfPaginaActual = 1;
var _pdfTotalPaginas = 0;


// ────────────────────────────────────────────────────────────
// EXTRAER ID DE DRIVE
// ────────────────────────────────────────────────────────────

async function obtenerUrlLibro(idCampana, formato) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      mostrarErrorVisor('Tu sesión expiró. Volvé a iniciar sesión y probá de nuevo.');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('obtener-url-libro', {
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
// ABRIR VISOR EPUB
// ────────────────────────────────────────────────────────────
async function abrirVisorEpub(idCampana, tituloLibro) {
  if (!idCampana) { mostrarToast('No hay archivo EPUB disponible.', 'error'); return; }
  crearModalVisor();
  configurarModalVisor(tituloLibro, 'epub');
  mostrarModal('modal-visor');
  await cargarLibreriaEpub();
  const url = await obtenerUrlLibro(idCampana, 'epub');
  if (!url) return;
  await inicializarEpub(url);
}

// ────────────────────────────────────────────────────────────
// ABRIR VISOR PDF
// ────────────────────────────────────────────────────────────

async function abrirVisorPdf(idCampana, tituloLibro) {
  if (!idCampana) { mostrarToast('No hay archivo PDF disponible.', 'error'); return; }

  crearModalVisor();
  configurarModalVisor(tituloLibro, 'pdf');
  mostrarModal('modal-visor');

  await cargarLibreriaPdf();
  const url = await obtenerUrlLibro(idCampana, 'pdf');
  if (!url) return;
  await inicializarPdf(url);

  if (Sesion.rol() === 'reseñador' && typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('leer_pdf');
  }
}


// ────────────────────────────────────────────────────────────
// EPUB
// ────────────────────────────────────────────────────────────

async function inicializarEpub(url) {
  const epubDiv  = document.getElementById('visor-epub');
  const cargando = document.getElementById('visor-cargando');

  if (!epubDiv) return;

  try {
    if (_visorEpub) { try { _visorEpub.destroy(); } catch {} _visorEpub = null; }

    epubDiv.innerHTML = '';
    if (cargando) cargando.style.display = 'flex';
    epubDiv.style.display = 'none';

    _visorEpub = ePub(url, { openAs: 'epub' });

    const rendicion = _visorEpub.renderTo(epubDiv, {
      width:  '100%',
      height: '100%',
      spread: 'none',
      flow:   'paginated'
    });

    await rendicion.display();

    if (cargando) cargando.style.display = 'none';
    epubDiv.style.display = 'block';

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
    mostrarErrorVisor('No se pudo cargar el EPUB. Verificá que el archivo esté compartido en Drive como "Cualquiera con el link puede ver".');
  }
}


// ────────────────────────────────────────────────────────────
// PDF
// ────────────────────────────────────────────────────────────

async function inicializarPdf(url) {
  const canvas   = document.getElementById('visor-canvas');
  const cargando = document.getElementById('visor-cargando');

  if (!canvas) return;

  try {
    if (cargando) cargando.style.display = 'flex';
    canvas.style.display = 'none';

    pdfjsLib.GlobalWorkerOptions.workerSrc = VISOR_CONFIG.pdfWorker;

    _visorPdf = await pdfjsLib.getDocument(url).promise;
    _pdfTotalPaginas = _visorPdf.numPages;
    _pdfPaginaActual = 1;

    if (cargando) cargando.style.display = 'none';
    canvas.style.display = 'block';

    await renderizarPaginaPdf(1);
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
  const ancho       = contenedor ? contenedor.clientWidth - 48 : 600;
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
      <div id="visor-contenido" style="padding:0 20px 20px; height:72vh; overflow-y:auto; position:relative;">
        <div id="visor-cargando" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px;">
          <div class="spinner"></div>
          <p style="color:var(--gris-suave); font-size:14px;">Cargando archivo...</p>
        </div>
        <canvas id="visor-canvas" style="display:none; width:100%; border-radius:4px;"></canvas>
        <div id="visor-epub" style="display:none; height:100%;"></div>
        <div id="visor-error" style="display:none; text-align:center; padding:40px;">
          <p style="font-size:48px; margin-bottom:16px;">⚠️</p>
          <p id="visor-error-msg" style="font-family:var(--fuente-titulo); font-size:17px; color:var(--bordo); margin-bottom:12px;"></p>
          <p style="font-size:13px; color:var(--gris-suave);">El archivo debe estar compartido como<br><strong>"Cualquiera con el link puede ver"</strong></p>
        </div>
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
    `;
    document.head.appendChild(style);
  }
}

function configurarModalVisor(titulo, tipo) {
  const ids = ['visor-cargando','visor-canvas','visor-epub','visor-error','visor-controles-pdf','visor-controles-epub'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

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
// Exponer funciones globalmente
window.abrirVisorEpub = abrirVisorEpub;
window.abrirVisorPdf  = abrirVisorPdf;
window.pdfPaginaAnterior  = pdfPaginaAnterior;
window.pdfPaginaSiguiente = pdfPaginaSiguiente;
window.cerrarVisor    = cerrarVisor;
