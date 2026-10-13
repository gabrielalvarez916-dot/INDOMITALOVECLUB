// ============================================================
// admin-audiolibros.js — Admin > Visuales > Audiolibros
// Carpetas por pedido de audiolibro. Cada capítulo se puede escuchar,
// y los trozos que salieron mal se pueden regenerar (la Action de GitHub
// vuelve a unir el capítulo sola).
// ============================================================

const AUD_ESTADOS = {
  borrador: 'Borrador', preparando: 'Preparando', en_revision: 'En revisión', pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado, por generar', generando: 'Generando audio', uniendo: 'Uniendo capítulos', listo: 'Listo',
  error: 'Error', cancelado: 'Cancelado',
};
const AUD_TROZO = { pendiente: 'Pendiente', procesando: 'Procesando', listo: 'Listo', error: 'Error' };
const AUD_COLOR = {
  listo: '#1a7f37', error: '#c62828', generando: '#b26a00', uniendo: '#b26a00', procesando: '#b26a00',
  pagado: '#b26a00', pendiente: '#888', en_revision: '#1565c0', preparando: '#b26a00', borrador: '#888',
  pendiente_pago: '#888', cancelado: '#888',
};

let _audPedidos = [];
let _audAbiertos = new Set();   // pedidos y capítulos desplegados ("p:<id>" / "c:<id>")
let _audTimer = null;
let _audSaldo = null;        // { usados, limite, restantes, reinicia_unix, plan } o { error }

function _audEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _audBadge(estado, mapa) {
  const color = AUD_COLOR[estado] || '#888';
  return `<span style="display:inline-block; padding:2px 9px; border-radius:10px; font-size:11px; font-weight:600; color:#fff; background:${color};">${_audEsc((mapa || AUD_ESTADOS)[estado] || estado)}</span>`;
}
function _audMinutos(seg) {
  if (!seg) return '';
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}

// ────────────────────────────────────────────────────────────
// CARGA Y DIBUJO
// ────────────────────────────────────────────────────────────
async function cargarAudiolibrosAdmin(silencioso) {
  const cont = document.getElementById('admin-audiolibros-contenedor');
  if (!cont) return;
  if (!silencioso) cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient
    .from('audiolibro_pedidos')
    .select('*, autor:usuarios!audiolibro_pedidos_id_autor_fkey(nombre, apellido, alias, email), audiolibro_capitulos(id, numero, titulo, estado, audio_path, duracion_seg, total_caracteres, audiolibro_trozos(id, orden, estado, caracteres, intentos, max_intentos, ultimo_error, audio_path, regenerado_veces))')
    .order('created_at', { ascending: false });

  if (error) {
    cont.innerHTML = `<p class="mensaje-error">${_audEsc(error.message)}</p>`;
    return;
  }
  _audPedidos = data || [];
  _audDibujar();
  _audProgramarRefresco();
  audCargarSaldo();
}

// Saldo de créditos de ElevenLabs (caracteres usados / límite del plan)
async function audCargarSaldo() {
  try {
    const { data, error } = await supabaseClient.functions.invoke('audiolibro-saldo', { body: {} });
    _audSaldo = (error || !data || data.error) ? { error: (data && data.error) || (error && error.message) || 'No se pudo consultar' } : data;
  } catch (e) {
    _audSaldo = { error: String(e && e.message || e) };
  }
  const caja = document.getElementById('aud-saldo-caja');
  if (caja) caja.innerHTML = _audHtmlSaldo();
}

