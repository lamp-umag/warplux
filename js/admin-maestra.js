import { db } from "./firebaseClient.js";
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { dibujarNudo, PUNTOS, PALETA, APARIENCIA_DEFECTO } from "./motifs.js";
import { construirUrdimbre } from "./telarCore.js";
import { ROLES, ROL_LABEL } from "./auth.js";
import { registrar, suscribirHistorial } from "./historial.js";
import { FORMULARIO_MESA_DEFECTO } from "./formularioMesaDefecto.js";
import { aplicarPatron } from "./patrones.js";

export function render(el, perfil) {
  var unsubs = [];
  var proyectoSeleccionado = null;

  el.innerHTML =
    '<div class="tabs" role="tablist" style="margin-bottom:18px">' +
      '<button class="tab" data-tab="telares" aria-selected="true">Mis telares</button>' +
      '<button class="tab" data-tab="estructura" aria-selected="false">Filas y apariencia</button>' +
      '<button class="tab" data-tab="cola" aria-selected="false">Cola de moderación</button>' +
      '<button class="tab" data-tab="roles" aria-selected="false">Personas y roles</button>' +
      '<button class="tab" data-tab="historia" aria-selected="false">Historia</button>' +
    '</div>' +
    '<div id="panel-telares"></div>' +
    '<div id="panel-estructura" hidden></div>' +
    '<div id="panel-cola" hidden></div>' +
    '<div id="panel-roles" hidden></div>' +
    '<div id="panel-historia" hidden></div>';

  Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      ["telares", "estructura", "cola", "roles", "historia"].forEach(function (k) {
        el.querySelector("#panel-" + k).hidden = k !== t.dataset.tab;
      });
    });
  });

  function onProyectoCambia(p) { proyectoSeleccionado = p; }

  renderTelares(el.querySelector("#panel-telares"), perfil, unsubs);
  renderEstructura(el.querySelector("#panel-estructura"), perfil, unsubs, onProyectoCambia);
  renderCola(el.querySelector("#panel-cola"), unsubs);
  renderRoles(el.querySelector("#panel-roles"), unsubs);
  renderHistoria(el.querySelector("#panel-historia"), unsubs);

  return function () { unsubs.forEach(function (u) { u(); }); };
}

