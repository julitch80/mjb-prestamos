# PRD — Extensión «MJB → Máster 2000» (centros de interés en la optativa)

Fecha: 2026-11-14 · Estado: **borrador para aprobación de Julián**

## 1. Problema y para quién
El director de grupo copia a mano, estudiante por estudiante, las valoraciones de los
centros de interés (Val, COD1–COD10, F, FJ, Observaciones) desde el Excel que exporta la
app MJB (Asistencia → Centros de interés) hacia la hoja **optativa** de la planilla del
Máster 2000 (p. ej. `Planilla_110200_100-opt_3`). Es lento y propenso a errores.
**Usuario del piloto:** solo Julián (director de 11.2).

## 2. Qué hace (en lenguaje de usuario)
1. Julián instala una extensión en su Chrome, una sola vez.
2. Entra al Máster 2000 como siempre (él pone usuario, contraseña, código y captcha).
3. En la página del Máster aparece un botón **«Llevar centros de interés de MJB»**.
4. Al pulsarlo, la extensión le pide el Excel exportado de MJB (Centros de interés → Exportar Excel)
   y el periodo.
5. La extensión **descarga la planilla actual del Máster** (con las notas que ya tenga), igual que
   hace Julián a mano.
6. Muestra una **vista previa** solo de la hoja optativa: por estudiante, lo que hay hoy en el Máster
   y lo que se va a escribir, con colores: nuevo / igual / distinto / sin dato en MJB.
7. Julián revisa y pulsa **«Subir al Máster»**. La extensión sube la planilla usando el propio
   botón de subida del Máster y muestra el resultado hoja por hoja («11.2 optativa: guardado ✓»).

## 3. Reglas de seguridad (no negociables)
- **Nunca se borra una nota existente.** Si el Máster ya tiene un valor y MJB no trae dato, se deja
  el del Máster. Si ambos tienen valor y son distintos, se marca en la vista previa y por defecto se
  conserva el del Máster; Julián decide caso por caso.
- **Solo se modifica la hoja optativa.** Las demás hojas (Física, Ciencias, etc.) se suben
  exactamente como las descargó el Máster, sin tocar una sola celda.
- **El emparejamiento es por Matrícula**, nunca por orden ni por nombre. Si un estudiante de MJB no
  tiene matrícula o no aparece en la planilla, no se escribe y se lista como «sin emparejar».
- **Si las listas no coinciden en número** (aprobado por Julián 2026-11-14), la extensión cruza por
  matrícula y solo escribe a los que están en ambas listas con valoración:
  - Está en el Máster pero no en MJB (p. ej. matriculado tarde): su fila no se toca (queda vacía o
    con lo que ya tenía el Máster).
  - Está en MJB pero no en el Máster (p. ej. retirado o trasladado): no se escribe en ningún lado.
  - Ambos casos se listan en la vista previa («Solo en el Máster: N» / «Solo en MJB: N») para que
    Julián lo revise. La subida no se bloquea por esto.
- Los estudiantes que MJB marca como «no se digita» (Val 0: plan de apoyo, pendiente, dos centros)
  no se escriben.
- **Nada se sube sin el clic de Julián** después de ver la vista previa.
- La extensión **no guarda contraseñas ni cookies**, y solo actúa en `*.master2000.net`.

## 4. Fuera del alcance (V1)
- Notas de otras asignaturas (Física, etc.).
- Que otros docentes la usen (se evalúa después del piloto).
- Leer los datos directamente de MJB sin el Excel exportado (posible V2).
- Publicarla en la Chrome Web Store (en V1 se instala desde una carpeta, «modo desarrollador»).

## 5. Datos
- **Entrada MJB:** el Excel de Centros de interés (columnas idénticas a la planilla del Máster:
  Estado, Matrícula, Nombre, Ord, Val, COD1–10, F, FJ, Observaciones).
- **Máster:** planilla descargada de «Generar planillas excel» (un archivo con una hoja por
  grupo-materia del docente) y subida en «Subir planillas excel».

## 6. Cómo sabrá Julián que funciona (criterios de aceptación)
1. Con la sesión del Máster abierta, aparece el botón de la extensión en el panel.
2. Al cargar el Excel de MJB de 11.2, la vista previa lista a todos los estudiantes de la
   optativa con su matrícula y lo que se escribirá; los «no se digita» aparecen en gris.
3. Un estudiante con nota ya puesta en el Máster y distinta en MJB aparece resaltado y, si Julián
   no cambia nada, conserva la del Máster.
4. Tras «Subir al Máster», se ve «guardado ✓» por cada hoja, y al abrir la optativa de 11.2 en el
   Máster aparecen las valoraciones y observaciones de MJB.
5. Las notas de Física/Ciencias del mismo periodo quedan idénticas a antes (se comprueba
   descargando la planilla de nuevo y comparando).
6. Primera prueba real: solo la optativa de 11.2, periodo 3, revisada por Julián antes de subir.

## 7. Preguntas abiertas (para cerrar antes de construir)
- ~~¿Las fichas traen la Matrícula?~~ **Cerrada 2026-11-14:** el Excel de 11.2 trae matrícula en los
  33 estudiantes y las 33 coinciden con la optativa del Máster.
- Las filas de notas al pie del Excel de MJB (instrucciones) se ignoran.
- En «no se digita», el texto de Observaciones de MJB (p. ej. «SIN CENTRO DE INTERÉS») es un motivo
  interno y **no** se escribe en el Máster.
- ¿El Máster limita la longitud de «Observaciones»?
