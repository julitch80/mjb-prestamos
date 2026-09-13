/**
 * Qué cambió entre dos horarios.
 *
 * Se compara el resultado, no se lleva un registro de acciones. Es más simple y
 * no se desincroniza: si el coordinador mueve una clase y luego la devuelve a su
 * sitio, aquí deja de figurar como cambiada, que es lo que él espera ver.
 *
 * La comparación no se hace por posición en la lista, sino por lo que la clase
 * es —qué docente, con qué grupo, de qué materia—, porque dos versiones del
 * mismo horario pueden traer las clases en otro orden.
 */

import type { ClaseGenerada, Dia, Jornada } from './tipos';

export interface Franja {
  dia: Dia;
  bloque: number;
}

export interface ClaseMovida {
  docente: string;
  grupo: string;
  asignatura?: string;
  de: Franja;
  a: Franja;
}

export interface Cambios {
  /** Las que siguen existiendo pero en otra hora. */
  movidas: ClaseMovida[];
  /** Estaban en el primero y no están en el segundo. */
  quitadas: ClaseGenerada[];
  /** Aparecen en el segundo y no estaban en el primero. */
  agregadas: ClaseGenerada[];
  /** Cuántas se quedaron exactamente donde estaban. */
  intactas: number;
}

function identidad(c: ClaseGenerada): string {
  // El separador no es un espacio: hay identificadores que llevan espacios.
  return [c.docente, c.grado, c.asignatura ?? ''].join('␟');
}

function mismaFranja(a: ClaseGenerada, b: ClaseGenerada): boolean {
  return a.dia === b.dia && a.bloque === b.bloque;
}

function agrupar(horario: ClaseGenerada[]): Map<string, ClaseGenerada[]> {
  const m = new Map<string, ClaseGenerada[]>();
  for (const c of horario) {
    const k = identidad(c);
    const lista = m.get(k);
    if (lista) lista.push(c);
    else m.set(k, [c]);
  }
  return m;
}

/**
 * Compara dos horarios y dice qué se movió, qué desapareció y qué apareció.
 *
 * Dentro de una misma clase (mismo docente, grupo y materia) las horas que
 * coinciden se emparejan primero, y solo lo que sobra se cuenta como movido:
 * si una materia de cuatro horas cambió una sola de sitio, se reporta una
 * movida, no cuatro.
 */
export function compararHorarios(antes: ClaseGenerada[], despues: ClaseGenerada[]): Cambios {
  const cambios: Cambios = { movidas: [], quitadas: [], agregadas: [], intactas: 0 };
  const porIdAntes = agrupar(antes);
  const porIdDespues = agrupar(despues);

  for (const k of new Set([...porIdAntes.keys(), ...porIdDespues.keys()])) {
    const a = [...(porIdAntes.get(k) ?? [])];
    const b = [...(porIdDespues.get(k) ?? [])];

    // Primero lo que no se movió: emparejar las coincidencias exactas evita
    // reportar como movidas dos horas que solo intercambiaron su orden.
    for (let i = a.length - 1; i >= 0; i--) {
      const j = b.findIndex(x => mismaFranja(a[i], x));
      if (j === -1) continue;
      a.splice(i, 1);
      b.splice(j, 1);
      cambios.intactas++;
    }

    while (a.length > 0 && b.length > 0) {
      const vieja = a.shift()!;
      const nueva = b.shift()!;
      cambios.movidas.push({
        docente: nueva.docente,
        grupo: nueva.grado,
        asignatura: nueva.asignatura,
        de: { dia: vieja.dia, bloque: vieja.bloque },
        a: { dia: nueva.dia, bloque: nueva.bloque },
      });
    }
    cambios.quitadas.push(...a);
    cambios.agregadas.push(...b);
  }

  // Orden estable, para que dos comparaciones iguales se lean igual.
  cambios.movidas.sort((x, y) =>
    `${x.grupo}${x.docente}`.localeCompare(`${y.grupo}${y.docente}`));
  return cambios;
}

/**
 * Huella de una clase EN SU FRANJA. Es la que usa `franjasCambiadas`, y se
 * exporta para que quien pinte la rejilla no tenga que repetir el formato: dos
 * copias de esta línea en archivos distintos se separan tarde o temprano.
 */
export function huellaEnFranja(c: ClaseGenerada): string {
  return huella(c.docente, c.grado, c.asignatura, c.dia, c.bloque);
}

function huella(
  docente: string, grupo: string, asignatura: string | undefined,
  dia: string, bloque: number,
): string {
  return [docente, grupo, asignatura ?? '', dia, bloque].join('␟');
}

/** Las clases del segundo horario que no están donde estaban. Para resaltarlas. */
export function franjasCambiadas(antes: ClaseGenerada[], despues: ClaseGenerada[]): Set<string> {
  const marcadas = new Set<string>();
  for (const m of compararHorarios(antes, despues).movidas) {
    marcadas.add(huella(m.docente, m.grupo, m.asignatura, m.a.dia, m.a.bloque));
  }
  return marcadas;
}

/**
 * Docentes con más de un día completo. Espejo de `dias_llenos_por_docente` del
 * motor, con la misma definición exacta —un día es lleno si tiene tantas clases
 * como bloques la jornada— para que la cifra de la pantalla y la del motor sean
 * la misma. Si no coincidieran, el coordinador no sabría a cuál creer.
 *
 * Solo se listan los de dos o más: uno se considera aceptable.
 */
export function docentesConVariosDiasLlenos(
  horario: ClaseGenerada[], bloques: Record<Jornada, number>,
): Array<{ docente: string; dias: number }> {
  const carga = new Map<string, number>();
  for (const c of horario) {
    const k = [c.docente, c.jornada, c.dia].join('␟');
    carga.set(k, (carga.get(k) ?? 0) + 1);
  }
  const llenos = new Map<string, number>();
  for (const [k, n] of carga) {
    const [docente, jornada] = k.split('␟');
    if (n >= bloques[jornada as Jornada]) llenos.set(docente, (llenos.get(docente) ?? 0) + 1);
  }
  return [...llenos].filter(([, n]) => n >= 2).sort()
    .map(([docente, dias]) => ({ docente, dias }));
}

/**
 * Las clases movidas agrupadas por docente, de quien más cambió a quien menos.
 *
 * Doscientas líneas sueltas no le dicen nada a nadie. «A Adolfo le cambiaron 18
 * clases, a Marta 3» dice a quién hay que avisar y a quién revisar primero.
 */
export function movidasPorDocente(movidas: ClaseMovida[]): Array<[string, ClaseMovida[]]> {
  const m = new Map<string, ClaseMovida[]>();
  for (const x of movidas) {
    const lista = m.get(x.docente);
    if (lista) lista.push(x);
    else m.set(x.docente, [x]);
  }
  return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
