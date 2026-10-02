/**
 * De donde saca el modulo de asistencia el horario de hoy de un docente.
 *
 * Es el UNICO punto de contacto con el horario de MJB, a proposito. Lee las clases
 * EFECTIVAS del dia con `clasesEfectivas` de MJB (commit d85ec23), la misma funcion de la
 * pastilla «Próxima clase» del inicio: horario base del puesto, cambios del dia guardados
 * (movidas, ausencias, docente nuevo), jornadas reducidas con sus horas reales, y ninguna
 * clase en fin de semana o festivo. Si los cambios del dia aun no llegaron al store,
 * devuelve el horario base.
 *
 * En esta carpeta de desarrollo `../data/*` son dobles FICTICIOS; en MJB son los reales.
 */
import { useMemo } from 'react';
import { BLOQUES_MANANA, BLOQUES_TARDE } from '../data/maestros';
import { asignacionDeDocente } from '../data/asignacionAcademica';
import { useAppStore } from '../data/store';
import { clasesEfectivas, fechaLocalISO, type ClaseEfectiva } from '../data/horario/clasesEfectivas';
import { useClasesEfectivasHoy } from '../data/horario/useClasesEfectivasHoy';
import type { FranjaHoraria, HoraDeClase } from './domain/bloques-clase';
import type { Jornada } from './domain/types';

const aHora = (c: ClaseEfectiva): HoraDeClase => ({
  bloque: c.bloque, grado: c.grado, aula: c.aula, jornada: c.jornada, inicio: c.inicio, fin: c.fin,
});

/**
 * Horas de clase del docente en `fecha`, leidas una vez (sin suscribirse). Para un clic,
 * como abrir la planilla; una pantalla que se queda abierta usa `useHorasDeHoy`.
 */
export function horasDeHoy(slotId: string | null, fecha: Date = new Date()): HoraDeClase[] {
  const { horariosModificados, jornadasReducidas } = useAppStore.getState();
  return clasesEfectivas(slotId, fechaLocalISO(fecha), { horariosModificados, jornadasReducidas }).map(aHora);
}

/** Igual, como hook: se recalcula cuando llegan al store los cambios del dia. */
export function useHorasDeHoy(slotId: string | null, fecha: Date): HoraDeClase[] {
  const clases = useClasesEfectivasHoy(slotId, fechaLocalISO(fecha));
  return useMemo(() => clases.map(aHora), [clases]);
}

/** Franjas normales de cada bloque. Respaldo si una hora no trae su inicio y fin reales. */
export const FRANJAS: Record<Jornada, FranjaHoraria[]> = {
  manana: BLOQUES_MANANA.map((b) => ({ id: b.id, inicio: b.inicio, fin: b.fin })),
  tarde: BLOQUES_TARDE.map((b) => ({ id: b.id, inicio: b.inicio, fin: b.fin })),
};

/**
 * Asignaturas que el docente dicta en ese grado. El horario no trae la asignatura: sale
 * de la asignacion academica. Casi siempre es una; cuando son dos (Quimica y Biologia en
 * el mismo grupo), la tarjeta ofrece las dos.
 */
export function asignaturasEnGrado(slotId: string | null, grado: string): { id: string; nombre: string }[] {
  if (!slotId) return [];
  return asignacionDeDocente(slotId)
    .filter((r) => r.asignatura.id !== 'ci' && r.grupos.some((g) => g.grupo === grado))
    .map((r) => ({ id: r.asignatura.id, nombre: r.asignatura.nombre }));
}

/**
 * Las horas de hoy en que el docente tiene ese grado. Lo usa `abrirCruce` para saber si
 * la clase que se abre es un bloque de dos horas.
 */
export function bloquesDeHoyEnGrado(slotId: string | null, grado: string, fecha: Date = new Date()): number[] {
  return horasDeHoy(slotId, fecha)
    .filter((h) => h.grado === grado)
    .map((h) => h.bloque);
}
