// ============================================================
// evento_primer_beso.js — Indómita Love Club
// Datos del evento "El Primer Beso".
// Este archivo es SOLO DATOS. La lógica genérica vive en eventos.js.
//
// IMPORTANTE: este archivo debe coincidir 1:1 con EventoPrimerBeso.gs
// (backend) en: id, fechaInicio, fechaFin, e imágenes. Si se edita
// algo acá, replicar el cambio también en el backend.
//
// Para activar/desactivar el evento manualmente, cambiar "activo".
// activo + activoPorFecha acá son solo para que el frontend pueda
// pintar instantáneamente sin esperar al backend; la validación
// real y definitiva siempre la hace eventoEstaActivo() en el .gs.
// ============================================================

const EVENTO_PRIMER_BESO = {

  // ────────────────────────────────────────────────────────
  // CONTROL DE ACTIVACIÓN
  // ────────────────────────────────────────────────────────
  id: 'primer_beso', // ← debe coincidir EXACTO con EVENTO_PRIMER_BESO.id en el backend
  activo: true, // ← cambiar a false para desactivar el evento manualmente

  // Si activoPorFecha es true, el evento se activa/desactiva solo
  // según fechaInicio y fechaFin (además de requerir activo: true).
  // Si es false, el flag "activo" manda solo (ignora fechas).
  activoPorFecha: false,
  fechaInicio: '2026-07-01',
  fechaFin:    '2026-07-15',

  // ────────────────────────────────────────────────────────
  // TEXTOS GENERALES
  // ────────────────────────────────────────────────────────
  nombre: 'El Primer Beso',

  textoModal: '¡Comenzó el evento El Primer Beso!\nCumple los retos, suma puntos y gana la insignia exclusiva.',

  historia: {
    titulo: '¿De qué trata?',
    texto: 'Hay historias que comienzan con un suspiro, una mirada o… un beso inolvidable. Durante este evento, completa los cuatro retos, acumula puntos y obtén la insignia Primer Beso. Pero lo más importante... acompáñanos en los nervios, la emoción y lo único de este Primer Beso juntos.'
  },

  // ────────────────────────────────────────────────────────
  // IMÁGENES — URLs absolutas de GitHub (?raw=true), igual que
  // en el backend. NO usar rutas relativas: las imágenes no
  // viven en el repo del frontend desplegado en Vercel.
  // ────────────────────────────────────────────────────────
 imagenes: {
  insigniaColor:   'assets/eventos/primer_beso/insignia_color.png',
  insigniaGris:    'assets/eventos/primer_beso/insignia_gris.png',
  banner:          'assets/eventos/primer_beso/banner.png',
  decoracionModal: 'assets/eventos/primer_beso/modal_decoracion.png',
  fondo:           'assets/eventos/primer_beso/fondo.jpg',
  iconoBeso:       'assets/eventos/primer_beso/icono_beso.png'
  },

  // ────────────────────────────────────────────────────────
  // RETOS POR ROL
  // Cada reto tiene sub-retos. El reto se completa cuando TODOS
  // sus sub-retos llegan a su meta. Los retos son secuenciales:
  // el reto N solo se considera "completado" (a efectos de
  // desbloquear el N+1 y sumar a la insignia) si el reto N-1
  // también está completado. El conteo de acciones se guarda
  // siempre, ocurra en el orden que ocurra.
  //
  // El campo "accion" es solo informativo en el frontend (debug /
  // posible estilizado por tipo). El cálculo real de progreso lo
  // hace siempre el backend vía _configAccionesEvento().
  // ────────────────────────────────────────────────────────

  retos: {

    reseñador: [
      {
        id: 'RETO_RES_1',
        orden: 1,
        nombre: 'El encuentro',
        puntos: 20,
        subRetos: [
          { id: 'SUB_RES_1_1', accion: 'postular_campaña', descripcion: 'Postúlate a dos campañas activas.', meta: 2 }
        ]
      },
      {
        id: 'RETO_RES_2',
        orden: 2,
        nombre: 'La chispa',
        puntos: 30,
        subRetos: [
          { id: 'SUB_RES_2_1', accion: 'ser_aceptado_campaña', descripcion: 'Ser aceptado en dos campañas.', meta: 2 }
        ]
      },
      {
        id: 'RETO_RES_3',
        orden: 3,
        nombre: 'La conexión',
        puntos: 40,
        subRetos: [
          { id: 'SUB_RES_3_1', accion: 'leer_pdf', descripcion: 'Leer un libro en PDF.', meta: 1 },
          { id: 'SUB_RES_3_2', accion: 'revisar_perfil_autor', descripcion: 'Revisa tres perfiles públicos de autores.', meta: 3 }
        ]
      },
      {
        id: 'RETO_RES_4',
        orden: 4,
        nombre: 'El beso',
        puntos: 50,
        subRetos: [
          { id: 'SUB_RES_4_1', accion: 'entregar_reseña', descripcion: 'Entrega dos reseñas.', meta: 2 },
          { id: 'SUB_RES_4_2', accion: 'calificar_libro', descripcion: 'Califica dos libros.', meta: 2 }
        ]
      }
    ],

    autor: [
      {
        id: 'RETO_AUT_1',
        orden: 1,
        nombre: 'El encuentro',
        puntos: 20,
        subRetos: [
          { id: 'SUB_AUT_1_1', accion: 'crear_campaña', descripcion: 'Carga una campaña de tu libro.', meta: 1 }
        ]
      },
      {
        id: 'RETO_AUT_2',
        orden: 2,
        nombre: 'La chispa',
        puntos: 30,
        subRetos: [
          { id: 'SUB_AUT_2_1', accion: 'aprobar_reseñador', descripcion: 'Aprueba tres reseñadores.', meta: 3 }
        ]
      },
      {
        id: 'RETO_AUT_3',
        orden: 3,
        nombre: 'La conexión',
        puntos: 40,
        subRetos: [
          { id: 'SUB_AUT_3_1', accion: 'revisar_perfil_reseñador', descripcion: 'Revisa tres perfiles públicos de reseñadores.', meta: 3 },
          { id: 'SUB_AUT_3_2', accion: 'agregar_libro_biblioteca', descripcion: 'Agrega un libro a tu biblioteca.', meta: 1 }
        ]
      },
      {
        id: 'RETO_AUT_4',
        orden: 4,
        nombre: 'El beso',
        puntos: 50,
        subRetos: [
          { id: 'SUB_AUT_4_1', accion: 'recibir_reseña', descripcion: 'Recibe una reseña.', meta: 1 },
          { id: 'SUB_AUT_4_2', accion: 'calificar_reseña', descripcion: 'Califica una reseña.', meta: 1 }
        ]
      }
    ]
  },

  // Totales informativos (no se usan para cálculo, son para mostrar en UI)
  totalPuntos: {
    reseñador: 140,
    autor: 140
  }
};
