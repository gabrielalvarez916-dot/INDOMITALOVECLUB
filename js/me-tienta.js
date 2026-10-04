// ============================================================
// me-tienta.js — Indómita Love Club
// "Me tienta" (como un me gusta). Se puede dar a:
//  - actividades del Muro de actividad  (tipo 'actividad')
//  - campañas: en el feed y en el detalle, al lado de Favoritos (tipo 'campana')
//  - reseñas CON comentario, en el feed (tipo 'resena')
// Se ve QUIÉN dio Me tienta: tocando el número se abre la lista (como los
// "me gusta" de Instagram).
// Datos: RPC alternar_me_tienta / me_tienta_resumen / me_tienta_quienes (y los
// contadores que ya vienen dentro de mis_muro_actividad y
// obtener_resenas_publicas_libro).
// ============================================================

const MeTienta = (() => {
  const _estado = new Map(); // 'tipo:id' -> { total, yo }
  const FOTO_DEFAULT = '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK';

  const _k = (tipo, id) => `${tipo}:${id}`;

  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _puede() {
    const rol = (typeof Sesion !== 'undefined' && Sesion.rol) ? Sesion.rol() : null;
    return rol === 'autor' || rol === 'editorial' || rol === 'reseñador';
  }

  function guardar(tipo, id, resumen) {
    if (!id || !resumen) return;
    _estado.set(_k(tipo, id), { total: resumen.total || 0, yo: !!resumen.yo });
  }

  // Grupo: [🔥 Me tienta] [número → abre la lista de quienes tentaron]
  function _htmlGrupo(tipo, id) {
    const e = _estado.get(_k(tipo, id)) || { total: 0, yo: false };
    return `<span class="me-tienta-grupo" data-tipo="${tipo}" data-id="${id}">
      <button type="button" class="me-tienta-btn${e.yo ? ' activo' : ''}" aria-pressed="${e.yo}"
        onclick="event.stopPropagation(); MeTienta.alternar(this)">
        <span class="me-tienta-ico">🔥</span><span class="me-tienta-txt">Me tienta</span>
      </button><button type="button" class="me-tienta-cuenta" title="Ver quién dio Me tienta"
        style="${e.total > 0 ? '' : 'display:none;'}"
        onclick="event.stopPropagation(); MeTienta.verQuienes('${tipo}', '${id}')">${e.total > 0 ? e.total : ''}</button>
    </span>`;
  }

  // HTML del botón (vacío si el rol no puede usar Me tienta)
  function boton(tipo, id, resumenInicial) {
    if (!_puede() || !id) return '';
    if (resumenInicial) guardar(tipo, id, resumenInicial);
    return _htmlGrupo(tipo, id);
  }

  function _pintar(grupo) {
    const e = _estado.get(_k(grupo.dataset.tipo, grupo.dataset.id)) || { total: 0, yo: false };
    const btn = grupo.querySelector('.me-tienta-btn');
    if (btn) {
      btn.classList.toggle('activo', e.yo);
      btn.setAttribute('aria-pressed', String(e.yo));
    }
    const cuenta = grupo.querySelector('.me-tienta-cuenta');
    if (cuenta) {
      cuenta.textContent = e.total > 0 ? e.total : '';
      cuenta.style.display = e.total > 0 ? '' : 'none';
    }
  }

  function _repintarTodos(tipo, id) {
    document.querySelectorAll(`.me-tienta-grupo[data-tipo="${tipo}"][data-id="${id}"]`).forEach(_pintar);
  }

  // Trae contadores de los ids que todavía no conocemos y repinta los botones
  async function hidratar(tipo, ids) {
    if (!_puede() || !ids || !ids.length) return;
    const faltan = ids.filter(id => id && !_estado.has(_k(tipo, id)));
    if (!faltan.length) { ids.forEach(id => id && _repintarTodos(tipo, id)); return; }
    try {
      const { data, error } = await supabaseClient.rpc('me_tienta_resumen', { p_tipo: tipo, p_ids: faltan });
      if (error || !data) return;
      faltan.forEach(id => {
        guardar(tipo, id, data[id] || { total: 0, yo: false });
        _repintarTodos(tipo, id);
      });
    } catch (e) {
      console.error('MeTienta: error cargando contadores', e);
    }
  }

  async function alternar(btn) {
    if (btn.disabled) return;
    const grupo = btn.closest('.me-tienta-grupo');
    if (!grupo) return;
    const tipo = grupo.dataset.tipo, id = grupo.dataset.id;
    const antes = _estado.get(_k(tipo, id)) || { total: 0, yo: false };
    // Actualización optimista
    _estado.set(_k(tipo, id), { total: Math.max(0, antes.total + (antes.yo ? -1 : 1)), yo: !antes.yo });
    _repintarTodos(tipo, id);
    btn.disabled = true;
    try {
      const { data, error } = await supabaseClient.rpc('alternar_me_tienta', { p_tipo: tipo, p_id: id });
      if (error || !data || data.error) {
        _estado.set(_k(tipo, id), antes);
        _repintarTodos(tipo, id);
        if (typeof mostrarToast === 'function') mostrarToast((data && data.error) || 'No se pudo completar la acción.', 'error');
      } else {
        guardar(tipo, id, { total: data.total, yo: data.activo });
        _repintarTodos(tipo, id);
      }
    } catch (e) {
      console.error('MeTienta: error', e);
      _estado.set(_k(tipo, id), antes);
      _repintarTodos(tipo, id);
    } finally {
      btn.disabled = false;
    }
  }

  // ── Lista de quienes dieron Me tienta ──────────────────────
  function _etiquetaRol(rol) {
    return { 'autor': 'Autor@', 'editorial': 'Editorial', 'reseñador': 'Reseñador@' }[rol] || rol || '';
  }

  function _foto(url) {
    if (!url) return FOTO_DEFAULT;
    if (url.startsWith('/')) return 'https://indomitaloveclub.vercel.app' + url;
    return url;
  }

  async function verQuienes(tipo, id) {
    const modal = document.getElementById('modal-me-tienta');
    const lista = document.getElementById('me-tienta-lista');
    if (!modal || !lista) return;
    lista.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    mostrarModal('modal-me-tienta');
    try {
      const { data, error } = await supabaseClient.rpc('me_tienta_quienes', { p_tipo: tipo, p_id: id, p_limite: 100, p_desplazamiento: 0 });
      if (error || !data || data.error) {
        lista.innerHTML = `<p class="pp-vacio">${_esc((data && data.error) || 'No se pudo cargar la lista.')}</p>`;
        return;
      }
      const items = data.items || [];
      if (items.length === 0) {
        lista.innerHTML = '<p class="pp-vacio">Todavía a nadie le tentó.</p>';
        return;
      }
      lista.innerHTML = items.map(u => `
        <div class="flechazo-item">
          <div class="flechazo-item-izq" onclick="MeTienta.verPerfil('${_esc(u.id)}', '${_esc(u.rol)}')">
            <img class="flechazo-foto" src="${_esc(_foto(u.fotoPerfil))}" alt="" onerror="this.src='${FOTO_DEFAULT}'" />
            <div class="flechazo-info">
              <span class="flechazo-alias">${_esc(u.alias || 'Lector@')}</span>
              <span class="flechazo-rol">${_esc(_etiquetaRol(u.rol))}</span>
            </div>
          </div>
        </div>`).join('');
    } catch (e) {
      console.error('MeTienta: error cargando quiénes', e);
      lista.innerHTML = '<p class="pp-vacio">No se pudo cargar la lista.</p>';
    }
  }

  // Cierra solo esta lista (deja abierto el detalle de la campaña si venía de ahí)
  function cerrarQuienes() {
    const modal = document.getElementById('modal-me-tienta');
    if (modal) modal.classList.remove('activo');
    if (!document.querySelector('.modal.activo')) cerrarModales();
  }

  function verPerfil(id, rol) {
    cerrarModales();
    if (typeof abrirPerfilPublico === 'function') abrirPerfilPublico(id, rol);
  }

  return { boton, hidratar, alternar, guardar, verQuienes, cerrarQuienes, verPerfil };
})();
