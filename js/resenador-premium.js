// ============================================================
// resenador-premium.js — Indómita Love Club
// Programa Reseñadores Premium: aporte mensual de USD 1 al pozo que
// se reparte entre los 10 reseñadores con mejor cumplimiento del mes.
// - Reseñadores NUEVOS (dados de alta desde la fecha de corte): es
//   obligatorio para poder postularse a campañas.
// - Reseñadores existentes: es opcional (pueden sumarse o rechazar).
// El gating real (quién puede postularse) lo hace el backend
// (puede_postularse_este_mes / crear_postulacion). Este módulo solo
// se encarga de mostrar el modal correcto ANTES de intentar postular,
// para que la experiencia sea clara en vez de un error de la RPC.
// ============================================================

const ResenadorPremium = (() => {
  const COPY_TITULO = '🔥 Activa tu participación este mes';
  const COPY_CUERPO = 'Para postularte a está y todas las campañas que quieras, activá tu participación como reseñador por 1 USD. Tu aporte se suma al pozo de reseñadores y, al finalizar el mes, se reparte entre los diez reseñadores con mejor cumplimiento.';

  let _idCampañaPendiente = null;
  let _cargandoPago = false;

  function _mesActual() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }

  // ------------------------------------------------------------
  // Estado del reseñador logueado para el mes en curso
  // ------------------------------------------------------------
  async function _obtenerEstado() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const [{ data: esNuevo }, { data: filaMes }] = await Promise.all([
      supabaseClient.rpc('es_resenador_nuevo_bajo_regla_premium'),
      supabaseClient
        .from('resenadores_premium')
        .select('estado, pagado')
        .eq('id_usuario', user.id)
        .eq('mes_año', _mesActual())
        .maybeSingle()
    ]);

    return {
      esNuevo: !!esNuevo,
      pagado: !!filaMes?.pagado,
      estado: filaMes?.estado || null
    };
  }

  /**
   * Decide si hay que interceptar el click en "Postularme" con el modal.
   * @returns {'obligatorio'|'opcional'|'ninguno'}
   */
  async function _evaluarGating() {
    if (Sesion.rol() !== 'reseñador') return 'ninguno';

    const estado = await _obtenerEstado();
    if (!estado) return 'ninguno';

    if (estado.pagado) return 'ninguno';

    if (estado.esNuevo) return 'obligatorio';

    // Reseñador existente: si ya tomó una decisión este mes (aceptó o
    // rechazó), no lo interrumpimos de nuevo.
    if (estado.estado === 'aceptado' || estado.estado === 'rechazado') return 'ninguno';

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
    _renderModal(modo);
    mostrarModal('modal-resenador-premium');
    return false;
  }

  // ------------------------------------------------------------
  // Modal
  // ------------------------------------------------------------
  function _renderModal(modo) {
    const cerrarEl = document.getElementById('premium-modal-cerrar');
    const footerEl = document.getElementById('premium-modal-footer');
    const avisoEl = document.getElementById('premium-modal-aviso-obligatorio');

    if (modo === 'obligatorio') {
      if (cerrarEl) cerrarEl.style.display = '';
      if (avisoEl) avisoEl.style.display = 'block';
      if (footerEl) {
        footerEl.innerHTML = `
          <button type="button" class="btn-primario btn-full" id="btn-activar-premium" onclick="ResenadorPremium.activarParticipacion()">Activar participación →</button>
          <p style="font-size:12px; color:var(--gris-suave); text-align:center; margin-top:10px;">
            ¿No tenés PayPal? <a href="#" onclick="event.preventDefault(); ResenadorPremium.avisarSinPaypal();">Avisanos</a> y lo vemos juntos.
          </p>
        `;
      }
    } else {
      if (cerrarEl) cerrarEl.style.display = '';
      if (avisoEl) avisoEl.style.display = 'none';
      if (footerEl) {
        footerEl.innerHTML = `
          <button type="button" class="btn-secundario" onclick="ResenadorPremium.rechazarPorAhora()">Ahora no</button>
          <button type="button" class="btn-primario" id="btn-activar-premium" onclick="ResenadorPremium.activarParticipacion()">Sumarme por 1 USD</button>
          <p style="font-size:12px; color:var(--gris-suave); text-align:center; width:100%; margin-top:10px;">
            ¿No tenés PayPal? <a href="#" onclick="event.preventDefault(); ResenadorPremium.avisarSinPaypal();">Avisanos</a>.
          </p>
        `;
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

    const idCampaña = _idCampañaPendiente;
    _idCampañaPendiente = null;

    if (idCampaña && typeof continuarFlujoPostulacion === 'function') {
      await continuarFlujoPostulacion(idCampaña);
    }
  }

  /**
   * Limpia el estado interno del modal (campaña pendiente). Se llama tanto
   * desde el botón ✕ propio como, de forma genérica, desde cerrarModales()
   * en ui.js — así que cubre también el click en el overlay. El usuario
   * puede cerrar este modal libremente en cualquier momento; el único
   * bloqueo real (para reseñadores nuevos sin pagar) lo aplica el backend
   * cuando intentan postularse, no este modal.
   */
  function resetEstadoModal() {
    _idCampañaPendiente = null;
  }

  function avisarSinPaypal() {
    cerrarModales();
    const asunto = document.getElementById('soporte-asunto');
    const mensaje = document.getElementById('soporte-mensaje');
    if (asunto) asunto.value = 'No tengo PayPal - Reseñadores Premium';
    if (mensaje) mensaje.value = 'Hola! Quiero sumarme al Programa Reseñadores Premium pero no tengo PayPal. ¿Hay otra forma de pagar el USD 1?';
    mostrarModal('modal-soporte');
  }

  // ------------------------------------------------------------
  // Ticker del feed: reemplaza "Nuevo evento: X" por el pozo acumulado
  // ------------------------------------------------------------
  async function obtenerTextoTicker() {
    try {
      const [{ data: pozo, error: errorPozo }, { data: config }] = await Promise.all([
        supabaseClient.rpc('obtener_pozo_actual'),
        supabaseClient.from('configuracion').select('valor').eq('clave', 'RESENADOR_PREMIUM_PRECIO_USD').maybeSingle()
      ]);

      if (errorPozo || !pozo) return null;

      const precioUsd = Number(config?.valor) || 1;
      const recaudado = Number(pozo.pagos_contados || 0) * precioUsd;
      const piso = Number(pozo.monto_piso || 0);
      const monto = Math.max(piso, recaudado);

      return `🔥 Programa Reseñadores Premium — Pozo acumulado: USD ${monto.toLocaleString('es-AR')}`;
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
