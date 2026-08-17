import { db } from "./firebaseClient.js";
import {
  collection, collectionGroup, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { renderCabecera, renderCuerpo, marcarActivo, agruparPorHilo } from "./telarCore.js";
import { dibujarNudo, PUNTOS, PALETA } from "./motifs.js";

var estado = { proyecto: null, pasadas: [], nudosPorPasada: {}, suscritas: {} };

export function render(el, perfil) {
  var unsubs = [];
  el.innerHTML =
    '<div id="tj-selector" style="margin-bottom:14px"></div>' +
    '<div class="tabs" style="margin-bottom:18px">' +
      '<button class="tab" data-tab="telar" aria-selected="true">Telar completo</button>' +
      '<button class="tab" data-tab="cola" aria-selected="false">Cola de moderación</button>' +
    '</div>' +
    '<div id="tejedor-telar">' +
      '<div class="stage">' +
        '<div class="telar"><div id="tj-cabecera" class="telar-cabecera"></div><div id="tj-cuerpo"></div></div>' +
        '<aside class="panel" id="tj-panel"><div id="tj-panel-body"><p class="estado-vacio">Toca un nudo para editarlo.</p></div></aside>' +
      '</div>' +
    '</div>' +
    '<div id="tejedor-cola" hidden><div id="lista-cola-tj"></div></div>';

  Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      el.querySelector("#tejedor-telar").hidden = t.dataset.tab !== "telar";
      el.querySelector("#tejedor-cola").hidden = t.dataset.tab !== "cola";
    });
  });

  var unsubTelar = null;
  var unsubSel = renderSelectorTelar(el.querySelector("#tj-selector"), function (proyecto) {
    if (unsubTelar) unsubTelar();
    estado.proyecto = proyecto;
    estado.nudosPorPasada = {};
    estado.suscritas = {};
    unsubTelar = cargarTelar(el);
  });
  unsubs.push(unsubSel);
  cargarCola(el, unsubs);
  return function () { unsubs.forEach(function (u) { u(); }); if (unsubTelar) unsubTelar(); };
}

function renderSelectorTelar(el, onCambia) {
  el.innerHTML = '<div class="field" style="max-width:320px"><label>Telar</label><select id="sel-telar"></select></div>';
  var sel = el.querySelector("#sel-telar");
  var unsub = onSnapshot(collection(db, "proyectos"), function (snap) {
    var actual = sel.value;
    var opciones = [];
    snap.forEach(function (d) { opciones.push(Object.assign({ id: d.id }, d.data())); });
    sel.innerHTML = opciones.map(function (p) { return '<option value="' + p.id + '">' + p.nombre + "</option>"; }).join("");
    var elegido = opciones.some(function (p) { return p.id === actual; }) ? actual : (opciones[0] && opciones[0].id);
    if (elegido) { sel.value = elegido; onCambia(opciones.filter(function (p) { return p.id === elegido; })[0]); }
  });
  sel.addEventListener("change", async function () {
    var snap = await getDoc(doc(db, "proyectos", sel.value));
    if (snap.exists()) onCambia(Object.assign({ id: sel.value }, snap.data()));
  });
  return unsub;
}

function apariencia() {
  return { redondezExterior: estado.proyecto.redondezExterior, redondezInterior: estado.proyecto.redondezInterior, espacioNudos: estado.proyecto.espacioNudos };
}

function cargarTelar(el) {
  var unsubs = [];
  var qPasadas = query(collection(db, "proyectos", estado.proyecto.id, "pasadas"), orderBy("index"));
  var unsub = onSnapshot(qPasadas, function (snap) {
    estado.pasadas = [];
    snap.forEach(function (d) { estado.pasadas.push(Object.assign({ id: d.id }, d.data())); });
    renderCabecera(el.querySelector("#tj-cabecera"), estado.proyecto.urdimbre, { corner: "pasada", espacioNudos: estado.proyecto.espacioNudos });
    estado.pasadas.forEach(function (p) { suscribirNudos(el, p, unsubs); });
    pintar(el);
  });
  unsubs.push(unsub);
  return function () { unsubs.forEach(function (u) { u(); }); };
}

function suscribirNudos(el, pasada, unsubs) {
  if (estado.suscritas[pasada.id]) return;
  estado.suscritas[pasada.id] = true;
  var col = collection(db, "proyectos", estado.proyecto.id, "pasadas", pasada.id, "nudos");
  var unsub = onSnapshot(col, function (snap) {
    var lista = [];
    snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data())); });
    estado.nudosPorPasada[pasada.id] = lista;
    pintar(el);
  });
  unsubs.push(unsub);
}

function pintar(el) {
  renderCuerpo(el.querySelector("#tj-cuerpo"), estado.pasadas, estado.nudosPorPasada, {
    hilos: estado.proyecto.urdimbre,
    apariencia: apariencia(),
    vacioInteractivo: true,
    onNudoClick: function (nudo, pasada, hiloId, todos, btn) {
      marcarActivo(el.querySelector("#tj-cuerpo"), btn);
      abrirEditor(el, nudo, pasada, hiloId);
    }
  });
  // marca visualmente los nudos crudos
  Array.prototype.forEach.call(el.querySelectorAll("[data-pasada][data-hilo]"), function (btn) {
    var grupo = (agruparPorHilo(estado.nudosPorPasada[btn.dataset.pasada] || [])[btn.dataset.hilo] || []);
    if (grupo.some(function (n) { return n.estado === "crudo"; })) btn.style.outline = "2px dashed var(--accent)";
    else btn.style.outline = "";
  });
}

