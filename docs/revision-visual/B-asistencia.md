# B. Asistencia (src/asistencia/**) — revisión visual, 26-oct-2026

Solo lectura del código. Parámetros 2 (color no es la única señal), 4 (íconos) y 5 (coherencia).
No se midieron contrastes ni se hicieron capturas.

## Lo que ya está bien (no tocar)
- La planilla usa un sistema de marcas sólido: chulo (`Check`) para presente, equis (`X`) para
  falta y siglas F/R/FJ/RJ/EV/FP para el resto (`Planilla.tsx:62-104`, componente `SiglaMarca`,
  reutilizado por centro, evento e index). El color (`CLASE_MARCA`, `Planilla.tsx:62-70`) es
  refuerzo, no la señal. Presente y ausente se distinguen sin color.
- La celda de resumen con alerta lleva anillo + signo "!" + título (`Planilla.tsx:810-841`).
- En la alerta académica cada estudiante lleva ícono Y texto: ⚠️ "En alerta" / ✓ "Sin alerta"
  (`AlertaAcademica.tsx:411-412`) y `aria-label` con el estado (`:304`).
- Los gráficos de Alerta escriben el valor en cada barra (`GraficosAlerta.tsx:19-27,54-57`) y el
  promedio es línea punteada (forma), no solo color.
- Los imprimibles (`domain/imprimibles-alerta.ts`, `imprimible-analisis-alerta.ts`) son casi todo
  texto y tablas con borde; sobreviven en blanco y negro salvo lo señalado en H9.
- Casi todo el área usa tokens (`success-soft`, `warning-soft`, `danger-soft`, `info-soft`,
  `purple-soft`), que se adaptan a claro y oscuro. Solo hay 3 hex fijos (H10).

## Hallazgos

### H1. Llegadas tarde: la escala amarillo/naranja/rojo depende del color
- Dónde: `LlegadasTarde.tsx:46-62` (hex fijos `#eab308`, `#f97316`, `#b91c1c`); uso en `:489-495`, `:649`.
- Parámetros: 2, 3 y 5. Amarillo y naranja se confunden en deuteranopía/protanopía; son colores
  fuera de los tokens.
- Detalle: la pastilla sí lleva `paso.mensaje` (texto), lo que mitiga. Pero el texto usa el mismo
  color del borde, y `#eab308` (amarillo) como letra sobre fondo claro tiene contraste bajo
  (estimado ~2:1; confirmar con la Fase 0).
- Sugerencia: anteponer el nivel ("1.º", "2.º", "3.º+") o puntos ●, ●●, ●●●; texto en color
  oscuro del token fuerte en modo claro, y mover los tres tonos a tokens `--sev-1/2/3` con
  versión clara y oscura.
- Beneficio/costo: alto / bajo.

### H2. "Se cita" (ámbar) en el Análisis: solo color + leyenda
- Dónde: `AnalisisAlerta.tsx:271` (`bg-warning` vs `bg-accent`), leyenda `:183`.
- Parámetro: 2. Las barras que se citan y las que no solo difieren en tono; en blanco y negro o
  con poca luminosidad no se distinguen. Mismo gráfico en el imprimible (`.evo .bar`,
  `imprimible-analisis-alerta.ts:40`).
- Sugerencia: rayado diagonal (`repeating-linear-gradient`) o borde punteado en las que se
  citan, y etiqueta corta "se cita" en la fila.
- Beneficio/costo: medio / bajo.

### H3. GraficoGrupos: "este grupo" se marca por color y negrita
- Dónde: `GraficosAlerta.tsx:50-56`. Propio = `bg-accent`, resto = `bg-line-strong`.
- Parámetros: 2 y 1. La negrita ayuda; en blanco y negro azul y gris se parecen; el gris
  `line-strong` como barra sobre tarjeta clara puede quedar bajo 3:1.
- Sugerencia: anteponer "▸" o "(tu grupo)" al nombre propio y usar un token de barra con ≥ 3:1.
- Beneficio/costo: medio / muy bajo.

### H4. "Sin marcar" en Alerta es un punto "·" casi invisible
- Dónde: `AlertaAcademica.tsx:315-318`.
- Parámetros: 2 y 4. Es el estado que más importa para terminar la lista y el menos visible. El
  `aria-label` sí lo dice (`:304`).
- Sugerencia: "?" o "—" en lugar de "·", y verificar que la barra de estado (`:245-252`) diga
  cuántos faltan.
- Beneficio/costo: medio / bajo.

### H5. Emoji mezclado con íconos de librería, y un glifo con dos significados
- Dónde: `AlertaAcademica.tsx:317,411-412` usa ⚠️ y ✓ como texto; la planilla usa Lucide
  (`Planilla.tsx:97-102`). "✓" significa "sin alerta" en una pantalla y "presente" en otra. El
  emoji se ve distinto en cada celular y el ⚠️ trae su propio amarillo, que choca con el modo oscuro.
