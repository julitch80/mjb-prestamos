# Módulo de generación de horarios — contrato entre dos sesiones

*Escrito el 2026-09-05 por la sesión que trabaja en `D:\Proyectos\Horarios`.*
*Dirigido a quien tenga el control maestro de esta app.*

Este módulo lo construye **otra sesión de Claude**, que trabaja en un proyecto aparte.
Este documento existe para que las dos no se pisen. Si vas a tocar algo de lo que aquí
se describe, lee primero.

---

## 1. Aviso inmediato: hay trabajo sin confirmar

En el momento de escribir esto, el árbol de trabajo tiene cambios **sin commit** de este
módulo. Son funcionales y con pruebas, pero **la pantalla nunca se ha visto funcionando**:
la app entra con cuenta de Google y la sesión que la escribió no puede autenticarse.

> **No hagas `git add .` ni `git commit -a` a ciegas.** Este repositorio despliega solo
> al empujar a `master`, así que un commit indiscriminado publica a los ~30 docentes un
> módulo que nadie ha visto todavía.

Antes de confirmar nada de esto, Julián tiene que abrir la app (`npm run dev`), entrar como
coordinador, y comprobar la pantalla **Generar horario** y el conmutador de la pantalla
**Horario**. Cuando dé el visto bueno, este módulo se puede confirmar como cualquier otro.

---

## 2. Qué es y por qué está partido en dos

Cada año los coordinadores arman el horario a mano a partir de la asignación académica.
El objetivo es que el de 2027 se construya desde la app.

El cálculo lo hace un **motor aparte, en Python con OR-Tools (CP-SAT)**, que vive en
`D:\Proyectos\Horarios`. No está dentro de la app porque esta app es un sitio estático
servido por GitHub Pages: no puede ejecutar un solver. Meterlo dentro obligaría a escribir
un solver casero en TypeScript —mucho peor— o a pagar servidores para algo que se usa una
vez al año.

Las dos mitades se comunican por **archivos JSON**, no por red:

```
  la app  --entrada.json-->  motor (doble clic en generar_horario.bat)  --salida.json-->  la app
```

Para el coordinador son tres pasos, una vez al año: descargar, doble clic, cargar.

---

## 2 bis. El horario se genera por sede y jornada

Decisión de Julián (2026-09-05): **el horario no se construye de una vez para todo el
colegio**. Se hace de una sede y una jornada a la vez, y la pantalla pregunta cuál antes
de nada.

Encaja técnicamente porque las dos jornadas son problemas independientes: ocurren a horas
distintas, los grupos son disjuntos y nadie puede chocar consigo mismo entre una y otra.
Partirlo no pierde nada y aísla los problemas — hoy la mañana genera al 100% aunque la
asignación de la tarde tenga 10 horas de más.

- **Cualquier coordinador o superusuario puede generar cualquiera.** Generar un borrador
  es inofensivo: vive en el navegador de quien lo hace. La restricción de autoridad
  (`puedeEditarEnSede`, ya existente en `maestros.ts`) debe aplicarse al **publicar**,
  que todavía no está construido.
- Solo la sede **Central** tiene datos. Las dos de primaria aparecen deshabilitadas con
  la nota "sin datos todavía": los datos actuales no llevan campo de sede, y se asume
  que todo lo existente es de la Central (ver `hayDatosDeSede` en `contrato.ts`).
- El archivo descargado se llama `entrada_horario_<año>_<sede>_<jornada>.json`, para que
  cuatro archivos en la carpeta de descargas no sean indistinguibles.

---

## 3. Qué archivos son de este módulo

**Nuevos, propiedad de este módulo** (nadie más debería editarlos sin avisar):

```
src/data/horarios/tipos.ts            los tipos del contrato con el motor
src/data/horarios/contrato.ts         arma entrada.json y lee salida.json
src/data/horarios/almacen.ts          guarda los horarios generados en el navegador
src/data/horarios/fuente.tsx          contexto que decide qué horario ven las vistas
src/data/horarios/validador.ts        juzga un horario, y un movimiento suelto
src/data/horarios/fixtures/           un salida.json real, para las pruebas
src/data/horarios/*.test.ts           las pruebas del módulo
src/components/horarios/PanelHorarios.tsx   la pantalla del módulo
```

**Existentes, tocados lo mínimo:**

