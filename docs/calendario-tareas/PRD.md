# PRD — Las tareas llegan al Google Calendar del estudiante

Estado: APROBADO por Julián el 22-sep-2026.
Autorización institucional: rectora, confirmada por Julián el 22-sep-2026.

## Problema
La agenda de tareas solo se ve si el estudiante abre el QR o el enlace de su grupo.
Muchos no lo hacen a diario y se les pasa la fecha de entrega. Todos tienen cuenta
institucional con Google Calendar activado: si la fecha aparece ahí, les llega sola.

## Qué hace
1. Cada estudiante de un grupo activado recibe en su Google Calendar institucional un
   calendario aparte llamado **«Tareas MJB»**. No se toca su calendario principal.
2. Cada tarea del grupo aparece como un evento de **todo el día en la fecha de entrega**:
   título «Asignatura — título de la tarea», y en la descripción el texto de la tarea,
   el enlace al adjunto si lo hay y el enlace a la agenda del grupo.
3. El día anterior a la entrega le llega un aviso del calendario.
4. Si el profesor cancela la tarea, el evento desaparece. Si la cambia, el evento se
   actualiza.
5. Los cambios llegan en máximo 15 minutos, entre las 5 a. m. y las 10 p. m.
6. Solo reciben el calendario los estudiantes con correo institucional verificado y
   cuenta activa. Los demás siguen con el QR como hoy.
7. Si un estudiante cambia de grupo o se retira, dejan de llegarle las tareas del grupo
   anterior y sus eventos pendientes se borran.

## Qué NO hace
- No lee, ni ve, ni toca el calendario principal ni ningún otro calendario del estudiante:
  el permiso que se pide solo alcanza los calendarios que la propia aplicación crea.
- No pone los días propuestos para hacer la tarea: el sistema los recalcula a diario y
  el calendario cambiaría todos los días.
- No envía correos ni notificaciones fuera del aviso del propio calendario.
- No cambia nada de cómo el profesor crea las tareas.

## Piloto
Arranca solo con **10.1**, una semana. Se pasa a los demás grupos solo con el visto
bueno de Julián. Hay un interruptor para pausarlo todo sin desplegar nada.

## Criterios de aceptación (observables)
- A1. Un estudiante de 10.1 con correo verificado abre su Google Calendar y ve en la
  lista «Tareas MJB» con las tareas vigentes de 10.1 en sus fechas de entrega.
- A2. Julián crea una tarea de prueba para 10.1 y en menos de 15 minutos aparece en el
  calendario de un estudiante de 10.1 (se comprueba con la cuenta de un estudiante que
  Julián designe, o con el registro de la función).
- A3. Julián cancela esa tarea y en menos de 15 minutos desaparece del calendario.
- A4. Un estudiante de 10.2 NO tiene «Tareas MJB» durante el piloto.
- A5. Con el interruptor en pausa, una tarea nueva no llega a ningún calendario.
- A6. El registro de cada revisión dice cuántos estudiantes revisó, cuántos eventos creó,
  cambió y borró, y cuáles fallaron y por qué.

## Decisiones de Julián
- D1. APROBADO: si el estudiante borra «Tareas MJB», se le vuelve a crear en la siguiente revisión (para no verlo, que lo oculte).
- D2. APROBADO: aviso el día anterior a las 3:00 p. m. para grupos de la mañana y a las 9:00 a. m. para los de la tarde.
