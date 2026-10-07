// ============================================================
// admin-disenadores.js — Admin > Visuales > Diseñadores
// Diseñadores sin cuenta: se les asignan banners pendientes (feed / reseñadores),
// se marca si entregaron y se calcula cuánto ganan.
// Tarifas: banner feed USD 2 · banner reseñadores USD 1 (se fijan en la base al asignar).
// ============================================================

const DIS_TARIFAS = { banner: 2, banner_cuadrado: 1 };
const DIS_NOMBRE_TIPO = { banner: 'Banner feed', banner_cuadrado: 'Banner reseñadores' };
const DIS_PLANES = ['impulso', 'select', 'resistence', 'complete'];
const DIS_TZ = 'America/Argentina/Buenos_Aires';

let _disLista = [];
let _disAbierto = null;          // id del diseñador abierto
let _disSheetJsPromesa = null;

function _disEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _disUsd(n) { return 'USD ' + Number(n || 0).toFixed(2); }
function _disFecha(ts) { return ts ? new Date(ts).toLocaleDateString('en-CA', { timeZone: DIS_TZ }) : '—'; }

// ────────────────────────────────────────────────────────────
// LISTA + ALTA
// ────────────────────────────────────────────────────────────
async function cargarDisenadoresAdmin() {
  const cont = document.getElementById('admin-disenadores-contenedor');
  if (!cont) return;
  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient.rpc('admin_disenadores_listar');
  if (error || !data || data.error) {
    cont.innerHTML = `<p class="mensaje-error">${_disEsc(data?.error || error?.message || 'No se pudo cargar. ¿Está aplicada la migración de diseñadores?')}</p>`;
    return;
  }
  _disLista = data.disenadores || [];

  const totalGanado = _disLista.reduce((s, d) => s + Number(d.ganado_usd || 0), 0);
  const totalPorGanar = _disLista.reduce((s, d) => s + Number(d.por_ganar_usd || 0), 0);

  cont.innerHTML = `
    <div class="admin-verificacion-manual">
      <p class="admin-verificacion-manual-titulo">Nuevo diseñador</p>
      <p class="admin-verificacion-manual-texto">No necesitan cuenta. Banner feed = USD 2 · Banner reseñadores = USD 1.</p>
      <div class="form-grupo"><label for="dis-nombre">Nombre</label><input type="text" id="dis-nombre" placeholder="Nombre y apellido" /></div>
      <div class="form-grupo"><label for="dis-telefono">Teléfono</label><input type="tel" id="dis-telefono" placeholder="+54 9 ..." /></div>
      <div class="form-grupo"><label for="dis-email">Correo</label><input type="email" id="dis-email" placeholder="diseñadora@mail.com" /></div>
      <button class="btn-primario" onclick="crearDisenadorAdmin()">Crear diseñador</button>
    </div>

    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:20px 0 10px;">
      <button class="btn-secundario btn-sm" onclick="descargarExcelDisenadores()">⬇ Excel diario y semanal</button>
      <span style="font-size:12px; color:#888;">Entregado: <strong>${_disUsd(totalGanado)}</strong> · Pendiente de entrega: <strong>${_disUsd(totalPorGanar)}</strong></span>
    </div>

    ${_disLista.length === 0
      ? '<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no cargaste diseñadores.</p></div>'
      : `<div class="vend-tabla-scroll"><table class="admin-tabla">
          <thead><tr><th>Diseñador</th><th>Contacto</th><th>Pendientes</th><th>Entregados</th><th>Ganó (entregado)</th><th>Por ganar</th><th>Acciones</th></tr></thead>
          <tbody>${_disLista.map(d => `
            <tr${d.id === _disAbierto ? ' style="background:var(--rosa-claro);"' : ''}>
              <td><strong>${_disEsc(d.nombre)}</strong></td>
              <td style="font-size:12px;">${_disEsc(d.telefono || '—')}<br>${_disEsc(d.email || '—')}</td>
              <td>${d.pendientes}</td>
              <td>${d.entregados}</td>
              <td><strong>${_disUsd(d.ganado_usd)}</strong></td>
              <td>${_disUsd(d.por_ganar_usd)}</td>
              <td style="white-space:nowrap;">
                <button class="btn-primario btn-sm" onclick="abrirDisenadorAdmin('${_disEsc(d.id)}')">Pedidos</button>
                <button class="btn-secundario btn-sm" onclick="editarDisenadorAdmin('${_disEsc(d.id)}')">Editar</button>
                <button class="btn-secundario btn-sm" onclick="archivarDisenadorAdmin('${_disEsc(d.id)}')">Archivar</button>
              </td>
            </tr>`).join('')}</tbody></table></div>`}

    <div id="admin-disenador-detalle" style="margin-top:24px;"></div>
  `;

  if (_disAbierto && _disLista.some(d => d.id === _disAbierto)) await abrirDisenadorAdmin(_disAbierto, false);
}

