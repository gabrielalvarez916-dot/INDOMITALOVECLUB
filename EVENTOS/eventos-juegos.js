// ============================================================
// eventos-juegos.js — Indómita Love Club
// Minijuegos interactivos del evento "Jardín de Primavera" (y los que
// vengan después). Cada juego se registra en el objeto EventosJuegos
// (definido en eventos.js) bajo la clave del "orden" del reto/nodo al
// que pertenece: EventosJuegos[1] = Juego 1, EventosJuegos[2] = Juego 2, etc.
//
// Todos los juegos usan datos REALES de campañas de Indómita (nunca
// inventados), obtenidos vía la RPC obtener_campanas_azar_para_juego.
//
// Al ganar un juego, se llama a registrarAccionEventoSiCorresponde()
// con la acción convenida para ese juego (ver comentario en eventos.js,
// función _renderCardReto). Esa acción debe estar cargada EXACTAMENTE
// así en el subReto #0 de cada reto, desde el panel admin de Eventos.
// ============================================================

const _DURACION_MEMORIZACION_MS = 4000; // segundos que se ven las tapas antes de ocultarlas

/**
 * Mezcla un array sin mutar el original.
 */
function _mezclarArrayJuego(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ────────────────────────────────────────────────────────────
// JUEGO 1 — Memoria de tapas: se muestran 3 portadas unos segundos,
// se ocultan, y se pregunta quién escribió UNA de ellas (multiple
// choice con los 3 autores mostrados, mezclados). Si falla, se repite
// con 3 portadas nuevas (siempre al azar, nunca las mismas para todos).
// ────────────────────────────────────────────────────────────

async function _iniciarJuego1() {
  const titulo = document.getElementById('juego-evento-titulo');
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!titulo || !body || !footer) return;

  titulo.textContent = 'Juego 1 · Memoria de tapas';
  footer.innerHTML = '';
  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
      <p style="margin-top:10px;">Preparando las tapas…</p>
    </div>
  `;
  mostrarModal('modal-juego-evento');

  await _jugarRondaJuego1();
}

async function _jugarRondaJuego1() {
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!body || !footer) return;

  const { data: libros, error } = await supabaseClient.rpc('obtener_campanas_azar_para_juego', { p_cantidad: 3 });

  if (error || !libros || libros.length < 3) {
    body.innerHTML = `<p class="estado-vacio-texto">😕 No pudimos cargar el juego. Probá de nuevo en un rato.</p>`;
    return;
  }

  // Evita que dos de los tres autores mostrados sean el mismo texto exacto
  // (rompería el multiple choice). Si pasa, se pide otra tanda a Supabase.
  const autoresUnicos = new Set(libros.map(l => l.nombre_autor));
  if (autoresUnicos.size < 3) {
    return _jugarRondaJuego1();
  }

  footer.innerHTML = '';
  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:14px;">Memorizá estas tapas…</p>
    <div class="juego-tapas-fila" style="display:flex; gap:12px; justify-content:center;">
      ${libros.map(l => `
        <img src="${_escaparHtml(l.link_portada)}" alt="" style="width:100px; height:150px; object-fit:cover; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
      `).join('')}
    </div>
    <div id="juego1-countdown" style="text-align:center; margin-top:14px; font-size:13px; color:var(--gris-suave);"></div>
  `;

  // Countdown visual simple
  let segundosRestantes = Math.ceil(_DURACION_MEMORIZACION_MS / 1000);
  const countdownEl = document.getElementById('juego1-countdown');
  if (countdownEl) countdownEl.textContent = `${segundosRestantes}…`;
  const intervalo = setInterval(() => {
    segundosRestantes -= 1;
    if (countdownEl) countdownEl.textContent = segundosRestantes > 0 ? `${segundosRestantes}…` : '';
    if (segundosRestantes <= 0) clearInterval(intervalo);
  }, 1000);

  await new Promise(resolve => setTimeout(resolve, _DURACION_MEMORIZACION_MS));
  clearInterval(intervalo);

  _mostrarPreguntaJuego1(libros);
}

function _mostrarPreguntaJuego1(libros) {
  const body = document.getElementById('juego-evento-body');
  if (!body) return;

  const libroPreguntado = libros[Math.floor(Math.random() * libros.length)];
  const opciones = _mezclarArrayJuego(libros.map(l => l.nombre_autor));

  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:16px;">
      ¿Quién escribió «${_escaparHtml(libroPreguntado.nombre_libro)}»?
    </p>
    <div id="juego1-opciones" style="display:flex; flex-direction:column; gap:10px;">
      ${opciones.map(autor => `
        <button type="button" class="btn-secundario btn-full" onclick="_responderJuego1('${_escaparAtributoJs(autor)}', '${_escaparAtributoJs(libroPreguntado.nombre_autor)}')">
          ${_escaparHtml(autor)}
        </button>
      `).join('')}
    </div>
    <p id="juego1-feedback" style="text-align:center; margin-top:14px; font-size:14px;"></p>
  `;
}

async function _responderJuego1(respuesta, correcta) {
  const feedback = document.getElementById('juego1-feedback');
  const botones = document.querySelectorAll('#juego1-opciones button');
  botones.forEach(b => b.disabled = true);

  if (respuesta === correcta) {
    if (feedback) feedback.innerHTML = '🌸 ¡Correcto!';

    if (typeof registrarAccionEventoSiCorresponde === 'function') {
      await registrarAccionEventoSiCorresponde('juego1_completado');
    }

    setTimeout(() => {
      cerrarModales();
    }, 1200);
  } else {
    if (feedback) feedback.innerHTML = '😅 No era ese… ¡vamos de nuevo con otras tapas!';
    setTimeout(() => {
      _jugarRondaJuego1();
    }, 1400);
  }
}

// Helper para escapar comillas simples cuando el string va dentro de un
// atributo onclick="..." armado con template literals.
function _escaparAtributoJs(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

EventosJuegos[1] = _iniciarJuego1;
