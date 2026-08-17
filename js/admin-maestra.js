import { db } from "./firebaseClient.js";
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo, PUNTOS } from "./motifs.js";
import { ROLES, ROL_LABEL } from "./auth.js";

var PROYECTO_ID = "telares"; // única instancia por ahora; el resto de la UI ya es genérica.

export function render(el, perfil) {
  var unsubs = [];
  el.innerHTML =
    '<div class="tabs" role="tablist" style="margin-bottom:18px">' +
      '<button class="tab" data-tab="siembra" aria-selected="true">Siembra</button>' +
      '<button class="tab" data-tab="estructura" aria-selected="false">Filas y apariencia</button>' +
      '<button class="tab" data-tab="cola" aria-selected="false">Cola de moderación</button>' +
      '<button class="tab" data-tab="roles" aria-selected="false">Personas y roles</button>' +
    '</div>' +
    '<div id="panel-siembra"></div>' +
    '<div id="panel-estructura" hidden></div>' +
    '<div id="panel-cola" hidden></div>' +
    '<div id="panel-roles" hidden></div>';

  Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      ["siembra", "estructura", "cola", "roles"].forEach(function (k) {
        el.querySelector("#panel-" + k).hidden = k !== t.dataset.tab;
      });
    });
  });

  renderSiembra(el.querySelector("#panel-siembra"), perfil);
  renderEstructura(el.querySelector("#panel-estructura"), unsubs);
  renderCola(el.querySelector("#panel-cola"), unsubs);
  renderRoles(el.querySelector("#panel-roles"), unsubs);

  return function () { unsubs.forEach(function (u) { u(); }); };
}

/* ================= SIEMBRA ================= */
function renderSiembra(el, perfil) {
  el.innerHTML =
    '<div class="card" style="max-width:640px">' +
      '<h2 style="font-size:1rem;margin-bottom:8px">Sembrar el telar de TELARES</h2>' +
      '<p class="ghost">Lee <code>proyectos/telares/seed.json</code> y escribe la urdimbre, las filas institucionales ' +
      'y las 12 filas de mesa (vacías) en Firestore. Se puede correr más de una vez: no duplica nudos sembrados, ' +
      'los vuelve a escribir encima.</p>' +
      '<button class="btn primary" id="btn-sembrar" style="margin-top:10px">Sembrar / actualizar</button>' +
      '<p class="ghost" id="siembra-estado" style="margin-top:10px"></p>' +
    '</div>';

  el.querySelector("#btn-sembrar").addEventListener("click", async function () {
    var boton = el.querySelector("#btn-sembrar");
    var estadoEl = el.querySelector("#siembra-estado");
    boton.disabled = true; estadoEl.textContent = "Leyendo seed.json…";
    try {
      var res = await fetch("proyectos/telares/seed.json");
      var seed = await res.json();

      estadoEl.textContent = "Escribiendo proyecto…";
      var proyectoRef = doc(db, "proyectos", PROYECTO_ID);
      await setDoc(proyectoRef, Object.assign({}, seed.proyecto, { creadoPor: perfil.email }), { merge: true });

      for (var i = 0; i < seed.pasadas.length; i++) {
        var p = seed.pasadas[i];
        estadoEl.textContent = "Escribiendo pasada " + p.id + "…";
        var pasadaRef = doc(db, "proyectos", PROYECTO_ID, "pasadas", p.id);
        await setDoc(pasadaRef, { index: p.index, tipo: p.tipo, etiquetaCorta: p.etiquetaCorta, nombre: p.nombre }, { merge: true });
        var nudosCol = collection(pasadaRef, "nudos");
        for (var j = 0; j < (p.nudos || []).length; j++) {
          var n = p.nudos[j];
          var nudoRef = doc(nudosCol, "sembrado_" + n.hiloId);
          await setDoc(nudoRef, {
            hiloId: n.hiloId, punto: n.punto || "solido", tinte: n.tinte || "#e7ebe2",
            matiz: n.matiz || null, acento: n.acento || null,
            redondez: typeof n.redondez === "number" ? n.redondez : seed.proyecto.redondezDefault,
            giro: n.giro || 0, texto: n.texto || "", estado: "tejido", fuente: "sembrado", eco: false
          }, { merge: true });
        }
      }

      var col = seed.pasadasColaborativas;
      for (var m = 1; m <= col.cantidad; m++) {
        var idMesa = col.prefijoId + String(m).padStart(2, "0");
        estadoEl.textContent = "Preparando mesa " + m + "…";
        await setDoc(doc(db, "proyectos", PROYECTO_ID, "pasadas", idMesa), {
          index: seed.pasadas.length + m, tipo: col.tipo, etiquetaCorta: "M" + m,
          nombre: "Mesa " + m, categoriaPorHilo: col.categoriaPorHilo, tintePorCategoria: col.tintePorCategoria
        }, { merge: true });
      }

      estadoEl.textContent = "Listo. El telar de TELARES está sembrado.";
    } catch (e) {
      estadoEl.textContent = "Error sembrando: " + e.message;
    } finally {
      boton.disabled = false;
    }
  });
}

