/**
 * Estrellas con llenado proporcional.
 * estrellasProporcionales(4.3) pinta 4 estrellas llenas y la quinta al 30 %.
 * No muestra ningún número: solo las estrellas.
 *
 * @param {number} valor  Entre 0 y 5, con decimales.
 * @param {{tamano?: string}} [opciones]  tamano = font-size CSS (por defecto '1.1em').
 * @returns {string} HTML
 */
function estrellasProporcionales(valor, opciones) {
  const v = Math.max(0, Math.min(5, Number(valor) || 0));
  const tamano = (opciones && opciones.tamano) || '1.1em';
  const SEPARACION = 0.1; // em entre estrellas (igual a letter-spacing del CSS)
  const ancho = v + SEPARACION * Math.min(Math.floor(v), 4);
  const etiqueta = String(Number(v.toFixed(2))).replace('.', ',') + ' de 5';
  return `<span class="estrellas-prop" role="img" aria-label="${etiqueta}" style="font-size:${tamano}">` +
    `<span class="estrellas-prop-fondo" aria-hidden="true">★★★★★</span>` +
    `<span class="estrellas-prop-relleno" aria-hidden="true" style="width:${ancho.toFixed(4)}em">★★★★★</span>` +
    `</span>`;
}

/**
 * Promedio/calificación con 2 decimales y coma: 4,14. null/NaN -> "—".
 */
function formatearPromedio(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === '' || isNaN(n)) return '—';
  return n.toFixed(2).replace('.', ',');
}

/**
 * Calificación de UNA reseña.
 * - Reseñas nuevas (con puntuacion_exacta): estrellas proporcionales + número "4,14".
 * - Reseñas anteriores (solo entero): se muestran como siempre, ★★★★☆.
 */
function calificacionIndividualHtml(exacta, entera, opciones) {
  if (exacta !== null && exacta !== undefined && !isNaN(Number(exacta))) {
    return estrellasProporcionales(exacta, opciones) +
      `<span class="nota-num">${formatearPromedio(exacta)}</span>`;
  }
  const n = Math.max(0, Math.min(5, parseInt(entera, 10) || 0));
  return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
}
