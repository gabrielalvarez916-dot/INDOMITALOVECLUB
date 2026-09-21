// ============================================================
// resenador-premium.js — Indómita Love Club
// Programa Reseñadores Premium: aporte mensual de USD 1 al pozo que
// se reparte entre los 10 reseñadores con mejor cumplimiento del mes.
// Es OPCIONAL para todos los reseñadores: pueden sumarse o no, y en
// ambos casos pueden postularse a campañas. El backend no restringe la
// postulación por este programa. Este módulo solo muestra el modal de
// invitación cuando el reseñador aprieta "Postularme", y como máximo
// una vez cada 2 días (mientras no haya pagado el mes).
// ============================================================

const ResenadorPremium = (() => {
  // Nota: estos dos strings no se usan para renderizar el modal (el HTML
  // vive en app.html, con el estado del pozo inyectado en vivo por
  // _renderModal). Quedan solo como referencia rápida del copy vigente.
  const COPY_TITULO = '🔥 Activa tu participación este mes';
  const COPY_CUERPO = 'Sumate al pozo de este mes por USD 1,50. Cuando se llega al umbral de aportes, el pozo se activa y se reparte entre las 10 reseñadoras con mejor cumplimiento. Si no se llega, tu aporte no se pierde: pasa a contar para el mes que viene. Es opcional: podés postularte a las campañas igual. Además sumás: comodín de 7 días, doble de puntos en tu primera reseña del mes, confiabilidad Alta desde el día uno y prioridad en soporte.';

  // Cada cuánto puede volver a aparecer el modal al apretar "Postularme".
  const INTERVALO_MODAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 días

  let _idCampañaPendiente = null;
  let _cargandoPago = false;

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

  function _mesActual() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }

  // ------------------------------------------------------------
  // Estado del reseñador logueado para el mes en curso
  // ------------------------------------------------------------
  async function _obtenerEstado() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data: filaMes } = await supabaseClient
      .from('resenadores_premium')
      .select('estado, pagado')
      .eq('id_usuario', user.id)
      .eq('mes_año', _mesActual())
      .maybeSingle();

    return {
      idUsuario: user.id,
      pagado: !!filaMes?.pagado
    };
  }

  /**
   * Decide si hay que interceptar el click en "Postularme" con el modal.
   * @returns {'opcional'|'ninguno'}
   */
  async function _evaluarGating() {
    if (Sesion.rol() !== 'reseñador') return 'ninguno';

    const estado = await _obtenerEstado();
    if (!estado) return 'ninguno';

    if (estado.pagado) return 'ninguno';

    // Si el modal ya se le mostró hace menos de 2 días, no se repite:
    // sigue con la postulación normal.
    if (_seMostroRecientemente(estado.idUsuario)) return 'ninguno';

    _marcarMostrado(estado.idUsuario);
    return 'opcional';
  }

  /**
   * Punto de entrada desde feed.js: se llama antes de dejar postularse.
   * Si devuelve true, feed.js puede continuar con el flujo normal de
   * postulación. Si devuelve false, ya se abrió el modal correspondiente
   * y feed.js no debe hacer nada más (la postulación sigue al cerrar el
   * modal, si corresponde).
   */
  async function interceptarPostulacion(idCampaña) {
    let modo;
    try {
      modo = await _evaluarGating();
    } catch (e) {
      console.error('Error evaluando gating de Reseñadores Premium:', e);
      return true; // ante la duda, no bloqueamos al reseñador por un error nuestro
    }

    if (modo === 'ninguno') return true;

    _idCampañaPendiente = idCampaña;
    await _renderModal();
    mostrarModal('modal-resenador-premium');
    return false;
  }

  // ------------------------------------------------------------
  // Modal
  // ------------------------------------------------------------
  async function _renderModal() {
    const cerrarEl = document.getElementById('premium-modal-cerrar');
    const footerEl = document.getElementById('premium-modal-footer');

    if (cerrarEl) cerrarEl.style.display = '';
    if (footerEl) {
      footerEl.innerHTML = `
        <button type="button" class="btn-secundario" onclick="ResenadorPremium.rechazarPorAhora()">Ahora no</button>
        <button type="button" class="btn-primario" id="btn-activar-premium" onclick="ResenadorPremium.activarParticipacion()">Sumarme por USD 1,50</button>
        <p style="font-size:12px; color:var(--gris-suave); text-align:center; width:100%; margin-top:10px;">
          ¿No tenés PayPal? <a href="#" onclick="event.preventDefault(); ResenadorPremium.avisarSinPaypal();">Avisanos</a>.
        </p>
      `;
    }

    // Estado real del pozo (mismos datos que el ticker del feed), para no
    // hardcodear un monto en el copy: eso queda desactualizado apenas
    // alguien más se suma o cambia el mes. Mostramos plata (no "aportes")
    // porque eso es lo que se entiende de una: cuánto hay juntado y qué
    // falta para que se reparta.
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

  async function activarParticipacion() {
    if (_cargandoPago) return;
    _cargandoPago = true;

    const boton = document.getElementById('btn-activar-premium');
    const textoOriginal = boton?.textContent;
    if (boton) { boton.disabled = true; boton.textContent = 'Redirigiendo a PayPal...'; }

    const errorEl = document.getElementById('premium-modal-error');
    if (errorEl) errorEl.style.display = 'none';

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        mostrarToast('💅 Tu sesión decidió tomarse un descanso. Iniciá sesión de nuevo.', 'error');
        return;
      }

      const { data, error } = await supabaseClient.functions.invoke('crear-pago-resenador-premium', {
        body: { proveedor: 'paypal' },
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
      // vuelve de PayPal y recarga la página (se pierde el estado en memoria).
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

  async function rechazarPorAhora() {
    try {
      await supabaseClient.rpc('registrar_decision_resenador_premium', { p_estado: 'rechazado' });
    } catch (e) {
      console.error('Error registrando rechazo de Reseñadores Premium:', e);
    }

    cerrarModales();

    // A pedido: cerrar el modal (con "Ahora no" o la X) ya NO continúa la
    // postulación automáticamente. El usuario tiene que volver a tocar
    // "Postularme"; como el modal ya se marcó como mostrado, esa segunda
    // vez el gating deja pasar directo (ver _evaluarGating / INTERVALO_MODAL_MS).
    _idCampañaPendiente = null;
  }

  /**
   * Limpia el estado interno del modal (campaña pendiente). Se llama tanto
   * desde el botón ✕ propio como, de forma genérica, desde cerrarModales()
   * en ui.js — así que cubre también el click en el overlay. El usuario
   * puede cerrar este modal libremente en cualquier momento.
   */
  function resetEstadoModal() {
    _idCampañaPendiente = null;
  }

  function avisarSinPaypal() {
    cerrarModales();
    const asunto = document.getElementById('soporte-asunto');
    const mensaje = document.getElementById('soporte-mensaje');
    if (asunto) asunto.value = 'No tengo PayPal - Reseñadores Premium';
    if (mensaje) mensaje.value = 'Hola! Quiero sumarme al Programa Reseñadores Premium pero no tengo PayPal. ¿Hay otra forma de pagar el USD 1,50?';
    mostrarModal('modal-soporte');
  }

  // ------------------------------------------------------------
  // Ticker del feed: reemplaza "Nuevo evento: X" por el estado real del
  // pozo. Mientras no se llega al umbral del mes, muestra "34/60 pagos
  // para activarse". Al llegar (o superar), muestra el monto acumulado.
  // Cada pago vale USD 1 para el pozo, sin importar cuánto se cobró
  // realmente (1,50 USD, ARS, EUR, lo que sea): así lo pidió Gaby.
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
  // Retomar postulación pendiente tras volver de PayPal
  // ------------------------------------------------------------
  async function retomarPostulacionPendienteSiHay() {
    const idCampaña = sessionStorage.getItem('premium_postulacion_pendiente');
    if (!idCampaña) return;
    sessionStorage.removeItem('premium_postulacion_pendiente');

    if (Sesion.rol() !== 'reseñador') return;

    // Le damos un respiro a la acreditación (captura de PayPal) antes de
    // reintentar; si todavía no se acreditó, el usuario puede tocar
    // "Postularme" de nuevo sin drama.
    if (typeof continuarFlujoPostulacion === 'function') {
      await continuarFlujoPostulacion(idCampaña);
    }
  }

  return {
    interceptarPostulacion,
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