async function crearDisenadorAdmin() {
  const nombre = document.getElementById('dis-nombre').value.trim();
  const telefono = document.getElementById('dis-telefono').value.trim();
  const email = document.getElementById('dis-email').value.trim();
  if (!nombre) { mostrarToast('Poné el nombre del diseñador.', 'error'); return; }

  const { data, error } = await supabaseClient.rpc('admin_disenador_crear', { p_nombre: nombre, p_telefono: telefono, p_email: email });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo crear.', 'error'); return; }
  mostrarToast('Diseñador creado.', 'ok');
  _disAbierto = data.id;
  await cargarDisenadoresAdmin();
}

async function editarDisenadorAdmin(id) {
  const d = _disLista.find(x => x.id === id);
  if (!d) return;
  const nombre = prompt('Nombre:', d.nombre); if (nombre === null) return;
  const telefono = prompt('Teléfono:', d.telefono || ''); if (telefono === null) return;
  const email = prompt('Correo:', d.email || ''); if (email === null) return;
  const { data, error } = await supabaseClient.rpc('admin_disenador_editar', { p_id: id, p_nombre: nombre, p_telefono: telefono, p_email: email });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo guardar.', 'error'); return; }
  mostrarToast('Guardado.', 'ok');
  await cargarDisenadoresAdmin();
}

async function archivarDisenadorAdmin(id) {
  const d = _disLista.find(x => x.id === id);
  if (!confirm(`¿Archivar a ${d ? d.nombre : 'este diseñador'}? Deja de aparecer en la lista, pero su historial de entregas se conserva en el Excel.`)) return;
  const { data, error } = await supabaseClient.rpc('admin_disenador_archivar', { p_id: id });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo archivar.', 'error'); return; }
  if (_disAbierto === id) _disAbierto = null;
  await cargarDisenadoresAdmin();
}

