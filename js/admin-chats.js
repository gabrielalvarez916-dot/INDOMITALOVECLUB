// ============================================================
// admin-chats.js — Indómita Love Club
// Pantalla de moderación de chats (solo admin).
// Lista todos los chats (con búsqueda y filtro de denunciados), permite leer
// la conversación, ver las denuncias asociadas, eliminar mensajes y bloquear cuentas.
// Cada vez que el admin abre una conversación queda registrado (info_admin).
// Datos: RPC admin_chats_lista / admin_chat_mensajes / admin_chat_eliminar_mensaje / admin_bloquear_usuario.
// ============================================================

const AdminChats = (() => {
  let _soloDenunciados = false;
  let _chatAbierto = null;

  const _esc = (s) => (s === null || s === undefined) ? '' : String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const _fecha = (iso) => iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  async function cargar() {
    document.getElementById('admin-chats-detalle').style.display = 'none';
    document.getElementById('admin-chats-listado').style.display = 'block';
    const lista = document.getElementById('admin-chats-lista');
    lista.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    const busqueda = document.getElementById('admin-chats-busqueda')?.value || '';
    const { data, error } = await supabaseClient.rpc('admin_chats_lista', {
      p_busqueda: busqueda, p_solo_denunciados: _soloDenunciados, p_limite: 50, p_desplazamiento: 0
    });
    if (error || !data) { lista.innerHTML = '<p class="pp-vacio">No se pudieron cargar los chats.</p>'; return; }
    const items = data.items || [];
    if (!items.length) { lista.innerHTML = '<p class="pp-vacio">No hay chats para mostrar.</p>'; return; }
    lista.innerHTML = items.map(c => `
      <div class="chat-fila" onclick="AdminChats.abrir('${_esc(c.idChat)}')">
        <div class="chat-fila-cuerpo">
          <div class="chat-fila-top"><strong>${_esc(c.a.alias)} ↔ ${_esc(c.b.alias)}</strong>
            <span class="chat-fila-hora">${_fecha(c.ultimoEn)}</span></div>
          <div class="chat-fila-texto">${c.abierto ? '' : '🔒 '}${_esc(c.ultimoTexto || '(sin mensajes)')}</div>
          <div class="chat-fila-texto">${_esc(c.a.rol)} / ${_esc(c.b.rol)} · ${c.totalMensajes} mensajes</div>
        </div>
        ${c.denuncias > 0 ? `<span class="chat-badge chat-badge--rojo">🚩 ${c.denuncias}</span>` : ''}
      </div>`).join('');
  }

  function filtrarDenunciados(valor) { _soloDenunciados = !!valor; cargar(); }

  async function abrir(idChat) {
    document.getElementById('admin-chats-listado').style.display = 'none';
    const cont = document.getElementById('admin-chats-detalle');
    cont.style.display = 'block';
    cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    const { data, error } = await supabaseClient.rpc('admin_chat_mensajes', { p_id_chat: idChat });
    if (error || !data || data.error) { cont.innerHTML = '<p class="pp-vacio">No se pudo abrir el chat.</p>'; return; }
    _chatAbierto = data;
    const nombre = (id) => id === data.a.id ? data.a.alias : data.b.alias;
    const persona = (u) => `<div class="admin-chat-persona"><strong>${_esc(u.alias)}</strong> · ${_esc(u.rol)}<br><small>${_esc(u.email)} · cuenta ${_esc(u.estadoCuenta)}</small>
      ${u.estadoCuenta === 'bloqueado' ? '' : `<br><button type="button" class="btn-secundario" onclick="AdminChats.bloquearCuenta('${_esc(u.email)}')">🚫 Bloquear cuenta</button>`}</div>`;
    cont.innerHTML = `
      <button type="button" class="btn-secundario" onclick="AdminChats.cargar()">← Volver a la lista</button>
      <h3 style="margin:12px 0;">${_esc(data.a.alias)} ↔ ${_esc(data.b.alias)} ${data.abierto ? '' : '🔒 (cerrado)'}</h3>
      <div class="admin-chat-personas">${persona(data.a)}${persona(data.b)}</div>
      ${data.denuncias.length ? `<div class="admin-chat-denuncias"><h4>🚩 Denuncias (${data.denuncias.length})</h4>
        ${data.denuncias.map(d => `<div class="admin-chat-denuncia">
          <strong>${_esc(d.categoria)}</strong> · ${_esc(nombre(d.idDenunciante))} · ${_fecha(d.creadoEn)} · ${_esc(d.referenciaTipo === 'chat' ? 'del chat completo' : 'de un mensaje')} · estado: ${_esc(d.estado)}
          ${d.mensaje ? `<br>${_esc(d.mensaje)}` : ''}</div>`).join('')}</div>` : ''}
      <div class="chat-mensajes admin-chat-mensajes">
        ${data.mensajes.length ? data.mensajes.map(m => `
          <div class="chat-msg ${m.idRemitente === data.a.id ? 'chat-msg--otro' : 'chat-msg--mio'}${m.eliminado ? ' chat-msg--eliminado' : ''}${m.denunciado ? ' chat-msg--denunciado' : ''}">
            <div class="chat-msg-meta"><strong>${_esc(nombre(m.idRemitente))}</strong> · ${_fecha(m.creadoEn)}${m.denunciado ? ' · 🚩 denunciado' : ''}</div>
            <div class="chat-msg-texto">${_esc(m.cuerpo)}</div>
            <button type="button" class="chat-msg-denunciar" onclick="AdminChats.eliminarMensaje('${_esc(m.id)}', ${m.eliminado ? 'false' : 'true'})">
              ${m.eliminado ? '↩ Restaurar' : '🗑 Eliminar'}</button>
          </div>`).join('') : '<p class="pp-vacio">Sin mensajes.</p>'}
      </div>`;
  }

  async function eliminarMensaje(idMensaje, eliminar) {
    const { data, error } = await supabaseClient.rpc('admin_chat_eliminar_mensaje', { p_id_mensaje: idMensaje, p_eliminar: eliminar });
    if (error || !data || data.error) { mostrarToast('No se pudo actualizar el mensaje.', 'error'); return; }
    if (_chatAbierto) abrir(_chatAbierto.idChat);
  }

  async function bloquearCuenta(email) {
    const motivo = prompt('Motivo del bloqueo de la cuenta (queda registrado):');
    if (motivo === null) return;
    const { error } = await supabaseClient.rpc('admin_bloquear_usuario', { p_email: email, p_motivo: motivo || null });
    if (error) { mostrarToast(error.message || 'No se pudo bloquear la cuenta.', 'error'); return; }
    mostrarToast('Cuenta bloqueada.', 'ok');
    if (_chatAbierto) abrir(_chatAbierto.idChat);
  }

  return { cargar, abrir, filtrarDenunciados, eliminarMensaje, bloquearCuenta };
})();
