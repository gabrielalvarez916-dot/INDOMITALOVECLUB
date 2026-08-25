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
const _INTENTOS_JUEGO1 = 4;

let _estadoJuego1 = null;

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
  _estadoJuego1 = { intentosRestantes: _INTENTOS_JUEGO1 };
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
    <p style="text-align:center; font-weight:600; margin-bottom:4px;">Memorizá estas tapas…</p>
    <p style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:14px;">Intentos restantes: <strong>${_estadoJuego1.intentosRestantes}</strong></p>
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
    <p style="text-align:center; font-weight:600; margin-bottom:6px;">
      ¿Quién escribió «${_escaparHtml(libroPreguntado.nombre_libro)}»?
    </p>
    <p style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:12px;">Intentos restantes: <strong>${_estadoJuego1.intentosRestantes}</strong></p>
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
      _mostrarRetoTrasJuego(1);
    }, 1200);
  } else {
    _estadoJuego1.intentosRestantes -= 1;

    if (_estadoJuego1.intentosRestantes <= 0) {
      if (feedback) feedback.innerHTML = '😅 Se acabaron los intentos… ¡otra tanda de tapas!';
      setTimeout(() => {
        _estadoJuego1.intentosRestantes = _INTENTOS_JUEGO1;
        _jugarRondaJuego1();
      }, 1400);
      return;
    }

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

/**
 * Se llama SIEMPRE al ganar cualquier minijuego de evento (juego1 a juego5),
 * en vez de cerrar el modal directamente. Muestra el reto real de esa etapa
 * (el subReto que no es el juego) para que quede visible que existe, aunque
 * ya estuviera cumplido de antes por otra actividad — así nunca "desaparece"
 * sin que el usuario lo vea. Recién al tocar "Entendido" se cierra el modal
 * (con _cerrarModalJuegoEvento, que refresca el progreso y re-renderiza).
 */
async function _mostrarRetoTrasJuego(ordenReto) {
  const titulo = document.getElementById('juego-evento-titulo');
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!titulo || !body || !footer) {
    _cerrarModalJuegoEvento();
    return;
  }

  footer.innerHTML = '';
  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
    </div>
  `;

  await _refrescarProgresoEventoGlobal();
  const progreso = _EventosState.progreso;
  const reto = progreso?.retos?.find(r => r.orden === ordenReto);
  const retoReal = reto?.subRetos?.[1]; // subRetos[0] es siempre el juego

  if (!reto || !retoReal) {
    _cerrarModalJuegoEvento();
    return;
  }

  titulo.textContent = reto.nombre;
  body.innerHTML = `
    <div style="text-align:center; padding:6px 0 10px;">
      <p style="font-size:38px; margin-bottom:6px;">🌸</p>
      <p style="font-weight:600; margin-bottom:10px;">¡Ganaste el juego!</p>
      ${retoReal.completo ? `
        <p>Y ya cumpliste el reto real de esta etapa:</p>
        <p style="margin-top:8px; font-weight:600; color:#1A1A1A;">✓ ${_escaparHtml(retoReal.descripcion)}</p>
        <p style="margin-top:10px; font-size:14px;">¡Etapa completa! 🎉</p>
      ` : `
        <p>Ahora te falta este reto para completar la etapa:</p>
        <p style="margin-top:8px; font-weight:600;">${_escaparHtml(retoReal.descripcion)}</p>
        <p style="margin-top:8px; font-size:13px; color:var(--gris-suave);">${retoReal.cantidadActual}/${retoReal.meta}</p>
      `}
    </div>
  `;
  footer.innerHTML = `<button type="button" class="btn-primario" onclick="_cerrarModalJuegoEvento()">Entendido</button>`;
}

EventosJuegos[1] = _iniciarJuego1;

// ────────────────────────────────────────────────────────────
// JUEGO 2 — Ordenar 4 portadas: se muestran 4 portadas en un orden
// (posiciones 1 a 4) para memorizar. Se mezclan visualmente y cada
// una queda marcada con una letra (A-D) según dónde cayó. Se ocultan.
// Se pregunta, para cada posición ORIGINAL (1 a 4), qué letra le
// correspondía. Si falla, se repite con 4 portadas nuevas al azar.
// ────────────────────────────────────────────────────────────

const _DURACION_FASE_JUEGO2_MS = 5000; // tiempo de cada fase (memorización y mezcla)
const _INTENTOS_JUEGO2 = 4;

let _estadoJuego2 = null;

async function _iniciarJuego2() {
  const titulo = document.getElementById('juego-evento-titulo');
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!titulo || !body || !footer) return;

  titulo.textContent = 'Juego 2 · Ordená las tapas';
  footer.innerHTML = '';
  _estadoJuego2 = { intentosRestantes: _INTENTOS_JUEGO2 };
  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
      <p style="margin-top:10px;">Preparando las tapas…</p>
    </div>
  `;
  mostrarModal('modal-juego-evento');

  await _jugarRondaJuego2();
}

