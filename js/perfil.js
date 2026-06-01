// ============================================================
// perfil.js — Indómita Love Club
// Carga, muestra y guarda el perfil del usuario logueado.
// Maneja campos según rol: autores ven biblioteca, reseñadores ven descripción lectora.
// ============================================================


// ────────────────────────────────────────────────────────────
// CARGAR PERFIL
// ────────────────────────────────────────────────────────────

/**
 * Carga el perfil del usuario logueado y rellena el formulario.
 * Se llama automáticamente desde ui.js cuando se muestra la sección 'perfil'.
 * Muestra u oculta campos según el rol del usuario.
 */
async function cargarPerfil() {
  const email = Sesion.email();
  const rol   = Sesion.rol();
  if (!email) return;

  ocultarMensajes('perfil-error', 'perfil-ok');

  // Ajusta el formulario según el rol ANTES de cargar datos
  ajustarFormularioPorRol(rol);

  const resultado = await llamarBackend('obtenerPerfil', { email });

  if (!resultado.ok) {
    mostrarMensajeError('perfil-error', resultado.mensaje || 'Error al cargar el perfil.');
    return;
  }

  const perfil = resultado.datos.perfil;
  rellenarFormularioPerfil(perfil);

  // Si es autor, carga también la biblioteca
  if (rol === 'autor') {
    toggleElemento('seccion-biblioteca', true);
    await cargarBibliotecaPanel(email);
  } else {
    toggleElemento('seccion-biblioteca', false);
  }
}


// ────────────────────────────────────────────────────────────
// AJUSTAR FORMULARIO SEGÚN ROL
// ────────────────────────────────────────────────────────────

/**
 * Muestra u oculta campos del formulario según el rol del usuario.
 *
 * Autores:
 *   - NO ven descripción lectora ni géneros favoritos (son campos de reseñadores)
 *   - SÍ ven la sección biblioteca
 *
 * Reseñadores:
 *   - SÍ ven descripción lectora y géneros favoritos
 *   - NO ven la sección biblioteca
 *
 * @param {string} rol — 'autor' | 'reseñador' | 'admin'
 */
function ajustarFormularioPorRol(rol) {
  const esAutor = rol === 'autor';
  const esReseñador = rol === 'reseñador';
  toggleElemento('seccion-biblioteca', esAutor);
  toggleElemento('grupo-generos', esReseñador);
  toggleElemento('grupo-descripcion', esReseñador);
}


// ────────────────────────────────────────────────────────────
// RELLENAR FORMULARIO
// ────────────────────────────────────────────────────────────

/**
 * Rellena los campos del formulario con los datos del perfil.
 *
 * @param {Object} perfil — datos del perfil del backend
 */
function rellenarFormularioPerfil(perfil) {
  const setVal = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.value = valor || '';
  };

  setVal('perfil-alias',       perfil.alias);
  setVal('perfil-pais',        perfil.pais);
  setVal('perfil-ciudad',      perfil.ciudad);
  setVal('perfil-generos',     perfil.generos);
  setVal('perfil-descripcion', perfil.descripcionLector);
  setVal('perfil-instagram',   perfil.instagram);
  setVal('perfil-tiktok',      perfil.tiktok);
  setVal('perfil-amazon',      perfil.amazon);

  // Foto de perfil
  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl && perfil.fotoPerfil) {
    fotoEl.src = perfil.fotoPerfil;
  }
}


// ────────────────────────────────────────────────────────────
// GUARDAR PERFIL
// ────────────────────────────────────────────────────────────

/**
 * Guarda los cambios del perfil en el backend.
 * Se llama desde el submit del form-perfil.
 *
 * @param {Event} event
 */
async function guardarPerfil(event) {
  event.preventDefault();
  ocultarMensajes('perfil-error', 'perfil-ok');

  const email = Sesion.email();
  const rol   = Sesion.rol();

  const datos = {
    alias:            document.getElementById('perfil-alias')?.value?.trim(),
    pais:             document.getElementById('perfil-pais')?.value?.trim(),
    ciudad:           document.getElementById('perfil-ciudad')?.value?.trim(),
    instagram:        document.getElementById('perfil-instagram')?.value?.trim(),
    tiktok:           document.getElementById('perfil-tiktok')?.value?.trim(),
    amazon:           document.getElementById('perfil-amazon')?.value?.trim(),
  };

  // Campos solo de reseñadores
  if (rol === 'reseñador') {
    datos.generos          = document.getElementById('perfil-generos')?.value?.trim();
    datos.descripcionLector = document.getElementById('perfil-descripcion')?.value?.trim();
  }

  if (!datos.alias) {
    mostrarMensajeError('perfil-error', 'El alias es obligatorio.');
    return;
  }

  const resultado = await llamarBackend('editarPerfil', {
  email,
  alias:             datos.alias,
  pais:              datos.pais,
  ciudad:            datos.ciudad,
  instagram:         datos.instagram,
  tiktok:            datos.tiktok,
  amazon:            datos.amazon,
  generos:           datos.generos,
  descripcionLector: datos.descripcionLector
});
if (!resultado.ok) {
  
    mostrarMensajeError('perfil-error', resultado.mensaje || 'Error al guardar el perfil.');
    return;
  }

  // Actualiza TODOS los datos en la sesión
const sesionActual = Sesion.obtener();
if (sesionActual) {
  Sesion.guardar({ 
    ...sesionActual, 
    alias:            datos.alias,
    pais:             datos.pais,
    ciudad:           datos.ciudad,
    instagram:        datos.instagram,
    tiktok:           datos.tiktok,
    amazon:           datos.amazon,
    generos:          datos.generos,
    descripcionLector: datos.descripcionLector
  });
  const aliasEl = document.getElementById('usuario-alias');
  if (aliasEl) aliasEl.textContent = datos.alias;
}

mostrarMensajeOk('perfil-ok', '¡Perfil guardado correctamente!');
setTimeout(() => ocultarMensajes('perfil-ok'), 3000);
}


