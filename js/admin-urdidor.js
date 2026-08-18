import { db } from "./firebaseClient.js";
import {
  collection, doc, getDocs, setDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { PUNTOS, PALETA, APARIENCIA_DEFECTO, dibujarNudo } from "./motifs.js";
import { construirUrdimbre } from "./telarCore.js";
import { ROLES, ROL_LABEL } from "./auth.js";
import { registrar, suscribirHistorial } from "./historial.js";
import { FORMULARIO_MESA_DEFECTO } from "./formularioMesaDefecto.js";
import { suscribirEstilos, sembrarEstilosBase } from "./estilos.js";
import { renderContenido, renderMesasNuevas, renderCola } from "./admin-tejedor.js";
import { renderMesas } from "./admin-hilador.js";

/* =========================================================
   admin-urdidor.js — urdidor puede hacer todo: crea/borra
   telares, cura la lista finita de estilos, y además reutiliza
   las mismas pantallas de tejedor (contenido, cola) e hilador
   (mesas) en vez de duplicarlas.
   ========================================================= */

export function render(el, perfil) {
  var unsubs = [];
  var tabs = ["telares", "estilos", "contenido", "mesas", "cola", "roles", "historia"];
  var labels = { telares: "Mis telares", estilos: "Estilos", contenido: "Contenido", mesas: "Mesas", cola: "Cola de moderación", roles: "Personas y roles", historia: "Historia" };

  el.innerHTML =
    '<div class="tabs" role="tablist" style="margin-bottom:18px;flex-wrap:wrap">' +
      tabs.map(function (t, i) { return '<button class="tab" data-tab="' + t + '" aria-selected="' + (i === 0) + '">' + labels[t] + "</button>"; }).join("") +
    '</div>' +
    tabs.map(function (t, i) { return '<div id="panel-' + t + '"' + (i === 0 ? "" : " hidden") + '></div>'; }).join("");

  Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      tabs.forEach(function (k) { el.querySelector("#panel-" + k).hidden = k !== t.dataset.tab; });
    });
  });

  renderTelares(el.querySelector("#panel-telares"), perfil, unsubs);
  renderEstilos(el.querySelector("#panel-estilos"), perfil, unsubs);
  renderContenido(el.querySelector("#panel-contenido"), perfil, unsubs);
  renderMesas(el.querySelector("#panel-mesas"), perfil, unsubs);
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
      '<p class="ghost">Empieza vacío: sin filas, sin contenido. Lo armas desde "Contenido". ' +
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
      espacioNudos: APARIENCIA_DEFECTO.espacioNudos,
      filasHiladorMax: filasHiladorMax,
      urdimbre: construirUrdimbre(columnas),
      creadoPor: perfil.email, creadoEn: new Date().toISOString()
    };
    if (columnas === 6) proyecto.formularioMesa = FORMULARIO_MESA_DEFECTO;
    await setDoc(doc(db, "proyectos", slug), proyecto);
    await sembrarEstilosBase(slug);
    registrar(slug, { tipo: "proyecto_creado", resumen: "Telar creado: " + nombre, autor: perfil.email });
    el.querySelector("#t-nombre").value = "";
    el.querySelector("#t-estado").textContent = "Creado. Ábrelo en \"Contenido\".";
  });

  el.querySelector("#t-sembrar-sample").addEventListener("click", async function () {
    var estadoEl = el.querySelector("#t-estado");
    estadoEl.textContent = "Sembrando telar de ejemplo…";
    try {
      var res = await fetch("proyectos/sample/seed.json");
      var seed = await res.json();
      await setDoc(doc(db, "proyectos", seed.proyecto.slug), Object.assign({}, seed.proyecto, { creadoPor: perfil.email }));
      await sembrarEstilosBase(seed.proyecto.slug);
      for (var e = 0; e < (seed.estilos || []).length; e++) {
        var es = seed.estilos[e];
        await setDoc(doc(db, "proyectos", seed.proyecto.slug, "estilos", es.id), { nombre: es.nombre, punto: es.punto, tinte: es.tinte, matiz: es.matiz || null });
      }
      for (var i = 0; i < seed.pasadas.length; i++) {
        var p = seed.pasadas[i];
        var pasadaRef = doc(db, "proyectos", seed.proyecto.slug, "pasadas", p.id);
        await setDoc(pasadaRef, { index: p.index, tipo: p.tipo, etiquetaCorta: p.etiquetaCorta, nombre: p.nombre }, { merge: true });
        var nudosCol = collection(pasadaRef, "nudos");
        for (var j = 0; j < (p.nudos || []).length; j++) {
          var n = p.nudos[j];
          await setDoc(doc(nudosCol, "sembrado_" + n.hiloId), Object.assign({
            hiloId: n.hiloId, punto: n.punto || "solido", tinte: n.tinte || "#3a402f",
            matiz: n.matiz || null, giro: n.giro || 0, espejo: !!n.espejo,
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
        '<div class="field" style="max-width:260px;margin-top:12px"><label>Espacio entre nudos <span class="t-esp-v">' + p.espacioNudos + 'px</span></label><input type="range" min="0" max="8" class="t-esp" value="' + p.espacioNudos + '"></div>' +
      '</div>';
    });
    el.querySelector("#lista-telares").innerHTML = html || '<p class="estado-vacio">Todavía no hay telares.</p>';

    Array.prototype.forEach.call(el.querySelectorAll("[data-slug]"), function (card) {
      var slug = card.dataset.slug;
      var ref = doc(db, "proyectos", slug);
      card.querySelector(".t-activo").addEventListener("change", function (e) { setDoc(ref, { activo: e.target.checked }, { merge: true }); });
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
  var estilosSnap = await getDocs(collection(db, "proyectos", slug, "estilos"));
  for (var k = 0; k < estilosSnap.docs.length; k++) await deleteDoc(estilosSnap.docs[k].ref);
  await deleteDoc(doc(db, "proyectos", slug));
}

/* ================= ESTILOS (lista finita que cura el urdidor) ================= */
function renderEstilos(el, perfil, unsubs) {
  el.innerHTML = '<div id="es-selector" style="margin-bottom:14px"></div><div id="es-cuerpo"></div>';
  var unsubEstilos = null;
  var unsubSel = renderSelectorTelarSimple(el.querySelector("#es-selector"), function (proyecto) {
    if (unsubEstilos) unsubEstilos();
    unsubEstilos = cargarEstilos(el.querySelector("#es-cuerpo"), proyecto, perfil);
  });
  unsubs.push(unsubSel);
  unsubs.push(function () { if (unsubEstilos) unsubEstilos(); });
}

function renderSelectorTelarSimple(el, onCambia) {
  el.innerHTML = '<div class="field" style="max-width:320px"><label>Telar</label><select id="sel-telar-es"></select></div>';
  var sel = el.querySelector("#sel-telar-es");
  var unsub = onSnapshot(collection(db, "proyectos"), function (snap) {
    var actual = sel.value;
    var opciones = [];
    snap.forEach(function (d) { opciones.push(Object.assign({ id: d.id }, d.data())); });
    sel.innerHTML = opciones.map(function (p) { return '<option value="' + p.id + '">' + p.nombre + "</option>"; }).join("");
    var elegido = opciones.some(function (p) { return p.id === actual; }) ? actual : (opciones[0] && opciones[0].id);
    if (elegido) { sel.value = elegido; onCambia(opciones.filter(function (p) { return p.id === elegido; })[0]); }
    sel.onchange = function () { onCambia(opciones.filter(function (p) { return p.id === sel.value; })[0]); };
  });
  return unsub;
}

function cargarEstilos(el, proyecto, perfil) {
  el.innerHTML =
    '<div class="card" style="max-width:480px;margin-bottom:16px">' +
      '<h3 style="font-size:.9rem;margin-bottom:10px">Nuevo estilo</h3>' +
      '<div class="field"><label>Nombre</label><input id="es-nombre" placeholder="Ej: Desafío fuerte"></div>' +
      '<div class="field"><label>Punto</label><select id="es-punto">' +
        PUNTOS.filter(function (p) { return p.id !== "vacio"; }).map(function (p) { return '<option value="' + p.id + '">' + p.nombre + "</option>"; }).join("") +
      '</select></div>' +
      '<div class="field"><label>Tinte</label><div class="swatches" id="es-tinte-cont">' + swatchesHTML("es-tinte", "#3a402f") + '</div></div>' +
      '<div class="field"><label>Matiz</label><div class="swatches" id="es-matiz-cont">' + swatchesHTML("es-matiz", "#3a402f") + '</div></div>' +
      '<button class="btn primary" id="es-crear">Crear estilo</button>' +
    '</div>' +
    '<div id="es-lista" style="display:grid;gap:10px;grid-template-columns:1fr"></div>';

  var seleccion = { tinte: "#3a402f", matiz: "#3a402f" };
  ["tinte", "matiz"].forEach(function (campo) {
    Array.prototype.forEach.call(el.querySelectorAll(".es-" + campo), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(el.querySelectorAll(".es-" + campo), function (o) { o.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        seleccion[campo] = b.dataset.hex;
      });
    });
  });

  el.querySelector("#es-crear").addEventListener("click", async function () {
    var nombre = el.querySelector("#es-nombre").value.trim();
    if (!nombre) { el.querySelector("#es-nombre").focus(); return; }
    var id = slugificar(nombre);
    await setDoc(doc(db, "proyectos", proyecto.id, "estilos", id), {
      nombre: nombre, punto: el.querySelector("#es-punto").value, tinte: seleccion.tinte, matiz: seleccion.matiz
    });
    registrar(proyecto.id, { tipo: "estilo_creado", resumen: "Estilo creado: " + nombre, autor: perfil.email });
    el.querySelector("#es-nombre").value = "";
  });

  var unsub = suscribirEstilos(proyecto.id, function (lista) {
    el.querySelector("#es-lista").innerHTML = lista.map(function (es) {
      return '<div class="card" style="display:flex;gap:12px;align-items:center" data-id="' + es.id + '">' +
        '<div style="width:44px;height:44px;flex:0 0 auto">' + dibujarNudo(es) + '</div>' +
        '<div style="flex:1"><strong>' + es.nombre + '</strong><div class="ghost">' + es.punto + '</div></div>' +
        '<button class="btn es-borrar">Borrar</button></div>';
    }).join("") || '<p class="estado-vacio">Todavía no hay estilos en este telar. Crea el primero arriba.</p>';
    Array.prototype.forEach.call(el.querySelectorAll("[data-id]"), function (card) {
      card.querySelector(".es-borrar").addEventListener("click", function () {
        deleteDoc(doc(db, "proyectos", proyecto.id, "estilos", card.dataset.id));
      });
    });
  });
  return unsub;
}

function swatchesHTML(clase, valorDefecto) {
  return PALETA.map(function (c, i) {
    return '<button type="button" class="swatch-btn ' + clase + '" data-hex="' + c.hex + '" title="' + c.id + '" ' +
      'style="background:' + c.hex + '" aria-pressed="' + (c.hex === valorDefecto) + '"></button>';
  }).join("");
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
  var unsubSel = renderSelectorTelarSimple(el.querySelector("#hist-selector"), function (proyecto) {
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
