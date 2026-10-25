# Resumen consolidado — Revisión de flujo y diseño (25-oct-2026)

Fuente: informes A–E de esta carpeta. Revisión hecha leyendo el código, sin probar en el
navegador con sesión real: cada punto se confirma al construirlo.

## Tres problemas que se repiten en toda la plataforma
1. **Botones pequeños para el dedo** (28–36 px; lo recomendado es 44 px) y letra de 10–11 px.
   Aparece en los 5 informes. Un ajuste común (botones, pastillas, pestañas) lo corrige casi todo.
2. **Acciones que borran o envían sin confirmar ni deshacer** (cancelar tarea —borra también en
   Classroom—, borrar en chat, cerrar sesión).
3. **Errores que se esconden** (aprobar/rechazar reservas, avisos tras guardar el horario): el
   usuario cree que quedó hecho y no.

## Las 15 mejoras de mayor impacto (beneficio ÷ costo)
| # | Mejora | Módulo | Costo | Quién |
|---|---|---|---|---|
| 1 | Riesgo abre en «Emergencia escolar», botón rojo fijo «Llamar al 123» | Riesgo | S | esta sesión |
| 2 | Botones y pestañas a 44 px y letra mínima de 12 px (componente común) | Todos | S | ambas sesiones |
| 3 | La campana y «N notificaciones nuevas» llevan a Reservas, no a los avisos | Navegación | S | esta |
| 4 | «Mi horario» del docente abre en el día de hoy (hoy abre en Semana/lunes) | Horario | S | sesión horarios |
| 5 | «Cancelar tarea» con confirmación (y aviso de que borra en Classroom) | Tareas | S | esta |
| 6 | Mostrar los errores al aprobar/rechazar y al avisar cambios de horario | Reservas/Horario | S | esta / horarios |
| 7 | Nombres, horas y fechas legibles en Panel, Mis reservas y Rectora (hoy salen códigos) | Reservas | S | esta |
| 8 | Botón visible «Todos presentes» y tocar solo a los ausentes | Asistencia | S/M | asistencia |
| 9 | Barra fija «Marcados N de M · Entregar» en la alerta del docente | Asistencia | S | asistencia |
| 10 | Inicio usa la misma matriz del menú (hoy un carrusel que esconde opciones) | Inicio | M | esta |
| 11 | Tema claro: textos blancos fijos y login que no respeta el tema del teléfono | General | S | esta |
| 12 | Casos de Riesgo: buscador por estudiante y abrir en «Casos» si hay vencidos | Riesgo | S | esta |
| 13 | Alerta de coordinación: primero el avance por grupo, lo demás plegado | Asistencia | M | asistencia |
| 14 | Reservas en el celular por día, no tabla de 1.320 px; decir por qué una celda no se puede | Reservas | M | esta |
| 15 | «Nuevo plan» en casa en 3 pasos, con el error junto al campo | Planes en casa | M | esta |

## Más grandes (para después)
- Agrupar las 9 pestañas de Asistencia en 3 por tarea.
- Panel de Usuarios en pestañas, con el alta primero y el «Puesto» como lista.
- Sugerencias en el menú, con la pantalla desde donde se escribió.

## Corrección de documentación
CLAUDE.md señala `EditorHorario.tsx` y `AsistenteAusencia.tsx` como incompletos: hoy son
envoltorios; el editor real está en `EditorHorarioWizard.tsx` y `EditorHorarioMode.tsx`.
