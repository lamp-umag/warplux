/* =========================================================
   formularioMesaDefecto.js — estructura por defecto del
   formulario que llenan los hiladores por cada mesa. Vive acá
   (no en un editor de formularios: eso queda para más adelante)
   así que tanto la creación de un telar nuevo como el propio
   formulario de hilador parten del mismo lugar.
   Asume exactamente 6 columnas de contenido (2 por pregunta).
   ========================================================= */

export var FORMULARIO_MESA_DEFECTO = {
  preguntas: [
    "¿Qué problema importante en Magallanes no se resuelve con el trabajo de una sola carrera, y requiere una mirada interdisciplinaria?",
    "En 3 años más, con el proyecto avanzado en su ejecución ¿qué debería existir en la UMAG que no existe hoy?",
    "¿Qué puedo aportar yo, o el grupo o institución que represento?"
  ],
  categoriaPorHilo: { c1: "desafio", c2: "desafio", c3: "cambio", c4: "cambio", c5: "aporte", c6: "aporte" },
  categoriaLabel: { desafio: "Desafío", cambio: "Cambio", aporte: "Aporte" },
  tintePorCategoria: { desafio: "#bb6f3a", cambio: "#e29f3e", aporte: "#7a8b6a" },
  composicionPreguntas: [
    { id: "estudiantes_psicologia", label: "¿Había estudiantes de Psicología?" },
    { id: "estudiantes_trabajo_social", label: "¿Había estudiantes de Trabajo Social?" },
    { id: "estudiantes_derecho", label: "¿Había estudiantes de Derecho?" },
    { id: "academicos_tres_unidades", label: "¿Había académicos/as de esas tres unidades?" },
    { id: "otras_unidades_umag", label: "¿Había estudiantes o académicos/as de otras unidades de la UMAG?" },
    { id: "otros_actores_universidad", label: "¿Había otros actores de la universidad (no académicos)?" },
    { id: "actor_externo", label: "¿Había algún actor externo a la UMAG?" },
    { id: "otro", label: "¿Había alguien más que no calce en lo anterior?" }
  ]
};

/** pares de columnas y su transformación fija: base / rotado / espejado */
export var PARES_MESA = [
  { cols: ["c1", "c2"], giro: 0, espejo: false },
  { cols: ["c3", "c4"], giro: 180, espejo: false },
  { cols: ["c5", "c6"], giro: 0, espejo: true }
];

/** deriva forma y color a partir de qué tan diversa fue la mesa */
export function visualDesdeComposicion(composicion, paleta) {
  composicion = composicion || {};
  var claves = Object.keys(composicion).filter(function (k) { return composicion[k]; });
  var n = claves.length;
  var punto = n <= 1 ? "solido" : n <= 3 ? "diagonal" : n <= 5 ? "esquina" : "punto";
  var porId = {};
  paleta.forEach(function (c) { porId[c.id] = c.hex; });
  var matiz = (composicion.actor_externo || composicion.otro) ? porId.terracota
    : composicion.academicos_tres_unidades ? porId.oliva
    : (composicion.estudiantes_psicologia || composicion.estudiantes_trabajo_social || composicion.estudiantes_derecho) ? porId.dorado
    : porId.crema;
  var acento = n >= 6 ? porId.tinta : null;
  return { punto: punto, matiz: matiz, acento: acento };
}
