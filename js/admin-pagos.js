// ============================================================
// admin-pagos.js — Indómita Love Club
// Panel admin de control de pagos: resumen por mes, detalle de cada
// cobro (suscripciones, campañas pagas, impulsos y reseñadores premium),
// comisiones configurables (para ver lo que queda neto) y descarga de
// un Excel con todo lo que fue entrando día por día.
// Los datos salen de las funciones admin_ingresos / admin_comisiones_*.
// ============================================================

const PAGOS_CATEGORIAS = [
  { id: 'suscripcion', nombre: 'Suscripciones' },
  { id: 'campana', nombre: 'Campañas pagas' },
  { id: 'impulso', nombre: 'Impulsos' },
  { id: 'resenador_premium', nombre: 'Reseñadores Premium' }
];

const PAGOS_PROVEEDORES = {
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
  google_play: 'Google Play',
  manual: 'Manual (admin)'
};

const PAGOS_COSTOS_CATEGORIAS = {
  banner_feed: 'Banners del feed',
  banner_resenador: 'Banners del panel reseñador',
  vendedor: 'Comisiones de vendedores',
  gasto_fijo: 'Gastos fijos mensuales',
  refine: 'Refine (diseñadores)'
};

const PAGOS_COTIZACION_DEFAULT = 1550;

let _pagosFilas = [];
let _pagosComisiones = [];
let _pagosCostos = [];                             // costos en USD (función admin_costos)
let _pagosCostosEliminados = [];                   // costos dados de baja (admin_costos_eliminados)
let _pagosFiltroCostos = { mes: 'todos', categoria: 'todas' };
let _pagosMesResumen = null;                       // 'YYYY-MM' o 'todos'
let _pagosFiltroDetalle = { mes: 'todos', categoria: 'todas' };
let _pagosSheetJsPromesa = null;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function _pagosEsc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function _pagosFmt(n, dec = 2) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function _pagosMonto(n, moneda) {
  return moneda === 'USD' ? 'USD ' + _pagosFmt(n, 2) : '$ ' + _pagosFmt(n, 2);
}

