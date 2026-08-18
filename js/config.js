// ============================================================
// config.js — Indómita Love Club
// Configuración global del frontend
// ============================================================
const CONFIG = {
  FRONTEND_URL: 'https://loveclub.indomitastudioeditorial.com.ar',
  EMAIL_ADMIN: 'indomitagencia@gmail.com',
  NOMBRE_APP: 'Indómita Love Club',
};

const Sesion = {
  guardar(usuario) {
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
  },
  obtener() {
    const datos = sessionStorage.getItem('usuario');
    return datos ? JSON.parse(datos) : null;
  },
  cerrar() {
    sessionStorage.removeItem('usuario');
  },
  activa() {
    return this.obtener() !== null;
  },
  rol() {
    const usuario = this.obtener();
    return usuario ? usuario.rol : null;
  },
  email() {
    const usuario = this.obtener();
    return usuario ? usuario.email : null;
  }
};

function mostrarError(elementoId, mensaje) {
  const el = document.getElementById(elementoId);
  if (el) { el.textContent = mensaje; el.style.display = 'block'; }
}

function ocultarError(elementoId) {
  const el = document.getElementById(elementoId);
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function mostrarCarga(elementoId, mostrar) {
  const el = document.getElementById(elementoId);
  if (el) { el.style.display = mostrar ? 'block' : 'none'; }
}

function irA(seccion) {
  window.location.hash = seccion;
}

/**
 * Arma la URL pública para mostrar una foto de perfil propia (subida por el
 * usuario), a partir del "key" guardado en usuarios.foto_perfil_url.
 */
function construirUrlAvatarPropio(fotoPerfilKey) {
  if (!fotoPerfilKey) return null;
  return `${SUPABASE_URL}/functions/v1/ver-avatar-perfil?key=${encodeURIComponent(fotoPerfilKey)}`;
}

/**
 * Resuelve la foto a mostrar para una fila de usuario: prioriza la foto
 * propia subida por el usuario; si no tiene, cae al avatar preseteado
 * (viene del join `avatares(imagen_url)` en el select).
 */
function resolverFotoPerfil(row) {
  if (!row) return null;
  return construirUrlAvatarPropio(row.foto_perfil_url) || row.avatares?.imagen_url || null;
}