| Archivo | Qué se le hizo |
|---|---|
| `src/data/store.ts` | **1 línea**: se añadió `'generar_horario'` al tipo `VistaActual`. |
| `src/App.tsx` | **3 líneas**: el import del panel, una entrada en `NAV_ITEMS` (roles `coordinador` y `superusuario`) y su caso en el enrutado. |
| `src/components/VistaHorario.tsx` | Ver abajo. Es el único cambio no trivial. |

### El cambio en `VistaHorario.tsx`

Antes, las cinco vistas internas leían `horarioBase` importándolo directamente. Ahora lo
leen de un **contexto de React** (`useHorario()`), cuyo valor por defecto es exactamente
`horarioBase`. En la práctica:

- Sin borrador cargado, la pantalla se comporta **igual que antes**, línea por línea.
- El componente grande se renombró a `VistaHorarioContenido` y el nuevo `VistaHorario`
  es un envoltorio delgado que elige la fuente. No se reindentó el JSX.
- El conmutador "Horario vigente / Ver el borrador" **solo aparece si hay un borrador
  cargado**, y arranca siempre en "Horario vigente".

Los borradores viven en `localStorage` del navegador del coordinador. **No tocan el
horario del colegio ni llegan a ningún servidor.** Publicar es otra tarea, aún sin hacer.

---

## 4. Lo que no se puede romper sin avisar

El motor y este módulo **leen los datos maestros de la app**. Si cambian de nombre o de
forma, la generación del horario deja de funcionar, y no siempre de forma ruidosa.

| Archivo | Lo que se usa |
|---|---|
| `data/asignacionAcademica.ts` | `ASIGNACION_2026`, `ASIGNATURAS`, y la forma `{docenteId, asignaturaId, grupo, horas}` |
| `data/maestros.ts` | `USUARIOS` (id, nombre, rol, jornada), `MIXTOS_TARDE`, `BLOQUE_CI`, `AULA_GRUPO_TARDE`, `BLOQUES_MANANA`, `BLOQUES_TARDE` |

> **`USUARIOS[].correo` ya no está en el archivo** (commit `6819ebb`, 5-sep): viajaba
> en el bundle público y cualquiera podía extraer los 47 correos sin iniciar sesión.
> Ahora se rellenan tras el login desde Firestore (`data/plantilla.ts`,
> `aplicarPlantillaFirestore`). Este módulo **no usa el correo**, comprobado. Si algún
> día lo necesitara, hay que pedirlo en tiempo de ejecución y solo con sesión iniciada.
| `data/horarioBase.ts` | `horarioBase` y el tipo `EntradaHorario` |
| `data/tareas/calendario.ts` | `CONTRAJORNADAS_MT` |

**Campo nuevo en las aulas (6-sep): `exclusiva`.** El Patio va con `exclusiva: false`
porque dos grupos de educación física comparten cancha sin estorbarse. El motor no las
disputa y el validador no avisa de ellas. Está en `NO_SE_DISPUTAN`, dentro de
`contrato.ts`, y tiene su prueba. Si mañana hay otro espacio así (una placa polideportiva,
un aula doble), se añade ahí.

También se dependen dos **convenciones**, no solo de nombres:

- Un grupo cuyo id contiene `º` es de la tarde (`6º1`); con punto, de la mañana (`9.1`).
- En la asignación, `asignaturaId === 'ci'` es Centro de Interés y `asignaturaId` que
  empieza por `mt_` es media técnica. Ambas se excluyen de la generación a propósito.

**La red de seguridad son las pruebas.** `src/data/horarios/contrato.test.ts` comprueba
las cuentas reales (231 renglones de clase, 590 horas, 29 docentes, 20 grupos). Si alguien
cambia los datos maestros, esas pruebas fallan y avisan. **Si fallan, no las ajustes para
que pasen sin entender por qué**: probablemente el dato cambió de verdad y hay que
regenerar el horario, no silenciar la alarma.

---

## 5. Reparto de responsabilidades

| | Esta pestaña (control maestro de la app) | La sesión de Horarios |
|---|---|---|
| **Ejecutar cosas en la app** (`npm run dev`, `build`, `test`) | **Sí, aquí** | No |
| **Commits, ramas, push, despliegue** | **Sí, aquí** | No |
| Todo el resto de la app | Sí | No toca nada |
| El motor en Python (`D:\Proyectos\Horarios`) | No | Sí |
| Diseño y código de `src/**/horarios/` | Revisar y objetar | Propone y escribe |

**Regla acordada por Julián:** aunque la instrucción salga de la sesión de Horarios, *lo
que haya que correr en la app se corre desde aquí*. Si la otra sesión pide "corre las
pruebas" o "haz build", esa orden se ejecuta en esta pestaña.

