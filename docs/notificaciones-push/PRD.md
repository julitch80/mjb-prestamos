# PRD — Notificaciones en el celular, aunque la aplicación esté cerrada

Estado: APROBADO por Julián el 24-sep-2026.

## Problema
Hoy los avisos de la aplicación solo aparecen si la aplicación está abierta, y los
mensajes del chat no avisan nada. Quien no entra, no se entera: un mensaje del chat o
un cambio de horario puede pasar desapercibido todo el día. No hay señal en el ícono
de que haya algo pendiente.

## Qué hace
1. La primera vez que una persona entra, la aplicación le ofrece activar las
   notificaciones («¿Quieres que te avise en el celular…?»). Nunca lo pregunta sin
   explicar para qué; si dice que no, no se vuelve a insistir en cada entrada.
2. Con las notificaciones activas, le llegan al celular **aunque la aplicación esté
   cerrada**, como las de cualquier otra aplicación.
3. El ícono de la aplicación muestra que hay algo pendiente: un punto en Android (o el
   número, según la marca del celular) y el número en iPhone. Desaparece al leerlo.
4. Tocar la notificación abre la aplicación **en el lugar correspondiente** (el chat,
   el aviso, el caso).
5. Pantalla **«Mis notificaciones»** con un interruptor por tipo; cada persona elige
   qué le llega. Por defecto, todo encendido excepto lo que se indique abajo.
6. Funciona en varios dispositivos de la misma persona (celular y computador).

### Tipos (propuesta, a confirmar en D1)
| Tipo | Quién lo recibe | Encendido por defecto |
|---|---|---|
| Mensajes del chat | Miembros del canal | Sí |
| Avisos de coordinación y rectoría | Destinatarios | Sí |
| Cambios en mi horario | Docente afectado | Sí |
| Mis reservas (aprobada, rechazada, cancelada) | Quien reservó | Sí |
| Solicitudes de reserva pendientes | Coordinación | Sí |
| Casos de permanencia (nuevos, vencidos, remitidos) | Coordinación, rectora, director remitido | Sí |
| Posible evasión | Coordinación | Sí |
| Respuesta a mi sugerencia | Autor | Sí |

## Qué NO hace
- **No muestra datos de menores en la pantalla bloqueada.** Las notificaciones de
  casos, evasión y permanencia dicen algo genérico («Hay una novedad en un caso de
  11.2») y el detalle solo se ve al abrir la aplicación con sesión.
- No envía correos ni mensajes de texto: solo notificaciones de la aplicación.
- No notifica a estudiantes ni familias (ellos no tienen cuenta).
- No se activa en dispositivos compartidos por decisión de la persona: la aplicación
  advierte al ofrecerlo que no lo haga en un equipo de uso común (p. ej. la pizarra).
- No reemplaza el aviso de cambios dentro de la aplicación: ese sigue igual.

## Criterios de aceptación (observables)
- A1. Julián activa las notificaciones en su celular Android, cierra la aplicación, y
  un mensaje que le escriben en el chat le llega como notificación en menos de un minuto.
- A2. El ícono muestra el punto (o número) mientras ese mensaje no se ha leído, y
  desaparece al leerlo.
- A3. Tocar la notificación abre la aplicación en ese chat.
- A4. Julián apaga «Mensajes del chat» en «Mis notificaciones»: el siguiente mensaje
  ya no le llega al celular (sí sigue apareciendo dentro de la aplicación).
- A5. Una notificación de caso de permanencia en la pantalla bloqueada no muestra el
  nombre de ningún estudiante.
- A6. En un iPhone con la aplicación en la pantalla de inicio (iOS 16.4+) llegan las
  notificaciones y el número del ícono.

## Etapas
- **Etapa 1** (1–2 días): base de notificaciones, chat, avisos de coordinación y
  rectoría, cambios de horario, respuesta a sugerencia, ícono, pantalla de preferencias.
- **Etapa 2** (~1 día): reservas, casos de permanencia, posible evasión.

## Costo
El servicio de notificaciones de Firebase es gratuito. Las funciones que las disparan
caben en el cupo gratis con el uso del colegio.

## Decisiones de Julián (24-sep-2026)
- D1. APROBADA la lista de tipos; todos encendidos por defecto.
- D2. APROBADO el silencio nocturno: nada entre 9:00 p. m. y 5:30 a. m.; lo que llegue
  en ese lapso se entrega a las 5:30 a. m.
- D3. Lo sensible (casos, evasión, permanencia) dice SOLO el grupo: «Hay una novedad
  en un caso de 11.2». Nunca el nombre del estudiante.
