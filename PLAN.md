# PLAN — Editor de acompañamientos
*El CÓMO del [PRD](PRD.md). Cada decisión se explica por lo que significa para Julián.*
*Fecha: 2026-09-13 · Estado: APROBADO*

## En una línea

Los acompañamientos dejan de estar escritos dentro del programa y pasan a la base de datos
del colegio (Firestore, la misma del chat y de la asistencia). La aplicación lee de ahí la
distribución que rige cada día; el coordinador arma un borrador en su navegador, lo
publica con una fecha, y en ese momento queda guardado para todos.

---

## 1. Dónde se guardan las publicaciones — la única disyuntiva

| | **Firestore** (recomendado) | Google Sheets (Apps Script) |
|---|---|---|
| Qué es | La base de datos donde ya viven el chat, la asistencia y el restaurante | La hoja de cálculo donde viven reservas y tareas |
| Quién puede publicar | Lo comprueba **el servidor**: aunque alguien fabrique la petición a mano, la base de datos la rechaza si no es el coordinador de esa jornada | Lo comprueba un código que hay que **pegar a mano** en Apps Script cada vez que cambie |
| Cambios sin tu intervención | Las reglas las despliego yo desde aquí | Cada ajuste te obliga a pegar el backend y redesplegar |
| Llegada a los profesores | Un profesor con la aplicación abierta ve el cambio al instante | Lo ve al recargar |
| Proteger el historial | Una regla dice «las publicaciones no se editan ni se borran», y ni siquiera la aplicación puede saltársela | Cualquiera con acceso a la hoja puede borrar una fila |

**Recomiendo Firestore.** La razón que más pesa es la del historial: el PRD dice que es
irremplazable, y en Firestore esa protección la pone el servidor, no la buena voluntad.

## 2. La distribución de hoy no se migra

Si todavía no hay ninguna publicación, rige la distribución que está hoy dentro del
programa. **Consecuencias:**
- El día que se active la función **nadie ve un cambio** y no hay nada que cargar a mano.
- El historial arranca mostrando esa distribución como «Distribución inicial».
- La primera publicación real la hace coordinación, cuando decida.

## 3. Las publicaciones no se editan: se reemplazan

Cada publicación es un registro completo —zonas, asignaciones, candados, fecha desde la que
rige, quién la publicó y cuándo— que **nunca se modifica ni se borra**. Corregir un error es
publicar otra. **Consecuencia:** el historial siempre dice la verdad de lo que rigió, y la
distribución de un día cualquiera se puede reconstruir: es la última publicación cuya
fecha de vigencia ya había llegado.

## 4. Quién publica: lo decide el servidor, no el botón

Esconder el botón «Editar» no protege nada (fue la lección de la cuenta de portería). La
regla de la base de datos exige que quien publica sea **coordinador**, que la publicación
sea de **su jornada**, que la firma sea la suya y la hora la del servidor, y que no sea una
sesión de «Ver como». **Consecuencia:** ni un docente, ni el superusuario, ni la rectora
pueden publicar aunque lo intenten por fuera de la pantalla.

⚠️ **Depende de un dato que hay que verificar antes de empezar:** que en la ficha de
usuario de Janneth diga jornada `manana` y en la de Juan Diego `tarde`. Si estuviera mal
puesta, la regla le negaría la publicación a la coordinadora correcta. Es la tarea 1.1.

## 5. Cómo llega a todos

Hoy tres lugares leen la lista fija: la pestaña Acompañamiento, el horario del día de cada
profesor y la tarjeta de Inicio «Hoy te toca acompañamiento». Los tres pasan a pedirle a una
sola pieza nueva **«la distribución que rige en esta fecha»**. **Consecuencia:** es
imposible que la pestaña diga una cosa y la tarjeta de Inicio otra.

## 6. Los avisos reutilizan lo que ya funciona

El aviso en la aplicación y el correo usan las mismas funciones que ya usa el cambio de
horario por ausencia. **Consecuencia: no hay que pegar ni redesplegar Apps Script.** El
correo sale uno por profesor, porque cada uno lleva su propio «tenías / te queda».

**Una salvaguarda que agrego al PRD, y necesito tu visto bueno:** antes de confirmar la
publicación, una pantalla de **vista previa** muestra a qué profesores les llegará el aviso
y qué dirá cada uno. Publicar con la fecha equivocada notifica a gente real y no se puede
deshacer; esa pantalla es la última oportunidad de verlo.

## 7. El generador de alternativas

