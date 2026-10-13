// ============================================================
// audiolibro-campana.js — Indómita Love Club (web)
// Audiolibro como extra de una campaña. Solo se escucha dentro de la
// plataforma: no hay descarga. Backend: edge function audiolibro-campana
// y las funciones capitulos_audio_campana / guardar_progreso_audio /
// configurar_audio_campana.
// ============================================================

var AC_MAX_CAP_MB = 120;
var AC_MAX_TOTAL_MB = 400;
var AC_MAX_CAPITULOS = 150;

var _acPedidosListos = [];

// ────────────────────────────────────────────────────────────
// AUTOR · bloque "🎧 Audiolibro" en Nueva campaña
// ────────────────────────────────────────────────────────────

function acModo() {
  return document.querySelector('input[name="nc-audio-modo"]:checked')?.value || 'ninguno';
}

function _acNormalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function acInicializarBloque() {
  const bloque = document.getElementById('nc-audio-bloque');
  if (!bloque) return;

  const ninguno = document.querySelector('input[name="nc-audio-modo"][value="ninguno"]');
  if (ninguno) ninguno.checked = true;
  const derechos = document.getElementById('nc-audio-derechos');
  if (derechos) derechos.checked = false;
  const archivos = document.getElementById('nc-audio-archivos');
  if (archivos) archivos.value = '';
  const lista = document.getElementById('nc-audio-lista');
  if (lista) lista.innerHTML = '';
  const progreso = document.getElementById('nc-audio-progreso');
  if (progreso) { progreso.style.display = 'none'; progreso.textContent = ''; }
  acCambioModo();

  // Pedidos de Indómita listos del autor (la política RLS ya filtra los propios)
  _acPedidosListos = [];
  try {
    const { data } = await supabaseClient
      .from('audiolibro_pedidos')
      .select('id, titulo, libro_id')
      .eq('estado', 'listo')
      .order('created_at', { ascending: false });
    _acPedidosListos = data || [];
  } catch (e) {
    console.error('Error cargando audiolibros listos:', e);
  }

  const sel = document.getElementById('nc-audio-pedido');
  if (sel) {
    sel.innerHTML = _acPedidosListos.length
      ? '<option value="">Elegí el audiolibro…</option>' +
        _acPedidosListos.map(p => `<option value="${p.id}">${String(p.titulo || 'Audiolibro').replace(/</g, '&lt;')}</option>`).join('')
      : '<option value="">Todavía no tenés audiolibros listos</option>';
  }
  const radioIndomita = document.querySelector('input[name="nc-audio-modo"][value="indomita"]');
  if (radioIndomita) radioIndomita.disabled = _acPedidosListos.length === 0;

  if (!bloque.dataset.eventos) {
    bloque.dataset.eventos = '1';
    document.getElementById('nc-nombre-libro')?.addEventListener('input', acActualizarSugerencia);
    document.getElementById('nc-libro-selector')?.addEventListener('change', () => setTimeout(acActualizarSugerencia, 50));
  }
  acActualizarSugerencia();
}

function _acPedidoSugerido() {
  if (!_acPedidosListos.length) return null;
  const idLibro = document.getElementById('nc-libro-selector')?.value || '';
  const nombre = _acNormalizar(document.getElementById('nc-nombre-libro')?.value);
  return (
    _acPedidosListos.find(p => idLibro && p.libro_id === idLibro) ||
    _acPedidosListos.find(p => nombre && _acNormalizar(p.titulo) === nombre) ||
    null
  );
}

function acActualizarSugerencia() {
  const caja = document.getElementById('nc-audio-sugerencia');
  const texto = document.getElementById('nc-audio-sugerencia-texto');
  if (!caja || !texto) return;
  if (acModo() !== 'ninguno' || !_acPedidosListos.length) { caja.style.display = 'none'; return; }
  const p = _acPedidoSugerido();
  texto.textContent = p
    ? `🎧 Tenés un audiolibro listo de “${p.titulo}”. ¿Querés sumarlo a esta campaña?`
    : '🎧 Tenés un audiolibro listo hecho en Indómita. ¿Querés sumarlo a esta campaña?';
  caja.style.display = 'flex';
}

