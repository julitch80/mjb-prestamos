/**
 * Seguimiento de las llegadas tarde (Julián, 2026-09-25): sobre QUE lapso se cuentan los
 * topes, cuando un «pendiente de verificación» deja de ser una salida, y los mensajes a la
 * familia. Logica pura.
 *
 * Decisiones de Julián:
 *  - El lapso lo escoge coordinacion en «Ajustar alertas»: periodo, semestre o año.
 *  - Una llegada «pendiente de verificación» que pasa 8 dias sin resolverse cuenta como
 *    sin justificar. Antes podia quedarse pendiente para siempre y no contar nunca.
 *  - Aviso a la familia en CADA llegada tarde, y otro con texto distinto al superar un tope.
 */
import { addDays } from './ids';
import { armarMensaje } from './sms';
import type { AlertConfig, LateArrival } from './types';

export type VentanaLlegadas = 'periodo' | 'semestre' | 'anio';

export const VENTANA_POR_DEFECTO: VentanaLlegadas = 'anio';
export const DIAS_VENCE_PENDIENTE = 8;

export const ETIQUETA_VENTANA: Record<VentanaLlegadas, string> = {
  periodo: 'Por periodo',
  semestre: 'Por semestre',
  anio: 'Por año',
};

export interface Ventana {
  desde: string;
  hasta: string;
  /** Para leer en una frase: «en el periodo 3», «en el segundo semestre», «en el año». */
  nombre: string;
  /**
   * Se pidio contar por periodo pero no hay fechas de inicio cargadas para este año: se
   * cuenta por año y la pantalla lo avisa, en vez de inventar periodos.
   */
  sinPeriodos: boolean;
}

/**
 * El lapso que contiene `fecha`.
 *
 *  - Semestre: enero-junio y julio-diciembre (calendario A).
 *  - Periodo: `iniciosPeriodo` son las fechas de inicio del periodo 2 en adelante
 *    (AAAA-MM-DD). El periodo 1 empieza siempre el 1 de enero: asi no importa si hubo
 *    vacaciones al comienzo, y escribir una fecha de mas no corre la numeracion. Cada
 *    periodo termina el dia antes del siguiente; el ultimo, el 31 de diciembre. Solo
 *    cuentan las fechas del mismo año que `fecha`.
 */
export function ventanaDe(fecha: string, ventana: VentanaLlegadas, iniciosPeriodo: string[] = []): Ventana {
  const anio = fecha.slice(0, 4);
  const delAnio = { desde: `${anio}-01-01`, hasta: `${anio}-12-31`, nombre: 'en el año', sinPeriodos: false };
  if (ventana === 'anio') return delAnio;
  if (ventana === 'semestre') {
    const primero = fecha.slice(5, 7) <= '06';
    return primero
      ? { desde: `${anio}-01-01`, hasta: `${anio}-06-30`, nombre: 'en el primer semestre', sinPeriodos: false }
      : { desde: `${anio}-07-01`, hasta: `${anio}-12-31`, nombre: 'en el segundo semestre', sinPeriodos: false };
  }
  const escritos = [...new Set(iniciosPeriodo.filter((d) => d.startsWith(anio) && d > `${anio}-01-01`))].sort();
  if (escritos.length === 0) return { ...delAnio, sinPeriodos: true };
  const inicios = [`${anio}-01-01`, ...escritos];
  let i = 0;
  for (let k = 0; k < inicios.length; k++) if (inicios[k] <= fecha) i = k;
  const hasta = i + 1 < inicios.length ? addDays(inicios[i + 1], -1) : `${anio}-12-31`;
  return { desde: inicios[i], hasta, nombre: `en el periodo ${i + 1}`, sinPeriodos: false };
}

/** Dias corridos desde la llegada hasta `hoy`. */
export function diasDesde(fecha: string, hoy: string): number {
  return Math.round((Date.parse(`${hoy}T12:00:00`) - Date.parse(`${fecha}T12:00:00`)) / 86_400_000);
}

/** Una pendiente que ya paso el plazo: cuenta como sin justificar. */
export function pendienteVencida(l: Pick<LateArrival, 'estado' | 'fecha'>, hoy: string, dias: number): boolean {
  return l.estado === 'pendiente_verificacion' && diasDesde(l.fecha, hoy) >= dias;
}

/** Dias que le quedan a una pendiente antes de contar (0 o menos = ya cuenta). */
export function diasParaVencer(l: Pick<LateArrival, 'fecha'>, hoy: string, dias: number): number {
  return dias - diasDesde(l.fecha, hoy);
}

/** Si la llegada cuenta para los topes: sin justificar, o pendiente vencida. */
export function cuentaParaTopes(l: Pick<LateArrival, 'estado' | 'fecha'>, hoy: string, dias: number): boolean {
  return l.estado === 'sin_justificar' || pendienteVencida(l, hoy, dias);
}

/** Lo que la pantalla necesita de la configuracion, con los valores por defecto puestos. */
export function ajustesDeSeguimiento(config: AlertConfig): {
  ventana: VentanaLlegadas;
  iniciosPeriodo: string[];
  diasVencePendiente: number;
} {
  return {
    ventana: config.ventanaLlegadas ?? VENTANA_POR_DEFECTO,
    iniciosPeriodo: config.iniciosPeriodo ?? [],
    diasVencePendiente: config.diasVencePendiente ?? DIAS_VENCE_PENDIENTE,
  };
}

// ---------------------------------------------------------------------------
//  Mensajes a la familia (sin tildes: GSM-7, un solo mensaje de 160)
// ---------------------------------------------------------------------------

/** El aviso de cada llegada tarde. Informa, no pide nada. */
export function mensajeLlegadaTarde(nombreCompleto: string, hora: string, nivel: 1 | 2): string {
  return armarMensaje(
    (n) =>
      nivel === 2
        ? `I.E. Manuel J. Betancur: hoy ${n} llego tarde al colegio a las ${hora}, despues de la primera hora de clase.`
        : `I.E. Manuel J. Betancur: hoy ${n} llego tarde al colegio y entro a clase despues de la primera hora.`,
    nombreCompleto,
  );
}

/**
 * El aviso de tope: otro texto, porque es otra cosa (Julián). Dice cuantas van y en que
 * lapso, y pide comunicarse con coordinacion; no anuncia ninguna medida, que la decide
 * una persona.
 */
export function mensajeTopeLlegadas(nombreCompleto: string, llegadas: number, nombreVentana: string): string {
  return armarMensaje(
    (n) =>
      `I.E. Manuel J. Betancur: ${n} completa ${llegadas} llegadas tarde sin justificar ${nombreVentana}. Por favor comuniquese con coordinacion.`,
    nombreCompleto,
  );
}
