// ────────────────────────────────────────────────────────────
// COLABORACIONES CON EJEMPLARES FÍSICOS (v1)
// Todo este archivo queda inerte si el flag está apagado.
// ────────────────────────────────────────────────────────────

let _colabFisicaActivoCache = null;

async function colaboracionesFisicasActivo() {
  if (_colabFisicaActivoCache !== null) return _colabFisicaActivoCache;
  try {
    const { data, error } = await supabaseClient.rpc('colaboraciones_fisicas_activo');
    _colabFisicaActivoCache = !error && data === true;
  } catch {
    _colabFisicaActivoCache = false;
  }
  return _colabFisicaActivoCache;
}

async function abrirModalNuevaCampana() {
  mostrarModal('modal-nueva-campana');
  await initFormColaboracionFisica();
  await _chequearLimitePlanAlAbrir();
}

/**
 * Chequea el límite de plan ANTES de que el autor cargue todo el formulario
 * (portada, EPUB/PDF, sinopsis, etc.). Si no tiene lugar en su plan ni un
 * crédito de campaña individual ya pagado, oculta el formulario y muestra
 * directo el aviso con la opción de pagar — así no pierde tiempo cargando
 * todo para recién enterarse al final.
 */
async function _chequearLimitePlanAlAbrir() {
  const campos = document.getElementById('nc-campos-formulario');
  const btnSubmit = document.getElementById('nc-btn-submit');
  const limitePlan = document.getElementById('nc-limite-plan');
  const btnRevisar = document.getElementById('nc-btn-revisar-de-nuevo');

  if (btnRevisar) { btnRevisar.disabled = true; btnRevisar.textContent = 'Revisando...'; }

  let puede = true;
  try {
    const { data, error } = await supabaseClient.rpc('autor_puede_crear_campana');
    if (!error && data && data.puede === false) puede = false;
  } catch (e) {
    console.error('Error chequeando límite de plan al abrir nueva campaña:', e);
    // Si el chequeo falla, no bloqueamos: el trigger del lado del servidor
    // igual va a frenar la creación si corresponde.
  }

  if (btnRevisar) { btnRevisar.disabled = false; btnRevisar.textContent = 'Ya pagué, revisar de nuevo'; }

  if (!puede) {
    if (campos) campos.style.display = 'none';
    if (btnSubmit) btnSubmit.style.display = 'none';
    mostrarMensajeLimitePlan('límite de campañas');
    if (btnRevisar) btnRevisar.style.display = 'inline-block';
  } else {
    if (campos) campos.style.display = '';
    if (btnSubmit) btnSubmit.style.display = '';
    if (limitePlan) limitePlan.style.display = 'none';
  }
}

async function initFormColaboracionFisica() {
  const wrapTipo = document.getElementById('nc-colaboracion-fisica-wrap');
  const wrapAlcance = document.getElementById('nc-alcance-envio-wrap');
  if (!wrapTipo || !wrapAlcance) return;

  const activo = await colaboracionesFisicasActivo();
  wrapTipo.style.display = activo ? 'block' : 'none';
  wrapAlcance.style.display = 'none';
  if (!activo) return;

  document.querySelectorAll('input[name="nc-tipo-colaboracion"]').forEach(radio => {
    radio.onchange = () => {
      const val = document.querySelector('input[name="nc-tipo-colaboracion"]:checked')?.value;
      wrapAlcance.style.display = (val === 'fisico' || val === 'digital_fisico') ? 'block' : 'none';
    };
  });
}
