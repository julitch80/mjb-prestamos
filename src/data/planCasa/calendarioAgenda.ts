// Lógica pura de fechas y cuadrículas de la agenda pública del plan en casa
// (vistas Día · Semana · Mes). Sin React ni Firestore para poder probarla.
import type { FechaISO } from './tipos';

export const aFecha = (f: FechaISO) => new Date(`${f}T12:00:00`);
export function aISO(d: Date): FechaISO {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const sumarDias = (f: FechaISO, n: number): FechaISO => { const d = aFecha(f); d.setDate(d.getDate() + n); return aISO(d); };
export const diasEntre = (a: FechaISO, b: FechaISO) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86400000);

/** Lunes de la semana (lunes a domingo) que contiene la fecha. */
export const lunesDe = (f: FechaISO): FechaISO => sumarDias(f, -((aFecha(f).getDay() + 6) % 7));

/** Los 7 días (lunes a domingo) de la semana que contiene la fecha. */
export const semanaDe = (f: FechaISO): FechaISO[] => {
  const l = lunesDe(f);
  return [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(l, i));
};

/** Primer día del mes de la fecha. */
export const primeroDeMes = (f: FechaISO): FechaISO => `${f.slice(0, 7)}-01`;

/** Suma meses a un primer-de-mes y devuelve otro primer-de-mes. */
export function sumarMeses(f: FechaISO, n: number): FechaISO {
  const d = aFecha(primeroDeMes(f));
  d.setMonth(d.getMonth() + n);
  return primeroDeMes(aISO(d));
}

export interface CeldaMes { fecha: FechaISO; delMes: boolean }

/** Cuadrícula del mes: semanas completas lunes a domingo (35 o 42 celdas). */
export function cuadriculaMes(f: FechaISO): CeldaMes[] {
  const ini = primeroDeMes(f);
  const mes = ini.slice(0, 7);
  const desde = lunesDe(ini);
  const celdas: CeldaMes[] = [];
  for (let i = 0; i < 42; i++) {
    const fecha = sumarDias(desde, i);
    if (i % 7 === 0 && i >= 28 && fecha.slice(0, 7) !== mes) break;
    celdas.push({ fecha, delMes: fecha.slice(0, 7) === mes });
  }
  return celdas;
}

/** Agrupa por día los elementos con fecha (los que no tienen fecha se omiten). */
export function agruparPorDia<T extends { fecha: FechaISO | null }>(items: T[]): Record<FechaISO, T[]> {
  const out: Record<FechaISO, T[]> = {};
  for (const it of items) {
    if (!it.fecha) continue;
    (out[it.fecha] ??= []).push(it);
  }
  return out;
}

/** Limita un primer-de-mes al rango de meses [desde, hasta] del plan. */
export function limitarMes(mes: FechaISO, desde: FechaISO, hasta: FechaISO): FechaISO {
  const m = mes.slice(0, 7), a = desde.slice(0, 7), b = hasta.slice(0, 7);
  if (m < a) return primeroDeMes(desde);
  if (m > b) return primeroDeMes(hasta);
  return primeroDeMes(mes);
}

/** ¿Se puede ir al mes anterior / siguiente sin salir del rango del plan? */
export const hayMesAnterior = (mes: FechaISO, desde: FechaISO) => mes.slice(0, 7) > desde.slice(0, 7);
export const hayMesSiguiente = (mes: FechaISO, hasta: FechaISO) => mes.slice(0, 7) < hasta.slice(0, 7);

/** ¿La fecha cae dentro del rango del plan? */
export const enRango = (f: FechaISO, desde: FechaISO, hasta: FechaISO) => f >= desde && f <= hasta;
