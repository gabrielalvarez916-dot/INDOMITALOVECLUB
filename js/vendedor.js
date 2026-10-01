// ============================================================
// vendedor.js — Indómita Love Club
// Panel del vendedor: ventas del mes, nivel, comisión estimada,
// productos, mis clientes, link y código de vendedor.
// Usa las RPC vendedor_mi_panel() y vendedor_mis_clientes().
// ============================================================

const _VEND_PACKS = [
  { clave: 'individual', nombre: 'Individual' },
  { clave: 'basic',      nombre: 'Basic' },
  { clave: 'premium',    nombre: 'Premium' }
];

const _VEND_IMPULSOS = [
  { clave: 'impulso',    nombre: 'Impulso' },
  { clave: 'select',     nombre: 'Select' },
  { clave: 'resistence', nombre: 'Resistence' },
  { clave: 'complete',   nombre: 'Complete' }
];

let _vendLinkActual = '';
let _vendCodigoActual = '';

function _vendEsc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function _vendFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

function _vendUsd(n) {
  return 'USD ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _vendMontos(montos) {
  const partes = Object.entries(montos || {}).map(([moneda, total]) =>
    `${moneda} ${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return partes.length ? partes.join(' + ') : '—';
}

function _vendMesLindo(mes) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return mes || '';
  const [a, m] = mes.split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[parseInt(m, 10) - 1]} ${a}`;
}

async function cargarPanelVendedor() {
  const cont = document.getElementById('vendedor-contenido');
  if (!cont) return;

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const [resPanel, resClientes] = await Promise.all([
    supabaseClient.rpc('vendedor_mi_panel'),
    supabaseClient.rpc('vendedor_mis_clientes')
  ]);

  if (resPanel.error || !resPanel.data) {
    console.error('Error cargando panel de vendedor:', resPanel.error);
    cont.innerHTML = '<p class="mensaje-error">No se pudo cargar tu panel. Probá de nuevo en un momento.</p>';
    return;
  }

  const panel = resPanel.data;
  const clientes = Array.isArray(resClientes.data) ? resClientes.data : [];

  _vendCodigoActual = panel.codigo || '';
  _vendLinkActual = `${window.location.origin}/?v=${_vendCodigoActual}`;

  cont.innerHTML = `
    ${panel.estado === 'suspendido' ? `
      <div class="vend-aviso">Tu cuenta de vendedor está suspendida. Por ahora no se registran comisiones nuevas. Escribinos a soporte si tenés dudas.</div>
    ` : ''}
    ${_vendHtmlResumen(panel)}
    ${_vendHtmlProductos(panel.por_producto || {})}
    ${_vendHtmlLinkCodigo()}
    ${_vendHtmlClientes(clientes)}
    ${_vendHtmlLiquidaciones(panel.liquidaciones || [])}
  `;
}

function _vendHtmlResumen(p) {
  const total = p.ventas_mes || 0;
  const sig = p.proximo_nivel;
  let porcentaje = 100;
  let textoProgreso = 'Llegaste al nivel máximo. 🎉';
  if (sig) {
    porcentaje = Math.min(100, Math.round((total / sig.desde_ventas) * 100));
    textoProgreso = sig.faltan > 0
      ? `Te ${sig.faltan === 1 ? 'falta 1 venta' : `faltan ${sig.faltan} ventas`} para el nivel ${sig.nivel} (${_vendUsd(sig.usd_por_venta)} por venta, aplicado a todas tus ventas del mes).`
      : `¡Ya alcanzaste el nivel ${sig.nivel}!`;
  }

  return `
    <h3 class="vend-subtitulo">${_vendEsc(_vendMesLindo(p.mes))}</h3>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-numero">${total}</span>
        <span class="stat-label">Ventas del mes</span>
      </div>
      <div class="stat-card">
        <span class="stat-numero">${p.nivel ?? 1}</span>
        <span class="stat-label">Nivel actual · ${_vendUsd(p.usd_por_venta)} por venta</span>
      </div>
      <div class="stat-card">
        <span class="stat-numero">${_vendUsd(p.comision_estimada)}</span>
        <span class="stat-label">Comisión estimada</span>
      </div>
      <div class="stat-card">
        <span class="stat-numero">${p.clientes_activos ?? 0}</span>
        <span class="stat-label">Clientes activos</span>
      </div>
    </div>
    <div class="vend-progreso-caja">
      <div class="vend-progreso-barra"><div class="vend-progreso-relleno" style="width:${porcentaje}%;"></div></div>
      <p class="vend-progreso-texto">${_vendEsc(textoProgreso)}</p>
    </div>
  `;
}

function _vendHtmlProductos(porProducto) {
  const celda = (item) => `
    <div class="vend-producto">
      <span class="vend-producto-num">${porProducto[item.clave] || 0}</span>
      <span class="vend-producto-nombre">${item.nombre}</span>
    </div>`;

  return `
    <div class="vend-productos-grid">
      <div class="vend-productos-bloque">
        <h4 class="vend-productos-titulo">Packs</h4>
        <div class="vend-productos-fila">${_VEND_PACKS.map(celda).join('')}</div>
      </div>
      <div class="vend-productos-bloque">
        <h4 class="vend-productos-titulo">Impulsos</h4>
        <div class="vend-productos-fila">${_VEND_IMPULSOS.map(celda).join('')}</div>
      </div>
    </div>
  `;
}

function _vendHtmlLinkCodigo() {
  return `
    <h3 class="vend-subtitulo">Tu link y tu código</h3>
    <div class="plan-info vend-link-caja">
      <p class="form-info" style="margin:0 0 12px;">Compartí tu link o tu código con autores y editoriales. Cuando se registran con eso, quedan asignados a vos.</p>
      <div class="vend-copiar-fila">
        <span class="vend-copiar-label">Link</span>
        <input type="text" id="vend-input-link" readonly value="${_vendEsc(_vendLinkActual)}" onclick="this.select()" class="vend-copiar-input" />
        <button class="btn-primario btn-sm" onclick="copiarVendedor('link')">Copiar link</button>
      </div>
      <div class="vend-copiar-fila">
        <span class="vend-copiar-label">Código</span>
        <input type="text" id="vend-input-codigo" readonly value="${_vendEsc(_vendCodigoActual)}" onclick="this.select()" class="vend-copiar-input" />
        <button class="btn-secundario btn-sm" onclick="copiarVendedor('codigo')">Copiar código</button>
      </div>
    </div>
  `;
}

async function copiarVendedor(tipo) {
  const texto = tipo === 'link' ? _vendLinkActual : _vendCodigoActual;
  if (!texto) return;
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const input = document.getElementById(tipo === 'link' ? 'vend-input-link' : 'vend-input-codigo');
    if (!input) return;
    input.select();
    document.execCommand('copy');
  }
  mostrarToast(tipo === 'link' ? 'Link copiado.' : 'Código copiado.', 'ok');
}

