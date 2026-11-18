// ============================================================
// soporte-panel.js — Indómita Love Club
// Panel del rol "soporte" (empleada de atención).
//
// Solo usa funciones soporte_* de la base y las edge functions
// soporte-responder / soporte-cerrar-ticket. No usa nada de admin_*.
// Lo que no puede hacer lo deriva con "Pedir a Gaby" (soporte_pedidos).
// ============================================================

const _SP = { tickets: [], ticketActual: null, personaEmail: null, respuestas: null };

const _SP_PLATAFORMAS = ['Amazon', 'Goodreads', 'Instagram', 'TikTok', 'StoryGraph', 'YouTube', 'Blog'];
const _SP_TIPOS_PEDIDO = {
  prorroga_comodin: 'Prórroga / comodín para una reseñadora',
  quitar_incumplida: 'Quitar marca de incumplida',
  cancelar_campana: 'Cancelar una campaña',
  regalar_campana: 'Regalar una campaña / crédito',
  baja_cuenta: 'Baja de cuenta',
  pagos_paypal_premium: 'Pago PayPal / Premium',
  impulso_plan_cupon: 'Impulso, plan o cupón',
  corregir_link_resena: 'Corregir link de una reseña',
  otro: 'Otro'
};

function _spEsc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _spFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  return isNaN(d) ? '—' : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
async function _spRpc(nombre, args) {
  const { data, error } = await supabaseClient.rpc(nombre, args || {});
  if (error) { mostrarToast(error.message || 'Error inesperado.', 'error'); return null; }
  if (data && data.error) { mostrarToast(data.error, 'error'); return null; }
  return data;
}
async function _spToken() {
  if (typeof obtenerTokenFresco === 'function') return obtenerTokenFresco();
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session ? session.access_token : null;
}

// ── Estructura ───────────────────────────────────────────────

function cargarPanelSoporte() {
  const cont = document.getElementById('soporte-panel-contenido');
  if (!cont) return;
  cont.innerHTML = `
    <div class="tabs">
      <button class="tab activo" onclick="_spTab(this,'sp-tickets')">Tickets</button>
      <button class="tab" onclick="_spTab(this,'sp-persona')">Ficha de persona</button>
      <button class="tab" onclick="_spTab(this,'sp-campanas')">Campañas</button>
      <button class="tab" onclick="_spTab(this,'sp-respuestas')">Respuestas rápidas</button>
      <button class="tab" onclick="_spTab(this,'sp-pedidos')">Mis pedidos a Gaby</button>
    </div>
    <div id="sp-tickets" class="tab-contenido activo"></div>
    <div id="sp-persona" class="tab-contenido"></div>
    <div id="sp-campanas" class="tab-contenido"></div>
    <div id="sp-respuestas" class="tab-contenido"></div>
    <div id="sp-pedidos" class="tab-contenido"></div>`;
  _spPintarTickets();
  _spPintarPersona();
  _spPintarCampanas();
  _spPintarRespuestas();
}

function _spTab(btn, id) {
  const raiz = document.getElementById('soporte-panel-contenido');
  raiz.querySelectorAll('.tab').forEach(b => b.classList.remove('activo'));
  raiz.querySelectorAll('.tab-contenido').forEach(c => c.classList.remove('activo'));
  btn.classList.add('activo');
  document.getElementById(id).classList.add('activo');
  if (id === 'sp-pedidos') _spCargarPedidos();
  if (id === 'sp-tickets') _spCargarTickets();
}

// ── 1. Tickets ───────────────────────────────────────────────

