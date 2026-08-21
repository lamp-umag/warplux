import { db } from "./firebaseClient.js";
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo } from "./motifs.js";
import { FORMULARIO_MESA_DEFECTO, PARES_MESA } from "./formularioMesaDefecto.js";
import { suscribirEstilos, resolverEstiloCategoria } from "./estilos.js";
import { registrar } from "./historial.js";
import { debounce } from "./util.js";

export function render(el, perfil) {
  var unsubs = [];
  renderMesas(el, perfil, unsubs);
  return function () { unsubs.forEach(function (u) { u(); }); };
}

/** reutilizable: selector de telar + lista/creación/llenado de mesas. Usado también por admin-urdidor.js */
export function renderMesas(el, perfil, unsubs) {
  el.innerHTML = '<div id="hi-selector"></div><div id="hi-cuerpo" style="margin-top:16px"></div>';
  var unsubCuerpo = null;
  var unsub = renderSelectorTelar(el.querySelector("#hi-selector"), function (proyecto) {
    if (unsubCuerpo) unsubCuerpo();
    unsubCuerpo = mostrarMesas(el.querySelector("#hi-cuerpo"), proyecto, perfil);
  });
  unsubs.push(unsub);
  unsubs.push(function () { if (unsubCuerpo) unsubCuerpo(); });
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
    '<h3 style="font-size:.95rem;margin-bottom:10px">Mesas de ' + proyecto.nombre + '</h3>' +
    '<div id="hi-lista-mesas" style="display:grid;gap:10px;grid-template-columns:1fr;margin-bottom:16px"></div>' +
    '<div id="hi-form"></div>';

  var qMesas = query(collection(db, "proyectos", proyecto.id, "pasadas"), where("tipo", "==", "colaborativa"), orderBy("index"));
  var unsub = onSnapshot(qMesas, function (snap) {
    var mesas = [];
    snap.forEach(function (d) { mesas.push(Object.assign({ id: d.id }, d.data())); });

    el.querySelector("#hi-lista-mesas").innerHTML = mesas.map(function (m) {
      return '<button class="btn" data-mesa="' + m.id + '" style="justify-content:flex-start;text-align:left">' +
        (m.nombre || m.id) + '</button>';
    }).join("") || '<p class="estado-vacio">Todavía no hay mesas creadas. El urdidor las agrega desde "Contenido".</p>';

    Array.prototype.forEach.call(el.querySelectorAll("[data-mesa]"), function (b) {
      b.addEventListener("click", function () {
        abrirFormularioMesa(el.querySelector("#hi-form"), proyecto, formulario, b.dataset.mesa, perfil);
      });
    });
  });

  return unsub;
}