function _pagosMesLindo(mes) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return mes || '';
  const [a, m] = mes.split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[parseInt(m, 10) - 1]} ${a}`;
}

function _pagosFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
}

function _pagosHoyArg() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function _pagosNombreCategoria(id) {
  const c = PAGOS_CATEGORIAS.find(x => x.id === id);
  return c ? c.nombre : id;
}

function _pagosCotizacion() {
  try {
    const v = parseFloat(localStorage.getItem('pagos_cotiz_usd'));
    if (v > 0) return v;
  } catch (e) { /* sin storage: usa el valor por defecto */ }
  return PAGOS_COTIZACION_DEFAULT;
}

function _pagosCambiarCotizacion(valor) {
  const v = parseFloat(String(valor).replace(',', '.'));
  if (!(v > 0)) { mostrarToast('Poné una cotización mayor a 0.', 'error'); renderPagosResumen(); return; }
  try { localStorage.setItem('pagos_cotiz_usd', String(v)); } catch (e) { /* ignorar */ }
  renderPagosResumen();
}

function _pagosMeses() {
  const set = new Set(_pagosFilas.map(f => f.mes));
  _pagosCostos.forEach(k => { if (k.mes) set.add(k.mes); });
  return Array.from(set).sort().reverse();
}

function _pagosCostosDelPeriodo(mes) {
  return _pagosCostos.filter(k => mes === 'todos' || k.mes === mes);
}

function _pagosSumaCostosUsd(lista) {
  return lista.reduce((s, k) => s + (Number(k.monto_usd) || 0), 0);
}

function _pagosNombreCostoCategoria(id) {
  return PAGOS_COSTOS_CATEGORIAS[id] || id;
}

function _pagosAgregar(filas) {
  const r = { n: 0, ARS: { bruto: 0, comision: 0, neto: 0 }, USD: { bruto: 0, comision: 0, neto: 0 } };
  filas.forEach(f => {
    const m = f.moneda === 'USD' ? 'USD' : 'ARS';
    r.n++;
    r[m].bruto += Number(f.bruto) || 0;
    r[m].comision += Number(f.comision) || 0;
    r[m].neto += Number(f.neto) || 0;
  });
  return r;
}

function _pagosEquiv(agg, campo, cot) {
  return agg.ARS[campo] + agg.USD[campo] * cot;
}

// ────────────────────────────────────────────────────────────
// Carga
// ────────────────────────────────────────────────────────────

async function cargarPagosAdmin() {
  const cont = document.getElementById('admin-pagos-resumen');
  if (cont) cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const [resIng, resCom, resCos, resEli] = await Promise.all([
    supabaseClient.rpc('admin_ingresos'),
    supabaseClient.rpc('admin_comisiones_listar'),
    supabaseClient.rpc('admin_costos'),
    supabaseClient.rpc('admin_costos_eliminados')
  ]);

  if (resIng.error || !Array.isArray(resIng.data)) {
    console.error('Error cargando ingresos:', resIng.error);
    if (cont) cont.innerHTML = '<p class="mensaje-error">No se pudieron cargar los pagos.</p>';
    return;
  }
  _pagosFilas = resIng.data;
  _pagosComisiones = Array.isArray(resCom.data) ? resCom.data : [];
  if (resCos.error) console.error('Error cargando costos:', resCos.error);
  _pagosCostos = Array.isArray(resCos.data) ? resCos.data : [];
  if (resEli.error) console.error('Error cargando costos eliminados:', resEli.error);
  _pagosCostosEliminados = Array.isArray(resEli.data) ? resEli.data : [];

  const mesActual = _pagosHoyArg().slice(0, 7);
  const meses = _pagosMeses();
  if (!_pagosMesResumen || (_pagosMesResumen !== 'todos' && !meses.includes(_pagosMesResumen))) {
    _pagosMesResumen = meses.includes(mesActual) ? mesActual : (meses[0] || 'todos');
  }

  renderPagosResumen();
  renderPagosDetalle();
  renderPagosCostos();
  renderPagosComisiones();
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 1 · RESUMEN
// ────────────────────────────────────────────────────────────

function renderPagosResumen() {
  const cont = document.getElementById('admin-pagos-resumen');
  if (!cont) return;

  if (!_pagosFilas.length) {
    cont.innerHTML = '<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no hay cobros registrados.</p></div>';
    return;
  }

  const cot = _pagosCotizacion();
  const meses = _pagosMeses();
  const periodo = _pagosMesResumen === 'todos'
    ? _pagosFilas
    : _pagosFilas.filter(f => f.mes === _pagosMesResumen);
  const aggPeriodo = _pagosAgregar(periodo);
  const tituloPeriodo = _pagosMesResumen === 'todos' ? 'Todos los meses' : _pagosMesLindo(_pagosMesResumen);

  // Costos del período (vienen en USD) y plata real que queda
  const costosPeriodoUsd = _pagosSumaCostosUsd(_pagosCostosDelPeriodo(_pagosMesResumen));
  const costosPeriodoArs = costosPeriodoUsd * cot;
  const gananciaReal = _pagosEquiv(aggPeriodo, 'neto', cot) - costosPeriodoArs;

  // Filas por rubro
  const filasRubro = PAGOS_CATEGORIAS.map(c => {
    const a = _pagosAgregar(periodo.filter(f => f.categoria === c.id));
    return `
      <tr>
        <td>${_pagosEsc(c.nombre)}</td>
        <td class="pagos-num">${a.n}</td>
        <td class="pagos-num">${_pagosMonto(a.ARS.bruto, 'ARS')}</td>
        <td class="pagos-num">${_pagosMonto(a.ARS.neto, 'ARS')}</td>
        <td class="pagos-num">${_pagosMonto(a.USD.bruto, 'USD')}</td>
        <td class="pagos-num">${_pagosMonto(a.USD.neto, 'USD')}</td>
        <td class="pagos-num pagos-neg">${_pagosMonto(_pagosEquiv(a, 'comision', cot), 'ARS')}</td>
        <td class="pagos-num"><strong>${_pagosMonto(_pagosEquiv(a, 'neto', cot), 'ARS')}</strong></td>
      </tr>`;
  }).join('');

  // Filas por medio de cobro
  const medios = Object.keys(PAGOS_PROVEEDORES);
  const filasMedio = medios.map(p => {
    const a = _pagosAgregar(periodo.filter(f => f.proveedor === p));
    if (!a.n) return '';
    return `
      <tr>
        <td>${_pagosEsc(PAGOS_PROVEEDORES[p])}</td>
        <td class="pagos-num">${a.n}</td>
        <td class="pagos-num">${_pagosMonto(a.ARS.bruto, 'ARS')}</td>
        <td class="pagos-num">${_pagosMonto(a.USD.bruto, 'USD')}</td>
        <td class="pagos-num pagos-neg">${_pagosMonto(_pagosEquiv(a, 'comision', cot), 'ARS')}</td>
        <td class="pagos-num"><strong>${_pagosMonto(_pagosEquiv(a, 'neto', cot), 'ARS')}</strong></td>
      </tr>`;
  }).join('');

  // Comparativa mes por mes
  const filasMeses = meses.map(m => {
    const delMes = _pagosFilas.filter(f => f.mes === m);
    const total = _pagosAgregar(delMes);
    const celdas = PAGOS_CATEGORIAS.map(c => {
      const a = _pagosAgregar(delMes.filter(f => f.categoria === c.id));
      return `<td class="pagos-num">${a.n ? _pagosMonto(_pagosEquiv(a, 'neto', cot), 'ARS') : '—'}</td>`;
    }).join('');
    const costosMes = _pagosSumaCostosUsd(_pagosCostosDelPeriodo(m)) * cot;
    const gananciaMes = _pagosEquiv(total, 'neto', cot) - costosMes;
    return `
      <tr>
        <td><strong>${_pagosEsc(_pagosMesLindo(m))}</strong></td>
        <td class="pagos-num">${total.n}</td>
        ${celdas}
        <td class="pagos-num pagos-neg">${_pagosMonto(_pagosEquiv(total, 'comision', cot), 'ARS')}</td>
        <td class="pagos-num">${_pagosMonto(_pagosEquiv(total, 'neto', cot), 'ARS')}</td>
        <td class="pagos-num pagos-neg">${_pagosMonto(costosMes, 'ARS')}</td>
        <td class="pagos-num"><strong>${_pagosMonto(gananciaMes, 'ARS')}</strong></td>
      </tr>`;
  }).join('');

  cont.innerHTML = `
    <div class="pagos-controles">
      <div class="form-grupo">
        <label for="pagos-mes-select">Período</label>
        <select id="pagos-mes-select" class="form-select" onchange="_pagosMesResumen = this.value; renderPagosResumen()">
          <option value="todos" ${_pagosMesResumen === 'todos' ? 'selected' : ''}>Todos los meses</option>
          ${meses.map(m => `<option value="${m}" ${m === _pagosMesResumen ? 'selected' : ''}>${_pagosEsc(_pagosMesLindo(m))}</option>`).join('')}
        </select>
      </div>
      <div class="form-grupo">
        <label for="pagos-cotiz">Cotización del dólar (en pesos)</label>
        <input type="number" id="pagos-cotiz" min="1" step="0.01" value="${cot}" onchange="_pagosCambiarCotizacion(this.value)" />
      </div>
      <button class="btn-primario" id="btn-pagos-excel" onclick="descargarExcelPagos()">⬇ Descargar Excel</button>
    </div>

    <h3 class="vend-subtitulo">${_pagosEsc(tituloPeriodo)}</h3>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="pagos-stat-num">${_pagosMonto(gananciaReal, 'ARS')}</span>
        <span class="stat-label">Ganancia real (neto − costos)</span>
      </div>
      <div class="stat-card">
        <span class="pagos-stat-num pagos-neg">${_pagosMonto(costosPeriodoArs, 'ARS')}</span>
        <span class="stat-label">Costos (USD ${_pagosFmt(costosPeriodoUsd, 2)})</span>
      </div>
      <div class="stat-card">
        <span class="pagos-stat-num">${_pagosMonto(_pagosEquiv(aggPeriodo, 'neto', cot), 'ARS')}</span>
        <span class="stat-label">Neto de cobros (después de comisiones)</span>
      </div>
      <div class="stat-card">
        <span class="pagos-stat-num">${_pagosMonto(_pagosEquiv(aggPeriodo, 'bruto', cot), 'ARS')}</span>
        <span class="stat-label">Cobrado bruto</span>
      </div>
      <div class="stat-card">
        <span class="pagos-stat-num pagos-neg">${_pagosMonto(_pagosEquiv(aggPeriodo, 'comision', cot), 'ARS')}</span>
        <span class="stat-label">Comisiones</span>
      </div>
      <div class="stat-card">
        <span class="pagos-stat-num">${aggPeriodo.n}</span>
        <span class="stat-label">Cobros</span>
      </div>
    </div>

    <h3 class="vend-subtitulo">Por rubro</h3>
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr>
          <th>Rubro</th><th class="pagos-num">Cobros</th>
          <th class="pagos-num">Bruto ARS</th><th class="pagos-num">Neto ARS</th>
          <th class="pagos-num">Bruto USD</th><th class="pagos-num">Neto USD</th>
          <th class="pagos-num">Comisiones (en pesos)</th><th class="pagos-num">Neto (en pesos)</th>
        </tr></thead>
        <tbody>
          ${filasRubro}
          <tr class="pagos-total">
            <td>Total</td>
            <td class="pagos-num">${aggPeriodo.n}</td>
            <td class="pagos-num">${_pagosMonto(aggPeriodo.ARS.bruto, 'ARS')}</td>
            <td class="pagos-num">${_pagosMonto(aggPeriodo.ARS.neto, 'ARS')}</td>
            <td class="pagos-num">${_pagosMonto(aggPeriodo.USD.bruto, 'USD')}</td>
            <td class="pagos-num">${_pagosMonto(aggPeriodo.USD.neto, 'USD')}</td>
            <td class="pagos-num">${_pagosMonto(_pagosEquiv(aggPeriodo, 'comision', cot), 'ARS')}</td>
            <td class="pagos-num">${_pagosMonto(_pagosEquiv(aggPeriodo, 'neto', cot), 'ARS')}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 class="vend-subtitulo">Por medio de cobro</h3>
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr>
          <th>Medio</th><th class="pagos-num">Cobros</th>
          <th class="pagos-num">Bruto ARS</th><th class="pagos-num">Bruto USD</th>
          <th class="pagos-num">Comisiones (en pesos)</th><th class="pagos-num">Neto (en pesos)</th>
        </tr></thead>
        <tbody>${filasMedio || '<tr><td colspan="6">Sin cobros en este período.</td></tr>'}</tbody>
      </table>
    </div>

    <h3 class="vend-subtitulo">Mes por mes (neto en pesos)</h3>
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr>
          <th>Mes</th><th class="pagos-num">Cobros</th>
          ${PAGOS_CATEGORIAS.map(c => `<th class="pagos-num">${_pagosEsc(c.nombre)}</th>`).join('')}
          <th class="pagos-num">Comisiones</th><th class="pagos-num">Neto total</th>
          <th class="pagos-num">Costos</th><th class="pagos-num">Ganancia real</th>
        </tr></thead>
        <tbody>${filasMeses}</tbody>
      </table>
    </div>

    <p class="pagos-nota">
      Los dólares se pasan a pesos con la cotización de arriba, solo para los totales "en pesos". El detalle y el Excel guardan cada moneda por separado.
      Las comisiones son las que cargues en la pestaña Comisiones; mientras no las ajustes con los valores reales de tus cuentas, el neto es una estimación.
      Los costos se cargan en dólares (pestaña Costos) y acá se pasan a pesos con la misma cotización; la ganancia real es el neto menos esos costos.
      La fecha de cada cobro es la hora argentina. Los cobros se anotan solos a medida que se aprueban los pagos.
    </p>
  `;
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 2 · DETALLE DE COBROS
// ────────────────────────────────────────────────────────────

function renderPagosDetalle() {
  const cont = document.getElementById('admin-pagos-detalle');
  if (!cont) return;

  if (!_pagosFilas.length) {
    cont.innerHTML = '<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no hay cobros registrados.</p></div>';
    return;
  }

  const meses = _pagosMeses();
  const { mes, categoria } = _pagosFiltroDetalle;
  const filas = _pagosFilas.filter(f =>
    (mes === 'todos' || f.mes === mes) && (categoria === 'todas' || f.categoria === categoria));
  const agg = _pagosAgregar(filas);

  cont.innerHTML = `
    <div class="pagos-controles">
      <div class="form-grupo">
        <label for="pagos-det-mes">Mes</label>
        <select id="pagos-det-mes" class="form-select" onchange="_pagosFiltroDetalle.mes = this.value; renderPagosDetalle()">
          <option value="todos" ${mes === 'todos' ? 'selected' : ''}>Todos los meses</option>
          ${meses.map(m => `<option value="${m}" ${m === mes ? 'selected' : ''}>${_pagosEsc(_pagosMesLindo(m))}</option>`).join('')}
        </select>
      </div>
      <div class="form-grupo">
        <label for="pagos-det-cat">Rubro</label>
        <select id="pagos-det-cat" class="form-select" onchange="_pagosFiltroDetalle.categoria = this.value; renderPagosDetalle()">
          <option value="todas" ${categoria === 'todas' ? 'selected' : ''}>Todos los rubros</option>
          ${PAGOS_CATEGORIAS.map(c => `<option value="${c.id}" ${c.id === categoria ? 'selected' : ''}>${_pagosEsc(c.nombre)}</option>`).join('')}
        </select>
      </div>
    </div>

    <p class="form-info" style="margin-top:0;">
      ${agg.n} cobros ·
      Bruto ${_pagosMonto(agg.ARS.bruto, 'ARS')} + ${_pagosMonto(agg.USD.bruto, 'USD')} ·
      Neto ${_pagosMonto(agg.ARS.neto, 'ARS')} + ${_pagosMonto(agg.USD.neto, 'USD')}
    </p>

    ${filas.length ? `
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr>
            <th>Fecha</th><th>Rubro</th><th>Detalle</th><th>Usuario</th><th>Medio</th>
            <th class="pagos-num">Bruto</th><th class="pagos-num">Comisión</th><th class="pagos-num">Neto</th>
          </tr></thead>
          <tbody>
            ${filas.map(f => `
              <tr>
                <td>${_pagosEsc(_pagosFechaHora(f.fecha))}</td>
                <td>${_pagosEsc(_pagosNombreCategoria(f.categoria))}</td>
                <td>${_pagosEsc(f.detalle)}</td>
                <td>${_pagosEsc(f.usuario)}<br><span class="vend-mini">${_pagosEsc(f.email || '')}</span></td>
                <td>${_pagosEsc(PAGOS_PROVEEDORES[f.proveedor] || f.proveedor)}</td>
                <td class="pagos-num">${_pagosMonto(f.bruto, f.moneda)}</td>
                <td class="pagos-num pagos-neg">${_pagosMonto(f.comision, f.moneda)}</td>
                <td class="pagos-num"><strong>${_pagosMonto(f.neto, f.moneda)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="estado-vacio"><p class="estado-vacio-texto">No hay cobros con estos filtros.</p></div>'}
  `;
}

// ────────────────────────────────────────────────────────────
// PESTAÑA · COSTOS
// ────────────────────────────────────────────────────────────

function renderPagosCostos() {
  const cont = document.getElementById('admin-pagos-costos');
  if (!cont) return;

  if (!_pagosCostos.length && !_pagosCostosEliminados.length) {
    cont.innerHTML = '<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no hay costos registrados.</p></div>';
    return;
  }

  const cot = _pagosCotizacion();
  const meses = _pagosMeses();
  const { mes, categoria } = _pagosFiltroCostos;
  const filas = _pagosCostos.filter(k =>
    (mes === 'todos' || k.mes === mes) && (categoria === 'todas' || k.categoria === categoria));
  const totalUsd = _pagosSumaCostosUsd(filas);

  // Totales por rubro dentro del mes elegido (sin el filtro de rubro)
  const delMes = _pagosCostos.filter(k => mes === 'todos' || k.mes === mes);
  const idsCat = Object.keys(PAGOS_COSTOS_CATEGORIAS);
  delMes.forEach(k => { if (!idsCat.includes(k.categoria)) idsCat.push(k.categoria); });
  const filasRubro = idsCat.map(id => {
    const lista = delMes.filter(k => k.categoria === id);
    if (!lista.length) return '';
    const usd = _pagosSumaCostosUsd(lista);
    return `
      <tr>
        <td>${_pagosEsc(_pagosNombreCostoCategoria(id))}</td>
        <td class="pagos-num">${lista.length}</td>
        <td class="pagos-num">${_pagosMonto(usd, 'USD')}</td>
        <td class="pagos-num">${_pagosMonto(usd * cot, 'ARS')}</td>
      </tr>`;
  }).join('');
  const totalMesUsd = _pagosSumaCostosUsd(delMes);

  cont.innerHTML = `
    <div class="pagos-controles">
      <div class="form-grupo">
        <label for="pagos-cos-mes">Mes</label>
        <select id="pagos-cos-mes" class="form-select" onchange="_pagosFiltroCostos.mes = this.value; renderPagosCostos()">
          <option value="todos" ${mes === 'todos' ? 'selected' : ''}>Todos los meses</option>
          ${meses.map(m => `<option value="${m}" ${m === mes ? 'selected' : ''}>${_pagosEsc(_pagosMesLindo(m))}</option>`).join('')}
        </select>
      </div>
      <div class="form-grupo">
        <label for="pagos-cos-cat">Rubro</label>
        <select id="pagos-cos-cat" class="form-select" onchange="_pagosFiltroCostos.categoria = this.value; renderPagosCostos()">
          <option value="todas" ${categoria === 'todas' ? 'selected' : ''}>Todos los rubros</option>
          ${idsCat.map(id => `<option value="${_pagosEsc(id)}" ${id === categoria ? 'selected' : ''}>${_pagosEsc(_pagosNombreCostoCategoria(id))}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr><th>Rubro</th><th class="pagos-num">Cantidad</th><th class="pagos-num">USD</th><th class="pagos-num">En pesos</th></tr></thead>
        <tbody>
          ${filasRubro}
          <tr class="pagos-total">
            <td>Total</td>
            <td class="pagos-num">${delMes.length}</td>
            <td class="pagos-num">${_pagosMonto(totalMesUsd, 'USD')}</td>
            <td class="pagos-num">${_pagosMonto(totalMesUsd * cot, 'ARS')}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="form-info">
      ${filas.length} costos con estos filtros · ${_pagosMonto(totalUsd, 'USD')} (${_pagosMonto(totalUsd * cot, 'ARS')} a la cotización del Resumen)
    </p>

    ${filas.length ? `
      <div class="vend-tabla-scroll">
        <table class="admin-tabla">
          <thead><tr><th>Fecha</th><th>Rubro</th><th>Detalle</th><th class="pagos-num">Monto USD</th><th></th></tr></thead>
          <tbody>
            ${filas.map(k => `
              <tr>
                <td>${_pagosEsc(_pagosFechaHora(k.fecha))}</td>
                <td>${_pagosEsc(_pagosNombreCostoCategoria(k.categoria))}</td>
                <td>${_pagosEsc(k.detalle)}</td>
                <td class="pagos-num pagos-neg">${_pagosMonto(k.monto_usd, 'USD')}</td>
                <td>${k.categoria === 'vendedor'
                  ? '<span class="form-info" title="Las comisiones de vendedores se anulan anulando la venta">—</span>'
                  : `<button class="btn-secundario btn-sm" title="Eliminar este costo" onclick="eliminarCostoPagos('${_pagosEsc(k.id)}', '${_pagosEsc(k.categoria)}')">🗑 Eliminar</button>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="estado-vacio"><p class="estado-vacio-texto">No hay costos con estos filtros.</p></div>'}

    ${_pagosCostosEliminados.length ? `
      <details class="pagos-nota" style="margin-top:16px">
        <summary>Costos eliminados (${_pagosCostosEliminados.length}) · no suman en ningún total</summary>
        <div class="vend-tabla-scroll">
          <table class="admin-tabla">
            <thead><tr><th>Fecha</th><th>Rubro</th><th>Detalle</th><th class="pagos-num">Monto USD</th><th></th></tr></thead>
            <tbody>
              ${_pagosCostosEliminados.map(k => `
                <tr>
                  <td>${_pagosEsc(_pagosFechaHora(k.fecha))}</td>
                  <td>${_pagosEsc(_pagosNombreCostoCategoria(k.categoria))}</td>
                  <td>${_pagosEsc(k.detalle)}</td>
                  <td class="pagos-num">${_pagosMonto(k.monto_usd, 'USD')}</td>
                  <td><button class="btn-secundario btn-sm" onclick="restaurarCostoPagos('${_pagosEsc(k.id)}', '${_pagosEsc(k.categoria)}')">↩ Restaurar</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>` : ''}

    <p class="pagos-nota">
      Los banners se cobran una sola vez por obra y tipo (feed o panel reseñador): si ya se diseñó, no se vuelve a contar.
      La fecha es la del impulso que lo originó. Los gastos fijos (Supabase, Resend) se suman solos una vez por mes.
    </p>
  `;
}

async function eliminarCostoPagos(id, categoria) {
  const k = _pagosCostos.find(x => String(x.id) === String(id) && x.categoria === categoria);
  const desc = k ? `${k.detalle} (${_pagosMonto(k.monto_usd, 'USD')})` : 'este costo';
  if (!confirm(`¿Eliminar "${desc}"?\n\nDeja de sumar en el Resumen y en la ganancia real. Si te equivocás, lo podés restaurar desde "Costos eliminados".`)) return;

  const { error } = await supabaseClient.rpc('admin_costo_eliminar', {
    p_id_origen: String(id), p_categoria: categoria, p_motivo: null
  });
  if (error) {
    console.error('Error eliminando costo:', error);
    mostrarToast(error.message || 'No se pudo eliminar el costo.', 'error');
    return;
  }
  mostrarToast('Costo eliminado. Ya no suma en los totales.', 'ok');
  await cargarPagosAdmin();
}

async function restaurarCostoPagos(id, categoria) {
  const { error } = await supabaseClient.rpc('admin_costo_restaurar', {
    p_id_origen: String(id), p_categoria: categoria
  });
  if (error) {
    console.error('Error restaurando costo:', error);
    mostrarToast(error.message || 'No se pudo restaurar el costo.', 'error');
    return;
  }
  mostrarToast('Costo restaurado.', 'ok');
  await cargarPagosAdmin();
}

// ────────────────────────────────────────────────────────────
// PESTAÑA 3 · COMISIONES
// ────────────────────────────────────────────────────────────

function renderPagosComisiones() {
  const cont = document.getElementById('admin-pagos-comisiones');
  if (!cont) return;

  cont.innerHTML = `
    <p class="form-info" style="margin-top:0;">
      Cargá lo que te descuenta cada medio de cobro. El neto de todos los cobros (incluidos los de agosto y septiembre) se recalcula con estos valores.
      El porcentaje se aplica sobre el monto cobrado (si la comisión lleva IVA, sumalo al porcentaje) y el monto fijo se descuenta en la moneda del cobro.
      Los valores que vienen cargados son estimaciones: reemplazalos por los reales de tus cuentas.
    </p>
    <div class="vend-tabla-scroll">
      <table class="admin-tabla">
        <thead><tr><th>Medio</th><th>Porcentaje (%)</th><th>Monto fijo por cobro</th><th>Notas</th><th></th></tr></thead>
        <tbody>
          ${_pagosComisiones.map(c => `
            <tr>
              <td><strong>${_pagosEsc(PAGOS_PROVEEDORES[c.proveedor] || c.proveedor)}</strong></td>
              <td><input type="number" id="pagos-com-pct-${_pagosEsc(c.proveedor)}" min="0" max="100" step="0.01" value="${Number(c.porcentaje)}" style="width:110px;" /></td>
              <td><input type="number" id="pagos-com-fijo-${_pagosEsc(c.proveedor)}" min="0" step="0.01" value="${Number(c.fijo)}" style="width:110px;" /></td>
              <td class="vend-mini">${_pagosEsc(c.notas || '')}</td>
              <td><button class="btn-secundario btn-sm" onclick="guardarComisionPagos('${_pagosEsc(c.proveedor)}')">Guardar</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function guardarComisionPagos(proveedor) {
  const pct = parseFloat(String(document.getElementById(`pagos-com-pct-${proveedor}`)?.value).replace(',', '.'));
  const fijo = parseFloat(String(document.getElementById(`pagos-com-fijo-${proveedor}`)?.value).replace(',', '.'));
  if (isNaN(pct) || isNaN(fijo)) { mostrarToast('Revisá los números.', 'error'); return; }

  const { error } = await supabaseClient.rpc('admin_comisiones_guardar', {
    p_proveedor: proveedor, p_porcentaje: pct, p_fijo: fijo
  });
  if (error) {
    console.error('Error guardando comisión:', error);
    mostrarToast(error.message || 'No se pudo guardar la comisión.', 'error');
    return;
  }
  mostrarToast('Comisión guardada. Se recalculó el neto de todos los cobros.', 'ok');
  await cargarPagosAdmin();
  renderPagosComisiones();
}

// ────────────────────────────────────────────────────────────
// EXCEL
// ────────────────────────────────────────────────────────────

function _pagosCargarSheetJS() {
  if (window.XLSX) return Promise.resolve();
  if (_pagosSheetJsPromesa) return _pagosSheetJsPromesa;
  _pagosSheetJsPromesa = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => { _pagosSheetJsPromesa = null; reject(new Error('No se pudo cargar la librería de Excel.')); };
    document.head.appendChild(s);
  });
  return _pagosSheetJsPromesa;
}

function _pagosDiasEntre(desde, hasta) {
  const [y, m, d] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  const out = [];
  for (let t = Date.UTC(y, m - 1, d), fin = Date.UTC(y2, m2 - 1, d2); t <= fin; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function _pagosFechaExcel(diaStr) {
  const [y, m, d] = diaStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function _pagosFormato(ws, columnas, desdeFila, hastaFila, z) {
  for (let r = desdeFila; r <= hastaFila; r++) {
    columnas.forEach(c => {
      const celda = ws[c + r];
      if (celda) celda.z = z;
    });
  }
}

function _pagosR2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Redondea a 2 decimales todos los números de una tabla antes de pasarla a Excel
function _pagosRedondearAoa(aoa) {
  return aoa.map(fila => fila.map(c => {
    if (typeof c === 'number') return _pagosR2(c);
    if (c && typeof c === 'object' && !(c instanceof Date) && typeof c.v === 'number') return Object.assign({}, c, { v: _pagosR2(c.v) });
    return c;
  }));
}

function _pagosConstruirLibro(XLSX, filas, cot, hoy) {
  const wb = XLSX.utils.book_new();
  const NUM = '#,##0.00';
  const ordenadas = filas.slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const catIds = PAGOS_CATEGORIAS.map(c => c.id);
  const catNombres = PAGOS_CATEGORIAS.map(c => c.nombre);

  // ── Agregados por día y por mes ──
  const porDia = {};   // `${dia}|${moneda}` → acumulado
  const porMes = {};   // `${mes}|${moneda}` → acumulado
  const nuevo = (extra) => Object.assign({ n: 0, cat: { suscripcion: 0, campana: 0, impulso: 0, resenador_premium: 0 }, bruto: 0, comision: 0, neto: 0 }, extra);
  ordenadas.forEach(f => {
    const moneda = f.moneda === 'USD' ? 'USD' : 'ARS';
    const kd = `${f.dia}|${moneda}`;
    const km = `${f.mes}|${moneda}`;
    porDia[kd] = porDia[kd] || nuevo({ dia: f.dia, moneda });
    porMes[km] = porMes[km] || nuevo({ mes: f.mes, moneda });
    [porDia[kd], porMes[km]].forEach(a => {
      a.n++;
      if (a.cat[f.categoria] !== undefined) a.cat[f.categoria] += Number(f.bruto) || 0;
      a.bruto += Number(f.bruto) || 0;
      a.comision += Number(f.comision) || 0;
      a.neto += Number(f.neto) || 0;
    });
  });

  // ── Hoja 1: Diario (ARS y USD lado a lado + total en pesos) ──
  const primerDia = ordenadas.length ? ordenadas[0].dia : hoy;
  const ultimoDia = ordenadas.length && ordenadas[ordenadas.length - 1].dia > hoy ? ordenadas[ordenadas.length - 1].dia : hoy;
  const dias = _pagosDiasEntre(primerDia, ultimoDia);
  const cab1 = ['Fecha', 'Cobros', 'ARS bruto', 'ARS comisión', 'ARS neto', 'USD bruto', 'USD comisión', 'USD neto', 'Neto total en pesos', 'Acumulado en pesos'];
  const aoa1 = [cab1.concat(['', 'Cotización USD (en pesos)'])];
  dias.forEach((dia, i) => {
    const ars = porDia[`${dia}|ARS`] || nuevo({});
    const usd = porDia[`${dia}|USD`] || nuevo({});
    const r = i + 2;
    const totalPesos = ars.neto + usd.neto * cot;
    aoa1.push([
      _pagosFechaExcel(dia), ars.n + usd.n,
      ars.bruto, ars.comision, ars.neto,
      usd.bruto, usd.comision, usd.neto,
      { t: 'n', f: `E${r}+H${r}*$L$2`, v: totalPesos },
      null
    ]);
  });
  // Acumulado (fórmula) con valores cacheados
  let acum = 0;
  for (let i = 0; i < dias.length; i++) {
    const r = i + 2;
    const fila = aoa1[i + 1];
    acum += fila[8].v;
    fila[9] = { t: 'n', f: `SUM(I$2:I${r})`, v: acum };
  }
  const ultimaFila1 = dias.length + 1;
  const tot = (idx) => aoa1.slice(1).reduce((s, f) => s + (typeof f[idx] === 'object' && f[idx] ? f[idx].v : (f[idx] || 0)), 0);
  const filaTotal1 = ['TOTAL'];
  for (let c = 1; c <= 8; c++) {
    const letra = String.fromCharCode(65 + c);
    filaTotal1.push({ t: 'n', f: `SUM(${letra}2:${letra}${ultimaFila1})`, v: tot(c) });
  }
  aoa1.push(filaTotal1);
  aoa1[1] = aoa1[1] || [];
  aoa1[1][11] = cot;
  const ws1 = XLSX.utils.aoa_to_sheet(_pagosRedondearAoa(aoa1), { cellDates: true });
  ws1['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 3 }, { wch: 24 }];
  _pagosFormato(ws1, ['A'], 2, ultimaFila1, 'dd/mm/yyyy');
  _pagosFormato(ws1, ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'], 2, ultimaFila1 + 1, NUM);
  _pagosFormato(ws1, ['L'], 2, 2, NUM);
  XLSX.utils.book_append_sheet(wb, ws1, 'Diario');

  // ── Hoja 2: Diario por rubro (solo días con movimiento) ──
  const aoa2 = [['Fecha', 'Moneda'].concat(catNombres, ['Bruto', 'Comisión', 'Neto', 'Cobros'])];
  Object.values(porDia)
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.moneda.localeCompare(b.moneda))
    .forEach(a => {
      aoa2.push([_pagosFechaExcel(a.dia), a.moneda].concat(catIds.map(id => a.cat[id]), [a.bruto, a.comision, a.neto, a.n]));
    });
  const ws2 = XLSX.utils.aoa_to_sheet(_pagosRedondearAoa(aoa2), { cellDates: true });
  ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
  _pagosFormato(ws2, ['A'], 2, aoa2.length, 'dd/mm/yyyy');
  _pagosFormato(ws2, ['C', 'D', 'E', 'F', 'G', 'H', 'I'], 2, aoa2.length, NUM);
  XLSX.utils.book_append_sheet(wb, ws2, 'Diario por rubro');

  // ── Hoja 3: Mensual ──
  const aoa3 = [['Mes', 'Moneda'].concat(catNombres, ['Bruto', 'Comisión', 'Neto', 'Cobros'])];
  Object.values(porMes)
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.moneda.localeCompare(b.moneda))
    .forEach(a => {
      aoa3.push([_pagosMesLindo(a.mes), a.moneda].concat(catIds.map(id => a.cat[id]), [a.bruto, a.comision, a.neto, a.n]));
    });
  const ws3 = XLSX.utils.aoa_to_sheet(_pagosRedondearAoa(aoa3));
  ws3['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
  _pagosFormato(ws3, ['C', 'D', 'E', 'F', 'G', 'H', 'I'], 2, aoa3.length, NUM);
  XLSX.utils.book_append_sheet(wb, ws3, 'Mensual');

  // ── Hoja 4: Detalle (cada cobro, el más reciente primero) ──
  const aoa4 = [['Fecha y hora', 'Rubro', 'Detalle', 'Usuario', 'Mail', 'Medio', 'Moneda', 'Bruto', 'Comisión', 'Neto', 'Referencia']];
  ordenadas.slice().reverse().forEach(f => {
    aoa4.push([
      _pagosFechaHora(f.fecha), _pagosNombreCategoria(f.categoria), f.detalle, f.usuario, f.email || '',
      PAGOS_PROVEEDORES[f.proveedor] || f.proveedor, f.moneda,
      Number(f.bruto) || 0, Number(f.comision) || 0, Number(f.neto) || 0, f.id
    ]);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(_pagosRedondearAoa(aoa4));
  ws4['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 36 }, { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 38 }];
  _pagosFormato(ws4, ['H', 'I', 'J'], 2, aoa4.length, NUM);
  XLSX.utils.book_append_sheet(wb, ws4, 'Detalle');

  return wb;
}

async function descargarExcelPagos() {
  const btn = document.getElementById('btn-pagos-excel');
  if (!_pagosFilas.length) { mostrarToast('Todavía no hay cobros para descargar.', 'error'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Armando Excel…'; }
  try {
    await _pagosCargarSheetJS();
    const hoy = _pagosHoyArg();
    const wb = _pagosConstruirLibro(window.XLSX, _pagosFilas, _pagosCotizacion(), hoy);
    window.XLSX.writeFile(wb, `Indomita-ingresos-${hoy}.xlsx`, { cellDates: true });
    mostrarToast('Excel descargado.', 'ok');
  } catch (e) {
    console.error('Error armando el Excel:', e);
    mostrarToast(e.message || 'No se pudo armar el Excel.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Descargar Excel'; }
  }
}
