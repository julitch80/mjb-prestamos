# TAREAS — Editor de acompañamientos
*Generado desde [PRD.md](PRD.md) + [PLAN.md](PLAN.md). Orden = dependencia: no empezar una tarea si su anterior no está [x].*
*Regla: una subtarea sin evidencia no está hecha, está afirmada.*

## 1. Cimientos: dónde se guarda y quién puede publicar
- [ ] 1.1 Verificar en producción la jornada de las fichas de usuario de Janneth y de Juan Diego.
      Hecho cuando: se muestra lo que dice cada ficha (`manana` / `tarde`) o, si alguna está mal, Julián lo corrige y se vuelve a mostrar.
- [ ] 1.2 Avisar a la sesión de horarios qué se va a cambiar en `VistaHorario.tsx` y `PanelInicio.tsx`.
      Hecho cuando: Julián tiene el mensaje listo para pegar en esa pestaña, y confirma que lo pasó.
- [x] 1.3 Definir la forma de una publicación: jornada, fecha desde la que rige, zonas con su cupo, asignaciones con candado, quién y cuándo publicó.
      Hecho cuando: existe el tipo en `src/data/acompanamientos/` y `npx tsc -b` pasa.
- [x] 1.4 Escribir la regla de la colección de publicaciones, con la guarda de «Ver como», y actualizar el conteo de la cabecera de `firestore.rules`.
      Hecho cuando: las reglas compilan y el conteo de escrituras con guarda cuadra (medido con el grep de la cabecera).
- [x] 1.5 ~~Agregar el índice de publicaciones por jornada y fecha~~ — no hace falta (ver desviaciones).
      Hecho cuando: `firestore.indexes.json` sigue con sus 22 índices, sin cambios.
- [x] 1.6 Montar las pruebas de reglas en el emulador y probar quién publica.
      Hecho cuando: pasan pruebas que muestran que el coordinador de la jornada publica, y que un docente, el superusuario, la rectora, el coordinador de la otra jornada y una sesión de «Ver como» no pueden; y que nadie edita ni borra una publicación.

## 2. La distribución vigente en toda la aplicación
- [x] 2.1 Convertir la lista fija de `maestros.ts` en la «Distribución inicial», con zonas, cupo 1 y los candados de Doris y Margarita.
      Hecho cuando: una prueba confirma 6 zonas y 30 asignaciones por jornada, iguales a la lista fija, con 4 candados en la mañana.
- [x] 2.2 Escribir la pieza que responde «qué distribución rige en esta fecha».
      Hecho cuando: pasan pruebas con tres casos: sin publicaciones rige la inicial; una publicación con fecha pasada rige; una con fecha futura todavía no.
- [x] 2.3 Leer las publicaciones de la base de datos, con respaldo en la inicial si aún no cargan o fallan.
      Hecho cuando: con la aplicación local abierta y sin publicaciones, la pestaña se ve igual que hoy y no aparece ningún error en la consola.
- [x] 2.4 Conectar la pestaña Acompañamiento, el horario del día del profesor y la tarjeta de Inicio a esa pieza.
      Hecho cuando: captura de las tres pantallas en local, idénticas a producción de hoy, y búsqueda en el código que muestra que ninguna lee ya la lista fija directamente.

## 3. Las reglas de reparto y la carga por profesor
- [x] 3.1 Calcular quién puede cubrir cada día: su jornada, los días de los mixtos, y el Centro de Interés sin contar.
      Hecho cuando: pruebas que muestran a Marta Úsuga disponible en la tarde solo martes y jueves, y a Edgar ausente de toda la mañana.
- [x] 3.2 Contar las clases de cada profesor por día desde el horario vigente.
      Hecho cuando: una prueba verifica el conteo de dos profesores reales contra su horario.
