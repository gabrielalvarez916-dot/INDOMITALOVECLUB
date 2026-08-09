// ============================================================
// wizard-onboarding.js — Indómita Love Club
// Wizard de datos obligatorios que se muestra ANTES del tutorial
// de bienvenida, reemplazando el viejo gate de un solo formulario
// (alias + país + ciudad).
//
// Reseñador: paso 1 (alias/país/ciudad) → paso 2 (género/subgénero/
//            tropes favoritos) → paso 3 (links, mínimo 1)
// Autor / Editorial: paso 1 (alias/país/ciudad) → paso 2 (links,
//            mínimo 1) — género/subgénero/trope quedan afuera porque
//            ya son obligatorios por campaña.
//
// El estado se guarda en la base en cada paso (no en localStorage),
// así que si alguien corta a mitad de camino, la próxima vez que
// entra retoma en el primer paso que le falte, no arranca de cero.
// ============================================================

// ────────────────────────────────────────────────────────────
// FECHA DE CORTE — el wizard nuevo (con género/tropes obligatorios
// para reseñador y link obligatorio para todos) SOLO aplica a cuentas
// creadas a partir de esta fecha. Los usuarios que ya existían quedan
// afuera por ahora; eso se resuelve aparte, no acá.
// ────────────────────────────────────────────────────────────
const _WIZARD_FECHA_CORTE = new Date('2026-08-09T00:00:00Z');

function _esCuentaNueva(usuario) {
  if (!usuario.fecha_registro) return false; // sin fecha registrada = cuenta vieja, no la tocamos
  return new Date(usuario.fecha_registro) >= _WIZARD_FECHA_CORTE;
}

function _pasosWizardSegunRol(rol) {
  return rol === 'reseñador' ? ['datos', 'generos', 'links'] : ['datos', 'links'];
}

async function _pasoWizardCompleto(paso, usuario) {
  switch (paso) {
    case 'datos':
      return !!(usuario.alias && usuario.pais && usuario.ciudad);

    case 'generos': {
      const [{ data: generos, error: errGeneros }, { data: tropes, error: errTropes }] = await Promise.all([
        supabaseClient.from('usuario_generos').select('id_genero').eq('id_usuario', usuario.id).limit(1),
        supabaseClient.from('usuario_tropes').select('id_trope').eq('id_usuario', usuario.id).limit(1)
      ]);
      if (errGeneros || errTropes) {
        console.error('Error chequeando paso género/tropes del wizard:', errGeneros || errTropes);
        return false;
      }
      return !!(generos && generos.length && tropes && tropes.length);
    }

    case 'links':
      return !!(usuario.instagram || usuario.tiktok || usuario.amazon);

    default:
      return true;
  }
}

/**
 * Devuelve el primer paso (string) que le falta completar al usuario,
 * o null si ya completó todos los pasos que le corresponden por rol.
 */
