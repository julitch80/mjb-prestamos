# Lote E — Gestión del Riesgo y Simulacros, Manual de convivencia, Datos de la sede, Usuarios, Sugerencias

Revisión de solo lectura (25-oct-2026). Evidencia: código en `src/components/`. No se probó en el navegador.
Rutas abreviadas: `GR` = `GestionRiesgo.tsx`, `TC` = `TableroCasos.tsx`, `PS` = `PanelSuperusuario.tsx`.

## Veredicto general

- **Lo mejor:** la guía del simulacro (`simulacros/GuiaSimulacro.css`) y el formulario de Datos de la sede
  (`sedeDatos/`) están pensados para celular: botones de 44 a 62 px, letra de 14 a 19 px, autoguardado,
  barra de avance. Son el modelo a copiar.
- **Lo más grave:** la pantalla de emergencia no pone lo urgente primero. Un docente en una emergencia real
  aterriza en una pestaña de brigadas (a veces bloqueada con candado) y debe dar 4 a 5 toques para ver el
  botón de llamar al 123.
- **Patrón repetido:** casi todas las pastillas y botones pequeños del lote miden unos 28 a 30 px de alto
  y 12 px de letra (`px-3 py-1.5 text-xs`). Sirven con mouse, pero fallan con el dedo y con prisa.

---

## 1. Tareas por rol y recorrido actual

### Docente

| Tarea | Recorrido actual | Toques |
|---|---|---|
| Atender un estudiante lesionado | Menú → Gestión del Riesgo (abre en «Brigadas») → pestaña «Emergencia escolar» → tarjeta «Primeros auxilios» → Fase 1 → «Siguiente fase» hasta la fase con el botón de llamada | 4 a 6 |
| Llamar al 123 | Igual que arriba, hasta la fase que trae `llamadas` (GR:935-950). En la pestaña «Números» sale 📞 pero mezclado con ~30 entidades | 4 a 6 |
| Ayudar a un estudiante en crisis emocional | Menú → Riesgo → «Emergencia escolar» → «Contención emocional» → fases → «Generar informe» | 5 a 7 |
| Consultar el manual de convivencia | Menú → Manual → tarjeta (4 a 6 opciones) → carga el visor | 3 |
| Ver qué hacer en el simulacro | Menú → Riesgo → pestaña «Simulacros» → tarjeta del simulacro → elegir rol → guía | 4 a 5 |
| Enviar una sugerencia | Bajar hasta el pie de la página → «💡 Enviar sugerencia» → escribir → Enviar | 3 + desplazarse |

### Coordinación

| Tarea | Recorrido actual | Toques |
|---|---|---|
| Atender un caso que lleva días sin seguimiento | Menú (insignia roja en «Gestión del Riesgo») → abre en «Brigadas», no en «Casos» → pestaña «Casos» → tarjeta → «+ Agregar seguimiento» → escribir → Guardar | 5 |
| Confirmar datos de la sede | Tarjeta en Inicio (`TarjetaDatosSede.tsx:42`) o menú → Datos de la sede → tema por tema («Está bien», «Corregir», «Después») → Enviar | 1 + ~10 temas |

### Superusuario

| Tarea | Recorrido actual |
|---|---|
| Dar de alta un usuario | Menú → Usuarios → bajar pasando «Ver como», «Sincronizar permisos», «Cuentas de acceso» y el diagnóstico (unos 4 bloques largos) → «Nuevo usuario» (PS:586). Correo, nombre, rol, puesto, sede, jornada → Crear. Luego, a veces, «Crear y reparar cuentas» |
| Ver como otro usuario | Menú → Usuarios → buscar → «Ver como» (primer bloque, bien ubicado) → Salir en la barra amarilla |
| Revisar sugerencias | Menú → Sugerencias → filtros → por cada tarjeta: clasificar, estado, nota, avisar |

---

## 2. Hallazgos

Formato: **qué estorba · dónde · principio · sugerencia · beneficio / costo**.

### Gestión del Riesgo y Emergencia

**E1. La emergencia no está primero.**
- Qué estorba: la pestaña por defecto es «Brigadas» (GR:1168) y «Emergencia escolar» es la tercera de cinco
  pastillas. Para un docente, «Brigadas» muestra además un candado «en revisión» (GR:1259) mientras las brigadas
  no estén publicadas. En una emergencia, lo primero que ve es un cartel de «no disponible».
