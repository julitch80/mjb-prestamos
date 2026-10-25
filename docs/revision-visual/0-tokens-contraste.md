# Fase 0 — Tokens, contraste y daltonismo (medido)

Todo lo de abajo sale de `py -3.12 -I scripts/revision-visual/contraste.py` (lee `src/index.css`,
`src/data/maestros.ts` y CLAUDE.md). No se tocó nada de `src/`.

**Cómo leer los números.** El contraste va de 1 (invisible) a 21 (negro sobre blanco). Para texto
normal hace falta **4,5 o más** (PASA); para bordes e íconos, **3 o más**. En modo oscuro las
pastillas con transparencia (`-soft`) se midieron ya mezcladas con el fondo de la tarjeta.

Dónde viven los colores: `src/index.css` (bloque `@theme` = claro; bloque `.dark` = oscuro).
Los grados ya usan tokens (`--color-grado-N`); **aulas y roles NO**: están fijos en
`src/data/maestros.ts` (`COLORES_AULA`, `color:` de cada usuario), con colores pensados para fondo oscuro.

## 1. Tokens de texto sobre fondos (13 fallas de 80 combinaciones)

Fondos: app, card (tarjeta), elevated (inputs/pastillas), hover. Los pares de uso normal
(texto sobre `app` y `card`) casi todos PASAN; fallan sobre `elevated` y `hover`, y el `teal` entero.

| Modo | Texto | Fondo | Contraste | Resultado |
|---|---|---|---|---|
| claro | teal #0d9488 | hover | 3,05 | FALLA |
| claro | teal | elevated | 3,31 | FALLA |
| oscuro | danger #ef4444 | hover | 3,42 | FALLA |
| oscuro | accent #3b82f6 | hover | 3,50 | FALLA |
| claro | teal | app / card | 3,52 / 3,74 | FALLA |
| oscuro | danger | elevated | 4,05 | FALLA |
| claro | success #15803d | hover | 4,08 | FALLA |
| claro | warning #b45309 | hover | 4,09 | FALLA |
| oscuro | accent | elevated | 4,15 | FALLA |
| claro | accent #2563eb | hover | 4,21 | FALLA |
| claro | success / warning | elevated | 4,43 / 4,44 | FALLA (por 0,07) |

Otros resultados:
- **Botón primario en modo oscuro**: letra blanca sobre `accent` #3b82f6 = **3,68 FALLA** (en claro pasa).
- **Bordes** (`line`, `line-strong`) contra la tarjeta: claro 1,36 y 1,95; oscuro 1,23 y 1,74. Todos
  FALLAN el 3:1 pedido para bordes de controles (son aceptables solo como divisores decorativos).
- strong, soft, muted, info y todas las pastillas `-soft-fg` PASAN en ambos modos.

## 2. Colores fijos de aulas y roles en modo claro (todos fallan)

Sobre tarjeta blanca. En modo oscuro los 15 valores pasan (son pasteles); el problema es solo el claro.

| Elemento | Hex fijo | Contraste en claro |
|---|---|---|
| Sala Info. | #f1f5f9 | **1,10** (casi invisible) |
| Docente (rol) | #86efac | 1,40 |
| Aula 9 | #a3e635 | 1,51 |
| Rectora (rol) | #e8c84a | 1,64 |
| Aula 5 | #fbbf24 | 1,67 |
| Aula 10 | #fdba74 | 1,69 |
| Aula 7 | #22d3ee | 1,81 |
| Aula 2 | #34d399 | 1,92 |
| Aula 3 | #fb923c | 2,26 |
| Aula 1 | #60a5fa | 2,54 |
| Coordinador (rol) | #f08080 | 2,59 |
| Aula 6 | #f472b6 | 2,65 |
| Aula 4 | #a78bfa | 2,72 |
| Aula 8 | #f87171 | 2,77 |
| Lab. Ciencias | #ff4444 | 3,41 |

**Grados**: ya están bien resueltos (tokens). Todos pasan en ambos modos.

## 3. Colores de texto fijos en el código (rompen el modo claro)

