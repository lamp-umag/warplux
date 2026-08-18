/* =========================================================
   formularioMesaDefecto.js — estructura por defecto del
   formulario que llenan los hiladores por cada mesa. Vive acá
   (no en un editor de formularios: eso queda para más adelante)
   así que tanto la creación de un telar nuevo como el propio
   formulario de hilador parten del mismo lugar.
   Asume exactamente 6 columnas de contenido (2 por pregunta):
   cada pregunta se responde UNA vez y esa misma respuesta se
   copia a los dos nudos de su par de columnas (quedan
   redundantes a propósito — así se ve el patrón visual del par).
   ========================================================= */

export var FORMULARIO_MESA_DEFECTO = {
  preguntas: [
    { categoria: "desafio", cols: ["c1", "c2"],
      texto: "¿Qué problema importante en Magallanes no se resuelve con el trabajo de una sola carrera, y requiere una mirada interdisciplinaria?" },
    { categoria: "aporte", cols: ["c3", "c4"],
      texto: "¿Qué puedo aportar yo, o el grupo o institución que represento?" },
    { categoria: "cambio", cols: ["c5", "c6"],
      texto: "En 3 años más, con el proyecto avanzado en su ejecución ¿qué debería existir en la UMAG que no existe hoy?" }
  ],
  categoriaLabel: { desafio: "Desafío", cambio: "Cambio", aporte: "Aporte" }
};

/** pares de columnas y su transformación fija: base / rotado / espejado */
export var PARES_MESA = [
  { cols: ["c1", "c2"], giro: 0, espejo: false },
  { cols: ["c3", "c4"], giro: 180, espejo: false },
  { cols: ["c5", "c6"], giro: 0, espejo: true }
];
