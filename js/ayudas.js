/* ════════════════════════════════════════════════════════════
   AYUDAS — textos de ayuda para los pasos largos
   Todos los textos viven acá. Para cambiar una frase, se edita
   este archivo (no hace falta tocar app.html).

   Cada entrada puede tener:
     corto → línea gris debajo del campo
     largo → contenido del ícono "?" (HTML simple)
     titulo → título del panel del "?"
   ════════════════════════════════════════════════════════════ */

const AYUDAS_RESENA = {

  /* ── Encabezados de cada paso ── */
  encabezado1: {
    titulo: 'Tu reseña interna',
    texto: 'Contale a la plataforma qué te pareció el libro. Esto lo ve el autor dentro de Indómita, todavía no se publica en ningún lado. Te lleva un par de minutos. 💛'
  },
  encabezado2: {
    titulo: 'Tu reseña pública',
    texto: 'Ahora pegá el link de tu reseña ya publicada. Si todavía no la subiste, hacelo primero en la red que prefieras y volvé acá a pegar el link.'
  },

  /* ── Paso 1 ── */
  estrellas: {
    corto: 'Tu nota general del libro. Es obligatoria y suma a la puntuación del libro.',
    titulo: '¿Cómo califico?',
    largo: '1 ★ No me gustó · 2 ★ Me costó · 3 ★ Estuvo bien · 4 ★ Me gustó mucho · 5 ★ Me encantó.<br><br>Tu nota se suma a la puntuación general del libro, así que calificá con sinceridad: a los autores les sirve más una opinión honesta que un 5 automático.'
  },
  moods: {
    corto: 'Elegí cómo se sintió leerlo. Podés marcar varios.',
    titulo: '¿Para qué sirven los moods?',
    largo: 'Ayudan a que otros lectores encuentren libros según su estado de ánimo. Pensá en las sensaciones que te dejó, no en el género.'
  },
  frase1: {
    corto: 'Copiá textual una frase del libro que te haya marcado.',
    titulo: '¿Cómo elijo la frase?',
    largo: 'Puede ser corta, de un diálogo o de una descripción. No hace falta que sea famosa: elegí la que te hizo frenar y releer. Copiala tal cual está escrita en el libro.'
  },
  frase2: { corto: 'Opcional. Si tenés otra que te gustó, sumala.' },
  frase3: { corto: 'Opcional. Si tenés otra que te gustó, sumala.' },
  extra: {
    corto: 'Son decorativos: no cambian tu ranking. Completá los que quieras.',
    titulo: '¿Qué mide cada uno?',
    largo:
      '🌶️ <strong>Spice:</strong> qué tan picantes son las escenas románticas.<br>' +
      '🎭 <strong>Drama:</strong> cuánta carga emocional o conflicto tiene la historia.<br>' +
      '✒️ <strong>Estilo de escritura:</strong> qué tanto te gustó cómo escribe el autor.<br>' +
      '🗡️ <strong>Tensión:</strong> cuánto suspenso o intriga te generó.<br>' +
      '⏱️ <strong>Ritmo:</strong> qué tan ágil se te hizo (más cerca de 5 = no podías soltarlo).<br>' +
      '🗺️ <strong>Creación de mundos:</strong> qué tan bien está construido el universo de la historia.'
  },

  /* ── Paso 2 ── */
  linkGeneral: {
    titulo: '¿Qué link tengo que pegar?',
    largo:
      'Tiene que ser el link <strong>de tu reseña publicada</strong>, no de tu perfil ni de la página del libro.<br>' +
      '✅ Bien: un link a tu post, reel o reseña.<br>' +
      '❌ Mal: instagram.com/tuusuario o la página general del libro.<br>' +
      'Si el link parece ser de tu perfil, el sistema te va a avisar antes de enviar.' +
      '<hr class="ayuda-separador">' +
      '¡Hola! 👋 Para cargar tu reseña necesitamos el <strong>link directo a tu publicación</strong> (no el de tu perfil). Así lo conseguís en cada plataforma:<br><br>' +
      '📸 <strong>INSTAGRAM</strong><br>' +
      'Sirve el link de un posteo, reel, video largo o story: instagram.com/p/… | /reel/… | /tv/… | /stories/…<br>' +
      'Dónde: abrí tu publicación → avión de papel o (···) → "Copiar enlace".<br>' +
      'No sirve: tu perfil, ni links con tu usuario antes de /reel/ o /p/.<br><br>' +
      '🎵 <strong>TIKTOK</strong><br>' +
      'Sirve: vt.tiktok.com/… | vm.tiktok.com/… | tiktok.com/@usuario/video/… | tiktok.com/@usuario/photo/…<br>' +
      'Dónde: abrí tu video → Compartir → "Copiar enlace". Si el link empieza con tiktok.com/t/, abrilo en el navegador y copiá la dirección completa.<br>' +
      'No sirve: tu perfil.<br><br>' +
      '📦 <strong>AMAZON</strong><br>' +
      'Sirve: el link a tu reseña, que contiene "customer-reviews" o "/review/".<br>' +
      'Dónde: en la página del libro, buscá tu reseña, hacé clic en su fecha (o en "Enlace permanente") y copiá la dirección del navegador.<br>' +
      'No sirve: la página del libro ni links acortados (amzn.to).<br><br>' +
      '📚 <strong>GOODREADS</strong><br>' +
      'Sirve: goodreads.com/review/show/…<br>' +
      'Dónde: abrí tu reseña haciendo clic en su fecha y copiá la dirección del navegador.<br>' +
      'No sirve: tu perfil ni la página del libro.<br><br>' +
      'Alcanza con cargar el link de una de las plataformas que pide la campaña. Tu reseña tiene que estar publicada y visible. Si te sigue dando error, mandanos captura del link y lo revisamos. 💛'
  },
  Instagram: {
    corto: 'Link directo a tu post o reel, no a tu perfil.',
    titulo: '¿Cómo copio el link?',
    largo: 'Sirve el link de un posteo, reel, video largo o story (instagram.com/p/… | /reel/… | /tv/… | /stories/…).<br>Abrí tu publicación → avión de papel o (···) → "Copiar enlace".<br>No sirve: tu perfil, ni links con tu usuario antes de /reel/ o /p/.'
  },
  TikTok: {
    corto: 'Link al video de tu reseña, no a tu perfil.',
    titulo: '¿Cómo copio el link?',
    largo: 'Abrí tu video → Compartir → "Copiar enlace".<br>Si el link empieza con tiktok.com/t/, abrilo en el navegador y copiá la dirección completa.<br>No sirve: tu perfil.'
  },
  Amazon: {
    corto: 'Link a tu reseña publicada, no a la página del libro.',
    titulo: '¿Cómo consigo el link?',
    largo: 'Sirve el link a tu reseña, que contiene "customer-reviews" o "/review/".<br>En la página del libro, buscá tu reseña, hacé clic en su fecha (o en "Enlace permanente") y copiá la dirección del navegador.<br>No sirve: la página del libro ni links acortados (amzn.to).'
  },
  Goodreads: {
    corto: 'Link a tu reseña, no a la página del libro.',
    titulo: '¿Cómo consigo el link?',
    largo: 'Sirve: goodreads.com/review/show/…<br>Abrí tu reseña haciendo clic en su fecha y copiá la dirección del navegador.<br>No sirve: tu perfil ni la página del libro.'
  },
  StoryGraph: {
    corto: 'Link a tu reseña, no a la página del libro.',
    titulo: '¿Cómo consigo el link?',
    largo: 'Abrí tu reseña en StoryGraph y copiá la dirección de la barra del navegador. Tiene que ser la de tu reseña, no la del libro.'
  },
  YouTube: {
    corto: 'Link al video de tu reseña.',
    titulo: '¿Cómo copio el link?',
    largo: 'Abrí tu video → Compartir → Copiar. Después volvé acá y pegalo.'
  },
  Blog: { corto: 'Link a la entrada de tu reseña, no a la página principal de tu blog.' },
  comentarios: { corto: 'Un mensajito para el autor: qué te gustó, qué te sorprendió… Es opcional.' }
};


