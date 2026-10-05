// Helpers puros para proponer fechas alternativas cuando la de Classroom no sirve en MJB (4.3).

/** Diferencia en días (absoluta) entre dos fechas ISO AAAA-MM-DD. */
export function distanciaDias(a: string, b: string): number {
  const f = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.abs(Math.round((f(a) - f(b)) / 86400000));
}

/** Las `max` fechas más cercanas a `objetivo` (empates: la más temprana primero). Sin objetivo, las más tempranas. */
export function fechasMasCercanas<T extends string>(candidatas: T[], objetivo: string | null, max = 3): T[] {
  const orden = [...candidatas].sort((x, y) => {
    if (!objetivo) return x.localeCompare(y);
    return distanciaDias(x, objetivo) - distanciaDias(y, objetivo) || x.localeCompare(y);
  });
  return orden.slice(0, max).sort((x, y) => x.localeCompare(y));
}
