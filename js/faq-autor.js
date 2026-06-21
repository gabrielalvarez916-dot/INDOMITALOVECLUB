============================================================
INSTRUCCIONES DE INTEGRACIÓN — FAQ Autores
Indómita Love Club
============================================================

No hay que modificar ninguna función ni archivo existente.
Solo agregar 4 cosas, en 4 lugares puntuales.


────────────────────────────────────────────────────────────
1) SUBIR LOS DOS ARCHIVOS NUEVOS A TU REPO
────────────────────────────────────────────────────────────

- js/faq-autor.js   (contenido y lógica del acordeón)
- css/faq.css       (estilos, ya usa tus variables de styles.css)


────────────────────────────────────────────────────────────
2) EN <head> DEL index.html — agregar el link al CSS nuevo
────────────────────────────────────────────────────────────

Justo debajo de esta línea que ya tenés:

  <link rel="stylesheet" href="css/styles.css" />

Agregar:

  <link rel="stylesheet" href="css/faq.css" />


────────────────────────────────────────────────────────────
3) EN EL <nav id="nav-principal"> — agregar el link de FAQ
────────────────────────────────────────────────────────────

Tu nav actual tiene esto:

  <nav id="nav-principal">
    <a href="#" class="nav-link" onclick="mostrarSeccion('feed')">Campañas</a>
    <a href="#" class="nav-link" id="nav-panel" style="display:none;" onclick="mostrarPanelRol()">Mi panel</a>
    <a href="#" class="nav-link" id="nav-perfil" style="display:none;" onclick="mostrarSeccion('perfil')">Mi perfil</a>
    <a href="#" class="nav-link" id="nav-admin" style="display:none;" onclick="mostrarSeccion('admin')">Admin</a>
  </nav>

Agregar una línea nueva, al lado de "Mi perfil" (mismo patrón: oculto por
defecto, visible solo para autores logueados — igual que nav-perfil):

  <nav id="nav-principal">
    <a href="#" class="nav-link" onclick="mostrarSeccion('feed')">Campañas</a>
    <a href="#" class="nav-link" id="nav-panel" style="display:none;" onclick="mostrarPanelRol()">Mi panel</a>
    <a href="#" class="nav-link" id="nav-perfil" style="display:none;" onclick="mostrarSeccion('perfil')">Mi perfil</a>
    <a href="#" class="nav-link" id="nav-faq-autor" style="display:none;" onclick="mostrarSeccion('faq-autor')">Preguntas frecuentes</a>
    <a href="#" class="nav-link" id="nav-admin" style="display:none;" onclick="mostrarSeccion('admin')">Admin</a>
  </nav>

NOTA: el mismo código que ya tenés en algún lado (probablemente en
auth.js o ui.js) que muestra/oculta "nav-perfil" según el rol del
usuario, es el que tiene que mostrar/ocultar "nav-faq-autor" también,
pero SOLO cuando el rol es 'autor' (a diferencia de nav-perfil que
es para todos los logueados). Buscá donde dice algo como:

  document.getElementById('nav-perfil').style.display = 'block';

y agregá al lado, dentro del mismo bloque donde se determina que el
rol es 'autor':

  const navFaqAutor = document.getElementById('nav-faq-autor');
  if (navFaqAutor) navFaqAutor.style.display = (rol === 'autor') ? 'block' : 'none';

(Esto es agregar una línea nueva en una función que ya existe — no
hace falta reescribir nada de lo que ya está, solo sumar esa lógica
extra donde corresponda.)


────────────────────────────────────────────────────────────
4) SECCIÓN NUEVA — pegar junto a las demás <section> existentes
────────────────────────────────────────────────────────────

Pegar esto, por ejemplo, justo después de </section> de
"seccion-perfil" y antes de <!-- SECCIÓN: ADMIN -->:

  <!-- SECCIÓN: FAQ AUTORES -->
  <section id="seccion-faq-autor" class="seccion" style="display:none;">
    <div class="seccion-inner seccion-angosta">
      <h2 class="panel-titulo">Preguntas frecuentes</h2>
      <p class="faq-intro">
        Resolvé las dudas más comunes sobre cómo usar la plataforma.
        Si tu pregunta no está acá, escribinos por el botón de soporte (💬)
        o a indomitagencia@gmail.com.
      </p>
      <div id="faq-autor-contenedor" class="faq-lista"></div>
      <div class="faq-footer-soporte">
        ¿No encontraste lo que buscabas? Usá el botón de soporte 💬
        en la esquina de la pantalla y te ayudamos a la brevedad.
      </div>
    </div>
  </section>


────────────────────────────────────────────────────────────
5) SCRIPT — agregar js/faq-autor.js junto a los demás scripts
────────────────────────────────────────────────────────────

Donde ya tenés:

  <script src="js/perfil.js"></script>
  <script src="js/visor.js"></script>
  <script src="js/soporte.js"></script>

Agregar abajo de soporte.js:

  <script src="js/faq-autor.js"></script>


────────────────────────────────────────────────────────────
6) DISPARAR LA CARGA AL MOSTRAR LA SECCIÓN
────────────────────────────────────────────────────────────

Tu función mostrarSeccion (en ui.js, probablemente) es la que
hace section.style.display = 'block' / 'none' según el id.
Buscá esa función y agregá un caso para que, al mostrar
'faq-autor', se llame a cargarFaqAutor(). Por ejemplo, si tu
mostrarSeccion ya tiene algo como:

  function mostrarSeccion(nombre) {
    ...
    if (nombre === 'feed') cargarFeed();
    if (nombre === 'perfil') cargarPerfil();
    ...
  }

Agregar la línea:

    if (nombre === 'faq-autor') cargarFaqAutor();

Si tu mostrarSeccion no tiene ese patrón de "ifs" y hace otra
cosa, decime cómo está armada esa función y te doy la línea
exacta para pegar ahí.


============================================================
RESUMEN: 0 archivos existentes modificados en su lógica.
Solo se agregan líneas nuevas (nav, script, sección) y 2
archivos nuevos (faq-autor.js, faq.css).
============================================================
