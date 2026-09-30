// ============================================================
// festival-generos.js — Indómita Love Club
// Festival de Géneros (octubre 2026). Solo actúa si el evento activo
// tiene un id que empieza con "FestivalGeneros" (FestivalGeneros_R1 /
// _R2); con cualquier otro evento no hace nada.
//
// La página del evento es la de siempre (banner, historia, insignia,
// mapa con nodos, retos). Este archivo solo agrega DOS cosas:
//   1. Las barras de los géneros ARRIBA, en el mismo lugar y con el
//      mismo estilo que la barra comunitaria de La Gran Maratón:
//      2 barras en los duelos, 3 en la final.
//   2. La ruleta, UNA SOLA VEZ por usuario: aparece, gira, muestra el
//      género y desaparece. Después no vuelve a aparecer.
//
// Cuando termine el festival, este archivo y sus 3 enganches marcados
// "FESTIVAL DE GÉNEROS (temporal)" en eventos.js ya no hacen falta:
// quitarlos no afecta a ningún otro evento.
//
// Datos: RPC festival_mi_estado() y festival_girar() (Supabase).
// ============================================================

const FestivalGeneros = (() => {

  // Orden de las pestañas de la ruleta (alterna colores para que contrasten).
  const ORDEN = ['romance', 'ciencia_ficcion', 'thriller', 'fantasia', 'no_ficcion', 'terror'];

  const GENEROS = {
    romance:         { nombre: 'Romance',         icono: '🌹', color: '#ec4899', texto: '#ffffff', lineas: ['ROMANCE'] },
    fantasia:        { nombre: 'Fantasía',        icono: '🐉', color: '#7c3aed', texto: '#ffffff', lineas: ['FANTASÍA'] },
    ciencia_ficcion: { nombre: 'Ciencia ficción', icono: '🪐', color: '#2563eb', texto: '#ffffff', lineas: ['CIENCIA', 'FICCIÓN'] },
    no_ficcion:      { nombre: 'No ficción',      icono: '📖', color: '#d9c7a3', texto: '#3b2f1e', lineas: ['NO', 'FICCIÓN'] },
    thriller:        { nombre: 'Thriller',        icono: '🔍', color: '#facc15', texto: '#3b2f00', lineas: ['THRILLER'] },
    terror:          { nombre: 'Terror',          icono: '💀', color: '#dc2626', texto: '#ffffff', lineas: ['TERROR'] }
  };

  const RIVAL = { romance: 'thriller', thriller: 'romance', no_ficcion: 'terror', terror: 'no_ficcion',
                  fantasia: 'ciencia_ficcion', ciencia_ficcion: 'fantasia' };

  let _estado = null;          // último estado leído de festival_mi_estado()
  let _omitirRuleta = false;   // el usuario tocó "Ahora no" en esta sesión
  let _intervalo = null;

  function aplica(evento) {
    return !!evento && typeof evento.id === 'string' && evento.id.indexOf('FestivalGeneros') === 0;
  }

  function _esc(t) {
    if (typeof _escaparHtml === 'function') return _escaparHtml(String(t == null ? '' : t));
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function _leerEstado() {
    try {
      const { data, error } = await supabaseClient.rpc('festival_mi_estado');
      if (error) throw error;
      _estado = data;
    } catch (e) {
      console.error('Error al leer el estado del festival:', e);
      _estado = null;
    }
    return _estado;
  }

  // ──────────────────────────────────────────────────────────
  // CSS mínimo (solo lo propio del festival; las barras usan las
  // clases que ya existen del evento comunitario)
  // ──────────────────────────────────────────────────────────
  function _css() {
    if (document.getElementById('fest-gen-css')) return;
    const st = document.createElement('style');
    st.id = 'fest-gen-css';
    st.textContent = `
      .fest-barra{margin:10px 0}
      .fest-barra-label{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:.92rem;margin-bottom:4px}
      .fest-barra-label small{font-weight:500;opacity:.75}
      .fest-barra .evento-barra-progreso-texto{text-shadow:0 1px 2px rgba(0,0,0,.55)}
      .fest-overlay{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:radial-gradient(120% 120% at 50% 0%,rgba(42,29,87,.97) 0%,rgba(13,10,28,.98) 75%);color:#fff;overflow:auto}
      .fest-overlay h2{margin:0 0 4px;font-size:1.35rem;color:#fff;text-align:center}
      .fest-overlay .fest-sub{margin:0 0 6px;opacity:.88;font-size:.92rem;text-align:center}
      .fest-rueda-wrap{position:relative;width:min(84vw,320px);margin:26px auto 10px}
      .fest-rueda{display:block;width:100%;height:auto;border-radius:50%;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5));transition:transform 5.4s cubic-bezier(.12,.6,.12,1)}
      .fest-puntero{position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:28px solid #fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));z-index:3}
      .fest-girar{position:absolute;top:50%;left:50%;width:27%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-weight:800;font-size:.95rem;letter-spacing:.5px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.55);z-index:2}
      .fest-girar:disabled{opacity:.75;cursor:default}
      .fest-resultado{text-align:center;margin:10px auto 0;padding:16px 14px;max-width:340px;border-radius:16px;background:rgba(255,255,255,.08);border:2px solid var(--c);animation:fest-pop .5s ease}
      .fest-resultado-icono{font-size:2.6rem;line-height:1}
      .fest-resultado h2{margin:6px 0 4px}
      .fest-resultado p{margin:0 0 12px;opacity:.9;font-size:.92rem}
      .fest-omitir{margin-top:14px;background:none;border:none;color:#fff;opacity:.6;text-decoration:underline;cursor:pointer;font-size:.85rem}
      .fest-premios{margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,.08)}
      .fest-premios-titulo{margin:0 0 2px;font-weight:800;font-size:1rem;text-align:center}
      .fest-premios-sub{margin:0 0 10px;font-size:.8rem;opacity:.75;text-align:center}
      .fest-premios-grupo{margin:8px 0;padding:10px 12px;border-radius:12px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.25)}
      .fest-premios-grupo.fest-premios-propio{border:2px solid #8b5cf6;background:rgba(139,92,246,.14)}
      .fest-premios-grupo h4{margin:0 0 6px;font-size:.92rem}
      .fest-premios-grupo ul{list-style:none;margin:0;padding:0}
      .fest-premios-grupo li{display:flex;gap:8px;align-items:flex-start;font-size:.88rem;padding:3px 0}
      .fest-premios-grupo li span:first-child{flex-shrink:0}
      @keyframes fest-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    `;
    document.head.appendChild(st);
  }

  // ──────────────────────────────────────────────────────────
  // BARRAS (arriba, como la barra comunitaria de La Gran Maratón)
  // ──────────────────────────────────────────────────────────
  function _htmlBarras(est) {
    const total = est.barras.reduce((acc, b) => acc + b.puntos, 0);
    return est.barras.map(b => {
      const g = GENEROS[b.genero];
      if (!g) return '';
      const pct = total > 0 ? Math.round((b.puntos / total) * 100) : 0;
      return `
        <div class="fest-barra" data-genero="${b.genero}">
          <div class="fest-barra-label">
            <span>${g.icono} ${_esc(g.nombre)}</span>
            ${b.propio ? '<small>tu equipo</small>' : ''}
          </div>
          <div class="evento-barra-progreso evento-barra-progreso--comunitario">
            <div class="evento-barra-progreso-relleno" style="width:${pct}%;background:${g.color};"></div>
            <span class="evento-barra-progreso-texto">${b.puntos} pts · ${pct}%</span>
          </div>
        </div>`;
    }).join('');
  }

  const PREMIOS = {
    'reseñador': { titulo: '📚 Reseñadores', items: [
      ['🥇', '1.º puesto: un comodín para evitar penalizaciones'],
      ['🥈', '2.º puesto: 25 puntos más de regalo'],
      ['🥉', '3.º puesto: 10 puntos más de regalo']
    ]},
    autor: { titulo: '✍️ Autores', items: [
      ['🥇', '1.º puesto: un Informe de Lectura Beta'],
      ['🥈', '2.º puesto: 5 campañas de regalo'],
      ['🥉', '3.º puesto: un impulso de regalo']
    ]}
  };

  function _htmlPremios(rolPropio) {
    const grupo = (clave) => {
      const g = PREMIOS[clave];
      return `
        <div class="fest-premios-grupo${clave === rolPropio ? ' fest-premios-propio' : ''}">
          <h4>${g.titulo}${clave === rolPropio ? ' · tu categoría' : ''}</h4>
          <ul>${g.items.map(i => `<li><span>${i[0]}</span><span>${i[1]}</span></li>`).join('')}</ul>
        </div>`;
    };
    return `
      <div class="fest-premios">
        <p class="fest-premios-titulo">🏆 Premios del festival</p>
        <p class="fest-premios-sub">Para los 3 reseñadores y los 3 autores que más puntos sumen</p>
        ${grupo('reseñador')}
        ${grupo('autor')}
      </div>`;
  }

  // La llama renderPaginaEvento() antes de armar la página.
  async function barrasHtml() {
    _css();
    const est = await _leerEstado();
    if (!est || !est.activa) return '';

    const act = GENEROS[est.generoActual];
    let titulo, sub;
    if (est.estado === 'finalizado') {
      const c = GENEROS[est.campeon];
      titulo = '🏆 Festival de Géneros';
      sub = c ? `Campeón: ${c.icono} ${_esc(c.nombre)}` : 'El festival terminó';
    } else if (est.ronda === 1) {
      titulo = '⚔️ Duelo de géneros';
      sub = `Tu equipo: ${act.icono} ${_esc(act.nombre)} · Cada reto que completes suma puntos a tu género`;
    } else {
      titulo = '🏆 La gran final';
      sub = `Tu equipo: ${act.icono} ${_esc(act.nombre)} · Cada reto que completes suma puntos a tu género`;
    }

    return `
      <div class="evento-progreso-comunitario">
        <p class="evento-progreso-comunitario-titulo">${titulo}</p>
        <div id="fest-barras">${_htmlBarras(est)}</div>
        <p class="evento-progreso-comunitario-sub">${sub}</p>
        ${_htmlPremios(est.rol)}
      </div>`;
  }

  // Refresca solo las barras cada minuto (sin re-dibujar la página).
  function _iniciarPolling() {
    if (_intervalo) clearInterval(_intervalo);
    _intervalo = setInterval(async () => {
      const cont = document.getElementById('fest-barras');
      if (!cont) { clearInterval(_intervalo); _intervalo = null; return; }
      const est = await _leerEstado();
      if (est && est.activa) cont.innerHTML = _htmlBarras(est);
    }, 60000);
  }

  // La llama renderPaginaEvento() después de dibujar la página.
  function alEntrar() {
    if (!_estado || !_estado.activa) return;
    if (!_estado.yaGiro && _estado.estado !== 'finalizado' && !_omitirRuleta && !document.getElementById('fest-overlay')) {
      _abrirRuleta();
    }
    _iniciarPolling();
  }

  // ──────────────────────────────────────────────────────────
  // RULETA (una sola vez; es una capa que se abre, gira y se va)
  // ──────────────────────────────────────────────────────────
  function _svgRueda() {
    const cx = 150, cy = 150, r = 146;
    const pt = (ang, rad) => {
      const t = ang * Math.PI / 180;
      return [cx + rad * Math.sin(t), cy - rad * Math.cos(t)];
    };
    let s = '';
    ORDEN.forEach((clave, i) => {
      const g = GENEROS[clave];
      const a = i * 60;
      const [x1, y1] = pt(a - 30, r);
      const [x2, y2] = pt(a + 30, r);
      s += `<path d="M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z" fill="${g.color}" stroke="#ffffff" stroke-width="3"/>`;
      const dosLineas = g.lineas.length === 2;
      const nombres = g.lineas.map((t, j) => {
        const y = dosLineas ? cy - 88 + j * 14 : cy - 80;
        return `<text x="${cx}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="800" fill="${g.texto}" font-family="system-ui,sans-serif">${t}</text>`;
      }).join('');
      s += `<g transform="rotate(${a} ${cx} ${cy})">` +
           `<text x="${cx}" y="${cy - 116}" text-anchor="middle" dominant-baseline="middle" font-size="26">${g.icono}</text>` +
           nombres + `</g>`;
    });
    return `<svg class="fest-rueda" id="fest-rueda" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-label="Ruleta de géneros">${s}</svg>`;
  }

  function _abrirRuleta() {
    _css();
    const ov = document.createElement('div');
    ov.className = 'fest-overlay';
    ov.id = 'fest-overlay';
    ov.innerHTML = `
      <h2>🎭 Festival de Géneros</h2>
      <p class="fest-sub">Girá la ruleta y descubrí en qué equipo te toca competir</p>
      <div class="fest-rueda-wrap">
        <div class="fest-puntero"></div>
        ${_svgRueda()}
        <button type="button" class="fest-girar" id="fest-btn-girar">GIRAR</button>
      </div>
      <div id="fest-resultado"></div>
      <button type="button" class="fest-omitir" id="fest-btn-omitir">Ahora no</button>`;
    document.body.appendChild(ov);
    document.getElementById('fest-btn-girar').onclick = _girar;
    document.getElementById('fest-btn-omitir').onclick = () => { _omitirRuleta = true; _cerrarRuleta(false); };
  }

  function _cerrarRuleta(refrescar) {
    const ov = document.getElementById('fest-overlay');
    if (ov) ov.remove();
    if (refrescar && typeof renderPaginaEvento === 'function') renderPaginaEvento();
  }

  async function _girar() {
    const btn = document.getElementById('fest-btn-girar');
    const rueda = document.getElementById('fest-rueda');
    const omitir = document.getElementById('fest-btn-omitir');
    if (!btn || !rueda) return;
    btn.disabled = true;
    if (omitir) omitir.style.display = 'none';

    let genero;
    try {
      const { data, error } = await supabaseClient.rpc('festival_girar');
      if (error) throw error;
      genero = data && data.genero;
    } catch (e) {
      console.error('Error al girar la ruleta del festival:', e);
      if (typeof mostrarToast === 'function') mostrarToast('No pudimos girar la ruleta. Probá de nuevo.', 'error');
      btn.disabled = false;
      if (omitir) omitir.style.display = '';
      return;
    }

    const i = ORDEN.indexOf(genero);
    if (i < 0) { btn.disabled = false; return; }
    const jitter = (Math.random() * 30) - 15;              // cae en cualquier punto de la pestaña
    rueda.style.transform = `rotate(${360 * 6 - i * 60 + jitter}deg)`;
    setTimeout(() => _mostrarResultado(genero), 5600);
  }

  function _mostrarResultado(genero) {
    const g = GENEROS[genero];
    const cont = document.getElementById('fest-resultado');
    const btn = document.getElementById('fest-btn-girar');
    if (!cont || !g) return;
    if (btn) btn.style.display = 'none';
    const rival = (_estado && _estado.ronda === 1) ? GENEROS[RIVAL[genero]] : null;
    cont.innerHTML = `
      <div class="fest-resultado" style="--c:${g.color}">
        <div class="fest-resultado-icono">${g.icono}</div>
        <h2>¡Te tocó ${_esc(g.nombre)}!</h2>
        <p>${rival
          ? `Tu duelo es contra ${rival.icono} ${_esc(rival.nombre)}. Cada reto que completes suma puntos a tu género.`
          : 'Cada reto que completes suma puntos a tu género.'}</p>
        <button type="button" class="btn-primario" id="fest-btn-competir">¡A competir!</button>
      </div>`;
    document.getElementById('fest-btn-competir').onclick = () => _cerrarRuleta(true);
  }

  return { aplica, barrasHtml, alEntrar, _svgRueda, ORDEN, GENEROS };
})();

// Un "const" de nivel superior NO queda en window; eventos.js lo busca como window.FestivalGeneros.
window.FestivalGeneros = FestivalGeneros;
