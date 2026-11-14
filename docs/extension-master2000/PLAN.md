# PLAN técnico — Extensión «MJB → Máster 2000»

Fecha: 2026-11-14 · Basado en el PRD aprobado (mismo directorio) · Estado: **para aprobación**

## Decisiones (y qué significan para Julián)

1. **Extensión de Chrome (Manifest V3), instalada desde una carpeta.**
   Se instala una vez en `chrome://extensions` → «Modo desarrollador» → «Cargar descomprimida».
   No pasa por la tienda de Google ni la ve nadie más. Para actualizarla basta con pulsar «⟳».

2. **Solo actúa en `*.master2000.net`** y usa la sesión que Julián ya abrió. No pide usuario ni
   contraseña ni guarda cookies; si la sesión del Máster vence, la extensión lo dice y se detiene.

3. **Descarga de la planilla:** repite lo que hace Julián en «Generar planillas excel»
   (`GenerarExcelNumericoPensum.php?periodo=…&NroDocumento=…&ciclo=00`, luego «Descargar»).
   El enlace exacto de «Descargar» no quedó en el registro de red: es lo primero que se comprueba
   (tarea 1). Si no se puede automatizar, plan B: Julián descarga la planilla como hoy y se la
   entrega a la extensión (un paso más, el resto igual).

4. **Edición quirúrgica del Excel.** Se abre el archivo del Máster como un paquete y se cambian
   **solo** las celdas necesarias de la hoja optativa; todo lo demás (otras hojas, protección,
   formatos) queda byte a byte igual. Consecuencia: el Máster recibe su propio archivo con unas
   celdas más, no un Excel "rehecho" que pueda rechazar.

5. **Subida solo de la hoja optativa.** El Máster guarda hoja por hoja cuando el navegador se lo
   pide (`accion_pensum=iniciar` y luego `accion_pensum=hoja&indice_hoja=N`). La extensión pide
   guardar **únicamente** el índice de la hoja optativa del grupo. Consecuencia: Física, Ciencias
   y las demás hojas **ni siquiera se vuelven a guardar**; el riesgo sobre otras notas es cero.
   (Se verifica en la prueba de la tarea 5; si el Máster exigiera todas, se suben intactas.)

6. **Lógica separada y probada sin el Máster.** El cruce por matrícula, la regla «nunca borrar» y
   la edición del Excel van en un módulo con pruebas automáticas que usan la planilla y el Excel
   reales de hoy (copias en `fixtures/`, fuera de git por tener datos de estudiantes).

7. **Dónde vive:** carpeta `extension-master2000/` dentro de este repo, con su propio build. No se
   publica con la app (GitHub Pages no la toca). Librería única: `fflate` (abrir/cerrar el .xlsx).

## Cómo se corre en Windows 11
- `npm run build:extension` genera `extension-master2000/dist/`.
- Chrome → `chrome://extensions` → Modo desarrollador → Cargar descomprimida → elegir `dist/`.

## Check de verificación global (de punta a punta)
1. Pruebas automáticas: con la planilla real y el Excel de 11.2, el resultado escribe exactamente
   las 15 valoraciones, no toca las otras 13 hojas (comparación byte a byte) ni las 18 filas «sin
   centro».
2. Prueba real, con Julián mirando: optativa 11.2 periodo 3 → vista previa → subir → el Máster
   responde «Almacenados… grupo 110200 materia 100» y **solo esa hoja**.
3. Julián descarga de nuevo la planilla y confirma que la optativa trae las notas y que las demás
   hojas quedaron igual.

## Riesgos
- El Máster cambia su página o sus direcciones → la extensión falla con un mensaje claro y no sube
  nada (se comprueba la respuesta antes de cada paso).
- Términos de uso del Máster: la extensión hace lo mismo que el docente hace a mano, en su sesión
  y con su clic; no hay acceso masivo ni robot sin supervisión.