function acAceptarSugerencia() {
  const radio = document.querySelector('input[name="nc-audio-modo"][value="indomita"]');
  if (!radio || radio.disabled) return;
  radio.checked = true;
  const p = _acPedidoSugerido() || (_acPedidosListos.length === 1 ? _acPedidosListos[0] : null);
  const sel = document.getElementById('nc-audio-pedido');
  if (sel && p) sel.value = p.id;
  acCambioModo();
}

function acCambioModo() {
  const modo = acModo();
  const indomita = document.getElementById('nc-audio-panel-indomita');
  const propio = document.getElementById('nc-audio-panel-propio');
  if (indomita) indomita.style.display = modo === 'indomita' ? 'block' : 'none';
  if (propio) propio.style.display = modo === 'propio' ? 'block' : 'none';
  acActualizarSugerencia();
}

function _acArchivosOrdenados() {
  const input = document.getElementById('nc-audio-archivos');
  const files = Array.from(input?.files || []);
  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

function acMostrarLista() {
  const lista = document.getElementById('nc-audio-lista');
  if (!lista) return;
  const files = _acArchivosOrdenados();
  lista.innerHTML = files.map((f, i) =>
    `<div style="font-size:13px;">${i + 1}. ${f.name.replace(/</g, '&lt;')} <span style="color:var(--gris-suave);">(${(f.size / 1048576).toFixed(1)} MB)</span></div>`
  ).join('');
}

/** Devuelve un mensaje de error o null. Se llama ANTES de crear la campaña. */
function acValidarAntesDeCrear() {
  const modo = acModo();
  if (modo === 'ninguno') return null;

  if (modo === 'indomita') {
    return document.getElementById('nc-audio-pedido')?.value ? null : 'Elegí cuál de tus audiolibros querés sumar a la campaña.';
  }

  const files = _acArchivosOrdenados();
  if (!files.length) return 'Subí al menos un capítulo en mp3 o elegí “No incluir audiolibro”.';
  if (files.length > AC_MAX_CAPITULOS) return `El audiolibro puede tener hasta ${AC_MAX_CAPITULOS} capítulos.`;
  if (!document.getElementById('nc-audio-derechos')?.checked) return 'Tenés que declarar que tenés los derechos de este audio.';
  let total = 0;
  for (const f of files) {
    const esMp3 = f.type === 'audio/mpeg' || /\.mp3$/i.test(f.name);
    if (!esMp3) return `“${f.name}” no es un mp3. Subí los capítulos en formato mp3 (uno por capítulo).`;
    if (f.size > AC_MAX_CAP_MB * 1048576) return `“${f.name}” pesa más de ${AC_MAX_CAP_MB} MB. Comprimilo o dividilo en capítulos más cortos.`;
    total += f.size;
  }
  if (total > AC_MAX_TOTAL_MB * 1048576) return `El audiolibro completo puede pesar hasta ${AC_MAX_TOTAL_MB} MB.`;
  return null;
}

function _acLeerDuracion(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(a.duration)); };
    a.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No pudimos leer “${file.name}”. ¿Es un mp3 válido?`)); };
    a.src = url;
  });
}

function _acSubirConProgreso(url, file, contentType, onProgreso) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Error al subir el audio (HTTP ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error('Se cortó la conexión al subir el audio.'));
    xhr.send(file);
  });
}

async function _acInvocar(accion, body) {
  const { data, error } = await supabaseClient.functions.invoke('audiolibro-campana', { body: { accion, ...body } });
  if (error || !data?.ok) {
    let msg = data?.error;
    if (!msg && error?.context && typeof error.context.json === 'function') {
      try { msg = (await error.context.json())?.error; } catch (e) {}
    }
    throw new Error(msg || 'No se pudo completar la operación del audiolibro.');
  }
  return data;
}

/**
 * Asocia el audio elegido a la campaña ya creada.
 * El audio es un extra: si algo falla, la campaña queda publicada sin audio
 * y se devuelve un aviso para mostrarle al autor.
 * @returns {Promise<{ok:boolean, aviso?:string}>}
 */
async function acAplicarACampana(idCampana) {
  const modo = acModo();
  if (modo === 'ninguno') return { ok: true };
  const progreso = document.getElementById('nc-audio-progreso');
  const mostrar = (t) => { if (progreso) { progreso.style.display = 'block'; progreso.textContent = t; } };

  try {
    if (modo === 'indomita') {
      const { error } = await supabaseClient.rpc('configurar_audio_campana', {
        p_id_campana: idCampana,
        p_origen: 'indomita',
        p_id_pedido: document.getElementById('nc-audio-pedido').value
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error: errCfg } = await supabaseClient.rpc('configurar_audio_campana', {
      p_id_campana: idCampana, p_origen: 'propio', p_derechos: true
    });
    if (errCfg) throw new Error(errCfg.message);

    const files = _acArchivosOrdenados();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const numero = i + 1;
      const etiqueta = `capítulo ${numero} de ${files.length}`;
      mostrar(`Preparando ${etiqueta}…`);
      const duracion = await _acLeerDuracion(f);
      const pre = await _acInvocar('presignar_subida', { id_campana: idCampana, numero, tamano_bytes: f.size });
      await _acSubirConProgreso(pre.url, f, pre.content_type, (pct) => mostrar(`Subiendo ${etiqueta}: ${pct}%`));
      mostrar(`Verificando ${etiqueta}…`);
      await _acInvocar('confirmar_subida', {
        id_campana: idCampana, numero, duracion_seg: duracion,
        titulo: f.name.replace(/\.mp3$/i, '').slice(0, 120)
      });
    }
    return { ok: true };
  } catch (e) {
    console.error('Error aplicando audiolibro a la campaña:', e);
    try { await _acInvocar('quitar', { id_campana: idCampana }); } catch (_) {}
    return { ok: false, aviso: `La campaña se publicó, pero el audiolibro no se pudo subir (${e.message}). Quedó sin audio.` };
  }
}

// ────────────────────────────────────────────────────────────
// RESEÑADOR · reproductor dentro de la plataforma (sin descarga)
// ────────────────────────────────────────────────────────────

var _acEstado = { idCampana: null, idPostulacion: null, caps: [], actual: 0, ultimoGuardado: 0, ultimoTiempo: 0, reintento: false };

function _acFmt(seg) {
  seg = Math.max(0, Math.round(seg || 0));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

function _acAsegurarModal() {
  if (document.getElementById('modal-audiolibro')) return;
  const div = document.createElement('div');
  div.id = 'modal-audiolibro';
  div.className = 'modal';
  div.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-titulo" id="ac-titulo">🎧 Audiolibro</h3>
      <button class="modal-cerrar" onclick="cerrarModales()">✕</button>
    </div>
    <div class="modal-body">
      <p class="form-hint" style="margin-bottom:10px;">Solo se escucha acá, en la plataforma. Guardamos hasta dónde llegaste.</p>
      <p id="ac-capitulo-actual" style="font-weight:600; margin-bottom:8px;"></p>
      <audio id="ac-audio" controls controlsList="nodownload noplaybackrate" preload="metadata" style="width:100%;" oncontextmenu="return false"></audio>
      <p id="ac-error" class="mensaje-error" style="display:none; margin-top:8px;"></p>
      <div id="ac-lista" style="margin-top:14px; max-height:40vh; overflow:auto; display:flex; flex-direction:column; gap:6px;"></div>
    </div>`;
  document.body.appendChild(div);

  const a = div.querySelector('#ac-audio');
  a.addEventListener('timeupdate', () => {
    _acEstado.ultimoTiempo = a.currentTime;
    if (Date.now() - _acEstado.ultimoGuardado > 20000) acGuardarProgreso();
  });
  a.addEventListener('pause', () => acGuardarProgreso());
  a.addEventListener('ended', () => acGuardarProgreso(true).then(() => {
    if (_acEstado.actual < _acEstado.caps.length - 1) acCargarCapitulo(_acEstado.actual + 1, 0, true);
  }));
  a.addEventListener('error', async () => {
    // La URL firmada dura 2 h: si venció, pedimos otra y seguimos donde estaba.
    if (_acEstado.reintento || !a.src) return;
    _acEstado.reintento = true;
    await acCargarCapitulo(_acEstado.actual, _acEstado.ultimoTiempo, true);
    _acEstado.reintento = false;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) acGuardarProgreso(); });
  window.addEventListener('pagehide', () => acGuardarProgreso());
}

