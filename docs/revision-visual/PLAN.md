# Plan de revisión visual — Plataforma MJB (26-oct-2026)

Pedido de Julián: revisar la estética y la ayuda visual en los modos claro y oscuro, de modo que
el color apoye la lectura (sobre todo a quien distingue mal ciertos colores o letras), y que los
íconos sean intuitivos y correspondan a su contenido.

## Parámetros (medibles)
1. **Contraste WCAG 2.2 AA**: texto ≥ 4,5:1 (grande ≥ 3:1); íconos, bordes de controles y
   estados ≥ 3:1. Se mide en **ambos modos**.
2. **El color no es la única señal (WCAG 1.4.1)**: todo estado con color (presente/ausente,
   alerta, libre/ocupado, aprobado/rechazado, vencido) lleva además ícono, letra o forma.
3. **Daltonismo**: pares de colores con significado que se confunden en protanopía,
   deuteranopía o tritanopía (simulación por fórmula, matrices de Machado 2009).
4. **Íconos**: ¿se entiende sin etiqueta? ¿el mismo ícono = lo mismo en toda la app? ¿lleva
   texto cuando no es obvio? ¿lo que hay detrás corresponde a lo que promete?
5. **Coherencia**: tokens semánticos en lugar de colores fijos; una escala de letra; los
   colores por aula, grado y rol (CLAUDE.md) legibles también en modo claro.

## Fases
| Fase | Qué | Informe |
|---|---|---|
| 0 | Tokens y paletas: script que calcula el contraste de cada texto sobre cada fondo en claro y oscuro, colores fijos en el código, y simulación de daltonismo de las paletas con significado | `0-tokens-contraste.md` + script en `scripts/revision-visual/` |
| A–E | Por módulo (mismos lotes de docs/revision-ux): color como única señal, íconos, coherencia visual, modo claro | `A-…md` … `E-…md` |
| Final | Resumen con las mejoras priorizadas | `RESUMEN.md` |

Solo lectura del código de la app. Capturas en el navegador solo donde haya banco de pruebas
sin sesión real.
