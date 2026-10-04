// ============================================================
// chat.js — Indómita Love Club
// Mensajes (chat 1 a 1). Reglas (las cuida el servidor):
//  - autor/editorial ↔ reseñador: solo si hay una postulación aprobada entre ellos.
//  - reseñador ↔ reseñador: solo con flechazo mutuo.
//  - Si se bloquean o se rompe la condición, el chat se cierra (queda en solo lectura).
// Incluye: bandeja, conversación, bloquear/desbloquear, denunciar chat o mensaje,
// y los botones "Mensaje / Bloquear" del perfil público.
// Datos: RPC chat_* / bloquear_usuario / desbloquear_usuario / mis_bloqueados.
// Los mensajes se actualizan por consulta periódica (cada pocos segundos con el chat abierto).
// ============================================================

const Chat = (() => {
  const FOTO_DEFAULT = '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK';
  let _chatActual = null;     // { idChat, otro, abierto }
  let _ultimaFecha = null;    // ISO del último mensaje pintado
  let _pollConv = null;
  let _pollBadge = null;
  let _enviando = false;

  const _esc = (s) => (s === null || s === undefined) ? '' : String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const _foto = (u) => !u ? FOTO_DEFAULT : (u.startsWith('/') ? 'https://indomitaloveclub.vercel.app' + u : u);
  const _rolTxt = (r) => ({ autor: 'Autor@', editorial: 'Editorial', 'reseñador': 'Reseñador@' }[r] || r || '');

  function puede() {
    const rol = (typeof Sesion !== 'undefined' && Sesion.rol) ? Sesion.rol() : null;
    return rol === 'autor' || rol === 'editorial' || rol === 'reseñador';
  }

  function _hora(iso) {
    const d = new Date(iso);
    const hoy = new Date();
    const hm = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString()) return hm;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + hm;
  }

  // ── Badge de no leídos en el menú ─────────────────────────
  async function actualizarBadge() {
    const nav = document.getElementById('nav-mensajes');
    if (!nav) return;
    if (!puede()) { nav.style.display = 'none'; return; }
    nav.style.display = 'inline-block';
    try {
      const { data } = await supabaseClient.rpc('chat_no_leidos');
      const n = parseInt(data, 10) || 0;
      const b = document.getElementById('nav-mensajes-badge');
      if (b) { b.textContent = n > 99 ? '99+' : n; b.style.display = n > 0 ? 'inline-block' : 'none'; }
    } catch (e) { /* silencioso */ }
  }

  function iniciar() {
    detener();
    if (!puede()) return;
    actualizarBadge();
    _pollBadge = setInterval(actualizarBadge, 30000);
  }

  function detener() {
    if (_pollBadge) { clearInterval(_pollBadge); _pollBadge = null; }
    _detenerConv();
    const nav = document.getElementById('nav-mensajes');
    if (nav) nav.style.display = 'none';
  }

  function _detenerConv() {
    if (_pollConv) { clearInterval(_pollConv); _pollConv = null; }
  }

  // ── Bandeja ───────────────────────────────────────────────
  async function cargarBandeja() {
    _detenerConv();
    _chatActual = null;
    document.getElementById('chat-vista-conversacion').style.display = 'none';
    document.getElementById('chat-vista-bandeja').style.display = 'block';
    const lista = document.getElementById('chat-bandeja-lista');
    lista.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    try {
      const { data, error } = await supabaseClient.rpc('chat_mis_chats');
      if (error || !data || data.error) { lista.innerHTML = '<p class="pp-vacio">No se pudieron cargar tus mensajes.</p>'; return; }
      const items = data.items || [];
      if (!items.length) {
        lista.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-icono">💬</p>
          <p class="estado-vacio-texto">Todavía no tenés conversaciones. Podés escribirle desde su perfil a quienes tengas una campaña en común, o a reseñadoras con las que se flechen mutuamente.</p></div>`;
        return;
      }
      lista.innerHTML = items.map(c => `
        <div class="chat-fila" onclick="Chat.abrirConversacion('${_esc(c.idChat)}')">
          <img class="flechazo-foto" src="${_esc(_foto(c.otro.fotoPerfil))}" alt="" onerror="this.src='${FOTO_DEFAULT}'" />
          <div class="chat-fila-cuerpo">
            <div class="chat-fila-top"><strong>${_esc(c.otro.alias || 'Lector@')}</strong>
              <span class="chat-fila-hora">${c.ultimoEn ? _hora(c.ultimoEn) : ''}</span></div>
            <div class="chat-fila-texto${c.noLeidos > 0 ? ' chat-fila-texto--nuevo' : ''}">
              ${c.abierto ? '' : '🔒 '}${_esc(c.ultimoTexto || 'Chat nuevo, escribile algo 👋')}</div>
          </div>
          ${c.noLeidos > 0 ? `<span class="chat-badge">${c.noLeidos}</span>` : ''}
        </div>`).join('');
    } catch (e) {
      console.error('Chat: error bandeja', e);
      lista.innerHTML = '<p class="pp-vacio">No se pudieron cargar tus mensajes.</p>';
    }
  }

  // ── Conversación ──────────────────────────────────────────
  function _burbuja(m) {
    return `<div class="chat-msg ${m.mio ? 'chat-msg--mio' : 'chat-msg--otro'}${m.eliminado ? ' chat-msg--eliminado' : ''}" data-id="${_esc(m.id)}">
      <div class="chat-msg-texto">${_esc(m.cuerpo)}</div>
      <div class="chat-msg-meta">${_hora(m.creadoEn)}${m.mio && m.leidoEn ? ' · ✓ Visto' : ''}
        ${!m.mio && !m.eliminado ? `<button type="button" class="chat-msg-denunciar" title="Denunciar este mensaje" onclick="Chat.denunciarMensaje('${_esc(m.id)}')">🚩</button>` : ''}</div>
    </div>`;
  }

  function _pintarCabecera() {
    const o = _chatActual.otro;
    document.getElementById('chat-conv-cabecera').innerHTML = `
      <button type="button" class="btn-secundario chat-volver" onclick="Chat.cargarBandeja()">←</button>
      <img class="flechazo-foto" src="${_esc(_foto(o.fotoPerfil))}" alt="" onerror="this.src='${FOTO_DEFAULT}'" />
      <div class="chat-conv-quien" onclick="abrirPerfilPublico('${_esc(o.id)}', '${_esc(o.rol)}')">
        <strong>${_esc(o.alias || 'Lector@')}</strong><span>${_esc(_rolTxt(o.rol))}</span></div>
      <div class="chat-conv-menu">
        <button type="button" class="btn-secundario" onclick="Chat.denunciarChat()">🚩 Denunciar</button>
        <button type="button" class="btn-secundario" onclick="Chat.bloquear('${_esc(o.id)}')">🚫 Bloquear</button>
      </div>`;
  }

  function _pintarPie() {
    const pie = document.getElementById('chat-conv-pie');
    if (_chatActual.abierto) {
      pie.innerHTML = `<textarea id="chat-input" maxlength="1000" rows="1" placeholder="Escribí un mensaje…"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();Chat.enviar();}"></textarea>
        <button type="button" class="btn-primario" onclick="Chat.enviar()">Enviar</button>`;
    } else {
      pie.innerHTML = '<p class="chat-cerrado">🔒 Este chat está cerrado: ya no se cumplen las condiciones para chatear. Podés seguir leyendo la conversación.</p>';
    }
  }

  async function abrirConversacion(idChat) {
    document.getElementById('chat-vista-bandeja').style.display = 'none';
    document.getElementById('chat-vista-conversacion').style.display = 'block';
    const caja = document.getElementById('chat-mensajes');
    caja.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    _ultimaFecha = null;
    _chatActual = { idChat, otro: {}, abierto: false };
    const r = await _traer(false);
    if (!r) { caja.innerHTML = '<p class="pp-vacio">No se pudo abrir este chat.</p>'; return; }
    _pintarCabecera();
    _pintarPie();
    _detenerConv();
    _pollConv = setInterval(() => _traer(true), 5000);
    actualizarBadge();
  }

  // Trae mensajes (todos o solo los nuevos) y los pinta
  async function _traer(soloNuevos) {
    if (!_chatActual) return null;
    const idChat = _chatActual.idChat;
    try {
      const { data, error } = await supabaseClient.rpc('chat_mensajes', {
        p_id_chat: idChat, p_desde: soloNuevos ? _ultimaFecha : null, p_limite: 100
      });
      if (!_chatActual || _chatActual.idChat !== idChat) return null;
      if (error || !data || data.error) {
        if (!soloNuevos) {
          const caja = document.getElementById('chat-mensajes');
          if (caja) caja.innerHTML = `<p class="pp-vacio">${_esc((data && data.error) || 'No se pudo abrir este chat.')}</p>`;
        }
        return null;
      }
      const cambioAbierto = _chatActual.abierto !== !!data.abierto;
      _chatActual.otro = data.otro; _chatActual.abierto = !!data.abierto;
      const caja = document.getElementById('chat-mensajes');
      const msgs = data.mensajes || [];
      const abajo = !soloNuevos || (caja.scrollHeight - caja.scrollTop - caja.clientHeight < 80);
      if (!soloNuevos) {
        caja.innerHTML = msgs.length ? msgs.map(_burbuja).join('') : '<p class="pp-vacio">Todavía no hay mensajes. ¡Escribí el primero!</p>';
      } else if (msgs.length) {
        const vacio = caja.querySelector('.pp-vacio'); if (vacio) vacio.remove();
        caja.insertAdjacentHTML('beforeend', msgs.map(_burbuja).join(''));
      }
      if (msgs.length) _ultimaFecha = msgs[msgs.length - 1].creadoEn;
      if (cambioAbierto && soloNuevos) _pintarPie();
      if (abajo) caja.scrollTop = caja.scrollHeight;
      return data;
    } catch (e) {
      console.error('Chat: error trayendo mensajes', e);
      return null;
    }
  }

  async function enviar() {
    if (_enviando || !_chatActual) return;
    const input = document.getElementById('chat-input');
    const texto = (input?.value || '').trim();
    if (!texto) return;
    _enviando = true;
    try {
      const { data, error } = await supabaseClient.rpc('chat_enviar', { p_id_chat: _chatActual.idChat, p_texto: texto });
      if (error || !data || data.error) {
        mostrarToast((data && data.error) || 'No se pudo enviar el mensaje.', 'error');
        if (data && data.cerrado) { _chatActual.abierto = false; _pintarPie(); }
        return;
      }
      input.value = '';
      await _traer(true);
    } finally {
      _enviando = false;
    }
  }

  // ── Abrir chat desde un perfil ────────────────────────────
  async function escribirA(idUsuario) {
    const { data, error } = await supabaseClient.rpc('chat_abrir', { p_con: idUsuario });
    if (error || !data || data.error) { mostrarToast((data && data.error) || 'No se pudo abrir el chat.', 'error'); return; }
    cerrarModales();
    mostrarSeccion('mensajes');
    abrirConversacion(data.idChat);
  }

  // ── Bloqueo ───────────────────────────────────────────────
  async function bloquear(idUsuario, alias) {
    if (!confirm('¿Bloquear a esta persona? Se cierra el chat, se quitan los flechazos entre ustedes y no va a poder escribirte ni flecharte. Podés desbloquearla cuando quieras.')) return;
    const { data, error } = await supabaseClient.rpc('bloquear_usuario', { p_id: idUsuario });
    if (error || !data || data.error) { mostrarToast((data && data.error) || 'No se pudo bloquear.', 'error'); return; }
    mostrarToast('Bloqueaste a esta persona.', 'ok');
    cerrarModales();
    if (document.getElementById('seccion-mensajes')?.style.display !== 'none') cargarBandeja();
    actualizarBadge();
  }

  async function desbloquear(idUsuario) {
    const { data, error } = await supabaseClient.rpc('desbloquear_usuario', { p_id: idUsuario });
    if (error || !data || data.error) { mostrarToast((data && data.error) || 'No se pudo desbloquear.', 'error'); return; }
    mostrarToast('Desbloqueada. Para chatear de nuevo tienen que volver a cumplir las condiciones.', 'ok');
    verBloqueados();
  }

  async function verBloqueados() {
    const lista = document.getElementById('bloqueados-lista');
    if (!lista) return;
    lista.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    mostrarModal('modal-bloqueados');
    const { data } = await supabaseClient.rpc('mis_bloqueados');
    const items = (data && data.items) || [];
    lista.innerHTML = items.length ? items.map(u => `
      <div class="flechazo-item">
        <div class="flechazo-item-izq">
          <img class="flechazo-foto" src="${_esc(_foto(u.fotoPerfil))}" alt="" onerror="this.src='${FOTO_DEFAULT}'" />
          <div class="flechazo-info"><span class="flechazo-alias">${_esc(u.alias || 'Lector@')}</span>
            <span class="flechazo-rol">${_esc(_rolTxt(u.rol))}</span></div>
        </div>
        <button type="button" class="btn-secundario" onclick="Chat.desbloquear('${_esc(u.id)}')">Desbloquear</button>
      </div>`).join('') : '<p class="pp-vacio">No bloqueaste a nadie.</p>';
  }

  // ── Denuncias ─────────────────────────────────────────────
  function denunciarChat() { if (_chatActual) abrirModalDenuncia('chat', _chatActual.idChat); }
  function denunciarMensaje(idMensaje) { abrirModalDenuncia('chat_mensaje', idMensaje); }

  // ── Botones en el perfil público ──────────────────────────
  async function pintarAccionesPerfilPublico(idUsuario) {
    document.querySelectorAll('#modal-perfil-publico .pp-chat-acciones').forEach(b => b.remove());
    if (!idUsuario || !puede() || idUsuario === ((Sesion.obtener() || {}).id)) return;
    try {
      const { data, error } = await supabaseClient.rpc('chat_estado_con', { p_con: idUsuario });
      if (error || !data || data.error) return;
      const bloques = document.querySelectorAll('#pp-bloque-autor, #pp-bloque-reseñador, #pp-bloque-editorial');
      let info = null;
      bloques.forEach(b => { if (b.style.display !== 'none' && !info) info = b.querySelector('.pp-cabecera-info'); });
      if (!info) return;
      const cont = document.createElement('div');
      cont.className = 'pp-chat-acciones';
      if (data.bloqueadoPorMi) {
        cont.innerHTML = `<button type="button" class="btn-secundario" onclick="Chat.desbloquear('${_esc(idUsuario)}'); cerrarModales();">Desbloquear</button>`;
      } else {
        cont.innerHTML = `
          ${data.puede ? `<button type="button" class="btn-primario pp-btn-mensaje" onclick="Chat.escribirA('${_esc(idUsuario)}')">💬 Mensaje</button>` : ''}
          <button type="button" class="btn-secundario" onclick="Chat.bloquear('${_esc(idUsuario)}')">🚫 Bloquear</button>
          <button type="button" class="btn-secundario" onclick="abrirModalDenuncia('perfil', '${_esc(idUsuario)}')">🚩 Denunciar</button>`;
      }
      info.appendChild(cont);
    } catch (e) {
      console.error('Chat: error estado con', e);
    }
  }

  return {
    iniciar, detener, actualizarBadge, cargarBandeja, abrirConversacion, enviar, escribirA,
    bloquear, desbloquear, verBloqueados, denunciarChat, denunciarMensaje, pintarAccionesPerfilPublico
  };
})();
