# Informe del buzón de sugerencias

Revisión del 16 de agosto de 2026. Fuente: `getSugerencias` del backend en
producción — 14 entradas, todas en estado `nueva` (nadie ha clasificado
ninguna todavía desde la pantalla de sugerencias).

Lo que sigue clasifica cada una por **qué tan lejos está de poder hacerse**,
no por quién la pidió ni por qué tan buena es. Al final va mi opinión sobre
las que tocan la filosofía de la aplicación.

---

## Antes de nada: tres ya están resueltas

Verificadas en el código, no de memoria. Conviene avisarle a Janneth, porque
ella las reportó y no tiene forma de saber que ya se corrigieron.

| Sugerencia | Estado |
|---|---|
| Bandeja de espera: las clases del docente ausente no deben impedir guardar (`SUG-…882295`) | **Hecho.** `EditorHorarioMode.tsx:327` — solo bloquean las que sí hay que reubicar. |
| El acortamiento debe quedar en múltiplos de 5 (`SUG-…815516`) | **Hecho.** `horarioModificado.ts:233` — redondea hacia abajo al múltiplo de 5. |
| Ver cómo le queda el horario a los docentes afectados (`SUG-…041021`, punto 2) | **Hecho.** Existe `DocenteAfectadoResumen` y la vista por docente afectado. |

**Acción sugerida:** marcarlas como resueltas en la pantalla de sugerencias y
avisarle a Janneth. El buzón tiene el campo `avisadoEn` justamente para eso y
no se está usando.

---

## Un hallazgo del propio buzón: sugerencias duplicadas

`SUG-1785986785957` y `SUG-1785986765569` son **idénticas palabra por
palabra**, enviadas con 20 segundos de diferencia (ambas 03:26). Eso apunta a
que el formulario permite doble envío — probablemente el botón no se
deshabilita mientras la petición está en vuelo, y en una conexión lenta el
docente toca dos veces.

Es un arreglo de minutos y vale la pena hacerlo: un buzón con duplicados se
vuelve más difícil de revisar justo cuando más entradas tiene.

---

## Grupo A — Se pueden hacer ya (horas, sin decisiones pendientes)

### A1. El ícono de Gestión del Riesgo no se reconoce
> *«Quiero algo más universal, yo no distingo ese símbolo»* — Julián

Hoy es un **extintor**, que efectivamente se lee mal a tamaño pequeño y
además ya no describe el módulo: con la guía de Emergencia escolar, esto va
mucho más allá de incendios.

**Sugerencia:** un triángulo de advertencia (⚠), que es el símbolo de
emergencia más universalmente entendido, o un teléfono con señal de alerta.

⚠️ **Lo que NO conviene usar: una cruz roja.** La cruz roja sobre fondo
blanco es un emblema protegido por los Convenios de Ginebra; su uso está
legalmente restringido. Es el primer ícono que se le ocurre a cualquiera para
"emergencia médica" y por eso vale la pena decirlo.

### A2. Íconos en vez de las palabras «Llamar» y «WhatsApp»
> *«¿Y si cambiamos el llamar por el ícono de teléfono y el de WhatsApp por el ícono de WhatsApp?»* — Julián

Viable, y hay una razón real a favor que la sugerencia no menciona: ahora que
cada teléfono va en su propio renglón con tres acciones, tres etiquetas de
texto aprietan mucho la pantalla en un celular. Los íconos liberan ese
espacio.

Dos advertencias, ninguna bloqueante:

1. **No dejar los botones solo con ícono, sin etiqueta accesible.** La app la
   usan ~75 docentes de edades y comodidad tecnológica muy distintas, y el
   comentario de Doris elogia justamente que sea *«amigable y muy fácil»*.
   Un `aria-label` y un texto pequeño debajo del ícono conservan eso sin
   perder el espacio ganado.
2. **El logo de WhatsApp es marca registrada** y tiene lineamientos de uso.
   Para uso interno institucional el riesgo es prácticamente nulo, pero es
   más limpio usar un glifo de mensajería genérico que reproducir el logo
   oficial.

---

## Grupo B — Bugs por reproducir antes de decidir nada

### B1. Error al publicar después de guardar cambios manuales
> *«cuando se le da al botón de publicar, aparece un error que no lo permite. Realmente eso no queda guardado si uno cierra.»* — Janneth, 6 de agosto

