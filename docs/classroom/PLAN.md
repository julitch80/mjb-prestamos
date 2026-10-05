# PLAN técnico — Tareas MJB ↔ Google Classroom

Base: docs/classroom/PRD.md (aprobado por Julián el 4-oct-2026).

## Idea general (en lenguaje de Julián)

- Las tareas siguen viviendo donde viven hoy (la hoja de Google, vía Apps Script). Classroom
  es un espejo: MJB le copia las tareas y escucha lo que pasa allá.
- La conexión con Classroom la hace un servidor pequeño en Firebase (Cloud Functions), con el
  **mismo mecanismo que ya usa el calendario «Tareas MJB»**: actúa en nombre del profesor gracias
  al permiso de administrador del colegio, **sin archivos de claves en ningún computador**.
- Lo que hay que recordar (qué curso corresponde a qué grupo, qué tarea de MJB es cuál en
  Classroom, qué tareas de Classroom están pendientes) se guarda en Firestore, protegido para que
  cada profesor solo vea lo suyo y coordinación vea los pendientes de su jornada.

## Piezas

| Pieza | Qué hace | Consecuencia para Julián |
|---|---|---|
| Codebase nuevo `functions-classroom` | Todas las funciones de Classroom, aparte de las demás | Se despliega solo, sin tocar préstamos, asistencia ni calendario |
| `classroomCursos` (llamable) | Lista los cursos de Classroom del profesor | Para la pantalla «Vincular Classroom» |
| `classroomVincular` (llamable) | Guarda grupo+asignatura → curso (y desde cuándo está vinculado) | Una vez por curso |
| `classroomPublicar` (llamable) | Crea la tarea en Classroom después de publicarla en MJB | Vía 1 |
| `classroomBorrar` (llamable) | La borra de Classroom al cancelarla en MJB | Vía 1 |
| `revisarClassroom` (programada, cada 5 minutos) | Lee las tareas publicadas de los cursos vinculados (solo las creadas desde el vínculo), crea o actualiza los pendientes y detecta las borradas | Vía 2, en menos de 5 minutos; nadie tiene que acordarse |
| Pantalla «Vincular Classroom» en Tareas | Lista de grupos y asignaturas del profesor con su curso sugerido | Vía 0 |
| Casilla «Publicar también en Classroom» | Al crear una tarea | Vía 1 |
| Aviso «Tarea de Classroom por completar» | Con momentos, verificación de fecha y botón «Abrir en Classroom» | Vía 2 |
| Panel de coordinación | Conteo de pendientes por grupo | Vía 2 |
| Apps Script | La tarea guarda de dónde vino y su enlace de Classroom (2 columnas nuevas) | **Un redespliegue manual de Apps Script** |

Las tareas importadas se publican en MJB con la misma acción `crearTarea` de hoy, así que el
cupo, los festivos y la agenda se validan igual que siempre.

## Datos nuevos en Firestore

- `classroomVinculos/{correo del profesor}`: grupo|asignatura → curso de Classroom.
- `classroomTareas/{id de la tarea MJB}`: curso, tarea de Classroom, origen (mjb/classroom),
  fecha de entrega en Classroom (para el aviso «la fecha no coincide»).
- `classroomPendientes/{id de la tarea en Classroom}`: lo que llegó de Classroom y espera momentos.
- Reglas: cada profesor lee lo suyo; coordinación lee los pendientes de su jornada; solo las
  funciones escriben. Se prueban en el simulador antes de desplegar.

## Permisos que Julián agrega (cuando el plan esté aprobado)

1. **Google Cloud, proyecto mjb-prestamos:** activar *Google Classroom API* (Pub/Sub ya no hace falta).
2. **Consola de administración (admin.asistencia) → Seguridad → Controles de API → Delegación
   de todo el dominio:** editar la entrada que ya existe para el calendario y **agregar** estos permisos:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.students`
3. Ya no hay tema de Pub/Sub: la revisión es una función programada (Cloud Scheduler la crea el despliegue).

## Orden de construcción (tareas madre)

1. Cimientos: codebase, acceso como profesor a Classroom, datos y reglas.
2. Vincular cursos (pantalla + `classroomCursos` + `classroomVincular`).
3. Vía 1: publicar y borrar en Classroom.
4. Vía 2: recibir avisos, pendientes, aviso al profesor con momentos y fecha, botón «Abrir en Classroom».
5. Coherencia de fechas y borrados desde Classroom; renovación diaria.
6. Panel de coordinación y piloto con Julián (los 8 criterios del PRD).

## Cómo se verifica (de punta a punta)

- Pruebas automáticas de la lógica (fechas, emparejar curso, evitar duplicados) y de las reglas
  en el simulador.
- Antes de tocar producción, una prueba de solo lectura: listar los cursos de Julián.
- Piloto: los 8 criterios del PRD, con evidencia (capturas de MJB y de Classroom).
- Mientras dure el piloto, solo se vinculan los cursos de Julián; nadie más ve cambios.

## Riesgos

- **Si la delegación no tiene los permisos**, las funciones responden «sin autorización» y no
  rompen nada; la pantalla de vincular lo dice.
- **Sin avisos push (hallazgo 2026-10-04):** `POST /registrations` respondió 403 «@MissingGrant … domain-wide
  delegation is not supported»: los avisos push de Classroom exigen OAuth por usuario, no la delegación de
  dominio. Julián decidió la **Opción A**: sustituir el push por sondeo cada 5 minutos (`revisarClassroom`).
  Consecuencia: el retraso máximo es de ~5 minutos y no hay suscripciones que caduquen ni renovar.
- **Tareas viejas:** solo se importan las creadas en Classroom desde que se vinculó el curso (`vinculadoEn`).
- **Coste:** dentro del plan gratuito de Firebase para el volumen del colegio (unas pocas lecturas por curso cada 5 minutos).
