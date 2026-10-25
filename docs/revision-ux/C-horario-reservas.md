# Lote C — Horario, Reservas, Coordinación, Rectora

Revisión de solo lectura (25-oct-2026). Evidencia: código fuente; no se probó en navegador.
Rutas relativas a `src/components/`. Escala: beneficio alto/medio/bajo · costo S (horas) / M (1-2 días) / L (más).

Nota previa: `EditorHorario.tsx` y `AsistenteAusencia.tsx` son cascarones de 10 líneas ("En construcción").
El editor real de ausencias vive en `EditorHorarioWizard.tsx` (4 pasos) y `EditorHorarioMode.tsx`
(arrastrar bloques), abiertos desde el botón "Editar" de `VistaHorario.tsx`. Se revisó lo real.
CLAUDE.md está desactualizado en ese punto (sigue diciendo "incompleto").

---

## 1. Tareas por rol y su recorrido actual

### Docente — "ver mi horario de hoy"
1. Menú → Horario del J. Abre en modo "Por docente" con el docente ya elegido (`VistaHorario.tsx:1247`). Bien: 0 decisiones.
2. Aparece la vista **Semana** (tabla de 5 días), no la de hoy (`:312`, `:314`).
3. Para ver solo hoy: tocar "Día" (`:326`), y la vista de día arranca en **lunes** (`:316`), no en el día actual. Hay que tocar el día correcto.
   **Total: 3-4 toques** para algo que debería ser 0. Es la tarea más frecuente de todo el módulo.

### Docente — reservar un aula
1. Menú → Disponibilidad. 2. Elegir pestaña (Aulas / Otros espacios / Equipos). 3. Desplazarse a un lado hasta el día (la tabla mide ~1.320 px; `DisponibilidadGrid.tsx:163`). 4. Tocar una celda verde de 32 px de alto. 5. Elegir propósito. 6. (Opcional) marcar equipos. 7. "Solicitar".
**Total: 5-7 toques + desplazamiento lateral.** Después no hay aviso visible de si la aprobaron, salvo notificaciones.

### Docente — saber el estado de su reserva
Menú → Mis reservas (`MiHistorial.tsx`). Lista sin orden explícito, sin botón de cancelar, fecha y hora cruda al pie.

### Coordinación — aprobar reservas
1. Menú → Panel (pestaña Pendientes ya abierta, con globito rojo con el número) (`PanelAdmin.tsx:51-56`). 2. Tocar Aprobar o Rechazar en cada tarjeta.
**Total: 1 toque por solicitud. Muy bueno** salvo los problemas de abajo (id en vez de nombre, fallos mudos, rechazo sin motivo).

### Coordinación — editar el día por ausencia
Menú → Panel → pestaña "Horario del J" → (modo Por docente) → botón "Editar" (solo si está en su jornada, `VistaHorario.tsx:1320`) → asistente de 4 pasos (fecha, ausentes, bloques, apoyos) → editor de arrastrar → Guardar → resumen/correo. **~8-12 toques**; razonable para la complejidad, pero el editor es pesado en celular (ver hallazgos 8-9).

### Rectora — asignar un espacio
Dos caminos: (a) "+ Asignación directa" en su panel: formulario de 5 campos (espacio, fecha, bloque, motivo, y "Otro" opcional) + Asignar = 6-7 toques; (b) tocar una celda en Disponibilidad: abre el mismo formulario prellenado = 3 toques (motivo + Asignar). El camino (b) es mejor pero nada en pantalla avisa que existe.

### Coordinación — generar horario del año
Menú → Generar horario → elegir sede/jornada → descargar archivo → ir a un computador y ejecutar el `.bat` → volver y subir el archivo (`horarios/PanelHorarios.tsx:447-503`). Es un flujo de escritorio por naturaleza; ver hallazgo 12.

---

## 2. Hallazgos

Formato: **qué estorba · dónde · principio · sugerencia · beneficio · costo**