Total **289** usos en **55 archivos**: 97 `color:'#…'`, 92 `color: #…` (CSS/HTML impreso),
61 `text-white/black`, 36 `text-slate-…`/`text-red-…` etc., 3 `text-[#…]`.

Ojo: no todos son errores. Los `color: #…` de `imprimibles-*`, `publicacion.ts`, `horarioModificado.ts`
son hojas para imprimir/PDF sobre papel blanco (correcto). Los que sí hay que revisar:

| Usos | Archivo | Qué es |
|---|---|---|
| 53 | `src/data/maestros.ts` | colores de docentes y aulas (fijos para fondo oscuro) |
| 31 | `src/components/AgendaProyeccion.tsx` | text-white + paleta + 3 text-[#…] |
| 18 | `src/components/IconosNeon.tsx` | íconos neón (necesitan par claro/oscuro) |
| 11 | `src/components/PanelInicio.tsx` | colores de tarjetas del menú |
| 9 | `src/components/EditorHorarioMode.tsx` | text-white / text-paleta |
| 9 | `src/components/ModalAcortarJornada.tsx` | text-white + CSS |
| 8 | `src/components/VistaHorario.tsx` | text-white / paleta |
| 7 | `src/data/calendarioAcademico/tipos.ts` | colores de tipos de evento |
| 6 | `src/components/Asistentes.tsx` | colores de tarjetas |
| 5 | `src/components/ui/button.tsx` | text-white en botones base |
| 3 | `src/asistencia/MosaicoGrupo.tsx` | color en pantalla |

(Lista completa de los 20 primeros: salida del script.)

## 4. Daltonismo (diferencia perceptual deltaE < 15 tras simular)

Referencia: con visión normal, una pareja bien distinta tiene deltaE > 30.

**Presente/ausente, libre/ocupado (verde vs rojo)**
- Modo claro: success/danger NO se confunden (0 casos en disponibilidad).
- Modo oscuro: **verde #22c55e vs rojo #ef4444 en deuteranopia: deltaE 12,8 (CONFUNDE)**. Es la pareja
  más importante de la app y justo la más común de daltonismo (cerca del 5 % de los hombres).
  Medido: con rojo #f87171 (el danger propuesto) el deltaE en deuteranopia baja a 4,7, es decir
  cambiar el tono no arregla nada:
  **hay que añadir ícono o letra** (✓ / ✗, P / A), como pide el parámetro 2 del plan.

**Otras parejas semánticas (casos más graves)**
- accent <> purple, deuteranopia (claro): deltaE 1,9. info <> purple, deuteranopia (oscuro): 0,4.
- info <> accent: 6,9 a 10,8 en los tres tipos (son casi el mismo azul; no usar como dos significados).
- danger <> warning, deuteranopia (claro): 9,9. success <> teal, tritanopia: 9,8 a 10,6.

**Grados** (siguen siendo distinguibles por el número "6º…11"; el color es refuerzo)
- 7 <> 9 (azul vs púrpura), deuteranopia: 1,2 claro / 1,8 oscuro.
- 8 <> 10 (naranja vs ámbar), deuteranopia 2,8 / protanopia 6,9 (claro).
- 6 <> 10 (8,1) y 6 <> 8 (10,8) claro; 6 <> 11 (7,8) y 8 <> 11 (6,4) oscuro.

**Aulas** (12 colores, 10 casos de confusión)
- Aula 1 <> Aula 4 (azul vs violeta), deuteranopia: **0,4** (idénticas).
- Aula 5 <> Aula 10 (amarillo vs durazno), tritanopia: 3,1. Aula 5 <> Aula 9: 7,7.
- Aula 2 <> Aula 7 (menta vs cian), tritanopia: 8,3. Aula 3 <> Aula 9: 11,5.
- Aula 6 <> Aula 8 y Aula 3 <> Aula 6/8 (rosa, coral, naranja), tritanopia: 12 a 14.
Conclusión: **12 colores no se pueden distinguir solo por color**. El nombre/número del aula debe ir
SIEMPRE escrito junto al color (hoy se cumple en las tablas; verificar en las vistas compactas).

## 5. Propuesta concreta

### 5.1 Tokens (`src/index.css`) — valores nuevos con contraste calculado

| Token | Antes | Nuevo | Contraste nuevo (card / elevated / hover) |
|---|---|---|---|
| claro `--color-teal` | #0d9488 | **#0f766e** | 5,47 / 4,83 / 4,45 |
| claro `--color-success` | #15803d | **#166534** | 7,13 / 6,30 / 5,80 |
| claro `--color-warning` | #b45309 | **#92400e** | 7,09 / 6,26 / 5,77 |
| claro `--color-accent` | #2563eb | **#1d4ed8** | 6,70 / 5,92 / 5,45 |
| oscuro `--color-danger` | #ef4444 | **#f87171** | 6,27 / 5,51 / 4,65 |
| oscuro `--color-accent` | #3b82f6 | **#60a5fa** | 6,82 / 6,00 / 5,06 |
| oscuro `--color-accent-fg` (letra del botón) | #ffffff | **#0a0e1a** | sobre #3b82f6: 5,24; sobre #60a5fa: 7,57 |
| claro `--color-line-strong` (bordes de controles) | #b3bac8 | **#8590a5** | 3,22 sobre card |
| oscuro `--color-line-strong` | #3a425a | **#6b7690** | 3,81 sobre card |

(`--color-line` queda como divisor decorativo; los inputs y botones con borde usan `line-strong`.)
Nota: el nuevo `danger` oscuro NO mejora la confusión con `success` en deuteranopia (4,7); sube el
contraste de texto, nada más. El arreglo real es ícono o letra junto al color.

### 5.2 Aulas y roles: pasar a tokens con par claro/oscuro

Mantener los valores actuales en oscuro (ya pasan) y agregar variantes para claro (todas ≥ 4,5 sobre
tarjeta y sobre `elevated`):

| Elemento | Oscuro (queda) | Claro nuevo | Contraste claro (card / elevated) |
|---|---|---|---|
| Aula 1 | #60a5fa | #1d4ed8 | 6,70 / 5,92 |
| Aula 2 | #34d399 | #047857 | 5,48 / 4,84 |
| Aula 3 | #fb923c | #b8390a | 5,79 / 5,11 |
| Aula 4 | #a78bfa | #6d28d9 | 7,10 / 6,28 |
| Aula 5 | #fbbf24 | #92400e | 7,09 / 6,26 |
| Aula 6 | #f472b6 | #be185d | 6,04 / 5,33 |
| Aula 7 | #22d3ee | #0e7490 | 5,36 / 4,73 |
| Aula 8 | #f87171 | #b91c1c | 6,47 / 5,71 |
| Aula 9 | #a3e635 | #3f6212 | 7,08 / 6,25 |
| Aula 10 | #fdba74 | #854d0e | 6,85 / 6,05 |
| Sala Info. | #f1f5f9 | #475569 | 7,58 / 6,69 |
| Lab. Ciencias | #ff4444 | #991b1b | 8,31 / 7,34 |
| Rectora | #e8c84a | #7a5f00 | 6,06 / 5,35 |
| Coordinador | #f08080 | #b91c1c | 6,47 / 5,71 |
| Docente | #86efac | #166534 | 7,13 / 6,30 |

Advertencia medida: al oscurecer, las aulas se parecen más entre sí para el daltonismo (34 parejas
< 15 en la simulación del claro). Por eso el color de aula es un **refuerzo**; el nombre escrito es
la señal principal.

### 5.3 Orden sugerido de ataque
1. Cambiar los 9 tokens de 5.1 (una sola edición de `index.css`, riesgo bajo).
2. Mover `COLORES_AULA` y colores de rol a tokens `--color-aula-N` / `--color-rol-X` con par claro/oscuro.
3. En los módulos A–E: reemplazar `text-white`/`text-slate-*` por tokens, y agregar ícono o letra a
   todo par verde/rojo, presente/ausente, libre/ocupado.
4. Dejar sin tocar los `color: #…` de hojas impresas (papel blanco).
