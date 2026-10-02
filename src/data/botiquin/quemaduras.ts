// Lógica pura del temporizador de agua fría para quemaduras.

/** 20 minutos de agua fría corriente (no helada). */
export const DURACION_AGUA_FRIA_S = 1200;

/** Segundos que faltan, dados los ms ya acumulados con el reloj en marcha. */
export function segundosRestantes(totalS: number, transcurridoMs: number): number {
  return Math.max(0, Math.ceil(totalS - transcurridoMs / 1000));
}

export function terminado(totalS: number, transcurridoMs: number): boolean {
  return segundosRestantes(totalS, transcurridoMs) <= 0;
}

/** Fracción 0..1 completada. */
export function progreso(totalS: number, transcurridoMs: number): number {
  if (totalS <= 0) return 1;
  return Math.min(1, Math.max(0, transcurridoMs / 1000 / totalS));
}

export const INSTRUCCIONES_QUEMADURA = [
  'Agua fría del grifo 20 minutos (corriente, no helada).',
  'No hielo, no cremas, no pasta de dientes, no reventar ampollas.',
  'Retire anillos y ropa no pegada.',
  'Cubra con gasa o plástico limpio.',
  'Llame al 123 si es grande, en cara, manos o genitales, o si fue por químicos o electricidad.',
];