async function _jugarRondaJuego2() {
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!body || !footer) return;

  const { data: libros, error } = await supabaseClient.rpc('obtener_campanas_azar_para_juego', { p_cantidad: 4 });

  if (error || !libros || libros.length < 4) {
    body.innerHTML = `<p class="estado-vacio-texto">😕 No pudimos cargar el juego. Probá de nuevo en un rato.</p>`;
    return;
  }

  footer.innerHTML = '';

  // FASE A: memorización, en el orden correcto (posiciones 1 a 4)
  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:14px;">Memorizá el orden…</p>
    <div class="juego-tapas-fila" style="display:flex; gap:10px; justify-content:center;">
      ${libros.map((l, i) => `
        <div style="text-align:center;">
          <img src="${_escaparHtml(l.link_portada)}" alt="" style="width:80px; height:120px; object-fit:cover; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
          <p style="font-size:12px; color:var(--gris-suave); margin-top:4px;">${i + 1}</p>
        </div>
      `).join('')}
    </div>
    <div id="juego2-countdown-a" style="text-align:center; margin-top:14px; font-size:13px; color:var(--gris-suave);"></div>
  `;
  await _countdownJuego2('juego2-countdown-a', _DURACION_FASE_JUEGO2_MS);

  // FASE B: se mezclan (sin ninguna marca de posición) durante un instante,
  // y después pasa directo a la pantalla de armar el orden arrastrando.
  const ordenMezclado = _mezclarArrayJuego(libros.map((_, i) => i)); // array de índices originales, en el nuevo orden visual
  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:14px;">¡Se mezclaron!…</p>
    <div class="juego-tapas-fila" style="display:flex; gap:10px; justify-content:center;">
      ${ordenMezclado.map(idxOriginal => `
        <img src="${_escaparHtml(libros[idxOriginal].link_portada)}" alt="" style="width:80px; height:120px; object-fit:cover; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
      `).join('')}
    </div>
    <div id="juego2-countdown-b" style="text-align:center; margin-top:14px; font-size:13px; color:var(--gris-suave);"></div>
  `;
  await _countdownJuego2('juego2-countdown-b', _DURACION_FASE_JUEGO2_MS);

  _estadoJuego2.libros = libros; // índice original i = posición correcta de libros[i]
  _estadoJuego2.ordenActual = ordenMezclado; // ordenActual[slot] = índice original que está hoy en ese slot

  _renderTableroJuego2();
}

function _countdownJuego2(idContenedor, duracionMs) {
  return new Promise(resolve => {
    let segundosRestantes = Math.ceil(duracionMs / 1000);
    const el = document.getElementById(idContenedor);
    if (el) el.textContent = `${segundosRestantes}…`;
    const intervalo = setInterval(() => {
      segundosRestantes -= 1;
      if (el) el.textContent = segundosRestantes > 0 ? `${segundosRestantes}…` : '';
      if (segundosRestantes <= 0) clearInterval(intervalo);
    }, 1000);
    setTimeout(() => {
      clearInterval(intervalo);
      resolve();
    }, duracionMs);
  });
}

/**
 * Dibuja las 4 tapas en su orden actual (_estadoJuego2.ordenActual), cada
 * una arrastrable con mouse o dedo. Arrastrar una tapa sobre otra las
 * intercambia de lugar. El objetivo es dejarlas en el orden original.
 */
