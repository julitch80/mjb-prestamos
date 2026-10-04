# PRD — Tareas MJB ↔ Google Classroom

Estado: BORRADOR para aprobación de Julián (4-oct-2026).

## Problema

Varios profesores publican sus tareas en Google Classroom. Esas tareas no aparecen en
MJB: no cuentan en la carga del grupo, se saltan la política de tareas (momentos y tope
por día) y el estudiante tiene que mirar dos lugares. Y quien publica en MJB tiene que
volver a escribir la misma tarea en Classroom.

## Decisiones de Julián (4-oct-2026)

- Los profesores tienen **un curso de Classroom por grupo y asignatura** (p. ej. «Física 10.1»).
- Se construyen **las dos vías a la vez**.
- Los permisos en la consola de administración de Google los agrega **Julián con admin.asistencia**
  (igual que para el calendario «Tareas MJB»).
- **Piloto: solo Julián, con uno de sus grupos.**

## Lo que Google permite y lo que no

- Una aplicación puede **leer** todas las tareas de los cursos de un profesor.
- Una aplicación solo puede **modificar o borrar** las tareas que ella misma creó.
  Por eso, la fecha de una tarea creada a mano en Classroom solo la puede cambiar el profesor allá.
- Classroom avisa en pocos minutos cuando se crea o cambia una tarea en un curso.
- No hace falta licencia de pago para nada de lo que sigue.

## Qué hace

### 0. Vincular cursos (una vez por profesor)
En Tareas, el profesor toca «Vincular Classroom» y ve la lista de sus cursos. Para cada
grupo y asignatura que dicta en MJB escoge el curso de Classroom que le corresponde (la
app sugiere el que tenga el grupo en el nombre). Puede desvincular cuando quiera.

### 1. De MJB a Classroom
- Al publicar una tarea en MJB, si ese grupo y asignatura están vinculados, aparece la
  casilla **«Publicar también en Classroom»** (marcada por defecto; el profesor la puede quitar).
- MJB crea la tarea en el curso: título, descripción, el adjunto como enlace y la fecha de
  entrega. Los momentos no pasan a Classroom.
- Si el profesor **cancela** la tarea en MJB, se **borra** de Classroom.
- En MJB la tarea muestra «También en Classroom» con un enlace para abrirla allá.

### 2. De Classroom a MJB
- Cuando el profesor crea una tarea en un curso vinculado, MJB la guarda como
  **pendiente**: todavía no sale en la agenda de los estudiantes ni ocupa cupo.
- Al entrar a Tareas, el profesor ve el aviso **«Tarea de Classroom por completar: defina
  momentos y verifique la fecha»**.
- Define los momentos. MJB revisa la fecha de entrega de Classroom contra el cupo y el
  calendario (festivos, contrajornada, tope del día):
  - **Si la fecha sirve**, confirma y la tarea queda publicada en MJB.
  - **Si no sirve**, MJB propone las fechas posibles. El profesor escoge una y MJB muestra
    **«Abrir la tarea en Classroom»** para que cambie allá la fecha a mano.
- Cuando el profesor cambia la fecha en Classroom, MJB lo nota y la tarea queda coherente.
  Si no la cambia, MJB publica con la fecha escogida en MJB y la tarea muestra
  **«La fecha en Classroom no coincide»** hasta que se corrija.
- Si la tarea se **borra** en Classroom, MJB la cancela y avisa al profesor.
- Las tareas creadas por MJB (vía 1) no se vuelven a traer: no hay duplicados.
- Coordinación ve, en su panel de Tareas, cuántas tareas de Classroom siguen pendientes por grupo.

## Qué NO hace

- No lee ni escribe **calificaciones** ni **entregas** de los estudiantes.
- No crea cursos en Classroom ni cambia quién está inscrito.
- No trae **materiales, anuncios ni preguntas** de Classroom: solo tareas.
- No funciona con cursos de cuentas personales (solo cuentas @iemanueljbetancur.edu.co).
- No modifica en Classroom ninguna tarea que el profesor creó allá.

## Criterios de aceptación (observables, en el piloto)

1. Julián vincula su grupo de prueba con su curso «Física 10.x» y la vinculación queda guardada.
2. Publica una tarea en MJB con «Publicar también en Classroom» → en menos de un minuto
   aparece en su Classroom con el mismo título, descripción, enlace del adjunto y fecha.
3. Cancela esa tarea en MJB → desaparece de Classroom.
4. Crea una tarea a mano en Classroom → en pocos minutos ve en MJB el aviso «Tarea de
   Classroom por completar»; los estudiantes todavía no la ven en la agenda.
5. Le define 2 momentos con una fecha válida → aparece en la agenda del grupo y cuenta en la carga.
6. Repite con una fecha que choca con el cupo → MJB propone otra; él la cambia en Classroom
   con el botón «Abrir la tarea en Classroom» y el aviso de fecha distinta desaparece.
7. Borra en Classroom una tarea importada → queda cancelada en MJB.
8. Un profesor sin cursos vinculados no ve ningún cambio en Tareas.

## Qué necesita Julián hacer (consola)

1. En Google Cloud (proyecto mjb-prestamos): activar la **Google Classroom API** y la de **Pub/Sub**.
2. En la consola de administración (admin.asistencia): agregar a la delegación de dominio
   que ya existe para el calendario los permisos de Classroom para cursos, tareas y avisos.
   Le paso la lista exacta de permisos cuando el plan esté aprobado.

## Esfuerzo

Más grande que el calendario de tareas: dos funciones nuevas en el servidor (crear o borrar
en Classroom y recibir los avisos de Classroom), la pantalla de vincular cursos y el aviso
de tareas pendientes. Se construye y prueba por etapas, con la vía 1 primero dentro del mismo plan.
