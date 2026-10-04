// ============================================================
// me-tienta.js — Indómita Love Club
// "Me tienta" (como un me gusta). Se puede dar a:
//  - actividades del Muro de actividad  (tipo 'actividad')
//  - campañas, solo en el feed          (tipo 'campana')
//  - reseñas CON comentario, en el feed (tipo 'resena')
// Datos: RPC alternar_me_tienta / me_tienta_resumen (y los contadores que
// ya vienen dentro de mis_muro_actividad y obtener_resenas_publicas_libro).
// ============================================================

const MeTienta = (() => {
  const _estado = new Map(); // 'tipo:id' -> { total, yo }

  const _k = (tipo, id) => `${tipo}:${id}`;

  function _puede() {
    const rol = (typeof Sesion !== 'undefined' && Sesion.rol) ? Sesion.rol() : null;
    return rol === 'autor' || rol === 'editorial' || rol === 'reseñador';
  }

  function guardar(tipo, id, resumen) {
    if (!id || !resumen) return;
    _estado.set(_k(tipo, id), { total: resumen.total || 0, yo: !!resumen.yo });
  }

  function _htmlBoton(tipo, id) {
    const e = _estado.get(_k(tipo, id)) || { total: 0, yo: false };
    return `<button type="button" class="me-tienta-btn${e.yo ? ' activo' : ''}" data-tipo="${tipo}" data-id="${id}"
      onclick="event.stopPropagation(); MeTienta.alternar(this)" aria-pressed="${e.yo}">
      <span class="me-tienta-ico">🔥</span><span class="me-tienta-txt">Me tienta</span><span class="me-tienta-n">${e.total > 0 ? e.total : ''}</span>
    </button>`;
  }

  // HTML del botón (vacío si el rol no puede usar Me tienta)
  function boton(tipo, id, resumenInicial) {
    if (!_puede() || !id) return '';
    if (resumenInicial) guardar(tipo, id, resumenInicial);
    return _htmlBoton(tipo, id);
  }

  function _pintar(btn) {
    const e = _estado.get(_k(btn.dataset.tipo, btn.dataset.id)) || { total: 0, yo: false };
    btn.classList.toggle('activo', e.yo);
    btn.setAttribute('aria-pressed', String(e.yo));
    const n = btn.querySelector('.me-tienta-n');
    if (n) n.textContent = e.total > 0 ? e.total : '';
  }

  function _repintarTodos(tipo, id) {
    document.querySelectorAll(`.me-tienta-btn[data-tipo="${tipo}"][data-id="${id}"]`).forEach(_pintar);
  }

  // Trae contadores de los ids que todavía no conocemos y repinta los botones
  async function hidratar(tipo, ids) {
    if (!_puede() || !ids || !ids.length) return;
    const faltan = ids.filter(id => id && !_estado.has(_k(tipo, id)));
    if (!faltan.length) return;
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
    const tipo = btn.dataset.tipo, id = btn.dataset.id;
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

  return { boton, hidratar, alternar, guardar };
})();
