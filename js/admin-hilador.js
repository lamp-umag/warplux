import { db } from "./firebaseClient.js";
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo } from "./motifs.js";

var PROYECTO_ID = "telares";
var CATEGORIA_LABEL = { desafio: "Desafío", cambio: "Cambio", aporte: "Aporte" };
var ORIGENES = [
  { id: "estudiante", label: "Estudiante", color: "#e29f3e" },
  { id: "personal_no_academico", label: "Personal no académico", color: "#85751a" },
  { id: "academico_tres_unidades", label: "Académico/a, tres unidades", color: "#bb6f3a" },
  { id: "academico_otra_unidad", label: "Académico/a, otra unidad", color: "#3a402f" },
  { id: "institucion_externa", label: "Institución externa", color: "#7a8b6a" },
  { id: "grupal", label: "Grupal / sin atribuir", color: "#9a978c" }
];

export function render(el, perfil) {
  var alcance = perfil.alcance && perfil.alcance[PROYECTO_ID];
  if (!alcance || !alcance.pasadaId) {
    el.innerHTML = '<div class="card"><p class="ghost">Todavía no tienes una mesa asignada. Pide a la maestra tejedora que te asigne una.</p></div>';
    return function () {};
  }
  var pasadaId = alcance.pasadaId;
  el.innerHTML = '<div id="hilador-cont"><p class="ghost">Cargando tu mesa…</p></div>';
  cargar(el.querySelector("#hilador-cont"), pasadaId, perfil);
  return function () {};
}

async function cargar(el, pasadaId, perfil) {
  var pasadaRef = doc(db, "proyectos", PROYECTO_ID, "pasadas", pasadaId);
  var pasadaSnap = await getDoc(pasadaRef);
  if (!pasadaSnap.exists()) { el.innerHTML = '<p class="ghost">Esta mesa todavía no existe en el telar.</p>'; return; }
  var pasada = pasadaSnap.data();
  var categoriaPorHilo = pasada.categoriaPorHilo || { c1: "desafio", c2: "desafio", c3: "cambio", c4: "cambio", c5: "aporte", c6: "aporte" };
  var tintePorCategoria = pasada.tintePorCategoria || { desafio: "#bb6f3a", cambio: "#e29f3e", aporte: "#7a8b6a" };

  var plantillaSnap = await getDocs(query(collection(db, "proyectos", PROYECTO_ID, "plantillas"), where("tipo", "==", "colaborativa")));
  var plantilla = null;
  plantillaSnap.forEach(function (d) { if (!plantilla) plantilla = d.data(); });

  var nudosCol = collection(db, "proyectos", PROYECTO_ID, "pasadas", pasadaId, "nudos");

  el.innerHTML =
    '<div class="notice">Esta mesa es <strong>' + (pasada.nombre || pasadaId) + '</strong>. Registrás como <strong>' + perfil.nombre + '</strong>. ' +
    'Cada casilla se publica apenas la confirmas: no hay cola de revisión para el Coffee Lab.</div>' +
    '<div class="field" style="max-width:220px"><label>Personas en la mesa</label>' +
      '<input type="number" min="0" id="h-personas" value="' + (pasada.personas || "") + '"></div>' +
    '<div id="h-casillas" style="display:grid;gap:12px;grid-template-columns:1fr"></div>' +
    '<div class="field" style="margin-top:20px"><label>Notas de conversación (privadas, no se publican)</label>' +
      '<textarea id="h-notas" style="min-height:120px">' + (pasada.notasPrivadas || "") + '</textarea>' +
      '<button class="btn" id="h-guardar-notas" style="margin-top:8px">Guardar notas</button></div>';

  el.querySelector("#h-personas").addEventListener("change", function (e) {
    setDoc(pasadaRef, { personas: +e.target.value }, { merge: true });
  });
  el.querySelector("#h-guardar-notas").addEventListener("click", function () {
    setDoc(pasadaRef, { notasPrivadas: el.querySelector("#h-notas").value }, { merge: true });
  });

  var hilos = ["c1", "c2", "c3", "c4", "c5", "c6"];
  var contadorCategoria = {};
  var casillas = el.querySelector("#h-casillas");
  casillas.innerHTML = hilos.map(function (hiloId, i) {
    var cat = categoriaPorHilo[hiloId] || "aporte";
    contadorCategoria[cat] = (contadorCategoria[cat] || 0) + 1;
    var forma = plantilla && plantilla.hilos && plantilla.hilos[i] ? plantilla.hilos[i] : { punto: "solido", redondez: 16, giro: 0 };
    var previa = dibujarNudo({ punto: forma.punto, redondez: forma.redondez, giro: forma.giro, tinte: tintePorCategoria[cat] });
    return '<div class="card" data-hilo="' + hiloId + '" data-cat="' + cat + '">' +
      '<div style="display:flex;gap:12px;align-items:flex-start">' +
        '<div style="width:44px;height:44px;flex:0 0 auto" class="c-preview">' + previa + '</div>' +
        '<div style="flex:1">' +
          '<strong>' + CATEGORIA_LABEL[cat] + " " + contadorCategoria[cat] + '</strong>' +
          '<div class="field" style="margin-top:8px"><textarea class="c-frase" maxlength="180" placeholder="Una frase, tal como se acordó en la mesa."></textarea>' +
            '<div class="counterchar"><span class="c-cont">0</span>/180</div></div>' +
          '<div class="pair">' +
            '<div class="field"><label>¿Quién lo dijo?</label><select class="c-origen">' +
              ORIGENES.map(function (o) { return '<option value="' + o.id + '">' + o.label + "</option>"; }).join("") +
            '</select></div>' +
            '<div class="field" style="display:flex;align-items:flex-end"><button class="btn primary c-confirmar">Confirmar</button></div>' +
          '</div>' +
          '<span class="c-guardado ghost" hidden>Guardado ✓</span>' +
        '</div>' +
      '</div></div>';
  }).join("");

  Array.prototype.forEach.call(casillas.querySelectorAll("[data-hilo]"), function (card) {
    var hiloId = card.dataset.hilo, cat = card.dataset.cat;
    var frase = card.querySelector(".c-frase"), cont = card.querySelector(".c-cont");
    frase.addEventListener("input", function () { cont.textContent = frase.value.length; });
    card.querySelector(".c-confirmar").addEventListener("click", async function () {
      var texto = frase.value.trim();
      if (!texto) { frase.focus(); return; }
      var origen = card.querySelector(".c-origen").value;
      var origenObj = ORIGENES.filter(function (o) { return o.id === origen; })[0];
      var forma = plantilla && plantilla.hilos ? plantilla.hilos[hilos.indexOf(hiloId)] : null;
      await setDoc(doc(nudosCol, "directo_" + hiloId), {
        hiloId: hiloId, texto: texto, origen: origen,
        punto: (forma && forma.punto) || "solido",
        redondez: (forma && forma.redondez) || 16,
        giro: (forma && forma.giro) || 0,
        tinte: tintePorCategoria[cat],
        matiz: origenObj ? origenObj.color : null,
        estado: "tejido", fuente: "directo", eco: false
      });
      var g = card.querySelector(".c-guardado");
      g.hidden = false; setTimeout(function () { g.hidden = true; }, 2500);
    });
  });
}
