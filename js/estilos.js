import { db } from "./firebaseClient.js";
import { collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { PUNTOS } from "./motifs.js";

/* =========================================================
   estilos.js — la lista finita de apariencias de nudo que
   el urdidor cura (proyectos/{id}/estilos). El tejedor elige
   entre esos estilos ya armados en vez de mezclar forma y
   color a mano; hilador ni siquiera los ve — le llegan
   resueltos vía proyecto.estiloPorCategoria.

   ESTILOS_BASE son los 7 tipos de tesela con los colores por
   defecto de tiles/ (board_2.html / preview.html / palette.json):
   todo telar nuevo arranca con estos ya disponibles para elegir
   con un clic, sin tener que armarlos desde cero.
   ========================================================= */

export var CATEGORIAS = ["desafio", "aporte", "cambio"];

var COLORES_BASE = {
  solido: { tinte: "#3a402f", matiz: null },
  "arc-tl": { tinte: "#3a402f", matiz: "#85751a" },
  "arc-tr": { tinte: "#bb6f3a", matiz: "#3a402f" },
  "arc-bl": { tinte: "#85751a", matiz: "#3a402f" },
  "arc-br": { tinte: "#e29f3e", matiz: "#3a402f" },
  "diag-tlbr": { tinte: "#85751a", matiz: "#3a402f" },
  "diag-trbl": { tinte: "#e29f3e", matiz: "#85751a" }
};

export var ESTILOS_BASE = PUNTOS.filter(function (p) { return p.id !== "vacio"; }).map(function (p) {
  var c = COLORES_BASE[p.id];
  return { id: p.id, nombre: p.nombre, punto: p.id, tinte: c.tinte, matiz: c.matiz };
});

/** escribe (o repone) los estilos base en un telar; segura de llamar más de una vez */
export async function sembrarEstilosBase(proyectoId) {
  for (var i = 0; i < ESTILOS_BASE.length; i++) {
    var es = ESTILOS_BASE[i];
    await setDoc(doc(db, "proyectos", proyectoId, "estilos", es.id),
      { nombre: es.nombre, punto: es.punto, tinte: es.tinte, matiz: es.matiz }, { merge: true });
  }
}

export var ESTILO_DEFECTO = {
  desafio: { nombre: "Desafío (defecto)", punto: "solido", tinte: "#bb6f3a", matiz: "#bb6f3a" },
  aporte: { nombre: "Aporte (defecto)", punto: "solido", tinte: "#85751a", matiz: "#85751a" },
  cambio: { nombre: "Cambio (defecto)", punto: "solido", tinte: "#e29f3e", matiz: "#e29f3e" }
};

export function suscribirEstilos(proyectoId, cb) {
  return onSnapshot(collection(db, "proyectos", proyectoId, "estilos"), function (snap) {
    var lista = [];
    snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data())); });
    cb(lista);
  });
}

/** el estilo asignado a una categoría de mesa (desafio/aporte/cambio), con caída al defecto */
export function resolverEstiloCategoria(estilos, estiloPorCategoria, categoria) {
  var id = estiloPorCategoria && estiloPorCategoria[categoria];
  var encontrado = id && estilos.filter(function (e) { return e.id === id; })[0];
  return encontrado || ESTILO_DEFECTO[categoria];
}