/* ================= ESTRUCTURA / APARIENCIA (filas institucionales) ================= */
function renderEstructura(el, unsubs) {
  el.innerHTML = '<div class="pair" style="align-items:start">' +
    '<div class="field"><label>Fila a editar</label><select id="sel-pasada"></select></div>' +
    '<div></div></div><div id="editor-nudos"></div>';

  var qPasadas = query(collection(db, "proyectos", PROYECTO_ID, "pasadas"), orderBy("index"));
  var unsub = onSnapshot(qPasadas, function (snap) {
    var pasadas = [];
    snap.forEach(function (d) { pasadas.push(Object.assign({ id: d.id }, d.data())); });
    var sel = el.querySelector("#sel-pasada");
    var actual = sel.value;
    sel.innerHTML = pasadas.map(function (p) {
      return '<option value="' + p.id + '">' + p.index + " · " + (p.nombre || p.id) + "</option>";
    }).join("");
    if (actual && pasadas.some(function (p) { return p.id === actual; })) sel.value = actual;
    sel.onchange = function () { cargarEditorPasada(el.querySelector("#editor-nudos"), sel.value, unsubs); };
    if (!el.dataset.cargado && pasadas.length) {
      el.dataset.cargado = "1";
      cargarEditorPasada(el.querySelector("#editor-nudos"), sel.value, unsubs);
    }
  });
  unsubs.push(unsub);
}

function cargarEditorPasada(el, pasadaId, unsubs) {
  var nudosCol = collection(db, "proyectos", PROYECTO_ID, "pasadas", pasadaId, "nudos");
  var unsub = onSnapshot(nudosCol, function (snap) {
    var porHilo = {};
    snap.forEach(function (d) { porHilo[d.data().hiloId] = Object.assign({ id: d.id }, d.data()); });
    var hilos = ["c1", "c2", "c3", "c4", "c5", "c6"];
    el.innerHTML = '<div style="display:grid;gap:14px;grid-template-columns:1fr">' +
      hilos.map(function (hiloId) {
        var n = porHilo[hiloId] || { hiloId: hiloId, punto: "solido", tinte: "#e7ebe2", redondez: 14, texto: "" };
        return '<div class="card" data-hilo="' + hiloId + '">' +
          '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">' +
            '<div class="mini-preview" style="width:60px;height:60px;flex:0 0 auto">' + dibujarNudo(n) + '</div>' +
            '<div style="flex:1;min-width:220px">' +
              '<div class="pair">' +
                '<div class="field"><label>Punto</label><select class="in-punto">' +
                  PUNTOS.map(function (p) { return '<option value="' + p.id + '"' + (n.punto === p.id ? " selected" : "") + '>' + p.nombre + "</option>"; }).join("") +
                '</select></div>' +
                '<div class="field"><label>Redondez</label><input class="in-redondez" type="range" min="0" max="46" value="' + (n.redondez || 14) + '"></div>' +
              '</div>' +
              '<div class="pair">' +
                '<div class="field"><label>Tinte</label><input class="in-tinte" type="color" value="' + (n.tinte || "#e7ebe2") + '"></div>' +
                '<div class="field"><label>Matiz</label><input class="in-matiz" type="color" value="' + (n.matiz || "#e7ebe2") + '"></div>' +
              '</div>' +
              '<div class="field"><label>Texto</label><textarea class="in-texto" maxlength="180">' + (n.texto || "") + '</textarea></div>' +
              '<button class="btn primary btn-guardar">Guardar nudo</button>' +
            '</div>' +
          '</div></div>';
      }).join("") + "</div>";

    Array.prototype.forEach.call(el.querySelectorAll("[data-hilo]"), function (card) {
      var hiloId = card.dataset.hilo;
      card.querySelector(".in-punto").addEventListener("change", function () { previsualizar(card); });
      card.querySelector(".in-redondez").addEventListener("input", function () { previsualizar(card); });
      card.querySelector(".in-tinte").addEventListener("input", function () { previsualizar(card); });
      card.querySelector(".in-matiz").addEventListener("input", function () { previsualizar(card); });
      card.querySelector(".btn-guardar").addEventListener("click", async function () {
        var existente = porHilo[hiloId];
        var ref = existente ? doc(nudosCol, existente.id) : doc(nudosCol, "sembrado_" + hiloId);
        await setDoc(ref, {
          hiloId: hiloId,
          punto: card.querySelector(".in-punto").value,
          redondez: +card.querySelector(".in-redondez").value,
          tinte: card.querySelector(".in-tinte").value,
          matiz: card.querySelector(".in-matiz").value,
          texto: card.querySelector(".in-texto").value,
          estado: "tejido",
          fuente: existente ? existente.fuente || "directo" : "directo",
          eco: (existente && existente.eco) || false
        }, { merge: true });
      });
    });
  });
  unsubs.push(unsub);
}
function previsualizar(card) {
  var n = {
    punto: card.querySelector(".in-punto").value,
    redondez: +card.querySelector(".in-redondez").value,
    tinte: card.querySelector(".in-tinte").value,
    matiz: card.querySelector(".in-matiz").value
  };
  card.querySelector(".mini-preview").innerHTML = dibujarNudo(n);
}