**Posiblemente ya resuelto y sin confirmar.** El 9 de agosto se reescribió
toda la salida pública de avisos (commit `bd915cc`): el `doGet` propio, el
botón de retirar y el rediseño. Ese trabajo pudo haber arreglado esto de
paso — o no, porque el reporte también menciona pérdida de datos al cerrar,
que es otra cosa.

**No lo doy por corregido.** Hay que reproducir el caso con Janneth: guardar
cambios manuales, intentar publicar, y ver si el error sigue. Es el reporte
más serio del buzón porque menciona **pérdida de trabajo**, que es la peor
categoría de fallo en una herramienta que se usa con prisa.

### B2. El informe no incluye todos los movimientos reales
> *«hice movimientos en el grado 11.2, y el informe no me los mostró. Parece que solo toma los movimientos de los grados afectados por el profesor ausente»* — Janneth

Distinto del trabajo que ya se hizo. Lo de este mes fueron las **casillas
para excluir grupos** de la publicación; esto es lo contrario: grupos que
deberían **entrar** y no entran. Hay que verificar el alcance con el que
`generarResumenDifusion` arma la lista de grupos.

---

## Grupo C — Hay que pensar el diseño

### C1. Que el algoritmo pueda mover también grupos no afectados directamente
> *«para lograr un movimiento más eficiente se requirió afectar a otro grupo… se tenía que mover al profesor Adolfo. Pero para moverlo, se necesitaba también mover a 11-2»* — Janneth

**Puede estar parcialmente hecho.** El motor ya tiene el concepto de *grupos
secundarios* y genera el aviso *«También reorganiza a X para liberar al
docente que cubre»* (`horarioModificado.ts:696-718`). Es exactamente la clase
de movimiento que Janneth describe.

Lo que no sé es si cubre **su caso concreto** (Beatriz → Adolfo → 11.2). Hay
que probarlo contra ese escenario específico antes de decidir si falta
trabajo o solo faltaba enterarse.

**Mi opinión:** de todo el buzón, esta es la de mayor valor para las
coordinadoras — es la diferencia entre que las opciones automáticas sirvan o
que toque hacerlo todo a mano. Si al probar resulta que falta, yo acotaría la
búsqueda a **mover como máximo uno o dos grupos secundarios**, y que la
propuesta explique siempre qué movió y por qué. Un algoritmo que reorganiza
medio colegio para ahorrar un movimiento es peor que uno que no encuentra
solución: nadie confía en lo que no entiende.

### C2. Liberar el aula del docente que falta toda la jornada
> *«el sistema debería analizar si el profesor va a faltar toda la jornada para liberar esa aula durante ese día»* — Janneth

**Parcial.** Ya existe reasignación de aula (`horarioModificado.ts:411-413`):
si el aula original está ocupada en el bloque nuevo, busca una libre. Lo que
no existe es lo que ella pide: dar de alta el aula del ausente como
disponible durante toda la jornada.

Es un cambio acotado y de valor claro. Fácil de hacer bien.

### C3. Acortamiento con uno o dos descansos
> — Julián, 31 de julio

Pequeño y sin ambigüedad: una opción más en el acortamiento de jornada.
Encaja perfecto con lo que ya existe.

### C4. Sugerir día y hora de reunión con menos afectación
> *«Reunión de ciertos profesores, analizando día y hora con menos afectación después de analizar horarios»* — Julián

Esta ya se había propuesto y quedó interrumpida en una sesión anterior. La
aplicación **ya tiene todos los datos** (`horarioBase` + asignación
académica), así que es autocontenida: se escoge un conjunto de docentes y el
sistema ordena las franjas por cuántas clases habría que mover.

**Mi opinión: es de las de mejor relación valor/esfuerzo del buzón.** No
toca nada existente, resuelve algo que hoy se hace a ojo, y es fácil de
explicar.

### C5. Que cada usuario ordene los íconos de la pantalla de inicio
> — Julián

Viable, pero es donde más discrepo, y vale la pena decirlo antes de
construirlo.

**El problema no es técnico, es de soporte.** Hoy la app es igual para todos,
y eso hace que ayudar a alguien por teléfono sea trivial: *«toca el ícono
verde de agenda, el sexto»*. Si cada docente reorganiza su pantalla, esa
frase deja de funcionar justo con las personas que más ayuda necesitan.

**Dos alternativas que dan casi todo el beneficio sin ese costo:**

