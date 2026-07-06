// ============================================================
// config.js — Indómita Love Club
// Configuración global del frontend
// ============================================================
const CONFIG = {
  FRONTEND_URL: 'https://indomitaloveclub.vercel.app',
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