### H1. "Mi horario de hoy" no abre en hoy
- Qué estorba: el docente entra y ve la semana completa; si toca "Día", empieza en lunes aunque sea jueves.
- Dónde: `VistaHorario.tsx:314` (vista por defecto "semana") y `:316` (`useState('lunes')`); igual en `:602` (grupo) y `:1250` (resumen).
- Principio: reconocimiento antes que memoria / eficiencia de uso. La tarea más frecuente cuesta 3-4 toques.
- Sugerencia: para el docente (y el director de grupo), abrir en vista Día con el día actual (si es fin de semana, lunes); la semana a un toque. Marcar la columna de hoy en la tabla semanal.
- Beneficio: **alto** · Costo: **S**. Nota: archivo del módulo de horarios; pedirlo a esa sesión.

### H2. La cuadrícula de reservas obliga a desplazarse a un lado y las celdas son pequeñas
- Qué estorba: 5 días × 6 bloques = 30 columnas de 44 px (~1.320 px; 1.584 con sábado) en un celular de 360-400 px. Celdas de 32 px de alto (`h-8`), texto de 9-10 px en cabeceras. El nombre del espacio queda fijo (bien) pero se pierde el contexto del día al desplazarse. Al abrir no se posiciona en hoy.
- Dónde: `DisponibilidadGrid.tsx:163-165`, `:179-183`, `:226` (`h-8`).
- Principio: celular primero (≥ 44 px de toque, ≥ 12 px de texto); visibilidad del estado.
- Sugerencia: en celular, mostrar un solo día a la vez con selector de día (como ya hace el editor de acompañamientos, ver H11) y un espacio por tarjeta con los 6 bloques como botones de 44 px. Dejar la tabla semanal solo en pantalla ancha.
- Beneficio: **alto** · Costo: **M**.

### H3. Tocar una celda "ocupada" o "clase regular" no hace nada ni explica
- Qué estorba: para el docente solo `libre` y `propio` responden (`puedeReservar`); una celda roja o gris no dice quién la tiene ni por qué no se puede. El `title` (tooltip) no existe en celular.
- Dónde: `DisponibilidadGrid.tsx:218-224`.
- Principio: visibilidad del estado / ayudar a entender errores.
- Sugerencia: al tocar una celda no reservable, mostrar una línea corta ("Clase de 9.2 – Física" o "Reservada por Marta, pendiente"). Para "propio", ofrecer cancelar. Para el docente que quiere el aula ocupada, la línea ya le ahorra preguntar.
- Beneficio: **medio** · Costo: **S**.

### H4. Las tarjetas del panel de coordinación muestran códigos internos y datos crudos
- Qué estorba: "Solicitante: mjb_garcia" (id, no nombre), "Bloque 3" sin hora, recurso por id, fecha en formato `2026-10-25`; en Mis reservas y Rectora, el pie muestra `2026-10-25T14:03:22.000Z` crudo.
- Dónde: `PanelAdmin.tsx:179-182` (`reserva.recurso`, `reserva.solicitante`), `MiHistorial.tsx:70`, `PanelRectora.tsx:48`.
- Principio: lenguaje del usuario (Nielsen 2).
- Sugerencia: resolver nombre del docente (`getUsuario`), nombre del espacio (`RECURSOS`), "jueves 29 oct · 3.ª hora (8:10-9:05)" y fecha legible de la solicitud. `PanelConfirmacion.tsx:52-55` ya tiene ese formato: reutilizarlo.
- Beneficio: **alto** (coordinación decide con esa información) · Costo: **S**.

