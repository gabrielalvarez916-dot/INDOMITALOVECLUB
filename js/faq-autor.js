// ============================================================
// faq-autor.js — Indómita Love Club
// Sección de Preguntas Frecuentes para autores.
// Archivo independiente: no modifica ninguna función existente.
// ============================================================

const FAQ_AUTOR_DATA = [
  {
    pregunta: '¿Por qué no se ve la portada de mi libro?',
    respuesta: 'Casi siempre es un tema de permisos en Google Drive. Cuando subís el link de portada (o de EPUB/PDF), el archivo tiene que estar compartido como "Cualquier persona con el enlace puede ver". Para revisarlo: abrí el archivo en Drive → botón "Compartir" → en "Acceso general" elegí "Cualquier usuario con el enlace" → Lector. Si lo tenías en "Restringido", por eso no carga.'
  },
  {
    pregunta: '¿Qué formato tienen que tener el EPUB y el PDF para funcionar?',
    respuesta: 'Tienen que ser links de Google Drive con el archivo compartido públicamente (mismo permiso que la portada: "Cualquier usuario con el enlace"). Subís el archivo a tu Drive, lo compartís así, y pegás ese link al crear tu campaña.'
  },
  {
    pregunta: '¿Puedo editar mi libro después de cargarlo?',
    respuesta: 'Sí, desde tu biblioteca en "Mi perfil" podés modificar los datos de cualquier libro que hayas agregado.'
  },
  {
    pregunta: '¿El sistema de campañas siempre es mensual?',
    respuesta: 'Sí, todas las campañas duran un mes. Por eso la fecha límite que elijas al crear una campaña no puede superar el mes en curso.'
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
    respuesta: 'Sí, podés cancelarla desde tu panel en cualquier momento. Al cancelarla, la campaña deja de estar activa y las postulaciones pendientes quedan cerradas.'
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
    respuesta: 'Al elegir un plan, te preguntamos si pagás desde Argentina (Mercado Pago) o desde el exterior (Stripe). Te abrimos el link de pago en una pestaña nueva para que completes la operación ahí.'
  },
  {
    pregunta: 'Ya pagué, ¿cómo confirmo mi pago?',
    respuesta: 'Después de pagar, te va a aparecer un formulario para subir tu comprobante (un link a la captura o factura). Sin ese paso no podemos confirmar tu pago.'
  },
  {
    pregunta: '¿Cuánto tarda en activarse mi plan después de pagar?',
    respuesta: 'La verificación es manual: revisamos cada comprobante nosotros mismos, así que puede demorar hasta 24 horas hábiles. Una vez aprobado, te llega un mail confirmando la activación.'
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
