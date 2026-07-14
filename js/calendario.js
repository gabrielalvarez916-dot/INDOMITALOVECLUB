// ============================================================
// calendario.js — Indómita Love Club
// Calendario mensual (mes actual ± 1 mes) para Autor y Reseñador.
// Reutiliza el modal genérico #modal-detalle-campana, así que no
// hace falta agregar ningún modal nuevo al HTML.
// ============================================================

let _calMesOffset   = 0;   // -1, 0, +1 relativo al mes actual
let _calRolActual   = null; // 'autor' | 'reseñador'
let _calEventosPorDia = {}; // cache por mes: { 'YYYY-MM': { 'YYYY-MM-DD': [eventos] } }

const CAL_LIMITE_OFFSET = 1; // mes actual ± 1 mes

/**
 * Abre el modal del calendario para el rol indicado.
 * @param {'autor'|'reseñador'} rol
 */
async function abrirCalendario(rol) {
  _calRolActual = rol;
  _calMesOffset = 0;
  _calEventosPorDia = {}; // siempre datos frescos al abrir
  mostrarModal('modal-detalle-campana');
  await _renderizarCalendario();
}

function _mesVisible() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth() + _calMesOffset, 1);
}

function _claveMes(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

async function _renderizarCalendario() {
  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = 'Calendario';
  if (footer) footer.innerHTML = '';
  if (body)   body.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';

  const mesVisible = _mesVisible();
  const claveMes   = _claveMes(mesVisible);

  if (!_calEventosPorDia[claveMes]) {
    _calEventosPorDia[claveMes] = _calRolActual === 'autor'
      ? await _obtenerEventosCalendarioAutor()
      : await _obtenerEventosCalendarioReseñador();
  }

  if (body) body.innerHTML = _construirGridCalendario(mesVisible, _calEventosPorDia[claveMes]);
}

function _construirGridCalendario(mesVisible, eventosPorDia) {
  const nombreMes = mesVisible.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const primerDiaSemana = (mesVisible.getDay() + 6) % 7; // lunes = 0
  const diasEnMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0).getDate();

  const puedeRetroceder = _calMesOffset > -CAL_LIMITE_OFFSET;
  const puedeAvanzar    = _calMesOffset < CAL_LIMITE_OFFSET;

  let celdas = '';
  for (let i = 0; i < primerDiaSemana; i++) celdas += `<div class="cal-celda cal-celda-vacia"></div>`;

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${mesVisible.getFullYear()}-${String(mesVisible.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const eventosDia = eventosPorDia[fechaStr] || [];
    celdas += `
      <div class="cal-celda ${eventosDia.length ? 'cal-celda-con-eventos' : ''}" ${eventosDia.length ? `onclick="_abrirDetalleDiaCalendario('${fechaStr}')"` : ''}>
        <span class="cal-numero">${dia}</span>
        <div class="cal-eventos">
          ${eventosDia.slice(0, 3).map(ev => _construirIconoEvento(ev)).join('')}
          ${eventosDia.length > 3 ? `<span class="cal-evento-extra">+${eventosDia.length - 3}</span>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="cal-nav">
      <button class="cal-nav-flecha" ${!puedeRetroceder ? 'disabled' : ''} onclick="_calMesOffset--; _renderizarCalendario()">←</button>
      <p class="cal-nav-mes">${nombreMes}</p>
      <button class="cal-nav-flecha" ${!puedeAvanzar ? 'disabled' : ''} onclick="_calMesOffset++; _renderizarCalendario()">→</button>
    </div>
    <div class="cal-grid">
      ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="cal-dia-header">${d}</div>`).join('')}
      ${celdas}
    </div>
  `;
}

function _construirIconoEvento(ev) {
  const formaClase     = ev.forma === 'avatar' ? 'cal-evento-avatar' : 'cal-evento-portada';
  const entregadaClase = (ev.tipo === 'entrega' && ev.entregada) ? ' cal-evento-entregada' : '';

  if (ev.imagen) {
    return `<img src="${ev.imagen}" class="${formaClase}${entregadaClase}" onerror="this.style.display='none'" />`;
  }
  const placeholder = ev.forma === 'avatar' ? '👤' : '📖';
  return `<div class="${formaClase} ${formaClase}--vacia${entregadaClase}">${placeholder}</div>`;
}

// ────────────────────────────────────────────────────────────
// OBTENCIÓN DE EVENTOS — RESEÑADOR
// ────────────────────────────────────────────────────────────

async function _obtenerEventosCalendarioReseñador() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return {};

  const { data: postulaciones } = await supabaseClient
    .from('postulaciones')
    .select(`
      id, fecha_respuesta, fecha_limite_entrega, id_campana,
      campanas ( id, nombre_libro, nombre_autor, link_portada )
    `)
    .eq('id_usuario_resenador', user.id)
    .eq('estado', 'aprobada');

  const idsCampanas = (postulaciones || []).map(p => p.id_campana).filter(Boolean);

  const { data: resenas } = idsCampanas.length
    ? await supabaseClient.from('resenas').select('id_campana').eq('id_usuario_resenador', user.id).in('id_campana', idsCampanas)
    : { data: [] };

  const idsConResena = new Set((resenas || []).map(r => r.id_campana));

  const eventosPorDia = {};
  const agregar = (fecha, evento) => {
    if (!fecha) return;
    const clave = fecha.slice(0, 10);
    if (!eventosPorDia[clave]) eventosPorDia[clave] = [];
    eventosPorDia[clave].push(evento);
  };

  (postulaciones || []).forEach(p => {
    const c = p.campanas;
    if (!c) return;

    if (p.fecha_respuesta) {
      agregar(p.fecha_respuesta, {
        tipo: 'aprobacion', forma: 'portada', imagen: c.link_portada,
        detalle: { nombreLibro: c.nombre_libro, nombreAutor: c.nombre_autor, fecha: p.fecha_respuesta, texto: 'Postulación aprobada' }
      });
    }
    if (p.fecha_limite_entrega) {
      const entregada = idsConResena.has(c.id);
      agregar(p.fecha_limite_entrega, {
        tipo: 'entrega', forma: 'portada', imagen: c.link_portada, entregada,
        detalle: {
          nombreLibro: c.nombre_libro, nombreAutor: c.nombre_autor, fecha: p.fecha_limite_entrega,
          texto: entregada ? 'Reseña entregada' : 'Fecha límite de entrega'
        }
      });
    }
  });

  return eventosPorDia;
}

// ────────────────────────────────────────────────────────────
// OBTENCIÓN DE EVENTOS — AUTOR
// ────────────────────────────────────────────────────────────

async function _obtenerEventosCalendarioAutor() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return {};

  const { data: campañas } = await supabaseClient
    .from('campanas')
    .select('id, nombre_libro, nombre_autor, link_portada, fecha_limite')
    .eq('id_usuario_autor', user.id);

  const mapaCampañas = {};
  (campañas || []).forEach(c => { mapaCampañas[c.id] = c; });
  const idsCampanasAutor = (campañas || []).map(c => c.id);

  const { data: postulaciones } = idsCampanasAutor.length
    ? await supabaseClient
        .from('postulaciones')
        .select(`
          id, fecha_respuesta, fecha_limite_entrega, id_campana,
          usuarios!postulaciones_id_usuario_resenador_fkey ( id, alias, avatares ( imagen_url ) )
        `)
        .eq('estado', 'aprobada')
        .in('id_campana', idsCampanasAutor)
    : { data: [] };

  const { data: resenas } = idsCampanasAutor.length
    ? await supabaseClient.from('resenas').select('id_campana, id_usuario_resenador').in('id_campana', idsCampanasAutor)
    : { data: [] };

  const entregadasSet = new Set((resenas || []).map(r => `${r.id_campana}_${r.id_usuario_resenador}`));

  const eventosPorDia = {};
  const agregar = (fecha, evento) => {
    if (!fecha) return;
    const clave = fecha.slice(0, 10);
    if (!eventosPorDia[clave]) eventosPorDia[clave] = [];
    eventosPorDia[clave].push(evento);
  };

  (postulaciones || []).forEach(p => {
    const c = mapaCampañas[p.id_campana];
    const r = p.usuarios;
    if (!c || !r) return;
    const avatar = r.avatares?.imagen_url || null;

    if (p.fecha_respuesta) {
      agregar(p.fecha_respuesta, {
        tipo: 'aprobacion', forma: 'avatar', imagen: avatar,
        detalle: { nombreLibro: c.nombre_libro, nombreAutor: c.nombre_autor, alias: r.alias, fecha: p.fecha_respuesta, texto: `Aprobaste a ${r.alias}` }
      });
    }
    if (p.fecha_limite_entrega) {
      const entregada = entregadasSet.has(`${p.id_campana}_${r.id}`);
      agregar(p.fecha_limite_entrega, {
        tipo: 'entrega', forma: 'avatar', imagen: avatar, entregada,
        detalle: {
          nombreLibro: c.nombre_libro, nombreAutor: c.nombre_autor, alias: r.alias, fecha: p.fecha_limite_entrega,
          texto: entregada ? `${r.alias} ya entregó su reseña` : `${r.alias} debe entregar su reseña`
        }
      });
    }
  });

  (campañas || []).forEach(c => {
    if (c.fecha_limite) {
      agregar(c.fecha_limite, {
        tipo: 'finalizacion', forma: 'portada', imagen: c.link_portada,
        detalle: { nombreLibro: c.nombre_libro, nombreAutor: c.nombre_autor, fecha: c.fecha_limite, texto: 'Finalización de campaña' }
      });
    }
  });

  return eventosPorDia;
}