// Arma el link de una red social a partir de lo que cargó el autor
// (puede ser una URL completa, un @usuario o solo el usuario).
function _vendLinkRed(valor, base) {
  const v = String(valor || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.|[a-z0-9-]+\.[a-z]{2,}\/)/i.test(v)) return 'https://' + v;
  if (!base) return null;
  return base + v.replace(/^@/, '');
}

// Redes y datos de contacto del autor (solo clientes activos).
function _vendRedes(c) {
  const redes = [
    ['TikTok', _vendLinkRed(c.tiktok, 'https://www.tiktok.com/@')],
    ['YouTube', _vendLinkRed(c.youtube, 'https://www.youtube.com/@')],
    ['Goodreads', _vendLinkRed(c.goodreads, null)],
    ['Web', _vendLinkRed(c.sitio_web, null)]
  ].filter(r => r[1]);
  if (!redes.length) return '';
  const links = redes.map(r => `<a href="${_vendEsc(r[1])}" target="_blank" rel="noopener noreferrer">${r[0]}</a>`).join(' · ');
  return `<br><span class="vend-mini">${links}</span>`;
}

// Columna Instagram: link bien visible al perfil del autor.
function _vendCeldaInstagram(c) {
  const url = _vendLinkRed(c.instagram, 'https://www.instagram.com/');
  if (!url) return '<span class="vend-mini">—</span>';
  const usuario = String(c.instagram).trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '').replace(/\?.*$/, '');
  return `<a href="${_vendEsc(url)}" target="_blank" rel="noopener noreferrer" style="font-weight:600;">@${_vendEsc(usuario || 'instagram')}</a>`;
}

