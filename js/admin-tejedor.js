import { db } from "./firebaseClient.js";
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { renderCabecera, renderCuerpo } from "./telarCore.js";
import { dibujarNudo } from "./motifs.js";
import { CATEGORIAS, suscribirEstilos, resolverEstiloCategoria } from "./estilos.js";
import { FORMULARIO_MESA_DEFECTO, PARES_MESA } from "./formularioMesaDefecto.js";
import { registrar } from "./historial.js";
import { debounce } from "./util.js";

export function render(el, perfil) {
  var unsubs = [];
  el.innerHTML =
    '<div class="tabs" style="margin-bottom:18px">' +
      '<button class="tab" data-tab="contenido" aria-selected="true">Contenido</button>' +
      '<button class="tab" data-tab="mesas-nuevas" aria-selected="false">Estilo de mesas nuevas</button>' +
      '<button class="tab" data-tab="cola" aria-selected="false">Cola de moderación</button>' +
    '</div>' +
    '<div id="panel-contenido"></div>' +
    '<div id="panel-mesas-nuevas" hidden></div>' +
    '<div id="panel-cola" hidden></div>';

  Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(el.querySelectorAll(".tab"), function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
      ["contenido", "mesas-nuevas", "cola"].forEach(function (k) {
        el.querySelector("#panel-" + k).hidden = k !== t.dataset.tab;
      });
    });
  });

  renderContenido(el.querySelector("#panel-contenido"), perfil, unsubs);
  renderMesasNuevas(el.querySelector("#panel-mesas-nuevas"), perfil, unsubs);
  renderCola(el.querySelector("#panel-cola"), unsubs);

  return function () { unsubs.forEach(function (u) { u(); }); };
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

