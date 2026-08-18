import {
  signInGoogle, signOutUser, onPerfilChange, setVerComo, getVerComo, ROLES, ROL_LABEL
} from "./auth.js";

function $(id) { return document.getElementById(id); }
function mostrarSolo(id) {
  ["vista-cargando", "vista-login", "vista-admin", "vista-sin-acceso"].forEach(function (v) {
    $(v).hidden = v !== id;
  });
}

var deshacerModulo = null;
var perfilActual = null;

$("btn-login").addEventListener("click", function () {
  signInGoogle().catch(function (e) { alert("No se pudo iniciar sesión: " + e.message); });
});
$("btn-logout").addEventListener("click", function () { signOutUser(); });
$("btn-logout-2").addEventListener("click", function () { signOutUser(); });

function renderSelectVerComo(perfil) {
  var sel = $("select-vercomo");
  if (perfil.rolReal !== "urdidor") { sel.hidden = true; return; }
  sel.hidden = false;
  sel.innerHTML = ROLES.map(function (r) {
    return '<option value="' + r + '"' + (perfil.rolEfectivo === r ? " selected" : "") + '>Ver como: ' + ROL_LABEL[r] + "</option>";
  }).join("");
  sel.onchange = function () {
    setVerComo(sel.value === "urdidor" ? null : sel.value);
    // recarga simple para re-resolver el perfil con el nuevo "ver como"
    location.reload();
  };
}

async function enrutar(perfil) {
  perfilActual = perfil;
  if (!perfil.user) { mostrarSolo("vista-login"); return; }

  if (!perfil.rolEfectivo) {
    mostrarSolo("vista-sin-acceso");
    return;
  }

  mostrarSolo("vista-admin");
  $("rol-actual").textContent = "· " + ROL_LABEL[perfil.rolEfectivo] +
    (perfil.rolReal !== perfil.rolEfectivo ? " (viendo como)" : "");
  $("usuario-nombre").textContent = perfil.nombre;
  renderSelectVerComo(perfil);

  if (typeof deshacerModulo === "function") { try { deshacerModulo(); } catch (e) {} }
  var el = $("contenido-admin");
  el.innerHTML = "";

  var mod;
  if (perfil.rolEfectivo === "urdidor") mod = await import("./admin-urdidor.js");
  else if (perfil.rolEfectivo === "tejedor") mod = await import("./admin-tejedor.js");
  else if (perfil.rolEfectivo === "hilador") mod = await import("./admin-hilador.js");

  if (mod && mod.render) {
    var resultado = mod.render(el, perfil);
    deshacerModulo = typeof resultado === "function" ? resultado : null;
  }
}

mostrarSolo("vista-cargando");
onPerfilChange(enrutar);