- Principio: reconocer antes que recordar; ajustar el sistema a la urgencia (Nielsen 2, 7). Velocidad crítica.
- Sugerencia: abrir en «Emergencia escolar» y ponerla primera, con color de alerta. Mover «Brigadas» al final.
- Beneficio: **alto** · Costo: **S**

**E2. No hay un botón de «Llamar al 123» a la vista desde el inicio.**
- Qué estorba: el botón de llamada vive dentro de la fase correspondiente del paso a paso (GR:935-950); el menú
  de emergencia (GR:868-917) solo trae un aviso de texto con el 123 (GR:873), que no se puede tocar.
- Principio: control y eficiencia de uso; minimizar pasos en urgencias.
- Sugerencia: botón rojo grande, fijo, «📞 Llamar al 123» en la parte superior del menú de emergencia (y del
  tab de Riesgo). El texto del aviso pasaría a ser un enlace `tel:123`.
- Beneficio: **alto** · Costo: **S**

**E3. El menú de emergencia mezcla situaciones urgentes con herramientas de consulta.**
- Qué estorba: seis tarjetas del mismo peso (GR:881-916): primeros auxilios, contención, accidente laboral,
  protocolo completo, botiquín digital, guía. «Protocolo completo (para leer con calma)» y «Botiquín digital»
  compiten con lo que se necesita ya.
- Principio: jerarquía visual; reducir la carga de decisión (Nielsen 6, 8).
- Sugerencia: dos tarjetas grandes arriba («Lesión / malestar físico» y «Crisis emocional»), después «Accidente
  laboral», y bajo un título «Para consultar con calma» el resto, más pequeño.
- Beneficio: **alto** · Costo: **S**

**E4. Los pasos de las fases tienen mucho texto y se avanza uno por uno.**
- Qué estorba: cada fase tiene título de 24 px, subtítulo y 2 o más bloques de texto (GR:1000-1030), y el único
  modo es «Siguiente fase →». No hay un índice para saltar a «Llamar» o «Trasladar».
- Principio: flexibilidad y eficiencia (Nielsen 7).
- Sugerencia: una fila de números 1, 2, 3… tocables encima de la fase actual (como las que ya usa la guía de
  simulacro, `GuiaSimulacro.tsx:729`) para saltar sin recorrer todo.
- Beneficio: medio · Costo: **S**

**E5. El aviso «En pruebas» ocupa el primer lugar y suena a «no confíes».**
- Qué estorba: el cuadro ámbar (GR:871-876) y la insignia BETA (GR:1224) restan confianza justo cuando se
  necesita actuar. El texto dice «hazle caso a la línea, no a la aplicación».
- Principio: prevención de errores sin generar duda paralizante.
- Sugerencia: reducir a una línea al final del menú; dejar arriba solo el botón del 123 (E2). Mantener el
  aviso de fondo, pero que no sea lo primero que lea el docente.
- Beneficio: medio · Costo: **S**

**E6. Pastillas, botones «Volver» y enlaces de llamada demasiado pequeños para el dedo.**
- Qué estorba: pestañas del módulo `px-3 py-1.5 text-xs` (GR:1199-1255, ~28 px); `BotonVolver` `py-2 text-xs`
  (GR:840-848, ~34 px); teléfonos del directorio `text-xs px-2.5 py-1` (GR:290-298, ~26 px) — son justo los
  que se tocan para llamar; telefono pendiente `text-[11px]` (GR:932).
- Principio: tamaño mínimo táctil 44 px, texto ≥ 12 px (el plan del proyecto).
- Sugerencia: subir los botones de llamada a `min-h-[44px] text-sm` y las pestañas a `min-h-[40px]`; mismo
  ajuste en filtros de Casos (TC:87-99) y Brigadas por sede (GR:125-137).
- Beneficio: **alto** · Costo: **S**

**E7. Directorio de números sin los de uso inmediato arriba.**
- Qué estorba: GR:307-380 lista todas las entidades por categoría; el buscador exige escribir en el celular.
- Principio: reconocer antes que recordar; mostrar lo más usado primero.
- Sugerencia: bloque fijo «Los 4 más usados» (123, policía, bomberos, línea de salud mental) con botón de
  llamar, y el resto debajo, plegado por categoría.
