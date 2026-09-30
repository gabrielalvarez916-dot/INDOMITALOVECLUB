// ============================================================
// festival-generos.js — Indómita Love Club
// MÓDULO TEMPORAL: solo existe para el evento "Festival de Géneros"
// (octubre 2026). Se activa ÚNICAMENTE si el evento activo tiene un
// id que empieza con "FestivalGeneros" (FestivalGeneros_R1 / _R2).
// Con cualquier otro evento no hace nada.
//
// Para sacarlo cuando termine el festival:
//   1. Borrar este archivo.
//   2. Borrar su <script> en app.html.
//   3. Borrar el bloque marcado "FESTIVAL DE GÉNEROS (temporal)" en
//      renderPaginaEvento() de eventos.js.
// Todo el CSS vive en este archivo (se inyecta solo), no toca styles.css.
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

  let _intervaloPolling = null;

  function aplica(evento) {
    return !!evento && typeof evento.id === 'string' && evento.id.indexOf('FestivalGeneros') === 0;
  }

  function _esc(t) {
    if (typeof _escaparHtml === 'function') return _escaparHtml(String(t == null ? '' : t));
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function _rgba(hex, alfa) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
  }

  // ──────────────────────────────────────────────────────────
  // CSS (se inyecta una sola vez)
  // ──────────────────────────────────────────────────────────
  function _css() {
    if (document.getElementById('fest-gen-css')) return;
    const st = document.createElement('style');
    st.id = 'fest-gen-css';
    st.textContent = `
      .fest-wrap{position:relative;overflow:hidden;border-radius:18px;background:radial-gradient(120% 120% at 50% 0%,#2a1d57 0%,#0d0a1c 72%);color:#fff;padding:20px 14px 24px;margin-bottom:16px}
      .fest-wrap canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      .fest-wrap > *:not(canvas){position:relative;z-index:1}
      .fest-titulo{text-align:center;margin:0 0 4px;font-size:1.35rem;color:#fff}
      .fest-sub{text-align:center;opacity:.88;margin:0 0 12px;font-size:.92rem}
      .fest-wrap .evento-tiempo-restante{color:#fff;text-align:center;margin:8px 0 0}
      .fest-rueda-wrap{position:relative;width:min(84vw,310px);margin:22px auto 8px}
      .fest-rueda{display:block;width:100%;height:auto;border-radius:50%;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5));transition:transform 5.4s cubic-bezier(.12,.6,.12,1)}
      .fest-puntero{position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:28px solid #fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));z-index:3}
      .fest-girar{position:absolute;top:50%;left:50%;width:27%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-weight:800;font-size:.95rem;letter-spacing:.5px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.55);z-index:2}
      .fest-girar:disabled{opacity:.75;cursor:default}
      .fest-resultado{text-align:center;margin:14px auto 0;padding:16px 14px;max-width:340px;border-radius:16px;background:rgba(255,255,255,.08);border:2px solid var(--c);animation:fest-pop .5s ease}
      .fest-resultado-icono{font-size:2.6rem;line-height:1}
      .fest-resultado h2{margin:6px 0 4px;color:#fff;font-size:1.25rem}
      .fest-resultado p{margin:0 0 12px;opacity:.9;font-size:.92rem}
      @keyframes fest-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
      .fest-barra{margin:12px 0}
      .fest-barra-top{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:.95rem;margin-bottom:5px}
      .fest-barra-top small{font-weight:500;opacity:.8;margin-left:4px}
      .fest-barra-pista{height:18px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
      .fest-barra-relleno{height:100%;border-radius:99px;min-width:0;transition:width .9s ease;box-shadow:0 0 12px var(--c)}
      .fest-barra--propia .fest-barra-pista{outline:2px solid rgba(255,255,255,.65);outline-offset:2px}
      .fest-aviso{text-align:center;margin:12px 0 0;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.1);font-size:.9rem}
      .fest-campeon{text-align:center;font-size:1.1rem;font-weight:800;margin:10px 0 4px}
      .fest-retos{margin-top:4px}
    `;
    document.head.appendChild(st);
  }

  // ──────────────────────────────────────────────────────────
  // FONDO DE NODOS (canvas, se detiene solo si el elemento sale del DOM)
  // ──────────────────────────────────────────────────────────
  function _nodos(wrap, colorHex) {
    if (!wrap) return;
    const canvas = document.createElement('canvas');
    wrap.insertBefore(canvas, wrap.firstChild);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, pts = [];
    const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function medir() {
      const r = wrap.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(18, Math.min(46, Math.round((w * h) / 9000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35
      }));
    }

    function dibujar() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 110) {
            ctx.strokeStyle = _rgba(colorHex, (1 - d / 110) * 0.35);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = _rgba(colorHex, 0.85);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function paso() {
      if (!document.body.contains(canvas)) return;   // el evento se re-renderizó o se cerró
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      dibujar();
      requestAnimationFrame(paso);
    }

    medir();
    dibujar();
    if (!quieto) requestAnimationFrame(paso);
  }

  // ──────────────────────────────────────────────────────────
  // RULETA
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

  function _htmlRuleta(evento, extras) {
    return `
      <div class="fest-wrap" id="fest-wrap">
        <h1 class="fest-titulo">🎭 ${_esc(evento.nombre)}</h1>
        <p class="fest-sub">Girá la ruleta y descubrí en qué equipo te toca competir</p>
        <div class="fest-rueda-wrap" id="fest-rueda-wrap">
          <div class="fest-puntero"></div>
          ${_svgRueda()}
          <button type="button" class="fest-girar" id="fest-btn-girar">GIRAR</button>
        </div>
        <div id="fest-resultado"></div>
        ${extras.tiempoHtml || ''}
      </div>`;
  }

  async function _girar(est) {
    const btn = document.getElementById('fest-btn-girar');
    const rueda = document.getElementById('fest-rueda');
    if (!btn || !rueda) return;
    btn.disabled = true;

    let genero;
    try {
      const { data, error } = await supabaseClient.rpc('festival_girar');
      if (error) throw error;
      genero = data && data.genero;
    } catch (e) {
      console.error('Error al girar la ruleta del festival:', e);
      if (typeof mostrarToast === 'function') mostrarToast('No pudimos girar la ruleta. Probá de nuevo.', 'error');
      btn.disabled = false;
      return;
    }

    const i = ORDEN.indexOf(genero);
    if (i < 0) { btn.disabled = false; return; }
    const vueltas = 360 * 6;
    const jitter = (Math.random() * 30) - 15;              // cae en cualquier punto de la pestaña
    rueda.style.transform = `rotate(${vueltas - i * 60 + jitter}deg)`;

    setTimeout(() => _mostrarResultado(genero, est), 5600);
  }

  function _mostrarResultado(genero, est) {
    const g = GENEROS[genero];
    const cont = document.getElementById('fest-resultado');
    const btn = document.getElementById('fest-btn-girar');
    if (!cont || !g) return;
    if (btn) btn.style.display = 'none';
    const rivalClave = est.ronda === 1 ? _rival(genero) : null;
    const rival = rivalClave ? GENEROS[rivalClave] : null;
    cont.innerHTML = `
      <div class="fest-resultado" style="--c:${g.color}">
        <div class="fest-resultado-icono">${g.icono}</div>
        <h2>¡Te tocó ${_esc(g.nombre)}!</h2>
        <p>${rival
          ? `Tu duelo es contra ${rival.icono} ${_esc(rival.nombre)}. Cada reto que completes suma puntos a tu género.`
          : 'Cada reto que completes suma puntos a tu género.'}</p>
        <button type="button" class="btn-primario" id="fest-btn-competir">¡A competir!</button>
      </div>`;
    const b = document.getElementById('fest-btn-competir');
    if (b) b.onclick = () => { if (typeof renderPaginaEvento === 'function') renderPaginaEvento(); };
  }

  function _rival(clave) {
    return ({ romance: 'thriller', thriller: 'romance', no_ficcion: 'terror', terror: 'no_ficcion',
              fantasia: 'ciencia_ficcion', ciencia_ficcion: 'fantasia' })[clave] || null;
  }

  // ──────────────────────────────────────────────────────────
  // BARRAS DE PROGRESO
  // ──────────────────────────────────────────────────────────
  function _htmlBarras(est) {
    const maxP = Math.max(1, ...est.barras.map(b => b.puntos));
    return est.barras.map(b => {
      const g = GENEROS[b.genero];
      if (!g) return '';
      const pct = Math.round((b.puntos / maxP) * 100);
      return `
        <div class="fest-barra ${b.propio ? 'fest-barra--propia' : ''}" data-genero="${b.genero}">
          <div class="fest-barra-top">
            <span>${g.icono} ${_esc(g.nombre)}${b.propio ? '<small>· tu equipo</small>' : ''}</span>
            <span class="fest-barra-pts">${b.puntos} pts</span>
          </div>
          <div class="fest-barra-pista">
            <div class="fest-barra-relleno" style="--c:${g.color};width:${pct}%;background:${g.color};"></div>
          </div>
        </div>`;
    }).join('');
  }

  function _htmlPanel(evento, est, extras) {
    const ini = GENEROS[est.generoInicial];
    const act = GENEROS[est.generoActual];
    let titulo, sub = '', aviso = '';

    if (est.estado === 'finalizado') {
      const c = GENEROS[est.campeon];
      titulo = '🏆 Festival de Géneros';
      sub = c ? `<p class="fest-campeon">Campeón: ${c.icono} ${_esc(c.nombre)}</p>` : '';
    } else if (est.ronda === 1) {
      const rival = GENEROS[_rival(est.generoInicial)];
      titulo = '⚔️ Duelo de géneros';
      sub = `<p class="fest-sub">${ini.icono} ${_esc(ini.nombre)} vs ${rival.icono} ${_esc(rival.nombre)} · Completá retos para sumar puntos a tu equipo</p>`;
    } else {
      titulo = '🏆 La gran final';
      sub = `<p class="fest-sub">Tres géneros siguen en carrera. ¡Todo se define acá!</p>`;
      if (est.generoInicial !== est.generoActual) {
        aviso = `<p class="fest-aviso">${ini.icono} ${_esc(ini.nombre)} cayó en su duelo y ahora sumás para ${act.icono} <b>${_esc(act.nombre)}</b>.</p>`;
      } else {
        aviso = `<p class="fest-aviso">${act.icono} ¡Tu equipo ganó su duelo y pasó a la final!</p>`;
      }
    }

    return `
      <div class="fest-wrap" id="fest-wrap">
        <h1 class="fest-titulo">${titulo}</h1>
        ${sub}
        <div id="fest-barras">${_htmlBarras(est)}</div>
        ${aviso}
        ${extras.tiempoHtml || ''}
      </div>`;
  }

  // Actualiza solo las barras (sin re-renderizar toda la página).
  function _iniciarPolling() {
    if (_intervaloPolling) clearInterval(_intervaloPolling);
    _intervaloPolling = setInterval(async () => {
      const cont = document.getElementById('fest-barras');
      if (!cont) { clearInterval(_intervaloPolling); _intervaloPolling = null; return; }
      try {
        const { data, error } = await supabaseClient.rpc('festival_mi_estado');
        if (error || !data || !data.activa) return;
        cont.innerHTML = _htmlBarras(data);
      } catch (e) { /* silencioso: se reintenta en el próximo ciclo */ }
    }, 60000);
  }

  // ──────────────────────────────────────────────────────────
  // ENTRADA: la llama renderPaginaEvento() solo si aplica(evento)
  // ──────────────────────────────────────────────────────────
  async function renderizar(contenedor, evento, progreso, extras) {
    _css();
    extras = extras || {};
    let est = null;
    try {
      const { data, error } = await supabaseClient.rpc('festival_mi_estado');
      if (!error) est = data;
    } catch (e) {
      console.error('Error al leer el estado del festival:', e);
    }

    const retos = `<div class="fest-retos">${extras.retosHtml || ''}</div>`;

    // Sin festival en curso para este usuario (o todavía en preparación): encabezado simple + retos.
    if (!est || !est.activa) {
      contenedor.innerHTML = `
        <div class="fest-wrap" id="fest-wrap">
          <h1 class="fest-titulo">🎭 ${_esc(evento.nombre)}</h1>
          <p class="fest-sub">${_esc(evento.historia || '')}</p>
          ${extras.tiempoHtml || ''}
        </div>${retos}`;
      _nodos(document.getElementById('fest-wrap'), '#a78bfa');
      return;
    }

    const color = (GENEROS[est.generoActual] || {}).color || '#a78bfa';

    // Todavía no giró: solo ruleta (los retos aparecen después de girar).
    if (!est.yaGiro && est.estado !== 'finalizado') {
      contenedor.innerHTML = _htmlRuleta(evento, extras);
      _nodos(document.getElementById('fest-wrap'), '#a78bfa');
      const btn = document.getElementById('fest-btn-girar');
      if (btn) btn.onclick = () => _girar(est);
      return;
    }

    contenedor.innerHTML = _htmlPanel(evento, est, extras) + retos;
    _nodos(document.getElementById('fest-wrap'), color);
    _iniciarPolling();
  }

  return { aplica, renderizar, _svgRueda, ORDEN, GENEROS };
})();
