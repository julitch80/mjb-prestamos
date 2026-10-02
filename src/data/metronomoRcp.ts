// Lógica pura del metrónomo de reanimación. Pauta tomada de la ficha
// 'reanimacion' (fichasAuxilios.ts): 30 compresiones y 2 respiraciones, repetir.

export const RITMOS_RCP = [100, 110, 120] as const;
export type RitmoRcp = (typeof RITMOS_RCP)[number];
export const RITMO_RCP_DEFECTO: RitmoRcp = 110;
export const COMPRESIONES_POR_CICLO = 30;
/** Pausa para las 2 respiraciones, en segundos. */
export const PAUSA_RESPIRACIONES_S = 4;

/** Segundos entre compresiones para un ritmo por minuto. */
export function intervaloSegundos(ritmo: number): number {
  return 60 / ritmo;
}

export interface EstadoRcp {
  /** Compresión actual 1..30 (0 = aún no ha sonado ninguna). */
  compresion: number;
  /** Ciclos de 30 completados. */
  ciclos: number;
  /** true cuando toca la pausa de 2 respiraciones. */
  respirando: boolean;
}

export const ESTADO_RCP_INICIAL: EstadoRcp = { compresion: 0, ciclos: 0, respirando: false };

/**
 * Avanza un paso: tras la compresión 30 se pasa a «respirando»; tras la pausa
 * se reinicia el ciclo en la compresión 1.
 */
export function avanzarRcp(e: EstadoRcp): EstadoRcp {
  if (e.respirando) return { compresion: 1, ciclos: e.ciclos + 1, respirando: false };
  if (e.compresion >= COMPRESIONES_POR_CICLO) return { ...e, respirando: true };
  return { ...e, compresion: e.compresion + 1 };
}
