// ============================================================
// config.js — Indómita Love Club
// Configuración global del frontend
// ============================================================

const CONFIG = {

  // URL del backend (Google Apps Script Web App)
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbz02LxMeAYZ8hcXXVyLFe2E9pLjBRJMicqlBn0MEa0pE_XWKwXyPH01bqLgTSkUb87q5A/exec',

  // URL del frontend
  FRONTEND_URL: 'https://indomitaloveclub.vercel.app',

  // Email del administrador
  EMAIL_ADMIN: 'indomitagencia@gmail.com',

  // Nombre de la plataforma
  NOMBRE_APP: 'Indómita Love Club',

};


// ============================================================
// Función base para llamar al backend
// Todas las llamadas al backend pasan por acá
// ============================================================

async function llamarBackend(accion, datos = {}) {
  try {
    const respuesta = await fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: accion, ...datos })
    });

    if (!respuesta.ok) {
      throw new Error('Error de red: ' + respuesta.status);
    }

    const json = await respuesta.json();
    return json;

  } catch (e) {
    console.error('Error llamando al backend:', e);
    return { ok: false, mensaje: 'Error de conexión. Intentá nuevamente.' };
  }
}


// ============================================================
// Manejo de sesión local
// La sesión se guarda en sessionStorage del navegador
// ============================================================

const Sesion = {

  // Guarda los datos del usuario en sesión
  guardar(usuario) {
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
  },

  // Devuelve los datos del usuario o null si no hay sesión
  obtener() {
    const datos = sessionStorage.getItem('usuario');
    return datos ? JSON.parse(datos) : null;
  },

  // Cierra la sesión
  cerrar() {
    sessionStorage.removeItem('usuario');
  },

  // Devuelve true si hay sesión activa
  activa() {
    return this.obtener() !== null;
  },

  // Devuelve el rol del usuario ('autor', 'reseñador', 'admin') o null
  rol() {
    const usuario = this.obtener();
    return usuario ? usuario.rol : null;
  },

  // Devuelve el email del usuario o null
  email() {
    const usuario = this.obtener();
    return usuario ? usuario.email : null;
  }

};


// ============================================================
// Utilidades generales
// ============================================================

// Muestra un mensaje de error en un elemento del DOM
function mostrarError(elementoId, mensaje) {
  const el = document.getElementById(elementoId);
  if (el) {
    el.textContent = mensaje;
    el.style.display = 'block';
  }
}

// Oculta un mensaje de error
function ocultarError(elementoId) {
  const el = document.getElementById(elementoId);
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

// Muestra u oculta un spinner de carga
function mostrarCarga(elementoId, mostrar) {
  const el = document.getElementById(elementoId);
  if (el) {
    el.style.display = mostrar ? 'block' : 'none';
  }
}

// Redirige a una sección de la página
function irA(seccion) {
  window.location.hash = seccion;
}
