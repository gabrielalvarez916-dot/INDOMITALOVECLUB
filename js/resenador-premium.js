// ============================================================
// resenador-premium.js — Indómita Love Club
// Programa Reseñadores Premium: PAGO ÚNICO (no es una suscripción).
//
// Dos grupos de reseñadores:
//  - Confiables: reseñadores con al menos una reseña entregada y sin
//    bloqueo, y todos los que pagaron Premium. Pueden reseñar cualquier
//    libro; pagar Premium es opcional.
//  - A prueba: reseñadores nuevos o bloqueados por incumplimientos. Solo
//    pueden postularse a libros gratis hasta que paguen Premium o
//    entreguen 2 reseñas sin ningún fallo en el medio.
//
// El backend (crear_postulacion) es quien hace cumplir la regla. Este
// módulo solo muestra el modal que corresponde al grupo del reseñador
// (confiable / a prueba / con penalizaciones) y lleva al pago.
// El pago único suma USD 1 al pozo, una sola vez. Los beneficios
// (comodín de 7 días, doble de puntos en la primera reseña del mes,
// soporte prioritario) se renuevan cada mes mientras sea Premium.
// ============================================================

const ResenadorPremium = (() => {
  // Referencia rápida del copy vigente (el modal se arma en _renderModal).
  const COPY_TITULO = '🔥 Reseñadores Premium';
  const COPY_CUERPO = 'Pago único (no es una suscripción). Pasás a reseñador confiable: podés reseñar cualquier libro de la plataforma. Suma USD 1 al pozo, una sola vez. Incluye comodín de 7 días, doble de puntos en tu primera reseña del mes y prioridad en soporte.';

  // Cada cuánto puede volver a aparecer el modal opcional al apretar "Postularme".
  const INTERVALO_MODAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 días

  let _idCampañaPendiente = null;
  let _cargandoPago = false;
  let _precios = null;

  function _claveUltimaVez(idUsuario) {
    return `premium_modal_ultima_vez_${idUsuario}`;
  }

  function _seMostroRecientemente(idUsuario) {
    try {
      const ultima = Number(localStorage.getItem(_claveUltimaVez(idUsuario)));
      return Number.isFinite(ultima) && ultima > 0 && (Date.now() - ultima) < INTERVALO_MODAL_MS;
    } catch (e) {
      return false;
    }
  }

  function _marcarMostrado(idUsuario) {
    try {
      localStorage.setItem(_claveUltimaVez(idUsuario), String(Date.now()));
    } catch (e) {}
  }

  // ------------------------------------------------------------
  // Precio vigente (configuracion) y estado del reseñador
  // ------------------------------------------------------------
  async function _obtenerPrecios() {
    if (_precios) return _precios;
    let usd = 2;
    let ars = 3100;
    try {
      const { data } = await supabaseClient
        .from('configuracion')
        .select('clave, valor')
        .in('clave', ['RESENADOR_PREMIUM_PRECIO_USD', 'RESENADOR_PREMIUM_PRECIO_ARS']);
      (data || []).forEach(f => {
        const n = Number(f.valor);
        if (!Number.isFinite(n) || n <= 0) return;
        if (f.clave === 'RESENADOR_PREMIUM_PRECIO_USD') usd = n;
        if (f.clave === 'RESENADOR_PREMIUM_PRECIO_ARS') ars = n;
      });
    } catch (e) {
      console.error('Error leyendo el precio de Reseñadores Premium:', e);
    }
    _precios = { usd, ars };
    return _precios;
  }

  function _textoUsd(n) {
    return `USD ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  }

  /**
   * Estado del reseñador logueado según el backend:
   * { estado: 'confiable'|'prueba', premium, bloqueado, penalizado,
   *   incumplimientos, resenasLimpias, resenasEntregadas }
   */
  async function _obtenerEstado() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient.rpc('mi_estado_resenador');
    if (error || !data) {
      if (error) console.error('Error obteniendo el estado de reseñador:', error);
      return null;
    }
    return { idUsuario: user.id, ...data };
  }

  function _variante(estado) {
    if (estado.premium) return 'premium';
    if (estado.bloqueado || estado.penalizado) return 'penalizado';
    if (estado.estado === 'prueba') return 'prueba';
    return 'confiable';
  }

  /**
   * Punto de entrada desde feed.js: se llama antes de dejar postularse.
   * Si devuelve true, feed.js continúa con el flujo normal. Si devuelve
   * false, ya se abrió el modal que corresponde y feed.js no hace nada más.
   *
   * - Reseñador a prueba + campaña paga, o con bloqueo: el modal aparece
   *   siempre (no puede avanzar de todos modos).
   * - Resto: modal informativo/opcional, como máximo una vez cada 2 días.
   */
  async function interceptarPostulacion(idCampaña) {
    try {
      if (Sesion.rol() !== 'reseñador') return true;

      const estado = await _obtenerEstado();
      if (!estado) return true; // ante la duda no bloqueamos: el backend igual valida
      if (estado.premium) return true;

      let obligatorio = false;
      let campanaPaga = false;
      if (estado.bloqueado) {
        obligatorio = true;
      } else if (estado.estado === 'prueba') {
        const { data: esPaga } = await supabaseClient.rpc('campana_es_paga', { p_campana: idCampaña });
        campanaPaga = !!esPaga;
        obligatorio = campanaPaga;
      }

      if (!obligatorio) {
        if (_seMostroRecientemente(estado.idUsuario)) return true;
        _marcarMostrado(estado.idUsuario);
      }

      _idCampañaPendiente = idCampaña;
      await _renderModal(estado, { campanaPaga });
      mostrarModal('modal-resenador-premium');
      return false;
    } catch (e) {
      console.error('Error evaluando el gating de Reseñadores Premium:', e);
      return true;
    }
  }

  /**
   * El backend rechazó la postulación por libro pago (PREMIUM_REQUERIDO):
   * mostramos el modal de reseñador a prueba en vez del error crudo.
   */
  async function abrirPorRechazoBackend(idCampaña) {
    try {
      const estado = await _obtenerEstado();
      if (!estado) {
        mostrarToast('Este libro es de una campaña paga: necesitás ser Reseñador Premium o entregar 2 reseñas sin fallos para postularte.', 'error');
        return;
      }
      _idCampañaPendiente = idCampaña;
      await _renderModal(estado, { campanaPaga: true });
      mostrarModal('modal-resenador-premium');
    } catch (e) {
      console.error('Error abriendo el modal de Reseñadores Premium:', e);
    }
  }

  // ------------------------------------------------------------
  // Modal (contenido según el grupo del reseñador)
  // ------------------------------------------------------------
  function _filaBeneficio(titulo, texto) {
    return `
        <p style="margin:0; font-size:13px; color:var(--gris-texto); display:flex; gap:8px; align-items:flex-start;">
          <span style="color:var(--bordo); flex-shrink:0;">✓</span>
          <span><strong>${titulo}</strong> ${texto}</span>
        </p>`;
  }

  function _cajaBeneficios(variante) {
    const filas = [];
    if (variante === 'prueba' || variante === 'penalizado') {
      filas.push(_filaBeneficio('Pasás a reseñador confiable al instante.', 'Podés postularte a cualquier libro de la plataforma, también a los de campañas pagas.'));
    } else {
      filas.push(_filaBeneficio('Seguís siendo confiable.', 'Si alguna vez te bloquean por incumplimientos, al terminar el bloqueo volvés a ser reseñador confiable sin tener que empezar de cero.'));
    }
    filas.push(_filaBeneficio('Comodín de 7 días.', '¿Se te complica llegar a una entrega? No hay penalización: te sumamos automáticamente una semana extra al plazo. Se usa una vez por postulación.'));
    filas.push(_filaBeneficio('El doble de puntos en tu primera reseña de cada mes.', 'Empujás tu posición en el ranking, el podio y las ligas, antes que nadie más.'));
    filas.push(_filaBeneficio('Arrancás con confiabilidad 🔵 Alta', 'si todavía no tenés historial, en vez de aparecerle "sin datos" a los autores.'));
    filas.push(_filaBeneficio('Prioridad en soporte.', 'Tu consulta salta al frente de la cola.'));
    filas.push(_filaBeneficio('Entrás a la carrera por el pozo.', 'Tu pago suma USD 1 al pozo, una sola vez. Cuando se activa, se reparte entre las 10 reseñadoras con mejor cumplimiento.'));
    return `
      <div style="background:var(--rosa-claro); border-radius:var(--radio); padding:16px 18px; margin-top:14px; display:flex; flex-direction:column; gap:10px;">
        <p style="margin:0; font-size:12px; font-weight:700; color:var(--bordo); text-transform:uppercase; letter-spacing:0.4px;">Con Reseñador Premium (pago único)</p>
        ${filas.join('')}
      </div>`;
  }

  function _contenidoPorVariante(variante, estado, ctx, precios) {
    const usd = _textoUsd(precios.usd);

    if (variante === 'prueba') {
      const llevas = Math.min(Number(estado.resenasLimpias) || 0, 2);
      const intro = ctx.campanaPaga
        ? 'Este libro es de una campaña paga, y por ahora estás <strong>a prueba</strong>: solo podés postularte a libros gratis.'
        : 'Por ahora estás <strong>a prueba</strong>: podés postularte a los libros gratis de la plataforma.';
      return {
        titulo: '🌱 Reseñador a prueba',
        html: `
      <p class="form-info" style="font-weight:700; color:var(--gris-texto); line-height:1.6;">
        ${intro} Para pasar a <strong>reseñador confiable</strong> y poder reseñar <strong>cualquier libro</strong> tenés dos caminos:
      </p>
      <div style="background:var(--rosa-claro); border-radius:var(--radio); padding:14px 18px; margin-top:12px; display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--gris-texto);">
        <p style="margin:0;"><strong>1. Pagar Reseñador Premium</strong> (${usd}, pago único): pasás a confiable en el momento.</p>
        <p style="margin:0;"><strong>2. Entregar 2 reseñas sin ningún fallo en el medio.</strong> Llevás <strong>${llevas} de 2</strong>. Si fallás una entrega, el conteo vuelve a cero.</p>
      </div>
      ${_cajaBeneficios('prueba')}`
      };
    }

    if (variante === 'penalizado') {
      const sigueAPrueba = estado.bloqueado || estado.estado === 'prueba';
      const despuesDeEsperar = sigueAPrueba
        ? ' Cuando termina, seguís a prueba (solo libros gratis) hasta que pagues Premium o entregues 2 reseñas sin fallos.'
        : '';
      return {
        titulo: '⏳ Tu cuenta tiene penalizaciones',
        html: `
      <p class="form-info" style="font-weight:700; color:var(--gris-texto); line-height:1.6;">
        Por incumplimientos recientes en la entrega de reseñas, tu cuenta tiene <strong>penalizaciones</strong>: con 2 incumplimientos solo podés tener una campaña activa a la vez, y con 3 o más no podés postularte por un tiempo.${ctx.campanaPaga ? ' Además, este libro es de una campaña paga.' : ''}
      </p>
      <div style="background:var(--rosa-claro); border-radius:var(--radio); padding:14px 18px; margin-top:12px; display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--gris-texto);">
        <p style="margin:0;"><strong>1. Esperar a que termine.</strong> Las penalizaciones se levantan solas con el tiempo.${despuesDeEsperar}</p>
        <p style="margin:0;"><strong>2. Pagar Reseñador Premium</strong> (${usd}, pago único): se levantan las penalizaciones y volvés a ser <strong>reseñador confiable</strong>.</p>
      </div>
      ${_cajaBeneficios('penalizado')}`
      };
    }

    // confiable
    return {
      titulo: '🔥 Sumate a Reseñadores Premium',
      html: `
      <p class="form-info" style="font-weight:700; color:var(--gris-texto); line-height:1.6;">
        Sos <strong>reseñador confiable</strong>: podés postularte a cualquier libro de la plataforma, pagues o no. Reseñador Premium es <strong>opcional</strong> y es un <strong>pago único</strong> (no es una suscripción).
        El pozo de este mes lleva <strong id="premium-modal-pozo-estado">—</strong>.
      </p>
      ${_cajaBeneficios('confiable')}`
    };
  }

  async function _renderModal(estado, ctx = {}) {
    const precios = await _obtenerPrecios();
    const variante = _variante(estado);
    const { titulo, html } = _contenidoPorVariante(variante, estado, ctx, precios);

    const tituloEl = document.getElementById('premium-modal-titulo');
    const contenidoEl = document.getElementById('premium-modal-contenido');
    const cerrarEl = document.getElementById('premium-modal-cerrar');
    const footerEl = document.getElementById('premium-modal-footer');
    const errorEl = document.getElementById('premium-modal-error');

    if (tituloEl) tituloEl.textContent = titulo;
    if (contenidoEl) contenidoEl.innerHTML = html;
    if (errorEl) errorEl.style.display = 'none';
    if (cerrarEl) cerrarEl.style.display = '';

    if (footerEl) {
      const textoCerrar = variante === 'penalizado' ? 'Esperar' : 'Ahora no';
      footerEl.innerHTML = `
        <button type="button" class="btn-secundario" onclick="ResenadorPremium.rechazarPorAhora()">${textoCerrar}</button>
        <button type="button" class="btn-primario" id="btn-activar-premium" onclick="ResenadorPremium.activarParticipacion('paypal')">Sumarme por ${_textoUsd(precios.usd)} (PayPal)</button>
        <button type="button" class="btn-primario" id="btn-activar-premium-mp" onclick="ResenadorPremium.activarParticipacion('mercadopago')">Sumarme con Mercado Pago ($${Number(precios.ars).toLocaleString('es-AR')})</button>
        <p style="font-size:12px; color:var(--gris-suave); text-align:center; width:100%; margin-top:10px;">
          ¿No tenés PayPal? <a href="#" onclick="event.preventDefault(); ResenadorPremium.avisarSinPaypal();">Avisanos</a>.
        </p>
      `;
    }

    // Estado real del pozo (mismos datos que el ticker del feed).
    const pozoEl = document.getElementById('premium-modal-pozo-estado');
    if (pozoEl) {
      try {
        const [{ data: pozo, error }, { data: config }] = await Promise.all([
          supabaseClient.rpc('obtener_pozo_actual'),
          supabaseClient.from('configuracion').select('valor').eq('clave', 'RESENADOR_PREMIUM_VALOR_POZO_USD').maybeSingle()
        ]);

        if (!error && pozo) {
          const valorPorPago = Number(config?.valor) || 1;
          const pagos = Number(pozo.pagos_contados || 0);
          const umbral = Number(pozo.umbral_pagos || 60);
          const acumulado = pagos * valorPorPago;
          const faltan = Math.max(umbral - pagos, 0);

          pozoEl.textContent = faltan > 0
            ? `USD ${acumulado.toLocaleString('es-AR')} (faltan ${faltan} reseñadoras para repartirlo)`
            : `USD ${acumulado.toLocaleString('es-AR')} — ¡ya se activó!`;
        } else {
          pozoEl.textContent = 'varios cientos de dólares';
        }
      } catch (e) {
        console.error('Error obteniendo estado del pozo para el modal:', e);
        pozoEl.textContent = 'varios cientos de dólares';
      }
    }
  }

  async function activarParticipacion(proveedor = 'paypal') {
    if (_cargandoPago) return;
    _cargandoPago = true;

    const boton = document.getElementById(proveedor === 'mercadopago' ? 'btn-activar-premium-mp' : 'btn-activar-premium');
    const textoOriginal = boton?.textContent;
    if (boton) { boton.disabled = true; boton.textContent = proveedor === 'mercadopago' ? 'Redirigiendo a Mercado Pago...' : 'Redirigiendo a PayPal...'; }

    const errorEl = document.getElementById('premium-modal-error');
    if (errorEl) errorEl.style.display = 'none';

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        mostrarToast('💅 Tu sesión decidió tomarse un descanso. Iniciá sesión de nuevo.', 'error');
        return;
      }

      const { data, error } = await supabaseClient.functions.invoke('crear-pago-resenador-premium', {
        body: { proveedor },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error || !data?.ok) {
        let mensaje = data?.error || error?.message || 'No se pudo iniciar el pago.';
        if (error?.context && typeof error.context.json === 'function') {
          try {
            const bodyReal = await error.context.json();
            mensaje = bodyReal.error || mensaje;
          } catch (e) {}
        }
        if (errorEl) { errorEl.textContent = mensaje; errorEl.style.display = 'block'; }
        else mostrarToast(mensaje, 'error');
        return;
      }

      // Guardamos la campaña pendiente en sessionStorage por si el usuario
      // vuelve del pago y recarga la página (se pierde el estado en memoria).
      if (_idCampañaPendiente) {
        sessionStorage.setItem('premium_postulacion_pendiente', _idCampañaPendiente);
      }

      window.location.href = data.linkPago;
    } catch (e) {
      console.error('Error activando participación Premium:', e);
      if (errorEl) { errorEl.textContent = 'Ocurrió un error inesperado. Probá de nuevo.'; errorEl.style.display = 'block'; }
    } finally {
      _cargandoPago = false;
      if (boton) { boton.disabled = false; boton.textContent = textoOriginal; }
    }
  }

  /**
   * Abre el modal desde el botón del feed (sin pasar por "Postularme").
   * Si ya es Premium, avisa en vez de abrir el modal para no cobrar dos veces.
   */
  async function abrirDesdeBoton() {
    try {
      if (Sesion.rol() !== 'reseñador') return;
      const estado = await _obtenerEstado();
      if (!estado) return;
      if (estado.premium) {
        mostrarToast('✨ Ya sos Reseñador Premium.', 'ok');
        return;
      }
      _idCampañaPendiente = null;
      await _renderModal(estado, {});
      mostrarModal('modal-resenador-premium');
    } catch (e) {
      console.error('Error abriendo el modal de Reseñadores Premium:', e);
    }
  }

  async function rechazarPorAhora() {
    try {
      await supabaseClient.rpc('registrar_decision_resenador_premium', { p_estado: 'rechazado' });
    } catch (e) {
      console.error('Error registrando rechazo de Reseñadores Premium:', e);
    }

    cerrarModales();

    // Cerrar el modal (con "Ahora no" o la X) NO continúa la postulación
    // automáticamente: el usuario tiene que volver a tocar "Postularme".
    _idCampañaPendiente = null;
  }

  /**
   * Limpia el estado interno del modal (campaña pendiente). Se llama tanto
   * desde el botón ✕ propio como, de forma genérica, desde cerrarModales()
   * en ui.js — así que cubre también el click en el overlay.
   */
  function resetEstadoModal() {
    _idCampañaPendiente = null;
  }

  function avisarSinPaypal() {
    cerrarModales();
    const asunto = document.getElementById('soporte-asunto');
    const mensaje = document.getElementById('soporte-mensaje');
    if (asunto) asunto.value = 'No tengo PayPal - Reseñadores Premium';
    if (mensaje) mensaje.value = 'Hola! Quiero sumarme al Programa Reseñadores Premium pero no tengo PayPal. ¿Hay otra forma de pagar el pago único?';
    mostrarModal('modal-soporte');
  }

  // ------------------------------------------------------------
  // Ticker del feed: reemplaza "Nuevo evento: X" por el estado real del
  // pozo. Mientras no se llega al umbral del mes, muestra "34/60 pagos
  // para activarse". Al llegar (o superar), muestra el monto acumulado.
  // Cada pago vale USD 1 para el pozo (una sola vez por reseñador), sin
  // importar cuánto se cobró realmente (USD 2, ARS, etc.): así lo pidió Gaby.
  // ------------------------------------------------------------
  async function obtenerTextoTicker() {
    try {
      const [{ data: pozo, error: errorPozo }, { data: config }] = await Promise.all([
        supabaseClient.rpc('obtener_pozo_actual'),
        supabaseClient.from('configuracion').select('valor').eq('clave', 'RESENADOR_PREMIUM_VALOR_POZO_USD').maybeSingle()
      ]);

      if (errorPozo || !pozo) return null;

      const valorPorPago = Number(config?.valor) || 1;
      const pagos = Number(pozo.pagos_contados || 0);
      const umbral = Number(pozo.umbral_pagos || 60);
      const acumulado = pagos * valorPorPago;

      if (pozo.estado === 'abierto' && pagos < umbral) {
        return `🔥 Programa Reseñadores Premium — Pozo: ${pagos}/${umbral} pagos para activarse`;
      }

      return `🔥 ¡Pozo Reseñadores Premium activado! — USD ${acumulado.toLocaleString('es-AR')} acumulados este mes`;
    } catch (e) {
      console.error('Error armando el texto del ticker de Reseñadores Premium:', e);
      return null;
    }
  }

  // ------------------------------------------------------------
  // Retomar postulación pendiente tras volver del pago
  // ------------------------------------------------------------
  async function retomarPostulacionPendienteSiHay() {
    const idCampaña = sessionStorage.getItem('premium_postulacion_pendiente');
    if (!idCampaña) return;
    sessionStorage.removeItem('premium_postulacion_pendiente');

    if (Sesion.rol() !== 'reseñador') return;

    // Si todavía no se acreditó el pago, el usuario puede tocar
    // "Postularme" de nuevo sin drama.
    if (typeof continuarFlujoPostulacion === 'function') {
      await continuarFlujoPostulacion(idCampaña);
    }
  }

  return {
    interceptarPostulacion,
    abrirPorRechazoBackend,
    abrirDesdeBoton,
    activarParticipacion,
    rechazarPorAhora,
    resetEstadoModal,
    avisarSinPaypal,
    obtenerTextoTicker,
    retomarPostulacionPendienteSiHay,
    COPY_TITULO,
    COPY_CUERPO
  };
})();
