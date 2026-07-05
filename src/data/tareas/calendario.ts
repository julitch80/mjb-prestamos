// Calendario del módulo de Tareas: festivos, fines de semana y
// contrajornadas de media técnica. Fechas como 'YYYY-MM-DD' en hora local.

import type { DiaSemana, FechaISO } from './tipos';

// Festivos Colombia 2026 (incluye traslados ley Emiliani)
export const FESTIVOS_2026: FechaISO[] = [
  '2026-01-01', // Año Nuevo
  '2026-01-12', // Reyes (trasladado)
  '2026-03-23', // San José (trasladado)
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-18', // Ascensión (trasladado)
  '2026-06-08', // Corpus Christi (trasladado)
  '2026-06-15', // Sagrado Corazón (trasladado)
  '2026-06-29', // San Pedro y San Pablo
  '2026-07-20', // Independencia
  '2026-08-07', // Batalla de Boyacá
  '2026-08-17', // Asunción (trasladado)
  '2026-10-12', // Día de la Raza
  '2026-11-02', // Todos los Santos (trasladado)
  '2026-11-16', // Independencia de Cartagena (trasladado)
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

// Días de contrajornada de media técnica por grupo (asignación 2026).
// Esos días el grupo NO recibe momentos de ejecución.
export const CONTRAJORNADAS_MT: Record<string, DiaSemana[]> = {
  '10.1': ['martes', 'jueves'],      // D. Software — Pascual Bravo
  '11.1': ['lunes', 'miercoles'],    // D. Software
  '10.2': ['miercoles', 'viernes'],  // Audiovisuales — SENA
  '11.2': ['martes', 'viernes'],     // Audiovisuales
};

// ── Utilidades de fecha (sin zona horaria: siempre local) ─────────────────────

export function parseFecha(f: FechaISO): Date {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatFecha(d: Date): FechaISO {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDias(f: FechaISO, n: number): FechaISO {
  const d = parseFecha(f);
  d.setDate(d.getDate() + n);
  return formatFecha(d);
}

const DIAS_SEMANA: (DiaSemana | 'sabado' | 'domingo')[] =
  ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export function diaSemana(f: FechaISO): DiaSemana | 'sabado' | 'domingo' {
  return DIAS_SEMANA[parseFecha(f).getDay()];
}

export function esFestivo(f: FechaISO): boolean {
  return FESTIVOS_2026.includes(f);
}

/** Día hábil escolar: lunes a viernes, no festivo. */
export function esDiaHabil(f: FechaISO): boolean {
  const d = diaSemana(f);
  return d !== 'sabado' && d !== 'domingo' && !esFestivo(f);
}

/** ¿El grupo puede EJECUTAR momentos ese día? (hábil y sin contrajornada) */
export function esDiaEjecutable(grupo: string, f: FechaISO): boolean {
  if (!esDiaHabil(f)) return false;
  const contra = CONTRAJORNADAS_MT[grupo];
  if (contra && contra.includes(diaSemana(f) as DiaSemana)) return false;
  return true;
}

// ── Períodos de cupo ──────────────────────────────────────────────────────────

/** Lunes de la semana de una fecha. */
export function lunesDe(f: FechaISO): FechaISO {
  const d = parseFecha(f);
  const delta = (d.getDay() + 6) % 7; // lunes=0 ... domingo=6
  d.setDate(d.getDate() - delta);
  return formatFecha(d);
}

/** Clave de semana: el lunes de esa semana ('2026-07-06'). */
export function claveSemana(f: FechaISO): string {
  return lunesDe(f);
}

/**
 * Clave de quincena: el lunes de la primera semana del par.
 * Las semanas se emparejan por número de semana desde una época fija.
 */
export function claveQuincena(f: FechaISO): string {
  const lunes = lunesDe(f);
  const epoca = parseFecha('2026-01-05'); // primer lunes de 2026
  const dias = Math.round((parseFecha(lunes).getTime() - epoca.getTime()) / 86400000);
  const semanas = Math.floor(dias / 7);
  const inicioPar = semanas - (((semanas % 2) + 2) % 2); // semana par del par
  const d = new Date(epoca);
  d.setDate(d.getDate() + inicioPar * 7);
  return formatFecha(d);
}
