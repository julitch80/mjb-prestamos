/**
 * De donde saca el modulo de asistencia el horario de hoy de un docente.
 *
 * Es el UNICO punto de contacto con el horario de MJB, a proposito: hoy lee el horario
 * BASE (`horarioBase` + las franjas de `maestros.ts`), igual que la pastilla «Próxima
 * clase» de la pantalla de inicio. No ve los cambios del dia (`horarioModificado`: un
 * reemplazo, una jornada reducida con bloques recortados), que viven en Firestore y los
 * calcula MJB. Cuando MJB exponga una funcion con las clases EFECTIVAS de hoy, se cambia
 * solo este archivo y la tarjeta de «Mis grupos» la usa sin tocar nada mas.
 *
 * En esta carpeta de desarrollo `../data/*` son dobles FICTICIOS; en MJB son los reales.
 */
import { horarioBase } from '../data/horarioBase';
import { BLOQUES_MANANA, BLOQUES_TARDE } from '../data/maestros';
import { asignacionDeDocente } from '../data/asignacionAcademica';
import type { FranjaHoraria, HoraDeClase } from './domain/bloques-clase';
import type { Jornada } from './domain/types';

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;

/** Horas de clase de hoy del docente (horario base). Fin de semana: ninguna. */
export function horasDeHoy(slotId: string | null, fecha: Date = new Date()): HoraDeClase[] {
  if (!slotId) return [];
  const dia = DIAS[fecha.getDay()];
  return horarioBase
    .filter((e) => e.dia === dia && e.docente === slotId)
    .map((e) => ({ bloque: e.bloque, grado: e.grado, aula: e.aula, jornada: e.jornada }));
}

/** Hora de inicio y fin de cada bloque, por jornada. */
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
