# PLAN — Reemplazo temporal de docente

Base: PRD.md (aprobado por Julián el 5-oct-2026, «urgente: hay un reemplazo real»).

## Idea (en lenguaje de Julián)

- Se reutiliza el modelo de **puesto** que ya existe: el reemplazo recibe el `slotId` del titular,
  así hereda horario, tareas, asistencia, etc. sin tocar nada más.
- El titular queda con su cuenta activa pero **sin puesto** y marcado `soloLectura`, con la fecha
  de regreso. Las reglas de Firebase ya bloquean escrituras en el modo «Ver como»: se amplía esa
  misma barrera al titular en solo lectura.
- El Apps Script deja de usar su lista fija de «correo → puesto»: le pregunta a Firebase, con la
  propia sesión del usuario, qué puesto ocupa y si está en solo lectura (o en «Ver como»), y
  rechaza las escrituras en ese caso. **Requiere un redespliegue de Apps Script.**
- Una revisión diaria (5:00 a. m., hora de Colombia) termina los reemplazos vencidos.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `reemplazoTemporal` (llamable) | functions (default) | Previsualiza / inicia; también terminar antes y cambiar fecha |
| `finalizarReemplazosVencidos` (diaria) | functions (default) | Devuelve el puesto al titular el día del regreso |
| `reemplazosTemporales/{id}` | Firestore | Estado y auditoría (activo/terminado, fechas, quién) |
| `users/{titular}` | Firestore | `soloLectura: true`, `soloLecturaHasta`, `slotEnPausa`, `reemplazadoPor` |
| `users/{reemplazo}` | Firestore | `slotId` del titular, `reemplazoTemporal: {titular, hasta}` |
| Reglas | firestore.rules | `esSuplantacion()` pasa a incluir `soloLectura` (bloquea escrituras) |
| Apps Script | docs/backend-Code.gs | Correo → puesto desde Firebase; rechaza escrituras en solo lectura o «Ver como» |
| Panel superusuario | PanelSuperusuario.tsx | «Reemplazo temporal»: elegir, previsualizar, iniciar, terminar, cambiar fecha |
| Barra | App | «Estás en solo lectura hasta …: te reemplaza …» |

## Al terminar (por fecha o «terminar antes»)

Titular: recupera `slotId`, se quita `soloLectura`. Reemplazo: `slotId: null`, `active: false`,
sesiones revocadas. Ambos reciben notificación en la app. Auditoría en `auditLogs` y en el documento.

## Verificación

Pruebas automáticas de reglas en el simulador (titular en solo lectura no escribe; reemplazo sí).
Prueba real con una cuenta sin puesto (criterios 1–6 del PRD), forzando la revisión diaria.
