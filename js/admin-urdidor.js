import { db } from "./firebaseClient.js";
import {
  collection, doc, getDoc, setDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo, PUNTOS, PALETA, APARIENCIA_DEFECTO } from "./motifs.js";
import { REGLAS, REGLA_KEYS, aplicarPatron } from "./patrones.js";
import { registrar } from "./historial.js";

var FILAS_PREVIA = 6;
var estado = { proyecto: null, modulo: [{ punto: "solido", giro: 0, espejo: false }], sel: 0, regla: "repetir" };

export function render(el, perfil) {
  el.innerHTML = '<div id="ur-selector"></div><div id="ur-cuerpo" style="margin-top:16px"></div>';
  var unsubCargar = null;
  var unsub = renderSelectorTelar(el.querySelector("#ur-selector"), function (proyecto) {
    if (unsubCargar) unsubCargar();
    estado.proyecto = proyecto;
    estado.modulo = [{ punto: "solido", giro: 0, espejo: false }];
    estado.sel = 0;
    unsubCargar = cargar(el.querySelector("#ur-cuerpo"), perfil);
  });
  return function () { unsub(); if (unsubCargar) unsubCargar(); };
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

function cargar(el, perfil) {
  var proyecto = estado.proyecto;
  var columnas = proyecto.columnas || 6;

  el.innerHTML =
    '<p class="notice">Como urdidor/a defines la <strong>forma</strong> de las próximas filas: un módulo de teselas ' +
    '(punto, giro, espejo) que se repite sobre la trama con una regla. El color y el texto los pone después quien ' +
    'teje — acá se ve en gris a propósito.</p>' +
    '<div class="pair" style="align-items:start;margin-bottom:16px">' +
      '<div class="field"><label>Nombre de la plantilla</label><input id="pl-nombre" placeholder="Ej: Filas de mesa, versión simple"></div>' +
      '<div class="field"><label>Se aplica a</label><select id="pl-tipo">' +
        '<option value="colaborativa">Filas colaborativas (mesas)</option>' +
        '<option value="institucional">Filas institucionales</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="field" style="max-width:420px"><label>Regla de repetición</label><div class="swatches" id="reglas" style="flex-wrap:wrap"></div></div>' +
    '<div id="ur-preview" style="margin-bottom:16px"></div>' +
    '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<button class="btn" id="mod-agregar">Agregar tesela</button>' +
      '<button class="btn" id="mod-quitar">Quitar tesela</button>' +
    '</div>' +
    '<div id="editores-tesela" style="display:grid;gap:12px;grid-template-columns:1fr"></div>' +
    '<button class="btn primary" id="btn-guardar-plantilla" style="margin-top:14px">Guardar plantilla</button>' +
    '<h3 style="font-size:.85rem;margin:26px 0 10px">Plantillas guardadas en este telar</h3>' +
    '<div id="lista-plantillas"></div>';

  el.querySelector("#reglas").innerHTML = REGLA_KEYS.map(function (k) {
    return '<button type="button" class="btn" data-regla="' + k + '" aria-pressed="' + (estado.regla === k) + '" style="border-radius:999px;padding:6px 14px;font-size:.76rem">' + REGLAS[k].nombre + "</button>";
  }).join("");
  Array.prototype.forEach.call(el.querySelectorAll("[data-regla]"), function (b) {
    b.addEventListener("click", function () {
      estado.regla = b.dataset.regla;
      Array.prototype.forEach.call(el.querySelectorAll("[data-regla]"), function (o) { o.setAttribute("aria-pressed", o === b); });
      renderPreview(el, columnas);
    });
  });

  el.querySelector("#mod-agregar").addEventListener("click", function () {
    estado.modulo.push(Object.assign({}, estado.modulo[estado.sel]));
    estado.sel = estado.modulo.length - 1;
    renderEditores(el, columnas);
  });
  el.querySelector("#mod-quitar").addEventListener("click", function () {
    if (estado.modulo.length <= 1) return;
    estado.modulo.splice(estado.sel, 1);
    estado.sel = Math.max(0, estado.sel - 1);
    renderEditores(el, columnas);
  });

  el.querySelector("#btn-guardar-plantilla").addEventListener("click", async function () {
    var nombre = el.querySelector("#pl-nombre").value.trim();
    if (!nombre) { el.querySelector("#pl-nombre").focus(); return; }
    var id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await setDoc(doc(db, "proyectos", proyecto.id, "plantillas", id), {
      nombre: nombre, tipo: el.querySelector("#pl-tipo").value,
      modulo: estado.modulo, regla: estado.regla, creadaPor: perfil.email
    });
    registrar(proyecto.id, { tipo: "plantilla_guardada", resumen: "Plantilla guardada: " + nombre, autor: perfil.email });
    el.querySelector("#pl-nombre").value = "";
  });

  var unsub = onSnapshot(collection(db, "proyectos", proyecto.id, "plantillas"), function (snap) {
    var html = "";
    snap.forEach(function (d) {
      var p = d.data();
      html += '<div class="card" style="margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<div><strong>' + p.nombre + '</strong><div class="ghost">' + p.tipo + " · " + REGLAS[p.regla].nombre + " · " + p.modulo.length + ' teselas</div></div>' +
          '<button class="btn btn-borrar-plantilla" data-id="' + d.id + '">Borrar</button>' +
        '</div></div>';
    });
    el.querySelector("#lista-plantillas").innerHTML = html || '<p class="estado-vacio">Todavía no hay plantillas en este telar.</p>';
    Array.prototype.forEach.call(el.querySelectorAll(".btn-borrar-plantilla"), function (b) {
      b.addEventListener("click", function () { deleteDoc(doc(db, "proyectos", proyecto.id, "plantillas", b.dataset.id)); });
    });
  });

  renderEditores(el, columnas);
  return unsub;
}

function renderEditores(el, columnas) {
  var cont = el.querySelector("#editores-tesela");
  cont.innerHTML = estado.modulo.map(function (t, i) {
    return '<div class="card" data-i="' + i + '" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap' +
      (i === estado.sel ? ";box-shadow:0 0 0 2px var(--accent)" : "") + '">' +
      '<strong style="width:70px">Tesela ' + (i + 1) + "</strong>" +
      '<div class="field" style="margin:0;flex:1;min-width:140px"><select class="e-punto">' +
        PUNTOS.filter(function (p) { return p.id !== "vacio"; }).map(function (p) {
          return '<option value="' + p.id + '"' + (t.punto === p.id ? " selected" : "") + '>' + p.nombre + "</option>";
        }).join("") +
      '</select></div>' +
      '<button class="btn e-girar">Girar (' + (t.giro || 0) + '°)</button>' +
      '<button class="btn e-espejo" aria-pressed="' + !!t.espejo + '">Espejo: ' + (t.espejo ? "sí" : "no") + '</button>' +
    '</div>';
  }).join("");

  Array.prototype.forEach.call(cont.querySelectorAll("[data-i]"), function (card) {
    var i = +card.dataset.i;
    card.addEventListener("click", function (e) {
      if (e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
      estado.sel = i; renderEditores(el, columnas);
    });
    card.querySelector(".e-punto").addEventListener("change", function (e) { estado.modulo[i].punto = e.target.value; renderPreview(el, columnas); });
    card.querySelector(".e-girar").addEventListener("click", function () {
      estado.modulo[i].giro = ((estado.modulo[i].giro || 0) + 90) % 360;
      this.textContent = "Girar (" + estado.modulo[i].giro + "°)";
      renderPreview(el, columnas);
    });
    card.querySelector(".e-espejo").addEventListener("click", function () {
      estado.modulo[i].espejo = !estado.modulo[i].espejo;
      this.setAttribute("aria-pressed", estado.modulo[i].espejo);
      this.textContent = "Espejo: " + (estado.modulo[i].espejo ? "sí" : "no");
      renderPreview(el, columnas);
    });
  });
  renderPreview(el, columnas);
}

function renderPreview(el, columnas) {
  var previewColores = PALETA.filter(function (c) { return c.id !== "crema"; }).map(function (c) { return c.hex; });
  var apariencia = { redondezExterior: (estado.proyecto && estado.proyecto.redondezExterior) || APARIENCIA_DEFECTO.redondezExterior,
    redondezInterior: (estado.proyecto && estado.proyecto.redondezInterior) || APARIENCIA_DEFECTO.redondezInterior };
  var plantilla = { modulo: estado.modulo, regla: estado.regla };
  var html = '<div class="telar" style="padding:12px">';
  for (var r = 0; r < FILAS_PREVIA; r++) {
    html += '<div class="pasada" style="grid-template-columns:minmax(24px,40px) repeat(' + columnas + ',minmax(0,1fr));gap:3px;margin-bottom:3px">';
    html += '<div class="pasada-etiqueta">' + (r + 1) + "</div>";
    for (var c = 0; c < columnas; c++) {
      var forma = aplicarPatron(plantilla, r, c);
      var nudo = { punto: forma.punto, giro: forma.giro, espejo: forma.espejo, tinte: previewColores[c % previewColores.length], matiz: "#f1f0ec" };
      html += '<span class="nudo" aria-hidden="true">' + dibujarNudo(nudo, apariencia) + "</span>";
    }
    html += "</div>";
  }
  html += "</div>";
  el.querySelector("#ur-preview").innerHTML = html;
}
