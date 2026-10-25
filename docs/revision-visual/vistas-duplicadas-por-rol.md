# Vistas duplicadas, revisadas rol por rol (fuera de `src/asistencia`)

Solo lectura. Fecha: 2026-10-25. Complementa `vistas-duplicadas.md` (primera pasada). Las líneas pueden moverse si otra sesión edita esos archivos.

## Qué ve cada rol (resumen de condiciones)

| Rol | Menú (`App.tsx:52-73`) | Notas |
|---|---|---|
| Docente / director de grupo | Inicio, Agenda, Horario, Asistencia, Tareas, Manual, Riesgo, Reservas, Académico, Chat, Planes en casa, Notificaciones | Director de grupo no cambia el menú; cambia permisos dentro (AgendaGrupo, Tareas, Asistencia) |
| Coordinador | Todo lo anterior + Panel, Generar horario, Datos de la sede | `PanelAdmin` re-incrusta Horario y Casos |
| Rectora | Inicio, Asignación, Agenda, Horario, Asistencia, Tareas, Manual, Riesgo, **Mis reservas**, Académico, Chat, Planes, Notificaciones | No tiene Reservas |
| Superusuario | Inicio, Agenda, Horario, Asistencia, Manual, Riesgo, Académico, Chat, Usuarios, Sugerencias, Planes, Datos sede, Notificaciones | No ve Tareas ni Reservas |
| UAI / orientador | Igual que docente; en Planes en casa ve el panel si está en `leerEquipo()` (`VistaPlanCasa.tsx:19-27`) | |

## Casos nuevos (no estaban en la primera pasada)

| # | Pantalla · rol | archivo:línea | Forma 1 | Forma 2 | Decisión propuesta |
|---|---|---|---|---|---|
| N1 | Panel del coordinador · coordinador | `PanelAdmin.tsx:63-66, 125-126` y `App.tsx:469` | Pestaña «Horario del J» dentro de Panel | Entrada «Horario» del menú: la MISMA pantalla `VistaHorario` | **Dejar una sola forma**: quitar la pestaña del Panel (o que lleve al menú). Hoy hay dos rutas al mismo destino |
| N2 | Panel del coordinador / Riesgo · coordinador, rectora | `PanelAdmin.tsx:64, 123` y `GestionRiesgo.tsx:1226-1235, 1275` | Pestaña «Informes» en Panel = `TableroCasos` | Pestaña «Casos» en Gestión del Riesgo = el mismo `TableroCasos` | **Dejar una sola forma** en Riesgo; en Panel, quitar o enlazar |
| N3 | Panel de la rectora vs Mis reservas · rectora | `PanelRectora.tsx:9-51` y `MiHistorial.tsx:50` (menú «Mis reservas», `App.tsx:66`) | Lista «Panel Rectoría» = reservas con `solicitante === userId` | «Mis reservas» = la misma consulta y el mismo filtro con otra tarjeta | **Dejar una sola forma**: poner el historial dentro de «Asignación» (como Reservas hizo con docentes) y quitar la entrada suelta |
| N4 | Panel Admin · coordinador | `PanelAdmin.tsx:72-89, 114-136` | Pestañas Pendientes / Hoy / Historial: el mismo arreglo `reservasJornada` filtrado 3 veces | Más Reservas → «Mis reservas» (otra lista de reservas) | **Unificar con SelectorVista** de tiempo no aplica; mejor UNA lista con filtro (chips Pendientes/Hoy/Todas). Prioridad media |
| N5 | Panel Admin · coordinador | `PanelAdmin.tsx:70-89` (C1 de la 1.ª pasada) | Pastillas con `flex-wrap` (ya no desborda) | Menú del encabezado muestra «Panel» | No tocar el desborde (ya resuelto); falta solo coherencia de estilo con `Reservas.tsx:25` y `GestionRiesgo.tsx:1216` (tres estilos de pastilla para lo mismo) |
| N6 | Inicio y menú · todos | `PanelInicio.tsx:326` y `NavDropdown.tsx:30` | Dos `useVistaRecordada` con la MISMA clave `'inicio'` | Cada uno guarda su estado: cambiar en el menú abierto sobre Inicio NO cambia las baldosas hasta recargar (y viceversa) | **Corregir**: estado compartido (store o evento `storage`). Es incoherencia del SelectorVista ya puesto |
| N7 | Horario · todos | `VistaHorario.tsx:319, 605, 1250` | Tres `useState` planos para Día/Semana (inicios distintos: día, semana, semana) | En AgendaGrupo/AgendaSemanal/Reservas sí usan `useVistaRecordada` | **Unificar**: usar `useVistaRecordada` (la elección no se recuerda solo en Horario) y unificar el valor inicial |
| N8 | Gestión del Riesgo · docente, UAI | `GestionRiesgo.tsx:1317-1330` y `185-209` | «Tus brigadas» (tarjetas propias) | «Ver todas las brigadas de mi sede» (acordeón): repite a la persona y su brigada | No tocar (es consulta/acordeón); revisar solo que no se duplique el título |
| N9 | Gestión del Riesgo · coordinador, rectora, superusuario | `GestionRiesgo.tsx:116-181` | Brigadas por sede: pastillas de sede + tarjetas por brigada | Misma gente en «Tus brigadas» arriba | Dejar. Para sedes (6) pastillas están bien |
| N10 | Casos · coordinador, rectora, UAI | `TableroCasos.tsx:380-440` | Tarjetas (`TarjetaCaso`) una por caso | No hay lista compacta ni tabla, y hay 2 filas de filtros | **Colección grande sin conmutador**: `SelectorVista` tarjetas / lista. Prioridad media |
| N11 | Usuarios · superusuario | `PanelSuperusuario.tsx:268-296, 680-740, 760-790, 530-570` | «Ver como»: lista con buscador | Tabla de usuarios con `select` de rol; más `select` saliente/entrante del reemplazo y tabla de diagnóstico de puestos | **Unificar**: una sola lista de personas con buscador y acciones por fila (Ver como · rol · reemplazo). Prioridad media-alta (3 vistas de las mismas personas) |
| N12 | Chat · docente, todos | `Chat.tsx:278-300` y modal `Chat.tsx:~635 (modalDm)` | Pestaña «Docentes» (directorio) | Modal «Nuevo mensaje directo» con el mismo directorio | **Dejar una sola forma**: el botón «Nuevo mensaje» solo cambia a la pestaña Docentes |
| N13 | Académico · todos | `calendarioAcademico/CalendarioAcademico.tsx:116-120` | «Próximo / Lo que falta» (listas) | «Mes» (cuadrícula) | **Unificar con SelectorVista** «Ver: lista / mes» más la fila de filtros; hoy son 3 pastillas distintas de otra forma |
| N14 | Académico · todos | `calendarioAcademico/PanelAcademico.tsx:13-19` | Pastillas redondeadas «Calendario / Asignación» | Otro estilo de pastilla (aria-pressed, 36 px) frente a `Reservas.tsx` | Homogeneizar estilo (no es SelectorVista: son secciones) |
| N15 | Tareas · docente | `VistaTareas.tsx:954-967` | Pastillas `role=tab` «Publicar / Historial» (36 px) | «Mis tareas vigentes» (lista, 1442) y calendario del mes (1290) con la misma información | **Unificar**: una lista de tareas + «Ver: calendario / lista». Prioridad media |
| N16 | Tareas · coordinador, rectora | `VistaTareas.tsx:2106-2200` | Mapa de calor grupo × día | Lista `activas` (2196) de las mismas tareas | **SelectorVista** matriz / lista (el patrón exacto) |
| N17 | Tareas · docente | `VistaTareas.tsx:1106-1140` vs `1829-1845` | Elegir grupo con pastillas (publicar) | Elegir grupo con `select` (FormSolicitud) | Homogeneizar: pocas opciones → pastillas |
| N18 | Planes en casa · equipo UAI, coordinación | `VistaPlanCasa.tsx:34-44` | «Planes / Mis guías» (36 px, sin `aria-pressed`) | Pastillas de la 1.ª pasada (B5) | Ya registrado; mantener «no es SelectorVista» (son dos pantallas) y subir a 44 px |
| N19 | Simulacros (guía) · todos | `simulacros/GuiaSimulacro.tsx:373, 435, 723` | Rol con chips «Ver el guion como» | Rol con `select` en el paso a paso: elige lo mismo con dos controles | **Dejar una sola forma** (chips; el `select` solo si hay más de 4 roles) |
| N20 | Datos de la sede · coordinador, superusuario | `sedeDatos/SedeDatos.tsx:229-241` | Pastillas de sede + «Formulario / Ver respuestas» + «Modo prueba» en una sola fila | Todo con el mismo componente `Chip`: filtros, modo y interruptor mezclados | No es duplicado de información; separar visualmente (solo superusuario) |
| N21 | Números de emergencia · todos | `GestionRiesgo.tsx:347-368` | Chips de categoría (filtran) | Títulos de sección por categoría + buscador | No tocar |
| N22 | Sugerencias · superusuario | `PanelSugerencias.tsx:168, 193` | Dos filas de chips para filtrar | Mismos estados en `select` por tarjeta (278, 297) | No tocar (filtro ≠ edición) |

