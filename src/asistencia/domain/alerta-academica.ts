/**
 * Alerta academica — logica pura. Ver docs/modelo-alerta-academica.md.
 *
 * Julian, 2026-10-02: en la 7.ª semana de cada periodo cada docente senala, en cada planilla
 * (grado + asignatura), quien esta en alerta. El director de grupo consolida su grupo,
 * imprime un informe por estudiante (se entrega EN PERSONA) y cita al acudiente de quien
 * tiene DOS O MAS asignaturas en alerta. Las fechas y la franja las pone coordinacion; las
 * horas de cada citado, el director, con la propuesta de `proponerAgenda`.
 */
import type {
  CitaAlerta,
  ConvocatoriaAlerta,
  Jornada,
  MarcaAlerta,
  ModoAgenda,
  ParametrosAgenda,
  PlanillaAlerta,
  Sede,
} from './types';

/** Desde cuantas asignaturas en alerta se cita al acudiente (Julian, 2026-10-02). */
export const MINIMO_PARA_CITAR = 2;

/** El motivo que lleva la citacion: generico, sin asignaturas (Julian, 2026-10-02). */
export function motivoCitacion(periodo: number): string {
  return `Seguimiento de la alerta académica del periodo ${periodo}`;
}

// ── ids ─────────────────────────────────────────────────────────────────────────

export function convocatoriaAlertaId(anio: number, periodo: number, sede: Sede, jornada: Jornada): string {
  return `${anio}_${periodo}_${sede}_${jornada}`;
}

/** El grado va literal: `9.1` y `6º1` son jornadas distintas y no se sanean. */
export function alertaId(anio: number, periodo: number, sede: Sede, grado: string, subjectId: string): string {
  return `${anio}_${periodo}_${sede}_${grado}_${subjectId}`;
}

export function citacionAlertaId(anio: number, periodo: number, sede: Sede, grado: string): string {
  return `${anio}_${periodo}_${sede}_${grado}`;
}

// ── convocatoria ────────────────────────────────────────────────────────────────

/**
 * ¿Se puede marcar o corregir hoy? Abierta por coordinacion y sin pasar la fecha limite
 * (inclusive). Fuera de eso la planilla se ve pero no se edita.
 */
export function convocatoriaEditable(c: ConvocatoriaAlerta | null, hoyISO: string): boolean {
  return !!c && c.abierta && hoyISO <= c.fechaLimite;
}

/** Las citaciones se arman con el reporte CERRADO: antes la lista de citados puede cambiar. */
export function puedeCitar(c: ConvocatoriaAlerta | null, hoyISO: string): boolean {
  return !!c && !convocatoriaEditable(c, hoyISO);
}

// ── planilla del docente ──────────────────────────────────────────────────────

export interface EstadoPlanillaAlerta {
  alerta: number;
  sinAlerta: number;
  sinMarcar: number;
  /** Entregada y sin nadie por marcar. Un estudiante que llega despues la vuelve pendiente. */
  completa: boolean;
}

export function estadoPlanilla(p: PlanillaAlerta | null, studentIds: string[]): EstadoPlanillaAlerta {
  const marcas = p?.estudiantes ?? {};
  let alerta = 0, sinAlerta = 0, sinMarcar = 0;
  for (const id of studentIds) {
    const m = marcas[id];
    if (m === 'alerta') alerta++;
    else if (m === 'sin_alerta') sinAlerta++;
    else sinMarcar++;
  }
  return { alerta, sinAlerta, sinMarcar, completa: !!p?.entregada && sinMarcar === 0 };
}

/** Un toque alterna ⚠️ ↔ ✓; desde vacio, el primer toque pone ⚠️ (es lo que se viene a marcar). */
export function siguienteMarca(actual: MarcaAlerta | undefined): MarcaAlerta {
  return actual === 'alerta' ? 'sin_alerta' : 'alerta';
}

/**
 * Lo que escribe «Entregar»: los que siguen sin marcar pasan a ✓. Solo devuelve los
 * cambios, para escribirlos con rutas de campo puntuales y no pisar lo que otro marco.
 */
export function marcasAlEntregar(p: PlanillaAlerta | null, studentIds: string[]): Record<string, MarcaAlerta> {
  const marcas = p?.estudiantes ?? {};
  const cambios: Record<string, MarcaAlerta> = {};
  for (const id of studentIds) if (!marcas[id]) cambios[id] = 'sin_alerta';
  return cambios;
}

// ── consolidado del director ───────────────────────────────────────────────────

export interface AsignaturaEsperada {
  subjectId: string;
  nombre: string;
}

export interface FilaConsolidado {
  studentId: string;
  /** Asignaturas en alerta, en el orden de `esperadas`. */
  enAlerta: string[];
  total: number;
  /** Asignaturas que aun no lo marcaron (planilla sin entregar o estudiante nuevo). */
  pendientes: string[];
  citar: boolean;
}

export interface Consolidado {
  filas: FilaConsolidado[];
  entregadas: string[];
  faltantes: string[];
  /** Planillas de asignaturas que no estan en la asignacion: se muestran, no se pierden. */
  extra: string[];
}

