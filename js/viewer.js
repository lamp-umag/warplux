import { db } from "./firebaseClient.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { renderBanner, renderCabecera, renderCuerpo, marcarActivo, agruparPorHilo } from "./telarCore.js";

var params = new URLSearchParams(location.search);
var slug = params.get("p");

var LEYENDA = [
  { nombre: "Actores / Contexto", tinte: "#85751a" },
  { nombre: "Ejes estratégicos", tinte: "#e29f3e" },
  { nombre: "Cronograma / Agenda", tinte: "#bb6f3a" },
  { nombre: "Desafío", tinte: "#bb6f3a" },
  { nombre: "Cambio", tinte: "#e29f3e" },
  { nombre: "Aporte", tinte: "#7a8b6a" }
];

var estado = {
  proyecto: null,
  hilos: [],
  pasadas: [],
  nudosPorPasada: {},
  hiloActivo: null,
  vista: "telar",
  suscritas: {}
};

function $(id) { return document.getElementById(id); }
function mostrarSolo(id) {
  ["vista-catalogo", "vista-no-encontrado", "vista-telar"].forEach(function (v) {
    $(v).hidden = v !== id;
  });
}

/* ---------------- catálogo ---------------- */
async function renderCatalogo() {
  $("titulo-proyecto").textContent = "Telares";
  $("lede-proyecto").textContent = "Elige un telar para verlo tejerse.";
  mostrarSolo("vista-catalogo");
  var q = query(collection(db, "proyectos"), where("activo", "==", true));
  var snap = await getDocs(q);
  if (snap.empty) {
    $("lista-catalogo").innerHTML = '<p class="estado-vacio">Todavía no hay telares activos.</p>';
    return;
  }
  var html = "";
  snap.forEach(function (d) {
    var p = d.data();
    html += '<p><a class="btn primary" href="index.html?p=' + encodeURIComponent(d.id) + '">' +
      (p.nombre || d.id) + "</a></p>";
  });
  $("lista-catalogo").innerHTML = html;
}

/* ---------------- carga de proyecto ---------------- */
async function cargarProyecto() {
  var ref = doc(db, "proyectos", slug);
  var snap = await getDoc(ref);
  if (!snap.exists()) {
    $("titulo-proyecto").textContent = "No encontrado";
    $("no-encontrado-detalle").textContent = 'No existe un telar con el identificador "' + slug + '".';
    mostrarSolo("vista-no-encontrado");
    return;
  }
  estado.proyecto = snap.data();
  estado.hilos = estado.proyecto.urdimbre || [];
  document.title = (estado.proyecto.nombre || slug) + " — el telar";
  $("marca-nombre").textContent = estado.proyecto.nombre || slug;
  $("titulo-proyecto").textContent = "El telar de " + (estado.proyecto.nombre || slug);
  $("lede-proyecto").textContent = estado.proyecto.nombreLargo ||
    "Cada nudo es algo que alguien dijo. La urdimbre la puso el proyecto; la trama la teje quien participa.";
  renderBanner($("banner-telares"), estado.proyecto.nombre || "TELARES");
  renderLeyenda();
  mostrarSolo("vista-telar");

  var qPasadas = query(collection(db, "proyectos", slug, "pasadas"), orderBy("index"));
  onSnapshot(qPasadas, function (snap) {
    estado.pasadas = [];
    snap.forEach(function (d) { estado.pasadas.push(Object.assign({ id: d.id }, d.data())); });
    estado.pasadas.forEach(suscribirNudos);
    renderCabeceraTop();
    renderTodo();
  });
}

function suscribirNudos(pasada) {
  if (estado.suscritas[pasada.id]) return;
  estado.suscritas[pasada.id] = true;
  var qNudos = query(
    collection(db, "proyectos", slug, "pasadas", pasada.id, "nudos"),
    where("estado", "==", "tejido")
  );
  onSnapshot(qNudos, function (snap) {
    var lista = [];
    snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data())); });
    estado.nudosPorPasada[pasada.id] = lista;
    renderTodo();
  });
}

/* ---------------- render ---------------- */
function renderCabeceraTop() {
  renderCabecera($("telar-cabecera"), estado.hilos, {
    corner: "pasada",
    hiloActivo: estado.hiloActivo,
    onHiloClick: function (hiloId) {
      estado.hiloActivo = estado.hiloActivo === hiloId ? null : hiloId;
      renderCabeceraTop();
      renderTodo();
    }
  });
}

function esVisible(nudo) {
  return !estado.hiloActivo || nudo.hiloId === estado.hiloActivo;
}

function renderTodo() {
  renderCuerpo($("telar-cuerpo"), estado.pasadas, estado.nudosPorPasada, {
    hilos: estado.hilos,
    soloTejido: true,
    esVisible: esVisible,
    onNudoClick: function (nudo, pasada, hiloId, todos, btn) {
      marcarActivo($("telar-cuerpo"), btn);
      mostrarPanel(nudo, pasada, hiloId, todos);
      abrirHoja();
    },
    onNudoHover: function (nudo, pasada, hiloId, todos, btn) {
      if (!estado.fijado) mostrarPanel(nudo, pasada, hiloId, todos);
    }
  });

  var total = 0;
  Object.keys(estado.nudosPorPasada).forEach(function (k) { total += estado.nudosPorPasada[k].length; });
  $("pie-conteo").textContent = total + " nudo" + (total === 1 ? "" : "s") + " tejido" + (total === 1 ? "" : "s");
  renderHilosView(total);
}

