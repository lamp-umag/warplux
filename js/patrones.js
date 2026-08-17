/* =========================================================
   patrones.js — motor de repetición para el rol urdidor.
   Tomado casi literal de background/telares-taller-de-tramas_2.html:
   un módulo (secuencia de teselas {punto,giro,espejo}) se
   despliega sobre una grilla de r filas × c columnas con una
   regla de repetición. Sin dependencias.
   ========================================================= */

export var REGLAS = {
  repetir: { nombre: "Repetir", fn: function (r, c, L) { return { i: c % L, giro: 0, espejo: false }; } },
  espejo: { nombre: "Espejo", fn: function (r, c, L) { return r % 2 ? { i: (L - 1 - (c % L)), giro: 0, espejo: true } : { i: c % L, giro: 0, espejo: false }; } },
  girar: { nombre: "Girar", fn: function (r, c, L) { return { i: c % L, giro: 90 * (r % 4), espejo: false }; } },
  ladrillo: { nombre: "Ladrillo", fn: function (r, c, L) { return { i: (c + Math.floor(L / 2) * r) % L, giro: 0, espejo: false }; } },
  tejido: { nombre: "Tejido", fn: function (r, c, L) { return { i: (c + r) % L, giro: 180 * (r % 2), espejo: (r % 4 > 1) }; } },
  terraceo: { nombre: "Terraceo", fn: function (r, c, L) { return { i: (c + r * 2) % L, giro: 90 * ((r + c) % 2), espejo: false }; } }
};
export var REGLA_KEYS = Object.keys(REGLAS);

/**
 * Aplica una plantilla {modulo:[{punto,giro,espejo}], regla} a la posición
 * (fila r, columna c). Devuelve {punto,giro,espejo} combinando la tesela del
 * módulo con la transformación extra que agrega la regla.
 */
export function aplicarPatron(plantilla, r, c) {
  var modulo = plantilla.modulo, L = modulo.length;
  var pos = REGLAS[plantilla.regla] ? REGLAS[plantilla.regla].fn(r, c, L) : REGLAS.repetir.fn(r, c, L);
  var tesela = modulo[pos.i] || modulo[0];
  return {
    punto: tesela.punto,
    giro: ((tesela.giro || 0) + pos.giro) % 360,
    espejo: !!tesela.espejo !== !!pos.espejo
  };
}