function _renderTableroJuego2() {
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!body || !footer || !_estadoJuego2) return;

  const { libros, ordenActual, intentosRestantes } = _estadoJuego2;

  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:6px;">Arrastrá las tapas para volver a dejarlas en el orden original</p>
    <p style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:12px;">Intentos restantes: <strong>${intentosRestantes}</strong></p>
    <div id="juego2-tablero" class="juego-tapas-fila" style="display:flex; gap:10px; justify-content:center;">
      ${ordenActual.map((idxOriginal, slot) => `
        <img src="${_escaparHtml(libros[idxOriginal].link_portada)}" alt=""
          class="juego2-carta-drag" draggable="true" data-slot="${slot}"
          ondragstart="_dragJuego2Start(event, ${slot})"
          ondragover="_dragJuego2Over(event)"
          ondrop="_dragJuego2Drop(event, ${slot})"
          ondragend="_dragJuego2End(event)"
          style="width:80px; height:120px; object-fit:cover; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15); cursor:grab; touch-action:none;" />
      `).join('')}
    </div>
    <p id="juego2-feedback" style="text-align:center; margin-top:14px; font-size:14px;"></p>
  `;

  // Soporte táctil: los eventos "drag" nativos no disparan en la mayoría
  // de los navegadores móviles, así que se agrega arrastre por punteros
  // (mouse y dedo) que intercambia la tapa soltada con la que tiene debajo.
  const tablero = document.getElementById('juego2-tablero');
  if (tablero) {
    tablero.querySelectorAll('.juego2-carta-drag').forEach(carta => {
      carta.addEventListener('pointerdown', _dragJuego2PointerDown);
    });
  }

  footer.innerHTML = `
    <button type="button" class="btn-primario" onclick="_confirmarJuego2()">Confirmar orden</button>
  `;
}

function _intercambiarSlotsJuego2(slotA, slotB) {
  if (slotA === slotB || !_estadoJuego2) return;
  const { ordenActual } = _estadoJuego2;
  [ordenActual[slotA], ordenActual[slotB]] = [ordenActual[slotB], ordenActual[slotA]];
  _renderTableroJuego2();
}

// ── Drag & drop nativo (desktop) ──
let _juego2SlotArrastrado = null;

function _dragJuego2Start(e, slot) {
  _juego2SlotArrastrado = slot;
  e.dataTransfer.effectAllowed = 'move';
}
function _dragJuego2Over(e) {
  e.preventDefault();
}
function _dragJuego2Drop(e, slotDestino) {
  e.preventDefault();
  if (_juego2SlotArrastrado === null) return;
  _intercambiarSlotsJuego2(_juego2SlotArrastrado, slotDestino);
  _juego2SlotArrastrado = null;
}
function _dragJuego2End() {
  _juego2SlotArrastrado = null;
}

// ── Arrastre por puntero (funciona también con el dedo en el celular) ──
function _dragJuego2PointerDown(e) {
  const origen = e.currentTarget;
  const slotOrigen = parseInt(origen.dataset.slot, 10);
  origen.setPointerCapture(e.pointerId);
  origen.style.zIndex = '5';
  origen.style.cursor = 'grabbing';
  const startX = e.clientX;
  const startY = e.clientY;

  const mover = (ev) => {
    origen.style.transform = `translate(${ev.clientX - startX}px, ${ev.clientY - startY}px)`;
  };
  const soltar = (ev) => {
    origen.removeEventListener('pointermove', mover);
    origen.removeEventListener('pointerup', soltar);
    origen.style.transform = '';
    origen.style.zIndex = '';
    origen.style.cursor = 'grab';

    origen.style.pointerEvents = 'none';
    const destino = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.juego2-carta-drag');
    origen.style.pointerEvents = '';

    if (destino) {
      const slotDestino = parseInt(destino.dataset.slot, 10);
      _intercambiarSlotsJuego2(slotOrigen, slotDestino);
    }
  };

  origen.addEventListener('pointermove', mover);
  origen.addEventListener('pointerup', soltar);
}

async function _confirmarJuego2() {
  const feedback = document.getElementById('juego2-feedback');
  if (!_estadoJuego2) return;

  const esCorrecto = _estadoJuego2.ordenActual.every((idxOriginal, slot) => idxOriginal === slot);

  const footer = document.getElementById('juego-evento-footer');
  if (footer) footer.innerHTML = '';

  if (esCorrecto) {
    if (feedback) feedback.innerHTML = '🌸 ¡Correcto!';

    if (typeof registrarAccionEventoSiCorresponde === 'function') {
      await registrarAccionEventoSiCorresponde('juego2_completado');
    }

    setTimeout(() => {
      _mostrarRetoTrasJuego(2);
    }, 1200);
  } else {
    _estadoJuego2.intentosRestantes -= 1;

    if (_estadoJuego2.intentosRestantes <= 0) {
      if (feedback) feedback.innerHTML = '😅 Se acabaron los intentos… ¡otra tanda de tapas!';
      setTimeout(() => {
        _estadoJuego2.intentosRestantes = _INTENTOS_JUEGO2;
        _jugarRondaJuego2();
      }, 1400);
      return;
    }

    if (feedback) feedback.innerHTML = '😅 No era ese orden… ¡vamos de nuevo con otras tapas!';
    setTimeout(() => {
      _jugarRondaJuego2();
    }, 1400);
  }
}

EventosJuegos[2] = _iniciarJuego2;

// ────────────────────────────────────────────────────────────
// JUEGO 3 — Memotest: 8 portadas (16 cartas, cada una x2), hay que
// encontrar los 8 pares. Se voltean de a dos por click. Cada PAR
// FALLIDO descuenta 1 de los 4 intentos disponibles. Si se agotan
// los intentos sin completar el tablero, se resetea todo con un
// set nuevo de 8 portadas al azar (siempre distintas para cada
// usuario, sin persistencia entre sesiones).
// ────────────────────────────────────────────────────────────

const _INTENTOS_JUEGO3 = 8;

// Estado del juego en curso (se recrea en cada _jugarRondaJuego3)
let _estadoJuego3 = null;

async function _iniciarJuego3() {
  const titulo = document.getElementById('juego-evento-titulo');
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!titulo || !body || !footer) return;

  titulo.textContent = 'Juego 3 · Encontrá las parejas';
  footer.innerHTML = '';
  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
      <p style="margin-top:10px;">Preparando las tapas…</p>
    </div>
  `;
  mostrarModal('modal-juego-evento');

  await _jugarRondaJuego3();
}

