# Resumen — Revisión visual (26-oct-2026)

Fuentes: `0-tokens-contraste.md` (medido con `scripts/revision-visual/contraste.py`),
`AE-navegacion-institucional.md`, `B-asistencia.md`, `CD-horario-academico.md`.

## Lo medido
- **Modo claro, colores de aula y rol: los 15 fallan** (mínimo 4,5:1). Sala Info. 1,10 (invisible),
  rol Docente 1,40, Aula 9 1,51, Rectora 1,64, Aula 5 1,67. En oscuro pasan todos. Los grados ya
  usan tokens y pasan en ambos modos.
- **Tokens de texto: 13 de 80 combinaciones fallan** (teal en claro 3,05–3,74; danger y accent
  oscuros sobre hover ~3,4; botón primario oscuro 3,68). Bordes de tarjeta 1,2–1,95 (piden 3:1).
- **289 colores de texto fijos en 55 archivos** (sin contar los imprimibles, que van en papel blanco).
- **Daltonismo:** verde/rojo (éxito/peligro) se confunden en deuteranopía; Aula 1 y Aula 4 son
  idénticas en simulación; las 12 aulas no se pueden distinguir solo por color → el nombre escrito
  debe seguir siendo la señal principal.

## Mejoras priorizadas
| # | Mejora | Dónde | Costo |
|---|---|---|---|
| 1 | Colores de aula, docente y rol con variante para modo claro (valores ya calculados, todos ≥ 4,5) | maestros.ts y quien los use | S |
| 2 | Ajustar 9 tokens que fallan (teal, danger, accent, botón primario, bordes) | src/index.css | S |
| 3 | Íconos neón con un solo origen y variante clara | IconosNeon.tsx, PanelInicio.tsx | S |
| 4 | Estados solo por color → añadir símbolo o texto: cupo de tareas (✓ ◐ ✕), «libre» en Reservas, alerta ámbar/roja de casos, categorías del calendario, escala de llegadas tarde, barras «se cita» y «tu grupo», mensajes ok/error de Usuarios | varios | S–M |
| 5 | Botones solo con ícono: aria-label en el encabezado y la planilla | App.tsx, Planilla.tsx | S |
| 6 | Letra mínima de 12 px donde queda 9–11 px (chips de casos, horario, chat) | varios | S |
| 7 | Imprimibles en blanco y negro: citados marcados con «Citado», no solo un tinte rosa | imprimibles-alerta.ts | S |
| 8 | Coherencia de íconos: una sola campana por significado, el ícono de tema muestra la acción, estrella CI unificada, emojis → íconos | App, Horario, Alerta | S |
| 9 | Reducir colores fijos (289) pasando a tokens, por módulo | todos | M–L |

Asistencia (4–7 en src/asistencia) va a la sesión de asistencia.