// ────────────────────────────────────────────────────────────
// DETALLE AL HACER CLICK EN UN DÍA
// ────────────────────────────────────────────────────────────

function _abrirDetalleDiaCalendario(fechaStr) {
  const claveMes = _claveMes(_mesVisible());
  const eventosDia = (_calEventosPorDia[claveMes] || {})[fechaStr] || [];
  if (eventosDia.length === 0) return;

  const titulo = document.getElementById('modal-detalle-titulo');
  const body   = document.getElementById('modal-detalle-body');
  const footer = document.getElementById('modal-detalle-footer');

  if (titulo) titulo.textContent = formatearFechaAmigable(fechaStr);
  if (body)   body.innerHTML = eventosDia.map(ev => _construirCardDetalleEvento(ev)).join('');
  if (footer) footer.innerHTML = `<button class="btn-secundario" onclick="_renderizarCalendario()">← Volver al calendario</button>`;
}

function _construirCardDetalleEvento(ev) {
  const d = ev.detalle;
  const iconoTipo = { aprobacion: '✅', entrega: ev.entregada ? '✔️' : '⏳', finalizacion: '🏁' }[ev.tipo];
  return `
    <div class="cal-detalle-card">
      <p class="cal-detalle-texto"><strong>${iconoTipo} ${d.texto}</strong></p>
      <p class="cal-detalle-libro">${d.nombreLibro || ''}</p>
      ${d.nombreAutor ? `<p class="cal-detalle-meta">por ${d.nombreAutor}</p>` : ''}
      ${d.alias ? `<p class="cal-detalle-meta">Reseñad@r: ${d.alias}</p>` : ''}
      <p class="cal-detalle-fecha">📅 ${formatearFechaAmigable(d.fecha)}</p>
    </div>
  `;
}