Corre **en el navegador del coordinador**, no en un servidor ni en el motor de Python del
módulo de horarios. El problema es pequeño —unas 30 casillas y unos 20 profesores por
jornada—, así que tarda segundos. Busca varias distribuciones que cumplan las reglas que
bloquean, les da puntaje por las que avisan (carga académica, equidad, rotación, mitad
para los mixtos) y devuelve las 2 o 3 mejores que sean **distintas entre sí**.

**Consecuencia para la confianza:** el generador va con **pruebas automáticas** que
generan cientos de distribuciones y comprueban en cada una que nadie queda en dos zonas el
mismo día, que ningún profesor queda fuera de su jornada, que Edgar no aparece en la mañana
y que los candados de Doris y Margarita no se mueven. Si algún día alguien lo cambia y rompe
una regla, las pruebas lo detienen antes de que llegue a producción.

**El número de clases por día** sale del horario vigente que ya usa la aplicación. Cuando el
módulo de horarios 2027 publique un horario nuevo, los acompañamientos contarán con ese.

## 8. El editor manual

Usa la misma herramienta de arrastrar y soltar del editor de horario. **Consecuencia:** se
maneja igual, funciona en el celular con el dedo, y no hay que instalar nada nuevo.

## 9. El borrador

Vive en el navegador de quien edita, separado por jornada, igual que los borradores del
módulo de horarios. Sobrevive a cerrar la pestaña; no viaja entre equipos (está dicho en el
PRD).

## 10. Qué archivos se tocan

**Nuevos:**
- `src/data/acompanamientos/` — las reglas, el generador y sus pruebas, la lectura de la
  distribución vigente y el guardado de publicaciones.
- `src/components/acompanamientos/` — el menú Editar, Zonas, Carga por profesor,
  Alternativas, el editor manual, la vista previa y el historial.

**Existentes que cambian:**
- `src/components/VistaHorario.tsx` — la pestaña Acompañamiento y el horario del día leen la
  distribución vigente; aparece el botón Editar.
- `src/components/PanelInicio.tsx` — la tarjeta «Hoy te toca acompañamiento».
- `firestore.rules` — la regla de la nueva colección, con su guarda de «Ver como».
- `firestore.indexes.json` — un índice para buscar las publicaciones de una jornada por
  fecha (22 → 23; se mezcla, no reemplaza).

⚠️ **`VistaHorario.tsx` es compartido con la sesión del módulo de horarios.** Ese módulo no
usa los acompañamientos, así que no hay choque de fondo, pero antes de tocar el archivo le
paso a esa sesión un aviso con lo que voy a cambiar, para que no trabaje encima.

**Lo que no se toca:** la lista fija de `maestros.ts` se queda como está —es la distribución
inicial— y los momentos de la tarde tampoco se tocan.

## 11. Instalar y correr

- **Para la aplicación no hay que instalar nada:** todo lo que usa ya está en el proyecto.
- **Para probar las reglas sí se agrega una pieza**, solo de pruebas (no viaja a producción):
  la librería oficial de Firebase para probar reglas en el emulador. Hoy ese tipo de prueba
  existe en el proyecto de asistencia, no en MJB. El emulador necesita Java, que ya está
  instalado en tu máquina (JDK 21).
- En tu máquina se ve igual que siempre, con el servidor de desarrollo, que levanto yo.

## 12. Check de verificación global

La función está bien cuando pasa todo esto, en este orden:

1. **Pruebas automáticas** (`npm test`): las reglas y el generador, incluidas las cientos de
   distribuciones generadas.
2. **Tipos y compilación** (`npx tsc -b` y `npm run build`) sin errores.
3. **Reglas probadas en el emulador**, antes de desplegarlas: un docente, el superusuario, la
   rectora y el coordinador de la otra jornada **no pueden** publicar; el coordinador de la
   jornada **sí**; nadie puede editar ni borrar una publicación.
4. **En la aplicación local**, con la base de datos real pero **sin publicar**: el botón
   Editar solo para el coordinador en su jornada, las alternativas, el editor manual y la
   vista previa de avisos.
5. **En producción, después de desplegar**, lo verificable sin notificar a nadie: que la
   pestaña muestra exactamente la distribución de hoy y que el archivo servido lleva las
   guardas por rol.
6. **La primera publicación real** es de coordinación. Recomiendo hacerla con **fecha
   futura** y revisar la vista previa con calma: es la prueba de punta a punta, con avisos
   reales.

**Por qué no hay una «publicación de prueba» en producción:** usa la misma base de datos
que los profesores. Una prueba notificaría a docentes reales y quedaría para siempre en el
historial, que por diseño no se borra. Por eso la regla se prueba en el emulador y el
flujo completo, con la vista previa antes de confirmar.