// ────────────────────────────────────────────────────────────
// DETALLE: asignaciones + pedidos pendientes para asignar
// ────────────────────────────────────────────────────────────
async function abrirDisenadorAdmin(id, scroll = true) {
  _disAbierto = id;
  const cont = document.getElementById('admin-disenador-detalle');
  if (!cont) return;
  const d = _disLista.find(x => x.id === id);
  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const [rAsig, rTareas, rYaAsig] = await Promise.all([
    supabaseClient.rpc('admin_disenador_asignaciones', { p_disenador_id: id }),
    supabaseClient.rpc('admin_listar_tareas_impulso'),
    supabaseClient.rpc('admin_disenador_tareas_asignadas')
  ]);
  const falla = [rAsig, rTareas, rYaAsig].find(r => r.error || !r.data || r.data.error);
  if (falla) {
    cont.innerHTML = `<p class="mensaje-error">${_disEsc(falla.data?.error || falla.error?.message || 'Error al cargar.')}</p>`;
    return;
  }

  const asignaciones = rAsig.data.asignaciones || [];
  const yaAsignadas = new Map((rYaAsig.data.tareas || []).map(t => [String(t.tarea_id), t.disenador]));

  // Pendientes asignables: banner feed / reseñadores, plan Impulso-Select-Resistence-Complete, aún sin diseñador
  const disponibles = (rTareas.data.tareas || []).filter(t =>
    t.estado === 'pendiente' &&
    (t.tipoAccion === 'banner' || t.tipoAccion === 'banner_cuadrado') &&
    DIS_PLANES.includes(String(t.plan || '').toLowerCase()) &&
    !yaAsignadas.has(String(t.id))
  );

  const ganado = asignaciones.filter(a => a.entregado).reduce((s, a) => s + Number(a.monto_usd), 0);
  const porGanar = asignaciones.filter(a => !a.entregado).reduce((s, a) => s + Number(a.monto_usd), 0);

  cont.innerHTML = `
    <div class="form-separador">${_disEsc(d ? d.nombre : 'Diseñador')}</div>
    <p class="form-info">Ganó <strong>${_disUsd(ganado)}</strong> en pedidos entregados · <strong>${_disUsd(porGanar)}</strong> en pedidos asignados sin entregar.</p>

    ${asignaciones.length === 0 ? '<p class="form-info">Todavía no tiene pedidos asignados.</p>' : `
    <div class="vend-tabla-scroll"><table class="admin-tabla">
      <thead><tr><th>Asignado</th><th>Plan</th><th>Libro</th><th>Tipo</th><th>Paga</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${asignaciones.map(a => `
        <tr>
          <td style="font-size:12px;">${_disFecha(a.asignado_en)}</td>
          <td>${_disEsc(a.plan ? a.plan.charAt(0).toUpperCase() + a.plan.slice(1) : '—')}</td>
          <td>${_disEsc(a.nombre_libro || '—')}</td>
          <td>${DIS_NOMBRE_TIPO[a.tipo] || _disEsc(a.tipo)}</td>
          <td>${_disUsd(a.monto_usd)}</td>
          <td>${a.entregado ? `<span class="badge badge-aprobada">Entregó · ${_disFecha(a.entregado_en)}</span>` : '<span class="badge badge-pendiente">No entregó</span>'}</td>
          <td style="white-space:nowrap;">
            ${a.entregado
              ? `<button class="btn-secundario btn-sm" onclick="marcarEntregaDisenadorAdmin('${_disEsc(a.id)}', false)">Marcar no entregado</button>`
              : `<button class="btn-primario btn-sm" onclick="marcarEntregaDisenadorAdmin('${_disEsc(a.id)}', true)">Entregó</button>
                 <button class="btn-secundario btn-sm" onclick="desasignarDisenadorAdmin('${_disEsc(a.id)}')">Quitar</button>`}
          </td>
        </tr>`).join('')}</tbody></table></div>`}

    <div class="form-separador" style="margin-top:24px;">Asignar pedidos pendientes</div>
    ${disponibles.length === 0 ? '<p class="form-info">No hay banners pendientes sin asignar (Impulso, Select, Resistence, Complete).</p>' : `
    <p class="form-info">Elegí los banners que le querés pasar a ${_disEsc(d ? d.nombre : 'este diseñador')}.</p>
    <div class="vend-tabla-scroll"><table class="admin-tabla">
      <thead><tr><th></th><th>Fecha</th><th>Plan</th><th>Libro</th><th>Tipo</th><th>Paga</th></tr></thead>
      <tbody>${disponibles.map(t => `
        <tr>
          <td><input type="checkbox" class="dis-check-tarea"
                data-id="${_disEsc(t.id)}" data-tipo="${_disEsc(t.tipoAccion)}" data-plan="${_disEsc(t.plan)}" data-libro="${_disEsc(t.nombreLibro || '')}" /></td>
          <td style="font-size:12px;">${t.fechaCreacion ? String(t.fechaCreacion).split('T')[0] : '—'}</td>
          <td>${_disEsc(t.plan ? t.plan.charAt(0).toUpperCase() + t.plan.slice(1) : '—')}</td>
          <td>${_disEsc(t.nombreLibro || '—')}</td>
          <td>${DIS_NOMBRE_TIPO[t.tipoAccion]}</td>
          <td>${_disUsd(DIS_TARIFAS[t.tipoAccion])}</td>
        </tr>`).join('')}</tbody></table></div>
    <button class="btn-primario" style="margin-top:12px;" onclick="asignarTareasDisenadorAdmin('${_disEsc(id)}')">Asignar seleccionados</button>`}
  `;
  if (scroll) cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function asignarTareasDisenadorAdmin(idDisenador) {
  const tareas = [...document.querySelectorAll('.dis-check-tarea:checked')].map(c => ({
    tarea_id: c.dataset.id, tipo: c.dataset.tipo, plan: c.dataset.plan, nombre_libro: c.dataset.libro
  }));
  if (tareas.length === 0) { mostrarToast('Marcá al menos un banner.', 'error'); return; }
  const { data, error } = await supabaseClient.rpc('admin_disenador_asignar', { p_disenador_id: idDisenador, p_tareas: tareas });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo asignar.', 'error'); return; }
  mostrarToast(`${data.asignadas} pedido(s) asignado(s).`, 'ok');
  await cargarDisenadoresAdmin();
}

async function marcarEntregaDisenadorAdmin(idAsignacion, entregado) {
  const { data, error } = await supabaseClient.rpc('admin_disenador_marcar_entrega', { p_asignacion_id: idAsignacion, p_entregado: entregado });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo actualizar.', 'error'); return; }
  await cargarDisenadoresAdmin();
}

async function desasignarDisenadorAdmin(idAsignacion) {
  if (!confirm('¿Quitar este pedido al diseñador? Vuelve a quedar disponible para asignar.')) return;
  const { data, error } = await supabaseClient.rpc('admin_disenador_desasignar', { p_asignacion_id: idAsignacion });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo quitar.', 'error'); return; }
  await cargarDisenadoresAdmin();
}

// ────────────────────────────────────────────────────────────
// EXCEL (diario y semanal)
// ────────────────────────────────────────────────────────────
function _disCargarSheetJS() {
  if (window.XLSX) return Promise.resolve();
  if (_disSheetJsPromesa) return _disSheetJsPromesa;
  _disSheetJsPromesa = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => { _disSheetJsPromesa = null; reject(new Error('No se pudo cargar la librería de Excel.')); };
    document.head.appendChild(s);
  });
  return _disSheetJsPromesa;
}