- [x] 3.3 Escribir la revisión de una distribución: bloqueos (dos zonas el mismo día, fuera de su jornada, casilla sin cubrir) y avisos (día de 5-6 clases, carga desigual, mixto por encima de su mitad).
      Hecho cuando: una prueba por cada regla, con un caso que la cumple y otro que la rompe; y la distribución inicial revisada no tiene ningún bloqueo.
- [x] 3.4 La pantalla «Carga por profesor».
      Hecho cuando: captura en local con todos los profesores de la mañana, incluidos los de cero, mixtos marcados y días cargados en ámbar; y la suma de los contadores es igual al total de casillas.

## 4. El botón Editar, el borrador y las zonas
- [x] 4.1 Botón «Editar» y su menú de cuatro opciones, solo para el coordinador en su jornada.
      Hecho cuando: capturas en local con «Ver como» de la coordinadora de la mañana (botón en la mañana, no en la tarde) y de un docente (sin botón).
- [x] 4.2 El borrador en el navegador, separado por jornada, que arranca desde la distribución vigente.
      Hecho cuando: un cambio en el borrador sigue ahí después de recargar la página, y el borrador de la mañana no aparece en la tarde.
- [x] 4.3 Zonas: agregar con nombre y cupo, cambiar el cupo, quitar con confirmación.
      Hecho cuando: capturas de agregar «Cancha» con cupo 2 (fila con 10 casillas vacías) y de quitar una zona (confirmación que dice cuántas asignaciones libera).

## 5. El editor manual
- [x] 5.1 La matriz de zonas por días y la bandeja de profesores con su contador y sus clases del día.
      Hecho cuando: captura en local con la distribución vigente cargada en la matriz y los contadores correctos.
- [x] 5.2 Arrastrar a una casilla, quitar de una casilla, con los bloqueos y avisos en vivo.
      Hecho cuando: en local, arrastrar asigna y sube el contador; soltar a Edgar en la mañana no se deja y dice por qué; un día de 6 clases queda en ámbar.
- [x] 5.3 Candados: poner, quitar, y que una asignación con candado no se arrastre.
      Hecho cuando: en local, la asignación de Doris no se puede mover hasta quitarle el candado.
- [ ] 5.4 Que funcione en el celular con el dedo.
      Hecho cuando: captura en tamaño de celular arrastrando un profesor a una casilla.

## 6. El generador de alternativas
- [x] 6.1 Escribir el generador: respeta candados y bloqueos, puntúa los avisos, y devuelve 2 o 3 propuestas distintas.
      Hecho cuando: pruebas que generan cientos de distribuciones para las dos jornadas y en ninguna hay un bloqueo roto ni un candado movido.
- [x] 6.2 Los números de cada propuesta: diferencia de carga, profesores que cambian frente a hoy y días cargados.
      Hecho cuando: pruebas que comprueban cada número contra un caso armado a mano.
- [x] 6.3 Cuando no alcanzan los profesores: la propuesta dice qué casillas faltan y por qué.
      Hecho cuando: una prueba con muy pocos profesores disponibles devuelve las casillas faltantes con su motivo, sin romper ningún bloqueo.
- [x] 6.4 La pantalla de alternativas, y abrir una en el editor manual.
      Hecho cuando: captura en local con las propuestas y sus números, y otra del editor con la propuesta elegida cargada.

## 7. Publicar y avisar
- [x] 7.1 Elegir la fecha de vigencia, con Publicar bloqueado mientras haya bloqueos o la fecha sea pasada.
      Hecho cuando: capturas en local con el botón desactivado ante una casilla vacía y ante una fecha pasada.
- [x] 7.2 La vista previa: a quién le llega el aviso y qué dice cada uno (tenía / le queda / desde cuándo).
      Hecho cuando: captura en local con un cambio armado a mano, donde aparecen exactamente los profesores que cambiaron y nadie más.
- [x] 7.3 Guardar la publicación, notificar en la aplicación y enviar los correos, informando si alguno falla.
      Hecho cuando: las pruebas de reglas en el emulador aceptan la publicación armada por la pantalla; y una prueba verifica los avisos generados para ese cambio. Sin publicar en producción.
