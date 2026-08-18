# TELARES UMAG — el telar digital

Un "telar" es una cuadrícula donde cada fila (**pasada**) tiene celdas (**nudos**),
una por hilo. Universidad de Magallanes lo usa para mostrar contenido institucional
junto a aportes que la gente carga en vivo, como si fueran tejidos en el mismo telar.

No hay build step: HTML + JS módulos ES cargados directo por `<script type="module">`,
Firebase (Auth + Firestore) vía CDN. `index.html` es el telar público, `admin.html`
es el taller de edición.

## Roles

Todo el acceso vive en `usuarios_roles/{email}` (campo `rol`). Un **urdidor** puede
además "ver como" cualquier otro rol desde el taller (para probar sin cambiar su rol
real) — eso es distinto a *editar* el `rol` de alguien en "Personas y roles", que sí
cambia su acceso real.

- **urdidor** — dueño del telar: crea proyectos, arma filas, define estilos, gestiona
  personas. Ve todas las pestañas (`admin-urdidor.js`, que reusa piezas de
  `admin-tejedor.js` y `admin-hilador.js`).
- **tejedor** — cura contenido: Contenido, Estilo de mesas nuevas, Cola de moderación
  (`admin-tejedor.js`).
- **hilador** — llena mesas colaborativas con sus aportes (`admin-hilador.js`).

## Modelo de datos (Firestore)

```
proyectos/{slug}
  activo, nombre, nombreLargo, columnas, urdimbre, estiloPorCategoria, ...
  pasadas/{pasadaId}            — una fila del telar
    tipo: "institucional" | "colaborativa"
    activo                      — false = oculta al público (aunque tenga contenido)
    index                       — orden de la fila; reordenar = intercambiar index
    nudos/{nudoId}               — una celda
      hiloId, punto, tinte, matiz, giro, espejo   — apariencia
      titulo, texto                                — contenido
      estado: "crudo" | "tejido"                   — moderación
```

`js/telarCore.js` es el render compartido (`renderCabecera`/`renderCuerpo`) entre
`index.html` (lectura pública) y `admin.html` (edición) — no toca Firestore, solo
recibe datos ya resueltos.

## Reglas de comportamiento que no son obvias leyendo una sola función

- **Un nudo se ve "vacío" (plaquita crema/gris) hasta que tiene título O texto** —
  no hace falta llenar ambos, y esto aplica aunque el urdidor ya le haya asignado
  forma/color de antemano. Es universal: filas institucionales y colaborativas por
  igual. Ver `filtrarNudos` en `telarCore.js` (opción `soloConContenido`) y
  `tieneContenido` en `viewer.js`.
- **La apariencia de un nudo se fija una sola vez, al crearlo.** Si un hilador edita
  un nudo que ya existe, su guardado solo toca `titulo`/`texto` — nunca
  `punto/tinte/matiz/giro/espejo`. Esos campos son terreno del urdidor/tejedor
  (ver el comentario en `admin-hilador.js`, función `guardar()`).
- **Todo se guarda en vivo, sin botones "Guardar"/"Confirmar".** Editores de nudo,
  el formulario de mesa del hilador, el toggle Activo de una fila, y renombrar una
  fila (este último en `blur`/Enter, no por-tecla, para no pelear con el
  re-render que dispara el propio guardado mientras se escribe).
- **El toggle "Activo" de una pasada es independiente de si tiene contenido.** Una
  fila puede estar activa y visible con celdas vacías (plaquita), o inactiva y
  completamente oculta pase lo que pase adentro.
- **Firestore `fieldOverrides` reemplazan, no agregan, la config de índices de un
  campo.** Si se agrega un índice `COLLECTION_GROUP` para un campo sin repetir
  también las entradas `COLLECTION` por defecto, se rompe cualquier query normal
  sobre ese campo en todo el proyecto. Ver `firestore.indexes.json`.

## Desarrollo local

```
python3 -m http.server 8934
```

Sin build. Los cambios en `.js`/`.html`/`.css` se ven con recargar (o
cmd+shift+r si el navegador cachea agresivo).