- Beneficio: medio · Costo: **S**

**E8. Casos: la lista no se puede buscar por nombre y la pestaña no abre sola para quien la necesita.**
- Qué estorba: TC:350-361 solo filtra por tipo y estado, sin buscador por estudiante ni grado; la insignia roja
  del menú (App.tsx:311) lleva a «Brigadas», no a «Casos» (GR:1168).
- Principio: coherencia entre aviso y destino; flexibilidad de búsqueda.
- Sugerencia: (a) si hay casos vencidos y el usuario es coordinación/rectoría, abrir en «Casos»; (b) añadir un
  campo «Buscar estudiante o grado».
- Beneficio: **alto** · Costo: **S**

**E9. Seguimiento de caso: controles pequeños en un formulario sensible.**
- Qué estorba: «Cancelar» arriba y abajo duplicado (SeguimientoCaso.tsx:102,167); radios nativos con texto
  `text-sm` (SC:127-157), campo de fecha con `py-1.5` y sangrado `ml-6`; botón «Dictar» `text-[11px]` (SC:109).
  No hay confirmación al «Cerrar el caso», que es un cambio importante.
- Principio: prevención de errores (Nielsen 5) y tamaño táctil.
- Sugerencia: opciones «Programar próximo seguimiento» / «Cerrar el caso» como dos botones grandes tipo
  selector; avisar «¿Cerrar el caso de X?» antes de guardar; quitar el Cancelar duplicado de arriba.
- Beneficio: medio · Costo: **S**

**E10. Etiquetas de estado y alerta demasiado pequeñas.**
- Qué estorba: pastillas `text-[10px]` y fechas `text-[11px]` en tarjetas de casos (TC:102,113,141,145,165-171).
  Es justo la información de «cuántos días sin seguimiento».
- Principio: legibilidad (mínimo 12 px).
- Sugerencia: subir a 12 px; mostrar los «días sin seguimiento» como el dato más grande de la tarjeta.
- Beneficio: medio · Costo: **S**

**E11. Control de publicación de brigadas escondido y con un nombre ambiguo.**
- Qué estorba: GR:1273-1280: «Brigadas: En revisión ⇄ Publicadas para todos» es un botón-interruptor cuyo
  texto dice a la vez el estado y la acción; fácil de leer al revés. Hay dos controles de confirmación
  `px-3 py-1` (GR:1287-1290).
- Principio: visibilidad del estado; evitar texto ambiguo.
- Sugerencia: un interruptor con etiqueta clara («Brigadas visibles para todos: sí / no») y botones de
  confirmación de 44 px. Solo lo usa el superusuario: prioridad baja.
- Beneficio: bajo · Costo: **S**

### Simulacros

**E12. La guía del docente es el mejor ejemplo del lote; solo hay que acercarla.**
- Qué estorba: para llegar hay que pasar por Riesgo → Simulacros → tarjeta → (rol). `VistaSimulacros.tsx:94-114`.
  Los docentes no ven aviso en Inicio hasta que se acerca la fecha.
- Principio: visibilidad de eventos próximos.
- Sugerencia: en Inicio, tarjeta «Simulacro del 21-oct, 9:00, su rol: X» con un solo toque a la guía.
  Cuando falten ≤ 7 días, mostrarla arriba.
- Beneficio: medio · Costo: **M**

**E13. En la lista de simulacros el estado sale en minúscula técnica.**
- Qué estorba: `s.estado` se imprime tal cual (`publicado`, `ejecutado`; VistaSimulacros.tsx:105-108), en
  `text-[10px] uppercase`.
- Principio: lenguaje del usuario.
- Sugerencia: «Próximo» / «Realizado», 12 px.
- Beneficio: bajo · Costo: **S**

**E14. El panel «Día del simulacro» (editores) usa botones `px-2.5 py-1 text-xs`.**
- Qué estorba: PanelDiaSimulacro.tsx:226-234, 299-304, 364-379. Se opera el día del simulacro, de pie y con
  prisa; «Sí, borrar» y «Cancelar» quedan pegados y diminutos.
- Principio: tamaño táctil; evitar errores cerca de acciones destructivas.
- Sugerencia: 44 px de alto, y separar «Sí, borrar» (rojo) de «Cancelar» con más espacio.
- Beneficio: medio · Costo: **S**

### Manual de convivencia

