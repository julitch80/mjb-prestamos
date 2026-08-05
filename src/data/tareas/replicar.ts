// Replicación de una tarea a otros grupos del mismo docente y la misma asignatura.
//
// EL PROBLEMA QUE RESUELVE: un docente que dicta la misma materia a cuatro grupos
// tiene que crear la misma tarea cuatro veces, y cada vez calcular a mano en qué
// fecha cae, porque a cada grupo le dicta en días distintos.
//
// CRITERIO (opción C, decidida por Julián el 5 de agosto de 2026):
//
//   1. La tarea se asigna en la PRÓXIMA CLASE del docente con el grupo destino.
//      No sirve la fecha del original: si a 10.1 le dictas lunes y a 10.2 jueves,
//      la de 10.2 tiene que salir el jueves o no la reciben.
//
//   2. Cada grupo conserva el MISMO TIEMPO DE TRABAJO que el original (los días
//      entre asignación y entrega), no la misma fecha de entrega. Con la misma
//      fecha, el grupo al que se le dicta más tarde tendría menos días para
//      hacerla, que es injusto y además concentra la carga.
//
//   3. La entrega también cae en una CLASE con ese grupo, para que el docente
//      pueda recibirla en persona en vez de un día suelto en que no los ve.
//
// Nada se crea a ciegas: cada réplica pasa por `validarTarea` contra el contexto
// DEL GRUPO DESTINO (sus tareas, su cupo, su agenda), así que puede ser rechazada
// aunque la original fuera válida. Eso no es un defecto: es exactamente para lo
// que existe el módulo. Por eso esto devuelve un PLAN para revisar, no tareas ya
// creadas.

import { addDias, diaSemana, esDiaHabil } from './calendario';
import { validarTarea } from './motor';
import type { ContextoValidacion, DiaSemana, FechaISO, Tarea } from './tipos';

/** Cuántos días naturales se busca hacia adelante antes de rendirse. */
const HORIZONTE_DIAS = 60;

export interface PlanReplica {
  grupo: string;
  /** Fechas propuestas; null si no se encontró ninguna combinación viable. */
  fechaAsignacion: FechaISO | null;
  fechaEntrega: FechaISO | null;
  /** true si la réplica se puede crear tal cual está propuesta. */
  viable: boolean;
  /** Por qué no es viable, en lenguaje del docente. */
  motivo?: string;
}

/**
 * Primer día hábil, a partir de `desde` (inclusive), en que el docente tiene
 * clase con el grupo. Devuelve null si no hay ninguno en el horizonte —pasa si
 * el grupo no tiene días de clase cargados, como hoy en primaria.
 */
export function proximaClase(
  desde: FechaISO,
  diasClase: DiaSemana[],
  horizonte = HORIZONTE_DIAS,
): FechaISO | null {
  if (diasClase.length === 0) return null;
  for (let i = 0; i < horizonte; i++) {
    const f = addDias(desde, i);
    // `diaSemana` puede devolver sábado o domingo, que no son días de clase; se
    // descartan igual que en `ventanaValida` para estrechar el tipo.
    const d = diaSemana(f);
    if (d === 'sabado' || d === 'domingo') continue;
    if (diasClase.includes(d) && esDiaHabil(f)) return f;
  }
  return null;
}

/** Días de trabajo que el original le dio al grupo: de la asignación a la entrega. */
export function lapsoDe(original: Tarea): number {
  let dias = 0;
  for (let f = original.fechaAsignacion; f < original.fechaEntrega; f = addDias(f, 1)) dias++;
  return Math.max(dias, 1);
}

/**
 * Calcula el plan para UN grupo destino.
 *
 * `ctx` debe ser el contexto del grupo DESTINO: sus tareas activas, sus cesiones
 * y los días en que el docente le dicta a él. Pasar el del original daría un
 * resultado que el servidor luego rechazaría.
 */
export function planificarReplica(
  original: Tarea,
  grupoDestino: string,
  ctx: ContextoValidacion,
): PlanReplica {
  const base: PlanReplica = {
    grupo: grupoDestino,
    fechaAsignacion: null,
    fechaEntrega: null,
    viable: false,
  };

  if (ctx.diasClase.length === 0) {
    return { ...base, motivo: 'No hay horario cargado para este grupo, así que no se sabe qué día tiene clase con ellos.' };
  }

  const lapso = lapsoDe(original);

  // Se prueba con la próxima clase; si esa combinación no pasa la validación
  // (cupo o agenda del grupo destino), se intenta con la clase siguiente. Correr
  // la asignación es preferible a recortarle el tiempo de trabajo al grupo.
  let arranque = addDias(ctx.hoy, 0);
  for (let intento = 0; intento < 8; intento++) {
    const fechaAsignacion = proximaClase(arranque, ctx.diasClase);
    if (!fechaAsignacion) break;

    // Opción C: la entrega cae en la primera clase con ese grupo una vez
    // transcurrido el mismo tiempo de trabajo que tuvo el original.
    const fechaEntrega = proximaClase(addDias(fechaAsignacion, lapso), ctx.diasClase);
    if (!fechaEntrega) break;

    const candidata: Tarea = {
      ...original,
      id: `${original.id}-r-${grupoDestino}`,
      grupo: grupoDestino,
      fechaAsignacion,
      fechaEntrega,
    };

    const veredicto = validarTarea(candidata, ctx);
    if (veredicto.ok) {
      return { grupo: grupoDestino, fechaAsignacion, fechaEntrega, viable: true };
    }

    // Guardamos el último motivo por si se agotan los intentos, y seguimos
    // buscando desde el día siguiente a la clase que no sirvió.
    base.motivo = veredicto.mensaje;
    base.fechaAsignacion = fechaAsignacion;
    base.fechaEntrega = fechaEntrega;
    arranque = addDias(fechaAsignacion, 1);
  }

  return {
    ...base,
    viable: false,
    motivo: base.motivo ?? 'No se encontró ninguna fecha viable en los próximos dos meses.',
  };
}

/**
 * Plan completo para varios grupos. `contextoDe` entrega el contexto de cada
 * grupo destino — se recibe como función porque cargarlo puede requerir leer las
 * tareas vigentes de ese grupo, que quien llama ya tiene a mano.
 */
export function planificarReplicas(
  original: Tarea,
  gruposDestino: string[],
  contextoDe: (grupo: string) => ContextoValidacion,
): PlanReplica[] {
  return gruposDestino
    .filter((g) => g !== original.grupo)
    .map((g) => planificarReplica(original, g, contextoDe(g)));
}

/** Convierte un plan viable en la tarea lista para crear (sin id ni estado). */
export function tareaDesdePlan(
  original: Tarea,
  plan: PlanReplica,
): Omit<Tarea, 'id' | 'estado'> | null {
  if (!plan.viable || !plan.fechaAsignacion || !plan.fechaEntrega) return null;
  return {
    grupo: plan.grupo,
    asignaturaId: original.asignaturaId,
    docenteId: original.docenteId,
    titulo: original.titulo,
    momentos: original.momentos,
    fechaAsignacion: plan.fechaAsignacion,
    fechaEntrega: plan.fechaEntrega,
  };
}
