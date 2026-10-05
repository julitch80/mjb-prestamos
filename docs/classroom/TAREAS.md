# TAREAS — Tareas MJB ↔ Google Classroom

PRD y PLAN aprobados por Julián el 4-oct-2026. Una subtarea a la vez, con evidencia.

## 1. Cimientos
- [x] 1.1 Codebase `functions-classroom` (build, despliegue acotado, maxInstances) — **Hecho cuando:** `npm run build` del codebase pasa y `firebase.json` lo lista sin tocar los demás.
- [x] 1.2 Acceso como profesor (firma sin clave, como el calendario) + función de prueba de solo lectura — **Hecho cuando:** con los permisos de consola puestos, la prueba lista los cursos de Julián (nombres) y sin ellos responde «sin autorización» sin romper nada.
- [x] 1.3 Datos y reglas (`classroomVinculos`, `classroomTareas`, `classroomPendientes`) — **Hecho cuando:** las pruebas de reglas en el simulador demuestran que cada profesor ve solo lo suyo, coordinación ve pendientes de su jornada y nadie escribe desde la app.
- [ ] 1.4 Apps Script: columnas `origen` y `classroomUrl` en la tarea — **Hecho cuando:** Julián redespliega y una tarea creada desde MJB guarda esas columnas vacías sin afectar nada.

## 2. Vincular cursos
- [x] 2.1 `classroomCursos` y `classroomVincular` (activa los avisos del curso) — **Hecho cuando:** Julián vincula su grupo de piloto y el vínculo aparece en Firestore con el curso correcto.
- [x] 2.2 Pantalla «Vincular Classroom» en Tareas con curso sugerido por nombre — **Hecho cuando:** Julián la ve con sus grupos y asignaturas y la sugerencia acierta; un profesor sin cursos no ve cambios.

## 3. MJB → Classroom
- [x] 3.1 Casilla «Publicar también en Classroom» + `classroomPublicar` — **Hecho cuando:** criterio 2 del PRD (la tarea aparece en Classroom con título, descripción, enlace y fecha).
- [x] 3.2 Cancelar en MJB borra en Classroom (`classroomBorrar`) — **Hecho cuando:** criterio 3 del PRD.
- [x] 3.3 «También en Classroom» con enlace en la tarea — **Hecho cuando:** el enlace abre la tarea correcta en Classroom.

## 4. Classroom → MJB
- [x] 4.1 `revisarClassroom` (programada cada 5 minutos): lee las tareas publicadas de los cursos vinculados creadas desde el vínculo, crea/actualiza el pendiente, ignora las creadas por MJB y detecta las borradas — **Hecho cuando:** criterio 4 del PRD y ningún duplicado al publicar desde MJB.
- [x] 4.2 Aviso «Tarea de Classroom por completar» con momentos y validación de fecha — **Hecho cuando:** criterio 5 del PRD.
- [ ] 4.3 Fecha no válida: fechas propuestas + «Abrir la tarea en Classroom» — **Hecho cuando:** criterio 6 del PRD (incluido que el aviso desaparece al corregirla allá).

## 5. Coherencia y mantenimiento
- [ ] 5.1 Borrado en Classroom cancela en MJB y avisa — **Hecho cuando:** criterio 7 del PRD.
- [ ] 5.2 «La fecha en Classroom no coincide» mientras difiera — **Hecho cuando:** aparece y desaparece al corregir.
- [x] 5.3 ~~`renovarAvisosClassroom`~~ — ya no aplica (sin suscripciones que renovar). Nota de recuperación: si `revisarClassroom` estuvo detenida, al reanudarse trae sola las tareas creadas desde el vínculo (no depende de avisos); ejecución forzada desde Cloud Scheduler.

## 6. Coordinación y piloto
- [ ] 6.1 Conteo de pendientes de Classroom por grupo en el panel de coordinación — **Hecho cuando:** coordinación ve el conteo del grupo de piloto.
- [ ] 6.2 Piloto completo con Julián — **Hecho cuando:** los 8 criterios del PRD pasan con capturas de MJB y de Classroom; criterio 8 comprobado con una cuenta sin vínculos.
- [ ] 6.3 Manuales (profesores y coordinadores) — **Hecho cuando:** las secciones nuevas están publicadas.

## Hallazgos del piloto
- 2026-10-04 (1.2): la cuenta de Julián tiene 32 cursos ACTIVOS, incluidos los de 2024 y 2025, con nombres
  irregulares («Fisica 10°2», «FÍSICA 10°1 2026», «Física 10-°3 2025»). La sugerencia de 2.2 debe
  normalizar acentos, «°/º/-» y preferir el año en curso (o sin año); los cursos viejos se muestran aparte.

## Desviaciones
- 2026-10-04 (4.1 / 5.3): Classroom rechazó los avisos push con delegación de dominio (403 @MissingGrant; exigen OAuth por usuario). Opción A elegida por Julián: sondeo cada 5 minutos (`revisarClassroom`) en lugar de Pub/Sub `alAvisoClassroom`; 5.3 deja de aplicar y `classroomVincular` ya no registra suscripciones (campo `registro` retirado; se añade `vinculadoEn`).