/* ════════════════════════════════════════════════════════════
   NUEVA CAMPAÑA (también se usa al renovar una campaña)
   Claves con prefijo nc_ para no pisar las de Entregar reseña.
   ════════════════════════════════════════════════════════════ */

const AYUDAS_CAMPANA = {
  nc_biblioteca: { corto: 'Si ya cargaste tu libro, elegilo y completamos los datos por vos.' },
  nc_autor: { corto: 'Como querés que aparezca en la campaña (nombre real o seudónimo).' },
  nc_sinopsis: {
    corto: 'Lo que van a leer las reseñadoras antes de postularse.',
    titulo: '¿Qué pongo en la sinopsis?',
    largo: 'Es la contratapa de tu libro: contá de qué trata sin spoilear el final. Es lo que convence a las reseñadoras de postularse, así que cuidala. Lo ideal son unos pocos párrafos.'
  },
  nc_generoTropes: {
    corto: 'Elegí el género y al menos un trope. Con esto te encontramos reseñadoras compatibles.',
    titulo: '¿Cómo elijo género y tropes?',
    largo:
      '1. Elegí el <strong>género</strong>. Según cuál sea, vas a poder elegir uno o más <strong>subgéneros</strong>.<br>' +
      '2. Buscá y sumá los <strong>tropes</strong> de tu libro (necesitás al menos uno).<br><br>' +
      'Los tropes sirven para que la plataforma te recomiende a las reseñadoras a las que les gusta ese tipo de historias. Elegí los que realmente tiene tu libro. Si falta alguno, podés proponerlo y el equipo lo revisa.'
  },
  nc_portada: { corto: 'Imagen JPG, PNG o WebP. Si elegiste un libro de tu biblioteca, ya tiene portada: subí un archivo solo si querés cambiarla.' },
  nc_epub: {
    corto: 'Subí las dos versiones: cada reseñadora elige cómo prefiere leer.',
    titulo: '¿Por qué pido EPUB y PDF?',
    largo: 'Pedimos los dos formatos porque cada reseñadora puede elegir cómo quiere leer tu libro. Los dos archivos son obligatorios.'
  },
  nc_pdf: {
    corto: 'Obligatorio. Es la otra opción de lectura.',
    titulo: '¿Por qué pido EPUB y PDF?',
    largo: 'Pedimos los dos formatos porque cada reseñadora puede elegir cómo quiere leer tu libro. Los dos archivos son obligatorios.'
  },
  nc_amazon: { corto: 'Si tu libro está en Amazon, pegá el link a la página del libro.' },
  nc_cupos: {
    corto: 'Cuántas reseñadoras querés que lean tu libro.',
    titulo: '¿Cuántos cupos pongo?',
    largo: 'Es la cantidad de personas que van a poder leer tu libro y reseñarlo. El máximo es 10 por campaña. Pensá que cada cupo ocupado es una reseña que esperás recibir.'
  },
  nc_fecha: { corto: 'Se calcula sola: tu campaña dura 30 días desde hoy.' },
  nc_paginas: { corto: 'Se muestra en la card de la campaña para que las reseñadoras sepan cuánto tiene el libro.' },
  nc_plataformas: {
    corto: 'Elegí 2 plataformas donde querés recibir las reseñas.',
    titulo: '¿Qué plataformas elijo?',
    largo: 'Son los lugares donde las reseñadoras van a publicar su reseña. Cada una tiene que cargar el link de una de las dos que elijas acá. Elegí las que usás y donde más te sirve tener reseñas: por ejemplo, Amazon y Goodreads ayudan a las ventas; Instagram y TikTok, a la visibilidad.'
  },
  nc_modalidad: {
    corto: 'Elegí si pueden descargar el libro o solo leerlo dentro de Indómita.',
    titulo: '¿Qué cambia entre una y otra?',
    largo:
      '<strong>Solo visor:</strong> las reseñadoras leen dentro de la plataforma, sin poder descargar el archivo.<br>' +
      '<strong>Permite descarga:</strong> pueden bajarlo y leerlo donde quieran (por ejemplo, en su e-reader). Puede atraer más reseñadoras, pero el archivo queda en sus manos.'
  }
};

