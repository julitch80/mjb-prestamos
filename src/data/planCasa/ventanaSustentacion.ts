// Ventana institucional de sustentaciones (lógica pura, con pruebas).
// Regla: las entregas parciales siguen las fechas de los docentes, pero las SUSTENTACIONES
// de las guías se programan entre el 24 y el 27 de noviembre de 2026.
// Decisión: la ventana es una constante FIJA (regla del colegio) y no se deriva de plan.hasta,
// porque cada plan termina en una fecha distinta y la regla es común a todos.
import type { FechaISO } from './tipos';

export const VENTANA_SUSTENTACION: { desde: FechaISO; hasta: FechaISO } = { desde: '2026-11-24', hasta: '2026-11-27' };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «24 al 27 de noviembre» (sin año). */
export function textoVentana(v = VENTANA_SUSTENTACION): string {
  const [, m1, d1] = v.desde.split('-').map(Number);
  const [, m2, d2] = v.hasta.split('-').map(Number);
  return m1 === m2 ? `${d1} al ${d2} de ${MESES[m2 - 1]}` : `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

/** «Entre el 24 y el 27 de noviembre». */
export function textoEntre(v = VENTANA_SUSTENTACION): string {
  return `Entre el ${textoVentana(v).replace(' al ', ' y el ')}`;
}

export const enVentana = (f: FechaISO, v = VENTANA_SUSTENTACION): boolean => f >= v.desde && f <= v.hasta;

/** Días hábiles (lunes a viernes) de la ventana. */
export function diasVentana(v = VENTANA_SUSTENTACION): FechaISO[] {
  const out: FechaISO[] = [];
  for (let d = new Date(`${v.desde}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
    const f = d.toISOString().slice(0, 10) as FechaISO;
    if (f > v.hasta) break;
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(f);
  }
  return out;
}

/** Última fecha que debe poder navegarse en la agenda: lo que sea mayor entre el fin del plan y la ventana. */
export const limiteAgenda = (hasta: FechaISO, v = VENTANA_SUSTENTACION): FechaISO => (hasta > v.hasta ? hasta : v.hasta);

interface ConFecha { asignatura: string; fecha: FechaISO | null }

/** Áreas cuya sustentación aún no tiene fecha. */
export const areasPendientes = (s: ConFecha[]): string[] => s.filter(x => !x.fecha).map(x => x.asignatura);

/** Por cada día de la ventana, las áreas pendientes (vacío si todas tienen fecha). */
export function pendientesPorDia(s: ConFecha[], v = VENTANA_SUSTENTACION): Record<FechaISO, string[]> {
  const pend = areasPendientes(s);
  const out: Record<FechaISO, string[]> = {};
  if (pend.length === 0) return out;
  for (const f of diasVentana(v)) out[f] = pend;
  return out;
}

/** «Sustentaciones: X de Y programadas». */
export function resumenProgramadas(fechas: (FechaISO | null | undefined)[]): { programadas: number; total: number; texto: string } {
  const programadas = fechas.filter(Boolean).length;
  return { programadas, total: fechas.length, texto: `Sustentaciones: ${programadas} de ${fechas.length} programadas` };
}

/** ¿La fecha elegida cae dentro de la ventana? (vacío se permite: quita la fecha). */
export const fechaValida = (f: string, v = VENTANA_SUSTENTACION): boolean => f === '' || enVentana(f as FechaISO, v);
