// ============================================================
// admin-pedidos-soporte.js — pestaña "Pedidos de soporte" del panel admin.
// Lista lo que la empleada de soporte pide con "Pedir a Gaby" y permite
// marcarlo Aprobado / Rechazado con una nota. Por ahora aprobar solo
// registra la decisión: el cambio en sí lo hacés vos (o Claude).
// ============================================================

function _apEsc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function cargarPedidosSoporteAdmin() {
  const cont = document.getElementById('admin-pedidos-soporte-lista');
  if (!cont) return;
  cont.innerHTML = '<p>Cargando…</p>';
  const estado = (document.getElementById('admin-pedidos-filtro') || {}).value || 'pendiente';
  const { data, error } = await supabaseClient.rpc('admin_listar_pedidos_soporte', { p_estado: estado === 'todos' ? null : estado });
  if (error || (data && data.error)) {
    cont.innerHTML = '<p>No se pudieron cargar los pedidos.</p>';
    return;
  }
  const ps = (data && data.pedidos) || [];
  cont.innerHTML = `
    <div style="margin-bottom:10px;">
      <select id="admin-pedidos-filtro" onchange="cargarPedidosSoporteAdmin()">
        <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>Pendientes</option>
        <option value="aprobado" ${estado === 'aprobado' ? 'selected' : ''}>Aprobados</option>
        <option value="rechazado" ${estado === 'rechazado' ? 'selected' : ''}>Rechazados</option>
        <option value="todos" ${estado === 'todos' ? 'selected' : ''}>Todos</option>
      </select>
    </div>` + (ps.length ? ps.map(p => `
    <div class="card" style="padding:12px;margin-bottom:8px;">
      <strong>${_apEsc(p.tipo)}</strong> · ${_apEsc(p.estado)} · ${new Date(p.fecha).toLocaleString('es-AR')}<br>
      <span style="font-size:12px;opacity:.7;">Pedido por ${_apEsc(p.quien || '—')} · Ref: ${_apEsc(p.referencia || '—')}</span>
      <div style="white-space:pre-wrap;margin:6px 0;">${_apEsc(p.detalle)}</div>
      ${p.nota ? `<div style="font-size:13px;"><em>Nota:</em> ${_apEsc(p.nota)}</div>` : ''}
      ${p.estado === 'pendiente' ? `
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <input id="ped-nota-${_apEsc(p.id)}" placeholder="Nota para soporte (opcional)" style="flex:1;min-width:180px;">
        <button class="btn-primario btn-sm" onclick="resolverPedidoSoporte('${_apEsc(p.id)}','aprobado')">Aprobar</button>
        <button class="btn-secundario btn-sm" onclick="resolverPedidoSoporte('${_apEsc(p.id)}','rechazado')">Rechazar</button>
      </div>` : ''}
    </div>`).join('') : '<p>No hay pedidos.</p>');
}

async function resolverPedidoSoporte(id, estado) {
  const nota = (document.getElementById('ped-nota-' + id) || {}).value || null;
  const { data, error } = await supabaseClient.rpc('admin_resolver_pedido_soporte', { p_id: id, p_estado: estado, p_nota: nota });
  if (error || (data && data.error)) {
    mostrarToast((data && data.error) || error.message || 'No se pudo guardar.', 'error');
    return;
  }
  mostrarToast('Pedido ' + estado + '.', 'ok');
  cargarPedidosSoporteAdmin();
}
