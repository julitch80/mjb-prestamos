// Formato legible de reservas: nombres, horas de bloque y fechas en español
// (las tarjetas de coordinación, Mis reservas y Rectoría mostraban ids crudos).
import { RECURSOS, BLOQUES_MANANA, BLOQUES_TARDE, horaOrdinal, getUsuario } from './maestros';
import type { Reserva } from './api';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function nombreRecurso(id: string): string {
  return RECURSOS.find(r => r.id === id)?.nombre ?? id;
}

export function nombreSolicitante(id: string): string {
  return getUsuario(id)?.nombre ?? id;
}

// «jueves 29 oct» a partir de 'YYYY-MM-DD'
export function fechaLegible(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return fecha;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  return `${DIAS[d.getDay()]} ${parseInt(m[3])} ${MESES[parseInt(m[2]) - 1]}`;
}

// «3.ª hora (8:10–9:05)»; la jornada se deduce del solicitante (mañana por defecto)
export function bloqueLegible(r: Pick<Reserva, 'bloque' | 'solicitante'>): string {
  const jornada = getUsuario(r.solicitante)?.jornada;
  const bloques = jornada === 'tarde' ? BLOQUES_TARDE : BLOQUES_MANANA;
  const b = bloques.find(x => x.id === r.bloque);
  const h = (s: string) => s.replace(/^0/, '');
  return b ? `${horaOrdinal(r.bloque)} hora (${h(b.inicio)}–${h(b.fin)})` : `Bloque ${r.bloque}`;
}

// Marca de tiempo del servidor -> «25 oct, 14:03»
export function marcaLegible(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${hh}:${mm}`;
}