// Lunes de la semana de una fecha 'YYYY-MM-DD'
function _disLunes(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00Z');
  const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}
function _disDomingo(lunesISO) {
  const d = new Date(lunesISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function _disAgrupar(entregas, claveFn) {
  const mapa = new Map();
  entregas.forEach(e => {
    const clave = claveFn(e);
    const k = clave + '|' + e.disenador;
    if (!mapa.has(k)) mapa.set(k, { clave, disenador: e.disenador, feed: 0, resenadores: 0, total: 0 });
    const fila = mapa.get(k);
    if (e.tipo === 'banner') fila.feed++; else fila.resenadores++;
    fila.total += Number(e.monto_usd);
  });
  return [...mapa.values()].sort((a, b) => a.clave < b.clave ? 1 : a.clave > b.clave ? -1 : a.disenador.localeCompare(b.disenador));
}

async function descargarExcelDisenadores() {
  try {
    await _disCargarSheetJS();
    const { data, error } = await supabaseClient.rpc('admin_disenadores_entregas');
    if (error || !data || data.error) throw new Error(data?.error || error?.message || 'No se pudieron leer las entregas.');

    const entregas = (data.entregas || []).map(e => ({ ...e, dia: _disFecha(e.entregado_en) }));
    if (entregas.length === 0) { mostrarToast('Todavía no hay entregas marcadas.', 'error'); return; }

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const cab = (primera) => [primera, 'Diseñador', 'Banners feed', 'Banners reseñadores', 'Total USD'];

    // Diario
    const diario = _disAgrupar(entregas, e => e.dia);
    const aoaD = [cab('Día'), ...diario.map(f => [f.clave, f.disenador, f.feed, f.resenadores, f.total])];
    aoaD.push(['TOTAL', '', diario.reduce((s, f) => s + f.feed, 0), diario.reduce((s, f) => s + f.resenadores, 0), diario.reduce((s, f) => s + f.total, 0)]);
    const wsD = XLSX.utils.aoa_to_sheet(aoaD); wsD['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsD, 'Diario');

    // Semanal (lunes a domingo)
    const semanal = _disAgrupar(entregas, e => _disLunes(e.dia));
    const aoaS = [cab('Semana'), ...semanal.map(f => [`${f.clave} al ${_disDomingo(f.clave)}`, f.disenador, f.feed, f.resenadores, f.total])];
    aoaS.push(['TOTAL', '', semanal.reduce((s, f) => s + f.feed, 0), semanal.reduce((s, f) => s + f.resenadores, 0), semanal.reduce((s, f) => s + f.total, 0)]);
    const wsS = XLSX.utils.aoa_to_sheet(aoaS); wsS['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsS, 'Semanal');

    // Total por diseñador
    const porDis = new Map();
    entregas.forEach(e => {
      if (!porDis.has(e.disenador)) porDis.set(e.disenador, { feed: 0, resenadores: 0, total: 0 });
      const f = porDis.get(e.disenador);
      if (e.tipo === 'banner') f.feed++; else f.resenadores++;
      f.total += Number(e.monto_usd);
    });
    const aoaT = [['Diseñador', 'Banners feed', 'Banners reseñadores', 'Total USD'],
      ...[...porDis.entries()].map(([n, f]) => [n, f.feed, f.resenadores, f.total])];
    const wsT = XLSX.utils.aoa_to_sheet(aoaT); wsT['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsT, 'Total por diseñador');

    // Detalle
    const aoaX = [['Día', 'Diseñador', 'Tipo', 'Plan', 'Libro', 'USD'],
      ...entregas.map(e => [e.dia, e.disenador, DIS_NOMBRE_TIPO[e.tipo] || e.tipo, e.plan || '', e.nombre_libro || '', Number(e.monto_usd)])];
    const wsX = XLSX.utils.aoa_to_sheet(aoaX); wsX['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 34 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsX, 'Detalle');

    XLSX.writeFile(wb, `Indomita-disenadores-${_disFecha(new Date().toISOString())}.xlsx`);
  } catch (e) {
    console.error('Excel diseñadores:', e);
    mostrarToast(e.message || 'No se pudo generar el Excel.', 'error');
  }
}