async function _jugarRondaJuego3() {
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!body || !footer) return;

  const { data: libros, error } = await supabaseClient.rpc('obtener_campanas_azar_para_juego', { p_cantidad: 8 });

  if (error || !libros || libros.length < 8) {
    body.innerHTML = `<p class="estado-vacio-texto">😕 No pudimos cargar el juego. Probá de nuevo en un rato.</p>`;
    return;
  }

  // Cada portada aparece 2 veces (idPar identifica el par al que pertenece)
  const cartasSinMezclar = [];
  libros.slice(0, 8).forEach((libro, idPar) => {
    cartasSinMezclar.push({ idPar, link_portada: libro.link_portada });
    cartasSinMezclar.push({ idPar, link_portada: libro.link_portada });
  });

  _estadoJuego3 = {
    cartas: _mezclarArrayJuego(cartasSinMezclar),
    volteadas: [],       // índices de las cartas boca arriba en este intento (máx 2)
    encontradas: new Set(), // índices de cartas ya emparejadas (quedan boca arriba)
    intentosRestantes: _INTENTOS_JUEGO3,
    bloqueado: false,    // true mientras se resuelve un par (evita clicks de más)
  };

  footer.innerHTML = '';
  _renderTableroJuego3();
}

function _renderTableroJuego3() {
  const body = document.getElementById('juego-evento-body');
  if (!body || !_estadoJuego3) return;

  const { cartas, volteadas, encontradas, intentosRestantes } = _estadoJuego3;

  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:6px;">Encontrá las 8 parejas</p>
    <p id="juego3-intentos" style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:14px;">
      Intentos restantes: <strong>${intentosRestantes}</strong>
    </p>
    <div class="juego3-grilla" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; max-width:340px; margin:0 auto;">
      ${cartas.map((carta, idx) => {
        const boca = volteadas.includes(idx) || encontradas.has(idx);
        return `
          <div class="juego3-carta" onclick="_voltearCartaJuego3(${idx})" style="aspect-ratio:2/3; border-radius:8px; cursor:${boca || encontradas.has(idx) ? 'default' : 'pointer'}; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.15); ${encontradas.has(idx) ? 'opacity:0.55;' : ''}">
            ${boca
              ? `<img src="${_escaparHtml(carta.link_portada)}" alt="" style="width:100%; height:100%; object-fit:cover;" />`
              : `<div style="width:100%; height:100%; background:var(--bordo); display:flex; align-items:center; justify-content:center; font-size:22px;">🌸</div>`}
          </div>
        `;
      }).join('')}
    </div>
    <p id="juego3-feedback" style="text-align:center; margin-top:14px; font-size:14px;"></p>
  `;
}

async function _voltearCartaJuego3(idx) {
  const estado = _estadoJuego3;
  if (!estado || estado.bloqueado) return;
  if (estado.encontradas.has(idx) || estado.volteadas.includes(idx)) return;

  estado.volteadas.push(idx);
  _renderTableroJuego3();

  if (estado.volteadas.length < 2) return;

  estado.bloqueado = true;
  const [i1, i2] = estado.volteadas;
  const esPareja = estado.cartas[i1].idPar === estado.cartas[i2].idPar;
  const feedback = document.getElementById('juego3-feedback');

  if (esPareja) {
    estado.encontradas.add(i1);
    estado.encontradas.add(i2);
    estado.volteadas = [];
    estado.bloqueado = false;

    if (feedback) feedback.textContent = '🌸 ¡Pareja encontrada!';

    if (estado.encontradas.size === estado.cartas.length) {
      // Tablero completo
      if (feedback) feedback.innerHTML = '🌸 ¡Completaste el memotest!';
      if (typeof registrarAccionEventoSiCorresponde === 'function') {
        await registrarAccionEventoSiCorresponde('juego3_completado');
      }
      setTimeout(() => {
        _mostrarRetoTrasJuego(3);
      }, 1200);
      return;
    }

    _renderTableroJuego3();
    return;
  }

  // No es pareja: descuenta un intento
  estado.intentosRestantes -= 1;
  if (feedback) feedback.textContent = '😅 No coinciden…';

  await new Promise(resolve => setTimeout(resolve, 900));

  if (estado.intentosRestantes <= 0) {
    if (feedback) feedback.textContent = '😅 Se acabaron los intentos… ¡otra tanda de tapas!';
    setTimeout(() => {
      _jugarRondaJuego3();
    }, 1200);
    return;
  }

  estado.volteadas = [];
  estado.bloqueado = false;
  _renderTableroJuego3();
}

EventosJuegos[3] = _iniciarJuego3;

// ────────────────────────────────────────────────────────────
// JUEGO 4 — Unir tropes con portadas: 2 portadas, cada una con 2
// tropes REALES (los que la campaña tiene cargados en el catálogo
// de tropes). Se muestran los 4 tropes mezclados abajo y hay que
// arrastrar cada uno hasta la portada correcta. 4 intentos (se
// descuenta 1 por cada arrastre a la portada equivocada). Si se
// agotan, se resetea con 2 portadas nuevas (mismo criterio que
// Juego 3).
// ────────────────────────────────────────────────────────────

const _INTENTOS_JUEGO4 = 4;
const _CANDIDATOS_JUEGO4 = 12; // se piden de más porque no todas las campañas tienen 2+ tropes cargados

let _estadoJuego4 = null;

async function _iniciarJuego4() {
  const titulo = document.getElementById('juego-evento-titulo');
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!titulo || !body || !footer) return;

  titulo.textContent = 'Juego 4 · Uní los tropes con la portada';
  footer.innerHTML = '';
  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
      <p style="margin-top:10px;">Preparando las tapas…</p>
    </div>
  `;
  mostrarModal('modal-juego-evento');

  await _jugarRondaJuego4();
}