## SelectorVista ya puesto: coherencia por rol

| Pantalla | Docente | Director | Coordinador | Rectora | Superusuario | Observación |
|---|---|---|---|---|---|---|
| Inicio / menú (matriz-lista) | sí | sí | sí | sí | sí | N6: claves compartidas pero estados separados |
| Reservas (día/semana) | sí | sí | sí | no llega | no llega | Correcto por rol |
| Agenda semanal / de grupo | sí | sí (AgendaGrupo) | sí | sí | sí | Recuerdan |
| Horario (día/semana) | sí | sí | sí | sí | sí | N7: no recuerda y orden inicial distinto |
| PanelAdmin | n/a | n/a | **no lo usa** (pestañas sueltas) | n/a | n/a | La 1.ª pasada lo daba por migrado; no lo está. Ver N4/N5 |
| Tareas | sin | sin | sin | sin | n/a | N15/N16 sin conmutador |
| Riesgo / Casos | sin | sin | sin | sin | sin | N10 sin conmutador |

## Lista priorizada

1. **N6** Inicio/menú desincronizados (bug visible, arreglo pequeño).
2. **N1, N2, N3** Mismo destino por dos rutas (Horario, Casos, Reservas de rectora): dejar una.
3. **N11** Superusuario: tres vistas de las mismas personas.
4. **N16, N15** Tareas: matriz/lista y calendario/lista con SelectorVista.
5. **N13, N10** Calendario académico (lista/mes) y Casos (tarjetas/lista).
6. **N4, N12, N19** Una sola forma (filtro en Panel; DM de Chat; rol en simulacro).
7. **N7** Horario: usar `useVistaRecordada` y unificar el valor inicial.
8. **N5, N14, N17, N18, N20** Homogeneizar estilos (bajo riesgo).
9. No tocar: N8, N9, N21, N22.

Total: 22 casos nuevos (8 prioritarios para unificar o quitar una forma).
