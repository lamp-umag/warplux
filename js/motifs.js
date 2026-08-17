/* =========================================================
   motifs.js — dibuja un nudo (celda del telar).
   Vocabulario mínimo: 5 puntos (formas), giro + espejo,
   y una paleta cerrada de colores (no color picker libre).
   La redondez (exterior/interior) es una propiedad del
   TELAR completo, no de cada nudo — se pasa como "apariencia".
   Sin dependencias, devuelve SVG como string.
   ========================================================= */

export var PUNTOS = [
  { id: "solido", nombre: "Sólido" },
  { id: "diagonal", nombre: "Diagonal" },
  { id: "esquina", nombre: "Esquina" },
  { id: "punto", nombre: "Punto" },
  { id: "vacio", nombre: "Vacío" }
];

export var PALETA = [
  { id: "crema", hex: "#f1f0ec" },
  { id: "dorado", hex: "#e29f3e" },
  { id: "oliva", hex: "#85751a" },
  { id: "terracota", hex: "#bb6f3a" },
  { id: "tinta", hex: "#3a402f" },
  { id: "liquen", hex: "#7a8b6a" }
];

export var APARIENCIA_DEFECTO = { redondezExterior: 16, redondezInterior: 14, espacioNudos: 3 };

/** rectángulo con control de redondez por esquina. c = [tl,tr,br,bl] booleans */
function rpath(x, y, w, h, c, r) {
  var tl = r * (c[0] ? 1 : 0), tr = r * (c[1] ? 1 : 0),
      br = r * (c[2] ? 1 : 0), bl = r * (c[3] ? 1 : 0);
  return "M" + (x + tl) + " " + y +
    " H" + (x + w - tr) + (tr ? " A" + tr + " " + tr + " 0 0 1 " + (x + w) + " " + (y + tr) : "") +
    " V" + (y + h - br) + (br ? " A" + br + " " + br + " 0 0 1 " + (x + w - br) + " " + (y + h) : "") +
    " H" + (x + bl) + (bl ? " A" + bl + " " + bl + " 0 0 1 " + x + " " + (y + h - bl) : "") +
    " V" + (y + tl) + (tl ? " A" + tl + " " + tl + " 0 0 1 " + (x + tl) + " " + y : "") + " Z";
}
function path(d, fill) { return '<path d="' + d + '" fill="' + fill + '"/>'; }

var clipSeq = 0;
var DRAW = {
  solido: function (tinte, matiz, acento, rExt, rInt) {
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], rExt), tinte);
  },
  diagonal: function (tinte, matiz, acento, rExt, rInt) {
    var cid = "cd" + (clipSeq++);
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], rExt), tinte) +
      '<clipPath id="' + cid + '"><path d="' + rpath(0, 0, 100, 100, [1, 1, 1, 1], rExt) + '"/></clipPath>' +
      '<g clip-path="url(#' + cid + ')"><polygon points="0,100 100,100 100,0" fill="' + matiz + '"/></g>';
  },
  esquina: function (tinte, matiz, acento, rExt, rInt) {
    var k = Math.max(rInt, 14);
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], rExt), tinte) +
      path(rpath(46, 46, 54, 54, [1, 0, 0, 0], k), matiz);
  },
  punto: function (tinte, matiz, acento, rExt, rInt) {
    var k = Math.max(rInt, 12);
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], rExt), tinte) +
      path(rpath(28, 28, 44, 44, [1, 1, 1, 1], k), matiz) +
      (acento ? path(rpath(41, 41, 18, 18, [1, 1, 1, 1], Math.max(k - 6, 0)), acento) : "");
  },
  vacio: function (tinte, matiz, acento, rExt, rInt) {
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], rExt), tinte);
  }
};

/**
 * Dibuja un nudo. nudo = {punto, tinte, matiz, acento, giro, espejo}
 * apariencia = {redondezExterior, redondezInterior} — viene del telar completo.
 */
export function dibujarNudo(nudo, apariencia) {
  apariencia = apariencia || APARIENCIA_DEFECTO;
  var punto = DRAW[nudo.punto] ? nudo.punto : "solido";
  var tinte = nudo.tinte || "#e7ebe2";
  var matiz = nudo.matiz || tinte;
  var acento = nudo.acento || "";
  var rExt = typeof apariencia.redondezExterior === "number" ? apariencia.redondezExterior : APARIENCIA_DEFECTO.redondezExterior;
  var rInt = typeof apariencia.redondezInterior === "number" ? apariencia.redondezInterior : APARIENCIA_DEFECTO.redondezInterior;
  var giro = nudo.giro || 0;
  var inner = DRAW[punto](tinte, matiz, acento, rExt, rInt);
  var t = "";
  if (nudo.espejo) t += "translate(100,0) scale(-1,1) ";
  if (giro) t += "rotate(" + giro + " 50 50) ";
  return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style="display:block">' +
    '<g transform="' + t + '">' + inner + "</g></svg>";
}