**E15. El manual es de 2 toques si se sabe cuál elegir; no queda claro cuál es.**
- Qué estorba: Asistentes.tsx:198-200 muestra 4 a 6 tarjetas de 120 px (chatbots, digital, clásica, SIEPE…)
  sin una recomendada. Un docente con una duda («¿qué sanción corresponde a…?») no sabe si usar el chatbot o
  el digital.
- Principio: ayuda a decidir; consistencia con el lenguaje del usuario.
- Sugerencia: poner arriba «Pregúntele al asistente» como tarjeta principal y «Leerlo» en segundo plano;
  agrupar por tema (Convivencia / Evaluación) con un subtítulo.
- Beneficio: medio · Costo: **S**

**E16. El visor en el celular es un iframe a pantalla casi completa con botones diminutos.**
- Qué estorba: Asistentes.tsx:145-152: «Volver», «Código QR» y «Abrir en pestaña ↗» son `text-xs px-3 py-1.5`
  (~28 px). El alto del iframe `calc(100vh - 220px)` con mínimo 480 px (Asistentes.tsx:122) deja poco margen
  en pantallas bajas; dentro del iframe el desplazamiento compite con el de la página.
- Principio: tamaño táctil; control del usuario.
- Sugerencia: en celular, botón grande «Abrir a pantalla completa» (ya existe la pestaña externa; hacerlo
  prominente); «Volver» y los otros a 44 px.
- Beneficio: medio · Costo: **S**

**E17. En PDF, el visor se oculta en celular (bien), pero «Descargar Word» está junto a «Ver PDF» sin distinguir.**
- Qué estorba: Asistentes.tsx:156-165 ofrece las dos como botones iguales. El docente que solo quiere leer
  duda cuál usar. «Ver PDF» ya es el principal (relleno de color): está bien resuelto.
- Sugerencia: nota corta bajo «Descargar Word»: «para copiar o editar». Prioridad baja.
- Beneficio: bajo · Costo: **S**

**E18. El código QR ofrece tres botones de descarga a docentes que no los necesitan.**
- Qué estorba: Asistentes.tsx:100-104: PNG, SVG, Imprimir; `grid-cols-3` con `text-xs`. Útil para coordinación,
  ruido para el resto.
- Principio: minimalismo.
- Sugerencia: mostrar solo el QR y «Imprimir»; PNG/SVG en un enlace «Más formatos».
- Beneficio: bajo · Costo: **S**

### Datos de la sede

**E19. Muy bien resuelto; los fallos son de orientación.**
- Qué estorba: no hay botón «Ir al siguiente tema pendiente»; la barra de avance (SedeDatos.tsx:145) dice
  «4 de 10» pero no dice cuáles faltan. «Enviar» está al final de ~10 tarjetas largas.
- Principio: visibilidad del estado; reducción de memoria de trabajo.
- Sugerencia: en la barra pegada, enlace «Siguiente pendiente ↓» que desplaza hasta el primer tema sin
  responder; «Enviar» también en la barra cuando llega al 100% (o siempre, deshabilitado hasta lo mínimo).
- Beneficio: medio · Costo: **S**

**E20. «Después» no pide confirmación ni explica qué pasa con ese tema.**
- Qué estorba: TarjetaTema.tsx:127 pone el estado `despues` y cierra el editor; la nota de que «sigue abierto»
  solo aparece al final (SedeDatos.tsx:200-203).
- Sugerencia: línea de apoyo en la propia tarjeta: «Quedó para después. Lo puede retomar aquí».
- Beneficio: bajo · Costo: **S**

**E21. Controles del superusuario con etiquetas confusas.**
- Qué estorba: SedeDatos.tsx:232-240: «Modo prueba: sí» y «Modo prueba: no (REAL)» son la misma pastilla con
  dos textos; es fácil enviar por error datos reales en nombre de una sede.
- Principio: prevención de errores en acciones con efecto real.
- Sugerencia: cartel rojo fijo cuando NO es prueba («ESTÁ EN MODO REAL — se avisará al coordinador») y pedir
  confirmación al cambiar. El modo prueba ya tiene cartel; falta el espejo para el modo real.
- Beneficio: medio · Costo: **S**

