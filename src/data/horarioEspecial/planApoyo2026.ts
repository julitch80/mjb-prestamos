// Horario especial · semana de plan de apoyo (bachillerato, sede central).
// Fuente: «HORARIO PLAN DE APOYO BAHILLERATO 2026.pdf» (Coordinación).
// Transcripción fiel de las celdas del PDF; solo se normalizaron mayúsculas y tildes.
//
// NOTAS DE TRANSCRIPCIÓN
//  - El PDF rotula la primera columna de la mañana «MARTES 25 NOV», pero el 25-nov-2026 es
//    miércoles (y la segunda columna ya es «MIÉRCOLES 25»). Se toma como martes 24-nov.
//  - «MARGARITA 1°3 – 10°4» queda literal (probable errata de 10°3).
//  - Abreviaturas del PDF conservadas: Artist, Soc, Biol, Filos-Econ, Ética - Relig.
//  - Mañana, jueves 26: «Matemáticas 10°» trae los docentes por subgrupo tal cual el PDF
//    (10°2 aparece con Uriel y con Claudia).
//  - La tarde del PDF no trae la columna del martes 24 (empieza el miércoles 25).

export const PLAN_APOYO_DESDE = '2026-11-24';
export const PLAN_APOYO_HASTA = '2026-12-01';
export const PLAN_APOYO_TITULO = 'Horario especial · semana de plan de apoyo';
export const PLAN_APOYO_FUENTE = 'Fuente: Coordinación. Durante esta semana no rige el horario habitual.';

export interface EntradaEspecial {
  asignatura: string;
  /** Texto de grados tal cual (p. ej. «10°3 y 10°4»); null si el PDF no trae grado (Optativa). */
  grados: string | null;
  /** Docentes tal cual aparecen en el PDF; null si no vienen. */
  docentes: string | null;
  /** Nota entre paréntesis del PDF, p. ej. «(1H)». */
  nota: string | null;
}

export interface FranjaEspecial {
  id: string;
  etiqueta: string;
  /** Horario de la franja, p. ej. «6:00–8:00». */
  horas: string;
}

export interface DiaEspecial {
  fecha: string; // ISO
  etiqueta: string; // «Martes 24 nov»
  /** Una lista de entradas por franja, en el mismo orden que `franjas`. */
  entradas: EntradaEspecial[][];
}

export interface JornadaEspecial {
  franjas: FranjaEspecial[];
  dias: DiaEspecial[];
}

const e = (asignatura: string, grados: string | null = null, docentes: string | null = null, nota: string | null = null): EntradaEspecial =>
  ({ asignatura, grados, docentes, nota });

// ── Mañana ──────────────────────────────────────────────────────────────────

const CASTELLANO_10 = e('Castellano', '10°', 'Beatriz 10°1 - 10°2; Margarita 1°3 – 10°4');
const INGLES_10_2 = e('Inglés', '10°2', 'Johana – Juan Carlos');
const INGLES_10_34 = e('Inglés', '10°3 y 10°4', 'Johana');