function _audHtmlSaldo() {
  const s = _audSaldo;
  if (!s) return '<span style="font-size:12px; color:#888;">Consultando créditos de ElevenLabs…</span>';
  if (s.error) return `<span style="font-size:12px; color:#c62828;">No pude consultar los créditos de ElevenLabs: ${_audEsc(s.error)}</span>`;
  const pctUsado = s.limite ? Math.min(100, Math.round((s.usados / s.limite) * 100)) : 0;
  const pctQueda = 100 - pctUsado;
  const color = pctQueda <= 10 ? '#c62828' : pctQueda <= 25 ? '#b26a00' : '#1a7f37';
  const fmt = n => Number(n).toLocaleString('es-AR');
  const reinicia = s.reinicia_unix ? new Date(s.reinicia_unix * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : null;
  return `
    <div style="font-size:13px; margin-bottom:5px;">
      <strong style="color:${color};">Te quedan ${fmt(s.restantes)} créditos</strong>
      <span style="color:#666;"> de ${fmt(s.limite)} (usaste ${fmt(s.usados)})${s.plan ? ' · plan ' + _audEsc(s.plan) : ''}${reinicia ? ' · se renuevan el ' + reinicia : ''}</span>
    </div>
    <div style="height:6px; background:#eee; border-radius:3px;"><div style="height:6px; width:${pctUsado}%; background:${color}; border-radius:3px;"></div></div>
    <div style="font-size:11px; color:#888; margin-top:4px;">1 crédito = 1 carácter de texto. Un libro de 80.000 palabras gasta unos 480.000.</div>`;
}

function _audProgramarRefresco() {
  clearTimeout(_audTimer);
  const activo = _audPedidos.some(p => ['generando', 'uniendo', 'preparando'].includes(p.estado));
  const visible = document.getElementById('admin-audiolibros-contenedor')?.offsetParent !== null;
  if (activo && visible) _audTimer = setTimeout(() => cargarAudiolibrosAdmin(true), 20000);
}

function _audDibujar() {
  const cont = document.getElementById('admin-audiolibros-contenedor');
  if (!cont) return;
  const abiertosScroll = window.scrollY;
  cont.innerHTML = `
    <div id="aud-saldo-caja" style="border:1px solid #e3d9e8; border-radius:12px; padding:10px 14px; margin-bottom:12px; background:#faf6fc;">${_audHtmlSaldo()}</div>
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
      <button class="btn-secundario btn-sm" onclick="cargarAudiolibrosAdmin()">↻ Actualizar</button>
      <span style="font-size:12px; color:#888;">${_audPedidos.length} pedido(s). Se actualiza solo mientras algo se está generando.</span>
    </div>
    ${_audPedidos.length === 0
      ? '<p style="color:#888;">Todavía no hay pedidos de audiolibro.</p>'
      : _audPedidos.map(_audTarjetaPedido).join('')}`;
  window.scrollTo(0, abiertosScroll);
}

function _audTarjetaPedido(p) {
  const caps = (p.audiolibro_capitulos || []).slice().sort((a, b) => a.numero - b.numero);
  const trozos = caps.flatMap(c => c.audiolibro_trozos || []);
  const listos = trozos.filter(t => t.estado === 'listo').length;
  const errores = trozos.filter(t => t.estado === 'error').length;
  const pct = trozos.length ? Math.round((listos / trozos.length) * 100) : 0;
  const autor = p.autor ? (p.autor.alias || [p.autor.nombre, p.autor.apellido].filter(Boolean).join(' ') || p.autor.email) : '—';
  const abierto = _audAbiertos.has('p:' + p.id);
  const res = p.resumen_preparacion || {};
  const adv = res.advertencias || [];
  const candidatas = p.palabras_candidatas || [];

  const puedePreparar = ['borrador', 'en_revision', 'pendiente_pago', 'error'].includes(p.estado) && !trozos.some(t => ['listo', 'procesando'].includes(t.estado));
  const puedeAprobar = ['en_revision', 'pendiente_pago'].includes(p.estado) && trozos.length > 0;

  return `
  <div style="border:1px solid #e3d9e8; border-radius:12px; margin-bottom:12px; background:#fff;">
    <div onclick="_audAlternar('p:${p.id}')" style="cursor:pointer; padding:12px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <span style="font-size:18px;">${abierto ? '📂' : '📁'}</span>
      <strong style="flex:1; min-width:160px;">${_audEsc(p.titulo || 'Sin título')}</strong>
      <span style="font-size:12px; color:#666;">${_audEsc(autor)}</span>
      ${_audBadge(p.estado)}
      ${trozos.length ? `<span style="font-size:12px; color:#666;">${listos}/${trozos.length} trozos</span>` : ''}
      ${errores ? `<span style="font-size:12px; color:#c62828; font-weight:600;">${errores} con error</span>` : ''}
    </div>
    ${trozos.length && p.estado !== 'listo' ? `<div style="height:4px; background:#eee;"><div style="height:4px; width:${pct}%; background:#7b3fa0;"></div></div>` : ''}
    ${abierto ? `
    <div style="padding:12px 14px; border-top:1px solid #f0e8f4;">
      <p style="font-size:12px; color:#666; margin:0 0 8px;">
        ${p.total_caracteres ? `${Number(p.total_caracteres).toLocaleString('es-AR')} caracteres · ` : ''}${caps.length} capítulo(s)${p.voz_nombre ? ` · voz ${_audEsc(p.voz_nombre)}` : ''}${p.precio_usd ? ` · USD ${Number(p.precio_usd).toFixed(2)}` : ''}
      </p>
      ${p.notas ? `<p class="mensaje-error" style="margin:0 0 8px;">${_audEsc(p.notas)}</p>` : ''}
      ${adv.length ? `<ul style="font-size:12px; color:#b26a00; margin:0 0 10px 18px;">${adv.map(a => `<li>${_audEsc(a)}</li>`).join('')}</ul>` : ''}

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        ${puedePreparar ? `<button class="btn-secundario btn-sm" onclick="audPreparar('${p.id}')">⚙ ${trozos.length ? 'Volver a preparar manuscrito' : 'Preparar manuscrito'}</button>` : ''}
        ${puedeAprobar ? `<button class="btn-primario btn-sm" onclick="audAprobar('${p.id}')">▶ Aprobar y generar audio</button>` : ''}
        ${!['listo', 'cancelado'].includes(p.estado) && !trozos.some(t => t.estado === 'listo') ? `<button class="btn-secundario btn-sm" onclick="audCancelar('${p.id}')">Cancelar pedido</button>` : ''}
        ${errores ? `<button class="btn-secundario btn-sm" onclick="audReintentarErrores('${p.id}')">↻ Reintentar los ${errores} con error</button>` : ''}
      </div>

      ${puedePreparar ? _audDiccionario(p, candidatas) : ''}

      ${caps.length ? `<div>${caps.map(c => _audCapitulo(p, c)).join('')}</div>` : '<p style="color:#888; font-size:13px;">Todavía no hay capítulos. Preparar el manuscrito los crea.</p>'}
    </div>` : ''}
  </div>`;
}

function _audDiccionario(p, candidatas) {
  return `
  <div style="background:#faf6fc; border-radius:10px; padding:10px 12px; margin-bottom:12px;">
    <p style="margin:0 0 6px; font-size:12px; font-weight:600;">Palabras difíciles de este libro</p>
    ${candidatas.length ? `<p style="margin:0 0 8px; font-size:12px; color:#666;">Nombres que conviene revisar: ${candidatas.slice(0, 40).map(c => `<a href="#" onclick="event.preventDefault(); document.getElementById('aud-pal-${p.id}').value='${_audEsc(c.palabra)}'; document.getElementById('aud-lec-${p.id}').focus();" style="margin-right:6px;${c.sospechosa ? 'font-weight:700;' : ''}">${_audEsc(c.palabra)}</a>`).join('')}</p>` : ''}
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <input type="text" id="aud-pal-${p.id}" placeholder="Palabra o nombre" style="flex:1; min-width:120px;" />
      <input type="text" id="aud-lec-${p.id}" placeholder="Cómo se lee (ej: Yaren)" style="flex:1; min-width:120px;" />
      <button class="btn-secundario btn-sm" onclick="audAgregarPalabra('${p.id}')">Agregar</button>
    </div>
    <p style="margin:6px 0 0; font-size:11px; color:#888;">Después de agregar palabras, tocá “Volver a preparar manuscrito”. El texto original no se modifica.</p>
  </div>`;
}

function _audCapitulo(p, c) {
  const trozos = (c.audiolibro_trozos || []).slice().sort((a, b) => a.orden - b.orden);
  const listos = trozos.filter(t => t.estado === 'listo').length;
  const abierto = _audAbiertos.has('c:' + c.id);
  const hayError = trozos.some(t => t.estado === 'error');
  return `
  <div style="border:1px solid #eee; border-radius:8px; margin-bottom:6px;">
    <div style="padding:8px 10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      <span onclick="_audAlternar('c:${c.id}')" style="cursor:pointer; flex:1; min-width:140px;">
        <strong style="font-size:13px;">${c.numero}. ${_audEsc(c.titulo)}</strong>
        <span style="font-size:11px; color:#888;"> ${abierto ? '▾' : '▸'} ${listos}/${trozos.length} trozos ${c.duracion_seg ? '· ' + _audMinutos(c.duracion_seg) : ''}</span>
      </span>
      ${hayError ? _audBadge('error', AUD_TROZO) : _audBadge(c.estado, { pendiente: 'Pendiente', generando: 'Generando', listo: 'Listo', error: 'Error' })}
      ${c.audio_path ? `<button class="btn-secundario btn-sm" onclick="audEscuchar('capitulo','${c.id}','aud-slot-c-${c.id}')">▶ Escuchar</button>
      <button class="btn-secundario btn-sm" onclick="audDescargar('capitulo','${c.id}','${_audEsc((p.titulo || 'audiolibro').replace(/'/g, ''))} - capitulo ${c.numero}.mp3')">⬇</button>` : ''}
    </div>
    <div id="aud-slot-c-${c.id}" style="padding:0 10px;"></div>
    ${abierto ? `<div style="padding:4px 10px 10px;">${trozos.map(t => _audTrozo(t, c)).join('')}</div>` : ''}
  </div>`;
}

function _audTrozo(t, c) {
  return `
  <div style="border-top:1px dashed #eee; padding:6px 0; font-size:12px;">
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      <span style="min-width:62px;">Trozo ${t.orden}</span>
      ${_audBadge(t.estado, AUD_TROZO)}
      <span style="color:#888;">${Number(t.caracteres || 0).toLocaleString('es-AR')} car.</span>
      ${t.intentos ? `<span style="color:#888;">intentos ${t.intentos}/${t.max_intentos}</span>` : ''}
      ${t.regenerado_veces ? `<span style="color:#888;">regenerado ${t.regenerado_veces}×</span>` : ''}
      <span style="flex:1;"></span>
      ${t.audio_path ? `<button class="btn-secundario btn-sm" onclick="audEscuchar('trozo','${t.id}','aud-slot-t-${t.id}')">▶</button>` : ''}
      ${['listo', 'error'].includes(t.estado) ? `<button class="btn-secundario btn-sm" onclick="audRegenerar('${t.id}')">${t.estado === 'error' ? '↻ Reintentar' : '↻ Salió mal, regenerar'}</button>` : ''}
    </div>
    ${t.ultimo_error ? `<div style="color:#c62828; margin-top:3px; word-break:break-word;">${_audEsc(t.ultimo_error)}</div>` : ''}
    <div id="aud-slot-t-${t.id}"></div>
  </div>`;
}

function _audAlternar(clave) {
  if (_audAbiertos.has(clave)) _audAbiertos.delete(clave); else _audAbiertos.add(clave);
  _audDibujar();
}

// ────────────────────────────────────────────────────────────
// ESCUCHAR / DESCARGAR
// ────────────────────────────────────────────────────────────
async function _audPedirUrl(tipo, id, extra) {
  const { data, error } = await supabaseClient.functions.invoke('audiolibro-url', { body: { tipo, id, ...(extra || {}) } });
  if (error || !data?.url) {
    mostrarToast(data?.error || error?.message || 'No se pudo abrir el audio', 'error');
    return null;
  }
  return data.url;
}

async function audEscuchar(tipo, id, slotId) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.innerHTML = '<span style="font-size:12px; color:#888;">Cargando audio…</span>';
  const url = await _audPedirUrl(tipo, id);
  if (!url) { slot.innerHTML = ''; return; }
  slot.innerHTML = `<audio controls autoplay preload="auto" style="width:100%; margin:6px 0;" src="${_audEsc(url)}"></audio>`;
}

