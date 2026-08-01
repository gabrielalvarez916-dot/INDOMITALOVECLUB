// ============================================================
// faq-autor.js — Indómita Love Club
// Sección de Preguntas Frecuentes para autores.
// Archivo independiente: no modifica ninguna función existente.
// ============================================================

const FAQ_AUTOR_DATA = [
  {
    pregunta: '¿Por qué no se ve la portada de mi libro?',
    respuesta: 'Ya no se usa link de Google Drive: la portada se sube como archivo directo desde el formulario (acepta JPG, PNG o WEBP). Si no se ve, lo más común es que la subida no haya terminado antes de guardar, o que el archivo no tenga uno de esos tres formatos. Volvé a subirla desde "Editar libro" o "Editar campaña".'
  },
  {
    pregunta: '¿Qué formato tienen que tener el EPUB y el PDF para funcionar?',
    respuesta: 'Ya no hace falta Google Drive: subís el EPUB (.epub) y el PDF (.pdf) como archivo directo desde el formulario de la campaña. Con que respeten esa extensión alcanza, no necesitás compartir ni dar permisos en ningún lado.'
  },
  {
    pregunta: '¿Puedo editar mi libro o mi campaña después de cargarlos?',
    respuesta: 'Sí, pero son dos cosas distintas. Desde "Mi perfil → Biblioteca" editás los datos generales del libro (título, sinopsis, tropes). Desde el panel de campañas, con "Editar campaña", actualizás la sinopsis, los tropes, la portada, o reemplazás el EPUB o el PDF de esa campaña puntual — dejando el campo de archivo vacío si no querés cambiarlo.'
  },
  {
    pregunta: '¿El sistema de campañas siempre es mensual?',
    respuesta: 'Sí: toda campaña dura 30 días desde que la creás. La fecha límite ya no la elegís vos, se calcula sola (hoy + 30 días) apenas confirmás la campaña.'
  },
  {
    pregunta: '¿Qué diferencia hay entre "solo visor" y "permite descarga"?',
    respuesta: '"Solo visor" significa que el reseñador lee el libro dentro de la plataforma, sin poder descargarlo a su dispositivo — te da más control sobre la copia. "Permite descarga" deja que el reseñador se baje el archivo, lo que puede resultar más atractivo para conseguir más postulantes, pero perdés ese control.'
  },
  {
    pregunta: '¿Puedo tener más de una campaña activa al mismo tiempo?',
    respuesta: 'Depende de tu plan: Free permite 1 campaña por mes, Basic hasta 3, y Premium hasta 5.'
  },
  {
    pregunta: '¿Puedo cancelar una campaña ya creada? ¿Qué pasa con las postulaciones?',
    respuesta: 'Podés cancelarla solo dentro de los primeros 5 días desde que la creaste — pasado ese plazo, el botón de cancelar ya no aparece. Además, tenés un máximo de 3 cancelaciones por mes. Al cancelarla, la campaña deja de estar activa y las postulaciones pendientes quedan cerradas.'
  },
  {
    pregunta: '¿Dónde veo las reseñas que me entregaron?',
    respuesta: 'Desde tu panel, en la pestaña "Campañas activas", cada campaña tiene un botón "Ver reseñas" donde aparecen todas las que ya te entregaron, con sus links a cada plataforma.'
  },
  {
    pregunta: '¿Para qué sirve calificar a los reseñadores?',
    respuesta: 'Tu calificación con estrellas alimenta el ranking del reseñador dentro de la comunidad. Es importante que la completes: ayuda a que los autores puedan elegir mejor a quién aprobar en futuras campañas, y reconoce a los reseñadores que cumplen bien.'
  },
  {
    pregunta: '¿Qué diferencia hay entre los planes Free, Basic y Premium?',
    respuesta: 'Cuanto más alto el plan, más rápido podés hacer crecer tu comunidad de lectoras. Free te deja probar la plataforma con 1 campaña por mes y hasta 10 reseñadores — ideal para tu primer lanzamiento. Basic ($20.000/mes) te da 3 campañas por mes y hasta 50 reseñadores, para autoras que publican seguido o quieren más alcance por libro. Premium ($40.000/mes) te da hasta 5 campañas por mes y 100 reseñadores, pensado para quienes quieren maximizar la visibilidad de cada lanzamiento y mantener varias campañas corriendo en paralelo.'
  },
    {
    pregunta: '¿Cómo hago el pago para cambiar de plan?',
    respuesta: 'Al elegir un plan, te preguntamos si pagás desde Argentina (Mercado Pago) o desde el exterior (PayPal). Te abrimos el link de pago en una pestaña nueva para que completes la suscripción ahí.'
  },
  {
    pregunta: '¿Cómo confirmo mi pago?',
    respuesta: 'No hace falta que hagas nada más: en cuanto Mercado Pago o PayPal confirman el pago, tu plan se activa automáticamente en la plataforma.'
  },
  {
    pregunta: '¿Cuánto tarda en activarse mi plan después de pagar?',
    respuesta: 'Es automático. Apenas se aprueba el pago del lado de Mercado Pago o PayPal, tu cuenta pasa a estar activa en el plan elegido — no hay revisión manual de por medio.'
  },
  {
    pregunta: '¿Qué son los cupos de regalo por reconexión?',
    respuesta: 'Si volviste a la plataforma después de un tiempo inactiva/o, puede que tengas reseñadores de regalo 🎁 disponibles: se suman al límite de tu plan en tu próxima campaña. Si tenés cupos disponibles, te avisamos al momento de crear la campaña.'
  }
];


/**
 * Renderiza la sección de FAQ para autores.
 * Se llama automáticamente cuando se muestra la sección #seccion-faq-autor.
 */
function cargarFaqAutor() {
  const contenedor = document.getElementById('faq-autor-contenedor');
  if (!contenedor) return;

  contenedor.innerHTML = FAQ_AUTOR_DATA.map((item, i) => `
    <div class="faq-item" id="faq-item-${i}">
      <button type="button" class="faq-item-header" onclick="toggleFaqItem(${i})">
        <span class="faq-item-pregunta">${item.pregunta}</span>
        <span class="faq-item-chevron" id="faq-chevron-${i}">▾</span>
      </button>
      <div class="faq-item-body" id="faq-body-${i}">
        <p class="faq-item-respuesta">${item.respuesta}</p>
      </div>
    </div>
  `).join('');

  if (typeof registrarAccionEventoSiCorresponde === 'function') {
    registrarAccionEventoSiCorresponde('revisar_faq_autores');
  }
}

/**
 * Abre/cierra una pregunta del acordeón de FAQ.
 * @param {number} indice
 */
function toggleFaqItem(indice) {
  const item = document.getElementById(`faq-item-${indice}`);
  if (!item) return;
  item.classList.toggle('abierta');
}
