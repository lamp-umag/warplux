/* =========================================================
   motifs.js — dibuja un nudo (celda del telar).
   Vocabulario deliberadamente mínimo: 5 puntos (formas), con
   redondez y hasta tres colores (tinte, matiz, acento).
   Sin dependencias, devuelve SVG como string.
   ========================================================= */

export var PUNTOS = [
  { id: "solido", nombre: "Sólido" },
  { id: "diagonal", nombre: "Diagonal" },
  { id: "esquina", nombre: "Esquina" },
  { id: "punto", nombre: "Punto" },
  { id: "vacio", nombre: "Vacío" }
];

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
  solido: function (tinte, matiz, acento, r) {
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], r), tinte);
  },
  diagonal: function (tinte, matiz, acento, r) {
    var cid = "cd" + (clipSeq++);
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], r), tinte) +
      '<clipPath id="' + cid + '"><path d="' + rpath(0, 0, 100, 100, [1, 1, 1, 1], r) + '"/></clipPath>' +
      '<g clip-path="url(#' + cid + ')"><polygon points="0,100 100,100 100,0" fill="' + matiz + '"/></g>';
  },
  esquina: function (tinte, matiz, acento, r) {
    var k = Math.max(r, 14);
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], r), tinte) +
      path(rpath(46, 46, 54, 54, [1, 0, 0, 0], k), matiz);
  },
  punto: function (tinte, matiz, acento, r) {
    var k = Math.max(r, 12);
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], r), tinte) +
      path(rpath(28, 28, 44, 44, [1, 1, 1, 1], k), matiz) +
      (acento ? path(rpath(41, 41, 18, 18, [1, 1, 1, 1], Math.max(k - 6, 0)), acento) : "");
  },
  vacio: function (tinte, matiz, acento, r) {
    return path(rpath(0, 0, 100, 100, [1, 1, 1, 1], r), tinte);
  }
};

/**
 * Dibuja un nudo. nudo = {punto, tinte, matiz, acento, giro, redondez}
 * size = ancho/alto del viewBox en px lógicos (por defecto 100x100, escala con CSS).
 */
export function dibujarNudo(nudo, opts) {
  opts = opts || {};
  var punto = DRAW[nudo.punto] ? nudo.punto : "solido";
  var tinte = nudo.tinte || "#e7ebe2";
  var matiz = nudo.matiz || tinte;
  var acento = nudo.acento || "";
  var r = typeof nudo.redondez === "number" ? nudo.redondez : 10;
  var giro = nudo.giro || 0;
  var inner = DRAW[punto](tinte, matiz, acento, r);
  var attrs = opts.className ? ' class="' + opts.className + '"' : "";
  return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style="display:block"' + attrs + '>' +
    '<g transform="rotate(' + giro + ' 50 50)">' + inner + '</g></svg>';
}

/** miniatura cuadrada lista para usar como ícono de unidad/paleta */
export function miniaturaNudo(nudo) {
  return dibujarNudo(nudo, {});
}
