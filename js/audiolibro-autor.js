// ============================================================
// audiolibro-autor.js — Panel del autor > Campañas activas > 🎧 Crear audiolibro
// Flujo: 1) nombre + autor + manuscrito (.docx/.txt) → se lee y se calcula el precio
//        2) diccionario de pronunciación (palabras difíciles)
//        3) elegir voz y pagar (Mercado Pago ARS / PayPal USD)
// El pedido se da de alta como "pagado" recién cuando se acredita el pago
// (lo hace la función webhook-audiolibro). Todo el backend pasa por la
// Edge Function audiolibro-pedido: el autor no escribe en las tablas.
// Reusa el modal "modal-detalle-campana" y mostrarModal()/cerrarModales().
// ============================================================

const AUDA_ESTADOS = {
  borrador: 'Sin terminar', preparando: 'Leyendo manuscrito', en_revision: 'Falta elegir voz y pagar',
  pendiente_pago: 'Pago pendiente', pagado: 'Pagado, en cola', generando: 'Generando el audio',
  uniendo: 'Armando los capítulos', listo: 'Listo', error: 'Hubo un problema', cancelado: 'Cancelado',
};
const AUDA_TRAMOS = { corto: 'Corto', intermedio: 'Intermedio', largo: 'Largo' };

let _audA = { pedido: null, nombreLibro: '', nombreAutor: '', voces: null, voz: null };

function _audaEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _audaNum(n) { return Number(n || 0).toLocaleString('es-AR'); }
function _audaPalabras(chars) { return Math.round((chars || 0) / 6); }

function _audaEls() {
  return {
    titulo: document.getElementById('modal-detalle-titulo'),
    body: document.getElementById('modal-detalle-body'),
    footer: document.getElementById('modal-detalle-footer'),
  };
}

async function _audaInvocar(body) {
  const { data, error } = await supabaseClient.functions.invoke('audiolibro-pedido', { body });
  if (error) {
    const msg = await _leerErrorEdgeFunction(error, 'No se pudo completar la acción. Probá de nuevo.');
    throw new Error(msg);
  }
  if (data && (data.ok === false || data.error)) throw new Error(data.error || 'No se pudo completar la acción.');
  return data;
}