export const PLAN_APOYO_MANANA: JornadaEspecial = {
  franjas: [
    { id: 'm1', etiqueta: '6:00 – 8:00', horas: '6:00–8:00' },
    { id: 'm2', etiqueta: '8:00 – 10:00', horas: '8:00–10:00' },
    { id: 'm3', etiqueta: '10:00 – 12:00', horas: '10:00–12:00' },
  ],
  // Docentes de la mañana: los dictó Julián el 2026-11-16 (el PDF no los trae).
  // «Leyes» del dictado = Ledis y «Carlos Arteaga» = Carlos Cárdenas (confirmado por Julián).
  dias: [
    {
      fecha: '2026-11-24', etiqueta: 'Martes 24 nov',
      entradas: [
        [e('Inglés', '11°', 'Johana'), e('Artística', '11°', 'Doris')],
        [e('Física', '11°', 'Julián Medina'), e('Castellano', '11°', 'Margarita')],
        [e('Matemáticas', '11°', 'Sin docente (Claudia no estará)'), e('Tecnología', '11°', 'Juan Carlos Blandón')],
      ],
    },
    {
      fecha: '2026-11-25', etiqueta: 'Miércoles 25 nov',
      entradas: [
        [e('Matemáticas', '9°', 'Uriel'), e('Filosofía y Economía', '10°', 'Ledis'), e('Ética y Religión', '11°', 'Jorge')],
        [e('Castellano', '9°', 'Beatriz'), INGLES_10_2, INGLES_10_34, e('Química', '11°', 'Carlos Cárdenas')],
        [e('Ética y Religión', '9°', 'Jorge'), e('Artística', '10°', 'Doris'), e('Filosofía y Economía', '11°', 'Ledis')],
      ],
    },
    {
      fecha: '2026-11-26', etiqueta: 'Jueves 26 nov',
      entradas: [
        [e('C. Naturales', '9°', 'Mónica Córdoba'), CASTELLANO_10, e('Inglés', '11°', 'Johana', '(1H)'), e('Ed. Física', '11°', 'Adolfo', '(1H)')],
        [
          e('Sociales', '9°', 'Gloria Álvarez'),
          e('Matemáticas', '10°', 'Uriel (cubre también a Claudia)'),
          e('Biología', '11°', 'Carlos Cárdenas', '(1H)'),
          e('Castellano', '11°', 'Margarita', '(1H)'),
        ],
        [e('Inglés', '9° y 10°1', 'Camilo'), e('Química', '10°', 'Carlos Cárdenas'), e('Matemáticas', '11°', 'Sin docente (Claudia no estará)'), e('Sociales', '11°', 'Gloria Álvarez', '(1H)')],
      ],
    },
    {
      fecha: '2026-11-27', etiqueta: 'Viernes 27 nov',
      entradas: [
        [e('Castellano', '9°', 'Beatriz'), e('Tecnología', '10°', 'Juan Carlos Blandón')],
        [e('Matemáticas', '9°', 'Uriel'), e('Biología', '10°', 'Carlos Cárdenas', '(1H)'), e('Sociales', '10°', 'Gloria Álvarez', '(1H)')],
        [e('C. Naturales', '9°', 'Mónica Córdoba'), e('Ética y Valores', '10°', 'Jorge')],
      ],
    },
    {
      fecha: '2026-11-30', etiqueta: 'Lunes 30 nov',
      entradas: [
        [e('Inglés', '9° y 10°1', 'Camilo'), e('Matemáticas', '10°', 'Uriel (cubre a Claudia)')],
        [e('Artística', '9°', 'Doris'), CASTELLANO_10],
        [e('Ed. Física', '9°', 'Adolfo'), e('Física', '10°', 'Julián Medina')],
      ],
    },
    {
      fecha: '2026-12-01', etiqueta: 'Martes 1 dic',
      entradas: [
        [e('Sociales', '9°', 'Gloria Álvarez'), INGLES_10_2, INGLES_10_34],
        [e('Tecnología', '9°', 'Juan Carlos Blandón'), e('Ed. Física', '10°', 'Adolfo')],
        [e('Optativa')],
      ],
    },
  ],
};

// ── Tarde ───────────────────────────────────────────────────────────────────
// Horas de la tarde según BLOQUES_TARDE (maestros.ts).

const MAT6_YANET = e('Matemáticas', '6°', 'Yanet');
const NAT7_JM = e('C. Naturales', '7°', 'Javier y Mónica');
const ART8_EDGAR = e('Artística', '8°', 'Edgar');
const CAST6_CAROLINA = e('Castellano', '6°', 'Carolina');
const SOC7_SM = e('Sociales', '7°', 'Sara-Mónica Córdoba');
const MAT8_HUGO = e('Matemáticas', '8°', 'Hugo');
const NAT6_JAVIER = e('C. Naturales', '6°', 'Javier');
const ING7_FREDY = e('Inglés', '7°', 'Fredy');
const ART6_EDGAR = e('Artística', '6°', 'Edgar');
const CAST7_CM = e('Castellano', '7°', 'Carolina- Marina');
const ING8_FC = e('Inglés', '8°', 'Fredy- Camilo');
const CAST8_MARINA = e('Castellano', '8°', 'Marina');
const MAT7_FELIPE = e('Matemáticas', '7°1, 7°2 y 7°3', 'Felipe');
const SOC6_SARA = e('Sociales', '6°', 'Sara');
const NAT7_JMON = e('C. Naturales', '7°', 'Javier- Mónica');
const SOC8_VICTOR = e('Sociales', '8°', 'Victor');
const NAT8_MR = e('C. Naturales', '8°', 'Mónica Rave');
const MAT7_YANET = e('Matemáticas', '7°1-7°3', 'Yanet');
const ING6_FREDY = e('Inglés', '6°', 'Fredy');

