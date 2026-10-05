// Fechas del reemplazo temporal (docs/reemplazo-temporal). Funciones puras.

/** Fecha de hoy en Colombia (UTC-5, sin horario de verano) como 'YYYY-MM-DD'. */
export function hoyBogota(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function fechaValida(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Un reemplazo vence el día de regreso (hasta <= hoy): ese día el titular ya vuelve. */
export function vencido(hasta: string, hoy: string): boolean {
  return hasta <= hoy;
}