// Busca 2 campañas al azar que tengan al menos 2 tropes reales cargados.
// Reintenta pidiendo tandas nuevas si las primeras candidatas no alcanzan.
async function _buscarPortadasConTropesJuego4(intentosBusqueda = 4) {
  for (let i = 0; i < intentosBusqueda; i++) {
    const { data: candidatas, error } = await supabaseClient.rpc('obtener_campanas_azar_para_juego', { p_cantidad: _CANDIDATOS_JUEGO4 });
    if (error || !candidatas || candidatas.length === 0) continue;

    const { data: tropesRaw, error: errorTropes } = await supabaseClient
      .from('campana_tropes')
      .select('id_campana, tropes ( nombre )')
      .in('id_campana', candidatas.map(c => c.id_campana));
    if (errorTropes) continue;

    const tropesPorCampana = {};
    (tropesRaw || []).forEach(fila => {
      const nombre = fila.tropes?.nombre;
      if (!nombre) return;
      if (!tropesPorCampana[fila.id_campana]) tropesPorCampana[fila.id_campana] = [];
      tropesPorCampana[fila.id_campana].push(nombre);
    });

    const candidatasConTropes = candidatas.filter(c => (tropesPorCampana[c.id_campana] || []).length >= 2);
    if (candidatasConTropes.length < 2) continue;

    const elegidas = _mezclarArrayJuego(candidatasConTropes).slice(0, 2);
    return elegidas.map(c => ({
      id_campana: c.id_campana,
      link_portada: c.link_portada,
      tropesReales: _mezclarArrayJuego(tropesPorCampana[c.id_campana]).slice(0, 2),
    }));
  }
  return null;
}