function _audaError(msg) {
  const el = document.getElementById('auda-error');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function _audaOcupado(textoBoton, ocupado, idBtn) {
  const b = document.getElementById(idBtn);
  if (!b) return;
  if (ocupado) { b.dataset.txt = b.textContent; b.disabled = true; b.textContent = textoBoton; }
  else { b.disabled = false; b.textContent = b.dataset.txt || textoBoton; }
}

// ────────────────────────────────────────────────────────────
// ENTRADA: botón "Crear audiolibro" de la card de campaña
// ────────────────────────────────────────────────────────────
async function abrirModalAudiolibro(idCampana) {
  const c = (typeof _campañasAutor !== 'undefined' && idCampana) ? _campañasAutor.find(x => x.id === idCampana) : null;
  _audA = { pedido: null, nombreLibro: c?.nombreLibro || '', nombreAutor: c?.nombreAutor || '', voces: null, voz: null };
  mostrarModal('modal-detalle-campana');
  await _audaPantallaInicio();
}

// ────────────────────────────────────────────────────────────
// PANTALLA 0 — datos del libro + mis audiolibros
// ────────────────────────────────────────────────────────────
async function _audaPantallaInicio() {
  const { titulo, body, footer } = _audaEls();
  if (titulo) titulo.textContent = '🎧 Crear audiolibro';
  if (footer) footer.innerHTML = '<button type="button" class="btn-secundario" onclick="cerrarModales()">Cerrar</button>';
  if (body) body.innerHTML = '<p class="form-hint">Cargando...</p>';

  let tarifas = null;
  try { tarifas = (await _audaInvocar({ accion: 'precios' })); } catch (e) { /* se muestra sin tabla */ }

  const tablaPrecios = tarifas ? `
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:10px 0 14px;">
      ${['corto', 'intermedio', 'largo'].map(t => `
        <div style="border:1px solid #E5E0D8; border-radius:10px; padding:10px; text-align:center;">
          <div style="font-weight:700;">${AUDA_TRAMOS[t]}</div>
          <div style="font-size:11px; color:#666;">hasta ~${_audaNum(_audaPalabras(tarifas.topes[t]))} palabras</div>
          <div style="font-weight:700; color:#8B1A2B; margin-top:4px;">USD ${_audaNum(tarifas.precios[t].usd)}</div>
          <div style="font-size:11px; color:#666;">ARS ${_audaNum(tarifas.precios[t].ars)}</div>
        </div>`).join('')}
    </div>` : '';

  body.innerHTML = `
    <p class="form-hint">Convertí tu libro en audiolibro con voz profesional. Subí el manuscrito, revisás cómo se van a pronunciar los nombres difíciles y pagás. El precio depende del largo del libro:</p>
    ${tablaPrecios}
    <div class="form-grupo">
      <label class="form-label">Nombre del libro</label>
      <input type="text" id="auda-titulo" class="form-input" maxlength="200" value="${_audaEsc(_audA.nombreLibro)}" />
    </div>
    <div class="form-grupo">
      <label class="form-label">Autor/a</label>
      <input type="text" id="auda-autor" class="form-input" maxlength="200" value="${_audaEsc(_audA.nombreAutor)}" />
    </div>
    <div class="form-grupo">
      <label class="form-label">Manuscrito (.docx o .txt)</label>
      <input type="file" id="auda-archivo" class="form-input" accept=".docx,.txt" />
      <p class="form-hint" style="margin-top:6px;">Marcá cada capítulo con una línea que diga "Capítulo 1", "Capítulo 2"… (también sirven Prólogo y Epílogo). Hasta 8 MB, sin imágenes.</p>
    </div>
    <p id="auda-error" class="mensaje-error" style="display:none;"></p>
    <div id="auda-lista-pedidos" style="margin-top:18px;"></div>
  `;
  footer.innerHTML = `
    <button type="button" class="btn-secundario" onclick="cerrarModales()">Cerrar</button>
    <button type="button" id="auda-btn-subir" class="btn-primario" onclick="_audaSubirManuscrito()">Subir y calcular precio</button>`;

  _audaCargarMisPedidos();
}

async function _audaCargarMisPedidos() {
  const cont = document.getElementById('auda-lista-pedidos');
  if (!cont) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data, error } = await supabaseClient.from('audiolibro_pedidos')
    .select('id, titulo, estado, tramo, total_caracteres, created_at, mail_enviado_at, zip_path')
    .eq('id_autor', user.id).neq('estado', 'cancelado').order('created_at', { ascending: false }).limit(30);
  if (error || !data || !data.length) { cont.innerHTML = ''; return; }

  cont.innerHTML = `
    <h4 style="margin:6px 0 8px;">Mis audiolibros</h4>
    ${data.map(p => {
      const entregado = p.estado === 'listo' && p.mail_enviado_at && p.zip_path;
      const etiqueta = p.estado === 'listo' && !entregado ? 'Listo, preparando la entrega' : (AUDA_ESTADOS[p.estado] || p.estado);
      let accion = '';
      if (['borrador', 'en_revision', 'pendiente_pago'].includes(p.estado)) {
        accion = `<button type="button" class="btn-secundario btn-sm" onclick="_audaContinuar('${p.id}')">Continuar</button>`;
      } else if (entregado) {
        accion = `<button type="button" class="btn-primario btn-sm" onclick="_audaDescargar('${p.id}', this)">⬇ Descargar</button>`;
      }
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; border:1px solid #E5E0D8; border-radius:10px; padding:10px 12px; margin-bottom:8px;">
          <div style="min-width:0;">
            <div style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_audaEsc(p.titulo)}</div>
            <div style="font-size:12px; color:#666;">${_audaEsc(etiqueta)}${p.tramo ? ' · ' + AUDA_TRAMOS[p.tramo] : ''}</div>
          </div>
          ${accion}
        </div>`;
    }).join('')}`;
}

async function _audaDescargar(idPedido, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Preparando…'; }
  try {
    const r = await _audaInvocar({ accion: 'zip_url', id_pedido: idPedido });
    window.location.href = r.url;
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Descargar'; }
  }
}

async function _audaContinuar(idPedido) {
  const { body } = _audaEls();
  if (body) body.innerHTML = '<p class="form-hint">Cargando tu pedido...</p>';
  try {
    _audA.pedido = await _audaInvocar({ accion: 'pedido', id_pedido: idPedido });
    _audaPantallaResumen();
  } catch (e) {
    await _audaPantallaInicio();
    _audaError(e.message);
  }
}

// ────────────────────────────────────────────────────────────
// Subida del manuscrito → se crea el pedido y se lee el texto
// ────────────────────────────────────────────────────────────
async function _audaSubirManuscrito() {
  _audaError('');
  const titulo = document.getElementById('auda-titulo')?.value.trim();
  const autor = document.getElementById('auda-autor')?.value.trim();
  const archivo = document.getElementById('auda-archivo')?.files?.[0];
  if (!titulo) return _audaError('Poné el nombre del libro.');
  if (!autor) return _audaError('Poné el nombre del autor.');
  if (!archivo) return _audaError('Elegí el archivo del manuscrito.');
  if (!/\.(docx|txt)$/i.test(archivo.name)) return _audaError('El manuscrito tiene que ser .docx o .txt.');
  if (archivo.size > 8 * 1024 * 1024) return _audaError('El archivo pesa más de 8 MB. Revisá que no tenga imágenes pegadas.');

  _audaOcupado('Leyendo tu manuscrito… (puede tardar un poco)', true, 'auda-btn-subir');
  try {
    const fd = new FormData();
    fd.append('accion', 'crear');
    fd.append('titulo', titulo);
    fd.append('autor_libro', autor);
    fd.append('archivo', archivo);
    _audA.pedido = await _audaInvocar(fd);
    _audA.nombreLibro = titulo;
    _audA.nombreAutor = autor;
    _audaPantallaResumen();
  } catch (e) {
    _audaOcupado('', false, 'auda-btn-subir');
    _audaError(e.message);
  }
}

// ────────────────────────────────────────────────────────────
// PANTALLA 1 — resumen: caracteres, tramo y precio
// ────────────────────────────────────────────────────────────
function _audaPantallaResumen() {
  const { titulo, body, footer } = _audaEls();
  const p = _audA.pedido;
  if (titulo) titulo.textContent = `🎧 ${p.titulo}`;

  const hayPrecio = !!(p.tramo && p.precio);
  const caps = p.capitulos || [];
  body.innerHTML = `
    <div style="background:#FAE8EC; border-radius:12px; padding:14px 16px; margin-bottom:14px;">
      <div style="font-size:13px; color:#5C0F1A;">Leímos tu manuscrito</div>
      <div style="font-size:22px; font-weight:700; color:#8B1A2B;">${_audaNum(p.total_caracteres)} caracteres</div>
      <div style="font-size:13px; color:#666;">≈ ${_audaNum(_audaPalabras(p.total_caracteres))} palabras · ${caps.length} capítulo${caps.length !== 1 ? 's' : ''}</div>
      ${hayPrecio ? `
        <div style="margin-top:10px; font-size:15px;">Tu audiolibro es <strong>${AUDA_TRAMOS[p.tramo]}</strong>:
          <strong>USD ${_audaNum(p.precio.usd)}</strong> <span style="color:#666;">(PayPal)</span> ·
          <strong>ARS ${_audaNum(p.precio.ars)}</strong> <span style="color:#666;">(Mercado Pago)</span></div>`
      : `<div style="margin-top:10px; color:#C0392B;">${p.excede_maximo ? 'Tu libro supera el máximo para pedir online. Escribinos por soporte y lo resolvemos.' : 'No encontramos texto para convertir.'}</div>`}
    </div>
    ${(p.advertencias || []).length ? `
      <div style="margin-bottom:12px;">
        <div style="font-weight:700; margin-bottom:4px;">Revisá esto:</div>
        <ul style="padding-left:18px; color:#666; font-size:13px; line-height:1.5;">${p.advertencias.map(a => `<li>${_audaEsc(a)}</li>`).join('')}</ul>
      </div>` : ''}
    <details style="margin-bottom:8px;">
      <summary style="cursor:pointer; font-weight:700;">Ver los capítulos que detectamos</summary>
      <ol style="padding-left:20px; margin-top:6px; color:#666; font-size:13px; line-height:1.5;">
        ${caps.map(c => `<li>${_audaEsc(c.titulo)} <span style="color:#999;">(${_audaNum(c.caracteres)} car.)</span></li>`).join('')}
      </ol>
    </details>
    <p id="auda-error" class="mensaje-error" style="display:none;"></p>
  `;
  footer.innerHTML = `
    <button type="button" class="btn-secundario" onclick="_audaPantallaInicio()">Volver</button>
    ${hayPrecio ? '<button type="button" class="btn-primario" onclick="_audaPantallaDiccionario()">Siguiente: pronunciación</button>' : ''}`;
}

// ────────────────────────────────────────────────────────────
// PANTALLA 2 — diccionario de pronunciación
// ────────────────────────────────────────────────────────────
function _audaPantallaDiccionario() {
  const { titulo, body, footer } = _audaEls();
  const p = _audA.pedido;
  if (titulo) titulo.textContent = '🗣️ Pronunciación';

  // Filas: lo que ya cargó el autor + palabras que parecen nombres o palabras raras
  const yaCargadas = new Set((p.diccionario || []).map(d => d.palabra.toLowerCase()));
  const filas = [
    ...(p.diccionario || []).map(d => ({ palabra: d.palabra, lectura: d.lectura, sospechosa: false })),
    ...(p.palabras || []).filter(w => !yaCargadas.has(String(w.palabra).toLowerCase())).map(w => ({ palabra: w.palabra, lectura: '', sospechosa: !!w.sospechosa, ap: w.apariciones })),
  ];

  body.innerHTML = `
    <p class="form-hint">La voz lee mal algunos nombres propios y palabras en otro idioma. Acá abajo están las que encontramos en tu libro: en <strong>"Se lee como"</strong> escribí cómo querés que suene, tal cual se pronuncia. Ejemplo: <em>Asher → Ásher</em>, <em>Liam → Lian</em>. Las que dejes vacías se leen como están escritas.</p>
    <div id="auda-dic-filas">
      ${filas.length ? filas.map(f => _audaFilaDic(f)).join('') : '<p class="form-hint">No encontramos palabras raras. Si querés, agregá las tuyas abajo.</p>'}
    </div>
    <button type="button" class="btn-secundario btn-sm" style="margin-top:8px;" onclick="_audaAgregarFilaDic()">+ Agregar otra palabra</button>
    <p id="auda-error" class="mensaje-error" style="display:none;"></p>
  `;
  footer.innerHTML = `
    <button type="button" class="btn-secundario" onclick="_audaPantallaResumen()">Volver</button>
    <button type="button" id="auda-btn-dic" class="btn-primario" onclick="_audaGuardarDiccionario()">Guardar y seguir</button>`;
}

function _audaFilaDic(f) {
  return `
    <div class="auda-fila-dic" style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
      <input type="text" class="form-input auda-dic-palabra" maxlength="60" placeholder="Palabra" value="${_audaEsc(f.palabra || '')}" style="flex:1; min-width:0;" />
      <span style="color:#999;">→</span>
      <input type="text" class="form-input auda-dic-lectura" maxlength="80" placeholder="Se lee como" value="${_audaEsc(f.lectura || '')}" style="flex:1; min-width:0;" />
    </div>`;
}

function _audaAgregarFilaDic() {
  const cont = document.getElementById('auda-dic-filas');
  if (!cont) return;
  cont.querySelectorAll('p.form-hint').forEach(n => n.remove());
  cont.insertAdjacentHTML('beforeend', _audaFilaDic({}));
  const ult = cont.querySelectorAll('.auda-dic-palabra');
  ult[ult.length - 1]?.focus();
}

async function _audaGuardarDiccionario() {
  _audaError('');
  const entradas = [];
  document.querySelectorAll('.auda-fila-dic').forEach(fila => {
    const palabra = fila.querySelector('.auda-dic-palabra')?.value.trim();
    const lectura = fila.querySelector('.auda-dic-lectura')?.value.trim();
    if (palabra && lectura) entradas.push({ palabra, lectura });
  });
  _audaOcupado('Aplicando tus correcciones…', true, 'auda-btn-dic');
  try {
    _audA.pedido = await _audaInvocar({ accion: 'diccionario', id_pedido: _audA.pedido.id_pedido, entradas });
    await _audaPantallaPago();
  } catch (e) {
    _audaOcupado('', false, 'auda-btn-dic');
    _audaError(e.message);
  }
}

// ────────────────────────────────────────────────────────────
// PANTALLA 3 — voz + pago
// ────────────────────────────────────────────────────────────
async function _audaPantallaPago() {
  const { titulo, body, footer } = _audaEls();
  const p = _audA.pedido;
  if (titulo) titulo.textContent = '🎙️ Elegí la voz y pagá';
  body.innerHTML = '<p class="form-hint">Cargando voces...</p>';
  footer.innerHTML = '<button type="button" class="btn-secundario" onclick="_audaPantallaDiccionario()">Volver</button>';

  try {
    if (!_audA.voces) _audA.voces = (await _audaInvocar({ accion: 'voces' })).voces || [];
  } catch (e) {
    body.innerHTML = `<p class="mensaje-error">${_audaEsc(e.message)}</p>`;
    return;
  }
  if (!_audA.voz) _audA.voz = p.voz_id || null;

  const hayPrecio = !!(p.tramo && p.precio);
  body.innerHTML = `
    <p class="form-hint">Escuchá las muestras y elegí quién va a leer tu libro.</p>
    <div id="auda-voces">
      ${_audA.voces.map(v => `
        <label style="display:block; border:2px solid ${_audA.voz === v.voz_id ? '#8B1A2B' : '#E5E0D8'}; border-radius:12px; padding:10px 12px; margin-bottom:8px; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="radio" name="auda-voz" value="${_audaEsc(v.voz_id)}" ${_audA.voz === v.voz_id ? 'checked' : ''} onchange="_audaElegirVoz(this.value)" />
            <div>
              <div style="font-weight:700;">${_audaEsc(v.nombre)}</div>
              <div style="font-size:12px; color:#666;">${v.genero === 'femenina' ? 'Voz femenina' : 'Voz masculina'}${v.acento ? ' · ' + _audaEsc(v.acento) : ''}${v.descripcion ? ' · ' + _audaEsc(v.descripcion) : ''}</div>
            </div>
          </div>
          ${v.muestra_url ? `<audio controls preload="none" src="${_audaEsc(v.muestra_url)}" style="width:100%; margin-top:8px;"></audio>` : ''}
        </label>`).join('')}
    </div>
    ${hayPrecio ? `
    <div style="background:#FAE8EC; border-radius:12px; padding:12px 14px; margin:12px 0;">
      Audiolibro <strong>${AUDA_TRAMOS[p.tramo]}</strong> · ${_audaNum(p.total_caracteres)} caracteres.<br>
      Total: <strong>USD ${_audaNum(p.precio.usd)}</strong> con PayPal o <strong>ARS ${_audaNum(p.precio.ars)}</strong> con Mercado Pago.
    </div>
    <p class="form-hint">Empezamos a generar el audio apenas se acredita el pago. Cuando esté listo te mandamos un mail con un botón para descargar todos los capítulos en un zip.</p>` : ''}
    <p id="auda-error" class="mensaje-error" style="display:none;"></p>
  `;
  footer.innerHTML = `
    <button type="button" class="btn-secundario" onclick="_audaPantallaDiccionario()">Volver</button>
    ${hayPrecio ? `
    <button type="button" id="auda-btn-mp" class="btn-primario" onclick="_audaPagar('mercadopago')">Pagar con Mercado Pago (ARS ${_audaNum(p.precio.ars)})</button>
    <button type="button" id="auda-btn-pp" class="btn-primario" onclick="_audaPagar('paypal')">Pagar con PayPal (USD ${_audaNum(p.precio.usd)})</button>` : ''}`;
}

function _audaElegirVoz(vozId) {
  _audA.voz = vozId;
  document.querySelectorAll('#auda-voces label').forEach(l => {
    const r = l.querySelector('input[type=radio]');
    l.style.borderColor = r && r.checked ? '#8B1A2B' : '#E5E0D8';
  });
}

async function _audaPagar(proveedor) {
  _audaError('');
  if (!_audA.voz) return _audaError('Elegí una voz antes de pagar.');
  const idBtn = proveedor === 'mercadopago' ? 'auda-btn-mp' : 'auda-btn-pp';
  _audaOcupado('Generando link de pago…', true, idBtn);
  try {
    const r = await _audaInvocar({ accion: 'pagar', id_pedido: _audA.pedido.id_pedido, voz_id: _audA.voz, proveedor });
    window.location.href = r.linkPago;   // misma pestaña: al pagar vuelve a /pago-audiolibro
  } catch (e) {
    _audaOcupado('', false, idBtn);
    _audaError(e.message);
  }
}

// Si se llega desde /pago-audiolibro (?audiolibros=1), abre directo "Mis audiolibros"
document.addEventListener('DOMContentLoaded', () => {
  if (new URLSearchParams(window.location.search).get('audiolibros') !== '1') return;
  setTimeout(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && typeof abrirModalAudiolibro === 'function') abrirModalAudiolibro(null);
  }, 2500);
});