function _acRenderLista() {
  const lista = document.getElementById('ac-lista');
  if (!lista) return;
  lista.innerHTML = _acEstado.caps.map((c, i) => `
    <button type="button" class="${i === _acEstado.actual ? 'btn-primario' : 'btn-secundario'} btn-sm"
            style="text-align:left; display:flex; justify-content:space-between; gap:8px;"
            onclick="acCargarCapitulo(${i}, 0, true)">
      <span>${c.numero}. ${String(c.titulo || 'Capítulo ' + c.numero).replace(/</g, '&lt;')}</span>
      <span>${_acFmt(c.duracion_seg)}</span>
    </button>`).join('');
  const act = _acEstado.caps[_acEstado.actual];
  const el = document.getElementById('ac-capitulo-actual');
  if (el && act) el.textContent = `Capítulo ${act.numero}: ${act.titulo || ''}`;
}

async function acCargarCapitulo(indice, posicion, reproducir) {
  const cap = _acEstado.caps[indice];
  const a = document.getElementById('ac-audio');
  const err = document.getElementById('ac-error');
  if (!cap || !a) return;
  if (indice !== _acEstado.actual) await acGuardarProgreso();
  _acEstado.actual = indice;
  _acRenderLista();
  if (err) err.style.display = 'none';
  try {
    const { data, error } = await supabaseClient.functions.invoke('audiolibro-campana', {
      body: { accion: 'url', id_campana: _acEstado.idCampana, numero: cap.numero }
    });
    if (error || !data?.url) {
      let msg = data?.error;
      if (!msg && error?.context && typeof error.context.json === 'function') {
        try { msg = (await error.context.json())?.error; } catch (e) {}
      }
      throw new Error(msg || 'No se pudo cargar el capítulo.');
    }
    a.src = data.url;
    a.onloadedmetadata = () => {
      if (posicion > 0 && posicion < (a.duration || Infinity)) a.currentTime = posicion;
      if (reproducir) a.play().catch(() => {});
      a.onloadedmetadata = null;
    };
    a.load();
  } catch (e) {
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  }
}

