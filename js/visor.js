// ============================================================
// visor.js — Indómita Love Club
// Visor de EPUB y PDF usando Google Docs Viewer
// Detecta automáticamente el ID de Drive desde cualquier formato de URL
// ============================================================


// ────────────────────────────────────────────────────────────
// EXTRAER ID DE DRIVE
// ────────────────────────────────────────────────────────────

/**
 * Extrae el ID de un archivo de Google Drive desde cualquier formato de URL.
 * Soporta todos los formatos que Google genera:
 * - https://drive.google.com/file/d/ID/view
 * - https://drive.google.com/file/d/ID/edit
 * - https://drive.google.com/open?id=ID
 * - https://drive.google.com/thumbnail?id=ID
 * - https://docs.google.com/document/d/ID/edit
 * - https://drive.google.com/uc?id=ID
 *
 * @param {string} url
 * @returns {string|null} ID del archivo o null si no encuentra
 */
function extraerIdDriveVisor(url) {
  if (!url) return null;
  try {
    // Formato /d/ID/
    const matchFile = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFile) return matchFile[1];
    // Formato ?id=ID o &id=ID
    const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) return matchId[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * Convierte cualquier URL de Drive a una URL compatible con Google Docs Viewer.
 * Si no es una URL de Drive, la devuelve tal cual.
 *
 * @param {string} url
 * @returns {string} URL para Google Docs Viewer
 */
function convertirAUrlVisor(url) {
  if (!url) return '';

  const id = extraerIdDriveVisor(url);
  if (id) {
    // URL directa de descarga de Drive — compatible con Google Docs Viewer
    return `https://drive.google.com/file/d/${id}/preview`;
  }

  // Si no es Drive, devuelve la URL original
  return url;
}


// ────────────────────────────────────────────────────────────
// ABRIR VISOR EPUB
// ────────────────────────────────────────────────────────────

/**
 * Abre el visor de EPUB en un modal.
 * Usa Google Docs Viewer con preview embebido.
 * El archivo se muestra pero no se puede descargar directamente.
 *
 * @param {string} urlEpub — URL del archivo EPUB en Drive (cualquier formato)
 * @param {string} tituloLibro — título del libro para mostrar en el modal
 */
function abrirVisorEpub(urlEpub, tituloLibro) {
  if (!urlEpub) {
    mostrarToast('No hay archivo EPUB disponible.', 'error');
    return;
  }

  const urlVisor = convertirAUrlVisor(urlEpub);
  abrirVisorModal(urlVisor, tituloLibro, 'EPUB');
}


// ────────────────────────────────────────────────────────────
// ABRIR VISOR PDF
// ────────────────────────────────────────────────────────────

/**
 * Abre el visor de PDF en un modal.
 * Usa Google Docs Viewer con preview embebido.
 *
 * @param {string} urlPdf — URL del archivo PDF en Drive (cualquier formato)
 * @param {string} tituloLibro — título del libro para mostrar en el modal
 */
function abrirVisorPdf(urlPdf, tituloLibro) {
  if (!urlPdf) {
    mostrarToast('No hay archivo PDF disponible.', 'error');
    return;
  }

  const urlVisor = convertirAUrlVisor(urlPdf);
  abrirVisorModal(urlVisor, tituloLibro, 'PDF');
}


// ────────────────────────────────────────────────────────────
// MODAL DEL VISOR
// ────────────────────────────────────────────────────────────

/**
 * Abre el modal genérico del visor con el archivo indicado.
 * Crea el modal dinámicamente si no existe todavía.
 *
 * @param {string} urlVisor — URL del archivo para mostrar en el iframe
 * @param {string} tituloLibro — título del libro
 * @param {string} tipo — 'EPUB' o 'PDF'
 */
function abrirVisorModal(urlVisor, tituloLibro, tipo) {
  // Crea el modal del visor si no existe
  if (!document.getElementById('modal-visor')) {
    crearModalVisor();
  }

  const titulo = document.getElementById('visor-titulo');
  const iframe = document.getElementById('visor-iframe');
  const cargando = document.getElementById('visor-cargando');

  if (titulo) titulo.textContent = `${tituloLibro} — ${tipo}`;

  // Muestra spinner mientras carga
  if (cargando) cargando.style.display = 'flex';
  if (iframe) {
    iframe.style.display = 'none';
    iframe.src = '';
  }

  mostrarModal('modal-visor');

  // Carga el archivo en el iframe
  if (iframe) {
    iframe.onload = () => {
      if (cargando) cargando.style.display = 'none';
      iframe.style.display = 'block';
    };
    iframe.onerror = () => {
      if (cargando) cargando.style.display = 'none';
      mostrarErrorVisor();
    };
    iframe.src = urlVisor;
  }

  // Fallback: si tarda más de 10 segundos muestra mensaje
  setTimeout(() => {
    if (cargando && cargando.style.display !== 'none') {
      if (cargando) cargando.style.display = 'none';
      if (iframe) iframe.style.display = 'block';
    }
  }, 10000);
}

/**
 * Crea el modal del visor dinámicamente y lo agrega al body.
 * Se crea una sola vez y se reutiliza.
 */
function crearModalVisor() {
  // Agrega el HTML del modal al body
  const modalHtml = `
    <div id="modal-visor" class="modal modal-visor-grande">
      <div class="modal-header">
        <h3 class="modal-titulo" id="visor-titulo">Leyendo...</h3>
        <button class="modal-cerrar" onclick="cerrarVisor()">✕</button>
      </div>
      <div class="modal-body" style="padding:0; position:relative;">
        <div id="visor-cargando" style="
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          height:70vh;
          gap:16px;
        ">
          <div class="spinner"></div>
          <p style="color:var(--gris-suave); font-size:14px;">Cargando el archivo...</p>
        </div>
        <iframe
          id="visor-iframe"
          style="display:none; width:100%; height:70vh; border:none;"
          allowfullscreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        ></iframe>
        <div id="visor-error" style="display:none; padding:40px; text-align:center;">
          <p style="font-size:48px; margin-bottom:16px;">📄</p>
          <p style="font-family:var(--fuente-titulo); font-size:18px; color:var(--bordo); margin-bottom:8px;">
            No se pudo cargar el archivo
          </p>
          <p style="font-size:14px; color:var(--gris-suave); margin-bottom:20px;">
            El archivo puede no tener permisos públicos o el link puede ser incorrecto.
          </p>
          <p style="font-size:13px; color:var(--gris-suave);">
            Pedile al autor que verifique que el archivo esté compartido como "Cualquiera con el link puede ver".
          </p>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Agrega el CSS del modal grande del visor si no existe
  if (!document.getElementById('visor-styles')) {
    const style = document.createElement('style');
    style.id = 'visor-styles';
    style.textContent = `
      .modal-visor-grande {
        max-width: 900px;
        width: 95%;
        max-height: 95vh;
      }
      @media (max-width: 768px) {
        .modal-visor-grande {
          width: 100%;
          max-width: 100%;
          max-height: 100vh;
          top: 0;
          left: 0;
          transform: none;
          border-radius: 0;
        }
        #visor-iframe {
          height: 80vh !important;
        }
        #visor-cargando {
          height: 80vh !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Muestra el mensaje de error dentro del visor.
 */
function mostrarErrorVisor() {
  const iframe = document.getElementById('visor-iframe');
  const error = document.getElementById('visor-error');
  if (iframe) iframe.style.display = 'none';
  if (error) error.style.display = 'block';
}

/**
 * Cierra el visor y limpia el iframe para liberar memoria.
 */
function cerrarVisor() {
  const iframe = document.getElementById('visor-iframe');
  if (iframe) iframe.src = '';
  cerrarModales();
}