1. **Fijar favoritos.** El usuario marca 2 o 3 módulos que suben al principio;
   el resto conserva el orden fijo de siempre. Se gana el acceso rápido y se
   conserva un mapa común.
2. **Orden automático por uso.** Los más usados suben solos. Cero
   configuración, que para un docente que entra dos veces por semana es mejor
   que una pantalla de personalización.

Nota técnica si se hace: en móvil el arrastrar y soltar es incómodo y falla
con dedos grandes. Flechas de subir/bajar en una pantalla de "personalizar"
funcionan mucho mejor al tacto. Y la preferencia debería ir en Firestore
(`users/{correo}`), no en `localStorage`, o se pierde al cambiar de
dispositivo.

### C6. Modo dirección de grupo con columnas configurables y anillos de color
> *«columnas un poco más versátiles… los grupos de aseo, los de restaurante, quiénes son los de base de leche… el color del anillo como una especie de clasificador»* — Julián

La más ambiciosa del buzón, y la que más me interesa por una razón: **buena
parte ya existe y creo que se está pidiendo dos veces.**

El módulo de Eventos que se acaba de construir es exactamente *«un conjunto
de estudiantes que NO es un curso»* — grupos temporales con su propia
planilla. «Los de aseo», «los de restaurante», «los de base de leche» son
justamente eso.

**Mi sugerencia:** antes de construir un sistema de columnas configurables,
probar si Eventos ya resuelve el 80%. Un evento «Aseo — semana 34» con sus
integrantes hace el mismo trabajo, y ya está hecho, probado y con reglas de
seguridad desplegadas.

Lo que sí quedaría por fuera y sería un añadido pequeño encima de lo
existente:

- **Los anillos de color como clasificador visual.** Poder pintar el anillo
  de la foto según una categoría que el director define. Barato y muy visual.
- **Una columna de valores libre** por grupo, para lo que no encaja en un
  evento.

**Lo que sí desaconsejo es un sistema genérico de columnas configurables.**
Es el camino clásico por el que una herramienta simple se convierte en una
hoja de cálculo mala: cada usuario arma su propio esquema, nada es
comparable entre grupos, y el soporte se vuelve imposible. Si al final hace
falta, que sea con un conjunto **cerrado** de tipos de columna (casilla,
texto corto, etiqueta de color) y un máximo de columnas.

### C7. Ver el plan general de asignaciones por grupo, en Tareas
> *«la idea sería poder reconocer el plan general de asignaciones para cada grupo»* — Doris, 17 de julio

Modesta, clara y bien alineada: una vista por grupo de las tareas ya
registradas. Los datos existen; es principalmente presentación.

Vale la pena notar que es **la única sugerencia de una docente que no es ni
Julián ni una coordinadora**. Ese buzón está siendo usado casi solo por el
equipo directivo, lo que probablemente diga más sobre la visibilidad del
botón de sugerencias que sobre el interés de los docentes.

---

## Resumen

| # | Sugerencia | Estado |
|---|---|---|
| — | Bandeja de espera / múltiplos de 5 / horario del docente afectado | ✅ Hechas — falta avisar |
| — | Duplicados en el buzón (doble envío) | 🔧 Minutos |
| A1 | Ícono de Gestión del Riesgo | 🔧 Ya |
| A2 | Íconos de teléfono y WhatsApp | 🔧 Ya |
| B1 | Error al publicar / pérdida de cambios | 🐞 Reproducir — **el más serio** |
| B2 | Informe no incluye todos los movimientos | 🐞 Reproducir |
| C1 | Algoritmo con grupos secundarios | 🎨 Probar si ya funciona — **el de más valor** |
| C2 | Liberar el aula del ausente | 🎨 Acotado |
| C3 | Uno o dos descansos al acortar | 🎨 Pequeño |
| C4 | Sugerir hora de reunión | 🎨 **Mejor valor/esfuerzo** |
| C5 | Ordenar íconos de inicio | 🤔 Ver alternativas |
| C6 | Dirección de grupo con columnas | 🤔 Probar Eventos primero |
| C7 | Plan de asignaciones por grupo | 🎨 Modesta y bien alineada |

**Si tuviera que escoger tres para lo próximo:** B1 (porque hay pérdida de
trabajo de por medio), C1 (porque decide si las opciones automáticas sirven),
y C4 (porque es barata y se nota de inmediato).