async function acGuardarProgreso(terminado) {
  const e = _acEstado;
  if (!e.idPostulacion || !e.caps.length) return;
  const a = document.getElementById('ac-audio');
  if (!a || !a.src) return;
  e.ultimoGuardado = Date.now();
  const total = e.caps.reduce((s, c) => s + (c.duracion_seg || 0), 0);
  const previos = e.caps.slice(0, e.actual).reduce((s, c) => s + (c.duracion_seg || 0), 0);
  const pos = terminado ? Math.round(a.duration || 0) : Math.round(a.currentTime || 0);
  const progreso = total > 0 ? Math.min(1, (previos + pos) / total) : 0;
  try {
    await supabaseClient.rpc('guardar_progreso_audio', {
      p_id_postulacion: e.idPostulacion,
      p_capitulo_numero: e.caps[e.actual].numero,
      p_posicion_seg: pos,
      p_progreso: Number(progreso.toFixed(3))
    });
  } catch (err) {
    console.error('Error guardando progreso de audio:', err);
  }
}

function acDetenerAudio() {
  const a = document.getElementById('ac-audio');
  if (!a) return;
  acGuardarProgreso();
  a.pause();
}

async function abrirReproductorAudio(idCampana, idPostulacion) {
  _acAsegurarModal();
  const { data: caps, error } = await supabaseClient.rpc('capitulos_audio_campana', { p_id_campana: idCampana });
  if (error || !caps || !caps.length) {
    mostrarToast('Este audiolibro todavía no está disponible.', 'error');
    return;
  }

  let inicio = { capitulo_numero: caps[0].numero, posicion_seg: 0 };
  if (idPostulacion) {
    const { data: prog } = await supabaseClient
      .from('progreso_audio').select('capitulo_numero, posicion_seg')
      .eq('id_postulacion', idPostulacion).maybeSingle();
    if (prog) inicio = prog;
  }
  const indice = Math.max(0, caps.findIndex(c => c.numero === inicio.capitulo_numero));

  _acEstado = { idCampana, idPostulacion: idPostulacion || null, caps, actual: indice, ultimoGuardado: Date.now(), ultimoTiempo: 0, reintento: false };
  try {
    const { data: camp } = await supabaseClient.from('campanas').select('nombre_libro').eq('id', idCampana).maybeSingle();
    document.getElementById('ac-titulo').textContent = '🎧 ' + (camp?.nombre_libro || 'Audiolibro');
  } catch (e) {}
  mostrarModal('modal-audiolibro');
  await acCargarCapitulo(indice, inicio.posicion_seg || 0, false);
}
