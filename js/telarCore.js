import { dibujarNudo } from "./motifs.js";

/* =========================================================
   telarCore.js — render compartido del telar.
   Usado tanto por index.html (lectura pública) como por
   admin.html (edición). No toca Firestore directamente:
   recibe datos ya resueltos y devuelve/inserta HTML.
   ========================================================= */

var PALETA_BANNER = ["#e29f3e", "#85751a", "#bb6f3a", "#3a402f", "#7a8b6a", "#e29f3e", "#85751a"];

/** agrupa nudos de una pasada por hiloId (soporta racimo: >1 nudo por hilo) */
export function agruparPorHilo(nudos) {
  var m = {};
  (nudos || []).forEach(function (n) {
    if (!m[n.hiloId]) m[n.hiloId] = [];
    m[n.hiloId].push(n);
  });
  return m;
}

/** urdimbre estándar: 1 hilo guía + 6 hilos de contenido, ids g,1..6 */
export function urdimbreEstandar() {
  var hilos = [{ id: "g", tipo: "guia" }];
  for (var i = 1; i <= 6; i++) hilos.push({ id: "c" + i, tipo: "contenido" });
  return hilos;
}

/** banda decorativa con el nombre del proyecto (por defecto "TELARES"), no es una pasada real */
export function renderBanner(el, texto) {
  var letras = (texto || "TELARES").split("");
  var html = "";
  for (var i = 0; i < 7; i++) {
    var letra = letras[i] || "";
    var color = PALETA_BANNER[i % PALETA_BANNER.length];
    html += '<div class="banner-letra" style="background:' + color + '">' + letra + "</div>";
  }
  el.innerHTML = html;
}

/** cabecera de hilos (columna guía + 6 columnas de contenido) */
export function renderCabecera(el, hilos, opts) {
  opts = opts || {};
  var html = '<div class="esquina-corner">' + (opts.corner || "") + "</div>";
  hilos.filter(function (h) { return h.tipo === "contenido"; }).forEach(function (h) {
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
 * opts: { hilos, onNudoClick(nudo, pasada, hiloId, todos), onNudoHover, esVisible(nudo), esReciente(nudo), vacioFn(pasada,hiloId) }
 */
export function renderCuerpo(el, pasadas, nudosPorPasada, opts) {
  opts = opts || {};
  var hilosContenido = (opts.hilos || urdimbreEstandar()).filter(function (h) { return h.tipo === "contenido"; });
  var html = "";
  pasadas.forEach(function (pasada) {
    var grupos = agruparPorHilo(nudosPorPasada[pasada.id] || []);
    html += '<div class="pasada" data-pasada="' + pasada.id + '">';
    html += '<div class="pasada-etiqueta">' + (pasada.etiquetaCorta || "") + "</div>";
    hilosContenido.forEach(function (hilo) {
      var lista = (grupos[hilo.id] || []).filter(function (n) {
        return opts.soloTejido ? n.estado === "tejido" : true;
      });
      if (!lista.length) {
        var vacioNudo = (opts.vacioFn && opts.vacioFn(pasada, hilo.id)) || { punto: "vacio", tinte: "#e7ebe2", redondez: 8 };
        var interactivo = opts.vacioInteractivo;
        html += '<button class="nudo vacio" data-pasada="' + pasada.id + '" data-hilo="' + hilo.id +
          '"' + (interactivo ? "" : ' tabindex="-1" aria-hidden="true"') + '>' +
          '<span class="fondo"></span>' + dibujarNudo(vacioNudo) + "</button>";
        return;
      }
      var principal = lista[0];
      var reciente = opts.esReciente && opts.esReciente(principal) ? " recien-tejido" : "";
      var atenuado = opts.esVisible && !lista.some(opts.esVisible) ? " atenuado" : "";
      html += '<button class="nudo' + reciente + atenuado + '" data-pasada="' + pasada.id +
        '" data-hilo="' + hilo.id + '" aria-label="' + (lista.length > 1 ? lista.length + " aportes" : "un aporte") + '">' +
        dibujarNudo(principal) +
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
