# Lote D — Tareas, Agenda, Académico, Planes en casa

Revisión de solo lectura (25-oct-2026). Archivos revisados: `src/components/VistaTareas.tsx`
(2412 líneas), `DetalleTarea`, `ModalReplicarTarea`, `AgendaGrupo`, `AgendaPublica`, `AgendaSemanal`,
`AsignacionAcademica`, `calendarioAcademico/*` y `planCasa/*`. No se ejecutó la app; los toques se
cuentan leyendo el código. Escala: beneficio alto/medio/bajo, costo S (horas) / M (un día) / L (varios días).

En general el módulo está bien cuidado: estados de carga y de error visibles, mensajes en
lenguaje claro, avisos dentro de la página (sin `window.confirm`), la agenda pública recuerda el
grupo y abre al instante con la última copia guardada. Lo que sigue son los puntos que más
estorban, sobre todo desde el celular.

---

## 1. Tareas por rol y su recorrido

### Docente: asignar una tarea (VistaTareas)
1. Entra a Tareas (abre en «Publicar»; el historial está en una segunda pestaña).
2. Elige grupo y asignatura (si tiene varios grupos, 2 selectores).
3. Escribe título (obligatorio) y descripción opcional.
4. Escoge momentos (1-n), adjunta archivo/foto o enlaces (opcionales).
5. Toca una fecha de entrega en un calendario de 5 columnas (verde/naranja/rojo según cupo).
6. Mira la vista previa del reparto de momentos.
7. «Publicar tarea».
**Total mínimo: ~6-7 toques + escritura.** Es razonable. Con ventana cerrada (festivo, fin de
semana) un cuadro explica por qué; eso es muy buen diseño.
Tras publicar: el aviso sale abajo del botón, el formulario se vacía y la tarea aparece en
«Mis tareas vigentes» más abajo.

### Docente: repetir una tarea para otro grupo
Botón de copiar (icono) en la fila de la tarea → ventana «Replicar» → elegir grupos → confirmar.
Bien resuelto, pero el icono no dice qué hace (ver hallazgo T-3).

### Docente: ver la agenda
Desde Tareas, «agenda» abre la agenda del grupo (día/semana, 3 semanas, imprimir, proyectar).
Para el estudiante: enlace público por grupo, sin cuenta, recuerda el grupo en el teléfono. Excelente.

### Coordinación: revisar calendario y carga
Pestaña Académico → Calendario (próximo / lo que falta / mes) o Asignación. En Tareas, vista
de coordinación con mapa de calor grupo × día (tabla que se desplaza de lado) y lista de tareas vigentes.

### Docente: pedir/aprobar guía del Plan en casa
Planes en casa → («Mis guías») → cada guía: revisar, «Generar con IA» (opcional), editar pasos,
«Aprobar» (la guía se publica en la agenda del estudiante). Un solo botón hace aprobar + reprogramar
las otras guías + publicar: eficiente, pero el resultado es un texto largo (ver P-4).

### UAI / orientador: crear un plan
Planes → «Nuevo plan» → buscar estudiante → fechas → contexto → motivo reservado → ajustes
(chips) → sin tecnología → tope de momentos → ritmo → modalidad → (si es transversal, armar
guías y responsables) → Guardar. **Un formulario único de ~10 campos**, sin dividir en pasos.

---

## 2. Hallazgos

### Tareas

**T-1. Cancelar una tarea se hace con un toque, sin confirmar y sin deshacer**
- Dónde: `VistaTareas.tsx:1478` (`onClick={() => cancelar(t.id)}`), botón de papelera de ~28 px junto al de replicar (1471).
- Principio: prevención de errores; control del usuario (Nielsen 3 y 5).
- Qué pasa: la papelera queda pegada al botón de replicar en una fila angosta. Un toque
  desafortunado cancela la tarea y, si estaba en Classroom, también la borra allá.
- Sugerencia: confirmación en la misma fila («¿Cancelar esta tarea? Sí / No») o aviso con «Deshacer» durante unos segundos.
- Beneficio alto · Costo S

**T-2. Botones de icono pequeños (≈28 px) en la lista de tareas**
- Dónde: `VistaTareas.tsx:1471-1481` (`p-1.5` + icono 14 px); también `:2150`, `:513` (cerrar ventana) y la X de cerrar aviso (`:1376`, icono 12 px sin relleno).
- Principio: tamaño de objetivo táctil (≥44 px); prevención de errores.
- Sugerencia: subir a `min-h-[44px] min-w-[44px]` (puede conservar el icono pequeño).
- Beneficio alto · Costo S