function _spPintarTickets() {
  document.getElementById('sp-tickets').innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
      <select id="sp-filtro-estado" onchange="_spCargarTickets()">
        <option value="">Todos (pendientes primero)</option>
        <option value="pendiente">Solo pendientes</option>
        <option value="respondido">Solo respondidos</option>
        <option value="cerrado">Solo cerrados</option>
      </select>
      <button class="btn-secundario btn-sm" onclick="_spCargarTickets()">Actualizar</button>
    </div>
    <div id="sp-tickets-lista"></div>
    <div id="sp-ticket-detalle" style="display:none;"></div>`;
  _spCargarTickets();
}

async function _spCargarTickets() {
  const lista = document.getElementById('sp-tickets-lista');
  if (!lista) return;
  document.getElementById('sp-ticket-detalle').style.display = 'none';
  lista.style.display = 'block';
  lista.innerHTML = '<p>Cargando…</p>';
  const estado = document.getElementById('sp-filtro-estado').value;
  const r = await _spRpc('soporte_listar_tickets', { p_estado: estado || null, p_limite: 100 });
  if (!r) { lista.innerHTML = '<p>No se pudo cargar.</p>'; return; }
  _SP.tickets = r.tickets || [];
  if (!_SP.tickets.length) { lista.innerHTML = '<p>No hay tickets en este estado. 🎉</p>'; return; }
  lista.innerHTML = _SP.tickets.map(t => `
    <div class="card" style="padding:12px;margin-bottom:8px;cursor:pointer;" onclick="_spAbrirTicket('${_spEsc(t.idTicket)}')">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <strong>${_spEsc(t.asunto || '(sin asunto)')}</strong>
        <span style="font-size:12px;opacity:.7;">${_spEsc(t.estado)} · ${_spFecha(t.fecha)}</span>
      </div>
      <div style="font-size:13px;opacity:.8;">${_spEsc(t.email)} · ${_spEsc(t.rol || '')}${t.categoria ? ' · ' + _spEsc(t.categoria) : ''}</div>
    </div>`).join('');
}

async function _spAbrirTicket(id) {
  const r = await _spRpc('soporte_ver_ticket', { p_id: id });
  if (!r) return;
  _SP.ticketActual = r;
  document.getElementById('sp-tickets-lista').style.display = 'none';
  const det = document.getElementById('sp-ticket-detalle');
  det.style.display = 'block';
  const msgs = (r.mensajes || []);
  const hilo = (msgs.length ? msgs : [{ autor: 'usuario', cuerpo: r.mensaje, fecha: r.fecha }]).map(m => `
    <div style="margin:8px 0;padding:10px;border-radius:8px;background:${m.autor === 'usuario' ? '#f4f0fa' : '#e9f7ef'};">
      <div style="font-size:12px;opacity:.7;">${m.autor === 'usuario' ? _spEsc(r.email) : 'Soporte'} · ${_spFecha(m.fecha)}${m.adjunto ? ' · 📎 ' + _spEsc(m.adjunto) : ''}</div>
      <div style="white-space:pre-wrap;">${_spEsc(m.cuerpo)}</div>
    </div>`).join('');
  det.innerHTML = `
    <button class="btn-secundario btn-sm" onclick="_spCargarTickets()">← Volver</button>
    <h3 style="margin:12px 0 4px;">${_spEsc(r.asunto || '(sin asunto)')}</h3>
    <div style="font-size:13px;opacity:.8;">${_spEsc(r.alias || '')} · ${_spEsc(r.email)} · ${_spEsc(r.rol || '')} · estado: <strong>${_spEsc(r.estado)}</strong>
      · <a href="#" onclick="_spVerPersona('${_spEsc(r.email)}');return false;">Ver ficha</a></div>
    ${hilo}
    <textarea id="sp-respuesta-texto" rows="6" style="width:100%;margin-top:8px;" placeholder="Escribí la respuesta (se envía por mail desde Soporte Indómita)…"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <button class="btn-primario" id="sp-btn-enviar" onclick="_spEnviarRespuesta()">Enviar respuesta</button>
      <button class="btn-secundario" onclick="_spCerrarTicket()">Cerrar ticket</button>
      <button class="btn-secundario" onclick="_spPedirDesdeTicket()">Pedir a Gaby</button>
    </div>`;
}

async function _spEnviarRespuesta() {
  const t = _SP.ticketActual;
  const area = document.getElementById('sp-respuesta-texto');
  const mensaje = (area.value || '').trim();
  if (!t || !mensaje) { mostrarToast('Escribí la respuesta primero.', 'error'); return; }
  const btn = document.getElementById('sp-btn-enviar');
  btn.disabled = true;
  const token = await _spToken();
  const { data, error } = await supabaseClient.functions.invoke('soporte-responder', {
    body: { id_ticket: t.idTicket, mensaje },
    headers: { Authorization: `Bearer ${token}` }
  });
  btn.disabled = false;
  if (error || data?.error) { mostrarToast(data?.error || error?.message || 'No se pudo enviar.', 'error'); return; }
  mostrarToast('Respuesta enviada.', 'ok');
  _spAbrirTicket(t.idTicket);
}

async function _spCerrarTicket() {
  const t = _SP.ticketActual;
  if (!t) return;
  if (!confirm('¿Cerrar este ticket? Se le avisa a la persona por mail.')) return;
  const token = await _spToken();
  const { data, error } = await supabaseClient.functions.invoke('soporte-cerrar-ticket', {
    body: { id_ticket: t.idTicket },
    headers: { Authorization: `Bearer ${token}` }
  });
  if (error || data?.error) { mostrarToast(data?.error || error?.message || 'No se pudo cerrar.', 'error'); return; }
  mostrarToast('Ticket cerrado.', 'ok');
  _spCargarTickets();
}

// ── 2. Ficha de persona ──────────────────────────────────────

function _spPintarPersona() {
  document.getElementById('sp-persona').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <input id="sp-persona-email" type="email" placeholder="Email completo de la persona" style="flex:1;min-width:220px;" onkeydown="if(event.key==='Enter')_spVerPersona()">
      <button class="btn-primario" onclick="_spVerPersona()">Buscar</button>
    </div>
    <div id="sp-persona-resultado"></div>`;
}

