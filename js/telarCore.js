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

/** un nudo "cuenta" para opts.soloTejido/soloConContenido; título O texto ya es contenido, no hace falta ambos */
function filtrarNudos(lista, opts) {
  return (lista || []).filter(function (n) {
    if (opts.soloTejido && n.estado !== "tejido") return false;
    if (opts.soloConContenido && !((n.titulo && n.titulo.trim()) || (n.texto && n.texto.trim()))) return false;
    return true;
  });
}

/**
 * cuerpo del telar. pasadas: [{id, etiquetaCorta, ...}], nudosPorPasada: {pasadaId: [nudo,...]}
 * opts: { hilos, apariencia, onNudoClick(nudo, pasada, hiloId, todos), onNudoHover,
 *         esReciente(nudo), vacioFn(pasada,hiloId), vacioInteractivo,
 *         soloTejido, soloConContenido, resonarGemelos }
 */
export function renderCuerpo(el, pasadas, nudosPorPasada, opts) {
  opts = opts || {};
  var hilosContenido = (opts.hilos || []).filter(function (h) { return h.tipo === "contenido"; });
  var apariencia = opts.apariencia || APARIENCIA_DEFECTO;
  var html = "";
  pasadas.forEach(function (pasada) {
    var grupos = agruparPorHilo(nudosPorPasada[pasada.id] || []);
    // "forzar color": el urdidor puede pedir que esta fila muestre la apariencia real de sus
    // nudos (forma/color ya asignados) aunque todavía no tengan título ni texto — bypassea
    // soloConContenido para esta fila. "atenuado" (true por defecto al activar forzar) hace que
    // esas celdas sin contenido se vean con color pero desaturadas/pálidas, no a todo color.
    var forzar = !!pasada.forzarColor;
    var atenuadoPorDefecto = pasada.atenuado !== false;
    html += '<div class="pasada" data-pasada="' + pasada.id + '" style="grid-template-columns:' +
      GRID_GUIA + " repeat(" + hilosContenido.length + ',minmax(0,1fr));gap:' + apariencia.espacioNudos + 'px">';
    html += '<div class="pasada-etiqueta" title="' + (pasada.nombre || "") + '">' + (pasada.etiquetaCorta || "") + "</div>";
    hilosContenido.forEach(function (hilo) {
      var lista = filtrarNudos(grupos[hilo.id], forzar ? Object.assign({}, opts, { soloConContenido: false }) : opts);
      if (!lista.length) {
        var vacioNudo = (opts.vacioFn && opts.vacioFn(pasada, hilo.id)) || { punto: "vacio", tinte: "#f2f1ed" };
        var interactivo = opts.vacioInteractivo;
        html += '<button class="nudo vacio" data-pasada="' + pasada.id + '" data-hilo="' + hilo.id +
          '" style="background:' + vacioNudo.tinte + '"' + (interactivo ? "" : ' tabindex="-1" aria-hidden="true"') + '>' +
          '<span class="fondo"></span>' + dibujarNudo(vacioNudo, apariencia) + "</button>";
        return;
      }
      var principal = lista[0];
      var sinContenido = !((principal.titulo && principal.titulo.trim()) || (principal.texto && principal.texto.trim()));
      var reciente = opts.esReciente && opts.esReciente(principal) ? " recien-tejido" : "";
      var forzadoAtenuado = forzar && sinContenido && atenuadoPorDefecto ? " forzado-atenuado" : "";
      html += '<button class="nudo' + reciente + forzadoAtenuado + '" data-pasada="' + pasada.id +
        '" data-hilo="' + hilo.id + '" style="background:' + (principal.tinte || "#3a402f") + '" aria-label="' + (lista.length > 1 ? lista.length + " aportes" : "un aporte") + '">' +
        dibujarNudo(principal, apariencia) +
        (lista.length > 1 ? '<span class="racimo-badge">' + lista.length + "</span>" : "") +
        "</button>";
    });
    html += "</div>";
  });
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.gap = (typeof apariencia.espacioNudos === "number" ? apariencia.espacioNudos : APARIENCIA_DEFECTO.espacioNudos) + "px";
  el.innerHTML = html;

  if (opts.onNudoClick || opts.onNudoHover || opts.resonarGemelos) {
    var infoPorBoton = Array.prototype.map.call(el.querySelectorAll("[data-pasada][data-hilo]"), function (btn) {
      var pasadaId = btn.dataset.pasada, hiloId = btn.dataset.hilo;
      var pasada = pasadas.filter(function (p) { return p.id === pasadaId; })[0];
      var opciones = (pasada && pasada.forzarColor) ? Object.assign({}, opts, { soloConContenido: false }) : opts;
      var todos = filtrarNudos((agruparPorHilo(nudosPorPasada[pasadaId] || [])[hiloId] || []), opciones);
      return { btn: btn, pasadaId: pasadaId, hiloId: hiloId, pasada: pasada, todos: todos };
    });

    infoPorBoton.forEach(function (info) {
      // "gemelos": celdas de la MISMA fila que responden la misma pregunta (mesas 2x1 por pregunta,
      // ver formularioMesaDefecto) — se detecta por contenido (pregunta compartida), no por columna fija,
      // así funciona para cualquier armado de columnas.
      var gemelos = [];
      if (opts.resonarGemelos) {
        var pregunta = info.todos[0] && info.todos[0].pregunta;
        if (pregunta) {
          gemelos = infoPorBoton.filter(function (o) {
            return o !== info && o.pasadaId === info.pasadaId && o.todos[0] && o.todos[0].pregunta === pregunta;
          }).map(function (o) { return o.btn; });
        }
      }
      if (opts.onNudoClick) info.btn.addEventListener("click", function (e) { opts.onNudoClick(info.todos[0], info.pasada, info.hiloId, info.todos, info.btn, e, gemelos); });
      if (opts.onNudoHover) info.btn.addEventListener("mouseenter", function () { opts.onNudoHover(info.todos[0], info.pasada, info.hiloId, info.todos, info.btn, gemelos); });
      if (gemelos.length) {
        info.btn.addEventListener("mouseenter", function () { gemelos.forEach(function (g) { g.classList.add("resonando"); }); });
        info.btn.addEventListener("mouseleave", function () { gemelos.forEach(function (g) { g.classList.remove("resonando"); }); });
      }
    });
  }
}

/** btn: un botón, un array de botones (ej. celda + sus gemelas), o null/vacío para solo limpiar */
export function marcarActivo(el, btn) {
  Array.prototype.forEach.call(el.querySelectorAll(".nudo.activo"), function (c) { c.classList.remove("activo"); });
  (Array.isArray(btn) ? btn : (btn ? [btn] : [])).forEach(function (b) { b.classList.add("activo"); });
}
