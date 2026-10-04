// ============================================================
// admin-vendedores.js — Indómita Love Club
// Panel admin del programa de vendedores: alta/suspensión,
// ventas (comisiones), liquidaciones, reasignación de clientes
// y log de intentos de código.
// Depende de helpers de vendedor.js (_vendEsc, _vendFecha, _vendUsd, _vendMesLindo).
// ============================================================

let _adminVendMes = null;          // mes actual (YYYY-MM) según el servidor
let _adminVendLista = [];          // vendedores cargados
let _adminVendMapa = {};           // id -> { nombre, email, codigo }

async function cargarVendedoresAdmin() {
  await cargarVendedoresListaAdmin();
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 1 · VENDEDORES
// ────────────────────────────────────────────────────────────

async function cargarVendedoresListaAdmin() {
  const cont = document.getElementById('admin-vendedores-lista');
  if (!cont) return;
  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient.rpc('admin_listar_vendedores');
  if (error || !data) {
    console.error('Error listando vendedores:', error);
    cont.innerHTML = '<p class="mensaje-error">No se pudo cargar la lista de vendedores.</p>';
    return;
  }

  _adminVendMes = data.mes;
  _adminVendLista = data.vendedores || [];
  _adminVendMapa = {};
  _adminVendLista.forEach(v => { _adminVendMapa[v.id] = v; });

  const pendientes = data.pendientes || [];

  cont.innerHTML = `
    <div class="admin-verificacion-manual" style="margin-bottom:24px;">
      <p class="admin-verificacion-manual-titulo">Dar de alta un vendedor</p>
      <p class="admin-verificacion-manual-texto">Ingresá el mail con el que va a entrar con Google. Si todavía no tiene cuenta, queda pendiente y se activa solo cuando ingrese por primera vez. El código es opcional (si lo dejás vacío se genera uno).</p>
      <form onsubmit="crearVendedorAdmin(event)">
        <div class="form-grupo">
          <label for="vend-alta-email">Mail del vendedor</label>
          <input type="email" id="vend-alta-email" required placeholder="vendedor@mail.com" />
        </div>
        <div class="form-grupo">
          <label for="vend-alta-codigo">Código (opcional)</label>
          <input type="text" id="vend-alta-codigo" maxlength="20" placeholder="4 a 20 letras o números" />
        </div>
        <div class="form-grupo">
          <label for="vend-alta-paypal">Mail de PayPal para cobrar (opcional)</label>
          <input type="email" id="vend-alta-paypal" placeholder="paypal@mail.com" />
        </div>
        <div id="vend-alta-error" class="mensaje-error" style="display:none;"></div>
        <button type="submit" class="btn-primario" id="btn-vend-alta">Dar de alta</button>
      </form>
    </div>

    <h3 class="vend-subtitulo">Vendedores (${_adminVendLista.length})</h3>
    ${_adminVendLista.length ? `
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr>
            <th>Vendedor</th><th>Código</th><th>PayPal</th><th>Clientes</th><th>Ventas ${_vendEsc(_adminVendMes || '')}</th><th>Alta</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody>
            ${_adminVendLista.map(v => `
              <tr>
                <td>${_vendEsc(v.nombre || '—')}<br><span class="vend-mini">${_vendEsc(v.email)}</span></td>
                <td><strong>${_vendEsc(v.codigo)}</strong></td>
                <td>${_vendEsc(v.email_paypal || '—')}</td>
                <td>${v.clientes}</td>
                <td>${v.ventas_mes}</td>
                <td>${_vendFecha(v.creado_en)}</td>
                <td><span class="badge ${v.estado === 'habilitado' ? 'badge-aprobada' : 'badge-cancelada'}">${v.estado === 'habilitado' ? 'Habilitado' : 'Suspendido'}</span></td>
                <td>
                  <button class="btn-secundario btn-sm" onclick="editarPaypalVendedorAdmin('${v.id}')">Editar PayPal</button>
                  <button class="btn-secundario btn-sm" onclick="suspenderVendedorAdmin('${v.id}', ${v.estado === 'habilitado'})">
                    ${v.estado === 'habilitado' ? 'Suspender' : 'Habilitar'}
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="estado-vacio"><p class="estado-vacio-texto">Todavía no hay vendedores.</p></div>`}

    ${pendientes.length ? `
      <h3 class="vend-subtitulo">Pendientes de primer ingreso (${pendientes.length})</h3>
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr><th>Mail</th><th>Código</th><th>PayPal</th><th>Creado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${pendientes.map(p => `
              <tr>
                <td>${_vendEsc(p.email)}</td>
                <td><strong>${_vendEsc(p.codigo)}</strong></td>
                <td>${_vendEsc(p.email_paypal || '—')}</td>
                <td>${_vendFecha(p.creado_en)}</td>
                <td><button class="btn-secundario btn-sm" onclick="quitarVendedorPendienteAdmin('${_vendEsc(p.email)}')">Quitar</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

    <div class="admin-verificacion-manual" style="margin-top:32px;">
      <p class="admin-verificacion-manual-titulo">Reparto inicial de clientes</p>
      <p class="admin-verificacion-manual-texto">Se usa una única vez, al lanzar el programa: reparte de forma pareja los autores y editoriales existentes entre los vendedores habilitados.</p>
      <button class="btn-secundario" id="btn-vend-reparto" onclick="repartoInicialVendedoresAdmin()">Ejecutar reparto inicial</button>
    </div>
  `;
}

async function crearVendedorAdmin(e) {
  e.preventDefault();
  const email = document.getElementById('vend-alta-email').value.trim();
  const codigo = document.getElementById('vend-alta-codigo').value.trim();
  const paypal = document.getElementById('vend-alta-paypal').value.trim();
  const errEl = document.getElementById('vend-alta-error');
  const btn = document.getElementById('btn-vend-alta');
  errEl.style.display = 'none';
  btn.disabled = true;

  const { data, error } = await supabaseClient.rpc('admin_crear_vendedor', {
    p_email: email,
    p_codigo: codigo || null,
    p_email_paypal: paypal || null
  });

  btn.disabled = false;
  if (error) {
    errEl.textContent = error.message || 'No se pudo dar de alta al vendedor.';
    errEl.style.display = 'block';
    return;
  }

  mostrarToast(data?.estado === 'activo'
    ? `Vendedor activado. Código: ${data.codigo}`
    : `Vendedor pendiente. Se activa cuando ingrese con ese mail. Código: ${data?.codigo}`, 'ok');
  await cargarVendedoresListaAdmin();
}

async function editarPaypalVendedorAdmin(id) {
  const v = _adminVendMapa[id];
  const nombre = v?.nombre || v?.email || 'este vendedor';
  const valor = prompt(`Mail de PayPal de ${nombre}.\nDejalo vacío para borrarlo.`, v?.email_paypal || '');
  if (valor === null) return;   // canceló

  const { data, error } = await supabaseClient.rpc('admin_editar_paypal_vendedor', { p_id: id, p_email_paypal: valor });
  if (error || !data || data.error) {
    mostrarToast(data?.error || error?.message || 'No se pudo guardar el mail de PayPal.', 'error');
    return;
  }
  mostrarToast(data.email_paypal ? 'Mail de PayPal guardado.' : 'Mail de PayPal borrado.', 'ok');
  await cargarVendedoresListaAdmin();
}

async function suspenderVendedorAdmin(id, suspender) {
  const v = _adminVendMapa[id];
  const nombre = v?.nombre || v?.email || 'este vendedor';
  const msg = suspender
    ? `¿Suspender a ${nombre}? Dejará de registrar comisiones nuevas y no va a recibir clientes en la rotación.`
    : `¿Volver a habilitar a ${nombre}?`;
  if (!confirm(msg)) return;

  const { error } = await supabaseClient.rpc('admin_suspender_vendedor', { p_id: id, p_suspender: suspender });
  if (error) {
    mostrarToast(error.message || 'No se pudo actualizar el vendedor.', 'error');
    return;
  }
  mostrarToast(suspender ? 'Vendedor suspendido.' : 'Vendedor habilitado.', 'ok');
  await cargarVendedoresListaAdmin();
}

async function quitarVendedorPendienteAdmin(email) {
  if (!confirm(`¿Quitar el alta pendiente de ${email}?`)) return;
  const { error } = await supabaseClient.rpc('admin_quitar_vendedor_pendiente', { p_email: email });
  if (error) {
    mostrarToast(error.message || 'No se pudo quitar.', 'error');
    return;
  }
  mostrarToast('Alta pendiente quitada.', 'ok');
  await cargarVendedoresListaAdmin();
}

async function repartoInicialVendedoresAdmin() {
  if (!confirm('El reparto inicial se hace UNA sola vez. ¿Repartir ahora los clientes existentes entre los vendedores habilitados?')) return;
  if (!confirm('Última confirmación: esto asigna clientes a los vendedores. ¿Seguro?')) return;

  const btn = document.getElementById('btn-vend-reparto');
  if (btn) btn.disabled = true;
  const { data, error } = await supabaseClient.rpc('admin_repartir_clientes_iniciales');
  if (btn) btn.disabled = false;

  if (error) {
    mostrarToast(error.message || 'No se pudo hacer el reparto.', 'error');
    return;
  }
  const detalle = data && typeof data === 'object'
    ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ')
    : '';
  mostrarToast(`Reparto realizado. ${detalle}`.trim(), 'ok');
  await cargarVendedoresListaAdmin();
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 2 · VENTAS (COMISIONES)
// ────────────────────────────────────────────────────────────

async function _adminVendAsegurarMapa() {
  if (Object.keys(_adminVendMapa).length) return;
  const { data } = await supabaseClient.rpc('admin_listar_vendedores');
  if (data) {
    _adminVendMes = data.mes;
    _adminVendLista = data.vendedores || [];
    _adminVendLista.forEach(v => { _adminVendMapa[v.id] = v; });
  }
}

async function _adminVendNombresClientes(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = {};
  if (!unicos.length) return mapa;
  const { data } = await supabaseClient.from('usuarios').select('id, email, alias, nombre, apellido').in('id', unicos);
  (data || []).forEach(u => {
    mapa[u.id] = {
      nombre: [u.nombre, u.apellido].filter(Boolean).join(' ') || u.alias || '',
      email: u.email
    };
  });
  return mapa;
}

function _adminVendCelda(mapa, id) {
  const u = mapa[id];
  if (!u) return `<span class="vend-mini">${_vendEsc(String(id || '').slice(0, 8))}…</span>`;
  return `${_vendEsc(u.nombre || '—')}<br><span class="vend-mini">${_vendEsc(u.email || '')}</span>`;
}

async function cargarVentasVendedoresAdmin() {
  const cont = document.getElementById('admin-vendedores-ventas');
  if (!cont) return;
  await _adminVendAsegurarMapa();

  const mesInput = document.getElementById('vend-ventas-mes');
  const mes = (mesInput && mesInput.value) || _adminVendMes;

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: ventas, error } = await supabaseClient
    .from('vendedor_ventas')
    .select('id, id_vendedor, id_cliente, tipo, producto, monto_cobrado, moneda, mes, creado_en, anulada_en, motivo_anulacion')
    .eq('mes', mes)
    .order('creado_en', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error cargando ventas de vendedores:', error);
    cont.innerHTML = '<p class="mensaje-error">No se pudieron cargar las ventas.</p>';
    return;
  }

  const lista = ventas || [];
  const clientes = await _adminVendNombresClientes(lista.map(v => v.id_cliente));
  const validas = lista.filter(v => !v.anulada_en);

  cont.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:16px;">
      <label for="vend-ventas-mes" class="form-label" style="margin:0;">Mes</label>
      <input type="month" id="vend-ventas-mes" value="${_vendEsc(mes)}" onchange="cargarVentasVendedoresAdmin()" class="form-input" style="max-width:200px;" />
      <span class="form-info" style="margin:0;">${validas.length} ventas válidas · ${lista.length - validas.length} anuladas</span>
    </div>
    ${lista.length ? `
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr><th>Fecha</th><th>Vendedor</th><th>Cliente</th><th>Producto</th><th>Monto cobrado</th><th>Estado</th></tr></thead>
          <tbody>
            ${lista.map(v => {
              const vend = _adminVendMapa[v.id_vendedor];
              return `
              <tr>
                <td>${_vendFecha(v.creado_en)}</td>
                <td>${_vendEsc(vend?.codigo || '—')}<br><span class="vend-mini">${_vendEsc(vend?.email || '')}</span></td>
                <td>${_adminVendCelda(clientes, v.id_cliente)}</td>
                <td>${_vendEsc(v.tipo === 'pack' ? 'Pack' : 'Impulso')} · ${_vendEsc(v.producto)}</td>
                <td>${_vendEsc(v.moneda)} ${Number(v.monto_cobrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td>${v.anulada_en
                  ? `<span class="badge badge-cancelada">Anulada</span><br><span class="vend-mini">${_vendEsc(v.motivo_anulacion || '')}</span>`
                  : '<span class="badge badge-aprobada">Válida</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `<div class="estado-vacio"><p class="estado-vacio-texto">No hay ventas en ${_vendEsc(_vendMesLindo(mes))}.</p></div>`}
  `;
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 3 · LIQUIDACIONES
// ────────────────────────────────────────────────────────────

async function cargarLiquidacionesVendedoresAdmin() {
  const cont = document.getElementById('admin-vendedores-liquidaciones');
  if (!cont) return;

  const mesInput = document.getElementById('vend-liq-mes');
  const mes = mesInput ? mesInput.value : '';

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient.rpc('admin_listar_liquidaciones', { p_mes: mes || null });
  if (error) {
    console.error('Error listando liquidaciones:', error);
    cont.innerHTML = '<p class="mensaje-error">No se pudieron cargar las liquidaciones.</p>';
    return;
  }

  const lista = data || [];
  const pendienteUsd = lista.filter(l => l.estado !== 'pagada').reduce((s, l) => s + Number(l.total_usd || 0), 0);

  cont.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:16px;">
      <label for="vend-liq-mes" class="form-label" style="margin:0;">Mes</label>
      <input type="month" id="vend-liq-mes" value="${_vendEsc(mes)}" onchange="cargarLiquidacionesVendedoresAdmin()" class="form-input" style="max-width:200px;" />
      <button class="btn-secundario btn-sm" onclick="document.getElementById('vend-liq-mes').value=''; cargarLiquidacionesVendedoresAdmin()">Ver todos</button>
      <span class="form-info" style="margin:0;">Pendiente de pago: <strong>${_vendUsd(pendienteUsd)}</strong></span>
    </div>
    ${lista.length ? `
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr><th>Mes</th><th>Vendedor</th><th>PayPal</th><th>Ventas</th><th>Por venta</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${lista.map(l => `
              <tr>
                <td>${_vendEsc(_vendMesLindo(l.mes))}</td>
                <td>${_vendEsc(l.nombre || '—')}<br><span class="vend-mini">${_vendEsc(l.email)} · ${_vendEsc(l.codigo)}</span></td>
                <td>${_vendEsc(l.email_paypal || '—')}</td>
                <td>${l.cantidad_ventas}</td>
                <td>${_vendUsd(l.usd_por_venta)}</td>
                <td><strong>${_vendUsd(l.total_usd)}</strong></td>
                <td>${l.estado === 'pagada'
                  ? `<span class="badge badge-aprobada">Pagada ${_vendFecha(l.pagada_en)}</span>${l.referencia_paypal ? `<br><span class="vend-mini">${_vendEsc(l.referencia_paypal)}</span>` : ''}`
                  : '<span class="badge badge-pendiente">Pendiente</span>'}</td>
                <td>${l.estado === 'pagada' ? '—' : `<button class="btn-primario btn-sm" onclick="marcarLiquidacionPagadaAdmin('${l.id}')">Marcar pagada</button>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="estado-vacio"><p class="estado-vacio-texto">No hay liquidaciones para mostrar.</p><p class="estado-vacio-sub">Se generan solas el día 1 de cada mes.</p></div>'}
  `;
}

async function marcarLiquidacionPagadaAdmin(id) {
  const referencia = prompt('Referencia del pago en PayPal (opcional). Aceptar para marcarla como pagada:');
  if (referencia === null) return;
  const { error } = await supabaseClient.rpc('admin_marcar_liquidacion_pagada', { p_id: id, p_referencia: referencia || null });
  if (error) {
    mostrarToast(error.message || 'No se pudo marcar como pagada.', 'error');
    return;
  }
  mostrarToast('Liquidación marcada como pagada.', 'ok');
  await cargarLiquidacionesVendedoresAdmin();
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 4 · CLIENTES (REASIGNAR + HISTORIAL)
// ────────────────────────────────────────────────────────────

async function cargarClientesVendedoresAdmin() {
  const cont = document.getElementById('admin-vendedores-clientes');
  if (!cont) return;
  await _adminVendAsegurarMapa();

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data: historial, error } = await supabaseClient
    .from('vendedor_clientes_historial')
    .select('id, id_cliente, id_vendedor_anterior, id_vendedor_nuevo, motivo, creado_en')
    .order('creado_en', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Error cargando historial de asignaciones:', error);
  }

  const lista = historial || [];
  const clientes = await _adminVendNombresClientes(lista.map(h => h.id_cliente));
  _adminVendHistorialInicial = { lista, clientes };
  const habilitados = _adminVendLista.filter(v => v.estado === 'habilitado');
  const nombreVend = (id) => id
    ? _vendEsc(_adminVendMapa[id]?.codigo || String(id).slice(0, 8))
    : '—';

  cont.innerHTML = `
    <div style="margin-bottom:20px;">
      <button class="btn-secundario btn-sm" onclick="descargarExcelVencenManana(this)">📥 Excel: campañas que vencen mañana (todos los asesores)</button>
    </div>
    <div class="admin-verificacion-manual" style="margin-bottom:24px;">
      <p class="admin-verificacion-manual-titulo">Reasignar un cliente a mano</p>
      <p class="admin-verificacion-manual-texto">Solo autores y editoriales. Queda registrado en el historial y el cliente arranca un nuevo período de 3 meses con el vendedor elegido.</p>
      <form onsubmit="reasignarClienteAdmin(event)">
        <div class="form-grupo">
          <label for="vend-reasignar-email">Mail del cliente</label>
          <input type="email" id="vend-reasignar-email" required placeholder="autor@mail.com" />
        </div>
        <div class="form-grupo">
          <label for="vend-reasignar-vendedor">Vendedor</label>
          <select id="vend-reasignar-vendedor" required>
            <option value="">Elegí un vendedor…</option>
            ${habilitados.map(v => `<option value="${v.id}">${_vendEsc(v.codigo)} — ${_vendEsc(v.nombre || v.email)}</option>`).join('')}
          </select>
        </div>
        <div id="vend-reasignar-error" class="mensaje-error" style="display:none;"></div>
        <button type="submit" class="btn-primario" id="btn-vend-reasignar">Reasignar</button>
      </form>
    </div>

    <h3 class="vend-subtitulo">Historial de asignaciones</h3>
    <input type="search" id="vend-buscador-historial" class="vend-copiar-input" style="width:100%;max-width:420px;margin-bottom:12px;"
      placeholder="Buscar por nombre, mail o alias del cliente, o por código de vendedor…" oninput="buscarHistorialClientesAdmin(this.value)" />
    <div id="vend-historial-listado">${_adminVendHtmlHistorial(lista, clientes, nombreVend, `Últimas ${lista.length} asignaciones`)}</div>
  `;
}


// ── Buscador del historial de asignaciones (pestaña Clientes) ──
let _adminVendHistorialInicial = { lista: [], clientes: {} };
let _adminVendBusquedaToken = 0;
let _adminVendBusquedaTimer = null;

function _adminVendNombreVendedor(id) {
  return id ? _vendEsc(_adminVendMapa[id]?.codigo || String(id).slice(0, 8)) : '—';
}

function _adminVendHtmlHistorial(lista, clientes, nombreVend, titulo) {
  if (!lista.length) {
    return '<div class="estado-vacio"><p class="estado-vacio-texto">No encontramos asignaciones con esa búsqueda.</p></div>';
  }
  return `
    <p class="form-info" style="margin:0 0 8px;">${titulo}</p>
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr><th>Fecha</th><th>Cliente</th><th>De</th><th>A</th><th>Motivo</th></tr></thead>
        <tbody>
          ${lista.map(h => `
            <tr>
              <td>${_vendFecha(h.creado_en)}</td>
              <td>${_adminVendCelda(clientes, h.id_cliente)}</td>
              <td>${nombreVend(h.id_vendedor_anterior)}</td>
              <td>${nombreVend(h.id_vendedor_nuevo)}</td>
              <td>${_vendEsc(h.motivo || '—')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// Con 400 ms de espera para no consultar en cada letra.
function buscarHistorialClientesAdmin(valor) {
  clearTimeout(_adminVendBusquedaTimer);
  _adminVendBusquedaTimer = setTimeout(() => _adminVendEjecutarBusqueda(valor), 400);
}

async function _adminVendEjecutarBusqueda(valor) {
  const cont = document.getElementById('vend-historial-listado');
  if (!cont) return;
  const token = ++_adminVendBusquedaToken;

  // Se sacan los caracteres que rompen el filtro de la base
  const t = String(valor || '').trim().replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim();

  if (t.length < 2) {
    const { lista, clientes } = _adminVendHistorialInicial;
    cont.innerHTML = _adminVendHtmlHistorial(lista, clientes, _adminVendNombreVendedor, `Últimas ${lista.length} asignaciones`);
    return;
  }

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const tl = t.toLowerCase();
  const idsVendedores = (_adminVendLista || [])
    .filter(v => [v.codigo, v.nombre, v.email].some(x => String(x || '').toLowerCase().includes(tl)))
    .map(v => v.id);

  const { data: usuarios } = await supabaseClient
    .from('usuarios')
    .select('id')
    .or(`email.ilike.%${t}%,alias.ilike.%${t}%,nombre.ilike.%${t}%,apellido.ilike.%${t}%`)
    .limit(100);
  if (token !== _adminVendBusquedaToken) return;
  const idsClientes = (usuarios || []).map(u => u.id);

  const filtros = [];
  if (idsClientes.length) filtros.push(`id_cliente.in.(${idsClientes.join(',')})`);
  if (idsVendedores.length) {
    filtros.push(`id_vendedor_anterior.in.(${idsVendedores.join(',')})`);
    filtros.push(`id_vendedor_nuevo.in.(${idsVendedores.join(',')})`);
  }
  if (!filtros.length) {
    cont.innerHTML = _adminVendHtmlHistorial([], {}, _adminVendNombreVendedor, '');
    return;
  }

  const { data: historial, error } = await supabaseClient
    .from('vendedor_clientes_historial')
    .select('id, id_cliente, id_vendedor_anterior, id_vendedor_nuevo, motivo, creado_en')
    .or(filtros.join(','))
    .order('creado_en', { ascending: false })
    .limit(200);
  if (token !== _adminVendBusquedaToken) return;
  if (error) {
    console.error('Error buscando en el historial de asignaciones:', error);
    cont.innerHTML = '<p class="mensaje-error">No se pudo hacer la búsqueda.</p>';
    return;
  }

  const lista = historial || [];
  const clientes = await _adminVendNombresClientes(lista.map(h => h.id_cliente));
  if (token !== _adminVendBusquedaToken) return;
  cont.innerHTML = _adminVendHtmlHistorial(lista, clientes, _adminVendNombreVendedor,
    `${lista.length} resultado${lista.length === 1 ? '' : 's'}${lista.length === 200 ? ' (se muestran los 200 más recientes)' : ''}`);
}

async function reasignarClienteAdmin(e) {
  e.preventDefault();
  const email = document.getElementById('vend-reasignar-email').value.trim();
  const idVendedor = document.getElementById('vend-reasignar-vendedor').value;
  const errEl = document.getElementById('vend-reasignar-error');
  const btn = document.getElementById('btn-vend-reasignar');
  errEl.style.display = 'none';
  if (!idVendedor) return;

  btn.disabled = true;
  const { error } = await supabaseClient.rpc('admin_reasignar_cliente', {
    p_email_cliente: email,
    p_id_vendedor: idVendedor
  });
  btn.disabled = false;

  if (error) {
    errEl.textContent = error.message || 'No se pudo reasignar el cliente.';
    errEl.style.display = 'block';
    return;
  }
  mostrarToast('Cliente reasignado.', 'ok');
  await cargarClientesVendedoresAdmin();
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 5 · LOG DE INTENTOS DE CÓDIGO
// ────────────────────────────────────────────────────────────

async function cargarIntentosCodigoAdmin() {
  const cont = document.getElementById('admin-vendedores-intentos');
  if (!cont) return;
  await _adminVendAsegurarMapa();

  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient
    .from('vendedor_intentos_codigo')
    .select('id, id_cliente, codigo_usado, creado_en')
    .order('creado_en', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Error cargando intentos de código:', error);
    cont.innerHTML = '<p class="mensaje-error">No se pudo cargar el log de intentos.</p>';
    return;
  }

  const lista = data || [];
  const clientes = await _adminVendNombresClientes(lista.map(i => i.id_cliente));
  const porCodigo = {};
  _adminVendLista.forEach(v => { porCodigo[v.codigo] = v; });

  cont.innerHTML = `
    <p class="form-info" style="margin-bottom:16px;">Cada vez que alguien intentó usar un código de vendedor siendo un cliente que ya tiene dueño. No se le cambia el vendedor; solo queda registrado acá.</p>
    ${lista.length ? `
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Código usado</th><th>Vendedor del código</th></tr></thead>
          <tbody>
            ${lista.map(i => {
              const v = porCodigo[i.codigo_usado];
              return `
              <tr>
                <td>${_vendFecha(i.creado_en)}</td>
                <td>${_adminVendCelda(clientes, i.id_cliente)}</td>
                <td><strong>${_vendEsc(i.codigo_usado)}</strong></td>
                <td>${v ? `${_vendEsc(v.nombre || '—')}<br><span class="vend-mini">${_vendEsc(v.email)}</span>` : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '<div class="estado-vacio"><p class="estado-vacio-texto">No hay intentos registrados.</p></div>'}
  `;
}
