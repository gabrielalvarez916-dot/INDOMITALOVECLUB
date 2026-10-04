// ============================================================
// muro.js — Indómita Love Club
// Muro de actividad: pestaña dentro del feed. Muestra SOLO la actividad
// de las personas que la usuaria flechó (sigue). La pestaña "Campañas"
// es siempre la primera y la que se muestra por defecto.
// Datos: RPC mis_muro_actividad (filtra por flechazos del lado del servidor).
// ============================================================

const Muro = (() => {
  const FOTO_DEFAULT = '/api/drive?id=14wvL8QFWA6KWyQ8A5LvR_fYetudgHKsK';
  const LIMITE = 20;
  let _offset = 0;
  let _cargando = false;
  let _pestanaActual = 'campanas';

  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _url(url) {
    if (!url) return '';
    if (url.startsWith('/')) return 'https://indomitaloveclub.vercel.app' + url;
    return url;
  }

  function _estrellas(n) {
    n = Math.max(0, Math.min(5, parseInt(n, 10) || 0));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function _hace(fechaIso) {
    const seg = Math.max(0, Math.floor((Date.now() - new Date(fechaIso).getTime()) / 1000));
    if (seg < 60) return 'recién';
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
    const m = Math.floor(d / 30);
    return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
  }

  // Texto de cada tipo de actividad (alias y datos ya escapados)
  function _armarTexto(it) {
    const a = `<strong>${_esc(it.actor.alias || 'Alguien')}</strong>`;
    const d = it.datos || {};
    const titulo = `«${_esc(d.titulo || 'un libro')}»`;
    switch (it.tipo) {
      case 'campana_creada':
        return { icono: '📣', html: `${a} creó una campaña para ${titulo}` };
      case 'ranking_subio':
        return { icono: '📈', html: `${a} subió en el ranking: del puesto #${_esc(d.posicionAnterior)} al <strong>#${_esc(d.posicionNueva)}</strong>` };
      case 'libro_puesto':
        return {
          icono: d.podio ? '🏆' : '⭐',
          html: `El libro ${titulo} de ${a} ahora está en el puesto <strong>#${_esc(d.puesto)}</strong> ${d.podio ? '(podio)' : 'del Top 20'}`
        };
      case 'reto_evento':
        return {
          icono: '🎯',
          html: `${a} completó ${d.reto ? `el reto «${_esc(d.reto)}»` : 'un reto'}${d.evento ? ` de ${_esc(d.evento)}` : ''} y ganó <strong>${_esc(d.puntos)} puntos</strong>`
        };
      case 'libro_recibio_calificacion':
        return {
          icono: '💬',
          html: `El libro ${titulo} de ${a} recibió <span class="muro-estrellas">${_estrellas(d.estrellas)}</span> de <strong>${_esc(d.aliasResenador || 'una reseñadora')}</strong>`
        };
      case 'resena_entregada':
        return { icono: '📝', html: `${a} entregó la reseña de ${titulo}` };
      case 'libro_calificado':
        return { icono: '⭐', html: `${a} calificó ${titulo} con <span class="muro-estrellas">${_estrellas(d.estrellas)}</span>` };
      default:
        return null;
    }
  }

  function _pintarItems(items, reemplazar) {
    const lista = document.getElementById('muro-lista');
    if (!lista) return;
    const html = items.map(it => {
      const t = _armarTexto(it);
      if (!t) return '';
      const foto = _url(it.actor.fotoPerfil) || FOTO_DEFAULT;
      const portada = it.datos && it.datos.portada ? _url(it.datos.portada) : '';
      return `
        <div class="muro-item" onclick="Muro.verPerfil('${_esc(it.actor.id)}', '${_esc(it.actor.rol)}')">
          <img class="flechazo-foto" src="${_esc(foto)}" alt="" onerror="this.src='${FOTO_DEFAULT}'" />
          <div class="muro-item-cuerpo">
            <div class="muro-item-texto"><span class="muro-item-icono">${t.icono}</span> ${t.html}</div>
            <div class="muro-item-fecha">${_hace(it.fecha)}</div>
            <div class="muro-item-acciones">${MeTienta.boton('actividad', it.id, it.meTienta)}</div>
          </div>
          ${portada ? `<img class="flechazo-portada" src="${_esc(portada)}" alt="" onerror="this.style.display='none'" />` : ''}
        </div>`;
    }).join('');
    if (reemplazar) lista.innerHTML = html; else lista.insertAdjacentHTML('beforeend', html);
  }

  function _vacio(mensaje) {
    const lista = document.getElementById('muro-lista');
    if (lista) lista.innerHTML = `<div class="estado-vacio"><p class="estado-vacio-icono">💘</p><p class="estado-vacio-texto">${mensaje}</p></div>`;
  }

  async function _pedir(reemplazar) {
    if (_cargando) return;
    _cargando = true;
    const lista = document.getElementById('muro-lista');
    const botonMas = document.getElementById('muro-mas');
    if (reemplazar && lista) lista.innerHTML = '<div class="cargando-container"><div class="spinner"></div></div>';
    try {
      const { data, error } = await supabaseClient.rpc('mis_muro_actividad', { p_limite: LIMITE, p_desplazamiento: _offset });
      if (error || !data || data.error) {
        if (reemplazar) _vacio('No se pudo cargar el muro. Probá de nuevo en un rato.');
        return;
      }
      const items = data.items || [];
      if (reemplazar && items.length === 0) {
        _vacio('Todavía no hay actividad. Flechá a autores y reseñadoras desde su perfil para ver acá lo que hacen.');
      } else {
        _pintarItems(items, reemplazar);
      }
      _offset += items.length;
      if (botonMas) botonMas.style.display = data.hayMas ? 'block' : 'none';
    } catch (e) {
      console.error('Muro: error cargando actividad', e);
      if (reemplazar) _vacio('No se pudo cargar el muro. Probá de nuevo en un rato.');
    } finally {
      _cargando = false;
    }
  }

  function cambiarPestana(cual) {
    _pestanaActual = cual;
    const pCamp = document.getElementById('feed-panel-campanas');
    const pMuro = document.getElementById('feed-panel-muro');
    const tCamp = document.getElementById('feed-tab-campanas');
    const tMuro = document.getElementById('feed-tab-muro');
    if (!pCamp || !pMuro) return;
    const verMuro = cual === 'muro';
    pCamp.style.display = verMuro ? 'none' : '';
    pMuro.style.display = verMuro ? 'block' : 'none';
    if (tCamp) tCamp.classList.toggle('activo', !verMuro);
    if (tMuro) tMuro.classList.toggle('activo', verMuro);
    if (verMuro) { _offset = 0; _pedir(true); }
  }

  // Los roles que pueden flechar ven la pestaña; admin / vendedor no.
  function prepararPestanas() {
    const tabs = document.getElementById('feed-tabs');
    if (!tabs) return;
    const rol = (typeof Sesion !== 'undefined' && Sesion.rol) ? Sesion.rol() : null;
    const puede = rol === 'autor' || rol === 'editorial' || rol === 'reseñador';
    tabs.style.display = puede ? '' : 'none';
    if (!puede && _pestanaActual === 'muro') cambiarPestana('campanas');
  }

  function cargarMas() { _pedir(false); }

  function verPerfil(id, rol) {
    if (typeof abrirPerfilPublico === 'function') abrirPerfilPublico(id, rol);
  }

  document.addEventListener('DOMContentLoaded', prepararPestanas);

  return { cambiarPestana, cargarMas, verPerfil, prepararPestanas };
})();
