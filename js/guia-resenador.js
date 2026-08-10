// ============================================================
// guia-resenador.js — Indómita Love Club
// Sección "Guía" para reseñadores: Normas de Reseña,
// ¿Cómo se hace una Reseña? (+ PDF descargable) y FAQ.
// Archivo independiente: no modifica ninguna función existente.
// ============================================================

// ────────────────────────────────────────────────────────────
// CONTENIDO — NORMAS DE RESEÑA
// ────────────────────────────────────────────────────────────
const NORMAS_RESENA_HTML = `
  <p>En Indómita Love Club las reseñas negativas son bienvenidas — lo que no es negociable
  es que la crítica sea sobre el libro, no sobre la persona que lo escribió. Estas normas
  existen para que la reseñadora sepa exactamente qué se espera, y para que autoras/es
  sepan qué protecciones tienen.</p>

  <h4>1. Qué debe tener toda reseña</h4>
  <ul>
    <li>Evidencia de lectura real y completa (comentarios, o vía los links de Amazon/Goodreads/redes que ya pedimos al entregar).</li>
    <li>Argumentos concretos sobre el libro: trama, personajes, ritmo, prosa, ambientación, coherencia, final. Un puntaje sin ningún argumento que lo sostenga puede ser ocultado y devuelto para revisión.</li>
    <li>Si no vas a poder terminar el libro, usá la opción de abandono de la postulación en vez de reseñarlo a medias o sin haberlo terminado.</li>
  </ul>

  <h4>2. El límite: libro sí, persona no</h4>
  <p>La reseña puede criticar duramente decisiones narrativas, ejecución técnica, o
  elecciones editoriales ("el autor eligió ambientar esto en X y no funciona porque...").
  Deja de ser válida cuando el foco pasa de la obra a la persona autora: su identidad,
  aspecto, vida personal, otras publicaciones, comportamiento en redes, o cualquier cosa
  ajena al libro entregado. Si el contenido de la reseña gira mayormente en torno al autor
  y no al libro, se retira de circulación aunque no contenga insultos.</p>

  <h4>3. Tolerancia cero (oculta la reseña y puede derivar en suspensión de cuenta)</h4>
  <ul>
    <li>Discurso de odio o lenguaje discriminatorio.</li>
    <li>Acoso o lenguaje abusivo dirigido a la persona autora.</li>
    <li>Difamación: afirmaciones falsas que dañen la reputación de alguien.</li>
    <li>Plagio de otra reseña o contenido ajeno.</li>
    <li>Autopromoción dentro del texto de la reseña (venta de servicios, links ajenos al libro).</li>
    <li>Reseñas generadas por IA sin lectura ni redacción propia.</li>
  </ul>

  <h4>4. Cosas que no van en la reseña (van por soporte)</h4>
  <p>Problemas técnicos (visor, descarga, formato del archivo) no son parte de la reseña —
  repórtalos directamente a soporte para que se resuelvan aparte.</p>

  <h4>5. Detección de patrones anómalos</h4>
  <p>Igual que en otras plataformas de reseñas, monitoreamos comportamiento inusual: picos
  de actividad coordinada, cuentas nuevas calificando en bloque, o patrones que sugieran
  mala fe más allá del contenido de una reseña individual. Esto es aparte de la evaluación
  caso por caso de cada reseña.</p>

  <h4>6. Consecuencias graduales</h4>
  <p>No toda infracción es igual: contenido "desalentado" (vago, sin evidencia de lectura,
  quejas técnicas) puede resultar en ocultamiento + pedido de revisión. Contenido de
  "tolerancia cero" resulta en ocultamiento inmediato y puede incluir suspensión de la
  cuenta, dependiendo de la gravedad y el historial de la usuaria.</p>

  <h4>7. ¿Viste algo que no cumple estas normas?</h4>
  <p>Escribinos al correo de soporte con el título del libro y un link o captura de la
  reseña en cuestión. La evaluamos y, si corresponde, se oculta.</p>
`;

// ────────────────────────────────────────────────────────────
// CONTENIDO — ¿CÓMO SE HACE UNA RESEÑA?
// ────────────────────────────────────────────────────────────
const COMO_HACER_RESENA_HTML = `
  <p>Preparamos una guía paso a paso, desde que te aprueban en una campaña hasta que
  entregás la reseña: cómo acceder al libro, qué significan "solo visor" y "permite
  descarga", cómo completar el formulario de carga (estrellas, moods, frase favorita,
  extra ratings, links de reseña), una estructura sugerida para escribir tu opinión sin
  spoilers, y los plazos de entrega. Descargala y tenela a mano las primeras veces.</p>
  <a href="/assets/guia-como-hacer-una-resena.pdf" target="_blank" rel="noopener"
     class="btn-primario guia-pdf-btn" download>
    📄 Descargar guía completa (PDF)
  </a>
`;