function _spVerPersona(email) {
  const btn = Array.from(document.querySelectorAll('#soporte-panel-contenido .tab')).find(b => b.textContent.trim() === 'Ficha de persona');
  if (btn) _spTab(btn, 'sp-persona');
  if (email) document.getElementById('sp-persona-email').value = email;
  return _spBuscarPersona();
}

async function _spBuscarPersona() {
  const email = (document.getElementById('sp-persona-email').value || '').trim();
  const out = document.getElementById('sp-persona-resultado');
  if (!email) return;
  out.innerHTML = '<p>Buscando…</p>';
  const r = await _spRpc('soporte_buscar_usuario', { p_email: email });
  const u = r && r.usuario;
  if (!u) { out.innerHTML = '<p>No encontré a nadie con ese email.</p>'; return; }
  _SP.personaEmail = u.email;
  let extra = '';
  if (u.rol === 'autor' || u.rol === 'editorial') {
    const c = await _spRpc('soporte_ver_campanas', { p_email_autor: u.email });
    extra = '<h4>Campañas</h4>' + ((c && c.campanas || []).map(x => `
      <div class="card" style="padding:10px;margin-bottom:6px;">
        <strong>${_spEsc(x.libro)}</strong> · ${_spEsc(x.estado)} · ${_spEsc(x.modalidad_lectura)}<br>
        <span style="font-size:12px;">Plataformas: ${_spEsc((x.plataformas || []).join(', '))} · Cupos ${_spEsc(x.cupos_disponibles)}/${_spEsc(x.cupos_total)} · Límite ${_spFecha(x.fecha_limite)}</span>
      </div>`).join('') || '<p>Sin campañas.</p>');
  } else if (u.rol === 'reseñador') {
    const p = await _spRpc('soporte_ver_postulaciones', { p_email_resenador: u.email });
    extra = '<h4>Postulaciones</h4>' + ((p && p.postulaciones || []).map(x => `
      <div class="card" style="padding:10px;margin-bottom:6px;">
        <strong>${_spEsc(x.libro)}</strong> · ${_spEsc(x.estado)}${x.incumplida ? ' · <span style="color:#c0392b;">incumplida</span>' : ''}${x.comodin_usado ? ' · comodín usado' : ''}<br>
        <span style="font-size:12px;">Entrega límite: ${_spFecha(x.fecha_limite_entrega)} · Progreso: ${_spEsc(x.progreso || '—')} · Reseña: ${x.resena_entregada ? _spFecha(x.resena_entregada) : 'no entregada'}</span>
      </div>`).join('') || '<p>Sin postulaciones.</p>');
  }
  out.innerHTML = `
    <div class="card" style="padding:12px;">
      <strong>${_spEsc(u.alias || u.nombre || '')}</strong> (${_spEsc(u.email)})<br>
      Rol: ${_spEsc(u.rol || '—')} · Cuenta: ${_spEsc(u.estado_cuenta)} · Plan: ${_spEsc(u.plan || '—')} (${_spEsc(u.estado_plan || '—')}) · Nivel: ${_spEsc(u.nivel || '—')} · País: ${_spEsc(u.pais || '—')}<br>
      Registro: ${_spFecha(u.fecha_registro)}
    </div>${extra}`;
}

// ── 3. Campañas (solo 3 campos editables) ────────────────────