// Etiqueta: Activo (tiene o tuvo campaña) / Nuevo (nunca creó una).
function _vendEtiqueta(c) {
  if (c.estado !== 'activo') return '<span class="badge badge-cancelada">Inactivo</span>';
  const base = c.tiene_campana
    ? '<span class="badge badge-aprobada">Activo</span>'
    : '<span class="badge badge-pendiente">Nuevo</span>';
  return base + _vendImpulsosActivos(c);
}

// Impulsos que el cliente tiene vigentes ahora (para saber qué ofrecer y qué no).
function _vendImpulsosActivos(c) {
  const claves = Array.isArray(c.impulsos_activos) ? c.impulsos_activos : [];
  if (c.estado !== 'activo') return '';
  if (!claves.length) return '<br><span class="vend-mini">Sin impulso activo</span>';
  const nombres = claves.map(k => {
    const it = _VEND_IMPULSOS.find(x => x.clave === k);
    return it ? it.nombre : k;
  });
  return '<br>' + nombres.map(n => `<span class="badge badge-aprobada" style="margin-top:4px;">${_vendEsc(n)}</span>`).join(' ');
}

let _vendClientesCache = [];

// Texto sobre el que busca el buscador (nombre, alias, mail, redes, libros, etiqueta, impulsos).
function _vendTextoBusqueda(c) {
  const etiqueta = c.estado !== 'activo' ? 'inactivo' : (c.tiene_campana ? 'activo' : 'nuevo');
  return [c.autor, c.alias, c.email, c.instagram, c.tiktok, c.youtube, c.goodreads, c.sitio_web, c.libros, etiqueta,
    (c.impulsos_activos || []).join(' ')]
    .filter(Boolean).join(' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _vendFiltrarClientes(q) {
  const cont = document.getElementById('vend-clientes-listado');
  if (!cont) return;
  const t = String(q || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^@/, '');
  const lista = t ? _vendClientesCache.filter(c => _vendTextoBusqueda(c).includes(t)) : _vendClientesCache;
  cont.innerHTML = _vendHtmlListadoClientes(lista, !!t);
}

function _vendHtmlClientes(clientes) {
  _vendClientesCache = clientes;
  return `
    <div class="vend-clientes-header">
      <h3 class="vend-subtitulo" style="margin:0;">Mis clientes</h3>
      <button class="btn-secundario btn-sm" onclick="abrirCalendarioVendedor()">📅 Calendario</button>
    </div>
    <input type="search" id="vend-buscador-clientes" class="vend-copiar-input" style="width:100%;max-width:420px;margin-bottom:12px;"
      placeholder="Buscar por nombre, mail, Instagram, libro, Nuevo, Activo, Select…" oninput="_vendFiltrarClientes(this.value)" />
    <div id="vend-clientes-listado">${_vendHtmlListadoClientes(clientes, false)}</div>
  `;
}

function _vendHtmlListadoClientes(clientes, buscando) {
  const activos = clientes.filter(c => c.estado === 'activo');
  const inactivos = clientes.filter(c => c.estado !== 'activo');

  const fila = (c) => `
    <tr>
      <td>${_vendEsc(c.autor || c.alias || '—')}${c.email ? `<br><span class="vend-mini">${_vendEsc(c.email)}</span>` : ''}${_vendRedes(c)}</td>
      <td>${c.estado === 'activo' ? _vendCeldaInstagram(c) : '<span class="vend-mini">—</span>'}</td>
      <td>${_vendEsc(c.libros || '—')}</td>
      <td>${_vendFecha(c.fecha_asignacion)}</td>
      <td>${c.estado === 'activo' ? _vendFecha(c.fecha_vencimiento) : `Traspasado el ${_vendFecha(c.fecha_traspaso)}`}</td>
      <td>${c.compras || 0}${c.compras ? `<br><span class="vend-mini">${_vendEsc(_vendMontos(c.montos))}</span>` : ''}</td>
      <td>${_vendEtiqueta(c)}</td>
      <td>${c.estado === 'activo' ? _vendHtmlSeguimiento(c) : '<span class="vend-mini">—</span>'}</td>
      <td>${c.estado === 'activo' ? `<button class="btn-primario btn-sm" onclick="abrirLinkPagoVendedor('${c.id_cliente}')">🔗 Generar link de pago</button>` : '<span class="vend-mini">—</span>'}</td>
    </tr>`;

  const tabla = (lista) => `
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr>
          <th>Autor</th><th>Instagram</th><th>Libro</th><th>Asignación</th><th>Vencimiento</th><th>Total comprado</th><th>Estado</th><th>Contacto</th><th>Pago</th>
        </tr></thead>
        <tbody>${lista.map(fila).join('')}</tbody>
      </table>
    </div>`;

  return `
    ${activos.length ? tabla(activos) : (buscando ? `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">No encontramos clientes con esa búsqueda.</p>
      </div>` : `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">Todavía no tenés clientes asignados.</p>
        <p class="estado-vacio-sub">Compartí tu link o tu código para empezar.</p>
      </div>`)}
    ${inactivos.length ? `
      <details class="vend-historial">
        <summary>Historial de traspasados (${inactivos.length})</summary>
        ${tabla(inactivos)}
      </details>` : ''}
  `;
}

function _vendHtmlLiquidaciones(liqs) {
  if (!liqs.length) return '';
  return `
    <h3 class="vend-subtitulo">Mis liquidaciones</h3>
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr><th>Mes</th><th>Ventas</th><th>Por venta</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>
          ${liqs.map(l => `
            <tr>
              <td>${_vendEsc(_vendMesLindo(l.mes))}</td>
              <td>${l.cantidad_ventas}</td>
              <td>${_vendUsd(l.usd_por_venta)}</td>
              <td><strong>${_vendUsd(l.total_usd)}</strong></td>
              <td>${l.estado === 'pagada'
                ? `<span class="badge badge-aprobada">Pagada ${_vendFecha(l.pagada_en)}</span>`
                : '<span class="badge badge-pendiente">Pendiente</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}


// ============================================================
// SEGUIMIENTO DE CONTACTO (contactado / no contactado + razón)
// ============================================================

const _VEND_RAZONES = [
  { clave: 'venta',                  nombre: 'Venta' },
  { clave: 'no_respondio',           nombre: 'No respondió' },
  { clave: 'negativa_precio',        nombre: 'Negativa por precio' },
  { clave: 'negativa_otro_servicio', nombre: 'Negativa por otro servicio' },
  { clave: 'negativa_otro_motivo',   nombre: 'Negativa por otro motivo' },
  { clave: 'volver_a_comunicar',     nombre: 'Volver a comunicar' }
];

// Pasa un ISO a "YYYY-MM-DDTHH:mm" en hora de Argentina (para el input datetime-local).
function _vendIsoAInputFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

// Pasa lo que eligió el vendedor (hora de Argentina, UTC-3 sin horario de verano) a ISO.
function _vendInputFechaAIso(valor) {
  if (!valor) return null;
  const d = new Date(valor + ':00-03:00');
  return isNaN(d) ? null : d.toISOString();
}

function _vendFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
}

function _vendHtmlSeguimiento(c) {
  const id = c.id_cliente;
  const contactado = !!c.contactado;
  const razon = c.razon_contacto || '';
  const mostrarFecha = contactado && razon === 'volver_a_comunicar';
  return `
    <div class="vend-seg">
      <select id="vend-seg-contactado-${id}" class="vend-seg-select" onchange="_vendSeguimientoCambio('${id}')">
        <option value="0" ${!contactado ? 'selected' : ''}>No contactado</option>
        <option value="1" ${contactado ? 'selected' : ''}>Contactado</option>
      </select>
      <select id="vend-seg-razon-${id}" class="vend-seg-select" style="${contactado ? '' : 'display:none;'}" onchange="_vendSeguimientoCambio('${id}')">
        <option value="" ${!razon ? 'selected' : ''}>Elegí la razón…</option>
        ${_VEND_RAZONES.map(r => `<option value="${r.clave}" ${razon === r.clave ? 'selected' : ''}>${r.nombre}</option>`).join('')}
      </select>
      <input type="datetime-local" id="vend-seg-fecha-${id}" class="vend-seg-select" style="${mostrarFecha ? '' : 'display:none;'}"
        value="${_vendEsc(_vendIsoAInputFecha(c.fecha_recontacto))}" onchange="_vendSeguimientoCambio('${id}')" />
    </div>`;
}

async function _vendSeguimientoCambio(idCliente) {
  const selContactado = document.getElementById(`vend-seg-contactado-${idCliente}`);
  const selRazon = document.getElementById(`vend-seg-razon-${idCliente}`);
  const inpFecha = document.getElementById(`vend-seg-fecha-${idCliente}`);
  if (!selContactado || !selRazon || !inpFecha) return;

  const contactado = selContactado.value === '1';
  selRazon.style.display = contactado ? '' : 'none';
  if (!contactado) selRazon.value = '';

  const razon = contactado ? selRazon.value : '';
  const pideFecha = contactado && razon === 'volver_a_comunicar';
  inpFecha.style.display = pideFecha ? '' : 'none';
  if (!pideFecha) inpFecha.value = '';

  // Falta un dato para poder guardar: esperamos a que lo complete.
  if (contactado && !razon) return;
  if (pideFecha && !inpFecha.value) return;

  const fechaIso = pideFecha ? _vendInputFechaAIso(inpFecha.value) : null;

  const { data, error } = await supabaseClient.rpc('vendedor_guardar_seguimiento', {
    p_id_cliente: idCliente,
    p_contactado: contactado,
    p_razon: contactado ? razon : null,
    p_fecha_recontacto: fechaIso
  });

  if (error || data?.error) {
    console.error('Error guardando seguimiento:', error || data?.error);
    mostrarToast(data?.error || 'No se pudo guardar. Probá de nuevo.', 'error');
    return;
  }

  const c = _vendClientesCache.find(x => x.id_cliente === idCliente);
  if (c) {
    c.contactado = contactado;
    c.razon_contacto = contactado ? razon : null;
    c.fecha_recontacto = fechaIso;
  }
  mostrarToast('Seguimiento guardado.', 'ok');
}

// ============================================================
// CALENDARIO DEL VENDEDOR (solo clientes a volver a comunicar)
// ============================================================

let _vendCalOffset = 0;
let _vendCalPorDia = {};

function _vendClaveDia(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

async function abrirCalendarioVendedor() {
  _vendCalOffset = 0;
  mostrarModal('modal-detalle-campana');
  const titulo = document.getElementById('modal-detalle-titulo');
  const body = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');
  if (titulo) titulo.textContent = 'Calendario de recontacto';
  if (footer) footer.innerHTML = '';
  if (body) body.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient.rpc('vendedor_mi_calendario');
  if (error) {
    console.error('Error cargando calendario de vendedor:', error);
    if (body) body.innerHTML = '<p class="mensaje-error">No se pudo cargar el calendario.</p>';
    return;
  }

  _vendCalPorDia = {};
  (Array.isArray(data) ? data : []).forEach(ev => {
    const clave = _vendClaveDia(ev.fecha_recontacto);
    (_vendCalPorDia[clave] = _vendCalPorDia[clave] || []).push(ev);
  });
  _vendRenderCalendario();
}

function _vendRenderCalendario() {
  const body = document.getElementById('modal-detalle-body');
  const titulo = document.getElementById('modal-detalle-titulo');
  const footer = document.getElementById('modal-detalle-footer');
  if (titulo) titulo.textContent = 'Calendario de recontacto';
  if (footer) footer.innerHTML = '';
  if (!body) return;

  const hoy = new Date();
  const mes = new Date(hoy.getFullYear(), hoy.getMonth() + _vendCalOffset, 1);
  const nombreMes = mes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const primerDiaSemana = (mes.getDay() + 6) % 7;
  const diasEnMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();

  let celdas = '';
  for (let i = 0; i < primerDiaSemana; i++) celdas += '<div class="cal-celda cal-celda-vacia"></div>';
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const evs = _vendCalPorDia[fechaStr] || [];
    celdas += `
      <div class="cal-celda ${evs.length ? 'cal-celda-con-eventos' : ''}" ${evs.length ? `onclick="_vendDetalleDiaCalendario('${fechaStr}')"` : ''}>
        <span class="cal-numero">${dia}</span>
        ${evs.length ? `<div class="cal-eventos"><span class="cal-evento-extra">📞 ${evs.length}</span></div>` : ''}
      </div>`;
  }

  const total = Object.values(_vendCalPorDia).reduce((a, l) => a + l.length, 0);
  body.innerHTML = `
    <div class="cal-nav">
      <button class="cal-nav-flecha" onclick="_vendCalOffset--; _vendRenderCalendario()">←</button>
      <p class="cal-nav-mes">${nombreMes}</p>
      <button class="cal-nav-flecha" onclick="_vendCalOffset++; _vendRenderCalendario()">→</button>
    </div>
    <div class="cal-grid">
      ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="cal-dia-header">${d}</div>`).join('')}
      ${celdas}
    </div>
    <p class="form-info" style="margin-top:12px;">${total ? `Tenés ${total} cliente${total === 1 ? '' : 's'} para volver a comunicar.` : 'Todavía no agendaste ningún recontacto. Elegí "Contactado → Volver a comunicar" en un cliente para que aparezca acá.'}</p>
  `;
}

function _vendDetalleDiaCalendario(fechaStr) {
  const evs = (_vendCalPorDia[fechaStr] || []).slice().sort((a, b) => new Date(a.fecha_recontacto) - new Date(b.fecha_recontacto));
  const titulo = document.getElementById('modal-detalle-titulo');
  const body = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');
  if (titulo) titulo.textContent = typeof formatearFechaAmigable === 'function' ? formatearFechaAmigable(fechaStr) : fechaStr;
  if (body) {
    body.innerHTML = evs.map(ev => {
      const hora = new Date(ev.fecha_recontacto).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
      const vencido = new Date(ev.fecha_recontacto) < new Date();
      const ig = _vendLinkRed(ev.instagram, 'https://www.instagram.com/');
      return `
        <div class="cal-detalle-card">
          <p class="cal-detalle-texto"><strong>📞 ${_vendEsc(ev.autor || ev.alias || '—')}</strong> ${vencido ? '<span class="badge badge-pendiente">Atrasado</span>' : ''}</p>
          <p class="cal-detalle-meta">${_vendEsc(ev.email || '')}</p>
          ${ig ? `<p class="cal-detalle-meta"><a href="${_vendEsc(ig)}" target="_blank" rel="noopener noreferrer">Instagram</a></p>` : ''}
          <p class="cal-detalle-fecha">🕐 Volver a comunicar a las ${hora}</p>
        </div>`;
    }).join('');
  }
  if (footer) footer.innerHTML = '<button class="btn-secundario" onclick="_vendRenderCalendario()">← Volver al calendario</button>';
}

// ============================================================
// GENERAR LINK DE PAGO PARA UN CLIENTE
// ============================================================

const _VEND_PRODUCTOS_LINK = [
  { clave: 'individual',   nombre: 'Pack Individual (1 campaña)', requiereCampana: false },
  { clave: 'pack_basic',   nombre: 'Pack Basic (3 campañas)',     requiereCampana: false },
  { clave: 'pack_premium', nombre: 'Pack Premium (5 campañas)',   requiereCampana: false },
  { clave: 'impulso',      nombre: 'Impulso',                     requiereCampana: true },
  { clave: 'select',       nombre: 'Select',                      requiereCampana: true },
  { clave: 'resistence',   nombre: 'Resistence',                  requiereCampana: true },
  { clave: 'complete',     nombre: 'Complete',                    requiereCampana: true }
];

let _vendLinkCliente = null;
let _vendLinkCampanas = [];

async function abrirLinkPagoVendedor(idCliente) {
  const c = _vendClientesCache.find(x => x.id_cliente === idCliente);
  if (!c) return;
  _vendLinkCliente = c;
  _vendLinkCampanas = [];

  mostrarModal('modal-detalle-campana');
  const titulo = document.getElementById('modal-detalle-titulo');
  const body = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');
  if (titulo) titulo.textContent = 'Generar link de pago';
  if (footer) footer.innerHTML = '<button class="btn-secundario" onclick="cerrarModales()">Cerrar</button>';
  if (body) {
    body.innerHTML = `
      <p class="form-info" style="margin-top:0;">Cliente: <strong>${_vendEsc(c.autor || c.alias || '—')}</strong></p>
      <div class="form-grupo">
        <label class="form-label">¿Qué producto querés cobrar?</label>
        <select id="vend-link-producto" class="form-input" onchange="_vendLinkCambioProducto()">
          <option value="">Elegí un producto…</option>
          ${_VEND_PRODUCTOS_LINK.map(p => `<option value="${p.clave}">${p.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-grupo" id="vend-link-grupo-campana" style="display:none;">
        <label class="form-label">¿Para qué campaña?</label>
        <select id="vend-link-campana" class="form-input"><option value="">Cargando campañas…</option></select>
      </div>
      <div class="form-grupo">
        <label class="form-label">Moneda</label>
        <select id="vend-link-moneda" class="form-input">
          <option value="">Elegí la moneda…</option>
          <option value="ARS">Pesos argentinos (ARS) — Mercado Pago</option>
          <option value="USD">Dólares (USD) — PayPal</option>
        </select>
      </div>
      <button class="btn-primario" id="vend-link-btn" onclick="_vendGenerarLink()">Generar link</button>
      <div id="vend-link-resultado" style="margin-top:16px;"></div>
    `;
  }
}

async function _vendLinkCambioProducto() {
  const clave = document.getElementById('vend-link-producto')?.value;
  const prod = _VEND_PRODUCTOS_LINK.find(p => p.clave === clave);
  const grupo = document.getElementById('vend-link-grupo-campana');
  const sel = document.getElementById('vend-link-campana');
  if (!grupo || !sel) return;

  if (!prod || !prod.requiereCampana) { grupo.style.display = 'none'; return; }
  grupo.style.display = '';

  if (!_vendLinkCampanas.length) {
    const { data, error } = await supabaseClient.rpc('vendedor_campanas_cliente', { p_id_cliente: _vendLinkCliente.id_cliente });
    _vendLinkCampanas = (!error && Array.isArray(data)) ? data : [];
  }
  sel.innerHTML = _vendLinkCampanas.length
    ? `<option value="">Elegí la campaña…</option>${_vendLinkCampanas.map(k => `<option value="${k.id}">${_vendEsc(k.nombre_libro || 'Sin título')}</option>`).join('')}`
    : '<option value="">Este autor no tiene campañas activas</option>';
}

async function _vendGenerarLink() {
  const producto = document.getElementById('vend-link-producto')?.value;
  const moneda = document.getElementById('vend-link-moneda')?.value;
  const idCampana = document.getElementById('vend-link-campana')?.value || null;
  const res = document.getElementById('vend-link-resultado');
  const btn = document.getElementById('vend-link-btn');
  const prod = _VEND_PRODUCTOS_LINK.find(p => p.clave === producto);

  if (!prod) { mostrarToast('Elegí el producto.', 'error'); return; }
  if (!moneda) { mostrarToast('Elegí la moneda.', 'error'); return; }
  if (prod.requiereCampana && !idCampana) { mostrarToast('Elegí la campaña.', 'error'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  const { data, error } = await supabaseClient.rpc('vendedor_crear_pedido_pago', {
    p_id_cliente: _vendLinkCliente.id_cliente,
    p_producto: producto,
    p_moneda: moneda,
    p_id_campana: prod.requiereCampana ? idCampana : null
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Generar link'; }

  if (error || !data || data.error) {
    console.error('Error generando link de pago:', error || data?.error);
    if (res) res.innerHTML = `<p class="mensaje-error">${_vendEsc(data?.error || 'No se pudo generar el link. Probá de nuevo.')}</p>`;
    return;
  }

  const monto = Number(data.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (res) {
    res.innerHTML = `
      <div class="plan-info vend-link-caja">
        <p class="form-info" style="margin:0 0 10px;"><strong>${_vendEsc(prod.nombre)}</strong> · ${_vendEsc(data.moneda)} ${monto}<br>
        El pedido ya quedó cargado como pendiente. Este link lo puede abrir el autor desde cualquier lado y paga el precio correcto.</p>
        <div class="vend-copiar-fila">
          <input type="text" id="vend-link-generado" readonly value="${_vendEsc(data.link)}" onclick="this.select()" class="vend-copiar-input" />
          <button class="btn-primario btn-sm" onclick="_vendCopiarLinkGenerado()">Copiar link</button>
        </div>
      </div>`;
  }
}

async function _vendCopiarLinkGenerado() {
  const input = document.getElementById('vend-link-generado');
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (e) {
    input.select();
    document.execCommand('copy');
  }
  mostrarToast('Link copiado.', 'ok');
}
