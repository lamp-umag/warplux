import { db } from "./firebaseClient.js";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo, PUNTOS } from "./motifs.js";

var PROYECTO_ID = "telares";
var HILOS = ["c1", "c2", "c3", "c4", "c5", "c6"];
var NEUTRO = "#c9cdc0"; // color solo de vista previa: el urdidor define forma, no color

var estado = { hilos: HILOS.map(function () { return { punto: "solido", redondez: 16, giro: 0 }; }) };

export function render(el, perfil) {
  el.innerHTML =
    '<p class="notice">Como urdidor/a defines la <strong>forma</strong> que van a tener las próximas filas antes de que ' +
    'lleguen sus contenidos: el punto (forma), la redondez y el giro de cada uno de los 6 hilos. El color siempre lo pone ' +
    'después el contenido real o el grupo al que representa — acá se ve en gris a propósito.</p>' +
    '<div class="pair" style="align-items:start;margin-bottom:16px">' +
      '<div class="field"><label>Nombre de la plantilla</label><input id="pl-nombre" placeholder="Ej: Filas de mesa, versión simple"></div>' +
      '<div class="field"><label>Se aplica a</label><select id="pl-tipo">' +
        '<option value="colaborativa">Filas colaborativas (mesas)</option>' +
        '<option value="institucional">Filas institucionales</option>' +
        '<option value="hilo_suelto">Hilos sueltos (audio)</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="telar" style="margin-bottom:16px">' +
      '<div class="pasada" id="fila-preview"></div>' +
    '</div>' +
    '<div id="editores-hilo" style="display:grid;gap:12px;grid-template-columns:1fr"></div>' +
    '<button class="btn primary" id="btn-guardar-plantilla" style="margin-top:14px">Guardar plantilla</button>' +
    '<h3 style="font-size:.85rem;margin:26px 0 10px">Plantillas guardadas</h3>' +
    '<div id="lista-plantillas"></div>';

  renderEditores(el);
  renderPreview(el);

  el.querySelector("#btn-guardar-plantilla").addEventListener("click", async function () {
    var nombre = el.querySelector("#pl-nombre").value.trim();
    if (!nombre) { el.querySelector("#pl-nombre").focus(); return; }
    var id = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await setDoc(doc(db, "proyectos", PROYECTO_ID, "plantillas", id), {
      nombre: nombre, tipo: el.querySelector("#pl-tipo").value,
      hilos: estado.hilos, creadaPor: perfil.email
    });
    el.querySelector("#pl-nombre").value = "";
  });

  var unsub = onSnapshot(collection(db, "proyectos", PROYECTO_ID, "plantillas"), function (snap) {
    var html = "";
    snap.forEach(function (d) {
      var p = d.data();
      html += '<div class="card" style="margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<div><strong>' + p.nombre + '</strong><div class="ghost">' + p.tipo + '</div></div>' +
          '<button class="btn btn-borrar-plantilla" data-id="' + d.id + '">Borrar</button>' +
        '</div></div>';
    });
    el.querySelector("#lista-plantillas").innerHTML = html || '<p class="estado-vacio">Todavía no hay plantillas.</p>';
    Array.prototype.forEach.call(el.querySelectorAll(".btn-borrar-plantilla"), function (b) {
      b.addEventListener("click", function () { deleteDoc(doc(db, "proyectos", PROYECTO_ID, "plantillas", b.dataset.id)); });
    });
  });

  return function () { unsub(); };
}

function renderEditores(el) {
  var cont = el.querySelector("#editores-hilo");
  cont.innerHTML = HILOS.map(function (hiloId, i) {
    return '<div class="card" data-i="' + i + '" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
      '<strong style="width:60px">Hilo ' + (i + 1) + "</strong>" +
      '<div class="field" style="margin:0;flex:1;min-width:140px"><select class="e-punto">' +
        PUNTOS.filter(function (p) { return p.id !== "vacio"; }).map(function (p) {
          return '<option value="' + p.id + '">' + p.nombre + "</option>";
        }).join("") +
      '</select></div>' +
      '<div class="field" style="margin:0;flex:1;min-width:140px"><input class="e-redondez" type="range" min="0" max="46" value="16"></div>' +
      '<button class="btn e-girar">Girar 90°</button>' +
    '</div>';
  }).join("");

  Array.prototype.forEach.call(cont.querySelectorAll("[data-i]"), function (card) {
    var i = +card.dataset.i;
    card.querySelector(".e-punto").addEventListener("change", function (e) { estado.hilos[i].punto = e.target.value; renderPreview(el); });
    card.querySelector(".e-redondez").addEventListener("input", function (e) { estado.hilos[i].redondez = +e.target.value; renderPreview(el); });
    card.querySelector(".e-girar").addEventListener("click", function () { estado.hilos[i].giro = (estado.hilos[i].giro + 90) % 360; renderPreview(el); });
  });
}

function renderPreview(el) {
  var html = '<div class="pasada-etiqueta">vista</div>';
  estado.hilos.forEach(function (h) {
    html += '<span class="nudo" aria-hidden="true">' + dibujarNudo({ punto: h.punto, redondez: h.redondez, giro: h.giro, tinte: NEUTRO, matiz: "#f1f0ec" }) + "</span>";
  });
  el.querySelector("#fila-preview").innerHTML = html;
}