// ────────────────────────────────────────────────────────────
// FOTO DE PERFIL
// ────────────────────────────────────────────────────────────

/**
 * Sube la foto de perfil seleccionada por el usuario.
 * Convierte la imagen a base64 y la envía al backend.
 *
 * @param {HTMLInputElement} input — el input file
 */
async function subirFoto(input) {
  const archivo = input.files[0];
  if (!archivo) return;

  const base64 = await redimensionarImagen(archivo, 100);

  const fotoEl = document.getElementById('perfil-foto');
  if (fotoEl) fotoEl.src = base64;

  try {
    const respuesta = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subirFotoPerfil',
        email: Sesion.email(),
        fotoBase64: base64
      })
    });
    const resultado = await respuesta.json();
    if (!resultado.ok) {
      mostrarToast(resultado.mensaje || 'Error al subir la foto.', 'error');
      return;
    }
    mostrarToast('Foto actualizada.', 'ok');
    if (resultado.datos?.fotoUrl) {
      const sesionActual = Sesion.obtener();
      Sesion.guardar({ ...sesionActual, fotoPerfil: resultado.datos.fotoUrl });
    }
  } catch (e) {
    mostrarToast('Error de conexión al subir la foto.', 'error');
  }
}

function redimensionarImagen(archivo, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/jpeg', 0.3));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(archivo);
  });
}


// ────────────────────────────────────────────────────────────
// GUARDAR PERFIL Y POSTULARSE (primera vez)
// ────────────────────────────────────────────────────────────

/**
 * Guarda el perfil del reseñador y luego lo postula a una campaña.
 * Se usa cuando se postula por primera vez y le falta completar datos.
 * Se llama desde el submit del modal-completar-perfil.
 *
 * @param {Event} event
 */
async function guardarPerfilYPostularse(event) {
  event.preventDefault();
  ocultarMensajes('completar-error');

  const email     = Sesion.email();
  const idCampana = document.getElementById('completar-id-campana')?.value;

  const datos = {
    pais:             document.getElementById('completar-pais')?.value?.trim(),
    ciudad:           document.getElementById('completar-ciudad')?.value?.trim(),
    instagram:        document.getElementById('completar-instagram')?.value?.trim(),
    tiktok:           document.getElementById('completar-tiktok')?.value?.trim(),
    amazon:           document.getElementById('completar-amazon')?.value?.trim(),
    descripcionLector: document.getElementById('completar-descripcion')?.value?.trim(),
    generos:          document.getElementById('completar-generos')?.value?.trim(),
  };

  if (!datos.pais || !datos.ciudad) {
    mostrarMensajeError('completar-error', 'País y ciudad son obligatorios.');
    return;
  }

  // Primero guarda el perfil
  const resultadoPerfil = await llamarBackend('editarPerfil', { email, datos });

  if (!resultadoPerfil.ok) {
  mostrarMensajeError('completar-error', resultadoPerfil.mensaje || 'Error al guardar el perfil.');
  return;
}

// Actualiza sesión AQUÍ, después del error
const usuarioActual = Sesion.obtener();
Sesion.guardar({ ...usuarioActual, ...datos });

  // Luego se postula
  const resultadoPostulacion = await llamarBackend('postularseACampana', {
    email,
    idCampana,
    aceptaConfidencialidad: true
  });

  if (!resultadoPostulacion.ok) {
    mostrarMensajeError('completar-error', resultadoPostulacion.mensaje || 'Error al postularse.');
    return;
  }

  cerrarModales();
  mostrarToast('¡Perfil completado y postulación enviada!', 'ok');

  // Recarga el feed para reflejar el cambio
  if (typeof cargarFeed === 'function') cargarFeed();
}
