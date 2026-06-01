// ============================================================
// tropes.js — Indómita Love Club
// Componente reutilizable de selección de tropes.
// Se usa en: modal-nuevo-libro y modal-nueva-campana.
// ============================================================

const TROPES_CATEGORIAS = [
  {
    id: 'dinamica',
    nombre: 'Dinámica de relación',
    tropes: [
      'Enemigos a Amantes',
      'Rivales a Amantes',
      'Amigos a Amantes',
      'Extraños a Amantes',
      'Amigos con Beneficios',
      'Relación Secreta',
      'Fake Dating',
      'Segundas Oportunidades',
      'Primer Amor',
      'Insta Love',
      'Amor Lento (Slow Burn)',
      'Triangulo Amoroso',
      'Amor Prohibido'
    ]
  },
  {
    id: 'situacion',
    nombre: 'Situación / Contexto',
    tropes: [
      'Solo hay una Cama',
      'Proximidad Forzada',
      'Vecinos',
      'Viaje Compartido',
      'Matrimonio Forzado',
      'Amor de Verano',
      'Pueblo Pequeño',
      'Romance Online',
      'Celebridades'
    ]
  },
  {
    id: 'contraste',
    nombre: 'Contraste de personalidad / clase',
    tropes: [
      'Opuestos que se Atraen',
      'Persona seria x Persona alegre',
      'Chico malo x Chica buena',
      'Popular x Marginado',
      'Nerd x Popular',
      'Rico x Pobre',
      'Famoso x Persona común'
    ]
  },
  {
    id: 'poder',
    nombre: 'Poder / Mundo',
    tropes: [
      'Mafia Romance',
      'Jefe x Empleado',
      'Tutor x Alumno',
      'Rivales Deportivos',
      'Romance con Monstruo',
      'Obsesión Romántica',
      'Secuestro',
      'Venganza y Amor'
    ]
  },
  {
    id: 'familia',
    nombre: 'Familia / Vínculos',
    tropes: [
      'Ex de mi Hermano',
      'Ex de mi Hermana',
      'Amigo de mi Hermano',
      'Amigo de mi Hermana',
      'Padre Soltero',
      'Madre Soltera',
      'Embarazo Inesperado',
      'Found Family'
    ]
  },
  {
    id: 'identidad',
    nombre: 'Identidad / Diversidad',
    tropes: [
      'Descubrimiento Gay',
      'Descubrimiento Bisexual',
      'Descubrimiento Lésbico',
      'Salir del Closet',
      'Neurodivergencia'
    ]
  }
];


// ────────────────────────────────────────────────────────────
// RENDERIZAR SELECTOR DE TROPES
// ────────────────────────────────────────────────────────────

/**
 * Renderiza el componente de selección de tropes dentro de un contenedor.
 * Genera un acordeón por categoría, con checkboxes por trope y campo "Otros".
 *
 * @param {string} contenedorId — id del div donde se renderiza
 * @param {string} prefijo — prefijo único para los ids ('libro' o 'nc')
 * @param {string[]} seleccionados — array de tropes ya seleccionados (para edición)
 */
