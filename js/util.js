/* =========================================================
   util.js — helpers chicos y compartidos.
   ========================================================= */

/** debounce clásico: agrupa llamadas seguidas en una sola, ms después de la última.
 *  expone .flush() para forzar el guardado pendiente de inmediato (ej: al perder foco). */
export function debounce(fn, ms) {
  var t = null, ultimosArgs = null;
  function d() {
    ultimosArgs = arguments;
    clearTimeout(t);
    t = setTimeout(function () { t = null; fn.apply(null, ultimosArgs); }, ms);
  }
  d.flush = function () {
    if (t === null) return;
    clearTimeout(t);
    t = null;
    fn.apply(null, ultimosArgs);
  };
  return d;
}