function swatchesHTML(clase, valorActual, conVacio) {
  var html = PALETA.map(function (c) {
    return '<button type="button" class="swatch-btn ' + clase + '" data-hex="' + c.hex + '" title="' + c.id + '" ' +
      'style="background:' + c.hex + '" aria-pressed="' + (valorActual === c.hex) + '"></button>';
  }).join("");
  if (conVacio) html += '<button type="button" class="swatch-btn vacio ' + clase + '" data-hex="" title="ninguno" aria-pressed="' + (!valorActual) + '"></button>';
  return html;
}

function abrirEditor(el, nudo, pasada, hiloId) {
  var panel = el.querySelector("#tj-panel-body");
  var n = Object.assign({ hiloId: hiloId, punto: "solido", tinte: "#e7ebe2", texto: "", estado: "tejido", giro: 0, espejo: false }, nudo || {});
  panel.innerHTML =
    '<div class="eyebrow">' + (pasada.nombre || pasada.etiquetaCorta) + " · hilo " + hiloId + "</div>" +
    '<div class="field"><label>Punto</label><select id="e-punto">' +
      PUNTOS.map(function (p) { return '<option value="' + p.id + '"' + (n.punto === p.id ? " selected" : "") + '>' + p.nombre + "</option>"; }).join("") +
    '</select></div>' +
    '<div class="field"><label>Tinte</label><div class="swatches" id="e-tinte-cont">' + swatchesHTML("e-tinte", n.tinte, false) + '</div></div>' +
    '<div class="field"><label>Matiz</label><div class="swatches" id="e-matiz-cont">' + swatchesHTML("e-matiz", n.matiz, true) + '</div></div>' +
    '<div class="field"><label>Título (opcional)</label><input id="e-titulo" value="' + (n.titulo || "") + '"></div>' +
    '<div class="field"><label>Texto</label><textarea id="e-texto" maxlength="180">' + (n.texto || "") + '</textarea></div>' +
    '<div class="field"><label>Estado</label><select id="e-estado">' +
      '<option value="tejido"' + (n.estado === "tejido" ? " selected" : "") + '>Tejido (público)</option>' +
      '<option value="crudo"' + (n.estado === "crudo" ? " selected" : "") + '>Crudo (en cola)</option>' +
    '</select></div>' +
    '<button class="btn primary" id="e-guardar">Guardar</button> ' +
    (nudo ? '<button class="btn" id="e-borrar">Borrar</button>' : "");

  var seleccion = { tinte: n.tinte, matiz: n.matiz };
  ["tinte", "matiz"].forEach(function (campo) {
    Array.prototype.forEach.call(panel.querySelectorAll(".e-" + campo), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(panel.querySelectorAll(".e-" + campo), function (o) { o.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        seleccion[campo] = b.dataset.hex || null;
      });
    });
  });

  panel.querySelector("#e-guardar").addEventListener("click", async function () {
    var ref = nudo
      ? doc(db, "proyectos", estado.proyecto.id, "pasadas", pasada.id, "nudos", nudo.id)
      : doc(collection(db, "proyectos", estado.proyecto.id, "pasadas", pasada.id, "nudos"));
    await setDoc(ref, {
      hiloId: hiloId,
      punto: panel.querySelector("#e-punto").value,
      tinte: seleccion.tinte,
      matiz: seleccion.matiz,
      giro: n.giro || 0,
      espejo: !!n.espejo,
      titulo: panel.querySelector("#e-titulo").value,
      texto: panel.querySelector("#e-texto").value,
      estado: panel.querySelector("#e-estado").value,
      fuente: n.fuente || "directo",
      eco: n.eco || false
    }, { merge: true });
  });
  if (nudo) {
    panel.querySelector("#e-borrar").addEventListener("click", async function () {
      await deleteDoc(doc(db, "proyectos", estado.proyecto.id, "pasadas", pasada.id, "nudos", nudo.id));
    });
  }
}

function cargarCola(el, unsubs) {
  var contenedor = el.querySelector("#lista-cola-tj");
  var q = query(collectionGroup(db, "nudos"), where("estado", "==", "crudo"));
  var unsub = onSnapshot(q, function (snap) {
    if (snap.empty) { contenedor.innerHTML = '<p class="estado-vacio">No hay nudos crudos pendientes.</p>'; return; }
    var html = "";
    snap.forEach(function (d) {
      var n = d.data();
      html += '<div class="card" style="margin-bottom:10px" data-ref="' + d.ref.path + '">' +
        '<p class="cita">“' + n.texto + '”</p>' +
        '<div class="meta"><span class="tag">Hilo ' + n.hiloId + '</span></div>' +
        '<button class="btn primary btn-aprobar">Tejer</button> <button class="btn btn-descartar">Descartar</button></div>';
    });
    contenedor.innerHTML = html;
    Array.prototype.forEach.call(contenedor.querySelectorAll("[data-ref]"), function (card) {
      var ref = doc(db, card.dataset.ref);
      card.querySelector(".btn-aprobar").addEventListener("click", function () { updateDoc(ref, { estado: "tejido" }); });
      card.querySelector(".btn-descartar").addEventListener("click", function () { deleteDoc(ref); });
    });
  });
  unsubs.push(unsub);
}