async function audDescargar(tipo, id, nombre) {
  const url = await _audPedirUrl(tipo, id, { descargar: true, nombre });
  if (url) window.location.href = url;
}

// ────────────────────────────────────────────────────────────
// ACCIONES
// ────────────────────────────────────────────────────────────
async function audPreparar(idPedido) {
  mostrarToast('Preparando manuscrito…', 'info');
  const { data, error } = await supabaseClient.functions.invoke('preparar-audiolibro', { body: { id_pedido: idPedido } });
  if (error || data?.error || data?.ok === false) {
    mostrarToast(data?.error || error?.message || 'No se pudo preparar', 'error');
  } else {
    mostrarToast(`Listo: ${data.resumen?.capitulos?.length || 0} capítulos, ${data.resumen?.total_trozos || 0} trozos`, 'ok');
  }
  _audAbiertos.add('p:' + idPedido);
  await cargarAudiolibrosAdmin(true);
}

async function audAprobar(idPedido) {
  const p = _audPedidos.find(x => x.id === idPedido);
  const car = Number(p?.total_caracteres || 0).toLocaleString('es-AR');
  if (!confirm(`Se van a generar ${car} caracteres de audio con ElevenLabs y se descuentan de tus créditos. ¿Seguimos?`)) return;
  const { error } = await supabaseClient.from('audiolibro_pedidos').update({ estado: 'pagado' }).eq('id', idPedido);
  if (error) { mostrarToast(error.message, 'error'); return; }
  mostrarToast('Aprobado. Empieza a generarse (un trozo por minuto).', 'ok');
  await cargarAudiolibrosAdmin(true);
}

