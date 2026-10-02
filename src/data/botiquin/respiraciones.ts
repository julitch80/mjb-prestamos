// Lógica pura del «Contador de respiraciones». Rangos en reposo y vigilia, orientativos
// (pediátricos según AHA/PALS; adulto según valores de referencia habituales). No reemplazan
// la valoración de salud.
import type { GrupoEdad, Semaforo } from '../tomaPulso';

interface RangoResp { normal: [number, number]; bajo: number; alto: number }

/** normal inclusivo; alerta si < bajo o > alto; entre ambos = vigilar. */
export const RANGOS_RESPIRACION: Record<GrupoEdad, RangoResp> = {
  '6-11': { normal: [18, 25], bajo: 12, alto: 30 },
  '12-17': { normal: [12, 20], bajo: 10, alto: 25 },
  adulto: { normal: [12, 20], bajo: 10, alto: 25 },
};

/** rpm = respiraciones × (60 / segundos). */
export function rpmPorConteo(respiraciones: number, segundos: number): number {
  if (!(respiraciones >= 0) || !(segundos > 0)) return 0;
  return Math.round(respiraciones * (60 / segundos));
}

export function clasificarRespiraciones(rpm: number, edad: GrupoEdad): Semaforo {
  const r = RANGOS_RESPIRACION[edad];
  const v = Math.round(rpm);
  if (v < r.bajo || v > r.alto) return 'alerta';
  if (v >= r.normal[0] && v <= r.normal[1]) return 'normal';
  return 'vigilar';
}

export interface MedicionResp { hora: string; rpm: number; edad: GrupoEdad; semaforo: Semaforo }

const ETQ_EDAD: Record<GrupoEdad, string> = { '6-11': '6 a 11 años', '12-17': '12 a 17 años', adulto: 'Adulto' };
const ETQ_SEM: Record<Semaforo, string> = { normal: 'Normal', vigilar: 'Vigilar', alerta: 'Alerta' };

export function formatearMedicionResp(m: MedicionResp): string {
  return `${m.hora} — ${m.rpm} resp/min (${ETQ_EDAD[m.edad]}): ${ETQ_SEM[m.semaforo]}`;
}

export function formatearRegistroResp(ms: MedicionResp[]): string {
  return ['Registro de respiraciones', ...ms.map(formatearMedicionResp)].join('\n');
}