export const PLAN_APOYO_TARDE: JornadaEspecial = {
  franjas: [
    { id: 't1', etiqueta: '1.ª hora', horas: '12:15–13:10' },
    { id: 't2', etiqueta: '2.ª hora', horas: '13:10–14:05' },
    { id: 't3', etiqueta: '3.ª hora', horas: '14:25–15:20' },
    { id: 't4', etiqueta: '4.ª hora', horas: '15:20–16:15' },
    { id: 't5', etiqueta: '5.ª hora', horas: '16:25–17:20' },
    { id: 't6', etiqueta: '6.ª hora', horas: '17:20–18:15' },
  ],
  dias: [
    {
      fecha: '2026-11-25', etiqueta: 'Miércoles 25 nov',
      entradas: [
        [MAT6_YANET, NAT7_JM, ART8_EDGAR],
        [MAT6_YANET, NAT7_JM, ART8_EDGAR],
        [CAST6_CAROLINA, SOC7_SM, MAT8_HUGO],
        [CAST6_CAROLINA, SOC7_SM, MAT8_HUGO],
        [ING6_FREDY, MAT7_YANET, NAT8_MR],
        [ING6_FREDY, MAT7_YANET, NAT8_MR],
      ],
    },
    {
      fecha: '2026-11-26', etiqueta: 'Jueves 26 nov',
      entradas: [
        [NAT6_JAVIER, ING7_FREDY, e('Religión', '8°', 'Harol')],
        [NAT6_JAVIER, ING7_FREDY],
        [ART6_EDGAR, CAST7_CM, ING8_FC],
        [ART6_EDGAR, CAST7_CM, ING8_FC],
        [e('Matemáticas', '7°2', 'Hugo'), CAST8_MARINA],
        [e('Religión', '7°', 'Harol'), CAST8_MARINA],
      ],
    },
    {
      fecha: '2026-11-27', etiqueta: 'Viernes 27 nov',
      entradas: [
        [e('Religión', '6°', 'Harol'), MAT7_FELIPE],
        [MAT7_FELIPE],
        [SOC6_SARA, NAT7_JMON, SOC8_VICTOR],
        [SOC6_SARA, e('C. Naturales', '7°', 'Javier - Mónica'), SOC8_VICTOR],
        [e('Tecnología', '6°', 'Harol'), e('Tecnología', '7°', 'Juan Carlos'), e('Tecnología', '8°', 'Valentina')],
        [
          e('Ética', '6°1', 'Sara'),
          e('Ética', '6°2, 6°3 y 7°1', 'Harol'),
          e('Ética', '7°2', 'Javier'),
          e('Ética', '7°3', 'Yanet'),
        ],
      ],
    },
    {
      fecha: '2026-11-30', etiqueta: 'Lunes 30 nov',
      entradas: [
        [CAST6_CAROLINA, ING7_FREDY, NAT8_MR],
        [CAST6_CAROLINA, e('Matemáticas', '7°2', 'Hugo'), NAT8_MR],
        [MAT6_YANET, e('Artística', '7°', 'Edgar'), CAST8_MARINA],
        [MAT6_YANET, e('Artística', '7°', 'Edgar'), CAST8_MARINA],
        [NAT6_JAVIER, SOC7_SM, MAT8_HUGO],
        [NAT6_JAVIER, SOC7_SM, MAT8_HUGO],
      ],
    },
    {
      fecha: '2026-12-01', etiqueta: 'Martes 1 dic',
      entradas: [
        [SOC6_SARA, MAT7_YANET, SOC8_VICTOR],
        [SOC6_SARA, MAT7_YANET, SOC8_VICTOR],
        [e('Castellano', '7°', 'Carolina-Marina'), e('Ed. Física', '7°2', 'Juan Pablo'), e('Inglés', '8°', 'Fredy-Camilo')],
        [e('Castellano', '7°', 'Carolina-Marina'), e('Inglés', '8°', 'Fredy-Camilo')],
        [ING6_FREDY, MAT7_FELIPE, e('Ética', '8°', 'Victor, Harol, Mónica Rave, Juan Pablo')],
        [e('Optativa', '6º, 7º y 8º')],
      ],
    },
  ],
};

export const PLAN_APOYO: Record<'manana' | 'tarde', JornadaEspecial> = {
  manana: PLAN_APOYO_MANANA,
  tarde: PLAN_APOYO_TARDE,
};
