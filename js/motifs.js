/* =========================================================
   motifs.js — dibuja un nudo (celda del telar).
   Vocabulario de teselas tomado de tiles/ (board_2.html,
   preview.html, palette.json): 7 formas geométricas planas
   de dos colores (tinte/matiz) que embonan sin bordes cuando
   están una junto a otra — así se arman los arcos y rombos
   grandes que cruzan varios nudos. Sin dependencias, SVG string.
   ========================================================= */

export var PUNTOS = [
  { id: "solido", nombre: "Sólido" },
  { id: "arc-tl", nombre: "Arco ↖" },
  { id: "arc-tr", nombre: "Arco ↗" },
  { id: "arc-bl", nombre: "Arco ↙" },
  { id: "arc-br", nombre: "Arco ↘" },
  { id: "diag-tlbr", nombre: "Diagonal ↘" },
  { id: "diag-trbl", nombre: "Diagonal ↙" },
  { id: "vacio", nombre: "Vacío" }
];

export var PALETA = [
  { id: "forest", hex: "#3a402f" },
  { id: "olive", hex: "#85751a" },
  { id: "amber", hex: "#e29f3e" },
  { id: "rust", hex: "#bb6f3a" },
  { id: "cream", hex: "#f2f1ed" }
];

export var APARIENCIA_DEFECTO = { espacioNudos: 0 };

function path(d, fill) { return '<path d="' + d + '" fill="' + fill + '"/>'; }
function rect(fill) { return '<rect width="100" height="100" fill="' + fill + '"/>'; }

var DRAW = {
  solido: function (a) { return rect(a); },
  "arc-tl": function (a, b) { return rect(b) + path("M0,0 L100,0 A100,100 0 0 1 0,100 Z", a); },
  "arc-tr": function (a, b) { return rect(b) + path("M100,0 L100,100 A100,100 0 0 1 0,0 Z", a); },
  "arc-bl": function (a, b) { return rect(b) + path("M0,100 L0,0 A100,100 0 0 1 100,100 Z", a); },
  "arc-br": function (a, b) { return rect(b) + path("M100,100 L0,100 A100,100 0 0 1 100,0 Z", a); },
  "diag-tlbr": function (a, b) { return path("M0,0 L100,0 L100,100 Z", b) + path("M0,0 L100,100 L0,100 Z", a); },
  "diag-trbl": function (a, b) { return path("M0,0 L100,0 L0,100 Z", b) + path("M100,0 L100,100 L0,100 Z", a); },
  vacio: function (a) { return rect(a); }
};

/**
 * Dibuja un nudo. nudo = {punto, tinte, matiz, giro, espejo}
 * tinte = color A (protagonista), matiz = color B (campo/fondo).
 */
export function dibujarNudo(nudo, apariencia) {
  var punto = DRAW[nudo.punto] ? nudo.punto : "solido";
  var tinte = nudo.tinte || "#3a402f";
  var matiz = nudo.matiz || tinte;
  var giro = nudo.giro || 0;
  var inner = DRAW[punto](tinte, matiz);
  var t = "";
  if (nudo.espejo) t += "translate(100,0) scale(-1,1) ";
  if (giro) t += "rotate(" + giro + " 50 50) ";
  return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style="display:block">' +
    (t ? '<g transform="' + t + '">' + inner + "</g>" : inner) + "</svg>";
}