**T-3. Iconos sin texto para acciones importantes (replicar, cancelar)**
- Dónde: `VistaTareas.tsx:1471-1481`. El `title` no se ve en el celular.
- Principio: reconocer antes que recordar.
- Sugerencia: etiqueta corta junto al icono («Copiar a otro grupo», «Cancelar») o un menú «⋯» con texto.
- Beneficio medio · Costo S

**T-4. La fila «Publicar / Ceder / Solicitar» no se parte en pantallas angostas**
- Dónde: `VistaTareas.tsx:1385-1405`: `flex items-center gap-3` sin `flex-wrap`; tres botones con texto (el principal con `py-2` ≈ 36 px, los otros con texto de 12 px).
- Principio: celular primero; jerarquía visual.
- Sugerencia: «Publicar» a todo el ancho y los otros dos debajo como acciones secundarias (o en un menú «Más»). Hoy «Ceder/Solicitar momentos» compiten visualmente con la acción principal.
- Beneficio medio · Costo S

**T-5. Texto muy pequeño en lo esencial del formulario**
- Dónde: etiquetas de campo en `text-[11px]` (`VistaTareas.tsx:1100-1262`), días del calendario `text-[10px]` (`:1295`), contadores `text-[10px]`. Mapa de calor con fechas en `text-[9px]`/`[10px]` (`:2106-2107`).
- Principio: legibilidad (≥12 px); visibilidad del estado.
- Sugerencia: piso de 12 px para etiquetas y 11 px solo para ayudas secundarias; fechas del mapa de calor a 11 px.
- Beneficio medio · Costo S

**T-6. Calendario de fecha de entrega: celdas de 36 px**
- Dónde: `VistaTareas.tsx:1305-1311` (`h-9`, 5 columnas). Los «no disponibles» solo se atenúan al 40 %, sin explicar por qué (el motivo está en un `title`, invisible en celular, `:1302`).
- Sugerencia: celdas de 44 px de alto y una línea fija bajo el calendario que explique los colores y el plazo mínimo («Verde: cabe · Naranja: casi lleno · Rojo: sin cupo · Gris: no hay clase / plazo mínimo»). Al tocar un día gris, mostrar el motivo.
- Beneficio medio · Costo S

**T-7. Archivo de 2412 líneas y todo en una pantalla larga**
- Dónde: `VistaTareas.tsx` mezcla el formulario, las vigentes, cesión, solicitudes, historial, cupos, carga por grupo, anclas y la configuración de momentos.
- Principio: coherencia y mantenimiento; carga cognitiva.
- Qué pasa: un docente ve «Anclas», «Ceder momentos», «Solicitar momentos», solicitudes por responder y vigentes en la misma página que usa para publicar. La función principal (publicar) queda acompañada de 5-6 funciones raras.
- Sugerencia: dejar visible solo «Publicar» + «Mis vigentes»; mover Ceder/Solicitar/Solicitudes a un acceso «Momentos» (puede ser una tercera pestaña junto a Publicar/Historial). Para el mantenimiento, partir el archivo en componentes por sección.
- Beneficio medio · Costo M

**T-8. Mapa de calor de coordinación con desplazamiento horizontal**
- Dónde: `VistaTareas.tsx:2099` (`overflow-x-auto`, columnas `min-w-[52px]`, celdas `h-8`, `text-[10px]`).
- Principio: celular primero. Para coordinación (que sí usa el celular) la tabla se recorre de lado y las celdas son pequeñas.
- Sugerencia: en celular, mostrar una semana por vez con celdas más grandes y flechas de semana, o fijar la columna del grupo y subir la altura de las celdas a 44 px.
- Beneficio medio · Costo M

**T-9. Mensajes de resultado lejos de donde se actúa**
- Dónde: `VistaTareas.tsx:1370-1380`: el aviso aparece justo antes del botón de publicar y la lista de vigentes queda más abajo; en un formulario largo el aviso puede quedar fuera de pantalla tras vaciarse los campos.
- Sugerencia: llevar la pantalla al aviso (scrollIntoView) o mostrar un aviso flotante con el nombre de la tarea publicada.
- Beneficio bajo · Costo S

### Agenda

**A-1. Controles pequeños en la agenda del grupo**
- Dónde: `AgendaGrupo.tsx:318` (selector de semana `text-[11px]`, `py-1.5` ≈ 28 px), `:465` y `:527` («¿Cuándo la haces?» con `min-h-[28px]`), `:414`/`:331` (enlaces de texto de 11 px).
- Principio: celular primero. El botón «¿Cuándo la haces?» lo usa el estudiante en el celular, repetido por cada tarea.
- Sugerencia: `min-h-[44px]` en esos botones y 12 px de texto mínimo.
- Beneficio alto · Costo S