/**
 * El cuadro del director: estudiantes por asignaturas. Las ESPERADAS salen de la asignacion
 * academica (no se escriben a mano), asi «9 de 12 entregadas» dice la verdad.
 */
export function consolidarGrupo(
  planillas: PlanillaAlerta[],
  esperadas: AsignaturaEsperada[],
  studentIds: string[],
): Consolidado {
  const porAsignatura = new Map(planillas.map((p) => [p.subjectId, p]));
  const orden = [
    ...esperadas.map((e) => e.subjectId),
    ...planillas.map((p) => p.subjectId).filter((s) => !esperadas.some((e) => e.subjectId === s)),
  ];
  const completa = (s: string) => {
    const p = porAsignatura.get(s);
    return !!p && estadoPlanilla(p, studentIds).completa;
  };
  const filas = studentIds.map((studentId) => {
    const enAlerta: string[] = [];
    const pendientes: string[] = [];
    for (const s of orden) {
      const m = porAsignatura.get(s)?.estudiantes?.[studentId];
      if (m === 'alerta') enAlerta.push(s);
      else if (m !== 'sin_alerta') pendientes.push(s);
    }
    return { studentId, enAlerta, total: enAlerta.length, pendientes, citar: enAlerta.length >= MINIMO_PARA_CITAR };
  });
  return {
    filas,
    entregadas: esperadas.map((e) => e.subjectId).filter(completa),
    faltantes: esperadas.map((e) => e.subjectId).filter((s) => !completa(s)),
    extra: orden.filter((s) => !esperadas.some((e) => e.subjectId === s)),
  };
}

// ── agenda de citaciones ────────────────────────────────────────────────────────

export const PARAMETROS_POR_DEFECTO: ParametrosAgenda = {
  baseMin: 5,
  porAsignaturaMin: 3,
  intervaloMin: 2,
  generalMin: 30,
  umbralIndividual: 3,
  orden: 'mas_asignaturas',
};

export interface Citado {
  studentId: string;
  nombre: string;
  asignaturas: number;
}

export interface Franja {
  inicio: string;
  fin: string;
}

export interface PropuestaAgenda {
  modo: ModoAgenda;
  citas: Record<string, Pick<CitaAlerta, 'hora' | 'duracionMin' | 'general'>>;
  necesariosMin: number;
  disponiblesMin: number;
  alcanza: boolean;
}

export const aMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const aHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function duracionTurno(asignaturas: number, p: ParametrosAgenda): number {
  return p.baseMin + p.porAsignaturaMin * asignaturas;
}

export function ordenarCitados(citados: Citado[], orden: ParametrosAgenda['orden']): Citado[] {
  const alfa = (a: Citado, b: Citado) => a.nombre.localeCompare(b.nombre, 'es');
  return [...citados].sort(orden === 'mas_asignaturas' ? (a, b) => b.asignaturas - a.asignaturas || alfa(a, b) : alfa);
}

/**
 * Reparte a los citados en la franja segun el modo:
 *  - `turnos`: cada uno su hora; dura base + minutos por asignatura, con intervalo entre turnos.
 *  - `general`: todos al inicio de la franja.
 *  - `mixta`: reunion general al inicio para los de menos de `umbralIndividual` asignaturas y
 *    despues turnos para los demas.
 * No recorta nada: si no alcanza lo dice (`alcanza: false`) y el director decide.
 */
export function proponerAgenda(citados: Citado[], franja: Franja, modo: ModoAgenda, p: ParametrosAgenda): PropuestaAgenda {
  const ini = aMinutos(franja.inicio);
  const disponiblesMin = Math.max(0, aMinutos(franja.fin) - ini);
  const citas: PropuestaAgenda['citas'] = {};
  const ordenados = ordenarCitados(citados, p.orden);

  const aGeneral = modo === 'general' ? ordenados : modo === 'mixta' ? ordenados.filter((c) => c.asignaturas < p.umbralIndividual) : [];
  const aTurnos = ordenados.filter((c) => !aGeneral.includes(c));

  let cursor = ini;
  if (aGeneral.length) {
    for (const c of aGeneral) citas[c.studentId] = { hora: aHora(ini), duracionMin: p.generalMin, general: true };
    cursor = ini + p.generalMin + (aTurnos.length ? p.intervaloMin : 0);
  }
  aTurnos.forEach((c, i) => {
    const d = duracionTurno(c.asignaturas, p);
    citas[c.studentId] = { hora: aHora(cursor), duracionMin: d, general: false };
    cursor += d + (i < aTurnos.length - 1 ? p.intervaloMin : 0);
  });
  const necesariosMin = cursor - ini;
  return { modo, citas, necesariosMin, disponiblesMin, alcanza: necesariosMin <= disponiblesMin };
}

export interface Alternativa {
  etiqueta: string;
  modo: ModoAgenda;
  parametros: ParametrosAgenda;
  necesariosMin: number;
  alcanza: boolean;
}

/**
 * Cuando no alcanza el tiempo: las salidas posibles, cada una con su resultado, para que el
 * director elija viendo los numeros. Solo se ofrecen las que cambian algo.
 */