function slugificar(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function clave(pasadaId, hiloId) { return pasadaId + "|" + hiloId; }

/* ================= CONTENIDO: grilla completa + panel de edición ================= */
export function renderContenido(el, perfil, unsubs) {
  var estado = {
    proyecto: null, pasadas: [], nudosPorPasada: {}, suscritas: {}, estilos: [],
    seleccion: [], ancla: null
  };

  el.innerHTML =
    '<div id="ct-selector" style="margin-bottom:14px"></div>' +
    '<p style="margin-bottom:16px"><button class="btn" id="ct-exportar">Descargar respaldo (JSON) de este telar</button> ' +
    '<span class="ghost" style="font-size:.78rem">Sirve para reconstruir el telar si la base de datos se pierde.</span></p>' +
    '<div class="card" style="max-width:520px;margin-bottom:16px">' +
      '<div class="pair" style="align-items:flex-end">' +
        '<div class="field"><label>Nombre de la nueva fila</label><input id="np-nombre" placeholder="Ej: Eje B"></div>' +
        '<div class="field"><label>Tipo</label><select id="np-tipo">' +
          '<option value="institucional">Institucional</option><option value="colaborativa">Colaborativa (mesa)</option>' +
        '</select></div>' +
      '</div>' +
      '<button class="btn primary" id="np-crear">Agregar fila</button>' +
      '<p class="ghost" style="margin-top:6px">Empieza vacía y oculta para quien visita el telar. Actívala abajo cuando esté lista.</p>' +
    '</div>' +
    '<div class="card" style="margin-bottom:16px">' +
      '<h3 style="font-size:.9rem;margin-bottom:10px">Filas de este telar</h3>' +
      '<div id="ct-filas-lista" style="display:grid;gap:6px"></div>' +
    '</div>' +
    '<p class="ghost" style="margin-bottom:10px">Clic para elegir un nudo. Shift+clic selecciona un rango, Ctrl/Cmd+clic suma o quita uno — como en Excel.</p>' +
    '<div class="stage">' +
      '<div class="telar"><div id="ct-cabecera" class="telar-cabecera"></div><div id="ct-cuerpo"></div></div>' +
      '<aside class="panel" id="ct-panel"><div id="ct-panel-body"><p class="estado-vacio">Toca un nudo para editarlo.</p></div></aside>' +
    '</div>';

  var unsubTelar = null, unsubEstilos = null;
  var unsubSel = renderSelectorTelar(el.querySelector("#ct-selector"), function (proyecto) {
    if (unsubTelar) unsubTelar();
    if (unsubEstilos) unsubEstilos();
    estado.proyecto = proyecto;
    estado.nudosPorPasada = {};
    estado.suscritas = {};
    estado.seleccion = [];
    estado.ancla = null;
    unsubEstilos = suscribirEstilos(proyecto.id, function (lista) { estado.estilos = lista; });
    unsubTelar = cargarTelar(el, estado, perfil);
  });
  unsubs.push(unsubSel);
  unsubs.push(function () { if (unsubTelar) unsubTelar(); if (unsubEstilos) unsubEstilos(); });

  el.querySelector("#np-crear").addEventListener("click", async function () {
    if (!estado.proyecto) return;
    var nombre = el.querySelector("#np-nombre").value.trim();
    if (!nombre) { el.querySelector("#np-nombre").focus(); return; }
    var tipo = el.querySelector("#np-tipo").value;
    var pasadasSnap = await getDocs(collection(db, "proyectos", estado.proyecto.id, "pasadas"));
    var siguienteIndex = pasadasSnap.docs.reduce(function (max, d) { return Math.max(max, d.data().index || 0); }, 0) + 1;
    var id = slugificar(nombre) + "-" + siguienteIndex;
    await setDoc(doc(db, "proyectos", estado.proyecto.id, "pasadas", id), {
      index: siguienteIndex, tipo: tipo, nombre: nombre, activo: false
    });
    registrar(estado.proyecto.id, { tipo: "fila_creada", resumen: "Fila creada: " + nombre + " (" + tipo + ")", autor: perfil.email });
    el.querySelector("#np-nombre").value = "";
  });

  el.querySelector("#ct-exportar").addEventListener("click", async function () {
    if (!estado.proyecto) return;
    var boton = this;
    boton.disabled = true;
    var textoOriginal = boton.textContent;
    boton.textContent = "Preparando…";
    try {
      await exportarProyectoJSON(estado.proyecto);
      registrar(estado.proyecto.id, { tipo: "proyecto_exportado", resumen: "Respaldo JSON descargado", autor: perfil.email });
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });
}

/** respaldo completo de un telar (proyecto + estilos + pasadas + sus nudos) como un archivo .json descargable */
async function exportarProyectoJSON(proyecto) {
  var salida = { proyecto: Object.assign({ id: proyecto.id }, proyecto), estilos: [], pasadas: [], exportadoEn: new Date().toISOString() };

  var estilosSnap = await getDocs(collection(db, "proyectos", proyecto.id, "estilos"));
  estilosSnap.forEach(function (d) { salida.estilos.push(Object.assign({ id: d.id }, d.data())); });

  var pasadasSnap = await getDocs(query(collection(db, "proyectos", proyecto.id, "pasadas"), orderBy("index")));
  for (var i = 0; i < pasadasSnap.docs.length; i++) {
    var pasadaDoc = pasadasSnap.docs[i];
    var pasada = Object.assign({ id: pasadaDoc.id }, pasadaDoc.data());
    var nudosSnap = await getDocs(collection(pasadaDoc.ref, "nudos"));
    pasada.nudos = [];
    nudosSnap.forEach(function (n) { pasada.nudos.push(Object.assign({ id: n.id }, n.data())); });
    salida.pasadas.push(pasada);
  }

  var blob = new Blob([JSON.stringify(salida, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "telar-" + proyecto.id + "-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function cargarTelar(el, estado, perfil) {
  var unsubs = [];
  var proyecto = estado.proyecto;
  var qPasadas = query(collection(db, "proyectos", proyecto.id, "pasadas"), orderBy("index"));
  var unsub = onSnapshot(qPasadas, function (snap) {
    estado.pasadas = [];
    snap.forEach(function (d) { estado.pasadas.push(Object.assign({ id: d.id }, d.data())); });
    renderCabecera(el.querySelector("#ct-cabecera"), proyecto.urdimbre, { espacioNudos: proyecto.espacioNudos });
    renderFilasLista(el, estado, perfil);
    estado.pasadas.forEach(function (p) { suscribirNudos(el, estado, p, perfil, unsubs); });
    pintar(el, estado, perfil);
  });
  unsubs.push(unsub);
  return function () { unsubs.forEach(function (u) { u(); }); };
}

function renderFilasLista(el, estado, perfil) {
  var cont = el.querySelector("#ct-filas-lista");
  var n = estado.pasadas.length;
  cont.innerHTML = estado.pasadas.map(function (p, i) {
    return '<div class="fila-item" data-pasada="' + p.id + '">' +
      '<input type="checkbox" class="fl-activa" title="Activa (visible al público)"' + (p.activo !== false ? " checked" : "") + '>' +
      '<span class="tag">' + (p.tipo || "") + '</span>' +
      '<input class="fl-nombre" value="' + (p.nombre || "") + '">' +
      '<input class="fl-etiqueta" maxlength="3" placeholder="—" title="Nombre corto (hasta 3 letras) que se ve en la fila; al pasar el mouse muestra el nombre completo" value="' + (p.etiquetaCorta || "") + '">' +
      '<label class="fl-check" title="Muestra el color/forma real de las celdas de esta fila aunque todavía no tengan contenido">' +
        '<input type="checkbox" class="fl-forzar"' + (p.forzarColor ? " checked" : "") + '> Forzar color</label>' +
      '<label class="fl-check" title="Las celdas sin contenido se ven con color pero atenuadas/desaturadas, no a todo color">' +
        '<input type="checkbox" class="fl-atenuado"' + (p.atenuado !== false ? " checked" : "") + (p.forzarColor ? "" : " disabled") + '> Atenuado</label>' +
      '<button class="btn fl-subir" title="Subir"' + (i === 0 ? " disabled" : "") + '>↑</button>' +
      '<button class="btn fl-bajar" title="Bajar"' + (i === n - 1 ? " disabled" : "") + '>↓</button>' +
      '<button class="btn fl-borrar" title="Borrar fila">Borrar</button>' +
    '</div>';
  }).join("") || '<p class="estado-vacio">Todavía no hay filas. Agrega una arriba.</p>';

  Array.prototype.forEach.call(cont.querySelectorAll("[data-pasada]"), function (fila) {
    var id = fila.dataset.pasada;
    var ref = doc(db, "proyectos", estado.proyecto.id, "pasadas", id);
    var p = estado.pasadas.filter(function (x) { return x.id === id; })[0] || {};

    fila.querySelector(".fl-activa").addEventListener("change", function (e) {
      setDoc(ref, { activo: e.target.checked }, { merge: true });
      registrar(estado.proyecto.id, { tipo: "fila_activada", resumen: (e.target.checked ? "Fila activada: " : "Fila desactivada: ") + id, autor: perfil.email });
    });

    var nombreInput = fila.querySelector(".fl-nombre");
    function guardarNombre() {
      var nombre = nombreInput.value.trim();
      if (!nombre) { nombreInput.value = estado.pasadas.filter(function (p) { return p.id === id; })[0].nombre || ""; return; }
      setDoc(ref, { nombre: nombre }, { merge: true });
      registrar(estado.proyecto.id, { tipo: "fila_renombrada", resumen: "Fila renombrada: " + nombre, autor: perfil.email });
    }
    nombreInput.addEventListener("blur", guardarNombre);
    nombreInput.addEventListener("keydown", function (e) { if (e.key === "Enter") nombreInput.blur(); });

    var etiquetaInput = fila.querySelector(".fl-etiqueta");
    function guardarEtiqueta() {
      var etiqueta = etiquetaInput.value.trim().slice(0, 3);
      etiquetaInput.value = etiqueta;
      setDoc(ref, { etiquetaCorta: etiqueta }, { merge: true });
      registrar(estado.proyecto.id, { tipo: "fila_etiqueta", resumen: "Nombre corto de fila actualizado: " + (etiqueta || "(vacío)"), autor: perfil.email });
    }
    etiquetaInput.addEventListener("blur", guardarEtiqueta);
    etiquetaInput.addEventListener("keydown", function (e) { if (e.key === "Enter") etiquetaInput.blur(); });

    var forzarInput = fila.querySelector(".fl-forzar");
    var atenuadoInput = fila.querySelector(".fl-atenuado");
    forzarInput.addEventListener("change", function (e) {
      var forzar = e.target.checked;
      atenuadoInput.disabled = !forzar;
      var datos = { forzarColor: forzar };
      // al activar forzar por primera vez, "atenuado" arranca en true por defecto
      if (forzar && p.atenuado === undefined) { datos.atenuado = true; atenuadoInput.checked = true; }
      setDoc(ref, datos, { merge: true });
      registrar(estado.proyecto.id, { tipo: "fila_forzar_color", resumen: (forzar ? "Forzar color activado: " : "Forzar color desactivado: ") + id, autor: perfil.email });
    });
    atenuadoInput.addEventListener("change", function (e) {
      setDoc(ref, { atenuado: e.target.checked }, { merge: true });
      registrar(estado.proyecto.id, { tipo: "fila_atenuado", resumen: (e.target.checked ? "Atenuado activado: " : "Atenuado desactivado: ") + id, autor: perfil.email });
    });

    fila.querySelector(".fl-subir").addEventListener("click", function () { moverFila(estado, id, -1); });
    fila.querySelector(".fl-bajar").addEventListener("click", function () { moverFila(estado, id, 1); });
    fila.querySelector(".fl-borrar").addEventListener("click", function () { borrarFila(estado, id, perfil); });
  });
}

function moverFila(estado, id, direccion) {
  var i = estado.pasadas.findIndex(function (p) { return p.id === id; });
  var j = i + direccion;
  if (i === -1 || j < 0 || j >= estado.pasadas.length) return;
  var a = estado.pasadas[i], b = estado.pasadas[j];
  setDoc(doc(db, "proyectos", estado.proyecto.id, "pasadas", a.id), { index: b.index }, { merge: true });
  setDoc(doc(db, "proyectos", estado.proyecto.id, "pasadas", b.id), { index: a.index }, { merge: true });
}

async function borrarFila(estado, id, perfil) {
  if (!confirm("¿Borrar esta fila y todo su contenido? Esto no se puede deshacer.")) return;
  var nudosSnap = await getDocs(collection(db, "proyectos", estado.proyecto.id, "pasadas", id, "nudos"));
  for (var i = 0; i < nudosSnap.docs.length; i++) await deleteDoc(nudosSnap.docs[i].ref);
  await deleteDoc(doc(db, "proyectos", estado.proyecto.id, "pasadas", id));
  registrar(estado.proyecto.id, { tipo: "fila_borrada", resumen: "Fila borrada: " + id, autor: perfil.email });
}

function suscribirNudos(el, estado, pasada, perfil, unsubs) {
  if (estado.suscritas[pasada.id]) return;
  estado.suscritas[pasada.id] = true;
  var col = collection(db, "proyectos", estado.proyecto.id, "pasadas", pasada.id, "nudos");
  var unsub = onSnapshot(col, function (snap) {
    var lista = [];
    snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data())); });
    estado.nudosPorPasada[pasada.id] = lista;
    pintar(el, estado, perfil);
  });
  unsubs.push(unsub);
}

function agruparPorHilo(nudos) {
  var m = {};
  (nudos || []).forEach(function (n) { (m[n.hiloId] = m[n.hiloId] || []).push(n); });
  return m;
}

function pintar(el, estado, perfil) {
  renderCuerpo(el.querySelector("#ct-cuerpo"), estado.pasadas, estado.nudosPorPasada, {
    hilos: estado.proyecto.urdimbre,
    apariencia: estado.proyecto,
    vacioInteractivo: true,
    onNudoClick: function (nudo, pasada, hiloId, todos, btn, e) {
      manejarClic(estado, pasada, hiloId, e);
      pintarSeleccion(el, estado);
      abrirEditor(el, estado, perfil);
    }
  });
  pintarSeleccion(el, estado);
  Array.prototype.forEach.call(el.querySelectorAll(".pasada[data-pasada]"), function (fila) {
    var p = estado.pasadas.filter(function (x) { return x.id === fila.dataset.pasada; })[0];
    fila.classList.toggle("inactiva", !!p && p.activo === false);
  });
}

function pintarSeleccion(el, estado) {
  Array.prototype.forEach.call(el.querySelectorAll("[data-pasada][data-hilo]"), function (btn) {
    var esCrudo = (agruparPorHilo(estado.nudosPorPasada[btn.dataset.pasada] || [])[btn.dataset.hilo] || []).some(function (n) { return n.estado === "crudo"; });
    btn.style.outline = esCrudo ? "2px dashed var(--accent)" : "";
    btn.classList.toggle("seleccionado", estado.seleccion.indexOf(clave(btn.dataset.pasada, btn.dataset.hilo)) !== -1);
  });
}

function manejarClic(estado, pasada, hiloId, e) {
  var hilosContenido = estado.proyecto.urdimbre.filter(function (h) { return h.tipo === "contenido"; });
  var rIdx = estado.pasadas.findIndex(function (p) { return p.id === pasada.id; });
  var cIdx = hilosContenido.findIndex(function (h) { return h.id === hiloId; });
  var k = clave(pasada.id, hiloId);

  if (e && e.shiftKey && estado.ancla) {
    var r0 = Math.min(estado.ancla.rIdx, rIdx), r1 = Math.max(estado.ancla.rIdx, rIdx);
    var c0 = Math.min(estado.ancla.cIdx, cIdx), c1 = Math.max(estado.ancla.cIdx, cIdx);
    estado.seleccion = [];
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var p = estado.pasadas[r], h = hilosContenido[c];
        if (p && h) estado.seleccion.push(clave(p.id, h.id));
      }
    }
  } else if (e && (e.ctrlKey || e.metaKey)) {
    var idx = estado.seleccion.indexOf(k);
    if (idx === -1) estado.seleccion.push(k); else estado.seleccion.splice(idx, 1);
    estado.ancla = { rIdx: rIdx, cIdx: cIdx };
  } else {
    estado.seleccion = [k];
    estado.ancla = { rIdx: rIdx, cIdx: cIdx };
  }
}

