/**
 * Clases de dos horas y sugerencia de «la lista que toca ahora» (Julian, 2026-10-01).
 *
 * En los datos, un `bloque` es UNA hora de clase (1..6 por jornada). Lo que en el colegio
 * se llama «bloque» son dos horas seguidas del mismo grupo con el mismo docente. Medido en
 * el horario real de central: 601 horas, de las cuales 229 encuentros son de dos horas sin
 * descanso en medio y solo 102 son horas sueltas.
 *
 * Decisiones de Julian:
 *  - Solo cuentan como bloque las parejas SIN descanso en medio: 1.ª-2.ª, 3.ª-4.ª, 5.ª-6.ª.
 *    Las horas separadas por el descanso (2.ª-3.ª, 4.ª-5.ª) son clases aparte: hay que
 *    llamar lista antes y despues del descanso, que es cuando un estudiante se puede ir
 *    (y la 3.ª es la hora del censo de evasion).
 *  - En un bloque se llama lista UNA vez y la marca vale para las dos horas, pero la
 *    estadistica cuenta DOS horas: la falta se registra por hora de clase. Por eso se
 *    guardan dos sesiones enlazadas y no una que «valga doble» (todo lo que cuenta horas
 *    —estadistica, alertas, exportacion al Master, tercera hora, avisos— sigue igual).
 */
import type { Jornada } from './types';

/** Las parejas que forman un bloque: sin descanso en medio. */
export const PAREJAS_DE_BLOQUE: readonly [number, number][] = [[1, 2], [3, 4], [5, 6]];

/** La otra hora del bloque al que pertenece `bloque` (1↔2, 3↔4, 5↔6). */
export function parejaDe(bloque: number): number | null {
  for (const [a, b] of PAREJAS_DE_BLOQUE) {
    if (bloque === a) return b;
    if (bloque === b) return a;
  }
  return null;
}

export interface HoraDeClase {
  bloque: number;
  grado: string;
  aula: string;
  jornada: Jornada;
}

export interface Encuentro {
  grado: string;
  aula: string;
  jornada: Jornada;
  /** Una hora (`[3]`) o un bloque de dos (`[3, 4]`), siempre en orden. */
  bloques: number[];
}

/**
 * Agrupa las horas de clase de UN docente en UN dia en encuentros: dos horas del mismo
 * grado y jornada que forman pareja (1-2, 3-4, 5-6) son un bloque; el resto, horas sueltas.
 */
export function encuentrosDelDia(horas: HoraDeClase[]): Encuentro[] {
  const ordenadas = [...horas].sort((a, b) =>
    a.jornada === b.jornada ? a.bloque - b.bloque : a.jornada === 'manana' ? -1 : 1,
  );
  const usadas = new Set<HoraDeClase>();
  const encuentros: Encuentro[] = [];
  for (const h of ordenadas) {
    if (usadas.has(h)) continue;
    usadas.add(h);
    const otra = parejaDe(h.bloque);
    const companera =
      otra !== null && otra > h.bloque
        ? ordenadas.find(
            (x) => !usadas.has(x) && x.bloque === otra && x.grado === h.grado && x.jornada === h.jornada,
          )
        : undefined;
    if (companera) usadas.add(companera);
    encuentros.push({
      grado: h.grado,
      aula: h.aula,
      jornada: h.jornada,
      bloques: companera ? [h.bloque, companera.bloque] : [h.bloque],
    });
  }
  return encuentros;
}

export interface FranjaHoraria {
  id: number;
  /** 'HH:MM' */
  inicio: string;
  fin: string;
}

export interface Sugerencia {
  encuentro: Encuentro;
  /** `en_curso`: la clase ya empezo. `proxima`: la siguiente de hoy. */
  estado: 'en_curso' | 'proxima';
  inicio: string;
  fin: string;
  /** Minutos que faltan para empezar (0 si ya empezo). */
  faltan: number;
}

const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * La clase que se le sugiere al docente para pasar lista. La que esta en curso; si no hay
 * ninguna, la siguiente de hoy (aunque falte una hora: entre clases tambien sirve saber
 * que viene). Al terminar la ultima, ninguna.
 */
export function sugerirClase(
  encuentros: Encuentro[],
  franjas: Record<Jornada, FranjaHoraria[]>,
  minutosAhora: number,
): Sugerencia | null {
  const conHora = encuentros
    .map((e) => {
      const lista = franjas[e.jornada] ?? [];
      const primera = lista.find((f) => f.id === e.bloques[0]);
      const ultima = lista.find((f) => f.id === e.bloques[e.bloques.length - 1]);
      return primera && ultima ? { e, ini: aMinutos(primera.inicio), fin: aMinutos(ultima.fin), primera, ultima } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.ini - b.ini);

  const enCurso = conHora.find((x) => minutosAhora >= x.ini && minutosAhora < x.fin);
  const elegida = enCurso ?? conHora.find((x) => minutosAhora < x.ini);
  if (!elegida) return null;
  return {
    encuentro: elegida.e,
    estado: enCurso ? 'en_curso' : 'proxima',
    inicio: elegida.primera.inicio,
    fin: elegida.ultima.fin,
    faltan: Math.max(0, elegida.ini - minutosAhora),
  };
}

/**
 * La otra hora del bloque, si esta enlazada de verdad: misma clase (grado, fecha y
 * asignatura) y las DOS con el mismo `pareja`. El `sessionId` no lleva asignatura, asi que
 * la 4.ª hora de ese grado podria ser la clase de OTRO docente si ese dia se abrio por
 * separado; exigir el enlace en ambas evita escribir marcas en una planilla ajena.
 */
export function companeraEnLista<
  S extends { sessionId: string; grado: string; fecha: string; bloque: number; subjectId: string; pareja?: number[] },
>(sesion: S, lista: S[]): S | null {
  const p = sesion.pareja;
  if (!p || p.length !== 2) return null;
  const otra = p[0] === sesion.bloque ? p[1] : p[1] === sesion.bloque ? p[0] : null;
  if (otra === null) return null;
  return (
    lista.find(
      (x) =>
        x.sessionId !== sesion.sessionId &&
        x.bloque === otra &&
        x.grado === sesion.grado &&
        x.fecha === sesion.fecha &&
        x.subjectId === sesion.subjectId &&
        x.pareja?.length === 2 &&
        x.pareja[0] === p[0] &&
        x.pareja[1] === p[1],
    ) ?? null
  );
}

/** «3.ª hora» o «3.ª y 4.ª hora». */
export function etiquetaHoras(bloques: number[]): string {
  return bloques.length === 2 ? `${bloques[0]}.ª y ${bloques[1]}.ª hora` : `${bloques[0]}.ª hora`;
}
