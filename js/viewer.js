import { db } from "./firebaseClient.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { renderCabecera, renderCuerpo, marcarActivo, agruparPorHilo } from "./telarCore.js";
import { APARIENCIA_DEFECTO } from "./motifs.js";

var params = new URLSearchParams(location.search);
var slug = params.get("p");

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
  $("lede-proyecto").textContent = "";
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
  $("titulo-proyecto").textContent = estado.proyecto.nombre || slug;
  $("lede-proyecto").textContent = estado.proyecto.nombreLargo || "";
  mostrarSolo("vista-telar");

  var qPasadas = query(collection(db, "proyectos", slug, "pasadas"), orderBy("index"));
  onSnapshot(qPasadas, function (snap) {
    estado.pasadas = [];
    snap.forEach(function (d) {
      var p = Object.assign({ id: d.id }, d.data());
      if (p.activo !== false) estado.pasadas.push(p); // fila desactivada por el urdidor: no se muestra
    });
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
function apariencia() {
  return estado.proyecto ? {
    redondezExterior: estado.proyecto.redondezExterior,
    redondezInterior: estado.proyecto.redondezInterior,
    espacioNudos: estado.proyecto.espacioNudos
  } : APARIENCIA_DEFECTO;
}

function renderCabeceraTop() {
  renderCabecera($("telar-cabecera"), estado.hilos, {
    corner: "pasada",
    espacioNudos: apariencia().espacioNudos,
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

// un nudo sin título ni texto se ve vacío (el crema/gris de siempre, vía el
// fallback de renderCuerpo) en el telar público, sin importar qué forma o
// color le haya dado el urdidor de antemano — recién muestra su color real
// cuando tiene algo que decir.

function tieneContenido(n) {
  return !!((n.titulo && n.titulo.trim()) || (n.texto && n.texto.trim()));
}

function renderTodo() {
  renderCuerpo($("telar-cuerpo"), estado.pasadas, estado.nudosPorPasada, {
    hilos: estado.hilos,
    apariencia: apariencia(),
    soloTejido: true,
    soloConContenido: true,
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
  Object.keys(estado.nudosPorPasada).forEach(function (k) {
    total += estado.nudosPorPasada[k].filter(tieneContenido).length;
  });
  $("pie-conteo").textContent = total + " nudo" + (total === 1 ? "" : "s") + " tejido" + (total === 1 ? "" : "s");
  renderHilosView(total);
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
  var imagenSegura = esUrlSegura(nudo.imagenUrl);
  var enlaceSeguro = esUrlSegura(nudo.enlaceUrl);
  var html = '<div class="eyebrow">' + (pasada.nombre || pasada.etiquetaCorta) +
    (hilo.nombre ? " · " + hilo.nombre : "") + "</div>" +
    (nudo.pregunta ? '<p class="ghost" style="font-style:italic;margin-bottom:8px">' + nudo.pregunta + "</p>" : "") +
    (nudo.titulo ? "<h2 style=\"font-size:1.05rem;margin-bottom:8px\">" + nudo.titulo + "</h2>" : "") +
    (imagenSegura ? '<img src="' + imagenSegura + '" alt="" style="width:100%;border-radius:8px;margin-bottom:10px">' : "") +
    (nudo.texto ? '<p class="cita">“' + nudo.texto + '”</p>' : "") +
    (enlaceSeguro ? '<p><a href="' + enlaceSeguro + '" target="_blank" rel="noopener">Más información →</a></p>' : "") +
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
function esUrlSegura(url) {
  if (!url) return null;
  return /^https:\/\//i.test(url) ? url : null;
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
      grupos[hiloId].filter(tieneContenido).forEach(function (n) {
        var hilo = estado.hilos.filter(function (h) { return h.id === hiloId; })[0] || {};
        html += '<div class="card" style="border-left:4px solid ' + (n.tinte || "#ccc") + '">' +
          (n.pregunta ? '<p class="ghost" style="font-style:italic;font-size:.8rem;margin:0 0 6px">' + n.pregunta + '</p>' : "") +
          '<p class="cita" style="margin:0 0 8px">“' + (n.texto || n.titulo) + '”</p>' +
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