function nudoDe(estado, pasadaId, hiloId) {
  return (agruparPorHilo(estado.nudosPorPasada[pasadaId] || [])[hiloId] || [])[0] || null;
}

function estiloPickerHTML(estilos, estiloActualId) {
  var opciones = [{ id: "", nombre: "Manual", manual: true }].concat(estilos);
  return '<div class="estilos-grid">' + opciones.map(function (es) {
    return '<button type="button" class="estilo-btn" data-id="' + es.id + '" aria-pressed="' + (es.manual ? !estiloActualId : estiloActualId === es.id) + '" title="' + es.nombre + '">' +
      '<span class="estilo-btn-preview">' + (es.manual ? "" : dibujarNudo(es)) + '</span>' +
      '<span class="estilo-btn-nombre">' + es.nombre + '</span></button>';
  }).join("") + '</div>';
}

/* ================= editor: 1 nudo (edición completa, autoguardado) o varios (aplicar estilo/giro en bloque) ================= */
function abrirEditor(el, estado, perfil) {
  var panel = el.querySelector("#ct-panel-body");
  if (estado.seleccion.length === 0) {
    panel.innerHTML = '<p class="estado-vacio">Toca un nudo para editarlo.</p>';
    return;
  }
  if (estado.seleccion.length === 1) {
    var partes = estado.seleccion[0].split("|");
    abrirEditorUno(panel, el, estado, perfil, partes[0], partes[1]);
  } else {
    abrirEditorMultiple(panel, el, estado, perfil);
  }
}

