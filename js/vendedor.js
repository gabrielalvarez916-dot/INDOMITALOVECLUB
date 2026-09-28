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
    ['Instagram', _vendLinkRed(c.instagram, 'https://www.instagram.com/')],
    ['TikTok', _vendLinkRed(c.tiktok, 'https://www.tiktok.com/@')],
    ['YouTube', _vendLinkRed(c.youtube, 'https://www.youtube.com/@')],
    ['Goodreads', _vendLinkRed(c.goodreads, null)],
    ['Web', _vendLinkRed(c.sitio_web, null)]
  ].filter(r => r[1]);
  if (!redes.length) return '';
  const links = redes.map(r => `<a href="${_vendEsc(r[1])}" target="_blank" rel="noopener noreferrer">${r[0]}</a>`).join(' · ');
  return `<br><span class="vend-mini">${links}</span>`;
}

function _vendHtmlClientes(clientes) {
  const activos = clientes.filter(c => c.estado === 'activo');
  const inactivos = clientes.filter(c => c.estado !== 'activo');

  const fila = (c) => `
    <tr>
      <td>${_vendEsc(c.autor || c.alias || '—')}${c.email ? `<br><span class="vend-mini">${_vendEsc(c.email)}</span>` : ''}${_vendRedes(c)}</td>
      <td>${_vendEsc(c.libros || '—')}</td>
      <td>${_vendFecha(c.fecha_asignacion)}</td>
      <td>${c.estado === 'activo' ? _vendFecha(c.fecha_vencimiento) : `Traspasado el ${_vendFecha(c.fecha_traspaso)}`}</td>
      <td>${c.compras || 0}${c.compras ? `<br><span class="vend-mini">${_vendEsc(_vendMontos(c.montos))}</span>` : ''}</td>
      <td><span class="badge ${c.estado === 'activo' ? 'badge-aprobada' : 'badge-cancelada'}">${c.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
    </tr>`;

  const tabla = (lista) => `
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr>
          <th>Autor</th><th>Libro</th><th>Asignación</th><th>Vencimiento</th><th>Total comprado</th><th>Estado</th>
        </tr></thead>
        <tbody>${lista.map(fila).join('')}</tbody>
      </table>
    </div>`;

  return `
    <h3 class="vend-subtitulo">Mis clientes</h3>
    ${activos.length ? tabla(activos) : `
      <div class="estado-vacio">
        <p class="estado-vacio-texto">Todavía no tenés clientes asignados.</p>
        <p class="estado-vacio-sub">Compartí tu link o tu código para empezar.</p>
      </div>`}
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