async function obtenerPasoWizardPendiente(usuario) {
  if (!usuario) return 'datos';
  if (!_esCuentaNueva(usuario)) return null; // usuario existente: no lo tocamos por ahora
  const pasos = _pasosWizardSegunRol(usuario.rol);
  for (const paso of pasos) {
    if (!(await _pasoWizardCompleto(paso, usuario))) return paso;
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// ESTADO EN MEMORIA DEL PASO "GENEROS" (multi-género, propio del
// wizard — no comparte estado con el selector de "Editar perfil"
// en perfil.js para evitar pisarse si ambos existieran en el DOM).
// ────────────────────────────────────────────────────────────
let _wizGenerosSel = [];
let _wizSubgenerosSel = [];
let _wizTropesSel = []; // [{id, nombre, id_genero}]
let _wizGenerosCatalogo = [];
let _wizDebounceBusquedaTropes;

async function _wizCargarPasoGeneros(usuario) {
  const [{ data: generosRows }, { data: subgenerosRows }, { data: tropesRows }] = await Promise.all([
    supabaseClient.from('usuario_generos').select('id_genero').eq('id_usuario', usuario.id),
    supabaseClient.from('usuario_subgeneros').select('id_subgenero').eq('id_usuario', usuario.id),
    supabaseClient.from('usuario_tropes').select('tropes ( id, nombre, id_genero )').eq('id_usuario', usuario.id)
  ]);

  _wizGenerosSel = (generosRows || []).map(r => r.id_genero);
  _wizSubgenerosSel = (subgenerosRows || []).map(r => r.id_subgenero);
  _wizTropesSel = (tropesRows || []).map(r => r.tropes).filter(Boolean);
  _wizGenerosCatalogo = await _cargarGeneros();

  await _wizRenderGeneros();
  _wizRenderTropesBuscador();
}

async function _wizRenderGeneros() {
  const cont = document.getElementById('wiz-generos-checkboxes');
  if (!cont) return;
  cont.innerHTML = _wizGenerosCatalogo.map(g => `
    <label class="tropes-checkbox-label">
      <input type="checkbox" value="${g.id}" data-tiene-subgenero="${g.tiene_subgenero}"
        ${_wizGenerosSel.includes(g.id) ? 'checked' : ''}
        onchange="_wizToggleGenero(this)" />
      ${g.nombre}
    </label>
  `).join('');
  await _wizRenderSubgeneros();
}

async function _wizToggleGenero(checkbox) {
  const idGenero = parseInt(checkbox.value, 10);
  if (checkbox.checked) {
    if (!_wizGenerosSel.includes(idGenero)) _wizGenerosSel.push(idGenero);
  } else {
    _wizGenerosSel = _wizGenerosSel.filter(id => id !== idGenero);
    const subs = await _cargarSubgeneros(idGenero);
    const idsSubsDeEsteGenero = subs.map(s => s.id);
    _wizSubgenerosSel = _wizSubgenerosSel.filter(id => !idsSubsDeEsteGenero.includes(id));
    _wizTropesSel = _wizTropesSel.filter(t => t.id_genero !== idGenero);
    _wizRenderTropesChips();
  }
  await _wizRenderSubgeneros();
}

async function _wizRenderSubgeneros() {
  const cont = document.getElementById('wiz-subgeneros-contenedor');
  if (!cont) return;

  const generosConSubgenero = _wizGenerosCatalogo.filter(g => g.tiene_subgenero && _wizGenerosSel.includes(g.id));
  if (generosConSubgenero.length === 0) {
    cont.innerHTML = '';
    return;
  }

  const bloques = await Promise.all(generosConSubgenero.map(async genero => {
    const subs = await _cargarSubgeneros(genero.id);
    return `
      <div class="form-grupo" style="margin-top:10px;">
        <label class="form-label" style="font-size:12px;">Subgéneros de ${genero.nombre}</label>
        <div class="tropes-checkboxes">
          ${subs.map(s => `
            <label class="tropes-checkbox-label">
              <input type="checkbox" value="${s.id}"
                ${_wizSubgenerosSel.includes(s.id) ? 'checked' : ''}
                onchange="_wizToggleSubgenero(this)" />
              ${s.nombre}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }));
  cont.innerHTML = bloques.join('');
}

function _wizToggleSubgenero(checkbox) {
  const idSubgenero = parseInt(checkbox.value, 10);
  if (checkbox.checked) {
    if (!_wizSubgenerosSel.includes(idSubgenero)) _wizSubgenerosSel.push(idSubgenero);
  } else {
    _wizSubgenerosSel = _wizSubgenerosSel.filter(id => id !== idSubgenero);
  }
}

function _wizRenderTropesBuscador() {
  const cont = document.getElementById('wiz-tropes-contenedor');
  if (!cont) return;
  cont.innerHTML = `
    <div class="tropes-buscador-wrapper">
      <input
        type="text"
        id="wiz-buscador-tropes"
        class="form-input"
        placeholder="Buscá un trope..."
        autocomplete="off"
        oninput="_wizBuscarTropes()"
        onfocus="_wizBuscarTropes()"
      />
      <div class="tropes-dropdown" id="wiz-dropdown-tropes" style="display:none;"></div>
    </div>
    <div class="tropes-seleccionados-preview" id="wiz-tropes-preview"></div>
  `;
  _wizRenderTropesChips();
}

async function _wizBuscarTropes() {
  clearTimeout(_wizDebounceBusquedaTropes);
  _wizDebounceBusquedaTropes = setTimeout(async () => {
    const input = document.getElementById('wiz-buscador-tropes');
    const dropdown = document.getElementById('wiz-dropdown-tropes');
    if (!input || !dropdown) return;

    if (_wizGenerosSel.length === 0) {
      dropdown.innerHTML = `<div class="tropes-dropdown-vacio">Elegí al menos un género para buscar tropes.</div>`;
      dropdown.style.display = 'block';
      return;
    }

    const resultados = await _buscarTropesPorGeneros(_wizGenerosSel, input.value);
    const idsYaSeleccionados = _wizTropesSel.map(t => t.id);
    const disponibles = resultados.filter(t => !idsYaSeleccionados.includes(t.id));

    dropdown.innerHTML = disponibles.length === 0
      ? `<div class="tropes-dropdown-vacio">Sin resultados</div>`
      : disponibles.map(t => `
          <div class="tropes-dropdown-item" onclick="_wizSeleccionarTrope(${t.id}, '${t.nombre.replace(/'/g, "\\'")}', ${t.id_genero})">
            ${t.nombre}
          </div>
        `).join('');
    dropdown.style.display = 'block';
  }, 250);
}

function _wizSeleccionarTrope(id, nombre, idGenero) {
  if (!_wizTropesSel.some(t => t.id === id)) {
    _wizTropesSel.push({ id, nombre, id_genero: idGenero });
  }
  document.getElementById('wiz-buscador-tropes').value = '';
  document.getElementById('wiz-dropdown-tropes').style.display = 'none';
  _wizRenderTropesChips();
}

function _wizQuitarTrope(id) {
  _wizTropesSel = _wizTropesSel.filter(t => t.id !== id);
  _wizRenderTropesChips();
}

function _wizRenderTropesChips() {
  const preview = document.getElementById('wiz-tropes-preview');
  if (!preview) return;
  if (_wizTropesSel.length === 0) {
    preview.innerHTML = `<p class="tropes-preview-vacio">Ningún trope seleccionado todavía.</p>`;
    return;
  }
  preview.innerHTML = `
    <p class="tropes-preview-label">Seleccionados:</p>
    <div class="tropes-tags">
      ${_wizTropesSel.map(t => `
        <span class="tropes-tag">
          ${t.nombre}
          <button type="button" class="tropes-tag-quitar" onclick="_wizQuitarTrope(${t.id})">×</button>
        </span>
      `).join('')}
    </div>
  `;
}

// ────────────────────────────────────────────────────────────
// OVERLAY / NAVEGACIÓN DEL WIZARD
// ────────────────────────────────────────────────────────────

let _wizUsuarioActual = null;
let _wizPasosActuales = [];
let _wizIndicePasoActual = 0;

const _WIZ_TITULOS = {
  datos:    'Contanos quién sos',
  generos:  'Tus géneros y tropes favoritos',
  links:    'Sumá al menos un link'
};

async function mostrarGatePerfilObligatorio(usuario) {
  _wizUsuarioActual = { ...usuario };
  _wizPasosActuales = _pasosWizardSegunRol(usuario.rol);

  const pasoPendiente = await obtenerPasoWizardPendiente(_wizUsuarioActual);
  if (pasoPendiente === null) {
    _wizFinalizar(_wizUsuarioActual);
    return;
  }
  _wizIndicePasoActual = _wizPasosActuales.indexOf(pasoPendiente);

  _wizMontarOverlay();
  await _wizRenderPasoActual();
}

function _wizMontarOverlay() {
  let overlay = document.getElementById('wizard-onboarding-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'wizard-onboarding-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center;
      z-index:99999; padding:20px;
    `;
    document.body.appendChild(overlay);
  }
  document.body.style.overflow = 'hidden';
}

function _wizProgresoHtml() {
  return `
    <div style="display:flex; gap:6px; margin-bottom:16px;">
      ${_wizPasosActuales.map((_, i) => `
        <div style="flex:1; height:4px; border-radius:2px; background:${i <= _wizIndicePasoActual ? '#7B1C2E' : '#eee'};"></div>
      `).join('')}
    </div>
    <p style="font-size:12px; color:#999; margin-bottom:4px;">Paso ${_wizIndicePasoActual + 1} de ${_wizPasosActuales.length}</p>
  `;
}

async function _wizRenderPasoActual() {
  const overlay = document.getElementById('wizard-onboarding-overlay');
  if (!overlay) return;
  const paso = _wizPasosActuales[_wizIndicePasoActual];

  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:28px; max-width:460px; width:100%; max-height:90vh; overflow-y:auto;">
      ${_wizProgresoHtml()}
      <h2 style="margin-bottom:8px;">${_WIZ_TITULOS[paso]}</h2>
      <p style="font-size:13px; color:#777; margin-bottom:16px;">Necesitamos esto antes de que entres a la plataforma.</p>
      <form id="form-wizard-paso">
        <div id="wizard-paso-contenido"></div>
        <div id="wizard-paso-error" class="mensaje-error" style="display:none;"></div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          ${_wizIndicePasoActual > 0 ? `<button type="button" class="btn-secundario" id="wizard-btn-atras">Atrás</button>` : ''}
          <button type="submit" class="btn-primario btn-full">${_wizIndicePasoActual === _wizPasosActuales.length - 1 ? 'Finalizar' : 'Continuar'}</button>
        </div>
      </form>
    </div>
  `;

  const contenido = document.getElementById('wizard-paso-contenido');
  if (paso === 'datos') {
    contenido.innerHTML = `
      <div class="form-grupo">
        <label class="form-label">Alias</label>
        <input type="text" id="wiz-alias" class="form-input" value="${_wizUsuarioActual.alias || ''}" required />
      </div>
      <div class="form-grupo">
        <label class="form-label">País</label>
        <input type="text" id="wiz-pais" class="form-input" value="${_wizUsuarioActual.pais || ''}" required />
      </div>
      <div class="form-grupo">
        <label class="form-label">Ciudad</label>
        <input type="text" id="wiz-ciudad" class="form-input" value="${_wizUsuarioActual.ciudad || ''}" required />
      </div>
    `;
  } else if (paso === 'generos') {
    contenido.innerHTML = `
      <div class="form-grupo">
        <label class="form-label">Géneros favoritos</label>
        <div id="wiz-generos-checkboxes" class="tropes-checkboxes"></div>
      </div>
      <div id="wiz-subgeneros-contenedor"></div>
      <div class="form-grupo" style="margin-top:10px;">
        <label class="form-label">Tropes favoritos</label>
        <div id="wiz-tropes-contenedor"></div>
      </div>
    `;
    await _wizCargarPasoGeneros(_wizUsuarioActual);
  } else if (paso === 'links') {
    contenido.innerHTML = `
      <p style="font-size:12px; color:#999; margin-bottom:10px;">No hace falta cargar los tres, con uno alcanza.</p>
      <div class="form-grupo">
        <label class="form-label">Instagram</label>
        <input type="text" id="wiz-instagram" class="form-input" value="${_wizUsuarioActual.instagram || ''}" />
      </div>
      <div class="form-grupo">
        <label class="form-label">TikTok</label>
        <input type="text" id="wiz-tiktok" class="form-input" value="${_wizUsuarioActual.tiktok || ''}" />
      </div>
      <div class="form-grupo">
        <label class="form-label">Amazon</label>
        <input type="text" id="wiz-amazon" class="form-input" value="${_wizUsuarioActual.amazon || ''}" />
      </div>
    `;
  }

  document.getElementById('form-wizard-paso').onsubmit = (e) => _wizGuardarPasoActual(e);
  const btnAtras = document.getElementById('wizard-btn-atras');
  if (btnAtras) btnAtras.onclick = () => _wizIrAPasoAnterior();
}

function _wizIrAPasoAnterior() {
  if (_wizIndicePasoActual === 0) return;
  _wizIndicePasoActual -= 1;
  _wizRenderPasoActual();
}

function _wizMostrarError(msg) {
  const el = document.getElementById('wizard-paso-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

async function _wizGuardarPasoActual(event) {
  event.preventDefault();
  const el = document.getElementById('wizard-paso-error');
  if (el) el.style.display = 'none';

  const paso = _wizPasosActuales[_wizIndicePasoActual];

  if (paso === 'datos') {
    const alias  = document.getElementById('wiz-alias')?.value.trim();
    const pais   = document.getElementById('wiz-pais')?.value.trim();
    const ciudad = document.getElementById('wiz-ciudad')?.value.trim();

    if (!alias || !pais || !ciudad) {
      _wizMostrarError('Todos los campos son obligatorios.');
      return;
    }

    const { data, error } = await supabaseClient
      .from('usuarios')
      .update({ alias, pais, ciudad })
      .eq('id', _wizUsuarioActual.id)
      .select()
      .single();

    if (error) { _wizMostrarError(error.message); return; }
    _wizUsuarioActual = data;

  } else if (paso === 'generos') {
    if (_wizGenerosSel.length === 0) {
      _wizMostrarError('Elegí al menos un género favorito.');
      return;
    }
    if (_wizTropesSel.length === 0) {
      _wizMostrarError('Elegí al menos un trope favorito.');
      return;
    }

    await supabaseClient.from('usuario_generos').delete().eq('id_usuario', _wizUsuarioActual.id);
    await supabaseClient.from('usuario_subgeneros').delete().eq('id_usuario', _wizUsuarioActual.id);
    await supabaseClient.from('usuario_tropes').delete().eq('id_usuario', _wizUsuarioActual.id);

    const { error: errG } = await supabaseClient.from('usuario_generos').insert(
      _wizGenerosSel.map(idGenero => ({ id_usuario: _wizUsuarioActual.id, id_genero: idGenero }))
    );
    if (errG) { _wizMostrarError(errG.message); return; }

    if (_wizSubgenerosSel.length > 0) {
      const { error: errS } = await supabaseClient.from('usuario_subgeneros').insert(
        _wizSubgenerosSel.map(idSubgenero => ({ id_usuario: _wizUsuarioActual.id, id_subgenero: idSubgenero }))
      );
      if (errS) { _wizMostrarError(errS.message); return; }
    }

    const { error: errT } = await supabaseClient.from('usuario_tropes').insert(
      _wizTropesSel.map(t => ({ id_usuario: _wizUsuarioActual.id, id_trope: t.id }))
    );
    if (errT) { _wizMostrarError(errT.message); return; }

  } else if (paso === 'links') {
    const instagram = document.getElementById('wiz-instagram')?.value.trim();
    const tiktok    = document.getElementById('wiz-tiktok')?.value.trim();
    const amazon    = document.getElementById('wiz-amazon')?.value.trim();

    if (!instagram && !tiktok && !amazon) {
      _wizMostrarError('Cargá al menos un link.');
      return;
    }

    const { data, error } = await supabaseClient
      .from('usuarios')
      .update({ instagram, tiktok, amazon })
      .eq('id', _wizUsuarioActual.id)
      .select()
      .single();

    if (error) { _wizMostrarError(error.message); return; }
    _wizUsuarioActual = data;
  }

  if (_wizIndicePasoActual === _wizPasosActuales.length - 1) {
    _wizFinalizar(_wizUsuarioActual);
  } else {
    _wizIndicePasoActual += 1;
    await _wizRenderPasoActual();
  }
}

function _wizFinalizar(usuario) {
  const overlay = document.getElementById('wizard-onboarding-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';

  Sesion.guardar(usuario);
  verificarModalActualizacion();
  redirigirSegunRol(usuario);
  mostrarToast(`¡Bienvenida, ${usuario.alias}!`, 'ok');
  if (typeof inicializarTutorialBienvenida === 'function') inicializarTutorialBienvenida(usuario);
}

// ============================================================
// AVISO DE PERFIL INCOMPLETO — solo para usuarios EXISTENTES
// (cuentas anteriores a _WIZARD_FECHA_CORTE, que el wizard de arriba
// no gatea). No bloquea nada: es un modal informativo que explica
// qué le falta y por qué, con un botón que abre el modal de
// "Editar perfil" de siempre. El usuario completa ahí, no en un wizard
// aparte. Se puede cerrar y seguir usando la plataforma normal.
// Se vuelve a mostrar en el próximo login mientras siga incompleto.
// ============================================================

async function _faltantesPerfilExistente(usuario) {
  const faltan = [];

  if (!(usuario.alias && usuario.pais && usuario.ciudad)) {
    faltan.push('Alias, país y ciudad');
  }

  if (usuario.rol === 'reseñador') {
    const generoTropeOk = await _pasoWizardCompleto('generos', usuario);
    if (!generoTropeOk) faltan.push('Géneros y tropes favoritos (esto es lo que usa el sistema de coincidencia para armar tus matches)');
  }

  if (!(usuario.instagram || usuario.tiktok || usuario.amazon)) {
    faltan.push('Al menos un link (Instagram, TikTok o Amazon)');
  }

  return faltan;
}

async function verificarAvisoPerfilIncompleto(usuario) {
  if (!usuario || usuario.rol === 'admin') return;
  if (_esCuentaNueva(usuario)) return; // a las cuentas nuevas ya las cubrió el wizard bloqueante

  const faltantes = await _faltantesPerfilExistente(usuario);
  if (faltantes.length === 0) return;

  _mostrarAvisoPerfilIncompleto(faltantes);
}

function _mostrarAvisoPerfilIncompleto(faltantes) {
  let overlay = document.getElementById('aviso-perfil-incompleto-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'aviso-perfil-incompleto-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center;
      z-index:99998; padding:20px;
    `;
    overlay.onclick = (e) => { if (e.target === overlay) _cerrarAvisoPerfilIncompleto(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:28px; max-width:440px; width:100%; max-height:90vh; overflow-y:auto; position:relative;">
      <button type="button" onclick="_cerrarAvisoPerfilIncompleto()" aria-label="Cerrar"
        style="position:absolute; top:14px; right:14px; background:none; border:none; font-size:20px; cursor:pointer; color:#999;">×</button>
      <h2 style="margin-bottom:8px;">Completá tu perfil</h2>
      <p style="font-size:13px; color:#777; margin-bottom:14px;">Te falta cargar esto para que tu perfil funcione bien en la plataforma:</p>
      <ul style="margin:0 0 18px 18px; padding:0; font-size:14px; color:#333; line-height:1.6;">
        ${faltantes.map(f => `<li>${f}</li>`).join('')}
      </ul>
      <button type="button" class="btn-primario btn-full" onclick="_irACompletarPerfilExistente()">Completar mi perfil</button>
    </div>
  `;
}

function _cerrarAvisoPerfilIncompleto() {
  const overlay = document.getElementById('aviso-perfil-incompleto-overlay');
  if (overlay) overlay.remove();
}

function _irACompletarPerfilExistente() {
  _cerrarAvisoPerfilIncompleto();
  mostrarModal('modal-editar-perfil');
  if (typeof cargarFormularioEdicionPerfil === 'function') cargarFormularioEdicionPerfil();
}
