// ============================================================
// bot-soporte.js — Indómita Love Club
// Asistente "Indira": chatbot de respuestas PRECARGADAS.
//
// El bot no genera texto: solo muestra lo que está guardado en
// Supabase (tablas bot_nodos, bot_botones y bot_config). Para
// cambiar una respuesta se edita la tabla, no este archivo.
//
// - Menú según rol: reseñador, o autor/editorial.
// - "Derivar con asesor" abre el formulario de soporte que ya
//   existe (modal-soporte), con el asunto y el tema ya cargados.
// - 100% aditivo: no modifica soporte.js ni soporte-usuario.js.
// ============================================================

let _botRol = null;                 // 'resenador' | 'autor'
let _botMensajes = [];              // [{ de: 'bot' | 'usuario', html }]
let _botOpciones = [];              // chips visibles bajo el último mensaje
let _botUltimoTema = null;          // última pregunta que vio el usuario (para derivar)
const _botCachePorRol = {};         // { resenador: { nodos }, autor: { nodos } }
let _botCacheGlobal = null;         // { botones, config }

// ────────────────────────────────────────────────────────────
// Utilidades
// ────────────────────────────────────────────────────────────

function _botRolDesdeSesion() {
  const rol = String((typeof Sesion !== 'undefined' && Sesion.rol()) || '').toLowerCase();
  if (rol === 'reseñador' || rol === 'resenador') return 'resenador';
  if (rol === 'autor' || rol === 'editorial') return 'autor';
  return null; // admin, vendedor, etc.: elige a mano
}

// Markdown mínimo y seguro: escapa HTML primero, después aplica negrita, cursiva y viñetas.
function _botMarkdown(texto) {
  let s = String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  s = s.replace(/^[ \t]*-[ \t]+/gm, '• ');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?![*\w])/g, '$1<em>$2</em>');
  return s;
}

