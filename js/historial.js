import { db } from "./firebaseClient.js";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   historial.js — bitácora no destructiva, mínima a propósito.
   No hay deshacer todavía: solo deja registro de quién cambió
   qué, para que la maestra tejedora pueda detectar errores.
   ========================================================= */

export function registrar(proyectoId, entrada) {
  return addDoc(collection(db, "proyectos", proyectoId, "historial"), Object.assign({}, entrada, { ts: serverTimestamp() }))
    .catch(function () { /* la bitácora nunca debe romper la acción principal */ });
}

export function suscribirHistorial(proyectoId, cb, max) {
  var q = query(collection(db, "proyectos", proyectoId, "historial"), orderBy("ts", "desc"), limit(max || 60));
  return onSnapshot(q, function (snap) {
    var lista = [];
    snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data())); });
    cb(lista);
  });
}