function _spPintarCampanas() {
  document.getElementById('sp-campanas').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <input id="sp-camp-buscar" placeholder="Email del autor, o nombre del libro/autor" style="flex:1;min-width:220px;" onkeydown="if(event.key==='Enter')_spBuscarCampanas()">
      <button class="btn-primario" onclick="_spBuscarCampanas()">Buscar</button>
    </div>
    <div id="sp-camp-lista"></div>`;
}

async function _spBuscarCampanas() {
  const q = (document.getElementById('sp-camp-buscar').value || '').trim();
  const out = document.getElementById('sp-camp-lista');
  if (!q) return;
  out.innerHTML = '<p>Buscando…</p>';
  const args = q.includes('@') ? { p_email_autor: q } : { p_buscar: q };
  const r = await _spRpc('soporte_ver_campanas', args);
  const cs = (r && r.campanas) || [];
  if (!cs.length) { out.innerHTML = '<p>No encontré campañas.</p>'; return; }
  out.innerHTML = cs.map(c => {
    const editable = c.estado === 'activa';
    const pl = c.plataformas || [];
    return `
    <div class="card" style="padding:12px;margin-bottom:10px;" id="sp-c-${_spEsc(c.id)}">
      <strong>${_spEsc(c.libro)}</strong> — ${_spEsc(c.autor || '')} (${_spEsc(c.email_autor)})<br>
      <span style="font-size:12px;">Estado: ${_spEsc(c.estado)} · Cupos ${_spEsc(c.cupos_disponibles)}/${_spEsc(c.cupos_total)} · Límite ${_spFecha(c.fecha_limite)}</span>
      ${editable ? `
      <div style="margin-top:8px;display:grid;gap:8px;">
        <label>Lectura:
          <select id="sp-mod-${_spEsc(c.id)}">
            <option value="visor" ${c.modalidad_lectura === 'visor' ? 'selected' : ''}>Solo visor</option>
            <option value="descarga" ${c.modalidad_lectura === 'descarga' ? 'selected' : ''}>Con descarga</option>
          </select>
          <button class="btn-secundario btn-sm" onclick="_spGuardarModalidad('${_spEsc(c.id)}')">Guardar</button>
        </label>
        <div>Plataformas (elegí exactamente 2):
          ${_SP_PLATAFORMAS.map(p => `<label style="margin-right:10px;"><input type="checkbox" class="sp-pl-${_spEsc(c.id)}" value="${p}" ${pl.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}
          <button class="btn-secundario btn-sm" onclick="_spGuardarPlataformas('${_spEsc(c.id)}')">Guardar</button>
        </div>
        <label>Link de Amazon:
          <input id="sp-amz-${_spEsc(c.id)}" value="${_spEsc(c.link_amazon || '')}" style="width:60%;" placeholder="https://www.amazon.com/…">
          <button class="btn-secundario btn-sm" onclick="_spGuardarAmazon('${_spEsc(c.id)}')">Guardar</button>
        </label>
      </div>` : '<p style="font-size:12px;opacity:.7;">Solo se editan campañas activas.</p>'}
      <div style="margin-top:8px;"><button class="btn-secundario btn-sm" onclick="_spPedir('${_spEsc(c.id)}','${_spEsc(c.libro).replace(/'/g, '')}')">Pedir a Gaby (prórroga, cancelar, regalar…)</button></div>
    </div>`;
  }).join('');
}

async function _spGuardarModalidad(id) {
  const r = await _spRpc('soporte_cambiar_modalidad', { p_id_campana: id, p_modalidad: document.getElementById('sp-mod-' + id).value, p_motivo: 'Panel soporte' });
  if (r) mostrarToast('Modalidad actualizada.', 'ok');
}
async function _spGuardarPlataformas(id) {
  const sel = Array.from(document.querySelectorAll('.sp-pl-' + id + ':checked')).map(i => i.value);
  if (sel.length !== 2) { mostrarToast('Tienen que ser exactamente 2 plataformas.', 'error'); return; }
  const r = await _spRpc('soporte_cambiar_plataformas', { p_id_campana: id, p_plataformas: sel, p_motivo: 'Panel soporte' });
  if (r) mostrarToast('Plataformas actualizadas.', 'ok');
}
async function _spGuardarAmazon(id) {
  const r = await _spRpc('soporte_cambiar_link_amazon', { p_id_campana: id, p_link: document.getElementById('sp-amz-' + id).value, p_motivo: 'Panel soporte' });
  if (r) mostrarToast('Link actualizado.', 'ok');
}

// ── Pedir a Gaby ─────────────────────────────────────────────

