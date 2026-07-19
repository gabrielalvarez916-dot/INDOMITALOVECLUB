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
