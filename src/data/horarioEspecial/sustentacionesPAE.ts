// Plan Académico Especial (10.° y 11.°) · jornada de la mañana.
// Versión 4 (2026-11-18, Julián): cada docente da 1 hora de ORIENTACIÓN y 1 de SUSTENTACIÓN.
//  - Quien tiene estudiantes de 11.° termina TODO entre el 24 y el 26 de noviembre (se gradúan),
//    sin importar si ese día tiene refuerzo. Para que quepa se usa también 12:00–13:00.
//  - En días distintos, salvo Ledis, que solo viene el miércoles y hace las dos ese día.
//  - En un mismo día no se repite ninguna hora: ningún estudiante tiene dos citas a la vez.
//  - Claudia no estará; sus estudiantes de 10.° los atiende Uriel. Matemáticas 11.° no habrá.

export type TipoPAE = 'orientacion' | 'sustentacion';

export interface SesionPAE {
  docente: string;
  tipo: TipoPAE;
  fecha: string; // ISO
  dia: string;
  hora: string; // «8:00 – 9:00»
  /** Índice de la franja de 2 horas del horario especial (0: 6–8, 1: 8–10, 2: 10–12). */
  franja: number;
  nota?: string;
}

const DIAS: Record<string, string> = {
  '2026-11-24': 'Martes 24 nov', '2026-11-25': 'Miércoles 25 nov', '2026-11-26': 'Jueves 26 nov',
  '2026-11-27': 'Viernes 27 nov', '2026-11-30': 'Lunes 30 nov', '2026-12-01': 'Martes 1 dic',
};
const s = (docente: string, tipo: TipoPAE, fecha: string, h: number, nota?: string): SesionPAE =>
  ({ docente, tipo, fecha, dia: DIAS[fecha], hora: `${h}:00 – ${h + 1}:00`, franja: Math.min(2, Math.floor((h - 6) / 2)), nota });
const O = 'orientacion', S = 'sustentacion';
const NR = 'Ese día no tiene refuerzo';

export const SESIONES_PAE_MANANA: SesionPAE[] = [
  // Martes 24
  s('Juan Carlos Blandón', O, '2026-11-24', 6), s('Margarita', O, '2026-11-24', 7), s('Doris', O, '2026-11-24', 8),
  s('Jorge', O, '2026-11-24', 9, NR), s('Julián Medina', O, '2026-11-24', 10), s('Gloria Álvarez', O, '2026-11-24', 11, NR),
  s('Adolfo', O, '2026-11-24', 12, NR),
  // Miércoles 25
  s('Doris', S, '2026-11-25', 6), s('Carlos Cárdenas', O, '2026-11-25', 7),
  s('Ledis', O, '2026-11-25', 8, 'Orientación y sustentación el mismo día: solo tiene refuerzo el miércoles'), s('Ledis', S, '2026-11-25', 9),
  s('Johana', O, '2026-11-25', 10), s('Julián Medina', S, '2026-11-25', 11, NR), s('Jorge', S, '2026-11-25', 12),
  // Jueves 26
  s('Carlos Cárdenas', S, '2026-11-26', 6), s('Gloria Álvarez', S, '2026-11-26', 7), s('Adolfo', S, '2026-11-26', 8),
  s('Johana', S, '2026-11-26', 9), s('Margarita', S, '2026-11-26', 10), s('Juan Carlos Blandón', S, '2026-11-26', 11, NR),
  s('Camilo', O, '2026-11-26', 12),
  // Solo 10.°: después
  s('Uriel', O, '2026-11-27', 6, 'Incluye los estudiantes de 10.° de Claudia'), s('Beatriz', O, '2026-11-27', 8),
  s('Beatriz', S, '2026-11-30', 7), s('Camilo', S, '2026-11-30', 8),
  s('Uriel', S, '2026-11-30', 10, 'Incluye los estudiantes de 10.° de Claudia'),
];

// ── Propuesta de distribución v5 (2026-11-24, Julián) ─────────────────────
// Para coordinación: miércoles 25 y jueves 26. Una hora = un solo docente (ningún estudiante
// tiene dos citas a la vez); ningún docente queda citado mientras da plan de apoyo (horario v2).
// Hasta las 12:00. El martes 24 se hicieron las asesorías, salvo Artística.
export interface CitaPropuesta { hora: string; docente: string; asignatura: string; tipo: TipoPAE; nota?: string }
export interface PropuestaDia { fecha: string; titulo: string; citas: CitaPropuesta[] }
const c = (hora: string, docente: string, asignatura: string, tipo: TipoPAE = S, nota?: string): CitaPropuesta => ({ hora, docente, asignatura, tipo, nota });
export const PROPUESTA_PAE_MANANA: PropuestaDia[] = [
  { fecha: '2026-11-25', titulo: 'Propuesta de distribución para el miércoles 25', citas: [
    c('6:00 – 7:00', 'Doris', 'Artística', O),
    c('7:00 – 8:00', 'Ledis', 'Filosofía y Economía'),
    c('8:00 – 9:00', 'Julián Medina', 'Física'),
    c('9:00 – 10:00', 'Jorge', 'Ética y Religión'),
    c('10:00 – 11:00', 'Margarita', 'Castellano'),
    c('11:00 – 12:00', 'Johana', 'Inglés'),
  ] },
  { fecha: '2026-11-26', titulo: 'Propuesta de distribución para el jueves 26', citas: [
    c('6:00 – 7:00', 'Gloria Álvarez', 'Sociales'),
    c('7:00 – 8:00', 'Adolfo', 'Ed. Física'),
    c('8:00 – 9:00', 'Doris', 'Artística'),
    c('9:00 – 10:00', 'Juan Carlos Blandón', 'Tecnología'),
    c('10:00 – 11:00', 'Carlos Cárdenas', 'Química y Biología'),
    c('11:00 – 12:00', 'Camilo', 'Inglés', O, 'Solo estudiantes de 10.°'),
  ] },
];
