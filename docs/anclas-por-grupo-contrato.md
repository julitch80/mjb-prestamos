# Anclas por grupo — contrato

Escrito el 2026-09-03, antes de repartir el trabajo. **Este archivo manda**: el backend y
la interfaz se construyen en paralelo contra él.

## Qué se persigue

Hoy las anclas de "¿cuándo la vas a hacer?" viven en el código
(`src/data/tareas/habitos.ts`), puestas de memoria. Julián pidió que **el director de
grupo pueda editarlas con su curso**, para que sean el acuerdo del grupo y no una lista
impuesta desde afuera: *nosotros dijimos que estudiamos al llegar, antes de la novela,
después del entrenamiento*.

Eso es lo que hace que se usen. Y resuelve el problema real: nadie en la sala de
profesores sabe las tardes de 6º2 mejor que 6º2.

## Por qué esto vive en Apps Script y no en Firebase

La agenda del grupo es **pública, sin login**, y no habla con Firebase: habla con Apps
Script. Si las anclas se guardaran en Firestore habría que abrir una colección a lectura
anónima, que hoy no existe y es una decisión de seguridad mayor. En Apps Script el
camino público ya está abierto y las anclas no son dato personal: son frases como
"después de almorzar".

## Hoja `AnclasGrupo`

| columna | contenido |
|---|---|
| `grupo` | notación del horario: `9.1` mañana, `6º1` tarde |
| `anclas` | JSON: `[{ "id": "...", "label": "..." }]` |
| `actualizadoPor` | correo de quien guardó |
| `timestamp` | ISO |

`id` es estable y lo genera el cliente (`a1`, `a2`… o un slug); `label` es lo que ve el
estudiante. **Máximo 6 anclas por grupo**, `label` de máximo 30 caracteres. Una lista de
quince deja de ayudar a elegir, y larga no cabe en un botón.

## Acciones

### `getAnclasGrupos` — lectura, PÚBLICA (sin idToken)

    { ok: true, anclas: { "6º1": [{id,label}, ...], "10.2": [...] } }

Tiene que ser pública porque la agenda del estudiante no tiene sesión. Devuelve solo los
grupos que hayan definido algo; el resto usa los valores por defecto del código.

**Se incorpora además a la respuesta de `getDatosTareas`**, bajo la misma clave `anclas`.
La agenda pública ya hace esa llamada: meterlo ahí evita una segunda petición en un
teléfono con datos limitados, que es la mitad del colegio.

### `guardarAnclasGrupo` — escritura, EXIGE idToken

Parámetros: `grupo`, `anclas` (JSON).

Solo puede guardar el **director de ese grupo** (según `DIRECTORES_CORREO`), o
coordinación, rectoría y superusuario. Cualquier otro correo se rechaza. El servidor
valida el tope de 6 y el largo de 30: no se confía en el cliente.

## Reglas que la interfaz debe respetar

- **Grupo sin anclas definidas → las de por defecto por jornada**, que ya están en
  `habitos.ts`. Nada deja de funcionar mientras los directores se ponen al día.
- El editor vive en la app (`VistaTareas`), **nunca en la agenda pública**: editar exige
  sesión y la agenda no la tiene.
- Al abrir el editor por primera vez, se precargan las de por defecto de esa jornada como
  punto de partida. Empezar de cero ante una lista vacía es lo que hace que nadie lo use.

## Lo que NO se toca

- El momento que el estudiante ya eligió sigue guardándose **solo en su dispositivo**.
  Esto no crea seguimiento de nadie.
- `MomentoElegido.label`: la copia del texto del ancla al elegirla. **Es lo que hace
  segura esta función.** Sin ella, cada vez que un director editara la lista, todos sus
  estudiantes que hubieran elegido un ancla renombrada verían su elección esfumarse sin
  aviso. No quitarla creyendo que está duplicada.