const ERRORES_CAMPANA = {
  sinPlataformas: 'Elegí 2 plataformas donde querés recibir reseñas.',
  sinPortada: 'Falta la portada. Subí una imagen o elegí un libro de tu biblioteca.',
  sinArchivos: 'Subí los dos archivos del libro: el EPUB y el PDF.',
  sinGenero: 'Elegí un género para la campaña.',
  sinTropes: 'Elegí al menos un trope para tu campaña.'
};

/* ── Mensajes de error del flujo ── */
const ERRORES_RESENA = {
  sinFrase: 'Falta tu frase favorita. Es obligatoria: copiá una del libro que te haya marcado.',
  sinEstrellas: 'Falta calificar el libro con estrellas. Es obligatorio para poder entregar la reseña.'
};

/* ════════════════════════════════════════════════════════════
   Motor: decora cualquier elemento con data-ayuda="clave"
   - agrega la línea corta debajo de la etiqueta
   - agrega el botón "?" que abre/cierra un panel con el texto largo
   ════════════════════════════════════════════════════════════ */

function _ayudaEscapar(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decorarAyudas(contenedor) {
  const raiz = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
  if (!raiz) return;

  raiz.querySelectorAll('[data-ayuda]').forEach(etiqueta => {
    if (etiqueta.dataset.ayudaLista) return;
    const def = AYUDAS_RESENA[etiqueta.dataset.ayuda] || AYUDAS_CAMPANA[etiqueta.dataset.ayuda];
    if (!def) return;
    etiqueta.dataset.ayudaLista = '1';

    let ultimo = etiqueta;

    if (def.corto) {
      const p = document.createElement('p');
      p.className = 'ayuda-corta';
      p.textContent = def.corto;
      ultimo.insertAdjacentElement('afterend', p);
      ultimo = p;
    }

    if (def.largo) {
      const panel = document.createElement('div');
      panel.className = 'ayuda-panel';
      panel.style.display = 'none';
      panel.innerHTML =
        '<p class="ayuda-panel-titulo">' + _ayudaEscapar(def.titulo || 'Ayuda') + '</p>' +
        '<div class="ayuda-panel-texto">' + def.largo + '</div>';
      ultimo.insertAdjacentElement('afterend', panel);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ayuda-btn';
      btn.textContent = '?';
      btn.setAttribute('aria-label', def.titulo || 'Ayuda');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const abierto = panel.style.display !== 'none';
        panel.style.display = abierto ? 'none' : '';
        btn.setAttribute('aria-expanded', abierto ? 'false' : 'true');
        btn.classList.toggle('activo', !abierto);
      });
      etiqueta.appendChild(btn);
    }
  });
}

