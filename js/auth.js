import { auth, db, googleProvider } from "./firebaseClient.js";
import {
  signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   Roles del telar, siguiendo el léxico:
   maestra_tejedora > urdidor > tejedor > hilador > visitante
   ========================================================= */
export var ROLES = ["maestra_tejedora", "urdidor", "tejedor", "hilador", "visitante"];

export var ROL_LABEL = {
  maestra_tejedora: "Maestra tejedora",
  urdidor: "Urdidor/a",
  tejedor: "Tejedor/a",
  hilador: "Hilador/a",
  visitante: "Visitante"
};

// Bootstrap: mientras usuarios_roles esté vacío, este correo siempre entra
// como maestra tejedora. En cuanto exista su doc en usuarios_roles, ese doc manda.
var MAESTRA_BOOTSTRAP = "hermanelgueta@gmail.com";

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
 * con bootstrap para la maestra) y rol efectivo (aplica el "ver como" si
 * la maestra lo activó para probar la interfaz de otro rol).
 */
export async function resolverPerfil(user) {
  if (!user || !user.email) {
    return { user: null, email: null, nombre: null, rolReal: "visitante", rolEfectivo: "visitante", alcance: {} };
  }
  var email = user.email.toLowerCase();
  var ref = doc(db, "usuarios_roles", email);
  var snap = await getDoc(ref);
  var rolReal, alcance = {};

  if (snap.exists()) {
    rolReal = snap.data().rol || "visitante";
    alcance = snap.data().proyectosAlcance || {};
  } else if (email === MAESTRA_BOOTSTRAP) {
    rolReal = "maestra_tejedora";
    // Deja registro persistente apenas la maestra bootstrap entra la primera vez.
    try {
      await setDoc(ref, {
        rol: "maestra_tejedora",
        nombre: user.displayName || email,
        proyectosAlcance: {},
        creadoEn: new Date().toISOString()
      });
    } catch (e) { /* si las reglas ya están cerradas, no pasa nada grave */ }
  } else {
    rolReal = "visitante";
  }

  var verComo = rolReal === "maestra_tejedora" ? getVerComo() : null;
  var rolEfectivo = verComo || rolReal;

  return {
    user: user, email: email,
    nombre: (snap.exists() && snap.data().nombre) || user.displayName || email,
    rolReal: rolReal, rolEfectivo: rolEfectivo, alcance: alcance
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
