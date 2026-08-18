import { auth, db, googleProvider } from "./firebaseClient.js";
import {
  signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   Roles del telar: urdidor > tejedor > hilador.
   urdidor puede hacer todo (incluido lo de tejedor e hilador)
   y además puede "ver como" cualquier rol para probar su vista.
   Quien no tiene rol asignado no entra al taller; el telar
   público no requiere rol ni sesión.
   ========================================================= */
export var ROLES = ["urdidor", "tejedor", "hilador"];

export var ROL_LABEL = {
  urdidor: "Urdidor/a",
  tejedor: "Tejedor/a",
  hilador: "Hilador/a",
  maestra_tejedora: "Urdidor/a" // alias de despliegue viejo, solo para mostrar
};

// Bootstrap: mientras usuarios_roles esté vacío, este correo siempre entra
// como urdidor. En cuanto exista su doc en usuarios_roles, ese doc manda.
var URDIDOR_BOOTSTRAP = "hermanelgueta@gmail.com";

// Migración: cuentas creadas antes de simplificar a 3 roles todavía tienen
// el nombre viejo guardado en Firestore. Se traduce al leer, sin tocar datos.
var ROL_MIGRACION = { maestra_tejedora: "urdidor" };

var VER_COMO_KEY = "warplux_ver_como";

export function getVerComo() {
  return sessionStorage.getItem(VER_COMO_KEY);
}
export function setVerComo(rol) {
  if (rol) sessionStorage.setItem(VER_COMO_KEY, rol);
  else sessionStorage.removeItem(VER_COMO_KEY);
}

export function signInGoogle() {
  return signInWithPopup(auth, googleProvider);
}
export function signOutUser() {
  setVerComo(null);
  return signOut(auth);
}

/**
 * Resuelve el perfil del usuario actual: rol real (desde usuarios_roles,
 * con bootstrap para el urdidor) y rol efectivo (aplica el "ver como" si
 * el urdidor lo activó para probar la interfaz de otro rol).
 * rolReal/rolEfectivo son null cuando la cuenta no tiene rol asignado.
 */
export async function resolverPerfil(user) {
  if (!user || !user.email) {
    return { user: null, email: null, nombre: null, rolReal: null, rolEfectivo: null };
  }
  var email = user.email.toLowerCase();
  var ref = doc(db, "usuarios_roles", email);
  var snap = await getDoc(ref);
  var rolReal = null;

  if (snap.exists()) {
    rolReal = snap.data().rol || null;
    rolReal = ROL_MIGRACION[rolReal] || rolReal;
  } else if (email === URDIDOR_BOOTSTRAP) {
    rolReal = "urdidor";
    // Deja registro persistente apenas el urdidor bootstrap entra la primera vez.
    try {
      await setDoc(ref, {
        rol: "urdidor",
        nombre: user.displayName || email,
        creadoEn: new Date().toISOString()
      });
    } catch (e) { /* si las reglas ya están cerradas, no pasa nada grave */ }
  }

  var verComo = rolReal === "urdidor" ? getVerComo() : null;
  var rolEfectivo = verComo || rolReal;

  return {
    user: user, email: email,
    nombre: (snap.exists() && snap.data().nombre) || user.displayName || email,
    rolReal: rolReal, rolEfectivo: rolEfectivo
  };
}

/**
 * Suscribe a cambios de autenticación. cb recibe el perfil resuelto
 * (ver resolverPerfil) cada vez que cambia el usuario.
 */
export function onPerfilChange(cb) {
  return onAuthStateChanged(auth, function (user) {
    resolverPerfil(user).then(cb);
  });
}
