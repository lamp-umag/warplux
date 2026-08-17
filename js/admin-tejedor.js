import { db } from "./firebaseClient.js";
import {
  collection, collectionGroup, doc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { renderCabecera, renderCuerpo, marcarActivo, agruparPorHilo } from "./telarCore.js";
import { dibujarNudo, PUNTOS } from "./motifs.js";

var PROYECTO_ID = "telares";
var estado = { hilos: [], pasadas: [], nudosPorPasada: {}, suscritas: {} };

export function render(el, perfil) {
  var unsubs = [];
  el.innerHTML =
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

  cargarTelar(el, unsubs);
  cargarCola(el, unsubs);
  return function () { unsubs.forEach(function (u) { u(); }); };
}

function cargarTelar(el, unsubs) {
  var qPasadas = query(collection(db, "proyectos", PROYECTO_ID, "pasadas"), orderBy("index"));
  var unsub = onSnapshot(qPasadas, function (snap) {
    estado.pasadas = [];
    snap.forEach(function (d) { estado.pasadas.push(Object.assign({ id: d.id }, d.data())); });
    if (!estado.hilos.length) {
      estado.hilos = [{ id: "g", tipo: "guia" }];
      for (var i = 1; i <= 6; i++) estado.hilos.push({ id: "c" + i, tipo: "contenido", corto: String(i) });
    }
    renderCabecera(el.querySelector("#tj-cabecera"), estado.hilos, { corner: "pasada" });
    estado.pasadas.forEach(function (p) { suscribirNudos(el, p, unsubs); });
    pintar(el);
  });
  unsubs.push(unsub);
}

function suscribirNudos(el, pasada, unsubs) {
  if (estado.suscritas[pasada.id]) return;
  estado.suscritas[pasada.id] = true;
  var col = collection(db, "proyectos", PROYECTO_ID, "pasadas", pasada.id, "nudos");
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
    hilos: estado.hilos,
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
  });
}

function abrirEditor(el, nudo, pasada, hiloId) {
  var panel = el.querySelector("#tj-panel-body");
  var n = nudo || { hiloId: hiloId, punto: "solido", tinte: "#e7ebe2", redondez: 14, texto: "", estado: "tejido" };
  panel.innerHTML =
    '<div class="eyebrow">' + (pasada.nombre || pasada.etiquetaCorta) + " · hilo " + hiloId + "</div>" +
    '<div class="field"><label>Punto</label><select id="e-punto">' +
      PUNTOS.map(function (p) { return '<option value="' + p.id + '"' + (n.punto === p.id ? " selected" : "") + '>' + p.nombre + "</option>"; }).join("") +
    '</select></div>' +
    '<div class="pair"><div class="field"><label>Tinte</label><input id="e-tinte" type="color" value="' + (n.tinte || "#e7ebe2") + '"></div>' +
    '<div class="field"><label>Matiz</label><input id="e-matiz" type="color" value="' + (n.matiz || "#e7ebe2") + '"></div></div>' +
    '<div class="field"><label>Texto</label><textarea id="e-texto" maxlength="180">' + (n.texto || "") + '</textarea></div>' +
    '<div class="field"><label>Estado</label><select id="e-estado">' +
      '<option value="tejido"' + (n.estado === "tejido" ? " selected" : "") + '>Tejido (público)</option>' +
      '<option value="crudo"' + (n.estado === "crudo" ? " selected" : "") + '>Crudo (en cola)</option>' +
    '</select></div>' +
    '<button class="btn primary" id="e-guardar">Guardar</button> ' +
    (nudo ? '<button class="btn" id="e-borrar">Borrar</button>' : "");

  panel.querySelector("#e-guardar").addEventListener("click", async function () {
    var ref = nudo
      ? doc(db, "proyectos", PROYECTO_ID, "pasadas", pasada.id, "nudos", nudo.id)
      : doc(collection(db, "proyectos", PROYECTO_ID, "pasadas", pasada.id, "nudos"));
    await setDoc(ref, {
      hiloId: hiloId,
      punto: panel.querySelector("#e-punto").value,
      tinte: panel.querySelector("#e-tinte").value,
      matiz: panel.querySelector("#e-matiz").value,
      redondez: n.redondez || 14,
      texto: panel.querySelector("#e-texto").value,
      estado: panel.querySelector("#e-estado").value,
      fuente: n.fuente || "directo",
      eco: n.eco || false
    }, { merge: true });
  });
  if (nudo) {
    panel.querySelector("#e-borrar").addEventListener("click", async function () {
      await deleteDoc(doc(db, "proyectos", PROYECTO_ID, "pasadas", pasada.id, "nudos", nudo.id));
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