function slugificar(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ================= MIS TELARES ================= */
function renderTelares(el, perfil, unsubs) {
  el.innerHTML =
    '<div class="card" style="max-width:640px;margin-bottom:20px">' +
      '<h3 style="font-size:.9rem;margin-bottom:10px">Crear un telar nuevo</h3>' +
      '<div class="field"><label>Nombre</label><input id="t-nombre" placeholder="Ej: TELARES"></div>' +
      '<div class="pair">' +
        '<div class="field"><label>Columnas de contenido</label><input id="t-columnas" type="number" min="2" max="12" value="6"></div>' +
        '<div class="field"><label>Filas esperadas de hiladores (máx. 99)</label><input id="t-max-hilador" type="number" min="0" max="99" value="20"></div>' +
      '</div>' +
      '<p class="ghost">Empieza vacío: sin filas, sin contenido. Lo armas desde "Filas y apariencia". ' +
      'Si dejas 6 columnas, el formulario de mesa para hiladores queda disponible con las preguntas por defecto.</p>' +
      '<button class="btn primary" id="t-crear">Crear telar</button>' +
      '<button class="btn" id="t-sembrar-sample" style="margin-left:8px">Crear telar de ejemplo (sample)</button>' +
      '<p class="ghost" id="t-estado" style="margin-top:8px"></p>' +
    '</div>' +
    '<div id="lista-telares"></div>';

  el.querySelector("#t-crear").addEventListener("click", async function () {
    var nombre = el.querySelector("#t-nombre").value.trim();
    if (!nombre) { el.querySelector("#t-nombre").focus(); return; }
    var slug = slugificar(nombre);
    var columnas = Math.max(2, Math.min(12, +el.querySelector("#t-columnas").value || 6));
    var filasHiladorMax = Math.max(0, Math.min(99, +el.querySelector("#t-max-hilador").value || 0));
    var proyecto = {
      slug: slug, nombre: nombre, activo: true, columnas: columnas,
      redondezExterior: APARIENCIA_DEFECTO.redondezExterior,
      redondezInterior: APARIENCIA_DEFECTO.redondezInterior,
      espacioNudos: APARIENCIA_DEFECTO.espacioNudos,
      filasHiladorMax: filasHiladorMax,
      urdimbre: construirUrdimbre(columnas),
      creadoPor: perfil.email, creadoEn: new Date().toISOString()
    };
    if (columnas === 6) proyecto.formularioMesa = FORMULARIO_MESA_DEFECTO;
    await setDoc(doc(db, "proyectos", slug), proyecto);
    registrar(slug, { tipo: "proyecto_creado", resumen: "Telar creado: " + nombre, autor: perfil.email });
    el.querySelector("#t-nombre").value = "";
    el.querySelector("#t-estado").textContent = "Creado. Ábrelo en \"Filas y apariencia\".";
  });

  el.querySelector("#t-sembrar-sample").addEventListener("click", async function () {
    var estadoEl = el.querySelector("#t-estado");
    estadoEl.textContent = "Sembrando telar de ejemplo…";
    try {
      var res = await fetch("proyectos/sample/seed.json");
      var seed = await res.json();
      await setDoc(doc(db, "proyectos", seed.proyecto.slug), Object.assign({}, seed.proyecto, { creadoPor: perfil.email }));
      for (var i = 0; i < seed.pasadas.length; i++) {
        var p = seed.pasadas[i];
        var pasadaRef = doc(db, "proyectos", seed.proyecto.slug, "pasadas", p.id);
        var datosPasada = { index: p.index, tipo: p.tipo, etiquetaCorta: p.etiquetaCorta, nombre: p.nombre };
        if (p.composicion) datosPasada.composicion = p.composicion;
        await setDoc(pasadaRef, datosPasada, { merge: true });
        var nudosCol = collection(pasadaRef, "nudos");
        for (var j = 0; j < (p.nudos || []).length; j++) {
          var n = p.nudos[j];
          await setDoc(doc(nudosCol, "sembrado_" + n.hiloId), Object.assign({
            hiloId: n.hiloId, punto: n.punto || "solido", tinte: n.tinte || "#e7ebe2",
            matiz: n.matiz || null, acento: n.acento || null, giro: n.giro || 0, espejo: !!n.espejo,
            titulo: n.titulo || "", texto: n.texto || "", imagenUrl: n.imagenUrl || "", enlaceUrl: n.enlaceUrl || "",
            estado: "tejido", fuente: "sembrado", eco: false
          }), { merge: true });
        }
      }
      registrar(seed.proyecto.slug, { tipo: "proyecto_sembrado", resumen: "Telar de ejemplo sembrado", autor: perfil.email });
      estadoEl.textContent = "Listo: el telar \"sample\" está sembrado.";
    } catch (e) {
      estadoEl.textContent = "Error sembrando: " + e.message;
    }
  });

  var unsub = onSnapshot(collection(db, "proyectos"), function (snap) {
    var html = "";
    snap.forEach(function (d) {
      var p = d.data();
      html += '<div class="card" data-slug="' + d.id + '" style="margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<div><strong>' + p.nombre + '</strong> <span class="ghost">· /' + d.id + " · " + p.columnas + ' columnas</span></div>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:.78rem"><input type="checkbox" class="t-activo"' + (p.activo ? " checked" : "") + '> Activo</label>' +
            '<a class="btn" href="index.html?p=' + d.id + '" target="_blank">Ver</a>' +
            '<button class="btn t-borrar">Borrar</button>' +
          '</div>' +
        '</div>' +
        '<div class="pair" style="margin-top:12px">' +
          '<div class="field"><label>Redondez exterior <span class="t-rext-v">' + p.redondezExterior + '</span></label><input type="range" min="0" max="46" class="t-rext" value="' + p.redondezExterior + '"></div>' +
          '<div class="field"><label>Redondez interior <span class="t-rint-v">' + p.redondezInterior + '</span></label><input type="range" min="0" max="46" class="t-rint" value="' + p.redondezInterior + '"></div>' +
        '</div>' +
        '<div class="field" style="max-width:260px"><label>Espacio entre nudos <span class="t-esp-v">' + p.espacioNudos + 'px</span></label><input type="range" min="0" max="8" class="t-esp" value="' + p.espacioNudos + '"></div>' +
      '</div>';
    });
    el.querySelector("#lista-telares").innerHTML = html || '<p class="estado-vacio">Todavía no hay telares.</p>';

    Array.prototype.forEach.call(el.querySelectorAll("[data-slug]"), function (card) {
      var slug = card.dataset.slug;
      var ref = doc(db, "proyectos", slug);
      card.querySelector(".t-activo").addEventListener("change", function (e) { setDoc(ref, { activo: e.target.checked }, { merge: true }); });
      card.querySelector(".t-rext").addEventListener("input", function (e) {
        card.querySelector(".t-rext-v").textContent = e.target.value;
        setDoc(ref, { redondezExterior: +e.target.value }, { merge: true });
      });
      card.querySelector(".t-rint").addEventListener("input", function (e) {
        card.querySelector(".t-rint-v").textContent = e.target.value;
        setDoc(ref, { redondezInterior: +e.target.value }, { merge: true });
      });
      card.querySelector(".t-esp").addEventListener("input", function (e) {
        card.querySelector(".t-esp-v").textContent = e.target.value + "px";
        setDoc(ref, { espacioNudos: +e.target.value }, { merge: true });
      });
      card.querySelector(".t-borrar").addEventListener("click", async function () {
        if (!confirm('¿Borrar el telar "' + slug + '" y todo su contenido? Esto no se puede deshacer.')) return;
        await borrarProyecto(slug);
      });
    });
  });
  unsubs.push(unsub);
}

async function borrarProyecto(slug) {
  var pasadasSnap = await getDocs(collection(db, "proyectos", slug, "pasadas"));
  for (var i = 0; i < pasadasSnap.docs.length; i++) {
    var pasadaDoc = pasadasSnap.docs[i];
    var nudosSnap = await getDocs(collection(pasadaDoc.ref, "nudos"));
    for (var j = 0; j < nudosSnap.docs.length; j++) await deleteDoc(nudosSnap.docs[j].ref);
    await deleteDoc(pasadaDoc.ref);
  }
  var plantillasSnap = await getDocs(collection(db, "proyectos", slug, "plantillas"));
  for (var k = 0; k < plantillasSnap.docs.length; k++) await deleteDoc(plantillasSnap.docs[k].ref);
  await deleteDoc(doc(db, "proyectos", slug));
}

/* ================= selector de telar reutilizable ================= */
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

/* ================= ESTRUCTURA / APARIENCIA ================= */
function renderEstructura(el, perfil, unsubs, onProyectoCambia) {
  el.innerHTML = '<div id="est-selector"></div><div id="est-contenido" style="margin-top:14px"></div>';
  var unsub = renderSelectorTelar(el.querySelector("#est-selector"), function (proyecto) {
    onProyectoCambia(proyecto);
    cargarEstructuraProyecto(el.querySelector("#est-contenido"), proyecto, perfil, unsubs);
  });
  unsubs.push(unsub);
}

function cargarEstructuraProyecto(el, proyecto, perfil, unsubs) {
  el.innerHTML =
    '<div class="card" style="margin-bottom:14px">' +
      '<div class="pair" style="align-items:flex-end">' +
        '<div class="field"><label>Nombre de la nueva fila</label><input id="np-nombre" placeholder="Ej: Eje B"></div>' +
        '<div class="field"><label>Tipo</label><select id="np-tipo">' +
          '<option value="institucional">Institucional</option><option value="colaborativa">Colaborativa</option><option value="orillo">Orillo (separador)</option>' +
        '</select></div>' +
      '</div>' +
      '<button class="btn primary" id="np-crear">Agregar fila</button>' +
      '<p class="ghost" style="margin-top:6px">Si hay una plantilla del urdidor guardada para ese tipo, la forma de los 6 nudos se sugiere automáticamente (vos pones el color y el texto).</p>' +
    '</div>' +
    '<div class="field" style="max-width:320px"><label>Fila a editar</label><select id="sel-pasada"></select></div>' +
    '<div id="editor-nudos"></div>';

  el.querySelector("#np-crear").addEventListener("click", async function () {
    var nombre = el.querySelector("#np-nombre").value.trim();
    if (!nombre) { el.querySelector("#np-nombre").focus(); return; }
    var tipo = el.querySelector("#np-tipo").value;
    var pasadasSnap = await getDocs(collection(db, "proyectos", proyecto.id, "pasadas"));
    var existentes = pasadasSnap.docs.map(function (d) { return d.data(); });
    var siguienteIndex = existentes.reduce(function (max, p) { return Math.max(max, p.index || 0); }, 0) + 1;
    var mismasTipo = existentes.filter(function (p) { return p.tipo === tipo; }).length;
    var id = slugificar(nombre) + "-" + siguienteIndex;
    var pasadaRef = doc(db, "proyectos", proyecto.id, "pasadas", id);
    await setDoc(pasadaRef, { index: siguienteIndex, tipo: tipo, etiquetaCorta: String(siguienteIndex), nombre: nombre });

    var plantillasSnap = await getDocs(query(collection(db, "proyectos", proyecto.id, "plantillas"), where("tipo", "==", tipo)));
    var plantilla = null;
    plantillasSnap.forEach(function (d) { if (!plantilla) plantilla = d.data(); });
    if (plantilla && tipo !== "orillo") {
      var hilos = proyecto.urdimbre.filter(function (h) { return h.tipo === "contenido"; });
      var nudosCol = collection(pasadaRef, "nudos");
      for (var c = 0; c < hilos.length; c++) {
        var forma = aplicarPatron(plantilla, mismasTipo, c);
        await setDoc(doc(nudosCol, "directo_" + hilos[c].id), {
          hiloId: hilos[c].id, punto: forma.punto, giro: forma.giro, espejo: forma.espejo,
          tinte: "#f1f0ec", matiz: null, acento: null, titulo: "", texto: "", imagenUrl: "", enlaceUrl: "",
          estado: "tejido", fuente: "directo", eco: false
        });
      }
    }
    registrar(proyecto.id, { tipo: "fila_creada", resumen: "Fila creada: " + nombre + " (" + tipo + ")", autor: perfil.email });
    el.querySelector("#np-nombre").value = "";
  });

  var qPasadas = query(collection(db, "proyectos", proyecto.id, "pasadas"), orderBy("index"));
  var unsub = onSnapshot(qPasadas, function (snap) {
    var pasadas = [];
    snap.forEach(function (d) { pasadas.push(Object.assign({ id: d.id }, d.data())); });
    var sel = el.querySelector("#sel-pasada");
    var actual = sel.value;
    sel.innerHTML = pasadas.map(function (p) { return '<option value="' + p.id + '">' + p.index + " · " + (p.nombre || p.id) + "</option>"; }).join("");
    var elegido = pasadas.some(function (p) { return p.id === actual; }) ? actual : (pasadas[0] && pasadas[0].id);
    if (elegido) {
      sel.value = elegido;
      sel.onchange = function () { cargarEditorPasada(el.querySelector("#editor-nudos"), proyecto, sel.value, perfil, unsubs); };
      if (!el.dataset.cargado || el.dataset.cargado !== elegido) {
        el.dataset.cargado = elegido;
        cargarEditorPasada(el.querySelector("#editor-nudos"), proyecto, elegido, perfil, unsubs);
      }
    } else {
      el.querySelector("#editor-nudos").innerHTML = '<p class="estado-vacio">Todavía no hay filas. Agrega una arriba.</p>';
    }
  });
  unsubs.push(unsub);
}

function swatchesHTML(clase, valorActual, conVacio) {
  var html = PALETA.map(function (c) {
    return '<button type="button" class="swatch-btn ' + clase + '" data-hex="' + c.hex + '" title="' + c.id + '" ' +
      'style="background:' + c.hex + '" aria-pressed="' + (valorActual === c.hex) + '"></button>';
  }).join("");
  if (conVacio) html += '<button type="button" class="swatch-btn vacio ' + clase + '" data-hex="" title="ninguno" aria-pressed="' + (!valorActual) + '"></button>';
  return html;
}

function cargarEditorPasada(el, proyecto, pasadaId, perfil, unsubs) {
  var apariencia = { redondezExterior: proyecto.redondezExterior, redondezInterior: proyecto.redondezInterior };
  var nudosCol = collection(db, "proyectos", proyecto.id, "pasadas", pasadaId, "nudos");
  var hilos = proyecto.urdimbre.filter(function (h) { return h.tipo === "contenido"; });
  var unsub = onSnapshot(nudosCol, function (snap) {
    var porHilo = {};
    snap.forEach(function (d) { porHilo[d.data().hiloId] = Object.assign({ id: d.id }, d.data()); });
    el.innerHTML = '<div style="display:grid;gap:14px;grid-template-columns:1fr">' +
      hilos.map(function (hilo) {
        var n = porHilo[hilo.id] || { hiloId: hilo.id, punto: "solido", tinte: "#e7ebe2" };
        return '<div class="card" data-hilo="' + hilo.id + '">' +
          '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">' +
            '<div class="mini-preview" style="width:60px;height:60px;flex:0 0 auto">' + dibujarNudo(n, apariencia) + '</div>' +
            '<div style="flex:1;min-width:240px">' +
              '<div class="field"><label>Punto</label><select class="in-punto">' +
                PUNTOS.map(function (p) { return '<option value="' + p.id + '"' + (n.punto === p.id ? " selected" : "") + '>' + p.nombre + "</option>"; }).join("") +
              '</select></div>' +
              '<div class="field"><label>Tinte</label><div class="swatches in-tinte-cont">' + swatchesHTML("in-tinte", n.tinte, false) + '</div></div>' +
              '<div class="field"><label>Matiz</label><div class="swatches in-matiz-cont">' + swatchesHTML("in-matiz", n.matiz, true) + '</div></div>' +
              '<div class="field"><label>Acento</label><div class="swatches in-acento-cont">' + swatchesHTML("in-acento", n.acento, true) + '</div></div>' +
              '<div class="pair">' +
                '<button class="btn in-girar">Girar 90° (' + (n.giro || 0) + '°)</button>' +
                '<button class="btn in-espejo" aria-pressed="' + !!n.espejo + '">Espejo: ' + (n.espejo ? "sí" : "no") + '</button>' +
              '</div>' +
              '<div class="field"><label>Título (opcional)</label><input class="in-titulo" value="' + (n.titulo || "") + '"></div>' +
              '<div class="field"><label>Texto</label><textarea class="in-texto" maxlength="180">' + (n.texto || "") + '</textarea></div>' +
              '<div class="field"><label>Imagen (URL, opcional)</label><input class="in-imagen" value="' + (n.imagenUrl || "") + '"></div>' +
              '<div class="field"><label>Enlace (URL, opcional)</label><input class="in-enlace" value="' + (n.enlaceUrl || "") + '"></div>' +
            '</div>' +
          '</div></div>';
      }).join("") + "</div>";

    Array.prototype.forEach.call(el.querySelectorAll("[data-hilo]"), function (card) {
      var hiloId = card.dataset.hilo;
      var estadoLocal = Object.assign({ giro: 0, espejo: false }, porHilo[hiloId] || {});

      function guardar(cambios) {
        Object.assign(estadoLocal, cambios);
        var existente = porHilo[hiloId];
        var ref = existente ? doc(nudosCol, existente.id) : doc(nudosCol, "directo_" + hiloId);
        setDoc(ref, Object.assign({
          hiloId: hiloId, estado: "tejido",
          fuente: (existente && existente.fuente) || "directo",
          eco: (existente && existente.eco) || false
        }, estadoLocal), { merge: true });
        card.querySelector(".mini-preview").innerHTML = dibujarNudo(estadoLocal, apariencia);
        registrar(proyecto.id, { tipo: "nudo_editado", resumen: "Nudo editado en " + pasadaId + "/" + hiloId, autor: perfil.email });
      }

      card.querySelector(".in-punto").addEventListener("change", function (e) { guardar({ punto: e.target.value }); });
      card.querySelector(".in-titulo").addEventListener("input", function (e) { guardar({ titulo: e.target.value }); });
      card.querySelector(".in-texto").addEventListener("input", function (e) { guardar({ texto: e.target.value }); });
      card.querySelector(".in-imagen").addEventListener("input", function (e) { guardar({ imagenUrl: e.target.value }); });
      card.querySelector(".in-enlace").addEventListener("input", function (e) { guardar({ enlaceUrl: e.target.value }); });
      card.querySelector(".in-girar").addEventListener("click", function () {
        var giro = ((estadoLocal.giro || 0) + 90) % 360;
        this.textContent = "Girar 90° (" + giro + "°)";
        guardar({ giro: giro });
      });
      card.querySelector(".in-espejo").addEventListener("click", function () {
        var espejo = !estadoLocal.espejo;
        this.setAttribute("aria-pressed", espejo);
        this.textContent = "Espejo: " + (espejo ? "sí" : "no");
        guardar({ espejo: espejo });
      });
      ["tinte", "matiz", "acento"].forEach(function (campo) {
        Array.prototype.forEach.call(card.querySelectorAll(".in-" + campo), function (b) {
          b.addEventListener("click", function () {
            Array.prototype.forEach.call(card.querySelectorAll(".in-" + campo), function (o) { o.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
            var cambio = {}; cambio[campo] = b.dataset.hex || null;
            guardar(cambio);
          });
        });
      });
    });
  });
  unsubs.push(unsub);
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
    '<div class="card" style="max-width:480px;margin-bottom:16px">' +
      '<h3 style="font-size:.9rem;margin-bottom:10px">Agregar o actualizar persona</h3>' +
      '<div class="field"><label>Correo</label><input id="r-email" type="email" placeholder="nombre@umag.cl"></div>' +
      '<div class="field"><label>Rol</label><select id="r-rol">' +
        ROLES.map(function (r) { return '<option value="' + r + '">' + ROL_LABEL[r] + "</option>"; }).join("") +
      '</select></div>' +
      '<button class="btn primary" id="btn-guardar-persona">Guardar</button>' +
    '</div>' +
    '<div id="lista-personas"></div>';

  el.querySelector("#btn-guardar-persona").addEventListener("click", async function () {
    var email = el.querySelector("#r-email").value.trim().toLowerCase();
    var rol = el.querySelector("#r-rol").value;
    if (!email) return;
    await setDoc(doc(db, "usuarios_roles", email), { rol: rol }, { merge: true });
    el.querySelector("#r-email").value = "";
  });

  var unsub = onSnapshot(collection(db, "usuarios_roles"), function (snap) {
    var html = '<table style="width:100%;border-collapse:collapse;font-size:.84rem">' +
      '<thead><tr style="text-align:left;color:var(--fg-soft)"><th>Correo</th><th>Rol</th><th></th></tr></thead><tbody>';
    snap.forEach(function (d) {
      var u = d.data();
      html += '<tr style="border-top:1px solid var(--line)"><td style="padding:6px 0">' + d.id + "</td><td>" +
        (ROL_LABEL[u.rol] || u.rol) + '</td><td><button class="btn btn-borrar" data-email="' + d.id + '">Quitar</button></td></tr>';
    });
    html += "</tbody></table>";
    el.querySelector("#lista-personas").innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll(".btn-borrar"), function (b) {
      b.addEventListener("click", function () { deleteDoc(doc(db, "usuarios_roles", b.dataset.email)); });
    });
  });
  unsubs.push(unsub);
}

/* ================= HISTORIA ================= */
function renderHistoria(el, unsubs) {
  el.innerHTML = '<div id="hist-selector"></div><div id="hist-lista" style="margin-top:14px"></div>';
  var unsubHistorialActual = null;
  var unsubSel = renderSelectorTelar(el.querySelector("#hist-selector"), function (proyecto) {
    if (unsubHistorialActual) unsubHistorialActual();
    unsubHistorialActual = suscribirHistorial(proyecto.id, function (entradas) {
      var html = entradas.map(function (h) {
        var fecha = h.ts && h.ts.toDate ? h.ts.toDate().toLocaleString("es-CL") : "";
        return '<div class="card" style="margin-bottom:8px;padding:10px 14px">' +
          '<div style="font-size:.82rem">' + (h.resumen || h.tipo) + '</div>' +
          '<div class="ghost">' + (h.autor || "") + (fecha ? " · " + fecha : "") + "</div></div>";
      }).join("");
      el.querySelector("#hist-lista").innerHTML = html || '<p class="estado-vacio">Sin movimientos registrados todavía.</p>';
    });
  });
  unsubs.push(unsubSel);
  unsubs.push(function () { if (unsubHistorialActual) unsubHistorialActual(); });
}