function renderizarSelectorTropes(contenedorId, prefijo, seleccionados = []) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="tropes-acordeon">
      ${TROPES_CATEGORIAS.map(cat => `
        <div class="tropes-categoria" id="${prefijo}-cat-${cat.id}">
          <button type="button" class="tropes-categoria-header" onclick="toggleCategoria('${prefijo}-cat-${cat.id}')">
            <span class="tropes-categoria-nombre">${cat.nombre}</span>
            <span class="tropes-categoria-contador" id="${prefijo}-contador-${cat.id}">
              ${contarSeleccionadosEnCategoria(cat.tropes, seleccionados)}
            </span>
            <span class="tropes-categoria-chevron">▸</span>
          </button>
          <div class="tropes-categoria-body" style="display:none;">
            <div class="tropes-checkboxes">
              ${cat.tropes.map(trope => `
                <label class="tropes-checkbox-label">
                  <input
                    type="checkbox"
                    class="tropes-check"
                    data-prefijo="${prefijo}"
                    data-categoria="${cat.id}"
                    value="${trope}"
                    ${seleccionados.includes(trope) ? 'checked' : ''}
                    onchange="actualizarContadorCategoria('${prefijo}', '${cat.id}', ${JSON.stringify(cat.tropes)})"
                  />
                  <span>${trope}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}

      <div class="tropes-categoria" id="${prefijo}-cat-otros">
        <button type="button" class="tropes-categoria-header" onclick="toggleCategoria('${prefijo}-cat-otros')">
          <span class="tropes-categoria-nombre">Otros</span>
          <span class="tropes-categoria-chevron">▸</span>
        </button>
        <div class="tropes-categoria-body" style="display:none;">
          <input
            type="text"
            id="${prefijo}-tropes-otros"
            class="form-input"
            placeholder="Escribí tropes adicionales separados por coma..."
          />
        </div>
      </div>
    </div>

    <div class="tropes-seleccionados-preview" id="${prefijo}-tropes-preview">
      ${generarPreviewTropes(prefijo, seleccionados)}
    </div>
  `;

  // Si había seleccionados, actualizar preview inicial
  if (seleccionados.length > 0) {
    actualizarPreviewTropes(prefijo);
  }
}


// ────────────────────────────────────────────────────────────
// TOGGLE CATEGORÍA (acordeón)
// ────────────────────────────────────────────────────────────

/**
 * Abre o cierra una categoría del acordeón.
 *
 * @param {string} catId — id del div de la categoría
 */
function toggleCategoria(catId) {
  const cat    = document.getElementById(catId);
  if (!cat) return;

  const body    = cat.querySelector('.tropes-categoria-body');
  const chevron = cat.querySelector('.tropes-categoria-chevron');
  const abierto = body.style.display !== 'none';

  body.style.display    = abierto ? 'none' : 'block';
  chevron.textContent   = abierto ? '▸' : '▾';
  cat.classList.toggle('abierta', !abierto);
}


// ────────────────────────────────────────────────────────────
// CONTADORES
// ────────────────────────────────────────────────────────────

/**
 * Cuenta cuántos tropes de una categoría están seleccionados.
 *
 * @param {string[]} tropesCategoria
 * @param {string[]} seleccionados
 * @returns {string} — '' si ninguno, o 'N seleccionados'
 */
function contarSeleccionadosEnCategoria(tropesCategoria, seleccionados) {
  const n = tropesCategoria.filter(t => seleccionados.includes(t)).length;
  return n > 0 ? `${n} seleccionado${n > 1 ? 's' : ''}` : '';
}

/**
 * Actualiza el contador de una categoría cuando cambia un checkbox.
 *
 * @param {string} prefijo
 * @param {string} catId
 * @param {string[]} tropesCategoria
 */
function actualizarContadorCategoria(prefijo, catId, tropesCategoria) {
  const contador = document.getElementById(`${prefijo}-contador-${catId}`);
  if (!contador) return;

  const checks = document.querySelectorAll(
    `.tropes-check[data-prefijo="${prefijo}"][data-categoria="${catId}"]:checked`
  );
  const n = checks.length;
  contador.textContent = n > 0 ? `${n} seleccionado${n > 1 ? 's' : ''}` : '';

  actualizarPreviewTropes(prefijo);
}


// ────────────────────────────────────────────────────────────
// PREVIEW DE TROPES SELECCIONADOS
// ────────────────────────────────────────────────────────────

/**
 * Actualiza el preview de tropes seleccionados debajo del acordeón.
 *
 * @param {string} prefijo
 */
function actualizarPreviewTropes(prefijo) {
  const preview = document.getElementById(`${prefijo}-tropes-preview`);
  if (!preview) return;

  const seleccionados = obtenerTropesSeleccionados(prefijo);
  preview.innerHTML = generarPreviewTropes(prefijo, seleccionados);
}

/**
 * Genera el HTML del preview de tropes seleccionados.
 *
 * @param {string} prefijo
 * @param {string[]} seleccionados
 * @returns {string}
 */
function generarPreviewTropes(prefijo, seleccionados) {
  if (seleccionados.length === 0) {
    return `<p class="tropes-preview-vacio">Ningún trope seleccionado todavía.</p>`;
  }
  return `
    <p class="tropes-preview-label">Seleccionados:</p>
    <div class="tropes-tags">
      ${seleccionados.map(t => `<span class="tropes-tag">${t}</span>`).join('')}
    </div>
  `;
}


// ────────────────────────────────────────────────────────────
// OBTENER VALOR FINAL
// ────────────────────────────────────────────────────────────

/**
 * Devuelve el array de tropes seleccionados (checkboxes + campo otros).
 *
 * @param {string} prefijo
 * @returns {string[]}
 */
function obtenerTropesSeleccionados(prefijo) {
  const checks = document.querySelectorAll(`.tropes-check[data-prefijo="${prefijo}"]:checked`);
  const seleccionados = Array.from(checks).map(c => c.value);

  const otrosInput = document.getElementById(`${prefijo}-tropes-otros`);
  if (otrosInput && otrosInput.value.trim()) {
    const otros = otrosInput.value.split(',').map(t => t.trim()).filter(Boolean);
    seleccionados.push(...otros);
  }

  return seleccionados;
}

/**
 * Devuelve los tropes como string separado por coma para guardar en el backend.
 *
 * @param {string} prefijo
 * @returns {string}
 */
function obtenerTropesComoTexto(prefijo) {
  return obtenerTropesSeleccionados(prefijo).join(', ');
}

/**
 * Convierte un string de tropes guardado en el backend
 * a un array para pre-cargar el selector.
 *
 * @param {string} texto — 'Enemigos a Amantes, Fake Dating, ...'
 * @returns {string[]}
 */
function tropesTextoAArray(texto) {
  if (!texto) return [];
  return texto.split(',').map(t => t.trim()).filter(Boolean);
}