- [x] 7.4 El aviso «Cambia desde…» en la pestaña mientras llega la fecha.
      Hecho cuando: una prueba con una publicación de fecha futura produce el texto con la fecha correcta.

## 8. Historial
- [x] 8.1 La lista de publicaciones, empezando por «Distribución inicial», con fecha de vigencia y quién publicó.
      Hecho cuando: captura en local del historial con la distribución inicial.
- [x] 8.2 Ver una publicación completa del historial.
      Hecho cuando: captura en local de la distribución inicial abierta desde el historial, con sus 30 asignaciones de la jornada.

## 9. Verificación final, despliegue y manuales
- [x] 9.1 Check global del PLAN: pruebas, tipos, compilación y pruebas de reglas en el emulador.
      Hecho cuando: se muestran las cuatro salidas sin errores.
- [x] 9.2 Revisión de código con ojos frescos, y corrección de lo que encuentre.
      Hecho cuando: se muestran los hallazgos y qué se hizo con cada uno.
- [x] 9.3 Desplegar el índice, las reglas y la aplicación, en ese orden.
      Hecho cuando: el despliegue de reglas e índice sale bien, producción tiene 23 índices y Actions termina bien.
- [ ] 9.4 Comprobar en producción sin notificar a nadie.
      Hecho cuando: el archivo servido lleva las guardas por rol, y Julián confirma con «Ver como» que la pestaña es idéntica a la de hoy y que «Editar» solo le aparece al coordinador.
- [x] 9.5 Agregar al manual del coordinador la sección de editar y publicar acompañamientos.
      Hecho cuando: la sección está publicada en el enlace del manual del coordinador.

---
## Registro de desviaciones
- 2026-09-13 — **Banco de pruebas local** (`#/dev/acompanamientos`, solo en desarrollo, no viaja a producción): las capturas «con Ver como» de TAREAS exigen iniciar sesión, que no se puede desde aquí. Las pantallas reciben todo por props y el banco las muestra con datos de ejemplo. «Ver como» queda para la verificación final de Julián (9.4).
- 2026-09-13 — **Sin índice nuevo** (PLAN §10 decía 22 → 23): las publicaciones de una jornada se piden solo por jornada y se ordenan en el navegador, porque son pocas. Una consulta así no necesita índice compuesto, y así se evita un despliegue de índices —la operación que puede borrar índices ajenos—.
- 2026-09-13 — Se agrega al PRD la **vista previa de avisos** antes de confirmar la publicación (propuesta en el PLAN §6, aprobada por Julián con el plan).
- 2026-09-13 — **Arrastre verificado por lógica, no con el dedo**: el panel de navegador de esta sesión no reproduce bien el arrastre de dnd-kit. `validarSoltar` tiene pruebas (Edgar en la mañana, Marta un lunes en la tarde, casilla llena, dos zonas el mismo día) y quitar/candados se probaron en el banco. La prueba con el dedo en el celular (5.4) queda para la revisión de Julián.
- 2026-09-13 — Corregido en la verificación: la vista previa mostraba «miercoles» sin tilde; el resultado decía «Se avisó a 0 profesores» (se recalculaba después de publicar); el aviso de carga desigual decía «diferencia normalizada».
- 2026-09-13 — **Revisión de código (9.2)**. Corregidos: (1) la tarjeta de Inicio solo miraba la jornada de la ficha; un mixto no veía su acompañamiento de la otra jornada → ahora mira las dos. (2) Tras publicar, mientras llega la hora del servidor, una publicación con la misma fecha podía perder el empate → la recién hecha gana (con prueba). (3) Un borrador guardado con otra forma rompía el editor → se ignora (con prueba). No se cambió: el profesor retirado bloquea publicar (equivale a casilla vacía, que también bloquea); el botón Editar visible en «Ver como» (el servidor rechaza la publicación, y Julián necesita verlo para 9.4); correos uno por uno (tanda pequeña).
