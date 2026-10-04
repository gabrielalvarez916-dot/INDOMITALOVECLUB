// ============================================================
// flechazos.js — Indómita Love Club
// Seguir ("flechar") usuarios.
//  - Contadores PÚBLICOS (Flechados / Me flecharon): se ven en el perfil propio
//    y en el perfil público de cualquier persona.
//  - Las LISTAS son PRIVADAS: solo las ve la propia persona, desde su perfil.
//    Modal con la lista (Flechados: botón Desflechar; Me flecharon: solo info
//    y, si sos autor/editorial, botón Invitar a una campaña)
//  - Botón Flechar / Desflechar en el perfil público de otras personas
// ============================================================

const Flechazos = (() => {
  const FOTO_DEFAULT = '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK';
  let _listaActual = null;      // 'flechados' | 'flechadores'
  let _idReseñadorInvitar = null;

  // ──────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────
  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _foto(url) {
    if (!url) return FOTO_DEFAULT;
    if (url.startsWith('/')) return 'https://indomitaloveclub.vercel.app' + url;
    return url;
  }

  function _etiquetaRol(rol) {
    return { 'autor': 'Autor@', 'editorial': 'Editorial', 'reseñador': 'Reseñador@' }[rol] || rol || '';
  }

  function _toast(msg, tipo) {
    if (typeof mostrarToast === 'function') mostrarToast(msg, tipo);
  }

  // ──────────────────────────────────────────────────────────
  // Contadores en el perfil propio (clickeables: abren la lista privada)
  // ──────────────────────────────────────────────────────────
  async function cargarContadores() {
    // Hay un bloque por cada cabecera propia (autor / reseñador / editorial); se llenan todos
    const conts = document.querySelectorAll('.flechazos-contadores');
    if (!conts.length) return;
    try {
      const { data, error } = await supabaseClient.rpc('mis_contadores_flechazos');
      if (error || !data || data.error) return;
      document.querySelectorAll('.flechazos-n-flechados').forEach(el => { el.textContent = data.flechados ?? 0; });
      document.querySelectorAll('.flechazos-n-flechadores').forEach(el => { el.textContent = data.flechadores ?? 0; });
      conts.forEach(c => { c.style.display = 'flex'; });
    } catch (e) {
      console.error('Flechazos: error cargando contadores', e);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Modal de listas
  // ──────────────────────────────────────────────────────────
  async function abrirLista(tipo) {
    _listaActual = tipo;
    const titulo = document.getElementById('flechazos-modal-titulo');
    if (titulo) titulo.textContent = tipo === 'flechados' ? 'Flechados' : 'Me flecharon';

    const ayuda = document.getElementById('flechazos-modal-ayuda');
    if (ayuda) {
      const rol = Sesion.rol();
      if (tipo === 'flechados') {
        ayuda.textContent = 'Las personas que flechaste. Si las desflechás, dejás de ver su actividad.';
      } else if (rol === 'autor' || rol === 'editorial') {
        ayuda.textContent = 'Quienes te flechan. Podés invitarlas a reseñar una de tus campañas activas.';
      } else {
        ayuda.textContent = 'Las personas que te flechan.';
      }
    }

    mostrarModal('modal-flechazos');
    await _cargarLista();
  }

  async function _cargarLista() {
    const lista = document.getElementById('flechazos-lista');
    if (!lista) return;
    lista.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

    const fn = _listaActual === 'flechados' ? 'mis_flechados' : 'mis_flechadores';
    try {
      const { data, error } = await supabaseClient.rpc(fn, { p_limite: 100, p_desplazamiento: 0 });
      if (error || !data || data.error) {
        lista.innerHTML = '<p class="pp-vacio">No se pudo cargar la lista.</p>';
        return;
      }
      _pintarLista(data.items || []);
    } catch (e) {
      console.error('Flechazos: error cargando lista', e);
      lista.innerHTML = '<p class="pp-vacio">No se pudo cargar la lista.</p>';
    }
  }

  function _pintarLista(items) {
    const lista = document.getElementById('flechazos-lista');
    if (!lista) return;

    if (items.length === 0) {
      lista.innerHTML = _listaActual === 'flechados'
        ? '<p class="pp-vacio">Todavía no flechaste a nadie. Entrá a un perfil y tocá Flechar.</p>'
        : '<p class="pp-vacio">Todavía nadie te flechó.</p>';
      return;
    }

    const rolYo = Sesion.rol();
    const puedeInvitar = _listaActual === 'flechadores' && (rolYo === 'autor' || rolYo === 'editorial');

    lista.innerHTML = items.map(u => {
      let boton = '';
      if (_listaActual === 'flechados') {
        boton = `<button class="btn-secundario btn-sm" onclick="Flechazos.desflecharDesdeLista('${_esc(u.id)}', this)">Desflechar</button>`;
      } else if (puedeInvitar && u.rol === 'reseñador') {
        boton = `<button class="btn-primario btn-sm" onclick="Flechazos.abrirInvitar('${_esc(u.id)}', '${_esc(u.alias || '')}')">Invitar</button>`;
      }
      return `
        <div class="flechazo-item">
          <div class="flechazo-item-izq" onclick="Flechazos.verPerfil('${_esc(u.id)}', '${_esc(u.rol)}')">
            <img class="flechazo-foto" src="${_esc(_foto(u.fotoPerfil))}" alt="" onerror="this.src='${FOTO_DEFAULT}'" />
            <div class="flechazo-info">
              <span class="flechazo-alias">${_esc(u.alias || 'Lector@')}</span>
              <span class="flechazo-rol">${_esc(_etiquetaRol(u.rol))}${u.mutuo ? ' · 💘 se flechan' : ''}</span>
            </div>
          </div>
          ${boton}
        </div>`;
    }).join('');
  }

  function verPerfil(id, rol) {
    cerrarModales();
    if (typeof abrirPerfilPublico === 'function') abrirPerfilPublico(id, rol);
  }

  async function desflecharDesdeLista(idUsuario, btn) {
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await supabaseClient.rpc('desflechar', { p_id_usuario: idUsuario });
      if (error || !data || data.error) {
        _toast((data && data.error) || 'No se pudo desflechar.', 'error');
        if (btn) btn.disabled = false;
        return;
      }
      await _cargarLista();
      cargarContadores();
    } catch (e) {
      console.error(e);
      _toast('No se pudo desflechar.', 'error');
      if (btn) btn.disabled = false;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Invitar a una campaña (autor / editorial → reseñador que lo flecha)
  // ──────────────────────────────────────────────────────────
  async function abrirInvitar(idResenador, alias) {
    _idReseñadorInvitar = idResenador;
    const titulo = document.getElementById('invitar-campana-titulo');
    if (titulo) titulo.textContent = alias ? `Invitar a ${alias}` : 'Invitar a una campaña';

    const cont = document.getElementById('invitar-campana-lista');
    if (cont) cont.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    mostrarModal('modal-invitar-campana');

    try {
      const { data, error } = await supabaseClient.rpc('campanas_para_invitar', { p_id_resenador: idResenador });
      if (error || !data || data.error) {
        cont.innerHTML = '<p class="pp-vacio">No se pudieron cargar tus campañas.</p>';
        return;
      }
      const items = data.items || [];
      if (items.length === 0) {
        cont.innerHTML = '<p class="pp-vacio">No tenés campañas activas para invitar. Creá una desde tu panel.</p>';
        return;
      }
      cont.innerHTML = items.map(c => {
        let accion;
        if (c.yaPostulada) accion = '<span class="flechazo-rol">Ya se postuló</span>';
        else if (c.yaInvitado) accion = '<span class="flechazo-rol">Ya invitada ✓</span>';
        else if (!c.cuposDisponibles) accion = '<span class="flechazo-rol">Sin cupos</span>';
        else accion = `<button class="btn-primario btn-sm" onclick="Flechazos.invitar('${_esc(c.id)}', this)">Invitar</button>`;
        return `
          <div class="flechazo-item">
            <div class="flechazo-item-izq" style="cursor:default;">
              ${c.linkPortada
                ? `<img class="flechazo-portada" src="${_esc(_foto(c.linkPortada))}" alt="" />`
                : '<div class="flechazo-portada flechazo-portada-vacia">📖</div>'}
              <div class="flechazo-info">
                <span class="flechazo-alias">${_esc(c.nombreLibro)}</span>
                <span class="flechazo-rol">${_esc(String(c.cuposDisponibles ?? 0))} cupos disponibles</span>
              </div>
            </div>
            ${accion}
          </div>`;
      }).join('');
    } catch (e) {
      console.error(e);
      cont.innerHTML = '<p class="pp-vacio">No se pudieron cargar tus campañas.</p>';
    }
  }

  async function invitar(idCampana, btn) {
    if (!_idReseñadorInvitar) return;
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await supabaseClient.rpc('invitar_a_campana', {
        p_id_resenador: _idReseñadorInvitar,
        p_id_campana: idCampana
      });
      if (error || !data || data.error) {
        _toast((data && data.error) || 'No se pudo invitar.', 'error');
        if (btn) btn.disabled = false;
        return;
      }
      _toast('Invitación registrada.', 'ok');
      if (btn) btn.outerHTML = '<span class="flechazo-rol">Ya invitada ✓</span>';
    } catch (e) {
      console.error(e);
      _toast('No se pudo invitar.', 'error');
      if (btn) btn.disabled = false;
    }
  }

  function cerrarInvitar() {
    // Vuelve a la lista de "Me flecharon" sin cerrar todo
    const m = document.getElementById('modal-invitar-campana');
    if (m) m.classList.remove('activo');
  }

  // ──────────────────────────────────────────────────────────
  // Botón Flechar / Desflechar en el perfil público de otra persona
  // ──────────────────────────────────────────────────────────
  // Cabecera del bloque visible del modal de perfil público
  function _cabeceraPerfilPublico() {
    const bloques = document.querySelectorAll(
      '#pp-bloque-autor, #pp-bloque-reseñador, #pp-bloque-editorial'
    );
    let info = null;
    bloques.forEach(b => {
      if (b.style.display !== 'none' && !info) info = b.querySelector('.pp-cabecera-info');
    });
    return info;
  }

  // Contadores PÚBLICOS en el perfil de otra persona (solo números, sin listas)
  async function pintarContadoresPerfilPublico(idUsuario) {
    document.querySelectorAll('#modal-perfil-publico .pp-flechazos-contadores').forEach(b => b.remove());
    if (!idUsuario || !Sesion.activa()) return;

    try {
      const { data, error } = await supabaseClient.rpc('contadores_flechazos', { p_id_usuario: idUsuario });
      if (error || !data || data.error) return;

      const info = _cabeceraPerfilPublico();
      if (!info) return;

      const div = document.createElement('div');
      div.className = 'pp-flechazos-contadores';
      div.innerHTML =
        `<span><strong>${Number(data.flechados) || 0}</strong> Flechados</span>` +
        `<span><strong>${Number(data.flechadores) || 0}</strong> Me flecharon</span>`;
      info.appendChild(div);
    } catch (e) {
      console.error('Flechazos: error cargando contadores públicos', e);
    }
  }

  async function pintarBotonPerfilPublico(idUsuario) {
    // Limpia botón anterior
    document.querySelectorAll('#modal-perfil-publico .pp-btn-flechar').forEach(b => b.remove());
    if (!idUsuario || !Sesion.activa()) return;

    try {
      const { data, error } = await supabaseClient.rpc('estado_flechazo', { p_id_usuario: idUsuario });
      if (error || !data || data.error || !data.puedo_flechar) return;

      // Busca la cabecera del bloque visible del modal
      const info = _cabeceraPerfilPublico();
      if (!info) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pp-btn-flechar';
      btn.dataset.id = idUsuario;
      _renderBoton(btn, !!data.lo_flecho, !!data.me_flecha);
      btn.onclick = () => _alternar(btn);
      info.appendChild(btn);
    } catch (e) {
      console.error('Flechazos: error leyendo estado', e);
    }
  }

  function _renderBoton(btn, loFlecho, meFlecha) {
    btn.dataset.flechado = loFlecho ? '1' : '0';
    btn.dataset.meflecha = meFlecha ? '1' : '0';
    btn.classList.toggle('pp-btn-flechar--activo', loFlecho);
    if (loFlecho) {
      btn.textContent = 'Desflechar';
    } else {
      btn.textContent = meFlecha ? '💘 Flechar también' : '💘 Flechar';
    }
  }

  async function _alternar(btn) {
    const id = btn.dataset.id;
    const estabaFlechado = btn.dataset.flechado === '1';
    btn.disabled = true;
    try {
      const { data, error } = await supabaseClient.rpc(estabaFlechado ? 'desflechar' : 'flechar', { p_id_usuario: id });
      if (error || !data || data.error) {
        _toast((data && data.error) || 'No se pudo completar la acción.', 'error');
      } else {
        _renderBoton(btn, !estabaFlechado, btn.dataset.meflecha === '1');
      }
    } catch (e) {
      console.error(e);
      _toast('No se pudo completar la acción.', 'error');
    }
    btn.disabled = false;
  }

  return {
    cargarContadores,
    abrirLista,
    verPerfil,
    desflecharDesdeLista,
    abrirInvitar,
    invitar,
    cerrarInvitar,
    pintarContadoresPerfilPublico,
    pintarBotonPerfilPublico
  };
})();
