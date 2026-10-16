# PRD — Simulacros configurables (etapa 1: simulacro del 21-oct-2026)

Estado: APROBADO por Julián (12-oct-2026).

## Problema

La guía del simulacro 2026 (HTML de Julián) funciona, pero todo está escrito dentro de la
página: horas, encargados, rutas. Cualquier cambio —sobre todo uno de último momento (lluvia,
un docente que falta, cambio de fecha)— exige editar el archivo y volver a repartirlo.
Además habrá más simulacros (incendio, inundación…) y no se quiere empezar de cero cada vez.

## Lo que se mantiene

La estructura de la guía actual: pestañas **Guion** (línea de ruta y modo paso a paso),
**Mi rol**, **Encargados** y **Rutas**, con su diseño. Se vuelve una pestaña **«Simulacros»**
del módulo Gestión del riesgo.

## Qué hace (etapa 1)

### Ficha del simulacro
- Sede, tipo de evento, **fecha**, y por jornada la **hora de la alarma** (mañana 10:00 a. m.,
  tarde 4:00 p. m. para el 2026).
- Cada paso del guion está definido en minutos antes/después de la alarma: **cambiar la hora
  o la fecha recalcula todo el cronograma** con la misma estructura.
- **Fecha y hora del simulacro nacional** como dato de la ficha (2026: 21 de octubre, 10:00 a. m.).

### Encargados con desplegables
- Cada puesto «por asignar» o «por confirmar» es una **lista desplegable con los docentes de la
  jornada** (los mixtos aparecen en ambas). Se puede marcar «por confirmar».
- **«Mi rol» se arma solo** para cada docente con lo que tenga asignado.

### Cambios de último momento («día del simulacro»)
- **Reprogramar**: en un solo panel, cambiar fecha y/o hora de una jornada (con motivo: lluvia,
  orden público, otro). El cronograma se recalcula al instante para todos.
- **Aviso al 123**: si la fecha u hora de una jornada **no coincide con el simulacro nacional**,
  la app muestra una alerta fija al responsable y a coordinación:
  **«Recuerde llamar al 123 para informar el ejercicio (hora nueva: …)»**, con una casilla
  «Ya llamé» que la apaga y queda registrada. Si coincide con el nacional, no aparece.
- **Reasignar un rol**: el coordinador cambia la persona de un puesto desde el desplegable;
  a la persona nueva le aparece **de inmediato** en su «Mi rol» y recibe una notificación en la
  app (y en el celular si tiene las notificaciones activas); a la anterior se le quita.
- Todo cambio de último momento queda en un **registro**: quién, qué, cuándo y motivo.

### Quién hace qué
- **Editan** (aprobado por Julián el 12-oct-2026):
  - **Mañana:** Julián (jefe de simulacros) y la coordinadora Janneth Ocampo.
  - **Tarde:** el coordinador Juan Diego Salazar y el profesor **Hugo**, encargado del simulacro en la tarde.
  - Cada uno edita los encargados y la fecha/hora de **su jornada**; Julián, ambas.
- **Ven:** todos los docentes; «Mi rol» personalizado. La guía solo es visible con sesión
  iniciada (no queda pública en internet).
- Estados: **Borrador → Publicado → Ejecutado → Archivado**. Los docentes solo ven lo publicado.

### Datos del 2026
- La ficha del 21-oct se carga con lo que ya existe en la guía del 11-oct y en los planes de
  trabajo de mañana y tarde (guion, rutas, roles, recursos, riesgos). El celular de Julián
  solo se muestra a usuarios con sesión.

## Qué NO hace (etapa 1; queda para etapas 2 y 3)

- Editor de guion, rutas, recursos y riesgos (en la etapa 1 vienen de la ficha 2026).
- Plantillas de incendio e inundación y «duplicar simulacro».
- Reporte, evaluación, Excel oficial e historial.
- No llama al 123 por sí misma: solo recuerda hacerlo.

## Criterios de aceptación (observables)

1. Un docente abre Simulacros y ve la guía con el diseño actual y su rol en «Mi rol».
2. Julián cambia la hora de la mañana a 11:30 → el guion de todos muestra las horas nuevas
   (p. ej. el paso del timbre a las 11:30) en menos de un minuto, sin recargar.
3. Con 11:30 (o con otra fecha), aparece el aviso del 123; al volver a 10:00 del 21-oct, desaparece.
   «Ya llamé» lo apaga y queda en el registro.
4. Un coordinador asigna «Cronometrador 1» a un docente → ese docente lo ve en «Mi rol» y recibe
   la notificación; al reasignarlo a otro, se le quita al primero.
5. Juan Diego o Hugo no pueden cambiar encargados ni la hora de la mañana; sí los de la tarde.
6. Sin sesión, la guía no se puede abrir.
7. El registro muestra cada cambio con quién, cuándo y motivo.

## Alineación con orientaciones oficiales (16-oct-2026)

Fuentes: Circular 079 de 2026 de la UNGRD y presentación del Distrito de Medellín (p. 31).

- **Hora nacional:** 10:00 a. m. La jornada de la tarde (4:00 p. m.) es una adaptación institucional.
- **Aviso previo (corregido 16-oct):** el 21-oct no se avisa al 123; los documentos no fijan otro canal. Solo si la Secretaría o el Distrito lo piden, avisar mínimo 30 minutos antes (institución y tipo de ejercicio). Reporte final: por el mecanismo de registro que dará a conocer la UNGRD. Está en el guion (minuto −30) y como recordatorio ámbar a los editores.
- **Reporte final:** informar la finalización y las novedades (n.º de participantes, n.º de organizadores y tiempos). Es el último paso del guion; el cronometrador entrega los tiempos al coordinador del reporte.
- **123:** el 21 de octubre NO es necesario reportar al 123. Solo se llama al 123 si cambia la FECHA respecto a la nacional (cambiar solo la hora ya no lo exige). Se mantiene «Ya llamé».
- **Observador vs. evaluador:** rol nuevo «Observación» (`obs`): documenta hechos sin calificar, para el informe final. El evaluador sigue calificando con el formato oficial. El puesto «invitado externo» pasa a rol observador y se agrega «Observador 1» (opcional, ambas jornadas).
- **Familias y visitantes:** avisar con anticipación que el 21 de octubre habrá simulacro, y mensaje «La resiliencia empieza en casa» (conversar en familia el plan de emergencia). Ambos están en la lista de preparación.
- **Evacuar no es obligatorio** según la orientación oficial; la institución mantiene la evacuación al patio central como ejercicio.
- **Simulación de las 2:00 p. m.:** es solo de las alcaldías; no aplica a las instituciones educativas.