function refPara(estado, pasadaId, hiloId, nudo) {
  var col = collection(db, "proyectos", estado.proyecto.id, "pasadas", pasadaId, "nudos");
  return nudo ? doc(col, nudo.id) : doc(col, "directo_" + hiloId);
}

function abrirEditorUno(panel, el, estado, perfil, pasadaId, hiloId) {
  var pasada = estado.pasadas.filter(function (p) { return p.id === pasadaId; })[0] || {};
  var nudo = nudoDe(estado, pasadaId, hiloId);
  var n = Object.assign({ hiloId: hiloId, punto: "solido", tinte: "#3a402f", texto: "", titulo: "", estado: "tejido", giro: 0, espejo: false }, nudo || {});
  var estiloActual = estado.estilos.filter(function (es) { return es.punto === n.punto && es.tinte === n.tinte && es.matiz === n.matiz; })[0];

  panel.innerHTML =
    '<div class="eyebrow">' + (pasada.nombre || pasada.etiquetaCorta) + " · hilo " + hiloId + "</div>" +
    '<div class="mini-preview" style="width:60px;height:60px;margin-bottom:10px">' + dibujarNudo(n) + '</div>' +
    '<div class="field"><label>Estilo</label>' + estiloPickerHTML(estado.estilos, estiloActual && estiloActual.id) + '</div>' +
    '<div class="pair">' +
      '<button class="btn e-girar">Girar 90° (' + (n.giro || 0) + '°)</button>' +
      '<button class="btn e-espejo" aria-pressed="' + !!n.espejo + '">Espejo: ' + (n.espejo ? "sí" : "no") + '</button>' +
    '</div>' +
    '<div class="field"><label>Título</label><input id="e-titulo" value="' + (n.titulo || "") + '"></div>' +
    '<div class="field"><label>Descripción</label><textarea id="e-texto" maxlength="220">' + (n.texto || "") + '</textarea></div>' +
    '<div class="field"><label>Imagen (URL, opcional)</label><input id="e-imagen" value="' + (n.imagenUrl || "") + '"></div>' +
    '<div class="field"><label>Enlace (URL, opcional)</label><input id="e-enlace" value="' + (n.enlaceUrl || "") + '"></div>' +
    '<div class="field"><label>Estado</label><select id="e-estado">' +
      '<option value="tejido"' + (n.estado === "tejido" ? " selected" : "") + '>Tejido (público)</option>' +
      '<option value="crudo"' + (n.estado === "crudo" ? " selected" : "") + '>Crudo (en cola)</option>' +
    '</select></div>' +
    (nudo ? '<button class="btn" id="e-borrar">Borrar</button>' : '<p class="ghost">Se crea apenas escribes algo.</p>');

  var local = { punto: n.punto, tinte: n.tinte, matiz: n.matiz, giro: n.giro || 0, espejo: !!n.espejo };
  var ref = refPara(estado, pasadaId, hiloId, nudo);
  var registrarDebounce = null;

  function guardar(cambios) {
    Object.assign(local, cambios);
    setDoc(ref, Object.assign({
      hiloId: hiloId,
      titulo: panel.querySelector("#e-titulo").value.trim(),
      texto: panel.querySelector("#e-texto").value.trim(),
      imagenUrl: panel.querySelector("#e-imagen").value.trim(),
      enlaceUrl: panel.querySelector("#e-enlace").value.trim(),
      estado: panel.querySelector("#e-estado").value,
      fuente: n.fuente || "directo", eco: n.eco || false
    }, local), { merge: true });
    panel.querySelector(".mini-preview").innerHTML = dibujarNudo(local);
    clearTimeout(registrarDebounce);
    registrarDebounce = setTimeout(function () {
      registrar(estado.proyecto.id, { tipo: "nudo_editado", resumen: "Nudo editado en " + pasadaId + "/" + hiloId, autor: (perfil && perfil.email) || "" });
    }, 800);
  }

  Array.prototype.forEach.call(panel.querySelectorAll(".estilo-btn"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(panel.querySelectorAll(".estilo-btn"), function (o) { o.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      if (b.dataset.id) {
        var es = estado.estilos.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (es) guardar({ punto: es.punto, tinte: es.tinte, matiz: es.matiz });
      }
    });
  });
  panel.querySelector(".e-girar").addEventListener("click", function () {
    var giro = (local.giro + 90) % 360;
    this.textContent = "Girar 90° (" + giro + "°)";
    guardar({ giro: giro });
  });
  panel.querySelector(".e-espejo").addEventListener("click", function () {
    var espejo = !local.espejo;
    this.setAttribute("aria-pressed", espejo);
    this.textContent = "Espejo: " + (espejo ? "sí" : "no");
    guardar({ espejo: espejo });
  });
  // texto: guardado debounced (600ms de pausa) para no escribir a Firestore por cada tecla;
  // flush en blur para no perder lo último tipeado si el urdidor/tejedor se va rápido a otro campo.
  var guardarTextoDebounced = debounce(function () { guardar({}); }, 600);
  ["#e-titulo", "#e-texto", "#e-imagen", "#e-enlace"].forEach(function (sel) {
    var input = panel.querySelector(sel);
    input.addEventListener("input", guardarTextoDebounced);
    input.addEventListener("blur", function () { guardarTextoDebounced.flush(); });
  });
  panel.querySelector("#e-estado").addEventListener("change", function () { guardar({}); });
  if (nudo) {
    panel.querySelector("#e-borrar").addEventListener("click", async function () {
      await deleteDoc(ref);
      estado.seleccion = [];
      panel.innerHTML = '<p class="estado-vacio">Toca un nudo para editarlo.</p>';
    });
  }
}