### H5. Aprobar/Rechazar falla en silencio y el rechazo no lleva motivo
- Qué estorba: si la red falla, `catch { // silencioso }`: la tarjeta sigue ahí y el coordinador no sabe si funcionó. Rechazar es un toque sin confirmar ni motivo; el docente solo ve "Rechazada" sin saber por qué. Tampoco se evita el doble toque durante el envío.
- Dónde: `PanelAdmin.tsx:42-49` y botones `:186-199`.
- Principio: prevención de errores, ayudar a reconocer y recuperarse de errores, comunicación de estado.
- Sugerencia: mostrar aviso de error ("No se pudo guardar, reintenta"), deshabilitar el botón mientras envía, y al rechazar pedir un motivo corto opcional con opciones rápidas ("Aula ocupada", "Mantenimiento", "Otro") que llegue al docente.
- Beneficio: **alto** · Costo: **S-M** (el motivo requiere un campo en el backend).

### H6. Botones y textos por debajo del mínimo táctil en pantallas de reservas
- Qué estorba: botones de cerrar "✕" sin área (`text-lg leading-none` sin padding) en `PanelConfirmacion.tsx:101-106` y `PopupRectora.tsx:70`; botones Rechazar/Aprobar de `py-2` ≈ 36 px (`PanelAdmin.tsx:189,195`); botones de equipos `py-2 text-xs` con casilla de 14 px; flechas de semana `py-1.5` (≈ 32 px) y "Hoy" `text-xs` (`DisponibilidadGrid.tsx:305-336`); selector "Bloque" en rectora con `py-2`.
- Principio: celular primero, ley de Fitts.
- Sugerencia: mínimo `min-h-[44px]` en todos los botones de acción y de cerrar, texto ≥ 12 px (usar `text-sm` en las etiquetas de equipos).
- Beneficio: **medio-alto** · Costo: **S**.

### H7. El formulario de reserva no muestra qué pasa después ni evita dobles
- Qué estorba: al "Solicitar" se cierra sin confirmación visible (solo `onCerrar()`); no hay mensaje "Enviada, la coordinación la revisará". El docente no sabe si quedó pendiente. Tampoco hay forma de cancelar una reserva propia desde Mis reservas (solo existe el estado "cancelada" en la lista).
- Dónde: `PanelConfirmacion.tsx:71-83`; `MiHistorial.tsx` (sin acciones).
- Principio: visibilidad del estado; control y libertad del usuario.
- Sugerencia: aviso breve (toast) "Solicitud enviada, queda pendiente" y botón "Cancelar" en las reservas pendientes/aprobadas futuras de Mis reservas.
- Beneficio: **medio** · Costo: **S** (aviso) / **M** (cancelar, requiere acción en backend).

### H8. El editor de ausencias usa controles minúsculos en celular
- Qué estorba: los botones de las fichas arrastrables ("pendiente" naranja y "quitar" rojo) miden `w-4 h-4` = 16 px, a -6 px fuera de la ficha; textos de 8-10 px en el cajoncito y en las etiquetas "Apoyos disponibles/Acompañantes". Tocar sin equivocarse en 16 px es casi imposible con el dedo. El borrado de una modificación en el banner tiene `p-0.5` (≈ 20 px).
- Dónde: `EditorHorarioMode.tsx:248,257,267,274,286,963-992`; `VistaHorario.tsx:1360-1375`.
- Principio: celular primero; prevención de errores. (El arrastre sí tiene `TouchSensor` y `touchAction: none` en las fichas, `:7-14,:210`, lo cual es acertado.)
- Sugerencia: áreas táctiles invisibles de 44 px alrededor de los botones pequeños (padding o pseudoelemento), y alternativa "tocar ficha, tocar destino" para quien no logre arrastrar (ya existe en acompañamientos).
- Beneficio: **medio** · Costo: **M**. (Lo mantiene la sesión de horarios.)

### H9. Errores del editor tragados
- Qué estorba: el envío automático de notificaciones/correo termina con `catch { // Silencioso }` (`EditorHorarioMode.tsx:860-862`); si falla, el coordinador ve el guardado exitoso y cree que avisó a todos. Solo se rescata con el botón manual si lo recuerda.
- Dónde: `EditorHorarioMode.tsx:857-862`.
- Principio: visibilidad del estado; ayudar a recuperarse de errores.
- Sugerencia: si el aviso falla, mostrar mensaje persistente "Se guardó, pero NO se avisó a los docentes. Reintentar" con el botón a la vista.
- Beneficio: **alto** (afecta a ~30 personas que no sabrán de un cambio) · Costo: **S**.