- Parámetros: 4 y 5.
- Sugerencia: `AlertTriangle` y `CircleCheck` de Lucide, coloreados por token. Convención:
  chulo = presente, triángulo = atención.
- Beneficio/costo: medio / bajo.

### H6. Marcas justificadas comparten color
- Dónde: `Planilla.tsx:68-71` (FJ, RJ y FP en `info-soft`).
- Parámetro: 2. Se distinguen por sigla, pero dos letras en casilla pequeña cuestan a quien
  confunde letras. Es una excepción documentada (`Planilla.tsx:80-86`) y aceptable.
- Sugerencia: leyenda siempre a un toque y siglas nunca por debajo de 12 px.
- Beneficio/costo: bajo / bajo.

### H7. Indicadores diminutos
- Dónde: punto de aviso `h-1.5 w-1.5` (6 px) `Planilla.tsx:826`; "!" a `text-[0.55rem]` (~9 px) en
  círculo de 14 px `Planilla.tsx:835`; `Avatar.tsx:68` a `text-[0.6rem]`.
- Parámetros: 5 y 1. El punto ámbar depende de `title`, que no se ve en celular: su significado
  ("hay retrasos") es invisible en táctil. Es además solo color y tamaño, sin forma.
- Sugerencia: punto de 8-10 px con una "R" o forma distinta del anillo rojo; "!" a 11-12 px en
  círculo de 16-18 px; añadir ambos a la leyenda.
- Beneficio/costo: medio / bajo.

### H8. Botones con solo `title`, sin `aria-label`
- Dónde: `Planilla.tsx:553` (cerrar sesión de clase), `:562` (llenar/corregir/eliminar columna),
  `:398`, `:469`, `:586`. Conteo de `aria-label` por archivo: Planilla 5, PlanillaCentro 2,
  PlanillaEvento 5, LlegadasTarde 2, PanoramaAlerta 1, AnalisisAlerta 1, frente a muchos botones.
- Parámetro: 4. En celular `title` no aparece y en lector de pantalla no es fiable.
- Sugerencia: recorrer los `<button>` solo-ícono (candado, lápiz, cerrar ×) y copiar el `title`
  a `aria-label`. Es mecánico.
- Beneficio/costo: alto / bajo.

### H9. Fila de "citado" en el imprimible: solo un tinte leve
- Dónde: `domain/imprimibles-alerta.ts:315` (`.pf-citado td { background: #f7eef0 }`).
- Parámetro: 2. En blanco y negro el tinte rosa pálido desaparece; la fila citada no se
  distingue.
- Sugerencia: además del tinte, un asterisco, negrita en el nombre o la palabra "Citado".
  (El aviso ámbar de `imprimible-resumen-permanencia.ts:30` lleva texto y barra lateral: bien.)
- Beneficio/costo: medio / muy bajo.

### H10. Colores fijos fuera de tokens
- Dónde: `LlegadasTarde.tsx:49-51` (ver H1). `MosaicoGrupo.tsx:199` (`#525659`, fondo gris de la vista
  previa del PDF) y `TelefonoAcudiente.tsx:26` (`#25D366`, verde de WhatsApp) son aceptables.
- Parámetro: 5. Solo H1 es un problema real.
- Beneficio/costo: bajo / bajo.

### H11. Gráfico de evolución: línea del promedio sobre el número
- Dónde: `GraficosAlerta.tsx:19-30`. Si el promedio coincide en altura con la etiqueta de la
  barra, la línea punteada la tacha.
- Parámetro: 5. Sugerencia: fondo `bg-card` en la etiqueta. Bajo / bajo.

### H12. Tamaño de letra de pastillas de estado
- Dónde: pastillas de reincidencia a `text-xs` (12 px) `LlegadasTarde.tsx:487`, 54 usos de
  `text-xs`/`text-sm` en el archivo.
- Parámetro: 5. Sugerencia: `text-sm` para pastillas que deciden una acción. Bajo / bajo.

## Top 5 (por beneficio/costo)
1. H8: `aria-label` en los botones solo-ícono de planilla y alerta (mecánico, accesibilidad).
2. H1: escala de llegadas tarde con nivel visible (1.º/2.º/3.º o ●●●) y tokens claro/oscuro en vez de hex fijos.
3. H9: fila de citados del imprimible marcada con texto o asterisco, no solo tinte.
4. H2/H3: barras "se cita" y "tu grupo" con rayado o etiqueta además del color (pantalla e imprimible).
5. H5/H4: unificar íconos (Lucide en lugar de emoji) y hacer visible el estado "sin marcar" en Alerta.
