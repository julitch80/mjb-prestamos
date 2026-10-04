# TAREAS — Tareas MJB ↔ Google Classroom

PRD y PLAN aprobados por Julián el 4-oct-2026. Una subtarea a la vez, con evidencia.

## 1. Cimientos
- [x] 1.1 Codebase `functions-classroom` (build, despliegue acotado, maxInstances) — **Hecho cuando:** `npm run build` del codebase pasa y `firebase.json` lo lista sin tocar los demás.
- [x] 1.2 Acceso como profesor (firma sin clave, como el calendario) + función de prueba de solo lectura — **Hecho cuando:** con los permisos de consola puestos, la prueba lista los cursos de Julián (nombres) y sin ellos responde «sin autorización» sin romper nada.
- [ ] 1.3 Datos y reglas (`classroomVinculos`, `classroomTareas`, `classroomPendientes`) — **Hecho cuando:** las pruebas de reglas en el simulador demuestran que cada profesor ve solo lo suyo, coordinación ve pendientes de su jornada y nadie escribe desde la app.
- [ ] 1.4 Apps Script: columnas `origen` y `classroomUrl` en la tarea — **Hecho cuando:** Julián redespliega y una tarea creada desde MJB guarda esas columnas vacías sin afectar nada.

## 2. Vincular cursos
- [ ] 2.1 `classroomCursos` y `classroomVincular` (activa los avisos del curso) — **Hecho cuando:** Julián vincula su grupo de piloto y el vínculo aparece en Firestore con el curso correcto.
- [ ] 2.2 Pantalla «Vincular Classroom» en Tareas con curso sugerido por nombre — **Hecho cuando:** Julián la ve con sus grupos y asignaturas y la sugerencia acierta; un profesor sin cursos no ve cambios.

## 3. MJB → Classroom
- [ ] 3.1 Casilla «Publicar también en Classroom» + `classroomPublicar` — **Hecho cuando:** criterio 2 del PRD (la tarea aparece en Classroom con título, descripción, enlace y fecha).
- [ ] 3.2 Cancelar en MJB borra en Classroom (`classroomBorrar`) — **Hecho cuando:** criterio 3 del PRD.
- [ ] 3.3 «También en Classroom» con enlace en la tarea — **Hecho cuando:** el enlace abre la tarea correcta en Classroom.

## 4. Classroom → MJB
- [ ] 4.1 `alAvisoClassroom`: crea el pendiente, ignora las tareas creadas por MJB — **Hecho cuando:** criterio 4 del PRD y ningún duplicado al publicar desde MJB.
- [ ] 4.2 Aviso «Tarea de Classroom por completar» con momentos y validación de fecha — **Hecho cuando:** criterio 5 del PRD.
- [ ] 4.3 Fecha no válida: fechas propuestas + «Abrir la tarea en Classroom» — **Hecho cuando:** criterio 6 del PRD (incluido que el aviso desaparece al corregirla allá).

## 5. Coherencia y mantenimiento
- [ ] 5.1 Borrado en Classroom cancela en MJB y avisa — **Hecho cuando:** criterio 7 del PRD.
- [ ] 5.2 «La fecha en Classroom no coincide» mientras difiera — **Hecho cuando:** aparece y desaparece al corregir.
- [ ] 5.3 `renovarAvisosClassroom` diaria + recuperación de avisos perdidos — **Hecho cuando:** una ejecución forzada renueva la suscripción (nueva fecha de caducidad visible) y trae una tarea creada con los avisos detenidos.

## 6. Coordinación y piloto
- [ ] 6.1 Conteo de pendientes de Classroom por grupo en el panel de coordinación — **Hecho cuando:** coordinación ve el conteo del grupo de piloto.
- [ ] 6.2 Piloto completo con Julián — **Hecho cuando:** los 8 criterios del PRD pasan con capturas de MJB y de Classroom; criterio 8 comprobado con una cuenta sin vínculos.
- [ ] 6.3 Manuales (profesores y coordinadores) — **Hecho cuando:** las secciones nuevas están publicadas.

## Hallazgos del piloto
- 2026-10-04 (1.2): la cuenta de Julián tiene 32 cursos ACTIVOS, incluidos los de 2024 y 2025, con nombres
  irregulares («Fisica 10°2», «FÍSICA 10°1 2026», «Física 10-°3 2025»). La sugerencia de 2.2 debe
  normalizar acentos, «°/º/-» y preferir el año en curso (o sin año); los cursos viejos se muestran aparte.