// ────────────────────────────────────────────────────────────
// CONTENIDO — FAQ RESEÑADOR
// ────────────────────────────────────────────────────────────
const FAQ_RESENADOR_DATA = [
  {
    pregunta: '¿Cómo cargo mi reseña?',
    respuesta: 'Desde tu panel, en "Mis ARCs activos", cada libro aprobado tiene un botón "Cargar reseña". Se abre un formulario de dos pasos: primero tu reseña interna (estrellas al libro, moods, frase favorita obligatoria y extra ratings opcionales de Romance, Spice, Drama, Estilo, Tensión, Ritmo y Worldbuilding), y después tus links públicos de reseña.'
  },
  {
    pregunta: '¿Tengo que reseñar en la plataforma solamente?',
    respuesta: 'No: en el segundo paso del formulario tenés que cargar al menos un link a tu reseña publicada afuera (Instagram, TikTok, Amazon o Goodreads) — podés cargar más de uno si publicaste en varios lugares. Sin al menos un link no se puede enviar la reseña.'
  },
  {
    pregunta: '¿Dónde leo el libro?',
    respuesta: 'Depende de la modalidad que eligió la autora para esa campaña: si es "solo visor", leés el libro dentro de la plataforma. Si es "permite descarga", podés bajar el EPUB y/o el PDF y leerlo donde prefieras. Lo vas a ver indicado en la card del libro dentro de "Mis ARCs activos".'
  },
  {
    pregunta: '¿Por qué no puedo descargar el libro?',
    respuesta: 'Porque la autora eligió la modalidad "solo visor" para esa campaña puntual, que te permite leer el libro dentro de la plataforma pero no descargarlo a tu dispositivo. Es una decisión de cada autora para proteger su archivo, no algo que puedas cambiar desde tu cuenta.'
  },
  {
    pregunta: '¿Puedo editar mi reseña después de subirla?',
    respuesta: 'No, una vez que enviás la reseña queda cargada y no se puede volver a editar desde la plataforma (el sistema no permite subir una segunda reseña para la misma campaña). Revisá bien los links y el texto antes de confirmar el envío. Si cometiste un error importante, escribinos a soporte.'
  },
  {
    pregunta: '¿Qué pasa si no entrego la reseña?',
    respuesta: 'Tenés 30 días desde que te aprueban en la campaña, más 7 días de gracia después de vencido ese plazo para entregar igual. Pasado ese margen ya no vas a poder cargarla, y no entregar afecta tu puntaje de confiabilidad dentro de la comunidad.'
  },
  {
    pregunta: '¿Qué pasa si abandono la reseña?',
    respuesta: 'Podés abandonar una campaña en cualquier momento desde el botón correspondiente en "Mis ARCs activos" — te vamos a pedir que cuentes brevemente el motivo. Es la opción correcta si sabés que no vas a poder terminar el libro, en vez de dejar que la campaña venza sin avisar.'
  },
  {
    pregunta: '¿Cómo puedo formar parte del programa Reseñadores Select?',
    respuesta: 'Estamos terminando de definir los criterios de este programa — apenas esté activo, lo vas a ver anunciado acá y en la plataforma.'
  }
];

// ────────────────────────────────────────────────────────────
// RENDER — 3 bloques en acordeón (Normas / Cómo se hace / FAQ)
// ────────────────────────────────────────────────────────────
const GUIA_RESENADOR_BLOQUES = [
  { id: 'normas', titulo: 'Normas de Reseña', tipo: 'html', contenido: NORMAS_RESENA_HTML },
  { id: 'como-hacer', titulo: '¿Cómo se hace una Reseña?', tipo: 'html', contenido: COMO_HACER_RESENA_HTML },
  { id: 'faq', titulo: 'FAQ / Dudas', tipo: 'faq' }
];

/**
 * Renderiza la sección Guía para reseñadores.
 * Se llama automáticamente cuando se muestra la sección #seccion-guia-resenador.
 */
function cargarGuiaResenador() {
  const contenedor = document.getElementById('guia-resenador-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = GUIA_RESENADOR_BLOQUES.map((bloque, i) => `
    <div class="faq-item guia-item" id="guia-item-${i}">
      <button type="button" class="faq-item-header" onclick="toggleGuiaItem(${i})">
        <span class="faq-item-pregunta">${bloque.titulo}</span>
        <span class="faq-item-chevron" id="guia-chevron-${i}">▾</span>
      </button>
      <div class="faq-item-body guia-item-body" id="guia-body-${i}">
        <div class="guia-item-contenido">
          ${bloque.tipo === 'faq' ? '<div id="faq-resenador-contenedor" class="faq-lista faq-lista--anidada"></div>' : bloque.contenido}
        </div>
      </div>
    </div>
  `).join('');

  renderizarFaqResenador();

  if (typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('revisar_guia_resenador');
  }
}

/**
 * Abre/cierra un bloque de nivel superior de la Guía (Normas / Cómo se hace / FAQ).
 * @param {number} indice
 */
function toggleGuiaItem(indice) {
  const item = document.getElementById(`guia-item-${indice}`);
  if (!item) return;
  item.classList.toggle('abierta');
}

/**
 * Renderiza las preguntas del FAQ de reseñador dentro del tercer acordeón.
 */
function renderizarFaqResenador() {
  const contenedor = document.getElementById('faq-resenador-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = FAQ_RESENADOR_DATA.map((item, i) => `
    <div class="faq-item" id="faq-resenador-item-${i}">
      <button type="button" class="faq-item-header" onclick="toggleFaqResenadorItem(${i})">
        <span class="faq-item-pregunta">${item.pregunta}</span>
        <span class="faq-item-chevron" id="faq-resenador-chevron-${i}">▾</span>
      </button>
      <div class="faq-item-body" id="faq-resenador-body-${i}">
        <p class="faq-item-respuesta">${item.respuesta}</p>
      </div>
    </div>
  `).join('');
}

/**
 * Abre/cierra una pregunta del acordeón de FAQ de reseñador.
 * @param {number} indice
 */
function toggleFaqResenadorItem(indice) {
  const item = document.getElementById(`faq-resenador-item-${indice}`);
  if (!item) return;
  item.classList.toggle('abierta');
}
