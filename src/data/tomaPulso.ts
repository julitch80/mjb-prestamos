// Lógica pura de la «Toma de pulso». Rangos orientativos en reposo y vigilia
// (pediátricos según AHA/PALS; adulto según AHA). No reemplazan la valoración de salud.

export type GrupoEdad = '6-11' | '12-17' | 'adulto';
export type Semaforo = 'normal' | 'vigilar' | 'alerta';
export type ModoPulso = 'temporizador' | 'toques';

export const GRUPOS_EDAD: { id: GrupoEdad; etiqueta: string }[] = [
  { id: '6-11', etiqueta: '6 a 11 años' },
  { id: '12-17', etiqueta: '12 a 17 años' },
  { id: 'adulto', etiqueta: 'Adulto' },
];

interface Rango {
  normal: [number, number];
  vigilarBajo: [number, number];
  vigilarAlto: [number, number];
}

/** Fuente: AHA/PALS (frecuencia cardiaca en vigilia) y AHA adultos. Orientativo. */
export const RANGOS_PULSO: Record<GrupoEdad, Rango> = {
  '6-11': { normal: [70, 120], vigilarBajo: [60, 69], vigilarAlto: [121, 140] },
  '12-17': { normal: [60, 100], vigilarBajo: [50, 59], vigilarAlto: [101, 120] },
  adulto: { normal: [60, 100], vigilarBajo: [50, 59], vigilarAlto: [101, 120] },
};

export function clasificarPulso(lpm: number, edad: GrupoEdad): Semaforo {
  const v = Math.round(lpm);
  const r = RANGOS_PULSO[edad];
  if (v >= r.normal[0] && v <= r.normal[1]) return 'normal';
  if (
    (v >= r.vigilarBajo[0] && v <= r.vigilarBajo[1]) ||
    (v >= r.vigilarAlto[0] && v <= r.vigilarAlto[1])
  ) return 'vigilar';
  return 'alerta';
}

/** lpm = latidos × (60 / segundos). */
export function lpmPorConteo(latidos: number, segundos: number): number {
  if (!(latidos >= 0) || !(segundos > 0)) return 0;
  return Math.round(latidos * (60 / segundos));
}

export const TOQUES_MINIMOS = 6;
export const INTERVALO_MIN_MS = 250;
export const INTERVALO_MAX_MS = 2500;
export const INTERVALOS_VENTANA = 8;
export const UMBRAL_IRREGULAR = 0.2;

export interface ResultadoToques {
  lpm: number;
  irregular: boolean;
  intervalosUsados: number;
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** `tiemposMs`: marcas de tiempo de cada toque. Devuelve null si aún no hay datos suficientes. */
export function lpmPorToques(tiemposMs: number[]): ResultadoToques | null {
  if (tiemposMs.length < TOQUES_MINIMOS) return null;
  const validos: number[] = [];
  for (let i = 1; i < tiemposMs.length; i++) {
    const d = tiemposMs[i] - tiemposMs[i - 1];
    if (d >= INTERVALO_MIN_MS && d <= INTERVALO_MAX_MS) validos.push(d);
  }
  const ventana = validos.slice(-INTERVALOS_VENTANA);
  if (ventana.length < 3) return null;
  const med = mediana(ventana);
  const media = ventana.reduce((a, b) => a + b, 0) / ventana.length;
  const desv = Math.sqrt(ventana.reduce((a, b) => a + (b - media) ** 2, 0) / ventana.length);
  return {
    lpm: Math.round(60000 / med),
    irregular: desv / med > UMBRAL_IRREGULAR,
    intervalosUsados: ventana.length,
  };
}

export interface MedicionPulso {
  hora: string; // HH:MM
  lpm: number;
  modo: ModoPulso;
  edad: GrupoEdad;
  semaforo: Semaforo;
  irregular?: boolean;
}

const ETQ_SEMAFORO: Record<Semaforo, string> = { normal: 'Normal', vigilar: 'Vigilar', alerta: 'Alerta' };
const ETQ_MODO: Record<ModoPulso, string> = { temporizador: 'conteo con temporizador', toques: 'toques' };

export function formatearRegistro(m: MedicionPulso[]): string {
  const ed = (e: GrupoEdad) => GRUPOS_EDAD.find(g => g.id === e)!.etiqueta;
  const lineas = m.map(x =>
    `${x.hora} - ${x.lpm} lpm - ${ETQ_MODO[x.modo]} - ${ed(x.edad)} - ${ETQ_SEMAFORO[x.semaforo]}${x.irregular ? ' (ritmo irregular)' : ''}`);
  return ['Registro de pulso (en reposo, orientativo)', ...lineas].join('\n');
}
