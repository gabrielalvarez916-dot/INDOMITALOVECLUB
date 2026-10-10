// ============================================================
// admin-disenadores.js — Admin > Visuales > Diseñadores
// Diseñadores sin cuenta: se les asignan banners pendientes (feed / reseñadores),
// se marca si entregaron y se calcula cuánto ganan.
// Tarifas: banner feed USD 2 · banner reseñadores USD 1 (se fijan en la base al asignar).
// ============================================================

const DIS_TARIFAS = { banner: 2, banner_cuadrado: 1, informe_editorial: 4 };
const DIS_NOMBRE_TIPO = { banner: 'Banner feed', banner_cuadrado: 'Banner reseñadores', informe_editorial: 'Informe editorial' };
const DIS_PLANES = ['impulso', 'select', 'resistence', 'complete', 'refine'];
const DIS_TZ = 'America/Argentina/Buenos_Aires';
const DIS_PERIODOS = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };

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

  const { data, error } = await supabaseClient.rpc('admin_vis_disenadores_listar');
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
      <div class="form-grupo"><label for="dis-periodo">Cada cuánto se le paga</label>
        <select id="dis-periodo"><option value="">Elegir después</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option></select></div>
      <div class="form-grupo"><label for="dis-paypal">Mail de PayPal (donde se le paga)</label><input type="email" id="dis-paypal" placeholder="paypal@mail.com" /></div>
      <button class="btn-primario" onclick="crearDisenadorAdmin()">Crear diseñador</button>
    </div>

    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:20px 0 10px;">
      <button class="btn-secundario btn-sm" onclick="descargarExcelDisenadores()">⬇ Excel diario y semanal</button>
      <span style="font-size:12px; color:#888;">Entregado: <strong>${_disUsd(totalGanado)}</strong> · Pendiente de entrega: <strong>${_disUsd(totalPorGanar)}</strong></span>
    </div>

    ${_disLista.length === 0
      ? '<div class="estado-vacio"><p class="estado-vacio-texto">Todavía no cargaste diseñadores.</p></div>'
      : `<div class="vend-tabla-scroll"><table class="admin-tabla">
          <thead><tr><th>Diseñador</th><th>Contacto</th><th>Pago</th><th>Pendientes</th><th>Entregados</th><th>Ganó (entregado)</th><th>Por ganar</th><th>Falta pagarle</th><th>Acciones</th></tr></thead>
          <tbody>${_disLista.map(d => `
            <tr${d.id === _disAbierto ? ' style="background:var(--rosa-claro);"' : ''}>
              <td><strong>${_disEsc(d.nombre)}</strong></td>
              <td style="font-size:12px;">${_disEsc(d.telefono || '—')}<br>${_disEsc(d.email || '—')}</td>
              <td style="font-size:12px;">${d.periodo_pago ? `<strong>${DIS_PERIODOS[d.periodo_pago]}</strong>` : '<span style="color:#b00;">Sin período</span>'}<br>${d.email_paypal ? _disEsc(d.email_paypal) : '<span style="color:#b00;">Sin PayPal</span>'}</td>
              <td>${d.pendientes}</td>
              <td>${d.entregados}</td>
              <td><strong>${_disUsd(d.ganado_usd)}</strong></td>
              <td>${_disUsd(d.por_ganar_usd)}</td>
              <td><strong>${_disUsd(Number(d.sin_liquidar_usd || 0) + Number(d.liquidado_sin_pagar_usd || 0))}</strong></td>
              <td style="white-space:nowrap;">
                <button class="btn-primario btn-sm" onclick="abrirDisenadorAdmin('${_disEsc(d.id)}')">Pedidos</button>
                <button class="btn-secundario btn-sm" onclick="editarDisenadorAdmin('${_disEsc(d.id)}')">Editar</button>
                <button class="btn-secundario btn-sm" onclick="archivarDisenadorAdmin('${_disEsc(d.id)}')">Archivar</button>
              </td>
            </tr>`).join('')}</tbody></table></div>`}

    <div id="admin-dis-liquidaciones" style="margin-top:28px;"></div>

    <div id="admin-disenador-detalle" style="margin-top:24px;"></div>
  `;

  await cargarLiquidacionesDisenadoresAdmin();
  if (_disAbierto && _disLista.some(d => d.id === _disAbierto)) await abrirDisenadorAdmin(_disAbierto, false);
}

async function crearDisenadorAdmin() {
  const nombre = document.getElementById('dis-nombre').value.trim();
  const telefono = document.getElementById('dis-telefono').value.trim();
  const email = document.getElementById('dis-email').value.trim();
  const periodo = document.getElementById('dis-periodo').value;
  const paypal = document.getElementById('dis-paypal').value.trim();
  if (!nombre) { mostrarToast('Poné el nombre del diseñador.', 'error'); return; }

  const { data, error } = await supabaseClient.rpc('admin_vis_disenador_crear', { p_nombre: nombre, p_telefono: telefono, p_email: email });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo crear.', 'error'); return; }
  if (periodo || paypal) {
    const r = await supabaseClient.rpc('admin_vis_disenador_pago_config', { p_id: data.id, p_periodo: periodo, p_email_paypal: paypal });
    if (r.error || !r.data || r.data.error) { mostrarToast('Se creó, pero: ' + (r.data?.error || r.error?.message || 'no se pudo guardar el pago.'), 'error'); }
  }
  mostrarToast('Diseñador creado.', 'ok');
  _disAbierto = data.id;
  await cargarDisenadoresAdmin();
}

function editarDisenadorAdmin(id) {
  // Abre el panel del diseñador, que tiene todos los datos (incluido período de pago y PayPal)
  abrirDisenadorAdmin(id);
}

async function archivarDisenadorAdmin(id) {
  const d = _disLista.find(x => x.id === id);
  if (!confirm(`¿Archivar a ${d ? d.nombre : 'este diseñador'}? Deja de aparecer en la lista, pero su historial de entregas se conserva en el Excel.`)) return;
  const { data, error } = await supabaseClient.rpc('admin_vis_disenador_archivar', { p_id: id });
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

  const [rAsig, rTareas, rYaAsig, rExcl] = await Promise.all([
    supabaseClient.rpc('admin_vis_disenador_asignaciones', { p_disenador_id: id }),
    supabaseClient.rpc('admin_vis_tareas_disponibles'),
    supabaseClient.rpc('admin_vis_disenador_tareas_asignadas'),
    supabaseClient.rpc('admin_vis_tareas_excluidas')
  ]);
  const falla = [rAsig, rTareas, rYaAsig, rExcl].find(r => r.error || !r.data || r.data.error);
  if (falla) {
    cont.innerHTML = `<p class="mensaje-error">${_disEsc(falla.data?.error || falla.error?.message || 'Error al cargar.')}</p>`;
    return;
  }

  const asignaciones = rAsig.data.asignaciones || [];
  const yaAsignadas = new Map((rYaAsig.data.tareas || []).map(t => [String(t.tarea_id), t.disenador]));
  const excluidas = new Set((rExcl.data.tareas || []).map(t => String(t.tarea_id)));

  // Pendientes asignables: banners e informes editoriales de Refine NO entregados y que no se repiten (mismo autor + libro + tipo ya hecho/pagado). La revisión de portada la hace la IA: no se asigna a diseñadores.
  // La regla está en la base (admin_vis_tareas_disponibles) y es la misma que usa el sistema de Ingresos.
  const disponibles = (rTareas.data.tareas || []).filter(t =>
    DIS_TARIFAS[t.tipoAccion] !== undefined &&
    !yaAsignadas.has(String(t.id)) &&
    !excluidas.has(String(t.id))
  );

  const ganado = asignaciones.filter(a => a.entregado).reduce((s, a) => s + Number(a.monto_usd), 0);
  const porGanar = asignaciones.filter(a => !a.entregado).reduce((s, a) => s + Number(a.monto_usd), 0);

  cont.innerHTML = `
    <div class="form-separador">${_disEsc(d ? d.nombre : 'Diseñador')}</div>
    <div class="admin-verificacion-manual" style="margin-bottom:16px;">
      <p class="admin-verificacion-manual-titulo">Datos del diseñador</p>
      <div class="form-grupo"><label for="dis-ed-nombre">Nombre</label><input type="text" id="dis-ed-nombre" value="${_disEsc(d?.nombre || '')}" /></div>
      <div class="form-grupo"><label for="dis-ed-telefono">Teléfono</label><input type="tel" id="dis-ed-telefono" value="${_disEsc(d?.telefono || '')}" /></div>
      <div class="form-grupo"><label for="dis-ed-email">Correo</label><input type="email" id="dis-ed-email" value="${_disEsc(d?.email || '')}" /></div>
      <div class="form-grupo"><label for="dis-cfg-periodo">Cada cuánto se le paga</label>
        <select id="dis-cfg-periodo">
          <option value=""${!d?.periodo_pago ? ' selected' : ''}>Sin elegir</option>
          ${Object.entries(DIS_PERIODOS).map(([k, v]) => `<option value="${k}"${d?.periodo_pago === k ? ' selected' : ''}>${v}</option>`).join('')}
        </select></div>
      <div class="form-grupo"><label for="dis-cfg-paypal">Mail de PayPal (donde se le paga)</label><input type="email" id="dis-cfg-paypal" value="${_disEsc(d?.email_paypal || '')}" placeholder="paypal@mail.com" /></div>
      <button class="btn-primario btn-sm" onclick="guardarDatosDisenadorAdmin('${_disEsc(id)}')">Guardar</button>
    </div>
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

    <div class="form-separador" style="margin-top:24px;">Asignar pedidos</div>
    ${disponibles.length === 0 ? '<p class="form-info">No hay pedidos sin asignar (banners de Impulso, Select, Resistence, Complete e informes editoriales de Refine).</p>' : `
    <p class="form-info">Elegí los pedidos (banners e informes editoriales) que le querés pasar a ${_disEsc(d ? d.nombre : 'este diseñador')}.</p>
    <div class="vend-tabla-scroll"><table class="admin-tabla">
      <thead><tr><th></th><th>Fecha</th><th>Plan</th><th>Libro</th><th>Tipo</th><th>Paga</th><th>Estado</th><th></th></tr></thead>
      <tbody>${disponibles.map(t => `
        <tr>
          <td><input type="checkbox" class="dis-check-tarea"
                data-id="${_disEsc(t.id)}" data-tipo="${_disEsc(t.tipoAccion)}" data-plan="${_disEsc(t.plan)}" data-libro="${_disEsc(t.nombreLibro || '')}" /></td>
          <td style="font-size:12px;">${t.fechaCreacion ? String(t.fechaCreacion).split('T')[0] : '—'}</td>
          <td>${_disEsc(t.plan ? t.plan.charAt(0).toUpperCase() + t.plan.slice(1) : '—')}</td>
          <td>${_disEsc(t.nombreLibro || '—')}</td>
          <td>${DIS_NOMBRE_TIPO[t.tipoAccion]}</td>
          <td>${_disUsd(DIS_TARIFAS[t.tipoAccion])}</td>
          <td>${t.estado === 'hecho' ? '<span class="badge badge-aprobada">Hecho</span>' : '<span class="badge badge-pendiente">Pendiente</span>'}</td>
          <td><button class="btn-secundario btn-sm" onclick="excluirTareaDisenadorAdmin('${_disEsc(t.id)}')">Eliminar</button></td>
        </tr>`).join('')}</tbody></table></div>
    <button class="btn-primario" style="margin-top:12px;" onclick="asignarTareasDisenadorAdmin('${_disEsc(id)}')">Asignar seleccionados</button>`}
  `;
  if (scroll) cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function asignarTareasDisenadorAdmin(idDisenador) {
  const tareas = [...document.querySelectorAll('.dis-check-tarea:checked')].map(c => ({
    tarea_id: c.dataset.id, tipo: c.dataset.tipo, plan: c.dataset.plan, nombre_libro: c.dataset.libro
  }));
  if (tareas.length === 0) { mostrarToast('Marcá al menos un pedido.', 'error'); return; }
  const { data, error } = await supabaseClient.rpc('admin_vis_disenador_asignar', { p_disenador_id: idDisenador, p_tareas: tareas });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo asignar.', 'error'); return; }
  mostrarToast(`${data.asignadas} pedido(s) asignado(s).` + (data.repetidas_omitidas ? ` ${data.repetidas_omitidas} omitido(s) por repetirse con un banner ya hecho.` : ''), 'ok');
  await cargarDisenadoresAdmin();
}

async function marcarEntregaDisenadorAdmin(idAsignacion, entregado) {
  const { data, error } = await supabaseClient.rpc('admin_vis_disenador_marcar_entrega', { p_asignacion_id: idAsignacion, p_entregado: entregado });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo actualizar.', 'error'); return; }
  await cargarDisenadoresAdmin();
}

async function desasignarDisenadorAdmin(idAsignacion) {
  if (!confirm('¿Quitar este pedido al diseñador? Vuelve a quedar disponible para asignar.')) return;
  const { data, error } = await supabaseClient.rpc('admin_vis_disenador_desasignar', { p_asignacion_id: idAsignacion });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo quitar.', 'error'); return; }
  await cargarDisenadoresAdmin();
}

async function excluirTareaDisenadorAdmin(idTarea) {
  if (!confirm('¿Sacar este pedido de la lista? No se borra el pedido, solo deja de aparecer para asignar a diseñadores.')) return;
  const { data, error } = await supabaseClient.rpc('admin_vis_tarea_excluir', { p_tarea_id: String(idTarea) });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo sacar.', 'error'); return; }
  await cargarDisenadoresAdmin();
}

// ────────────────────────────────────────────────────────────
// PAGO (período + PayPal) Y LIQUIDACIONES
// ────────────────────────────────────────────────────────────
async function guardarDatosDisenadorAdmin(id) {
  const nombre = document.getElementById('dis-ed-nombre').value.trim();
  const telefono = document.getElementById('dis-ed-telefono').value.trim();
  const email = document.getElementById('dis-ed-email').value.trim();
  const periodo = document.getElementById('dis-cfg-periodo').value;
  const paypal = document.getElementById('dis-cfg-paypal').value.trim();
  if (!nombre) { mostrarToast('El nombre no puede quedar vacío.', 'error'); return; }

  const r1 = await supabaseClient.rpc('admin_vis_disenador_editar', { p_id: id, p_nombre: nombre, p_telefono: telefono, p_email: email });
  if (r1.error || !r1.data || r1.data.error) { mostrarToast(r1.data?.error || r1.error?.message || 'No se pudo guardar.', 'error'); return; }
  const r2 = await supabaseClient.rpc('admin_vis_disenador_pago_config', { p_id: id, p_periodo: periodo, p_email_paypal: paypal });
  if (r2.error || !r2.data || r2.data.error) { mostrarToast(r2.data?.error || r2.error?.message || 'No se pudo guardar el pago.', 'error'); return; }
  mostrarToast('Guardado.', 'ok');
  await cargarDisenadoresAdmin();
}

async function guardarPagoDisenadorAdmin(id) {
  const periodo = document.getElementById('dis-cfg-periodo').value;
  const paypal = document.getElementById('dis-cfg-paypal').value.trim();
  const { data, error } = await supabaseClient.rpc('admin_vis_disenador_pago_config', { p_id: id, p_periodo: periodo, p_email_paypal: paypal });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo guardar.', 'error'); return; }
  mostrarToast('Datos de pago guardados.', 'ok');
  await cargarDisenadoresAdmin();
}

let _disLiqFiltro = 'pendiente';   // 'pendiente' | 'pagada' | ''

function _disRangoPeriodo(desde, hasta) {
  const f = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };
  return `${f(desde)} al ${f(hasta)}`;
}

async function cargarLiquidacionesDisenadoresAdmin() {
  const cont = document.getElementById('admin-dis-liquidaciones');
  if (!cont) return;
  cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const { data, error } = await supabaseClient.rpc('admin_vis_liquidaciones_listar', { p_estado: _disLiqFiltro || null });
  if (error || !data || data.error) {
    cont.innerHTML = `<p class="mensaje-error">${_disEsc(data?.error || error?.message || 'No se pudieron cargar las liquidaciones.')}</p>`;
    return;
  }
  const lista = data.liquidaciones || [];
  const pendienteUsd = lista.filter(l => l.estado !== 'pagada').reduce((s, l) => s + Number(l.total_usd || 0), 0);

  cont.innerHTML = `
    <div class="form-separador">Liquidaciones de diseñadores</div>
    <p class="form-info">Se arman con los banners que ya <strong>entregaron</strong>, cuando termina el período de cada diseñador (semana de lunes a domingo, quincena 1–15 / 16–fin de mes, o mes completo).</p>
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:12px 0 16px;">
      <button class="btn-primario btn-sm" onclick="generarLiquidacionesDisenadoresAdmin()">Generar liquidaciones</button>
      <select id="dis-liq-filtro" onchange="_disLiqFiltro = this.value; cargarLiquidacionesDisenadoresAdmin()" class="form-input" style="max-width:200px;">
        <option value="pendiente"${_disLiqFiltro === 'pendiente' ? ' selected' : ''}>Sin pagar</option>
        <option value="pagada"${_disLiqFiltro === 'pagada' ? ' selected' : ''}>Pagadas</option>
        <option value=""${_disLiqFiltro === '' ? ' selected' : ''}>Todas</option>
      </select>
      <span class="form-info" style="margin:0;">Falta pagar${_disLiqFiltro === 'pagada' ? ' (en esta vista no aplica)' : ''}: <strong>${_disUsd(pendienteUsd)}</strong></span>
    </div>
    ${lista.length === 0 ? '<div class="estado-vacio"><p class="estado-vacio-texto">No hay liquidaciones para mostrar.</p><p class="estado-vacio-sub">Tocá "Generar liquidaciones" cuando termine el período de algún diseñador.</p></div>' : `
    <div class="vend-tabla-scroll"><table class="admin-tabla">
      <thead><tr><th>Período</th><th>Diseñador</th><th>PayPal</th><th>Banners</th><th>Cuánto se le paga</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${lista.map(l => `
        <tr>
          <td style="font-size:12px;">${_disEsc(_disRangoPeriodo(l.desde, l.hasta))}<br><span style="color:#888;">${DIS_PERIODOS[l.periodo_tipo] || _disEsc(l.periodo_tipo)}</span></td>
          <td><strong>${_disEsc(l.disenador)}</strong></td>
          <td style="font-size:12px;">${l.email_paypal
            ? `${_disEsc(l.email_paypal)}<br><button class="btn-secundario btn-sm" style="margin-top:4px;" onclick="copiarPaypalDisenadorAdmin('${_disEsc(l.email_paypal)}')">Copiar mail</button>`
            : '<span style="color:#b00;">Sin PayPal cargado</span>'}</td>
          <td style="font-size:12px;">${l.cantidad_feed} feed · ${l.cantidad_resenadores} reseñadores${Number(l.cantidad_refine) ? ` · ${l.cantidad_refine} Refine` : ''}</td>
          <td><strong>${_disUsd(l.total_usd)}</strong></td>
          <td>${l.estado === 'pagada'
            ? `<span class="badge badge-aprobada">Pagada · ${_disFecha(l.pagada_en)}</span>${l.referencia_paypal ? `<br><span style="font-size:11px; color:#888;">${_disEsc(l.referencia_paypal)}</span>` : ''}`
            : '<span class="badge badge-pendiente">Sin pagar</span>'}</td>
          <td style="white-space:nowrap;">
            ${l.estado === 'pagada'
              ? `<button class="btn-secundario btn-sm" onclick="marcarLiquidacionDisenadorAdmin('${_disEsc(l.id)}', false)">Marcar sin pagar</button>`
              : `<button class="btn-primario btn-sm" onclick="marcarLiquidacionDisenadorAdmin('${_disEsc(l.id)}', true)">Marcar pagada</button>
                 <button class="btn-secundario btn-sm" onclick="eliminarLiquidacionDisenadorAdmin('${_disEsc(l.id)}')">Eliminar</button>`}
          </td>
        </tr>`).join('')}</tbody></table></div>`}
  `;
}

async function generarLiquidacionesDisenadoresAdmin() {
  const { data, error } = await supabaseClient.rpc('admin_vis_liquidaciones_generar');
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudieron generar.', 'error'); return; }
  let msg = data.creadas > 0 ? `Se generaron ${data.creadas} liquidación(es).` : 'No hay nada nuevo para liquidar (los períodos abiertos todavía no se cierran).';
  if (data.disenadores_sin_periodo > 0) msg += ` ${data.disenadores_sin_periodo} diseñador(es) con banners entregados no tienen período de pago elegido.`;
  mostrarToast(msg, data.creadas > 0 ? 'ok' : 'error');
  await cargarDisenadoresAdmin();
}

async function marcarLiquidacionDisenadorAdmin(id, pagada) {
  let referencia = null;
  if (pagada) {
    referencia = prompt('Referencia o ID de la transacción de PayPal (opcional). Aceptar para marcar como pagada:');
    if (referencia === null) return;
  } else if (!confirm('¿Volver esta liquidación a "Sin pagar"?')) return;
  const { data, error } = await supabaseClient.rpc('admin_vis_liquidacion_marcar', { p_id: id, p_pagada: pagada, p_referencia: referencia || null });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo actualizar.', 'error'); return; }
  mostrarToast(pagada ? 'Liquidación marcada como pagada.' : 'Liquidación vuelta a "Sin pagar".', 'ok');
  await cargarDisenadoresAdmin();
}

async function eliminarLiquidacionDisenadorAdmin(id) {
  if (!confirm('¿Eliminar esta liquidación? Los banners quedan otra vez sin liquidar y se juntan en la próxima.')) return;
  const { data, error } = await supabaseClient.rpc('admin_vis_liquidacion_eliminar', { p_id: id });
  if (error || !data || data.error) { mostrarToast(data?.error || error?.message || 'No se pudo eliminar.', 'error'); return; }
  mostrarToast('Liquidación eliminada.', 'ok');
  await cargarDisenadoresAdmin();
}

function copiarPaypalDisenadorAdmin(mail) {
  navigator.clipboard.writeText(mail).then(() => mostrarToast('Mail copiado.', 'ok'), () => mostrarToast('No se pudo copiar.', 'error'));
}

// ────────────────────────────────────────────────────────────
// EXCEL (diario y semanal)
// ────────────────────────────────────────────────────────────
// Librería de Excel con estilos (colores, bordes, formatos). Se guarda aparte para no pisar la que usan otras pantallas.
let _disXlsxEstilos = null;
function _disCargarSheetJS() {
  if (_disXlsxEstilos) return Promise.resolve(_disXlsxEstilos);
  if (_disSheetJsPromesa) return _disSheetJsPromesa;
  _disSheetJsPromesa = new Promise((resolve, reject) => {
    const previo = window.XLSX;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
    s.onload = () => { _disXlsxEstilos = window.XLSX; if (previo) window.XLSX = previo; resolve(_disXlsxEstilos); };
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

// Paleta Indómita
const DIS_XL = { vino: '7B1C2E', vinoOscuro: '4A0F1B', rosa: 'C4919A', rosaClaro: 'F7E9EC', rosaSuave: 'FBF3F4', blanco: 'FFFFFF', borde: 'E3C9CE' };
const DIS_FMT_USD = '"USD "#,##0.00';

// Arma una hoja con título, subtítulo, cabecera, filas con cebra y fila de total.
// opt: { anchos:[], usd:[índices de columnas en dinero], centro:[índices centradas], total:[fila], filtro:bool, celda:(c, valor)=>estilo extra }
function _disHoja(XLSX, titulo, subtitulo, cabecera, filas, opt = {}) {
  const ncol = cabecera.length;
  const aoa = [[titulo], [subtitulo], cabecera, ...filas];
  if (opt.total) aoa.push(opt.total);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const borde = { style: 'thin', color: { rgb: DIS_XL.borde } };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde };
  const usd = opt.usd || [], centro = opt.centro || [], num = opt.num || [];
  const ultimaFila = aoa.length - 1;

  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < ncol; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      const celda = ws[ref];
      const esTotal = opt.total && r === ultimaFila;
      if (r === 0) {
        celda.s = { font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: DIS_XL.blanco } }, fill: { fgColor: { rgb: DIS_XL.vino } }, alignment: { vertical: 'center', horizontal: 'left', indent: 1 } };
      } else if (r === 1) {
        celda.s = { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: DIS_XL.vino } }, fill: { fgColor: { rgb: DIS_XL.rosaClaro } }, alignment: { vertical: 'center', horizontal: 'left', indent: 1 } };
      } else if (r === 2) {
        celda.s = { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: DIS_XL.vinoOscuro } }, fill: { fgColor: { rgb: DIS_XL.rosa } }, border: bordes, alignment: { vertical: 'center', horizontal: centro.includes(c) || usd.includes(c) ? 'center' : 'left', wrapText: true } };
      } else if (esTotal) {
        celda.s = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: DIS_XL.blanco } }, fill: { fgColor: { rgb: DIS_XL.vino } }, border: bordes, alignment: { vertical: 'center', horizontal: centro.includes(c) || usd.includes(c) ? 'center' : 'left' } };
        if (usd.includes(c) && celda.t === 'n') celda.z = DIS_FMT_USD;
      } else {
        const cebra = (r % 2 === 0) ? DIS_XL.rosaSuave : DIS_XL.blanco;
        let est = { font: { name: 'Calibri', sz: 11, color: { rgb: '3A2A2D' } }, fill: { fgColor: { rgb: cebra } }, border: bordes, alignment: { vertical: 'center', horizontal: centro.includes(c) || usd.includes(c) ? 'center' : 'left' } };
        if (usd.includes(c) && celda.t === 'n') { celda.z = DIS_FMT_USD; est.font = { name: 'Calibri', sz: 11, bold: true, color: { rgb: DIS_XL.vino } }; }
        if (num.includes(c) && celda.t === 'n') { celda.z = '#,##0.00'; est.alignment = { vertical: 'center', horizontal: 'right' }; }
        if (opt.celda) { const extra = opt.celda(c, celda.v); if (extra) est = { ...est, ...extra }; }
        celda.s = est;
      }
    }
  }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ncol - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: ncol - 1 } }];
  ws['!cols'] = (opt.anchos || cabecera.map(() => 18)).map(w => ({ wch: w }));
  ws['!rows'] = aoa.map((_, r) => ({ hpx: r === 0 ? 38 : r === 1 ? 22 : r === 2 ? 30 : 24 }));
  if (opt.filtro) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: ultimaFila, c: ncol - 1 } }) };
  return ws;
}

async function descargarExcelDisenadores() {
  try {
    const XLSX = await _disCargarSheetJS();
    const { data, error } = await supabaseClient.rpc('admin_vis_disenadores_entregas');
    if (error || !data || data.error) throw new Error(data?.error || error?.message || 'No se pudieron leer las entregas.');

    const entregas = (data.entregas || []).map(e => ({ ...e, dia: _disFecha(e.entregado_en) }));
    if (entregas.length === 0) { mostrarToast('Todavía no hay entregas marcadas.', 'error'); return; }

    const hoy = _disFecha(new Date().toISOString());
    const sub = `Generado el ${hoy}  ·  Banner feed USD 2  ·  Banner reseñadores USD 1`;
    const wb = XLSX.utils.book_new();
    const cab = (primera) => [primera, 'Diseñador', 'Banners feed', 'Banners reseñadores', 'Total USD'];
    const sum = (arr, k) => arr.reduce((s, f) => s + f[k], 0);

    // Resumen por diseñador (ranking)
    const porDis = new Map();
    entregas.forEach(e => {
      if (!porDis.has(e.disenador)) porDis.set(e.disenador, { disenador: e.disenador, feed: 0, resenadores: 0, total: 0 });
      const f = porDis.get(e.disenador);
      if (e.tipo === 'banner') f.feed++; else f.resenadores++;
      f.total += Number(e.monto_usd);
    });
    const resumen = [...porDis.values()].sort((a, b) => b.total - a.total);
    XLSX.utils.book_append_sheet(wb, _disHoja(XLSX, 'Indómita · Resumen de diseñadores', sub,
      ['Diseñador', 'Banners feed', 'Banners reseñadores', 'Total banners', 'Total USD'],
      resumen.map(f => [f.disenador, f.feed, f.resenadores, f.feed + f.resenadores, f.total]),
      { anchos: [30, 16, 22, 16, 16], centro: [1, 2, 3], usd: [4], total: ['TOTAL', sum(resumen, 'feed'), sum(resumen, 'resenadores'), sum(resumen, 'feed') + sum(resumen, 'resenadores'), sum(resumen, 'total')] }), 'Resumen');

    // Diario
    const diario = _disAgrupar(entregas, e => e.dia);
    XLSX.utils.book_append_sheet(wb, _disHoja(XLSX, 'Indómita · Entregas por día', sub, cab('Día'),
      diario.map(f => [f.clave, f.disenador, f.feed, f.resenadores, f.total]),
      { anchos: [14, 30, 16, 22, 16], centro: [0, 2, 3], usd: [4], total: ['TOTAL', '', sum(diario, 'feed'), sum(diario, 'resenadores'), sum(diario, 'total')] }), 'Diario');

    // Semanal (lunes a domingo)
    const semanal = _disAgrupar(entregas, e => _disLunes(e.dia));
    XLSX.utils.book_append_sheet(wb, _disHoja(XLSX, 'Indómita · Entregas por semana', sub, cab('Semana'),
      semanal.map(f => [`${f.clave} al ${_disDomingo(f.clave)}`, f.disenador, f.feed, f.resenadores, f.total]),
      { anchos: [26, 30, 16, 22, 16], centro: [2, 3], usd: [4], total: ['TOTAL', '', sum(semanal, 'feed'), sum(semanal, 'resenadores'), sum(semanal, 'total')] }), 'Semanal');

    // Detalle (con filtros y tipo de banner con color)
    const colorTipo = (c, v) => c === 2 ? (v === 'Banner feed'
      ? { fill: { fgColor: { rgb: 'F2D3D9' } }, font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: DIS_XL.vino } } }
      : { fill: { fgColor: { rgb: 'E9E1F2' } }, font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '4B3A6B' } } }) : null;
    XLSX.utils.book_append_sheet(wb, _disHoja(XLSX, 'Indómita · Detalle de entregas', sub,
      ['Día', 'Diseñador', 'Tipo', 'Plan', 'Libro', 'USD'],
      entregas.map(e => [e.dia, e.disenador, DIS_NOMBRE_TIPO[e.tipo] || e.tipo, e.plan ? e.plan.charAt(0).toUpperCase() + e.plan.slice(1) : '', e.nombre_libro || '', Number(e.monto_usd)]),
      { anchos: [14, 26, 22, 14, 50, 14], centro: [0, 2, 3], usd: [5], filtro: true, celda: colorTipo, total: ['TOTAL', '', '', '', '', entregas.reduce((s, e) => s + Number(e.monto_usd), 0)] }), 'Detalle');

    XLSX.writeFile(wb, `Indomita-disenadores-${hoy}.xlsx`);
  } catch (e) {
    console.error('Excel diseñadores:', e);
    mostrarToast(e.message || 'No se pudo generar el Excel.', 'error');
  }
}
