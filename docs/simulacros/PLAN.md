# PLAN técnico — Simulacros configurables (etapa 1)

Base: PRD.md (aprobado 12-oct-2026). Fecha límite: simulacro del 21-oct-2026.

## Idea

- **Lo fijo del 2026** (guion de 15 pasos en minutos relativos a la alarma, rutas, roles, misiones,
  lista de preparación, funciones) se transcribe de la guía HTML a `src/data/simulacros/plantillaSismo2026.ts`.
  En la etapa 2 pasará a ser editable.
- **Lo que cambia** (fecha, hora por jornada, encargados, avisos del 123, estado) vive en Firestore,
  en `simulacros/{id}`, y la app lo escucha en vivo: cualquier cambio llega a todos sin recargar.
- **Los cambios solo los hace el servidor** (función `simulacroCambiar`), que verifica quién
  puede editar qué jornada, guarda el registro y envía la notificación a quien se asigna.

## Datos

`simulacros/{id}`:
```
{ titulo, sede:'principal', evento:'sismo', plantilla:'sismo2026', estado:'borrador'|'publicado'|'ejecutado'|'archivado',
  nacional: { fecha:'2026-10-21', hora:'10:00' },
  editores: { manana:[slotIds], tarde:[slotIds] },          // manana: julian, coord_manana · tarde: coord_tarde, hugo
  jornadas: { manana: { fecha, hora, motivo?, llamada123?: {hecho, por, cuando} },
              tarde:  { fecha, hora, motivo?, llamada123? } },
  asignaciones: { [puestoId]: { manana?: {slot|null, porConfirmar?}, tarde?: {...} } },
  actualizado }
```
`simulacros/{id}/cambios/{auto}`: `{ por, cuando, tipo:'hora'|'fecha'|'asignacion'|'llamada123'|'estado', jornada, antes, despues, motivo }`.

Aviso del 123 = (fecha, hora) de la jornada ≠ `nacional` y `llamada123.hecho` no es true.

## Piezas

| Pieza | Dónde |
|---|---|
| Plantilla 2026 transcrita de la guía | `src/data/simulacros/` |
| Cálculo de horas, aviso 123, «Mi rol» (funciones puras + pruebas) | `src/data/simulacros/` |
| Guía en React con el diseño actual (estilos encapsulados) | `src/components/simulacros/` |
| Pestaña «Simulacros» en Gestión del riesgo | `GestionRiesgo.tsx` |
| Panel «Día del simulacro» (hora/fecha, 123, reasignar) para editores | `src/components/simulacros/` |
| `simulacroCambiar` (llamable) + notificación al reasignado | codebase nuevo `functions-simulacros` |
| Reglas: lectura usuarios activos; escritura solo funciones | `firestore.rules` + pruebas |
| Creación de la ficha 2026 | botón del superusuario «Crear simulacro 2026» (usa la función) |

## Verificación

Pruebas automáticas (horas recalculadas, aviso 123, permisos por jornada en reglas y en la función)
y prueba con Julián de los 7 criterios del PRD antes del 21-oct.
