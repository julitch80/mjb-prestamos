# Botón atrás de Android — cómo participar del historial

Julián reportó (2026-08-26) que el botón atrás del celular **cierra la aplicación** en
vez de volver a la pantalla anterior, salvo en los sitios donde hay un "volver" propio.

## La causa

La app no usaba el historial del navegador en absoluto: ni router, ni `pushState`, ni
`popstate`, ni en el núcleo ni en `src/asistencia/`. Toda la navegación vivía en estado
de React/Zustand, así que para el navegador **el usuario nunca se movió**: una sola
entrada en el historial, la de cuando abrió la app. Android hacía lo correcto con lo que
sabía — no hay página anterior, luego salir.

## Lo ya hecho en MJB (nivel 1)

`src/hooks/useHistorialDeVistas.ts`, enganchado en `App.tsx`. Sincroniza **las secciones
de primer nivel** (las del menú: Inicio, Horario, Asistencia, Tareas, Gestión del
Riesgo…) con el historial:

- Al montar, `replaceState` con la vista inicial — no `pushState`, o habría que pulsar
  atrás dos veces para salir desde Inicio.
- Cada cambio de sección hace `pushState`.
- `popstate` restaura la sección anterior, con una marca (`vieneDelHistorial`) para no
  volver a apilar la entrada y quedar rebotando.
- Si la entrada del historial no trae `vista`, no se toca nada: el navegador sigue su
  curso, que desde Inicio significa salir. Ese es el comportamiento esperado.

**Esto NO cubre las pantallas internas.**

## Lo que falta, y por qué lo tiene que hacer la sesión de asistencia

Dentro de una sección hay pantallas que el usuario percibe como niveles de navegación,
pero que son estado interno de un componente. En `src/asistencia/` al menos:

- La planilla de clase, la de evento y la de centro de interés.
- El mosaico de fotos.
- Programas → lista de centros → un centro.
- Pendientes de un programa, y el detalle de un pendiente.
- La ficha de un estudiante, la carga de fotos, la importación.
- El cuaderno de dirección de grupo.

En todas ellas, hoy, atrás **cierra la app**.

`src/asistencia/` se sincroniza desde el repo de asistencia: si lo modifico desde MJB, la
próxima entrega borra el trabajo. Por eso el nivel 2 lo hace esa sesión.

## Cómo hacerlo (contrato sugerido)

El patrón es el mismo del nivel 1, aplicado al estado que actúa como "pantalla". Para
cada componente con navegación interna:

1. Cuando se entra a una subpantalla, `window.history.pushState({ ... }, '')` con lo
   necesario para reconstruirla.
2. Escuchar `popstate` y restaurar ese estado interno en vez de dejar salir el evento.
3. Usar una marca tipo `vieneDelHistorial` para no volver a apilar al restaurar, o el
   botón atrás se queda girando sobre la misma pantalla.
4. El "volver" propio que ya existe debe hacer `history.back()` en lugar de solo cambiar
   el estado, para que ambos caminos —el botón de la app y el del teléfono— dejen el
   historial coherente. Si no, se acumulan entradas fantasma.

**Punto importante a acordar:** conviene que las entradas del nivel 2 lleven una marca
propia (por ejemplo `{ asistencia: 'planilla', ... }`) y NO el campo `vista`, que es el
que usa el hook de MJB. Si ambos usaran la misma clave, el hook de primer nivel creería
que una vuelta dentro de asistencia es un cambio de sección y cambiaría la pantalla
entera.

Si prefieren, MJB puede exponer un hook genérico reutilizable
(`usePasoDeHistorial(activo, alVolver)`) para no repetir la mecánica en cada pantalla.
Decidir eso antes de empezar evita dos implementaciones distintas del mismo patrón.

## Dos límites que conviene no prometer

- **En iPhone cambia poco.** Una PWA instalada en iOS no tiene botón atrás, y el gesto
  de deslizar no actúa en modo aplicación.
- **Desde Inicio, atrás seguirá cerrando la app**, y así debe ser: es el comportamiento
  estándar de Android. Se puede añadir un "pulsa otra vez para salir", pero suele
  molestar más de lo que ayuda.
