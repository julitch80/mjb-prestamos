# PRD — Plan de trabajo en casa con ajustes razonables

Estado: BORRADOR para aprobación de Julián (20-oct-2026). Decisiones tomadas el 20-oct (ver final).

## Problema

Unos 10 estudiantes de toda la institución terminarán el año desde casa por situaciones de
salud, emocionales o comportamentales. Cada docente debe enviarles guías de trabajo
**ajustadas a sus condiciones** (ajustes razonables, con orientación de la UAI), hacerles
seguimiento y citarlos a sustentación. Hoy eso se haría por correo y WhatsApp, sin agenda
para el estudiante ni vista de conjunto para coordinación, y diseñar cada guía desde cero es
una carga que los docentes no tienen tiempo de asumir.

## Qué hace

### 1. El plan del estudiante (UAI y docente orientador)
- La **UAI o el docente orientador** crean el plan: estudiante, grupo, fecha de inicio y de fin, y el motivo
  (**reservado**: solo lo ven la UAI, el orientador y coordinación).
- La app arma sola la lista de asignaturas y docentes según la asignación académica del grupo.
- **Ajustes razonables:** la UAI o el orientador registran las orientaciones en lenguaje
  pedagógico, sin diagnóstico. Ej.: «lecturas cortas», «instrucciones de un paso a la vez»,
  «máximo 3 momentos de trabajo por día», «evitar trabajo en equipo», «entregas orales
  permitidas». Esos ajustes acompañan a todas las guías del estudiante.
- **Criterios de promoción:** la app pide a cada asignatura los criterios mínimos de promoción
  para ese estudiante (qué debe demostrar para aprobar). Coordinación ve qué asignaturas faltan.

### 2. La guía, propuesta por la IA y aprobada por el docente
El docente **no diseña material**: llena un formulario corto y revisa una propuesta.
- **Lo que pone el docente:** temáticas, competencias o habilidades a desarrollar, y
  opcionalmente un texto, lectura o enlace de referencia que quiera usar.
- **Lo que suma la app sola:** los ajustes razonables del estudiante, sus criterios de promoción
  en esa asignatura, el periodo del plan y la estructura de guía (abajo).
- **La IA propone la guía completa:** producto final, entregas parciales con duración en
  momentos y evidencia esperada, criterios de evaluación y preguntas para la sustentación,
  adaptando lecturas e instrucciones a los ajustes.
- **El docente revisa:** puede aprobarla tal cual, editar cualquier parte, o pedir «otra versión»
  con una indicación («más corta», «más práctica»). Nada llega al estudiante sin aprobación.
- **Privacidad:** a la IA no se le envía el nombre del estudiante, ni su motivo, ni datos de
  salud: solo los ajustes pedagógicos y los datos de la asignatura.

### 3. Estructura de la guía
1. **Encabezado:** asignatura, docente, periodo, **producto final** y criterios de evaluación (3–4).
2. **Entregas parciales (pasos):** qué hacer · duración en momentos (25 min) · evidencia que
   entrega (foto, texto, audio, documento) · fecha · material (archivo o enlaces).
3. **Sustentación:** modalidad (presencial o virtual con enlace), fecha y hora, y 3–4 preguntas
   guía que el estudiante conoce de antemano.

### 4. Agenda diaria del estudiante (QR, sin iniciar sesión)
- La app reparte los pasos de **todas** las asignaturas en días hábiles, sin pasar del tope
  diario de momentos del estudiante (el de sus ajustes; si no tiene, 4).
- El estudiante y su familia reciben un **QR o enlace propio** que no se puede adivinar. Ven:
  «Hoy: Física, paso 2 (1 momento) · Español, paso 1 (2 momentos)», las próximas entregas y
  las sustentaciones, con el material de cada paso. Solo aparece su primer nombre.
- El QR se puede revocar y generar otro si se pierde.

### 5. Classroom
- Cada paso aprobado se puede publicar en el curso de Classroom de la asignatura **asignado
  solo a ese estudiante**. Si entrega allá, el paso queda «entregado» solo en la app.

### 6. Seguimiento
- Por paso: pendiente → entregado → revisado, con una observación corta del docente.
- Sustentación: citada → sustentada, con observación.
- **Tablero de coordinación:** por estudiante y asignatura, % de pasos entregados, guía
  aprobada o no, criterios de promoción puestos o no, y sustentación citada o no. Se ve quién va
  atrasado y qué asignatura no ha montado nada.
- La nota se sigue poniendo donde siempre; aquí queda el seguimiento y las observaciones.

## Quién hace qué
- **UAI y docente orientador:** crean los planes y registran los ajustes razonables; ven el tablero.
- **Coordinación:** ve todo y recibe el tablero.
- **Docente:** ve solo sus estudiantes con plan, en sus asignaturas; pone criterios de promoción,
  pide y aprueba la guía, revisa entregas, cita y registra la sustentación.
- **Estudiante y familia:** solo el QR, de lectura.

## Qué NO hace
- No envía la guía a la IA con datos personales ni de salud.
- No publica nada al estudiante sin aprobación del docente.
- No reemplaza el registro de notas.
- No escribe al estudiante por WhatsApp.

## Criterios de aceptación (observables)
1. La UAI crea el plan de un estudiante de 8º1 → aparecen sus asignaturas con sus docentes,
   y el motivo no lo ve ningún docente.
2. La UAI registra «lecturas cortas; máximo 3 momentos por día» → esos ajustes aparecen en el
   formulario de guía de cada docente.
3. Un docente pone temática y competencia, pide la guía → en menos de un minuto ve una propuesta
   con producto final, al menos 3 pasos con momentos y evidencia, y preguntas de sustentación,
   con lecturas cortas.
4. El docente edita un paso y aprueba → el estudiante lo ve en su QR; antes de aprobar, no.
5. Con guías aprobadas en 3 asignaturas, ningún día del QR suma más de 3 momentos.
6. El QR abre la agenda sin iniciar sesión y no muestra apellidos ni el motivo.
7. El docente marca un paso «revisado» → el tablero de coordinación actualiza el % de esa asignatura.
8. Un paso publicado en Classroom y entregado allá aparece «entregado» en la app.

## Decisiones de Julián (20-oct-2026)
1. Crean el plan: **la UAI y el docente orientador**.
2. Asistencia: mientras dure el plan, el estudiante sigue en las listas **marcado «plan en casa»**
   y no se le cuentan fallas. (Esto toca el módulo de asistencia: lo construye la sesión de asistencia.)
3. Familia: **basta con el QR**; no se envían correos.
4. IA: **Claude**, desde una función del servidor con la clave guardada como secreto de Firebase.

## Criterio de aceptación adicional
9. Con el plan activo, el estudiante aparece «plan en casa» en las listas de asistencia de sus
   docentes y esas fechas no le suman fallas.