**A-2. Selector «Día / Semana» y «Semana pasada / Esta / Próxima» con apariencia muy parecida**
- Dónde: `AgendaGrupo.tsx:284-296` y `:310-325`. Dos filas de píldoras iguales una tras otra, más dos botones de «Imprimir» y «Proyectar»: cuatro filas de controles antes de ver una sola tarea.
- Principio: minimalismo; el contenido debe llegar primero.
- Sugerencia: dejar «Día/Semana» y la semana en una sola fila compacta (semana con flechas ‹ ›) y esconder Imprimir/Proyectar bajo un menú «Más». Para el estudiante la agenda pública debe abrir directamente en «hoy y mañana».
- Beneficio medio · Costo M

**A-3. Agenda semanal institucional: bien, pero sin «hoy» marcado en la vista larga**
- Dónde: `AgendaSemanal.tsx:20-70`. Existe `hoyEnSemana()` y las tarjetas tienen buen tamaño; falta que al abrir lleve al día actual. Hora en `text-[11px]`.
- Sugerencia: desplazar al día de hoy al abrir y resaltarlo; subir la hora a 12 px.
- Beneficio bajo · Costo S

**A-4. Estado vacío de la agenda pública poco orientador**
- Dónde: `AgendaPublica.tsx:96` («Cargando la agenda…») y `:129`/`:179` (ayudas en 11 px). Si falla la red solo se ve la copia guardada.
- Sugerencia: mostrar «Actualizado hace X» también cuando se usa la copia guardada y un botón «Reintentar» grande si la red falla.
- Beneficio bajo · Costo S

### Académico

**C-1. Calendario: botones de edición y filtros por debajo de 44 px**
- Dónde: `CalendarioAcademico.tsx:128-130` («Agregar evento», «Ver registro de cambios» con `py-2` y texto de 12 px ≈ 32 px); chips de categoría `py-1.5` (`:106`); pestañas «Próximo / Lo que falta / Mes» `py-2` (`:121`); `PanelAcademico.tsx:15` (`py-2`).
- Sugerencia: subir a `min-h-[44px]`. Los chips de categoría ya se desplazan de lado (bien, es el patrón correcto para chips).
- Beneficio medio · Costo S

**C-2. Las categorías de color no tienen leyenda en la vista Mes**
- Dónde: `CalendarioAcademico.tsx:225-231` (puntos de color de 6 px) y chips de filtro arriba (`:104-113`).
- Principio: reconocer antes que recordar. Los puntitos solo se entienden tocando el día.
- Sugerencia: leyenda corta bajo la cuadrícula, o hacer que los chips activos coloreen los puntos. Se sugiere además puntos de 8 px.
- Beneficio bajo · Costo S

**C-3. Calendario: buenas decisiones que conviene mantener**
- Búsqueda siempre visible (`:95-100`), encabezado con «semana N de M · faltan X días lectivos» (`:86-90`), «Lo resaltado ocurre esta semana», días del mes de 44 px (`h-11`, `:223`). Es el mejor diseño táctil del lote; usarlo como referencia para el resto.

**C-4. Asignación académica: texto de 10-11 px y chips pequeños**
- Dónde: `AsignacionAcademica.tsx:77` (`text-[11px]`), `:194-199` (`text-[10px]` chips), `:248`.
- Sugerencia: 12 px mínimo. Beneficio bajo · Costo S

### Planes en casa

**P-1. «Nuevo plan» es un formulario único de ~10 campos**
- Dónde: `PanelPlanCasa.tsx:140-300` (estudiante, fechas, contexto, motivo, ajustes, sin tecnología, tope, ritmo, modalidad, guías). La validación llega solo al pulsar Guardar (`:99-107`) con un error general arriba.
- Principio: reducir carga cognitiva; prevención de errores.
- Sugerencia: dividir en 3 pasos («Quién y cuándo» → «Qué ajustes» → «Cómo se reparte»), con valores por defecto sensatos ya puestos (tope, ritmo, modalidad). Los errores deben aparecer junto al campo que falla, no en una caja general.
- Beneficio alto · Costo M

**P-2. Campos con reglas importantes escondidas en texto de 11 px**
- Dónde: `PanelPlanCasa.tsx:173`, `:208`, `:225`, `:236`. Ejemplos: «no use diagnósticos», «UAI: máximo 2–3 momentos por día».
- Principio: ayuda en el momento justo; legibilidad.
- Sugerencia: 12 px y, para la advertencia sobre diagnósticos (sensible), un recuadro destacado visible antes de escribir.
- Beneficio medio · Costo S

**P-3. Chips de ajustes con objetivo táctil bajo y la X de quitar pequeña**
- Dónde: `PanelPlanCasa.tsx:186` (`py-1.5`, 12 px), `:196` (X de 14 px con `p-1`), `:216` (botón «+» con `CLASE_BOTON_SEC` ~ 40 px).
- Sugerencia: `min-h-[44px]` en chips y en la X.
- Beneficio medio · Costo S

