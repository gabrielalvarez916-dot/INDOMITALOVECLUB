// ============================================================
// offline-libros.js — Indómita Love Club
// Guarda una copia cifrada del libro en IndexedDB para que el
// visor funcione sin internet. La clave vive en el navegador,
// pero el contenido descifrado solo existe en memoria mientras
// se está leyendo (nunca se escribe un PDF/EPUB suelto en disco).
//
// IMPORTANTE (léelo si tocás este archivo):
// Esto es una fricción anti-copia, no un candado inquebrantable.
// Alguien con conocimientos técnicos podría inspeccionar la clave
// en el navegador. Lo que sí logra: que nadie se lleve sin querer
// un archivo suelto, y que Indómita pueda cortar el acceso de una
// reseñadora puntual (postulación rechazada/campaña cancelada) la
// próxima vez que esa persona tenga internet.
// ============================================================

var OFFLINE_DB_NOMBRE = 'indomita_offline_v1';
var OFFLINE_DB_STORE = 'libros';

function _offlineClave(idCampana, formato) {
  return idCampana + '::' + formato;
}

function _offlineAbrirDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NOMBRE, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_DB_STORE)) {
        db.createObjectStore(OFFLINE_DB_STORE, { keyPath: 'clave' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function _offlineClaveCryptoDesdeB64(claveB64) {
  const binario = atob(claveB64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Guarda el contenido cifrado. Se llama cuando hay internet y ya
// descargamos el archivo real; el arrayBuffer sin cifrar NUNCA se
// guarda, solo se usa un instante en memoria para cifrarlo.
async function guardarLibroOffline(params) {
  const { idCampana, formato, idPostulacion, arrayBuffer, claveB64, vencimiento } = params;
  try {
    const claveCripto = await _offlineClaveCryptoDesdeB64(claveB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, claveCripto, arrayBuffer);

    const db = await _offlineAbrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_DB_STORE, 'readwrite');
      tx.objectStore(OFFLINE_DB_STORE).put({
        clave: _offlineClave(idCampana, formato),
        idCampana, formato, idPostulacion,
        iv, cifrado, claveB64, vencimiento,
        guardadoEn: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    // Si falla el guardado offline (poco espacio, navegador viejo, etc.)
    // no debe romper la lectura online normal.
    console.error('No se pudo guardar el libro offline:', e);
  }
}

// Devuelve { arrayBuffer, vencimiento } si hay una copia offline
// vigente, o null si no hay copia o ya venció. Si venció, la borra.
async function obtenerLibroOffline(idCampana, formato) {
  try {
    const db = await _offlineAbrirDb();
    const registro = await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_DB_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_DB_STORE).get(_offlineClave(idCampana, formato));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!registro) { db.close(); return null; }

    if (new Date(registro.vencimiento).getTime() < Date.now()) {
      await eliminarLibroOffline(idCampana, formato);
      db.close();
      return null;
    }

    const claveCripto = await _offlineClaveCryptoDesdeB64(registro.claveB64);
    const arrayBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: registro.iv }, claveCripto, registro.cifrado
    );
    db.close();
    return { arrayBuffer, vencimiento: registro.vencimiento };
  } catch (e) {
    console.error('No se pudo leer el libro offline:', e);
    return null;
  }
}

async function eliminarLibroOffline(idCampana, formato) {
  try {
    const db = await _offlineAbrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_DB_STORE, 'readwrite');
      tx.objectStore(OFFLINE_DB_STORE).delete(_offlineClave(idCampana, formato));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.error('No se pudo borrar el libro offline:', e);
  }
}

// ────────────────────────────────────────────────────────────
// Orquestador: decide si pedir al servidor (con internet) o usar
// la copia guardada (sin internet). Solo se usa para reseñadores
// leyendo en modalidad "visor" — el flujo de autor/descarga no
// se toca, sigue usando obtenerUrlLibro() como siempre.
// ────────────────────────────────────────────────────────────
async function obtenerLibroConOffline(idCampana, formato, idPostulacion) {
  if (navigator.onLine) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('sin sesión');

      const { data, error } = await supabaseClient.functions.invoke('licencia-offline-libro', {
        body: { id_campana: idCampana, formato }
      });

      if (error || !data || data.revocado) {
        // Acceso ya no vigente (postulación rechazada/campaña cancelada): borramos lo que hubiera guardado.
        await eliminarLibroOffline(idCampana, formato);
        return { error: (data && data.error) || 'No se pudo generar el link de lectura.' };
      }

      const respuesta = await fetch(data.url);
      if (!respuesta.ok) throw new Error('No se pudo descargar el archivo (' + respuesta.status + ')');
      const arrayBuffer = await respuesta.arrayBuffer();

      // Guardamos una copia cifrada para la próxima vez que no haya internet (no bloquea la lectura si falla).
      guardarLibroOffline({
        idCampana, formato, idPostulacion,
        arrayBuffer: arrayBuffer.slice(0), // copia aparte: crypto.subtle.encrypt puede transferir/consumir el buffer original
        claveB64: data.clave_b64,
        vencimiento: data.vencimiento,
      });

      return { arrayBuffer };
    } catch (e) {
      console.error('Fallo la lectura online, probamos con la copia offline:', e);
      const offline = await obtenerLibroOffline(idCampana, formato);
      if (offline) return { arrayBuffer: offline.arrayBuffer };
      return { error: 'No se pudo cargar el archivo.' };
    }
  } else {
    const offline = await obtenerLibroOffline(idCampana, formato);
    if (offline) return { arrayBuffer: offline.arrayBuffer };
    return { error: 'Sin internet no tenemos tu libro guardado todavía. Conectate una vez para poder leerlo después offline.' };
  }
}

window.obtenerLibroConOffline = obtenerLibroConOffline;