async function _jugarRondaJuego4() {
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!body || !footer) return;

  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
      <p style="margin-top:10px;">Preparando las tapas…</p>
    </div>
  `;

  const portadas = await _buscarPortadasConTropesJuego4();
  if (!portadas) {
    body.innerHTML = `<p class="estado-vacio-texto">😕 No pudimos cargar el juego. Probá de nuevo en un rato.</p>`;
    return;
  }

  const tropesJuego = _mezclarArrayJuego(
    portadas.flatMap(p => p.tropesReales.map(nombre => ({ nombre, id_campana: p.id_campana, colocado: false })))
  );

  _estadoJuego4 = {
    portadas,
    tropes: tropesJuego,
    intentosRestantes: _INTENTOS_JUEGO4,
  };

  footer.innerHTML = '';
  _renderTableroJuego4();
}

function _renderTableroJuego4() {
  const body = document.getElementById('juego-evento-body');
  if (!body || !_estadoJuego4) return;

  const { portadas, tropes, intentosRestantes } = _estadoJuego4;

  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:6px;">Arrastrá cada trope hasta la portada correcta</p>
    <p id="juego4-intentos" style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:14px;">
      Intentos restantes: <strong>${intentosRestantes}</strong>
    </p>
    <div class="juego4-portadas" style="display:flex; gap:20px; justify-content:center; margin-bottom:18px;">
      ${portadas.map(p => `
        <div class="juego4-portada-drop"
             data-campana="${p.id_campana}"
             ondragover="event.preventDefault()"
             ondrop="_soltarTropeJuego4(event, '${p.id_campana}')"
             style="text-align:center; width:110px;">
          <img src="${_escaparHtml(p.link_portada)}" alt="" style="width:110px; height:165px; object-fit:cover; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
          <div id="juego4-colocados-${p.id_campana}" style="margin-top:8px; display:flex; flex-direction:column; gap:4px; min-height:26px;">
            ${tropes.filter(t => t.colocado && t.id_campana === p.id_campana).map(t => `
              <span style="font-size:12px; background:var(--verde-suave, #dff0e0); border-radius:12px; padding:3px 8px;">✓ ${_escaparHtml(t.nombre)}</span>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <div id="juego4-pool" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; min-height:40px;">
      ${tropes.map((t, idx) => t.colocado ? '' : `
        <div class="juego4-trope-chip"
             draggable="true"
             data-idx="${idx}"
             ondragstart="event.dataTransfer.setData('text/plain', '${idx}')"
             style="padding:8px 14px; border-radius:20px; background:var(--rosa-suave, #f7d9e3); border:1px solid var(--bordo); font-size:13px; cursor:grab; touch-action:none;">
          ${_escaparHtml(t.nombre)}
        </div>
      `).join('')}
    </div>
    <p id="juego4-feedback" style="text-align:center; margin-top:14px; font-size:14px;"></p>
  `;

  // Soporte táctil: igual que en el juego 2, los eventos "drag" nativos
  // no disparan en la mayoría de los navegadores móviles, así que se
  // agrega arrastre por punteros (mouse y dedo) para soltar el trope
  // sobre la portada correspondiente.
  const pool = document.getElementById('juego4-pool');
  if (pool) {
    pool.querySelectorAll('.juego4-trope-chip').forEach(chip => {
      chip.addEventListener('pointerdown', _dragJuego4PointerDown);
    });
  }
}

// ── Arrastre por puntero (funciona también con el dedo en el celular) ──
function _dragJuego4PointerDown(e) {
  const origen = e.currentTarget;
  const idx = parseInt(origen.dataset.idx, 10);
  origen.setPointerCapture(e.pointerId);
  origen.style.zIndex = '5';
  origen.style.position = 'relative';
  origen.style.cursor = 'grabbing';
  const startX = e.clientX;
  const startY = e.clientY;

  const mover = (ev) => {
    origen.style.transform = `translate(${ev.clientX - startX}px, ${ev.clientY - startY}px)`;
  };
  const soltar = (ev) => {
    origen.removeEventListener('pointermove', mover);
    origen.removeEventListener('pointerup', soltar);
    origen.style.transform = '';
    origen.style.zIndex = '';
    origen.style.cursor = 'grab';

    origen.style.pointerEvents = 'none';
    const destino = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.juego4-portada-drop');
    origen.style.pointerEvents = '';

    if (destino) {
      _resolverSoltadaTropeJuego4(idx, destino.dataset.campana);
    }
  };

  origen.addEventListener('pointermove', mover);
  origen.addEventListener('pointerup', soltar);
}

async function _soltarTropeJuego4(event, idCampanaDestino) {
  event.preventDefault();
  const idx = parseInt(event.dataTransfer.getData('text/plain'), 10);
  await _resolverSoltadaTropeJuego4(idx, idCampanaDestino);
}

async function _resolverSoltadaTropeJuego4(idx, idCampanaDestino) {
  const estado = _estadoJuego4;
  if (!estado) return;

  const trope = estado.tropes[idx];
  if (!trope || trope.colocado) return;

  const feedback = document.getElementById('juego4-feedback');

  if (trope.id_campana === idCampanaDestino) {
    trope.colocado = true;
    if (feedback) feedback.textContent = '🌸 ¡Correcto!';

    const faltan = estado.tropes.some(t => !t.colocado);
    if (!faltan) {
      if (feedback) feedback.innerHTML = '🌸 ¡Completaste el juego!';
      if (typeof registrarAccionEventoSiCorresponde === 'function') {
        await registrarAccionEventoSiCorresponde('juego4_completado');
      }
      setTimeout(() => {
        _mostrarRetoTrasJuego(4);
      }, 1200);
      return;
    }

    _renderTableroJuego4();
    return;
  }

  // Trope equivocado para esa portada
  estado.intentosRestantes -= 1;
  if (feedback) feedback.textContent = '😅 Te equivocaste…';

  if (estado.intentosRestantes <= 0) {
    if (feedback) feedback.textContent = '😅 Se acabaron los intentos… ¡otra tanda de tapas!';
    setTimeout(() => {
      _jugarRondaJuego4();
    }, 1200);
    return;
  }

  const intentosEl = document.getElementById('juego4-intentos');
  if (intentosEl) intentosEl.innerHTML = `Intentos restantes: <strong>${estado.intentosRestantes}</strong>`;
}

EventosJuegos[4] = _iniciarJuego4;

// ────────────────────────────────────────────────────────────
// JUEGO 5 — Memoria rápida: aparecen 6 portadas reales, una atrás de
// otra, 2 segundos cada una (sin volver a mostrarse). Después, 2
// preguntas multiple choice ("¿cuál de estos títulos viste recién?"),
// cada una sobre un libro distinto de los 6. Hay que acertar las 2.
// 4 intentos en total (se descuenta 1 por cada respuesta incorrecta,
// en cualquiera de las 2 preguntas); si se agotan, resetea todo con
// 6 portadas nuevas.
// ────────────────────────────────────────────────────────────

const _DURACION_TAPA_JUEGO5_MS = 2000;
const _INTENTOS_JUEGO5 = 4;
const _CANTIDAD_TAPAS_JUEGO5 = 6;
const _CANTIDAD_PREGUNTAS_JUEGO5 = 2;
const _CANDIDATOS_DISTRACTORES_JUEGO5 = 10;

let _estadoJuego5 = null;

async function _iniciarJuego5() {
  const titulo = document.getElementById('juego-evento-titulo');
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!titulo || !body || !footer) return;

  titulo.textContent = 'Juego 5 · Memoria rápida';
  footer.innerHTML = '';
  body.innerHTML = `
    <div class="juego-evento-cargando" style="text-align:center; padding:30px 0;">
      <div class="spinner"></div>
      <p style="margin-top:10px;">Preparando las tapas…</p>
    </div>
  `;
  mostrarModal('modal-juego-evento');

  await _jugarRondaJuego5();
}

