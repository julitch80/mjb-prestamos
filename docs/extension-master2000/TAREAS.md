# TAREAS — Extensión «MJB → Máster 2000»

Fecha: 2026-11-14 · PRD, PLAN y tareas madre aprobados por Julián.

## 1. Cimientos de la extensión
- [x] 1.1 Carpeta `extension-master2000/` con manifest MV3 (solo `*.master2000.net`), build con
  esbuild y script `npm run build:extension`.
  Hecho cuando: `npm run build:extension` genera `extension-master2000/dist/` con manifest válido.
- [x] 1.2 Script de contenido que agrega el botón «Llevar centros de interés de MJB» al panel.
  Hecho cuando: con `dist/` cargada en Chrome, el botón aparece en `panel.php` (captura de Julián).

## 2. Descubrir la descarga (requiere sesión de Julián)
- [x] 2.1 Identificar el enlace real del botón «Descargar» de «Generar planillas excel».
  Hecho cuando: está documentado aquí con un ejemplo real.
  Evidencia (HAR 2026-11-14 09:11): `GenerarPensumExcel/index.php` declara
  `vDocentes = '<documento>|<nombre>|00|00'`; `GenerarExcelNumericoPensum.php?periodo=3&NroDocumento=<doc>&ciclo=00`
  responde un script con `../../../../Temporal/Exportados/<dane>/<doc>/EXCEL/PLANILLA_EXEL_<doc>_2026_P3_C00_<fecha>.xlsx`;
  GET de esa ruta devuelve el .xlsx. Implementado en `red.ts` (`descargarPlanilla`) con 3 tests simulados.
- [x] 2.2 La extensión baja la planilla del periodo elegido (o plan B: Julián la entrega).
  Hecho cuando: la extensión muestra «Planilla descargada: 14 hojas».

## 3. Cruce y regla «nunca borrar»
- [x] 3.1 Lector del Excel de MJB (ignora las filas de notas al pie).
- [x] 3.2 Lector de la hoja optativa del Máster y cálculo del cambio por matrícula.
  Hecho cuando: prueba con los archivos reales de 11.2 → 15 a escribir, 18 sin centro,
  0 solo-MJB, 0 solo-Máster; conflicto simulado conserva el valor del Máster.

## 4. Edición quirúrgica del .xlsx
- [x] 4.1 Escribir solo las celdas calculadas en la hoja optativa.
  Hecho cuando: prueba automática: las otras 13 hojas idénticas byte a byte, y al releer la
  optativa aparecen las 15 valoraciones.

## 5. Vista previa y subida
- [x] 5.1 Pantalla de vista previa (nuevo / igual / distinto / sin dato; resúmenes).
- [x] 5.2 Subida: `iniciar` + `hoja` solo del índice de la optativa, con resultado visible.
  Hecho cuando: probado contra un servidor simulado que imita las respuestas del registro de red.

## 6. Prueba real con Julián
- [x] 6.1 Optativa 11.2 periodo 3; respuesta «Almacenados… 110200 materia 100»; Julián vuelve a
  descargar y confirma.

## Evidencias (2026-11-14, sesion de construccion; sin tocar el Master real)
- 1.1: `npm run build:extension` genera `extension-master2000/dist/` (content.js + manifest MV3, host solo `*.master2000.net`). 1.2 queda abierta: falta verla en Chrome.
- 3.1/3.2/4.1: `npx vitest run extension-master2000` con los fixtures reales: 15 a escribir, 18 sin centro, 0 soloMJB, 0 soloMaster; conflicto simulado conserva el Master; tras aplicar solo cambia `xl/worksheets/sheet12.xml` (resto identico, contenido descomprimido), la relectura da 15 valoraciones y exceljs abre el resultado.
- 5.1: panel en shadow DOM con vista previa (codigo en `src/content.ts`); falta verlo en Chrome.
- 5.2: `src/red.test.ts` con fetch simulado: `iniciar` y luego solo `indice_hoja=11`; el token se toma del campo `token` de la respuesta de iniciar y se envia como `token_pensum`; sin token, respuesta no JSON u hoja ausente: se detiene sin guardar.
- 2.2 pendiente: `descargarPlanilla()` es un TODO; por ahora el usuario entrega la planilla (plan B).
- 1.2/2.2/6.1 (2026-11-14, con Julián): botón visible en el panel; descarga automática del periodo 3; subida real «Almacenados… 110200 materia 100 periodo 3». Captura del Máster 10:10: 15 estudiantes con Val y códigos 6xx (7xx/8xx convertidos: 702→602, 880→680, 888→688), coincidentes con MJB.
- Hallazgo: el Máster solo acepta códigos 600 en la optativa → la extensión convierte 7xx/8xx a 6xx; pedido a Asistencia en docs/pedidos-asistencia/codigos-ci-solo-600.md.