/* ================= COLA DE MODERACIÓN ================= */
function renderCola(el, unsubs) {
  el.innerHTML = '<div id="lista-cola"></div>';
  var q = query(collectionGroup(db, "nudos"), where("estado", "==", "crudo"));
  var unsub = onSnapshot(q, function (snap) {
    if (snap.empty) {
      el.querySelector("#lista-cola").innerHTML = '<p class="estado-vacio">No hay nudos crudos pendientes.</p>';
      return;
    }
    var html = "";
    snap.forEach(function (d) {
      var n = d.data();
      var pasadaId = d.ref.parent.parent.id;
      html += '<div class="card" style="margin-bottom:10px" data-ref="' + d.ref.path + '">' +
        '<p class="cita">“' + n.texto + '”</p>' +
        '<div class="meta"><span class="tag">Pasada ' + pasadaId + '</span><span class="tag">Hilo ' + n.hiloId + '</span></div>' +
        '<button class="btn primary btn-aprobar">Tejer (aprobar)</button> ' +
        '<button class="btn btn-descartar">Descartar</button></div>';
    });
    el.querySelector("#lista-cola").innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll("[data-ref]"), function (card) {
      var ref = doc(db, card.dataset.ref);
      card.querySelector(".btn-aprobar").addEventListener("click", function () { updateDoc(ref, { estado: "tejido" }); });
      card.querySelector(".btn-descartar").addEventListener("click", function () { deleteDoc(ref); });
    });
  });
  unsubs.push(unsub);
}

/* ================= PERSONAS Y ROLES ================= */
function renderRoles(el, unsubs) {
  el.innerHTML =
    '<div class="card" style="max-width:560px;margin-bottom:16px">' +
      '<h3 style="font-size:.9rem;margin-bottom:10px">Agregar o actualizar persona</h3>' +
      '<div class="field"><label>Correo</label><input id="r-email" type="email" placeholder="nombre@umag.cl"></div>' +
      '<div class="pair">' +
        '<div class="field"><label>Rol</label><select id="r-rol">' +
          ROLES.map(function (r) { return '<option value="' + r + '">' + ROL_LABEL[r] + "</option>"; }).join("") +
        '</select></div>' +
        '<div class="field"><label>Mesa (solo hiladores)</label><select id="r-mesa"><option value="">—</option></select></div>' +
      '</div>' +
      '<button class="btn primary" id="btn-guardar-persona">Guardar</button>' +
    '</div>' +
    '<div id="lista-personas"></div>';

  getDocs(query(collection(db, "proyectos", PROYECTO_ID, "pasadas"), where("tipo", "==", "colaborativa"))).then(function (snap) {
    var opts = "";
    snap.forEach(function (d) { opts += '<option value="' + d.id + '">' + (d.data().nombre || d.id) + "</option>"; });
    el.querySelector("#r-mesa").innerHTML += opts;
  });

  el.querySelector("#btn-guardar-persona").addEventListener("click", async function () {
    var email = el.querySelector("#r-email").value.trim().toLowerCase();
    var rol = el.querySelector("#r-rol").value;
    var mesa = el.querySelector("#r-mesa").value;
    if (!email) return;
    var alcance = {};
    if (rol === "hilador" && mesa) alcance[PROYECTO_ID] = { pasadaId: mesa };
    await setDoc(doc(db, "usuarios_roles", email), { rol: rol, proyectosAlcance: alcance }, { merge: true });
    el.querySelector("#r-email").value = "";
  });

  var unsub = onSnapshot(collection(db, "usuarios_roles"), function (snap) {
    var html = '<table style="width:100%;border-collapse:collapse;font-size:.84rem">' +
      '<thead><tr style="text-align:left;color:var(--fg-soft)"><th>Correo</th><th>Rol</th><th>Alcance</th><th></th></tr></thead><tbody>';
    snap.forEach(function (d) {
      var u = d.data();
      var alcanceTxt = u.proyectosAlcance && u.proyectosAlcance[PROYECTO_ID] ? u.proyectosAlcance[PROYECTO_ID].pasadaId : "—";
      html += '<tr style="border-top:1px solid var(--line)"><td style="padding:6px 0">' + d.id + "</td><td>" +
        (ROL_LABEL[u.rol] || u.rol) + "</td><td>" + alcanceTxt + '</td><td><button class="btn btn-borrar" data-email="' + d.id + '">Quitar</button></td></tr>';
    });
    html += "</tbody></table>";
    el.querySelector("#lista-personas").innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll(".btn-borrar"), function (b) {
      b.addEventListener("click", function () { deleteDoc(doc(db, "usuarios_roles", b.dataset.email)); });
    });
  });
  unsubs.push(unsub);
}