export function alternativasSiNoAlcanza(citados: Citado[], franja: Franja, modo: ModoAgenda, p: ParametrosAgenda): Alternativa[] {
  const base = proponerAgenda(citados, franja, modo, p);
  if (base.alcanza) return [];
  const opciones: Omit<Alternativa, 'necesariosMin' | 'alcanza'>[] = [];
  if (modo !== 'general' && p.porAsignaturaMin > 2) {
    opciones.push({ etiqueta: 'Bajar a 2 min por asignatura', modo, parametros: { ...p, porAsignaturaMin: 2 } });
  }
  if (modo === 'turnos') opciones.push({ etiqueta: 'Forma mixta', modo: 'mixta', parametros: p });
  if (modo !== 'general') opciones.push({ etiqueta: 'Reunión general', modo: 'general', parametros: p });
  return opciones.map((o) => {
    const r = proponerAgenda(citados, franja, o.modo, o.parametros);
    return { ...o, necesariosMin: r.necesariosMin, alcanza: r.alcanza };
  });
}

export interface ProblemaAgenda {
  studentId: string;
  tipo: 'fuera_de_franja' | 'se_pisa';
  /** Con quien se pisa. */
  con?: string;
}

/** Revisa una agenda movida a mano: turnos fuera de la franja o que se pisan entre si. */
export function revisarAgenda(citas: Record<string, Pick<CitaAlerta, 'hora' | 'duracionMin' | 'general'>>, franja: Franja): ProblemaAgenda[] {
  const ini = aMinutos(franja.inicio), fin = aMinutos(franja.fin);
  const problemas: ProblemaAgenda[] = [];
  const turnos = Object.entries(citas)
    .map(([id, c]) => ({ id, desde: aMinutos(c.hora), hasta: aMinutos(c.hora) + c.duracionMin, general: c.general }))
    .sort((a, b) => a.desde - b.desde);
  for (const t of turnos) if (t.desde < ini || t.hasta > fin) problemas.push({ studentId: t.id, tipo: 'fuera_de_franja' });
  // Los de la reunion general comparten hora a proposito: solo se cruzan los individuales.
  const individuales = turnos.filter((t) => !t.general);
  const general = turnos.find((t) => t.general);
  for (let i = 0; i < individuales.length; i++) {
    const t = individuales[i];
    const previo = individuales[i - 1];
    if (previo && t.desde < previo.hasta) problemas.push({ studentId: t.id, tipo: 'se_pisa', con: previo.id });
    else if (general && t.desde < general.hasta && t.hasta > general.desde) problemas.push({ studentId: t.id, tipo: 'se_pisa', con: 'reunion_general' });
  }
  return problemas;
}

// ── cambios en la lista de citados ──────────────────────────────────────────────

export interface CambioCitados {
  /** Ahora tienen 2 o mas y no estaban en la agenda. */
  entran: string[];
  /** Estaban en la agenda y ya no cumplen. `yaEnviada`: la familia ya recibio la citacion. */
  salen: { studentId: string; yaEnviada: boolean }[];
}

/**
 * Julian, 2026-10-02: si se reabre la convocatoria o cambia la alerta de un estudiante, el
 * director DEBE enterarse de que su lista de citados cambio, y saber a quien ya le habia
 * llegado la citacion (para avisarle que no venga, o para citar al nuevo).
 */
export function cambiosEnCitados(citas: Record<string, CitaAlerta>, citadosAhora: string[]): CambioCitados {
  const enAgenda = Object.keys(citas);
  return {
    entran: citadosAhora.filter((id) => !enAgenda.includes(id)),
    salen: enAgenda
      .filter((id) => !citadosAhora.includes(id))
      .map((id) => {
        const c = citas[id];
        return { studentId: id, yaEnviada: !!(c.enviadaCorreoEn || c.enviadaSmsEn || c.impresaEn) };
      }),
  };
}

// ── envio de la citacion ────────────────────────────────────────────────────────

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' → «jue 22 oct». */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS_CORTOS[new Date(a, m - 1, d).getDay()]} ${d} ${MESES_CORTOS[m - 1]}`;
}

/**
 * El SMS de la citacion: corto, con lo indispensable y el mismo motivo GENERICO de la
 * impresa. Sin enlace: no hay nada que responder, solo venir.
 */
export function textoSmsCitacion(c: {
  estudiante: string;
  grado: string;
  fechaISO: string;
  hora: string;
  general: boolean;
  periodo: number;
  director: string;
}): string {
  const [h, m] = c.hora.split(':').map(Number);
  const hora = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  return (
    `I.E. Manuel J. Betancur. Acudiente de ${c.estudiante} (${c.grado}): le citamos el ${fechaCorta(c.fechaISO)} a las ${hora}` +
    `${c.general ? ' (reunión general)' : ''}, seguimiento de la alerta académica del periodo ${c.periodo}. Asistencia obligatoria: la citación sirve de soporte para la licencia laboral de acudiente (Ley 2466 de 2025). Dir. de grupo: ${c.director}.`
  );
}