**E22. Ficha de sede sin configurar: tablas con desplazamiento lateral.**
- Qué estorba: FichaSede.tsx:62-92 usa `overflow-x-auto` y `text-xs`; en celular las tablas de grupos se
  desplazan de lado; etiquetas `text-[10px]` (FichaSede.tsx:33).
- Sugerencia: pasar cada grupo a una fila de tarjeta («6º1 · Luis Ángel · Matemáticas»).
- Beneficio: bajo · Costo: **S**

### Usuarios (panel superusuario)

**E23. Dar de alta un usuario está enterrado bajo cuatro bloques de mantenimiento.**
- Qué estorba: orden de `PS`: Ver como (252) → Sincronizar directores (406) → Cuentas de acceso (435) →
  Diagnóstico del puesto (458) → Diagnóstico de dirección (514) → **Nuevo usuario (586)** → tabla de
  usuarios (677) → Reemplazar docente (739) → Auditoría (830) → Classroom (927). Una página de ~900 líneas
  sin índice ni plegado.
- Principio: coincidir el orden con la frecuencia de uso (Nielsen 6, 8).
- Sugerencia: tabs o acordeón: «Personas» (alta, tabla, reemplazo), «Ver como», «Mantenimiento»
  (sincronizaciones y diagnósticos), «Auditoría». Todo plegado menos «Personas».
- Beneficio: **alto** · Costo: **M**

**E24. El campo «Puesto (id interno)» es texto libre.**
- Qué estorba: PS:626-635. Un error de tipeo crea una cuenta con un puesto que no existe; el diagnóstico de
  puesto (PS:458) existe justamente para corregir este tipo de errores.
- Principio: prevención de errores (Nielsen 5).
- Sugerencia: lista desplegable con los puestos libres (los que aún no tienen docente), con búsqueda.
- Beneficio: **alto** · Costo: **M**

**E25. Tabla de usuarios: 4 columnas con desplazamiento lateral y sin buscador.**
- Qué estorba: PS:677-745 (`overflow-x-auto`, `text-sm`); el rol se cambia con un `<select>` pequeño
  (`py-1 text-xs`, PS:695) y «Desactivar» es un botón de ~26 px pegado al estado, sin confirmación
  (PS:720-728). Hay buscador solo en «Ver como» (PS:261), no en la tabla.
- Principio: tamaño táctil; prevención de errores; consistencia.
- Sugerencia: en celular, una tarjeta por persona (nombre, correo, rol, estado) con «Cambiar rol» y
  «Desactivar» a 44 px y confirmación; un solo buscador compartido arriba.
- Beneficio: medio · Costo: **M**

**E26. «Ver como»: bien ubicado y claro; faltan pequeños apoyos.**
- Qué estorba: la búsqueda `sm:w-64` es corta en celular (PS:261-266); botón «Ver como» de ~28 px (PS:283).
  La barra amarilla de suplantación (`BarraSuplantacion.tsx:29-42`) es buena: fija, con «SOLO LECTURA» y
  «Salir». Su botón «Salir» mide ~28 px (`py-1`).
- Sugerencia: «Salir» de 44 px; recordar la última persona vista; en la lista, atajos por rol
  («Docente de ejemplo»).
- Beneficio: medio · Costo: **S**

**E27. Texto de ayuda largo y técnico en cada bloque de mantenimiento.**
- Qué estorba: PS:430-445 y 435-455 explican en 5 a 6 líneas qué hace «Crear y reparar cuentas» (puesto,
  reglas, Firestore). Es información valiosa, pero abruma.
- Principio: ayuda en el momento, no antes.
- Sugerencia: una línea de resumen y «¿Qué hace?» plegable; el botón con verbo claro («Reparar cuentas»).
- Beneficio: bajo · Costo: **S**

**E28. Confirmación con `window.confirm` para una acción grave.**
- Qué estorba: PS:183: reemplazo de docente usa el cuadro nativo del navegador. Es inconsistente con el resto
  de la app, que usa confirmaciones propias, y no muestra qué cambia.
- Sugerencia: reutilizar la vista previa (`previa`) dentro de un modal propio con «Sí, reemplazar».
- Beneficio: bajo · Costo: **S**

### Sugerencias

**E29. El botón de enviar sugerencia está solo al final de la página.**
- Qué estorba: App.tsx:473-481: pie con enlace `text-xs text-muted` («💡 Enviar sugerencia»). Hay que bajar
  hasta el final de cada pantalla; en pantallas largas, nadie lo ve. Es el único canal de retroalimentación.