function _spPedir(referencia, etiqueta) {
  const opciones = Object.entries(_SP_TIPOS_PEDIDO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  const cont = document.createElement('div');
  cont.id = 'sp-modal-pedido';
  cont.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  cont.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:20px;max-width:480px;width:100%;">
      <h3 style="margin-top:0;">Pedir a Gaby</h3>
      <p style="font-size:13px;opacity:.8;">Referencia: ${_spEsc(etiqueta || referencia || '—')}</p>
      <select id="sp-pedido-tipo" style="width:100%;margin-bottom:8px;">${opciones}</select>
      <textarea id="sp-pedido-detalle" rows="5" style="width:100%;" placeholder="Explicá qué hay que hacer y por qué (email de la persona, qué te dijo, etc.)"></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;">
        <button class="btn-secundario" onclick="document.getElementById('sp-modal-pedido').remove()">Cancelar</button>
        <button class="btn-primario" onclick="_spEnviarPedido('${_spEsc(referencia || '')}')">Enviar pedido</button>
      </div>
    </div>`;
  document.body.appendChild(cont);
}

function _spPedirDesdeTicket() {
  const t = _SP.ticketActual;
  if (t) _spPedir(t.email, t.email + ' — ' + (t.asunto || ''));
}

async function _spEnviarPedido(referencia) {
  const tipo = document.getElementById('sp-pedido-tipo').value;
  const detalle = (document.getElementById('sp-pedido-detalle').value || '').trim();
  if (!detalle) { mostrarToast('Contá qué hay que hacer.', 'error'); return; }
  const r = await _spRpc('soporte_crear_pedido', { p_tipo: tipo, p_referencia: referencia, p_detalle: detalle });
  if (r) {
    mostrarToast('Pedido enviado a Gaby.', 'ok');
    document.getElementById('sp-modal-pedido').remove();
  }
}

async function _spCargarPedidos() {
  const out = document.getElementById('sp-pedidos');
  out.innerHTML = '<p>Cargando…</p>';
  const r = await _spRpc('soporte_listar_pedidos');
  const ps = (r && r.pedidos) || [];
  out.innerHTML = ps.length ? ps.map(p => `
    <div class="card" style="padding:10px;margin-bottom:6px;">
      <strong>${_spEsc(_SP_TIPOS_PEDIDO[p.tipo] || p.tipo)}</strong> · ${_spEsc(p.estado)} · ${_spFecha(p.fecha)}<br>
      <span style="font-size:13px;">${_spEsc(p.detalle)}</span>
      ${p.nota ? `<div style="font-size:13px;margin-top:4px;"><em>Respuesta de Gaby:</em> ${_spEsc(p.nota)}</div>` : ''}
    </div>`).join('') : '<p>Todavía no hiciste pedidos.</p>';
}

// ── 4. Respuestas rápidas (las del chatbot) ──────────────────

function _spPintarRespuestas() {
  document.getElementById('sp-respuestas').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <select id="sp-resp-rol" onchange="_spCargarRespuestas()">
        <option value="resenador">Reseñadores</option>
        <option value="autor">Autores / editoriales</option>
      </select>
      <input id="sp-resp-buscar" placeholder="Buscar…" oninput="_spFiltrarRespuestas()" style="flex:1;min-width:160px;">
    </div>
    <div id="sp-resp-lista"></div>`;
  _spCargarRespuestas();
}

async function _spCargarRespuestas() {
  const rol = document.getElementById('sp-resp-rol').value;
  const { data, error } = await supabaseClient.from('bot_nodos').select('id, titulo, contenido').eq('rol', rol).order('orden');
  _SP.respuestas = error ? [] : (data || []).filter(n => n.contenido && n.contenido.trim());
  _spFiltrarRespuestas();
}

function _spFiltrarRespuestas() {
  const q = (document.getElementById('sp-resp-buscar').value || '').toLowerCase();
  const lista = (_SP.respuestas || []).filter(n => !q || (n.titulo + ' ' + n.contenido).toLowerCase().includes(q));
  document.getElementById('sp-resp-lista').innerHTML = lista.length ? lista.map((n, i) => `
    <details class="card" style="padding:10px;margin-bottom:6px;">
      <summary><strong>${_spEsc(n.titulo)}</strong></summary>
      <div style="white-space:pre-wrap;margin:8px 0;">${_spEsc(n.contenido)}</div>
      <button class="btn-secundario btn-sm" onclick="_spCopiarRespuesta('${_spEsc(n.id)}')">Copiar</button>
    </details>`).join('') : '<p>No hay respuestas para mostrar.</p>';
}

function _spCopiarRespuesta(id) {
  const n = (_SP.respuestas || []).find(x => String(x.id) === String(id));
  if (!n) return;
  navigator.clipboard.writeText(n.contenido).then(() => mostrarToast('Copiada.', 'ok'));
}