> **Siempre las dos cosas: `npm test` y `npx tsc -b`.** Vitest transpila sin comprobar
> tipos, así que una prueba puede pasar en verde mientras rompe la compilación —y con
> ella el despliegue de toda la app. Pasó el 7-sep con dos pruebas que sembraban a
> propósito un `bloque: 9` y un `dia: 'sabado'`. Lo cazó esta pestaña, no la de Horarios.

Para evitar conflictos: mientras la sesión de Horarios trabaje en este módulo, **no edites
`src/data/horarios/` ni `src/components/horarios/`**. Si algo de ahí te molesta, dilo en
vez de arreglarlo: los dos lados tienen que quedar coherentes, y el otro lado incluye
código Python que tú no ves.

---

## 6. Qué hacer si…

**…hay que actualizar la asignación académica para el próximo año.** Cámbiala como
siempre en `asignacionAcademica.ts`. Después hay que **regenerar el horario**, porque el
que estuviera cargado se queda viejo. Avisa a la sesión de Horarios; no basta con editar
el dato.

**…las pruebas de `src/data/horarios/` fallan.** Casi siempre significa que un dato
maestro cambió. Mira qué prueba falla: los mensajes dicen qué cuenta ya no cuadra.

**…hay que desplegar y este módulo está a medias.** El módulo está aislado: si borras la
entrada de `NAV_ITEMS` en `App.tsx`, la pantalla deja de ser accesible y todo lo demás
sigue igual. Es la forma limpia de desplegar sin llevártelo.

**…quieres revertir todo esto.** Son tres archivos modificados y dos carpetas nuevas.
`git checkout -- src/App.tsx src/data/store.ts src/components/VistaHorario.tsx` y borrar
`src/data/horarios/` y `src/components/horarios/` lo deja como estaba.

---

## 7. Pendientes conocidos

- **Sin verificación visual.** Nadie ha visto la pantalla funcionando (punto 1).
- **Faltan dos datos del colegio**, que Julián tiene que conseguir:
  - Los días y horas exactos de la **media técnica** de Felipe y Valentina (14 h cada uno,
    en su misma jornada). Sin eso el motor puede solaparles clases *y no se notaría*.
  - Cuál de las dos clases del **Aula 7, lunes 5.ª hora** está mal registrada en
    `horarioBase.ts`: aparecen Jorge con 10.4 y Doris con 10.2 a la vez. Lo encontró el
    validador del motor revisando el horario vigente; es la única violación en 590 clases.
- **El Centro de Interés de la tarde no cabe.** Con esa franja reservada, los grupos de
  tarde piden 30 horas donde caben 29: sobran 10 horas en la asignación de 2026. Para 2027
  hay que presupuestar 29 horas por grupo de tarde.
- **Publicar el horario aprobado** (que sustituya a `horarioBase.ts`) todavía no existe.
  Hoy los borradores solo viven en el navegador del coordinador.

---

## 8. Cuando llegue "publicar el horario" (tarea 10)

Restricciones del proyecto que **la sesión de control maestro comunicó el 5-sep** y que no
son evidentes desde fuera. Se anotan aquí para no descubrirlas tarde:

- **`firestore.rules` es un archivo único para todo el proyecto de Firebase.** No hay uno
  por módulo, y el último despliegue reemplaza el anterior entero. Desplegar reglas desde
  otro repositorio dejaría sin permisos a préstamos y a asistencia.
- **`firestore.indexes.json` igual, y peor**: un despliegue borra los índices que no estén
  en el archivo. A esa fecha había 19, de tres módulos distintos.
- **Toda regla de escritura lleva `!esSuplantacion()`**, para que una sesión suplantada sea
  de solo lectura. Esas guardas no vienen en los fragmentos externos y **desaparecen si se
  pega un bloque tal cual, sin que nada falle ni avise**. La cabecera del archivo lleva el
  recuento: 67 escrituras / 67 guardas.

**Protocolo acordado:** si este módulo necesita reglas o índices de Firestore, la sesión de
Horarios **manda el fragmento** y la sesión de control maestro lo integra allí, como ya se
hace con asistencia. Nunca se despliega Firestore desde el proyecto del motor.

Consecuencia de diseño, no menor: mientras esto no se resuelva, **publicar no puede pasar
por Firestore sin coordinación**. La alternativa que ya funciona es generar el archivo que
sustituye a `horarioBase.ts` y desplegar la app, que es como se cambia el horario hoy.