async function _jugarRondaJuego5() {
  const body = document.getElementById('juego-evento-body');
  const footer = document.getElementById('juego-evento-footer');
  if (!body || !footer) return;
  footer.innerHTML = '';

  const { data: libros, error } = await supabaseClient.rpc('obtener_campanas_azar_para_juego', { p_cantidad: _CANTIDAD_TAPAS_JUEGO5 });
  if (error || !libros || libros.length < _CANTIDAD_TAPAS_JUEGO5) {
    body.innerHTML = `<p class="estado-vacio-texto">😕 No pudimos cargar el juego. Probá de nuevo en un rato.</p>`;
    return;
  }

  const { data: pool, error: errorPool } = await supabaseClient.rpc('obtener_campanas_azar_para_juego', { p_cantidad: _CANDIDATOS_DISTRACTORES_JUEGO5 });
  const titulosVistos = new Set(libros.map(l => l.nombre_libro));
  const poolDistractores = (pool || []).filter(l => !titulosVistos.has(l.nombre_libro));
  if (errorPool || poolDistractores.length < 3) {
    body.innerHTML = `<p class="estado-vacio-texto">😕 No pudimos cargar el juego. Probá de nuevo en un rato.</p>`;
    return;
  }

  // Arma las 2 preguntas: 2 libros distintos (al azar) de los 6 vistos,
  // cada uno con 3 títulos distractores (que NO estaban entre los 6).
  const librosPreguntados = _mezclarArrayJuego(libros).slice(0, _CANTIDAD_PREGUNTAS_JUEGO5);
  const distractoresMezclados = _mezclarArrayJuego(poolDistractores);
  const preguntas = librosPreguntados.map((libroCorrecto, i) => {
    const distractores = distractoresMezclados.slice(i * 3, i * 3 + 3).map(l => l.nombre_libro);
    return {
      tituloCorrecto: libroCorrecto.nombre_libro,
      opciones: _mezclarArrayJuego([libroCorrecto.nombre_libro, ...distractores]),
    };
  });

  _estadoJuego5 = {
    preguntas,
    preguntaActual: 0,
    intentosRestantes: _INTENTOS_JUEGO5,
  };

  // Muestra las 6 tapas, una atrás de otra, 2 segundos cada una.
  for (let i = 0; i < libros.length; i++) {
    const libro = libros[i];
    body.innerHTML = `
      <p style="text-align:center; font-weight:600; margin-bottom:4px;">Memorizá estas tapas…</p>
      <p style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:14px;">Tapa ${i + 1} de ${libros.length}</p>
      <div style="display:flex; justify-content:center;">
        <img src="${_escaparHtml(libro.link_portada)}" alt="" style="width:130px; height:195px; object-fit:cover; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
      </div>
    `;
    await new Promise(resolve => setTimeout(resolve, _DURACION_TAPA_JUEGO5_MS));
  }

  _renderPreguntaJuego5();
}

