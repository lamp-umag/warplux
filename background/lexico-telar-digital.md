# Léxico del Telar Digital

Diccionario de términos para el formato. Pensado para que sirva dentro de TELARES y también fuera, si esto se convierte en herramienta propia.

## Nombre del producto

Propongo separar el nombre del software del nombre de cada instancia particular.

El software se llama **Trama**. Es corto, funciona en español y en inglés sin traducción, y tiene doble sentido: la trama es el hilo que se cruza con la urdimbre, y también es el argumento de una historia. Un software que llamas Trama está anunciando exactamente lo que hace, arma el argumento de algo a partir de piezas sueltas.

Cada despliegue particular de Trama se llama **un telar**. El de este proyecto es "el telar de TELARES", pero si mañana otra unidad de la universidad quiere su propio tablero, sería "el telar de tal cosa", corriendo sobre el mismo software. Esta separación es la que te permite decir después que esto es extrapolable sin tener que rebautizar nada.

## Anatomía de la estructura

| Término | Qué es | Por qué ese nombre |
|---|---|---|
| Telar | El tablero completo, la grilla entera | Es el objeto general, ya lo vienes usando |
| Urdimbre | El conjunto de columnas | En un telar real la urdimbre se monta antes de tejer y no cambia mientras se teje. Calza exacto con que las columnas están fijas desde el diseño |
| Hilo | Una columna individual dentro de la urdimbre | Un hilo de urdimbre es literalmente una columna en un telar real |
| Trama | El conjunto de filas | Es lo que se va tejiendo con el tiempo, fila por fila, sobre la urdimbre ya montada |
| Pasada | Una fila individual | En tejido, una pasada es un paso completo de la lanzadera de un lado al otro. Cada fila del telar es una pasada, ya sea institucional o de una mesa |
| Nudo | Una celda individual, la intersección de un hilo y una pasada | Es el punto mínimo donde algo queda fijado. En tapicería el nudo es literalmente la unidad de diseño, un nudo por color |
| Orillo | Una fila que separa dos tramos del telar | Ya lo usaste para el borde superior decorativo. Se puede reusar como separador entre el tramo institucional y el colaborativo |
| Racimo | Un nudo que contiene más de un aporte superpuesto | Cuando dos cosas caen en la misma celda en vez de perderse una se agrupan como racimo y se despliegan al abrir el nudo |

## Anatomía de un nudo

Cada nudo tiene atributos. Estos son los nombres para cada uno, pensando en que después alguien tenga que programarlos o explicarlos sin ambigüedad.

| Atributo | Nombre | Qué codifica |
|---|---|---|
| Color principal | Tinte | La categoría del nudo. En el tramo colaborativo, desafío, cambio o aporte. En el tramo institucional, el eje o la sección del programa |
| Forma o motivo gráfico | Punto | El tipo de contenido dentro de la categoría. Usa el mismo vocabulario del taller de tramas, cuartos, flecha, nudos, bloque, etc |
| Color secundario | Matiz | Quién lo dijo, el actor de origen. Se aplica como acento sobre el tinte, no lo reemplaza |
| Orientación | Giro | La rotación aplicada a la unidad gráfica, ya heredado del taller de tramas |
| Marca de audio | Eco | Indica que ese nudo tiene un fragmento de audio asociado, transcrito o pendiente de transcribir |
| Procedencia | Fuente | Cómo llegó el contenido. Directo si lo cargó un hilador en vivo, eco si viene de la estación de audio, sembrado si es contenido previo cargado antes del evento para que el telar no empiece vacío |
| Estado | Crudo o tejido | Crudo mientras está en la cola de moderación, tejido una vez que el admin lo aprueba y aparece en el telar público |

Dos comportamientos de interfaz que también conviene nombrar. Cuando pasas el cursor por un nudo y el resto del telar se atenúa para destacar los nudos del mismo hilo o del mismo tinte, eso es la **resonancia**. Cuando tocas un nudo para ver el texto completo detrás, eso es **abrir el nudo**.

## Los tramos del telar

Con la estructura que definiste, el telar tiene dos grandes tramos y uno adicional que se suma después.

**Trama madre**, las pasadas institucionales que ya vienen definidas antes del evento, actores, contexto, ejes, cronograma, agenda del lanzamiento.

**Trama viva**, las pasadas que se cargan durante el Coffee Lab, una por mesa, con las seis celdas de desafíos, cambios y aportes.

**Hilos sueltos**, los aportes individuales que llegan después, principalmente desde la estación de audio, y que se agregan como pasadas cortas al final del telar en los días siguientes al evento.

## Roles de las personas

Aquí es donde conviene distinguir bien, porque cada rol tiene un permiso distinto sobre el telar.

**Maestra tejedora o maestro tejedor.** El rol de administración general. Aprueba lo que sale de crudo a tejido, gestiona la estructura completa, exporta los datos, resuelve solicitudes de retiro de contenido. Es un rol, no necesariamente una sola persona, pero conviene que en el lanzamiento haya una sola persona identificada así.

**Urdidores y urdidoras.** Quienes diseñan la estructura, es decir quienes deciden cuántos hilos tiene la urdimbre y qué significa cada uno. Es el rol de quien usa el taller de tramas para definir el sistema visual y de quien decide cómo se reparten las columnas entre desafíos, cambios y aportes. Trabajan antes del evento, no durante.

**Tejedores y tejedoras.** Editores de contenido con permiso amplio, pueden cargar, corregir o mover nudos en cualquier parte del telar ya montado, y normalmente hacen el trabajo de moderación de la cola de crudos. Es el equivalente en español de lo que llamabas weavers.

**Hiladores e hiladoras.** Los que en el evento cargan pasadas nuevas, con permiso acotado solo a su propia mesa o su propia pasada. El nombre viene de hilar, que es convertir una fibra suelta en un hilo utilizable, exactamente lo que hace un secretario con una conversación de treinta minutos, la convierte en una frase que se puede tejer. Es el reemplazo que pediste para hilero, con una raíz real del oficio textil en vez de una palabra inventada.

**Voces.** Quienes dejan un aporte individual en la estación de audio. No tienen acceso al sistema, su aporte entra al telar después, procesado por un tejedor.

**Visitantes.** El público que solo mira el telar publicado, sin ninguna capacidad de edición.

La jerarquía de permisos de mayor a menor queda maestra tejedora, urdidores, tejedores, hiladores, y después voces y visitantes que no editan nada directamente.

## El formato como género

Si esto crece más allá de TELARES conviene tener un nombre para el tipo de objeto que estás inventando, no solo para el software. Le llamaría **tapiz narrativo**, un formato donde una urdimbre fija de columnas con significado estable se cruza con una trama que crece con el tiempo, y cada nudo condensa una categoría, un tipo de contenido y una procedencia en una sola celda que se puede abrir para leer el detalle. Sirve para cualquier organización que quiera mostrar de forma viva cómo se construye algo colectivo, no solo para un lanzamiento de proyecto.

## Nota sobre lo que dejé fuera

No usé palabras de lenguas originarias para nombrar nada de esto. Se podría pensar en un término mapuche como witral para telar, pero Magallanes es territorio selknam, kawésqar y yagán, no mapuche, así que habría un desajuste territorial además del tema de apropiarse de una palabra de un pueblo sin ese pueblo de por medio. Si en algún momento quieres incorporar una lengua originaria de la zona al proyecto, eso amerita conversarlo con alguien de esas comunidades antes de ponerlo en un nombre de producto, no resolverlo por comodidad de branding.