function renderLeyenda() {
  $("leyenda-lista").innerHTML = LEYENDA.map(function (l) {
    return '<li style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--fg)">' +
      '<span style="width:12px;height:12px;border-radius:3px;background:' + l.tinte + ';display:inline-block"></span>' +
      l.nombre + "</li>";
  }).join("");
}

function panelVacio() {
  $("panel-body").innerHTML =
    '<div class="eyebrow">Cómo leer el telar</div>' +
    '<p class="estado-vacio">Toca cualquier nudo para leer lo que dice, quién lo trajo y en qué pasada está.</p>';
}

function mostrarPanel(nudo, pasada, hiloId, todos) {
  if (!nudo) { panelVacio(); return; }
  var hilo = estado.hilos.filter(function (h) { return h.id === hiloId; })[0] || {};
  var otros = (todos || []).filter(function (n) { return n.id !== nudo.id; });
  var html = '<div class="eyebrow">' + (pasada.nombre || pasada.etiquetaCorta) +
    (hilo.nombre ? " · " + hilo.nombre : "") + "</div>" +
    '<p class="cita">“' + (nudo.texto || "") + '”</p>' +
    '<div class="meta">' +
    (nudo.fuente ? '<span class="tag">' + fuenteLabel(nudo.fuente) + "</span>" : "") +
    (nudo.eco ? '<span class="tag">Con audio</span>' : "") +
    "</div>";
  if (otros.length) {
    html += '<div style="border-top:1px solid var(--line);padding-top:12px;margin-top:6px">' +
      '<strong style="font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-soft)">También acá (racimo)</strong>';
    otros.forEach(function (o) {
      html += '<p class="cita" style="font-size:.9rem;margin:8px 0 0">“' + o.texto + '”</p>';
    });
    html += "</div>";
  }
  $("panel-body").innerHTML = html;
}
function fuenteLabel(f) {
  return { sembrado: "Contenido de base", directo: "Cargado en vivo", eco: "Desde estación de audio" }[f] || f;
}

function abrirHoja() {
  estado.fijado = true;
  if (window.innerWidth < 980) $("panel-lectura").classList.add("abierto");
}
$("panel-cerrar").addEventListener("click", function () {
  $("panel-lectura").classList.remove("abierto");
  estado.fijado = false;
  marcarActivo($("telar-cuerpo"), null);
  panelVacio();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    $("panel-lectura").classList.remove("abierto");
    estado.fijado = false;
  }
});

/* ---------------- vista hilos (lista) ---------------- */
function renderHilosView(total) {
  $("hilos-conteo").textContent = total + " aporte" + (total === 1 ? "" : "s") + " tejidos en total";
  var html = "";
  estado.pasadas.forEach(function (pasada) {
    var grupos = agruparPorHilo(estado.nudosPorPasada[pasada.id] || []);
    Object.keys(grupos).forEach(function (hiloId) {
      grupos[hiloId].forEach(function (n) {
        var hilo = estado.hilos.filter(function (h) { return h.id === hiloId; })[0] || {};
        html += '<div class="card" style="border-left:4px solid ' + (n.tinte || "#ccc") + '">' +
          '<p class="cita" style="margin:0 0 8px">“' + n.texto + '”</p>' +
          '<div class="meta">' +
          '<span class="tag">' + (pasada.nombre || pasada.etiquetaCorta) + "</span>" +
          (hilo.nombre ? '<span class="tag">' + hilo.nombre + "</span>" : "") +
          "</div></div>";
      });
    });
  });
  $("lista-hilos").innerHTML = html || '<p class="estado-vacio">Todavía no hay nada tejido.</p>';
}

/* ---------------- tabs ---------------- */
Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
  t.addEventListener("click", function () {
    estado.vista = t.dataset.vista;
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (o) {
      o.setAttribute("aria-selected", o === t ? "true" : "false");
    });
    $("panel-telar").hidden = estado.vista !== "telar";
    $("panel-hilos").hidden = estado.vista !== "hilos";
  });
});

/* ---------------- orillo superior ---------------- */
(function () {
  var cols = ["#e29f3e", "#85751a", "#bb6f3a", "#3a402f", "#7a8b6a"];
  var parts = [], n = 40, tile = 40;
  for (var i = 0; i < n; i++) {
    var cx = i * tile + tile / 2, up = i % 2 === 0, cy = up ? 11 : 29, r = 13;
    parts.push('<path d="M' + cx + " " + (cy - r) + " L" + (cx + r) + " " + cy + " L" + cx + " " + (cy + r) +
      " L" + (cx - r) + " " + cy + ' Z" fill="' + cols[i % cols.length] + '" opacity=".9"/>');
  }
  $("selvage-top").innerHTML = '<svg viewBox="0 0 ' + (n * tile) + ' 40" preserveAspectRatio="none" width="100%" height="10" aria-hidden="true">' + parts.join("") + "</svg>";
})();

/* ---------------- init ---------------- */
panelVacio();
if (!slug) renderCatalogo(); else cargarProyecto();
