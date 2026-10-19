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
