/**
 * Traduccion de la notacion de Master2000 a la notacion literal de MJB.
 *
 * Master2000 exporta el grupo como un codigo numerico: `060300` = sexto tres.
 * MJB lo escribe `6º3`, y distingue la jornada por la notacion:
 *
 *   grados 6, 7 y 8   -> TARDE   -> se escriben con 'º'   (6º3)
 *   grados 9, 10 y 11 -> MANANA  -> se escriben con '.'   (11.2)
 *
 * Regla confirmada por Julian el 2026-07-30.
 *
 * ⚠️ Esta regla se rompe el dia que exista un grado en las DOS jornadas (un noveno en
 * la tarde, por ejemplo). Si eso llega a pasar, la jornada ya no se puede deducir del
 * numero de grado y habra que traerla del propio export o de una tabla fija. Por eso
 * `parseGrupoMaster2000` falla en vez de adivinar cuando el grado esta fuera de 6..11.
 */

import type { Jornada } from './types';

/** Grados que funcionan en la jornada de la tarde. */
const GRADOS_TARDE = [6, 7, 8];
/** Grados que funcionan en la jornada de la manana. */
const GRADOS_MANANA = [9, 10, 11];

export function jornadaDeNumeroDeGrado(grado: number): Jornada {
  if (GRADOS_TARDE.includes(grado)) return 'tarde';
  if (GRADOS_MANANA.includes(grado)) return 'manana';
  throw new Error(
    `Grado ${grado} fuera de 6..11: no se puede deducir la jornada. ` +
      'Si el colegio abrio un grado nuevo o el mismo grado en dos jornadas, ' +
      'hay que traer la jornada del export en vez de deducirla.',
  );
}

/** Arma la notacion literal de MJB: 6º3 (tarde) u 11.2 (manana). */
export function formatGrado(grado: number, grupo: number): string {
  const separador = jornadaDeNumeroDeGrado(grado) === 'tarde' ? 'º' : '.';
  return `${grado}${separador}${grupo}`;
}

export interface GrupoMaster2000 {
  /** Notacion literal de MJB. Es lo que se guarda. */
  grado: string;
  jornada: Jornada;
  numeroGrado: number;
  numeroGrupo: number;
}

/**
 * Interpreta el codigo `GRUPO` del export de Master2000.
 *
 * Formato observado: seis digitos en tres pares -> grado, grupo y un tercer par cuyo
 * significado no esta confirmado (siempre '00' en la muestra). Se ignora a proposito:
 * asumir que es la sede sin saberlo seria inventar un dato.
 */
export function parseGrupoMaster2000(codigo: string): GrupoMaster2000 {
  const limpio = (codigo ?? '').trim();
  if (!/^\d{4,6}$/.test(limpio)) {
    throw new Error(`Codigo de grupo no reconocido: "${codigo}". Se esperaban 4 a 6 digitos.`);
  }
  const numeroGrado = Number(limpio.slice(0, 2));
  const numeroGrupo = Number(limpio.slice(2, 4));
  if (numeroGrupo < 1) {
    throw new Error(`Codigo de grupo sin numero de grupo valido: "${codigo}".`);
  }
  return {
    grado: formatGrado(numeroGrado, numeroGrupo),
    jornada: jornadaDeNumeroDeGrado(numeroGrado),
    numeroGrado,
    numeroGrupo,
  };
}
