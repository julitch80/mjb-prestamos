# Pedido URGENTE para la sesión de Asistencia: pastilla «Evaluación CI» en cada centro

Fecha: 2026-11-16. Pedido por Julián. Se necesita **antes del martes 17-nov**, que es cuando se aplica la encuesta.

## Qué se pide
Agregar en `src/asistencia/PlanillaCentro.tsx` una cuarta pastilla, **«Evaluación CI»**, junto a
Asistencia, Gestión CI y Valoración. Debe mostrar el componente ya hecho
`src/components/evaluacionCI/EvaluacionCIDocente.tsx` (export default). Ese componente trae la
explicación («en esta ocasión es general para todos los centros»), el QR y el enlace de la encuesta.
No necesita ningún dato.

## Cambio mínimo sugerido
1. `useState<'asistencia' | 'gestion' | 'valoracion'>` y `type Seccion`: agregar `'evaluacion'`.
2. En `Pestanas`, agregar `['evaluacion', 'Evaluación CI']` después de Valoración.
3. Agregar un bloque `if (seccion === 'evaluacion')` con la misma estructura del de `'valoracion'`:
   `Cabecera`, `Pestanas` y `<EvaluacionCIDocente />`, este último con `lazy` igual que los demás.
4. Todos los que ven el centro (líder, coordinación, Yuri) ven la pastilla.