**P-4. Aprobar una guía devuelve un párrafo largo mezclando éxito y problemas**
- Dónde: `PlanCasaDocente.tsx:398-411`: «Guía aprobada. Ya está en la agenda del estudiante. [avisos] (N guías de otros docentes no se reprogramaron.)» en un solo texto.
- Principio: visibilidad del estado; reconocer errores.
- Sugerencia: separar en una línea verde «Aprobada y publicada» y, aparte, una lista de avisos. Si hay algo para revisar, que se vea con otro color.
- Beneficio medio · Costo S

**P-5. Botones principales del módulo bajo 44 px**
- Dónde: `planCasa/comun.tsx:13-16`: `CLASE_BOTON` y `CLASE_BOTON_SEC` con `py-2.5` + `text-sm` ≈ 40 px. Es una sola constante: arreglarla mejora todo el módulo. Igual para `CLASE_INPUT` (`py-2.5`).
- Sugerencia: añadir `min-h-[44px]` a las tres constantes.
- Beneficio alto · Costo S (una línea por constante)

**P-6. Pestañas «Planes / Mis guías» a 36 px**
- Dónde: `VistaPlanCasa.tsx:34` (`min-h-[36px]`, `text-xs`); igual en `VistaTareas.tsx:~1000` (píldoras Publicar/Historial). Es el mismo patrón que Tareas, bien coherente, pero pequeño.
- Sugerencia: `min-h-[44px]` en ambas.
- Beneficio medio · Costo S

**P-7. Rol mixto (equipo UAI + docente) abre en «Planes»**
- Dónde: `VistaPlanCasa.tsx:19-23`. Un miembro del equipo que también es responsable de una guía debe cambiar a «Mis guías» cada vez; el estado no se recuerda.
- Sugerencia: si hay guías pendientes de aprobar para esa persona, mostrar una insignia con el número en la pestaña «Mis guías».
- Beneficio medio · Costo S

**P-8. Agenda del plan (estudiante): bien en tamaño, un detalle**
- Dónde: `AgendaPlanPublica.tsx:116` (`text-[10px]` en el conteo de pasos) y vacío «No hay entregas en los próximos 7 días» (`:137`) sin indicar cuándo es la próxima. Texto base de 16 px, buen criterio para estudiantes.
- Sugerencia: mostrar «Próxima entrega: jueves 29» en el estado vacío; conteo de pasos a 12 px.
- Beneficio bajo · Costo S

---

## 3. Consistencia entre los módulos del lote

- Patrón de pestañas: Tareas, Plan en casa y Académico usan tres estilos distintos de selector (píldora doble de 36 px; píldoras de 36 px; botones redondos de ~36 px). Unificar en un solo componente de 44 px.
- Constantes de botón: Plan en casa usa `CLASE_BOTON`; Tareas escribe las clases a mano en cada botón (por eso hay tantos tamaños distintos). Un componente de botón común resolvería T-2, T-4, C-1 y P-5 de una vez.
- Voz de los textos: Tareas habla de «tú» (`Elige…`), Plan en casa de «usted» (`Escoja…`, `Escriba…`), Calendario mezcla. Elegir una sola voz por público (docentes: usted o tú, pero igual en todos).
- Estados de carga: Plan en casa usa un componente `Cargando` propio; Tareas, Calendario y Agenda usan textos o spinners sueltos.

---

## 4. Top 5 por beneficio ÷ costo

1. **Subir los botones del módulo a 44 px con una sola corrección central** (P-5 + T-2 + A-1 + C-1 + P-6): `comun.tsx:13-16`, papelera/replicar (`VistaTareas.tsx:1471-1481`), «¿Cuándo la haces?» (`AgendaGrupo.tsx:465,527`), pestañas. Beneficio alto · Costo S.
2. **Confirmar o poder deshacer «Cancelar tarea»** (T-1): hoy es un toque en un botón de 28 px junto a «Replicar» y también borra de Classroom. Beneficio alto · Costo S.
3. **Piso de 12 px de texto y etiquetas con texto en vez de solo iconos** (T-3, T-5, P-2, C-4): etiquetas de 11 px, calendario de 10 px, reglas del plan en casa. Beneficio medio-alto · Costo S.
4. **Dividir «Nuevo plan» en 3 pasos con errores junto al campo** (P-1). Beneficio alto · Costo M.
5. **Ordenar la pantalla de Publicar tarea: «Publicar» arriba y destacado, «Ceder/Solicitar momentos» en un acceso aparte** (T-4 + T-7). Beneficio medio · Costo S-M.