function _botEscapar(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _botNombreUsuario() {
  const u = (typeof Sesion !== 'undefined' && Sesion.obtener()) || {};
  return String(u.nombre || u.alias || '').trim().split(/\s+/)[0] || '';
}

function _botConfig(clave) {
  return _botCacheGlobal?.config?.[clave] || '';
}

function _botNodos() {
  return _botCachePorRol[_botRol]?.nodos || [];
}

function _botNodoPorId(id) {
  return _botNodos().find(n => n.id === id) || null;
}

function _botPrincipal() {
  return _botNodos().find(n => n.padre_id === null) || null;
}

function _botHijos(padreId) {
  return _botNodos()
    .filter(n => n.padre_id === padreId)
    .sort((a, b) => a.orden - b.orden);
}

function _botBotonesFijos(ubicacion) {
  return (_botCacheGlobal?.botones || [])
    .filter(b => b.ubicacion === ubicacion)
    .sort((a, b) => a.orden - b.orden)
    .map(b => ({ tipo: 'accion', accion: b.accion, etiqueta: b.etiqueta }));
}

// ────────────────────────────────────────────────────────────
// Carga de datos desde Supabase
// ────────────────────────────────────────────────────────────

async function _botCargarGlobal() {
  if (_botCacheGlobal) return;

  const [botones, config] = await Promise.all([
    supabaseClient.from('bot_botones').select('ubicacion, clave, etiqueta, accion, orden').order('orden'),
    supabaseClient.from('bot_config').select('clave, valor')
  ]);

  if (botones.error || config.error) throw (botones.error || config.error);

  _botCacheGlobal = {
    botones: botones.data || [],
    config: Object.fromEntries((config.data || []).map(c => [c.clave, c.valor]))
  };
}

async function _botCargarNodos(rol) {
  if (_botCachePorRol[rol]) return;

  const { data, error } = await supabaseClient
    .from('bot_nodos')
    .select('id, clave, rol, tipo, padre_id, orden, titulo, contenido')
    .eq('rol', rol)
    .order('orden');

  if (error) throw error;
  _botCachePorRol[rol] = { nodos: data || [] };
}

// ────────────────────────────────────────────────────────────
// Apertura y flujo de la conversación
// ────────────────────────────────────────────────────────────

async function abrirBotSoporte() {
  _botMensajes = [];
  _botOpciones = [];
  _botUltimoTema = null;
  _botRol = _botRolDesdeSesion();

  mostrarModal('modal-bot-soporte');
  _botPintarCargando();

  try {
    await _botCargarGlobal();

    if (!_botRol) {
      // Usuarios sin menú propio (admin, vendedor): eligen con qué perfil consultar
      _botMensajes = [{ de: 'bot', html: _botMarkdown('Elegí con qué perfil querés consultar:') }];
      _botOpciones = [
        { tipo: 'rol', rol: 'resenador', etiqueta: 'Reseñador' },
        { tipo: 'rol', rol: 'autor', etiqueta: 'Autor / Editorial' }
      ];
      _botPintar();
      return;
    }

    await _botCargarNodos(_botRol);
    _botMostrarInicio();
  } catch (e) {
    console.error('Error cargando el asistente:', e);
    _botMensajes = [{
      de: 'bot',
      html: _botMarkdown('No pudimos cargar el asistente. Probá de nuevo en un momento o escribinos con **Derivar con asesor**.')
    }];
    _botOpciones = [{ tipo: 'accion', accion: 'derivar', etiqueta: 'Derivar con asesor' }];
    _botPintar();
  }
}

function _botMostrarInicio() {
  const nombre = _botNombreUsuario();
  let texto = _botConfig('bienvenida');
  texto = nombre
    ? texto.replace('{nombre}', nombre)
    : texto.replace(', {nombre}', '').replace('{nombre}', '');

  _botMensajes = [{ de: 'bot', html: _botMarkdown(texto) }];
  _botOpciones = _botBotonesFijos('inicio');
  _botUltimoTema = null;
  _botPintar();
}

function _botElegirNodo(nodoId) {
  const nodo = _botNodoPorId(nodoId);
  if (!nodo) return;

  _botMensajes.push({ de: 'usuario', html: _botEscapar(nodo.titulo) });

  if (nodo.tipo === 'menu') {
    const esPrincipal = nodo.padre_id === null;
    const hijos = _botHijos(nodo.id).map(h => ({ tipo: 'nodo', id: h.id, etiqueta: h.titulo }));

    _botMensajes.push({
      de: 'bot',
      html: _botMarkdown(esPrincipal ? _botConfig('intro_menu_principal') : _botConfig('intro_submenu'))
    });
    _botOpciones = [...hijos, ..._botBotonesFijos(esPrincipal ? 'principal' : 'submenu')];
  } else {
    _botUltimoTema = nodo.titulo;
    _botMensajes.push({ de: 'bot', html: _botMarkdown(nodo.contenido) });
    _botOpciones = _botBotonesFijos('respuesta');
  }

  _botPintar();
}

function _botEjecutarAccion(accion) {
  if (accion === 'menu_principal') {
    const principal = _botPrincipal();
    if (principal) _botElegirNodo(principal.id);
    return;
  }

  if (accion === 'volver_inicio') {
    _botMostrarInicio();
    return;
  }

  if (accion === 'finalizar') {
    cerrarModales();
    _botMensajes = [];
    _botOpciones = [];
    _botUltimoTema = null;
    return;
  }

  if (accion === 'derivar') {
    _botDerivar();
  }
}

// Abre el formulario de soporte existente, ya con asunto y contexto
function _botDerivar() {
  const tema = _botUltimoTema;

  cerrarModales();
  mostrarModal('modal-soporte');

  const asunto = document.getElementById('soporte-asunto');
  const mensaje = document.getElementById('soporte-mensaje');

  if (asunto && !asunto.value) asunto.value = 'Consulta derivada desde Indira';
  if (mensaje && !mensaje.value) {
    mensaje.value = tema ? `Estaba consultando: "${tema}"\n\n` : '';
    mensaje.focus();
    mensaje.setSelectionRange(mensaje.value.length, mensaje.value.length);
  }
}

async function _botElegirRol(rol) {
  _botRol = rol;
  _botPintarCargando();
  try {
    await _botCargarNodos(rol);
    _botMostrarInicio();
  } catch (e) {
    console.error('Error cargando el asistente:', e);
    _botMensajes = [{ de: 'bot', html: _botMarkdown('No pudimos cargar el asistente. Probá de nuevo en un momento.') }];
    _botOpciones = [{ tipo: 'accion', accion: 'derivar', etiqueta: 'Derivar con asesor' }];
    _botPintar();
  }
}

// ────────────────────────────────────────────────────────────
// Pintado
// ────────────────────────────────────────────────────────────

function _botPintarCargando() {
  const chat = document.getElementById('bot-soporte-chat');
  if (chat) chat.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
}

function _botPintar() {
  const chat = document.getElementById('bot-soporte-chat');
  if (!chat) return;

  const burbujas = _botMensajes.map(m => `
    <div class="bot-msg ${m.de === 'bot' ? 'bot-msg-bot' : 'bot-msg-usuario'}">
      ${m.de === 'bot' ? '<div class="bot-msg-autor">Indira</div>' : ''}
      <div class="bot-msg-cuerpo">${m.html}</div>
    </div>
  `).join('');

  const chips = _botOpciones.map((o, i) => {
    const clase = o.tipo === 'accion' && o.accion === 'derivar'
      ? 'bot-chip bot-chip-derivar'
      : o.tipo === 'accion' ? 'bot-chip bot-chip-accion' : 'bot-chip';
    return `<button type="button" class="${clase}" data-bot-opcion="${i}">${_botEscapar(o.etiqueta)}</button>`;
  }).join('');

  chat.innerHTML = burbujas + (chips ? `<div class="bot-chips">${chips}</div>` : '');

  // La respuesta nueva se lee desde su primera línea (no desde el final)
  const ultimasDeBot = chat.querySelectorAll('.bot-msg-bot');
  const ultima = ultimasDeBot[ultimasDeBot.length - 1];
  chat.scrollTop = ultima ? Math.max(ultima.offsetTop - chat.offsetTop - 8, 0) : 0;
}

// Un solo listener para todos los botones del chat
document.addEventListener('click', (e) => {
  const chip = e.target.closest?.('[data-bot-opcion]');
  if (!chip) return;

  const opcion = _botOpciones[Number(chip.dataset.botOpcion)];
  if (!opcion) return;

  if (opcion.tipo === 'nodo') _botElegirNodo(opcion.id);
  else if (opcion.tipo === 'accion') _botEjecutarAccion(opcion.accion);
  else if (opcion.tipo === 'rol') _botElegirRol(opcion.rol);
});
