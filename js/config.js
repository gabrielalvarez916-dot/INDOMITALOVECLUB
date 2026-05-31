// ============================================================
// config.js — Indómita Love Club
// Configuración global del frontend
// ============================================================
const CONFIG = {
  BACKEND_URL: '/api/proxy',
  FRONTEND_URL: 'https://indomitaloveclub.vercel.app',
  EMAIL_ADMIN: 'indomitagencia@gmail.com',
  NOMBRE_APP: 'Indómita Love Club',
};

async function llamarBackend(accion, datos = {}) {
  try {
    const params = new URLSearchParams({ action: accion, ...datos });
    const respuesta = await fetch(`${CONFIG.BACKEND_URL}?${params.toString()}`);
    if (!respuesta.ok) throw new Error('Error de red: ' + respuesta.status);
    return await respuesta.json();
  } catch (e) {
    console.error('Error llamando al backend:', e);
    return { ok: false, mensaje: 'Error de conexión. Intentá nuevamente.' };
  }
}

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
