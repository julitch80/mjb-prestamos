# Revisión visual lotes C y D — Horario, Disponibilidad, Paneles, Tareas, Calendario

Solo lectura de código (26-oct-2026). Parámetros del PLAN: 2 (color no es única señal), 4 (íconos), 5 (coherencia / modo claro).
Contrastes medidos por mí contra blanco puro (#fff) con la fórmula WCAG; meta texto 4,5:1.

## Lo que ya está bien (no tocar)
- **Disponibilidad** usa color + símbolo + leyenda: `DisponibilidadGrid.tsx:118` (`clase ·`, `ocupado ✕`, `propio ●`, `rectoria ★`) y leyenda `:140-150`. El único estado sin símbolo es "libre" (ver C1).
- **Colores de grado** ya son tokens claro/oscuro: `maestros.ts:658-675`, `index.css:54-59` y `:107-112`.
- **Bloques del docente ausente** en el editor: además del color llevan borde punteado y opacidad 0,55 (`EditorHorarioMode.tsx:201,215`).
- Historial de tareas: chip con texto "vigente/vencida/cancelada" (`VistaTareas.tsx:1530-1534`).
- Botones con ícono del calendario académico llevan aria-label (`CalendarioAcademico.tsx:45,209,211`).

## Hallazgos

### C1 · "Libre" no tiene ninguna marca (solo verde) — ALTO
- **Qué**: `ESTADO_ICONO.libre = ''` (`DisponibilidadGrid.tsx:118`). Libre = celda verde vacía; ocupado = rojo con ✕. Para quien confunde rojo y verde, la celda "vacía" se parece al hueco bloqueado o sin dato.
- **Parámetro**: 2 y 3.
- **Sugerencia**: ícono `✓` (o `+`, que además invita a reservar) en libre; subir los símbolos de `text-[8px]` (`:150`) y `text-[10px]` (`:255`) a 12 px.
- **Beneficio/costo**: muy alto / muy bajo (1 línea + tamaño).

### C2 · Colores de aula fijos, pensados para fondo oscuro, desaparecen en modo claro — ALTO
- **Qué**: `COLORES_AULA` son hex fijos (`maestros.ts:627-652`) usados como color de TEXTO en `VistaHorario.tsx:220,284,423,534,760,866,979` y fichas del editor (`EditorHorarioMode.tsx:170-187`). Contraste sobre blanco: Sala Informática #f1f5f9 = **1,10** (invisible), Aula 9 #a3e635 = 1,51, Auditorio #fcd34d 1,44, Aula 5 #fbbf24 1,67, Aula 10 #fdba74 1,69, Aula 7 1,81, Aula 2 1,92, Aula 3 2,26; Aula 1/4/6/8 entre 2,5 y 2,8; solo Lab. Ciencias (#ff4444, 3,41) pasa 3:1. Ninguna llega a 4,5.
- **Parámetro**: 1 y 5.
- **Sugerencia**: tokens `--color-aula-N` con par claro (tonos 700, como ya se hizo con grado) y oscuro (los actuales de CLAUDE.md). El texto del aula siempre lleva nombre o abreviatura (`abrevAula`), así que el color es refuerzo y no única señal: bien.
- **Beneficio/costo**: alto (el horario lo usan ~30 docentes) / medio (cambio mecánico en un archivo).

### C3 · Colores personales de docente (`USUARIOS[].color`) igual de fijos — ALTO
- **Qué**: 53 `color: '#...'` en `maestros.ts:81+` (rectora #e8c84a = 1,64; coordinadores #f08080 = 2,59 sobre blanco). Se pintan como texto y borde en `VistaHorario.tsx:681-683,745-752`, `EditorHorarioMode.tsx:171-186`, `EditorManualAcompanamientos.tsx:130,519`, `AlternativasAcompanamientos.tsx:64`, `HistorialAcompanamientos.tsx:64`, `EditorHorarioWizard.tsx:311` (inactivo `#cbd5e1` = 1,5 en claro).
- **Parámetro**: 1 y 5.
- **Sugerencia**: función `colorDocente(id)` que en modo claro oscurezca el tono con CSS `color-mix(in srgb, var(--c) 55%, black)`; no hace falta una tabla de 53 pares.
- **Beneficio/costo**: alto / medio-bajo.

### C4 · CI dorado: dos estilos distintos — MEDIO
- **Qué**: `VistaHorario.tsx:119` usa `text-yellow-400` fijo ("⭐CI"; ≈1,5:1 en claro); otras celdas usan `text-warning` con "★CI" (`:855,962,1086`). Dos íconos (⭐ vs ★) y dos colores para lo mismo.
- **Parámetro**: 4 y 5.
- **Sugerencia**: un solo componente `<MarcaCI/>` con `★CI` y token `text-warning`.
- **Beneficio/costo**: medio / muy bajo.

### C5 · Calendario de cupo en Tareas: estado solo por color — ALTO
- **Qué**: los días del selector de entrega se pintan verde/naranja/rojo con `rgba(...)` fijo y solo el número encima (`VistaTareas.tsx:1305-1327`). La leyenda usa nombres de color en el texto ("verde: cabe · ámbar · rojo: no cabe", `:1263-1269`), que no ayuda a quien no distingue los colores. Verde, naranja y rojo es el trío que más confunde en deuteranopía.
- **Parámetro**: 2 y 3.
- **Sugerencia**: añadir al número un marcador: `✓` cabe, `◐` caben menos, `✕` lleno (o mostrar el cupo restante). Leyenda: "✓ cabe · ◐ caben menos · ✕ no cabe". Sustituir los `rgba` fijos por tokens `success-soft/warning-soft/danger-soft`.
- **Beneficio/costo**: alto / bajo.

### C6 · Punto "hay entrega" sin significado accesible — MEDIO
- **Qué**: `VistaTareas.tsx:2158` punto de 4 px `bg-emerald-400` (color fijo, ≈1,9:1 en claro, sin título ni texto).
- **Sugerencia**: punto de 6 px con token `bg-success`, `title="Hay entregas"` y número cuando sean varias.
- **Beneficio/costo**: medio / bajo.

### C7 · Pastillas neón de adjuntar (solo ícono, color fijo) — MEDIO
- **Qué**: `NEON_ADJ` hex fijos (`VistaTareas.tsx:46-51`): foto #f472b6, galería #a78bfa, archivo #22d3ee, enlace #a3e635. En claro quedan entre 1,5 y 2,7:1 sobre fondo casi blanco y el resplandor `drop-shadow` no se ve. Galería y Archivo tienen aria-label y title (`:421,425`); en foto (`:408`) y enlace (`:289,1196`) no vi aria-label (verificar). Los íconos (Camera, Image, Paperclip, Link2) son intuitivos y distintos entre sí: el color es solo estético y se puede oscurecer en claro sin perder función.
- **Parámetro**: 1, 4, 5.
- **Sugerencia**: tokens neón con par claro (tonos 600-700, borde más marcado); `aria-label` + `title` en foto y enlace.
- **Beneficio/costo**: medio / bajo.

### C8 · Categorías del calendario académico: punto de color como única marca — ALTO
- **Qué**: siete categorías solo con punto de 6-10 px (`CalendarioAcademico.tsx:26,109,230`; colores en `data/calendarioAcademico/tipos.ts:28-34`). Receso #10b981, vacaciones #14b8a6 y periodo #3b82f6 se parecen entre sí; reunión #f59e0b y entregas #ef4444 se confunden en deuteranopía. La lista trae el título del evento, lo que mitiga; la cuadrícula mensual (`:230`) no tiene texto.
- **Parámetro**: 2 y 3.
- **Sugerencia**: dar a cada categoría una forma/ícono lucide además del color (periodo, receso, vacaciones, desarrollo, entrega, reunión, institucional), en lista (`:26`) y filtro (`:109`); en la cuadrícula punto de 8 px con `title`.
- **Beneficio/costo**: alto / medio.

### C9 · Editor de horario: piezas que no se adaptan al modo claro — MEDIO
- **Qué**: `EditorHorarioMode.tsx:1132` `bg-white/10 text-gray-200` (casi blanco sobre fondo claro); `:1194` `bg-white/2` (clase inexistente, sin efecto); `:1283` `bg-red-950/95` fijo (aviso rojo oscurísimo en claro, con texto de token); `:1472-1475,1588` `text-white` sobre `bg-success/bg-info` (comprobar contraste de esos tokens en claro). `:1431` `bg-white text-gray-900` es intencional (vista previa del banner).
- **Parámetro**: 5.
- **Sugerencia**: `bg-elevated text-soft` en `:1132`; quitar `:1194`; `bg-danger-soft` en `:1283`; `text-accent-fg` en lugar de `text-white`.
- **Beneficio/costo**: medio / muy bajo.

### C10 · Borde ámbar `#f59e0b` fijo para "taller" y "día cargado" — BAJO
- **Qué**: `EditorHorarioMode.tsx:170,185`, `EditorManualAcompanamientos.tsx:139`. El taller lleva texto "Taller" (`:176`), pero "día cargado" solo cambia el borde.
- **Sugerencia**: etiqueta "Día cargado" o ícono de alerta en la ficha.
- **Beneficio/costo**: bajo-medio / bajo.

### C11 · PanelAdmin: hover con color fijo — BAJO
- **Qué**: `PanelAdmin.tsx:203,210` `hover:bg-red-800/60` y `hover:bg-green-800/60`: en claro el hover oscurece el fondo y choca con el texto `-soft-fg`. Los botones llevan texto (Aprobar/Rechazar), así que no es problema de "solo color".
- **Sugerencia**: `hover:opacity-80` o un token de hover.
- **Beneficio/costo**: bajo / muy bajo.

### C12 · Íconos: inconsistencias — MEDIO
- **Qué**: (a) `✕` significa "cerrar" en `DisponibilidadGrid.tsx:534` y `PanelAdmin.tsx:96`, pero también "ocupado" en la rejilla (`:118`): un símbolo, dos significados; (b) mezcla de emojis (⭐, 🏗️ en `EditorHorario.tsx:5`) y lucide; (c) `planCasa/PanelPlanCasa.tsx:238` botón `Plus` solo ícono (tiene aria-label: bien).
- **Sugerencia**: usar `X` de lucide para cerrar y reservar `✕` al estado; unificar ★. `EditorHorario.tsx` es un stub ("En construcción", `text-white` sobre claro): confirmar que no se enruta y retirarlo.
- **Beneficio/costo**: medio / bajo.

### C13 · Letra de 9-10 px en horario y disponibilidad — MEDIO
- **Qué**: abundan `text-[9px]` y `text-[10px]` (`VistaHorario.tsx:426,855,866,962,1086`; `DisponibilidadGrid.tsx:150,220,255`). Para quien distingue mal letras pesa más que el color.
- **Sugerencia**: mínimo 11 px (12 px en celdas de aula/grado del horario semanal); la vista por día en celular puede ir a 13 px.
- **Beneficio/costo**: alto / medio (revisar desbordes).

### C14 · Resto del lote D
- `planCasa/*`, `AgendaSemanal`, `AgendaPublica`, `PanelRectora`, `MiHistorial`: sin hex de texto en el barrido; usan tokens. Contraste de los tokens: queda para la fase 0.

## Top 5 (orden de prioridad)
1. **C2+C3** Colores fijos de aula y docente: invisibles en modo claro (Sala Informática 1,1:1; ninguno llega a 4,5). Tokens con par claro/oscuro, como ya se hizo con grado.
2. **C5** Calendario de cupo de tareas: verde/naranja/rojo sin marca; añadir ✓/◐/✕ y corregir la leyenda.
3. **C1** Disponibilidad: "libre" sin símbolo; añadir ✓ o + y subir los símbolos a 12 px.
4. **C8** Categorías del calendario académico: solo puntos de color; dar forma/ícono a cada una.
5. **C13+C4** Letra de 9-10 px en horario y CI con dos estilos (⭐ amarillo fijo vs ★ token): subir a 11-12 px y unificar `<MarcaCI/>`.
