/**
 * De dónde saca el horario la pantalla de Horario.
 *
 * Por defecto, del horario vigente del colegio: exactamente lo que se veía antes
 * de que existiera este módulo. Solo cuando el coordinador pide expresamente ver
 * un borrador generado se cambia la fuente, y la pantalla lo dice bien claro.
 *
 * Se hace con un contexto para no tener que pasar el horario a mano por las
 * cinco vistas que lo consultan. El valor por defecto es el horario real, así
 * que cualquier parte de la app que no sepa nada de esto sigue funcionando igual.
 */

import { createContext, useContext } from 'react';

import { horarioBase, type EntradaHorario } from '../horarioBase';
import { horarioActivo } from './almacen';
import type { Jornada, SalidaGenerador } from './tipos';

const HorarioContext = createContext<EntradaHorario[]>(horarioBase);

export function useHorario(): EntradaHorario[] {
  return useContext(HorarioContext);
}

export function ProveedorHorario(
  { horario, children }: { horario: EntradaHorario[]; children: React.ReactNode },
) {
  return <HorarioContext.Provider value={horario}>{children}</HorarioContext.Provider>;
}

/**
 * Convierte el horario que devuelve el motor al formato que usa la app.
 *
 * Son casi el mismo objeto, pero el motor entrega el bloque como un número
 * cualquiera y la app lo tipa como 1..6. Se descartan las clases con un bloque
 * fuera de ese rango en vez de forzarlas: una clase en un bloque inexistente
 * rompería las cuadrículas de forma difícil de rastrear.
 */
export function comoHorarioDeLaApp(salida: SalidaGenerador): EntradaHorario[] {
  const valido = (b: number): b is EntradaHorario['bloque'] =>
    Number.isInteger(b) && b >= 1 && b <= 6;
  return salida.horario
    .filter(c => valido(c.bloque))
    .map(c => ({
      dia: c.dia,
      bloque: c.bloque as EntradaHorario['bloque'],
      docente: c.docente,
      grado: c.grado,
      aula: c.aula,
      jornada: c.jornada,
    }));
}

export interface BorradorEnRevision {
  /** Clases del borrador, más las del horario vigente de las jornadas que no cubre. */
  horario: EntradaHorario[];
  clases: number;
  /** Jornadas que el borrador sí cubre. Las demás se ven como están hoy. */
  jornadas: Jornada[];
}

/**
 * El borrador que el coordinador tiene en revisión, si es que hay alguno.
 *
 * Un borrador cubre UNA jornada, porque el horario se genera de una en una. Para
 * las que no cubre se deja el horario vigente en su sitio: dejarlas en blanco
 * haría creer que ese turno se quedó sin clases. Quién es quién lo dice el aviso
 * de la pantalla, que nombra la jornada del borrador.
 */
export function borradorEnRevision(): BorradorEnRevision | null {
  const salida = horarioActivo();
  if (!salida) return null;

  const delBorrador = comoHorarioDeLaApp(salida);
  const jornadas = [...new Set(delBorrador.map(c => c.jornada))].sort() as Jornada[];
  const noCubiertas = horarioBase.filter(e => !jornadas.includes(e.jornada));

  return {
    horario: [...delBorrador, ...noCubiertas],
    clases: delBorrador.length,
    jornadas,
  };
}

/** "la mañana", "la tarde", "la mañana y la tarde". Para escribirlo en el aviso. */
export function nombrarJornadas(jornadas: Jornada[]): string {
  const nombres = jornadas.map(j => (j === 'manana' ? 'la mañana' : 'la tarde'));
  if (nombres.length === 0) return 'ninguna jornada';
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}