- Principio: visibilidad; coste de reportar.
- Sugerencia: poner la opción en el menú principal («💡 Sugerencia»), no solo en el pie; mantener el pie.
- Beneficio: medio · Costo: **S**

**E30. La sugerencia no sabe desde dónde se escribió.**
- Qué estorba: ModalSugerencia.tsx:47 solo manda `userId` y texto. El superusuario lee «esto está mal» sin
  saber en qué pantalla estaba el docente.
- Principio: reducir el esfuerzo del usuario; ayudar al revisor.
- Sugerencia: adjuntar automáticamente `vistaActual` y mostrarlo en la tarjeta de PanelSugerencias («desde:
  Asistencia»). Podría sumarse una foto de pantalla opcional.
- Beneficio: **alto** · Costo: **S**

**E31. Pequeños defectos del modal.**
- Qué estorba: botón de cerrar «✕» sin etiqueta ni área táctil (ModalSugerencia.tsx:60-65); botón «Enviar»
  `text-strong` sobre `bg-accent` (ModalSugerencia.tsx:105; en otros sitios se usa `text-accent-fg`, que es lo
  correcto): posible bajo contraste en un tema. Falta confirmar en pantalla; no se puede probar sin sesión.
- Sugerencia: `aria-label="Cerrar"`, 44 px de área, y usar `text-accent-fg`.
- Beneficio: bajo · Costo: **S**

**E32. Panel de revisión: tres líneas de pastillas por tarjeta.**
- Qué estorba: PanelSugerencias.tsx:155-205 y 272-312: filtros de estado, de clasificación; y en cada tarjeta
  otras dos filas de pastillas (clasificar, estado), todas `text-xs px-2.5 py-1`. Para triar 20 sugerencias son
  unos 60 toques pequeños.
- Principio: eficiencia (Nielsen 7); tamaño táctil.
- Sugerencia: «Sin clasificar» como filtro por defecto; un selector desplegable de clasificación y estado
  por tarjeta en vez de 8 pastillas; botones grandes.
- Beneficio: medio · Costo: **M**

---

## 3. Consistencia (todo el lote)

- Dos estilos conviven: la guía de simulacro y Datos de la sede (grandes, `min-h-[44px]`) y el resto
  (pastillas `text-xs`). Un único componente `PastillaToque` (mín. 40 px, letra 14) arreglaría E6, E9, E14,
  E16, E25 y E32 de un golpe.
- «Volver» aparece de tres formas: `BotonVolver` con flecha neón (GR:840), «← Volver a la lista» solo texto
  (VistaSimulacros.tsx:25) y botón de `BOTON` (Asistentes.tsx:146). Unificar.
- Las confirmaciones son de tres tipos: bloque en línea (GR:1283), `window.confirm` (PS:183) y modal propio.
  Unificar a «bloque en línea con botones de 44 px».
- Colores de botón principal: `text-strong` sobre `bg-accent` (PS:283,616; ModalSugerencia:105;
  PanelSugerencias:163) frente a `text-accent-fg` (el correcto en GR y otros). Revisar contraste en tema claro.

---

## 4. Top 5 por beneficio ÷ costo

1. **Emergencia primero (E1 + E2 + E3):** abrir Riesgo en «Emergencia escolar», botón rojo fijo «Llamar al 123»
   y menú reordenado en dos tarjetas urgentes. Pasa de 4–6 toques a 1–2. Costo S.
2. **Botones táctiles de 44 px en todo el lote (E6, E9, E14, E16, E26):** teléfonos del directorio, «Volver»,
   pastillas, panel del día del simulacro. Un solo componente reutilizable. Costo S.
3. **Casos útiles para coordinación (E8 + E10):** buscador por estudiante, abrir en «Casos» cuando hay
   vencidos, letra de 12 px, «días sin seguimiento» bien visible. Costo S.
4. **Sugerencias con contexto y a un toque (E29 + E30):** entrada en el menú y adjuntar la pantalla de origen.
   Costo S, aumenta mucho el valor de lo que llega.
5. **Panel de Usuarios ordenado y con puestos en lista (E23 + E24):** pestañas «Personas / Ver como /
   Mantenimiento / Auditoría» y lista desplegable de puestos libres. Costo M, evita errores de alta.
