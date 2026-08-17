import { db } from "./firebaseClient.js";
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo, PALETA } from "./motifs.js";
import { FORMULARIO_MESA_DEFECTO, PARES_MESA, visualDesdeComposicion } from "./formularioMesaDefecto.js";
import { registrar } from "./historial.js";

export function render(el, perfil) {
  el.innerHTML = '<div id="hi-selector"></div><div id="hi-cuerpo" style="margin-top:16px"></div>';
  var unsubCuerpo = null;
  var unsub = renderSelectorTelar(el.querySelector("#hi-selector"), function (proyecto) {
    if (unsubCuerpo) unsubCuerpo();
    unsubCuerpo = mostrarMesas(el.querySelector("#hi-cuerpo"), proyecto, perfil);
  });
  return function () { unsub(); if (unsubCuerpo) unsubCuerpo(); };
}

function renderSelectorTelar(el, onCambia) {
  el.innerHTML = '<div class="field" style="max-width:320px"><label>Telar</label><select id="sel-telar"></select></div>';
  var sel = el.querySelector("#sel-telar");
  var unsub = onSnapshot(query(collection(db, "proyectos"), where("activo", "==", true)), function (snap) {
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

/* ================= lista de mesas ================= */
function mostrarMesas(el, proyecto, perfil) {
  var formulario = proyecto.formularioMesa || ((proyecto.columnas || 6) === 6 ? FORMULARIO_MESA_DEFECTO : null);
  if (!formulario) {
    el.innerHTML = '<p class="ghost">Este telar no tiene formulario de mesa configurado (necesita 6 columnas de contenido).</p>';
    return function () {};
  }

  el.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">' +
      '<h3 style="font-size:.95rem">Mesas de ' + proyecto.nombre + '</h3>' +
      '<button class="btn primary" id="hi-crear-mesa">+ Crear nueva mesa</button>' +
    '</div>' +
    '<p class="ghost" id="hi-tope-aviso" style="margin-bottom:10px"></p>' +
    '<div id="hi-lista-mesas" style="display:grid;gap:10px;grid-template-columns:1fr"></div>' +
    '<div id="hi-form" style="margin-top:18px"></div>';

  var qMesas = query(collection(db, "proyectos", proyecto.id, "pasadas"), where("tipo", "==", "colaborativa"), orderBy("index"));
  var unsub = onSnapshot(qMesas, function (snap) {
    var mesas = [];
    snap.forEach(function (d) { mesas.push(Object.assign({ id: d.id }, d.data())); });
    var max = typeof proyecto.filasHiladorMax === "number" ? proyecto.filasHiladorMax : 99;
    var btnCrear = el.querySelector("#hi-crear-mesa");
    btnCrear.disabled = mesas.length >= max;
    el.querySelector("#hi-tope-aviso").textContent = mesas.length + " de " + max + " mesas creadas.";

    el.querySelector("#hi-lista-mesas").innerHTML = mesas.map(function (m) {
      return '<button class="btn" data-mesa="' + m.id + '" style="justify-content:flex-start;text-align:left">' +
        (m.nombre || m.id) + '</button>';
    }).join("") || '<p class="estado-vacio">Todavía no hay mesas. Crea la primera.</p>';

    Array.prototype.forEach.call(el.querySelectorAll("[data-mesa]"), function (b) {
      b.addEventListener("click", function () {
        abrirFormularioMesa(el.querySelector("#hi-form"), proyecto, formulario, b.dataset.mesa, perfil);
      });
    });
  });

  el.querySelector("#hi-crear-mesa").addEventListener("click", async function () {
    var pasadasSnap = await getDocs(collection(db, "proyectos", proyecto.id, "pasadas"));
    var siguienteIndex = pasadasSnap.docs.reduce(function (max, d) { return Math.max(max, d.data().index || 0); }, 0) + 1;
    var mesasExistentes = pasadasSnap.docs.filter(function (d) { return d.data().tipo === "colaborativa"; }).length;
    var id = "mesa_" + Date.now().toString(36);
    await setDoc(doc(db, "proyectos", proyecto.id, "pasadas", id), {
      index: siguienteIndex, tipo: "colaborativa", etiquetaCorta: "M" + (mesasExistentes + 1),
      nombre: "Mesa " + (mesasExistentes + 1), composicion: {}
    });
    registrar(proyecto.id, { tipo: "mesa_creada", resumen: "Mesa creada: Mesa " + (mesasExistentes + 1), autor: perfil.email });
    abrirFormularioMesa(el.querySelector("#hi-form"), proyecto, formulario, id, perfil);
  });

  return unsub;
}

/* ================= formulario de una mesa ================= */
async function abrirFormularioMesa(el, proyecto, formulario, pasadaId, perfil) {
  var pasadaRef = doc(db, "proyectos", proyecto.id, "pasadas", pasadaId);
  var pasadaSnap = await getDoc(pasadaRef);
  var pasada = pasadaSnap.data() || {};
  var composicion = pasada.composicion || {};
  var apariencia = { redondezExterior: proyecto.redondezExterior, redondezInterior: proyecto.redondezInterior };
  var nudosCol = collection(pasadaRef, "nudos");
  var nudosSnap = await getDocs(nudosCol);
  var porHilo = {};
  nudosSnap.forEach(function (d) { porHilo[d.data().hiloId] = Object.assign({ id: d.id }, d.data()); });

  el.innerHTML =
    '<div class="notice">Estás editando <strong>' + (pasada.nombre || pasadaId) + '</strong> del telar <strong>' + proyecto.nombre + '</strong>. ' +
    'Cada casilla se publica apenas la confirmas.</div>' +
    '<h4 style="font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-soft);margin-bottom:8px">¿Quiénes estaban en esta mesa?</h4>' +
    '<div class="checklist" id="hi-composicion"></div>' +
    '<div id="hi-casillas" style="display:grid;gap:12px;grid-template-columns:1fr;margin-top:20px"></div>';

  el.querySelector("#hi-composicion").innerHTML = formulario.composicionPreguntas.map(function (q) {
    return '<label><input type="checkbox" data-comp="' + q.id + '"' + (composicion[q.id] ? " checked" : "") + '> ' + q.label + "</label>";
  }).join("");

  function composicionActual() {
    var c = {};
    Array.prototype.forEach.call(el.querySelectorAll("[data-comp]"), function (chk) { c[chk.dataset.comp] = chk.checked; });
    return c;
  }

  function parDe(hiloId) {
    return PARES_MESA.filter(function (p) { return p.cols.indexOf(hiloId) !== -1; })[0] || { giro: 0, espejo: false };
  }

  function nudoGenerado(hiloId) {
    var cat = formulario.categoriaPorHilo[hiloId];
    var visual = visualDesdeComposicion(composicionActual(), PALETA);
    var par = parDe(hiloId);
    return {
      punto: visual.punto, matiz: visual.matiz, acento: visual.acento,
      tinte: formulario.tintePorCategoria[cat], giro: par.giro, espejo: par.espejo
    };
  }

  function repintarPrevias() {
    Array.prototype.forEach.call(el.querySelectorAll("[data-hilo]"), function (card) {
      var hiloId = card.dataset.hilo;
      card.querySelector(".hi-preview").innerHTML = dibujarNudo(nudoGenerado(hiloId), apariencia);
    });
  }

  Array.prototype.forEach.call(el.querySelectorAll("[data-comp]"), function (chk) {
    chk.addEventListener("change", function () {
      setDoc(pasadaRef, { composicion: composicionActual() }, { merge: true });
      repintarPrevias();
    });
  });

  var hilos = ["c1", "c2", "c3", "c4", "c5", "c6"];
  var contadorCategoria = {};
  var casillas = el.querySelector("#hi-casillas");
  casillas.innerHTML = hilos.map(function (hiloId, i) {
    var cat = formulario.categoriaPorHilo[hiloId];
    contadorCategoria[cat] = (contadorCategoria[cat] || 0) + 1;
    var pregunta = formulario.preguntas[Math.floor(i / 2)];
    var existente = porHilo[hiloId];
    return '<div class="card" data-hilo="' + hiloId + '">' +
      '<div style="display:flex;gap:12px;align-items:flex-start">' +
        '<div class="hi-preview" style="width:44px;height:44px;flex:0 0 auto">' + dibujarNudo(nudoGenerado(hiloId), apariencia) + '</div>' +
        '<div style="flex:1">' +
          '<strong>' + formulario.categoriaLabel[cat] + " " + contadorCategoria[cat] + '</strong>' +
          '<p class="ghost" style="margin:4px 0 8px">' + pregunta + '</p>' +
          '<div class="field"><textarea class="c-frase" maxlength="180">' + (existente ? existente.texto : "") + '</textarea>' +
            '<div class="counterchar"><span class="c-cont">' + (existente ? existente.texto.length : 0) + '</span>/180</div></div>' +
          '<button class="btn primary c-confirmar">Confirmar</button> ' +
          '<span class="c-guardado ghost" hidden>Guardado ✓</span>' +
        '</div>' +
      '</div></div>';
  }).join("");

  Array.prototype.forEach.call(casillas.querySelectorAll("[data-hilo]"), function (card) {
    var hiloId = card.dataset.hilo;
    var frase = card.querySelector(".c-frase"), cont = card.querySelector(".c-cont");
    frase.addEventListener("input", function () { cont.textContent = frase.value.length; });
    card.querySelector(".c-confirmar").addEventListener("click", async function () {
      var texto = frase.value.trim();
      if (!texto) { frase.focus(); return; }
      var generado = nudoGenerado(hiloId);
      var existente = porHilo[hiloId];
      var ref = existente ? doc(nudosCol, existente.id) : doc(nudosCol, "directo_" + hiloId);
      await setDoc(ref, Object.assign({
        hiloId: hiloId, texto: texto, estado: "tejido", fuente: "directo", eco: false
      }, generado), { merge: true });
      porHilo[hiloId] = Object.assign({ id: "directo_" + hiloId }, generado, { texto: texto });
      registrar(proyecto.id, { tipo: "aporte_hilado", resumen: "Aporte cargado en " + (pasada.nombre || pasadaId), autor: perfil.email });
      var g = card.querySelector(".c-guardado");
      g.hidden = false; setTimeout(function () { g.hidden = true; }, 2500);
    });
  });
}