function abrirEditorMultiple(panel, el, estado, perfil) {
  var n = estado.seleccion.length;
  panel.innerHTML =
    '<div class="eyebrow">' + n + ' nudos seleccionados</div>' +
    '<p class="ghost" style="margin-bottom:10px">Elige un estilo o gira/espeja: se aplica a los ' + n + ' de una vez.</p>' +
    '<div class="field"><label>Estilo</label>' + estiloPickerHTML(estado.estilos, null) + '</div>' +
    '<div class="pair">' +
      '<button class="btn m-girar">Girar 90° todos</button>' +
      '<button class="btn m-espejo">Alternar espejo</button>' +
    '</div>' +
    '<button class="btn" id="m-limpiar" style="margin-top:10px">Quitar selección</button>';

  function paraCadaSeleccionado(fn) {
    estado.seleccion.forEach(function (k) {
      var partes = k.split("|");
      var pasadaId = partes[0], hiloId = partes[1];
      var nudo = nudoDe(estado, pasadaId, hiloId);
      fn(pasadaId, hiloId, nudo);
    });
  }

  Array.prototype.forEach.call(panel.querySelectorAll(".estilo-btn"), function (b) {
    if (!b.dataset.id) return;
    b.addEventListener("click", function () {
      var es = estado.estilos.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!es) return;
      paraCadaSeleccionado(function (pasadaId, hiloId, nudo) {
        var ref = refPara(estado, pasadaId, hiloId, nudo);
        setDoc(ref, {
          hiloId: hiloId, punto: es.punto, tinte: es.tinte, matiz: es.matiz,
          estado: (nudo && nudo.estado) || "tejido", fuente: (nudo && nudo.fuente) || "directo", eco: (nudo && nudo.eco) || false
        }, { merge: true });
      });
      registrar(estado.proyecto.id, { tipo: "nudo_editado", resumen: "Estilo aplicado a " + n + " nudos (" + es.nombre + ")", autor: (perfil && perfil.email) || "" });
    });
  });
  panel.querySelector(".m-girar").addEventListener("click", function () {
    paraCadaSeleccionado(function (pasadaId, hiloId, nudo) {
      var ref = refPara(estado, pasadaId, hiloId, nudo);
      var giro = (((nudo && nudo.giro) || 0) + 90) % 360;
      setDoc(ref, { hiloId: hiloId, giro: giro }, { merge: true });
    });
  });
  panel.querySelector(".m-espejo").addEventListener("click", function () {
    paraCadaSeleccionado(function (pasadaId, hiloId, nudo) {
      var ref = refPara(estado, pasadaId, hiloId, nudo);
      setDoc(ref, { hiloId: hiloId, espejo: !(nudo && nudo.espejo) }, { merge: true });
    });
  });
  panel.querySelector("#m-limpiar").addEventListener("click", function () {
    estado.seleccion = [];
    pintarSeleccion(el, estado);
    abrirEditor(el, estado, perfil);
  });
}

