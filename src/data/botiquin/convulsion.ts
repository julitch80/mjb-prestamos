// Lógica pura del «Cronómetro de convulsión».

/** Umbral de alarma: 5 minutos continuos = llamar al 123. */
export const UMBRAL_CONVULSION_S = 300;

export type EstadoConvulsion = 'quieto' | 'en_curso' | 'alerta';

export function estadoConvulsion(iniciada: boolean, transcurridoS: number): EstadoConvulsion {
  if (!iniciada) return 'quieto';
  return transcurridoS >= UMBRAL_CONVULSION_S ? 'alerta' : 'en_curso';
}

export function textoDuracion(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}

/** Recordatorios fijos; coherentes con la ficha «Convulsiones» de fichasAuxilios.ts. */
export const RECORDATORIOS_CONVULSION = [
  'No meta nada en la boca.',
  'No lo sujete.',
  'Retire objetos cercanos.',
  'No le dé agua ni comida; no lo deje solo.',
  'Al terminar, póngalo de lado (posición lateral de seguridad).',
];
