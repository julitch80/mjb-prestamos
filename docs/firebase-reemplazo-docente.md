# Reemplazo de docente (Etapa 5) — modelo puesto vs persona

## La idea

Todo el horario (aulas, direcciones de grupo, acompañamientos, reservas)
no apunta a una persona sino a un **puesto** (`slotId`): el mismo `id`
interno que usan las entradas de `USUARIOS` en `src/data/maestros.ts`
(`julian`, `carlos`, `monica_c`, etc.).

Cada cuenta de Firestore (`users/{email}`) puede tener un `slotId` que
indica qué puesto ocupa esa persona. Reemplazar un docente es entonces
mover el `slotId` de la cuenta saliente a la cuenta entrante — no hay que
tocar horarios, aulas ni grupos uno por uno.

## Qué cubre el reemplazo (cambia al instante)

- Horario del J (por aulas, por docente, por grupo).
- Direcciones de grupo.
- Acompañamientos / Centros de Interés.
- Reservas y disponibilidad de aulas.

Todo esto porque esas vistas leen el puesto (`slotId`), y al iniciar
sesión la app resuelve "quién ocupa cada puesto hoy" con
`aplicarPlantillaFirestore` (`src/data/plantilla.ts`), que parchea
`USUARIOS` con el nombre y correo de quien tiene el `slotId` en Firestore.

## Qué NO cambia

- El **chat interno** conserva el autor real de cada mensaje histórico
  (`authorEmail`/`authorName` quedan como se escribieron). El reemplazo no
  reescribe mensajes pasados.
- Los **registros de auditoría** (`auditLogs`) y el historial de reservas
  ya creados no se alteran retroactivamente.

## Trade-off a tener en cuenta

Los registros **operativos** (horario, aulas, direcciones de grupo)
siempre muestran a **quien ocupa el puesto en este momento**, no a quien
lo ocupaba cuando se generó el dato originalmente. Si Ledis reemplaza a
Carlos en el puesto `carlos`, el horario de "Aula 8" pasará a mostrar a
Ledis inmediatamente — incluso para bloques que ocurrieron antes del
reemplazo, porque no hay una copia histórica por fecha.

## Flujo en el panel de superusuario

1. **Previsualizar**: elegir el docente **saliente** (debe tener `slotId`
   activo) y el **entrante** (activo, sin `slotId` propio). Se llama la
   función `replaceTeacher` con `dryRun: true`, que valida y devuelve un
   resumen de cambios sin escribir nada.
2. Revisar el resumen (puesto que se transfiere, cambios propuestos).
3. **Ejecutar reemplazo**: confirmación explícita (saliente → entrante) y
   llamada a `replaceTeacher` con `dryRun: false`. Esto:
   - Desactiva la cuenta saliente (`active: false`, `slotId: null`,
     `replacedBy`, `replacedAt`).
   - Asigna el `slotId` a la cuenta entrante.
   - Revoca las sesiones activas del saliente (`revokeRefreshTokens`).
   - Registra la operación (éxito o error) en `auditLogs`.

Todo el trabajo de escritura ocurre en la Cloud Function `replaceTeacher`
(`functions/src/index.ts`), solo invocable por un usuario con
`role: 'superusuario'` y `active: true`.

## Límite del modelo: no sirve para altas nuevas con horario propio

El reemplazo mueve un puesto **existente** de una persona a otra
(1 a 1). Si se necesita agregar un **docente completamente nuevo** con su
propio horario (aulas, grupos, bloques que no existían antes), el slot no
alcanza: hay que seguir editando código (`src/data/horarioBase.ts` y
`src/data/maestros.ts`) para crear ese puesto desde cero. El panel de
superusuario solo cubre "esta persona toma el lugar de esa otra persona",
no "esta persona necesita un horario nuevo".
