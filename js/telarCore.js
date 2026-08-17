import { dibujarNudo, APARIENCIA_DEFECTO } from "./motifs.js";

/* =========================================================
   telarCore.js — render compartido del telar.
   Usado tanto por index.html (lectura pública) como por
   admin.html (edición). No toca Firestore directamente:
   recibe datos ya resueltos y devuelve/inserta HTML.
   El número de columnas y el espacio entre nudos son
   propiedades del telar (proyecto), no una constante fija.
   ========================================================= */

var GRID_GUIA = "minmax(24px,40px)";

/** agrupa nudos de una pasada por hiloId (soporta racimo: >1 nudo por hilo) */
export function agruparPorHilo(nudos) {
  var m = {};
  (nudos || []).forEach(function (n) {
    if (!m[n.hiloId]) m[n.hiloId] = [];
    m[n.hiloId].push(n);
  });
  return m;
}

/** urdimbre de un telar: 1 hilo guía + N hilos de contenido, ids g,c1..cN */
export function construirUrdimbre(columnas) {
  var hilos = [{ id: "g", tipo: "guia" }];
  for (var i = 1; i <= columnas; i++) hilos.push({ id: "c" + i, tipo: "contenido", corto: String(i) });
  return hilos;
}

function fijarGrid(el, hilosContenido, espacioNudos) {
  el.style.display = "grid";
  el.style.gridTemplateColumns = GRID_GUIA + " repeat(" + hilosContenido.length + ", minmax(0,1fr))";
  el.style.gap = (typeof espacioNudos === "number" ? espacioNudos : APARIENCIA_DEFECTO.espacioNudos) + "px";
}

/** cabecera de hilos (columna guía + columnas de contenido) */
export function renderCabecera(el, hilos, opts) {
  opts = opts || {};
  var hilosContenido = hilos.filter(function (h) { return h.tipo === "contenido"; });
  fijarGrid(el, hilosContenido, opts.espacioNudos);
  var html = '<div class="esquina-corner">' + (opts.corner || "") + "</div>";
  hilosContenido.forEach(function (h) {
    html += '<button class="hilo-cabecera" data-hilo="' + h.id + '" aria-pressed="' +
      (opts.hiloActivo === h.id ? "true" : "false") + '" title="' + (h.nombre || "") + '">' +
      '<span class="letra">' + (h.corto || h.id) + '</span>' +
      '<span class="nombre">' + (h.nombre || "") + "</span></button>";
  });
  el.innerHTML = html;
  if (opts.onHiloClick) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-hilo]"), function (b) {
      b.addEventListener("click", function () { opts.onHiloClick(b.dataset.hilo); });
    });
  }
}

/**
 * cuerpo del telar. pasadas: [{id, etiquetaCorta, ...}], nudosPorPasada: {pasadaId: [nudo,...]}
 * opts: { hilos, apariencia, onNudoClick(nudo, pasada, hiloId, todos), onNudoHover,
 *         esVisible(nudo), esReciente(nudo), vacioFn(pasada,hiloId), vacioInteractivo }
 */
export function renderCuerpo(el, pasadas, nudosPorPasada, opts) {
  opts = opts || {};
  var hilosContenido = (opts.hilos || []).filter(function (h) { return h.tipo === "contenido"; });
  var apariencia = opts.apariencia || APARIENCIA_DEFECTO;
  var html = "";
  pasadas.forEach(function (pasada) {
    var grupos = agruparPorHilo(nudosPorPasada[pasada.id] || []);
    html += '<div class="pasada" data-pasada="' + pasada.id + '" style="grid-template-columns:' +
      GRID_GUIA + " repeat(" + hilosContenido.length + ',minmax(0,1fr));gap:' + apariencia.espacioNudos + 'px">';
    html += '<div class="pasada-etiqueta">' + (pasada.etiquetaCorta || "") + "</div>";
    hilosContenido.forEach(function (hilo) {
      var lista = (grupos[hilo.id] || []).filter(function (n) {
        return opts.soloTejido ? n.estado === "tejido" : true;
      });
      if (!lista.length) {
        var vacioNudo = (opts.vacioFn && opts.vacioFn(pasada, hilo.id)) || { punto: "vacio", tinte: "#e7ebe2" };
        var interactivo = opts.vacioInteractivo;
        html += '<button class="nudo vacio" data-pasada="' + pasada.id + '" data-hilo="' + hilo.id +
          '"' + (interactivo ? "" : ' tabindex="-1" aria-hidden="true"') + '>' +
          '<span class="fondo"></span>' + dibujarNudo(vacioNudo, apariencia) + "</button>";
        return;
      }
      var principal = lista[0];
      var reciente = opts.esReciente && opts.esReciente(principal) ? " recien-tejido" : "";
      var atenuado = opts.esVisible && !lista.some(opts.esVisible) ? " atenuado" : "";
      html += '<button class="nudo' + reciente + atenuado + '" data-pasada="' + pasada.id +
        '" data-hilo="' + hilo.id + '" aria-label="' + (lista.length > 1 ? lista.length + " aportes" : "un aporte") + '">' +
        dibujarNudo(principal, apariencia) +
        (lista.length > 1 ? '<span class="racimo-badge">' + lista.length + "</span>" : "") +
        "</button>";
    });
    html += "</div>";
  });
  el.innerHTML = html;

  if (opts.onNudoClick || opts.onNudoHover) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-pasada][data-hilo]"), function (btn) {
      var pasadaId = btn.dataset.pasada, hiloId = btn.dataset.hilo;
      var pasada = pasadas.filter(function (p) { return p.id === pasadaId; })[0];
      var todos = (agruparPorHilo(nudosPorPasada[pasadaId] || [])[hiloId] || []);
      if (opts.onNudoClick) btn.addEventListener("click", function () { opts.onNudoClick(todos[0], pasada, hiloId, todos, btn); });
      if (opts.onNudoHover) btn.addEventListener("mouseenter", function () { opts.onNudoHover(todos[0], pasada, hiloId, todos, btn); });
    });
  }
}

export function marcarActivo(el, btn) {
  Array.prototype.forEach.call(el.querySelectorAll(".nudo.activo"), function (c) { c.classList.remove("activo"); });
  if (btn) btn.classList.add("activo");
}