### H10. Pestañas de coordinación: seis, con scroll lateral, y la más usada compite con "Informes"
- Qué estorba: Pendientes · Hoy · Historial · Informes · Horario del J · Configuración en una fila desplazable (`overflow-x-auto`, `PanelAdmin.tsx:63`); en 360 px solo caben ~3. "Historial" lista todas las reservas sin filtrar ni límite; "Hoy" y "Historial" repiten la misma tarjeta.
- Dónde: `PanelAdmin.tsx:57-86,126-136`.
- Principio: reconocimiento, minimalismo.
- Sugerencia: dejar visibles Pendientes/Hoy/Historial y mandar Informes y Configuración a un menú "Más"; ordenar el historial por fecha descendente con las últimas 30 y "Ver más"; el tema de la interfaz ya está en el encabezado de la app (duplicado en Configuración).
- Beneficio: **medio** · Costo: **S-M**.

### H11. Acompañamientos: bien resuelto en celular, con detalles
- Lo bueno: el editor manual tiene vista por día para móvil (`EditorManualAcompanamientos.tsx:473-555`), tabla semanal como alternativa y confirmación antes de cancelar publicaciones (`HistorialAcompanamientos.tsx:185`). Publicar valida la fecha y explica la causa de lo deshabilitado (`PublicarAcompanamientos.tsx:82`).
- Qué estorba: botones de candado y quitar de 11 px sin zona táctil (`:155-173`); etiquetas de estado en `text-[10px]`; un solo botón "✎ Editar" `text-xs py-1.5` (`VistaHorario.tsx:1520`) para toda la edición.
- Sugerencia: ampliar zonas táctiles (mismo arreglo de H6/H8). Patrón día-a-día sería el modelo para H2.
- Beneficio: **bajo-medio** · Costo: **S**.

### H12. Generar horario exige un computador y no lo anuncia al entrar
- Qué estorba: el paso 2 es "doble clic en `generar_horario.bat` en el computador donde está el proyecto Horarios" (`PanelHorarios.tsx:472-479`). Desde un celular, el coordinador llega a los pasos 1 y 3 sin saber que depende de otra máquina; el paso 3 es una carga de archivo `.json` desde el celular (difícil de encontrar).
- Principio: visibilidad del estado; ayuda y documentación.
- Sugerencia: encabezado fijo "Este proceso se hace desde el computador" con una lista de los 3 pasos y un indicador de en cuál va. Acceso a coordinación y superusuario solo (ya está, `App.tsx:455`). La interfaz de pasos con numeración (`Paso numero=`) es buena.
- Beneficio: **bajo** (uso esporádico) · Costo: **S**.

### H13. Rectora: formulario poco informado y sin aviso de choque
- Qué estorba: CLAUDE.md promete "Aviso de conflicto si el espacio está ocupado", pero `PopupRectora.tsx` no consulta reservas ni horario base: si abre desde "Asignación directa" en su panel puede asignar un espacio con clase regular sin ninguna advertencia. El selector de bloque dice "Bloque 1..6" sin horas (la rectora no ve en cuál jornada), lista todos los espacios sin filtrar por tipo, y fecha por defecto hoy.
- Dónde: `PopupRectora.tsx:20-25,95-130`; `PanelRectora.tsx:26-31`.
- Principio: prevención de errores.
- Sugerencia: reutilizar `getOcupante` de `DisponibilidadGrid.tsx:35` para avisar "En ese bloque está la clase de X" y llevar al flujo de desplazamiento (ya existe `ModalDesplazamientoRectora`); mostrar hora junto al bloque ("3.ª hora · 8:10"). Rotular en el panel: "También puedes tocar una celda en Disponibilidad".
- Beneficio: **medio-alto** · Costo: **M**.