/* ================= formulario de una mesa: 3 preguntas, cada una llena 2 nudos gemelos ================= */
async function abrirFormularioMesa(el, proyecto, formulario, pasadaId, perfil) {
  if (el._unsubEstilos) { el._unsubEstilos(); el._unsubEstilos = null; }
  var pasadaRef = doc(db, "proyectos", proyecto.id, "pasadas", pasadaId);
  var pasadaSnap = await getDoc(pasadaRef);
  var pasada = pasadaSnap.data() || {};
  var nudosCol = collection(pasadaRef, "nudos");
  var nudosSnap = await getDocs(nudosCol);
  var porHilo = {};
  nudosSnap.forEach(function (d) { porHilo[d.data().hiloId] = Object.assign({ id: d.id }, d.data()); });

  var estilos = [];
  el._unsubEstilos = suscribirEstilos(proyecto.id, function (lista) { estilos = lista; repintarPrevias(); });

  el.innerHTML =
    '<div class="notice">Estás llenando <strong>' + (pasada.nombre || pasadaId) + '</strong> del telar <strong>' + proyecto.nombre + '</strong>. ' +
    'Se guarda solo mientras haces una pausa al escribir — con solo título o solo descripción ya se ve en el telar.</div>' +
    '<div id="hi-preguntas" style="display:grid;gap:12px;grid-template-columns:1fr;margin-top:16px"></div>';

  function apariencia() { return { punto: "solido" }; }

  function nudoGeneradoPara(categoria) {
    return resolverEstiloCategoria(estilos, proyecto.estiloPorCategoria, categoria);
  }

  function repintarPrevias() {
    Array.prototype.forEach.call(el.querySelectorAll("[data-categoria]"), function (card) {
      var estilo = nudoGeneradoPara(card.dataset.categoria);
      Array.prototype.forEach.call(card.querySelectorAll(".hi-preview"), function (prev, i) {
        var par = PARES_MESA[+card.dataset.i];
        prev.innerHTML = dibujarNudo({ punto: estilo.punto, tinte: estilo.tinte, matiz: estilo.matiz, giro: par.giro, espejo: par.espejo });
      });
    });
  }

  var preguntas = el.querySelector("#hi-preguntas");
  preguntas.innerHTML = formulario.preguntas.map(function (p, i) {
    var existente = porHilo[p.cols[0]];
    return '<div class="card" data-categoria="' + p.categoria + '" data-i="' + i + '">' +
      '<div style="display:flex;gap:12px;align-items:flex-start">' +
        '<div style="display:flex;gap:4px;flex:0 0 auto">' +
          '<div class="hi-preview" style="width:36px;height:36px"></div>' +
          '<div class="hi-preview" style="width:36px;height:36px"></div>' +
        '</div>' +
        '<div style="flex:1">' +
          '<strong>' + formulario.categoriaLabel[p.categoria] + '</strong>' +
          '<p class="ghost" style="margin:4px 0 8px">' + p.texto + '</p>' +
          '<div class="field"><label>Título</label><input class="q-titulo" value="' + (existente ? (existente.titulo || "") : "") + '"></div>' +
          '<div class="field"><label>Descripción</label><textarea class="q-texto" maxlength="220">' + (existente ? (existente.texto || "") : "") + '</textarea>' +
            '<div class="counterchar"><span class="q-cont">' + (existente ? (existente.texto || "").length : 0) + '</span>/220</div></div>' +
          '<span class="q-guardado ghost" hidden>Guardado ✓</span>' +
        '</div>' +
      '</div></div>';
  }).join("");

  repintarPrevias();

  Array.prototype.forEach.call(preguntas.querySelectorAll("[data-categoria]"), function (card) {
    var i = +card.dataset.i;
    var p = formulario.preguntas[i];
    var titulo = card.querySelector(".q-titulo"), texto = card.querySelector(".q-texto"), cont = card.querySelector(".q-cont");
    var registrarDebounce = null;

    // guarda en vivo, sin botón "Confirmar": alcanza con título O descripción, no hace falta llenar ambos.
    // el escrito a Firestore va debounced (600ms tras la última tecla) para no mandar un write por
    // caracter con varios hiladores a la vez; .flush() en blur asegura que no se pierda el último tramo.
    function guardarAhora() {
      var tituloVal = titulo.value.trim(), textoVal = texto.value.trim();
      var par = PARES_MESA[i];
      for (var c = 0; c < p.cols.length; c++) {
        var hiloId = p.cols[c];
        var existente = porHilo[hiloId];
        var ref = existente ? doc(nudosCol, existente.id) : doc(nudosCol, "directo_" + hiloId);
        // la apariencia (punto/tinte/matiz/giro/espejo) solo se fija al crear el nudo;
        // si ya existe, el hilador solo puede tocar el texto — la apariencia es del urdidor/tejedor.
        var datos = existente
          ? { hiloId: hiloId, titulo: tituloVal, texto: textoVal, estado: "tejido", pregunta: p.texto }
          : (function () {
              var estilo = nudoGeneradoPara(p.categoria);
              return {
                hiloId: hiloId, titulo: tituloVal, texto: textoVal, pregunta: p.texto,
                punto: estilo.punto, tinte: estilo.tinte, matiz: estilo.matiz, giro: par.giro, espejo: par.espejo,
                estado: "tejido", fuente: "directo", eco: false
              };
            })();
        setDoc(ref, datos, { merge: true });
        porHilo[hiloId] = Object.assign({ id: "directo_" + hiloId }, existente, datos);
      }
      var g = card.querySelector(".q-guardado");
      g.hidden = false; clearTimeout(g._ocultar); g._ocultar = setTimeout(function () { g.hidden = true; }, 1500);
      clearTimeout(registrarDebounce);
      registrarDebounce = setTimeout(function () {
        registrar(proyecto.id, { tipo: "aporte_hilado", resumen: "Aporte cargado en " + (pasada.nombre || pasadaId) + " (" + formulario.categoriaLabel[p.categoria] + ")", autor: perfil.email });
      }, 800);
    }

    var guardar = debounce(guardarAhora, 600);

    titulo.addEventListener("input", guardar);
    titulo.addEventListener("blur", function () { guardar.flush(); });
    texto.addEventListener("input", function () { cont.textContent = texto.value.length; guardar(); });
    texto.addEventListener("blur", function () { guardar.flush(); });
  });
}