/* ================= ESTILO DE MESAS NUEVAS ================= */
export function renderMesasNuevas(el, perfil, unsubs) {
  el.innerHTML = '<div id="mn-selector" style="margin-bottom:14px"></div><div id="mn-cuerpo"></div>';
  var unsubEstilos = null;
  var unsubSel = renderSelectorTelar(el.querySelector("#mn-selector"), function (proyecto) {
    if (unsubEstilos) unsubEstilos();
    unsubEstilos = suscribirEstilos(proyecto.id, function (estilos) {
      cargarSelectorEstilos(el.querySelector("#mn-cuerpo"), proyecto, estilos, perfil);
    });
  });
  unsubs.push(unsubSel);
  unsubs.push(function () { if (unsubEstilos) unsubEstilos(); });
}

function cargarSelectorEstilos(el, proyecto, estilos, perfil) {
  var actual = proyecto.estiloPorCategoria || {};
  el.innerHTML =
    '<p class="ghost" style="margin-bottom:12px">Así se van a ver las mesas que los hiladores llenen desde ahora. El hilador no elige apariencia: solo escribe.</p>' +
    CATEGORIAS.map(function (cat) {
      return '<div class="field" style="max-width:360px"><label>' + cat.charAt(0).toUpperCase() + cat.slice(1) + '</label>' +
        '<select class="mn-select" data-categoria="' + cat + '">' +
          '<option value="">— usar por defecto —</option>' +
          estilos.map(function (es) { return '<option value="' + es.id + '"' + (actual[cat] === es.id ? " selected" : "") + '>' + es.nombre + "</option>"; }).join("") +
        '</select></div>';
    }).join("") +
    '<div id="mn-preview" style="margin-top:16px;max-width:360px"></div>';

  function estiloDe(cat) { return resolverEstiloCategoria(estilos, proyecto.estiloPorCategoria, cat); }
  function repintar() {
    var html = '<div class="telar" style="padding:10px;display:flex;gap:0px">';
    ["c1", "c2", "c3", "c4", "c5", "c6"].forEach(function (hiloId, i) {
      var cat = i < 2 ? "desafio" : i < 4 ? "aporte" : "cambio";
      var par = PARES_MESA[Math.floor(i / 2)];
      var es = estiloDe(cat);
      html += '<span class="nudo" style="width:44px;height:44px;background:' + es.tinte + '" aria-hidden="true">' +
        dibujarNudo({ punto: es.punto, tinte: es.tinte, matiz: es.matiz, giro: par.giro, espejo: par.espejo }) + "</span>";
    });
    html += "</div>";
    el.querySelector("#mn-preview").innerHTML = html;
  }
  repintar();

  Array.prototype.forEach.call(el.querySelectorAll(".mn-select"), function (sel) {
    sel.addEventListener("change", function () {
      var nuevo = Object.assign({}, proyecto.estiloPorCategoria || {});
      nuevo[sel.dataset.categoria] = sel.value || null;
      proyecto.estiloPorCategoria = nuevo;
      setDoc(doc(db, "proyectos", proyecto.id), { estiloPorCategoria: nuevo }, { merge: true });
      registrar(proyecto.id, { tipo: "estilo_mesa_actualizado", resumen: "Estilo de mesas nuevas actualizado (" + sel.dataset.categoria + ")", autor: perfil.email });
      repintar();
    });
  });
}

/* ================= COLA DE MODERACIÓN ================= */
export function renderCola(el, unsubs) {
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