### H14. Historial de la rectora y Mis reservas: sin orden ni filtro
- Qué estorba: la lista se muestra tal como llega del servidor; sin título "próximas / pasadas", sin conteo, y repite en la tarjeta un "Directa" amarillo que no cambia nunca.
- Dónde: `PanelRectora.tsx:40-55`, `MiHistorial.tsx:46-79`.
- Sugerencia: orden descendente por fecha de uso, separar "Próximas" de "Pasadas" (las pasadas colapsadas).
- Beneficio: **bajo-medio** · Costo: **S**.

### H15. Consistencia entre módulos
- Cerrar ventana: "✕" en `PanelConfirmacion` y `PopupRectora`, "Cancelar" a pie en ambos (bien); el modal de modificaciones usa `aria-label="Cerrar"` (`VistaHorario.tsx:1901`), los demás no tienen etiqueta para lectores de pantalla.
- Estados vacíos: "No hay solicitudes pendientes." (texto gris sencillo) frente a "No tienes reservas registradas" con emoji; mensajes de carga distintos ("Cargando...", "Cargando reservas...", "Cargando historial...").
- Colores de estado: `text-yellow-400` y `bg-yellow-600` directos en `PanelAdmin/PanelRectora/PopupRectora` en lugar de los tokens semánticos (`text-warning`) usados en el resto. En tema claro el amarillo 400 sobre blanco apenas se lee.
- Sugerencia: unificar con los tokens existentes y un mismo componente de "estado vacío/cargando".
- Beneficio: **bajo-medio** · Costo: **S**.

### H16. Tablas de horario con letra de 8-9 px
- Qué estorba: celdas de Vista Docente/Grupo/Aulas con aula y grado en `text-[9px]`, `text-[8px]` (`VistaHorario.tsx:422,980,1208`), minWidth 860 con columnas de 42 px (`:885,1114`). Las vistas de día (banners) son más legibles y es lo que usa el docente, pero el resumen que ven rectoría y coordinación es ilegible en celular sin acercar.
- Sugerencia: en pantallas estrechas, que "Día" sea la vista por defecto en los resúmenes, y subir el mínimo a 11-12 px en la vista semanal individual (`:312-430`), donde la tabla ya mide solo 400 px.
- Beneficio: **medio** · Costo: **S-M**.

---

## 3. Lo que ya funciona bien (no tocar)
- Docente abre su horario ya identificado (cero búsqueda).
- Coordinación aprueba con un toque y la lista se filtra por su jornada; la regla "ver una reserva de más antes que perder una" está bien razonada (`PanelAdmin.tsx:26-33`).
- Los botones de editar/eliminar solo aparecen donde el rol puede usarlos (menos ruido y menos errores).
- Confirmación al descartar borrador y al eliminar modificaciones; validación por paso en el asistente (`EditorHorarioWizard.tsx:205-211`).
- Arrastre con soporte táctil (`TouchSensor`) en el editor; vista por día en celular en Acompañamientos.
- Traducción de errores del servidor a español (`PanelConfirmacion.tsx:19-29`).

---

## 4. Top 5 por beneficio ÷ costo

1. **H1** Abrir "mi horario" en el día de hoy para el docente (beneficio alto, costo S). Es la tarea que más veces se hace.
2. **H4** Nombres, horas y fechas legibles en las tarjetas de coordinación, Mis reservas y Rectora (alto, S).
3. **H9 + H5** No tragarse errores: avisar si falló el aviso a docentes tras guardar un cambio y si falló aprobar/rechazar; deshabilitar botones durante el envío (alto, S).
4. **H6** Subir todos los botones de acción y cerrar a 44 px y el texto a 12 px en reservas y paneles (medio-alto, S).
5. **H2** Disponibilidad por día en celular, en lugar de una tabla de 1.320 px (alto, M). Es la mejora más grande pero también la más costosa; seguirla con H3 (explicar por qué una celda no se puede reservar, S).
