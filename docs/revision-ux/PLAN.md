# Plan de revisión de flujo y diseño — Plataforma MJB

Pedido de Julián (25-oct-2026): revisar toda la plataforma y sugerir mejoras de flujo de
trabajo y de consulta en cada módulo, con criterio técnico (no solo ideas sueltas).

## Método
1. **Evaluación heurística** (10 heurísticas de Nielsen) de cada pantalla.
2. **Recorrido de tareas reales por rol** (docente, coordinador, rectora, superusuario):
   cuántos toques, decisiones y pantallas exige cada tarea frecuente; dónde se tropieza.
3. **Celular primero:** la mayoría usa la app en el teléfono (botones ≥ 44 px, texto legible,
   nada que obligue a desplazarse de lado).
4. **Consistencia entre módulos:** mismos patrones para lo mismo (filtros, guardar, imprimir,
   volver, estados vacíos, errores).

Solo lectura: nadie cambia código en esta fase. La evidencia sale del código y, cuando se
puede, del navegador de pruebas con datos ficticios (no hay sesión real).

## Lotes (un subagente por lote, en segundo plano)
| Lote | Módulos | Informe |
|---|---|---|
| A | Navegación general, Inicio, menú, login, notificaciones, chat, tema claro/oscuro | `A-navegacion.md` |
| B | Asistencia, Alerta académica, Permanencia, Eventos | `B-asistencia.md` |
| C | Horario, Generar horario, Acompañamientos, Reservas/Disponibilidad, Panel coordinación, Rectora | `C-horario-reservas.md` |
| D | Tareas, Agenda, Académico (calendario y asignación), Planes en casa | `D-academico.md` |
| E | Gestión del Riesgo / Simulacros, Manual de convivencia, Datos de la sede, Usuarios, Sugerencias | `E-institucional.md` |

## Formato de cada informe
- Tareas frecuentes por rol y su recorrido actual (pasos).
- Hallazgos: **qué estorba · dónde (archivo) · principio que incumple · sugerencia ·
  beneficio (alto/medio/bajo) · costo (S/M/L)**.
- Top 5 del módulo, ordenado por beneficio ÷ costo.

## Después
Un resumen consolidado (`RESUMEN.md`) con las 10–15 mejoras de mayor impacto en toda la
plataforma. Julián decide qué se construye; lo de `src/asistencia/**` se pide a la sesión de
asistencia; lo de horarios, a la sesión de horarios.