async function audCancelar(idPedido) {
  if (!confirm('¿Cancelar este pedido?')) return;
  const { error } = await supabaseClient.from('audiolibro_pedidos').update({ estado: 'cancelado' }).eq('id', idPedido);
  if (error) { mostrarToast(error.message, 'error'); return; }
  await cargarAudiolibrosAdmin(true);
}

async function audRegenerar(idTrozo) {
  const { data, error } = await supabaseClient.rpc('admin_audiolibro_regenerar_trozo', { p_id_trozo: idTrozo });
  if (error || data?.error) { mostrarToast(data?.error || error.message, 'error'); return; }
  mostrarToast('Se regenera solo y el capítulo se vuelve a armar.', 'ok');
  await cargarAudiolibrosAdmin(true);
}

async function audReintentarErrores(idPedido) {
  const p = _audPedidos.find(x => x.id === idPedido);
  const errores = (p?.audiolibro_capitulos || []).flatMap(c => c.audiolibro_trozos || []).filter(t => t.estado === 'error');
  for (const t of errores) {
    await supabaseClient.rpc('admin_audiolibro_regenerar_trozo', { p_id_trozo: t.id });
  }
  mostrarToast(`${errores.length} trozo(s) vuelven a la cola.`, 'ok');
  await cargarAudiolibrosAdmin(true);
}

async function audAgregarPalabra(idPedido) {
  const palabra = document.getElementById('aud-pal-' + idPedido)?.value.trim();
  const lectura = document.getElementById('aud-lec-' + idPedido)?.value.trim();
  if (!palabra || !lectura) { mostrarToast('Completá la palabra y cómo se lee', 'error'); return; }
  const { error } = await supabaseClient.from('audiolibro_diccionario').insert({ id_pedido: idPedido, palabra, lectura, activo: true });
  if (error) { mostrarToast(error.message, 'error'); return; }
  document.getElementById('aud-pal-' + idPedido).value = '';
  document.getElementById('aud-lec-' + idPedido).value = '';
  mostrarToast(`Agregada: ${palabra} → ${lectura}`, 'ok');
}
