# PRD — Reemplazo temporal de docente

Estado: BORRADOR para aprobación de Julián (5-oct-2026).

## Problema

Cuando un docente tiene una incapacidad larga, la Secretaría envía un reemplazo temporal.
Hoy la app solo sabe hacer reemplazos **definitivos**: desactiva la cuenta del titular y le
pasa su puesto al reemplazo. Al regreso del titular hay que deshacerlo a mano, y mientras
tanto el titular queda sin ninguna entrada a la app.

## Decisiones de Julián (5-oct-2026)

- Mientras dura la incapacidad, el titular queda en **solo lectura**.
- Las tareas que publique el reemplazo quedan **a nombre del puesto** (el titular las
  encuentra al volver).

## Qué hace

1. En el panel de superusuario, sección de reemplazos, una opción **«Reemplazo temporal»**:
   titular, reemplazo y **fecha de regreso** (obligatoria). Previsualizar → confirmar, igual
   que el reemplazo definitivo.
2. Desde ese momento el reemplazo **ocupa el puesto**: ve y atiende el horario, las aulas,
   la dirección de grupo, los acompañamientos, las tareas y la asistencia del titular.
3. El titular **conserva su cuenta en solo lectura**: puede entrar y consultar horarios,
   agenda y mensajes, pero no publica tareas, no reserva, no toma asistencia ni escribe en
   el chat. Una barra le recuerda «Estás en solo lectura hasta el <fecha>: te reemplaza <nombre>».
4. El **día del regreso**, a primera hora, la app devuelve sola el puesto al titular,
   le quita el acceso al reemplazo y avisa a los dos.
5. El superusuario puede **terminarlo antes** o **cambiar la fecha de regreso**.
6. Todo queda en la auditoría: quién, a quién, desde cuándo, hasta cuándo, quién lo terminó.

## Qué NO hace

- No crea la cuenta del reemplazo: la crea quien administra Google Workspace
  (@iemanueljbetancur.edu.co) y luego se activa en el panel como cualquier docente.
- No cambia nada de lo ya registrado (tareas, reservas, asistencia, mensajes): todo sigue a
  nombre del puesto, y los mensajes del chat conservan a su autor real.
- No permite dos reemplazos simultáneos del mismo puesto.

## Criterios de aceptación (observables)

1. Julián programa un reemplazo temporal de prueba con una fecha de regreso; el reemplazo
   entra y ve el horario y las tareas del titular como si fueran suyos.
2. El reemplazo publica una tarea y esta aparece a nombre del puesto (la ve el titular).
3. El titular entra, ve la barra de solo lectura, consulta su horario y **no** puede publicar
   tareas, reservar, tomar asistencia ni escribir en el chat.
4. Llegada la fecha (en la prueba, forzando la revisión), el titular recupera todo y el
   reemplazo queda sin acceso; ambos reciben el aviso.
5. «Terminar antes» produce el mismo resultado de inmediato.
6. La auditoría muestra el inicio y el fin con sus fechas.

## Qué necesita Julián

- Una cuenta institucional para el reemplazo (de prueba: una cuenta que ya exista y no tenga puesto).
- **Un redespliegue de Apps Script:** hoy el Apps Script tiene una lista fija de «correo → puesto»
  y no conocería al reemplazo; además no sabe del solo lectura. Puede ir en el mismo
  redespliegue que la alerta académica, o antes si hay un reemplazo real próximo.