/** Cierra todos los paneles "?" abiertos dentro de un contenedor. */
function cerrarPanelesAyuda(contenedor) {
  const raiz = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
  if (!raiz) return;
  raiz.querySelectorAll('.ayuda-panel').forEach(p => { p.style.display = 'none'; });
  raiz.querySelectorAll('.ayuda-btn').forEach(b => {
    b.setAttribute('aria-expanded', 'false');
    b.classList.remove('activo');
  });
}

/* ════════════════════════════════════════════════════════════
   Entregar reseña — comportamiento específico
   ════════════════════════════════════════════════════════════ */

/** Cambia el encabezado explicativo según el paso (1 o 2). */
function actualizarEncabezadoResena(numero) {
  const def = numero === 1 ? AYUDAS_RESENA.encabezado1 : AYUDAS_RESENA.encabezado2;
  const t = document.getElementById('resena-encabezado-titulo');
  const x = document.getElementById('resena-encabezado-texto');
  if (t) t.textContent = def.titulo;
  if (x) x.textContent = def.texto;
}

/**
 * Paso 2: deja arriba las plataformas que pidió el autor y manda el resto
 * a un desplegable "Otras plataformas (opcional)". Además escribe el aviso
 * "El autor pidió reseña en: ...".
 * Si la campaña no tiene plataformas definidas, se muestran todas.
 */
function prepararPlataformasResena(plataformasPedidas) {
  const principal = document.getElementById('resena-plataformas-principal');
  const otras = document.getElementById('resena-plataformas-otras');
  const desplegable = document.getElementById('resena-otras-desplegable');
  const aviso = document.getElementById('resena-aviso-plataformas');
  if (!principal || !otras || !desplegable) return;

  const pedidas = (plataformasPedidas || []).map(p => String(p).trim()).filter(Boolean);
  const grupos = document.querySelectorAll('#resena-paso2 [data-plataforma]');

  grupos.forEach(g => {
    const esPedida = pedidas.length === 0 || pedidas.includes(g.dataset.plataforma);
    (esPedida ? principal : otras).appendChild(g);
  });

  desplegable.style.display = (pedidas.length > 0 && otras.children.length > 0) ? '' : 'none';
  desplegable.open = false;

  if (aviso) {
    if (pedidas.length > 0) {
      aviso.innerHTML = 'El autor pidió reseña en: <strong>' + _ayudaEscapar(pedidas.join(' o ')) +
        '</strong>. Con el link de una de esas plataformas alcanza. Si tenés más, podés cargarlas también.';
    } else {
      aviso.textContent = 'Cargá al menos un link de reseña. Podés agregar todos los que tengas.';
    }
  }
}