function _renderPreguntaJuego5() {
  const body = document.getElementById('juego-evento-body');
  if (!body || !_estadoJuego5) return;

  const { preguntas, preguntaActual, intentosRestantes } = _estadoJuego5;
  const pregunta = preguntas[preguntaActual];

  body.innerHTML = `
    <p style="text-align:center; font-weight:600; margin-bottom:6px;">
      Pregunta ${preguntaActual + 1} de ${preguntas.length}: ¿cuál de estos títulos viste recién?
    </p>
    <p style="text-align:center; font-size:13px; color:var(--gris-suave); margin-bottom:12px;">Intentos restantes: <strong>${intentosRestantes}</strong></p>
    <div id="juego5-opciones" style="display:flex; flex-direction:column; gap:10px;">
      ${pregunta.opciones.map(titulo => `
        <button type="button" class="btn-secundario btn-full" onclick="_responderJuego5('${_escaparAtributoJs(titulo)}', '${_escaparAtributoJs(pregunta.tituloCorrecto)}')">
          ${_escaparHtml(titulo)}
        </button>
      `).join('')}
    </div>
    <p id="juego5-feedback" style="text-align:center; margin-top:14px; font-size:14px;"></p>
  `;
}

async function _responderJuego5(respuesta, correcta) {
  const estado = _estadoJuego5;
  if (!estado) return;

  const feedback = document.getElementById('juego5-feedback');
  const botones = document.querySelectorAll('#juego5-opciones button');
  botones.forEach(b => b.disabled = true);

  if (respuesta === correcta) {
    if (estado.preguntaActual + 1 >= estado.preguntas.length) {
      if (feedback) feedback.innerHTML = '🌸 ¡Correcto! Completaste el juego.';
      if (typeof registrarAccionEventoSiCorresponde === 'function') {
        await registrarAccionEventoSiCorresponde('juego5_completado');
      }
      setTimeout(() => {
        _mostrarRetoTrasJuego(5);
      }, 1200);
      return;
    }

    if (feedback) feedback.innerHTML = '🌸 ¡Correcto!';
    estado.preguntaActual += 1;
    setTimeout(() => {
      _renderPreguntaJuego5();
    }, 900);
    return;
  }

  estado.intentosRestantes -= 1;

  if (estado.intentosRestantes <= 0) {
    if (feedback) feedback.innerHTML = '😅 Se acabaron los intentos… ¡otra tanda de tapas!';
    setTimeout(() => {
      _jugarRondaJuego5();
    }, 1400);
    return;
  }

  if (feedback) feedback.innerHTML = '😅 No era ese… ¡probá de nuevo!';
  setTimeout(() => {
    _renderPreguntaJuego5();
  }, 1400);
}

EventosJuegos[5] = _iniciarJuego5;

