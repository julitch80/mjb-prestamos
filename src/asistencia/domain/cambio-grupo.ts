/**
 * Cambio de grupo — logica pura (2026-10-22).
 *
 * EL PROBLEMA QUE RESUELVE. Hasta hoy no habia forma de cambiar a un estudiante de grupo
 * desde la aplicacion. La coordinacion hacia lo unico disponible: «Marcar como retirado»
 * en 10.1 y «Agregar estudiante nuevo» en 10.4. Eso falla de dos maneras:
 *
 *  - Si teclea el MISMO documento, `crearEstudianteManual` lo reconoce (el hash es la
 *    persona) y se niega: «Ya existe una ficha con ese documento». El estudiante queda
 *    retirado en 10.1 y fuera de 10.4: atascado.
 *  - Si el documento no coincide (otro digito, el RC en vez de la TI, una ficha vieja sin
 *    documento), se crea una persona NUEVA: otro `studentId`, sin foto (la foto va por
 *    `studentId`), sin los datos del Master, sin historial ni marcas de alerta.
 *
 * Cambiar de grupo NO es dar de alta: es la MISMA ficha con otra matricula. Aqui se
 * calcula todo lo que hay que escribir; `datos.ts` solo lo escribe.
 *
 * Lo que NO se toca, a proposito:
 *  - Las sesiones viejas: la asistencia de 10.1 sucedio en 10.1. Esta en el mapa por
 *    `studentId`, que no cambia, asi que sigue siendo del estudiante.
 *  - Las marcas de alerta de 10.1 se COPIAN, no se mueven: el consolidado del director
 *    recorre la lista vigente del grupo, asi que en 10.1 dejan de contar solas, y el
 *    original queda como constancia de lo que el docente marco.
 *  - Las citaciones de 10.1: las arma y las atiende el director de 10.1, y la cita pudo
 *    haber ocurrido ya. Solo se avisan, para que nadie cite dos veces.
 */
import { alertaId, combinarPlanillas } from './alerta-academica';
import { enrollmentId, gradoSortKey, jornadaDeGrado } from './ids';
import { normalizar } from './nombres';
import type { AgendaCitaciones, CambioDeGrupo, Enrollment, Jornada, MarcaAlerta, PlanillaAlerta, Sede, Student } from './types';

export type { CambioDeGrupo };

// ── validacion ──────────────────────────────────────────────────────────────────

/**
 * Por que NO se puede hacer el cambio, o null si se puede. El texto va tal cual a la
 * pantalla.
 *
 * `jornadaLimitada`: el coordinador de central acotado a una jornada solo lee y escribe
 * la suya. Un cambio que cruce de jornada le fallaria a medias (lee las alertas de un
 * lado y no puede escribir en el otro), asi que se dice antes.
 */
export function motivoParaNoCambiar(
  est: Pick<Student, 'gradoActual'>,
  gradoNuevo: string,
  jornadaLimitada: Jornada | null,
): string | null {
  const g = (gradoNuevo ?? '').trim();
  if (!g) return 'Elija el grupo nuevo.';
  if (g.includes('/')) return 'Ese grupo no es válido.';
  if (g === est.gradoActual) return `El estudiante ya está en ${g}.`;
  if (jornadaLimitada) {
    const fuera = [est.gradoActual, g].find((x) => jornadaDeGrado(x) !== jornadaLimitada);
    if (fuera) {
      return `${fuera} es de la otra jornada. Este cambio lo hace un coordinador con autoridad en las dos jornadas.`;
    }
  }
  return null;
}

/**
 * Grupos que se ofrecen como destino: primero los del mismo grado (10.1 → 10.4 es el caso
 * de todos los dias), luego el resto. Literales, sin sanear la `º`.
 */
export function gruposDestino(gradoActual: string, todos: string[]): { mismoGrado: string[]; otros: string[] } {
  const nivel = (g: string) => g.match(/^(\d+)[.º]/)?.[1] ?? null;
  const n = nivel(gradoActual);
  const unicos = [...new Set(todos.map((g) => g.trim()).filter((g) => g && g !== gradoActual))];
  const orden = (a: string, b: string) => gradoSortKey(a).localeCompare(gradoSortKey(b));
  return {
    mismoGrado: unicos.filter((g) => n !== null && nivel(g) === n && jornadaDeGrado(g) === jornadaDeGrado(gradoActual)).sort(orden),
    otros: unicos.filter((g) => !(n !== null && nivel(g) === n && jornadaDeGrado(g) === jornadaDeGrado(gradoActual))).sort(orden),
  };
}

// ── matriculas ──────────────────────────────────────────────────────────────────

export interface PlanMatriculas {
  /** Ids de las matriculas abiertas que se cierran con `hasta = fecha`. */
  cerrar: string[];
  nuevaId: string;
  nueva: Enrollment;
}

/** Id de una matricula a partir de sus datos (los documentos no guardan su propio id). */
export function idDeMatricula(m: Pick<Enrollment, 'studentId' | 'anio' | 'seq'>): string {
  return enrollmentId(m.studentId, m.anio, m.seq ?? 1);
}

/**
 * Cierra TODAS las matriculas abiertas del estudiante (si alguna vez quedaron dos, se
 * arregla de paso) y abre una nueva en el grupo destino.
 *
 * El `seq` sale de TODAS las matriculas del anio, no solo de las abiertas: con solo las
 * abiertas, un estudiante que ya cambio una vez podria recibir un id que ya existe y la
 * escritura pisaria su matricula vieja.
 *
 * `hasta` es exclusivo: el dia del cambio ya pertenece al grupo nuevo (misma convencion
 * que `changeStudentGrade` en las Cloud Functions).
 */
export function planMatriculas(input: {
  studentId: string;
  matriculas: Enrollment[];
  gradoNuevo: string;
  sede: Sede;
  anio: number;
  fecha: string;
}): PlanMatriculas {
  const propias = input.matriculas.filter((m) => m.studentId === input.studentId);
  const cerrar = propias.filter((m) => m.hasta === null).map(idDeMatricula);
  const ocupados = new Set(propias.map(idDeMatricula));
  let seq = Math.max(0, ...propias.filter((m) => m.anio === input.anio).map((m) => m.seq ?? 1)) + 1;
  while (ocupados.has(enrollmentId(input.studentId, input.anio, seq))) seq++;
  return {
    cerrar,
    nuevaId: enrollmentId(input.studentId, input.anio, seq),
    nueva: {
      studentId: input.studentId,
      anio: input.anio,
      grado: input.gradoNuevo,
      sede: input.sede,
      seq,
      desde: input.fecha,
      hasta: null,
    },
  };
}

/**
 * Matriculas abiertas SIN el campo `sede` (anteriores al 2026-08-02). La regla de
 * `asistenciaEnrollments` exige la sede del documento para que coordinacion la cierre, asi
 * que con una de estas el lote entero se rechazaria. Se detecta antes, para decirlo claro.
 */
export function matriculasSinSede(matriculas: Enrollment[], studentIds: string[]): string[] {
  return matriculas
    .filter((m) => studentIds.includes(m.studentId) && m.hasta === null && !m.sede)
    .map(idDeMatricula);
}

// ── duplicados ──────────────────────────────────────────────────────────────────

/**
 * Fichas del grupo destino que parecen ser la MISMA persona: mismo hash de documento, o
 * mismo nombre completo (sin tildes ni mayusculas). Es la huella de un traslado hecho a
 * mano con «Agregar estudiante nuevo»: una ficha sin foto ni datos que hay que retirar.
 *
 * Solo sugiere: retirarla lo decide la coordinacion en pantalla. Dos homonimos reales en
 * el mismo grupo son posibles.
 */
export function posiblesDuplicados(
  est: Pick<Student, 'studentId' | 'nombres' | 'apellidos' | 'docHash'>,
  enDestino: Pick<Student, 'studentId' | 'nombres' | 'apellidos' | 'docHash' | 'activo'>[],
): string[] {
  const nombre = (s: { nombres: string; apellidos: string }) => normalizar(`${s.nombres} ${s.apellidos}`);
  const propio = nombre(est);
  return enDestino
    .filter((s) => s.studentId !== est.studentId && s.activo)
    .filter((s) => (est.docHash && s.docHash === est.docHash) || nombre(s) === propio)
    .map((s) => s.studentId);
}

// ── marcas de alerta academica ────────────────────────────────────────────────

export interface Traslado {
  /** Planilla de donde sale la marca. */
  desde: string;
  /** Si la marca estaba a nombre de la ficha duplicada, su id. */
  fichaDuplicada?: string;
}

export interface CopiaAlerta {
  /** Planilla destino. */
  alertaId: string;
  subjectId: string;
  periodo: number;
  marca: MarcaAlerta;
  traslado: Traslado;
  /**
   * Si la planilla destino no existe todavia, la base para crearla. Va a nombre del puesto
   * del docente asignado (`slotId`), como si la hubiera abierto el: asi el docente la
   * sigue usando como suya.
   */
  crear: Omit<PlanillaAlerta, 'estudiantes' | 'entregada' | 'entregadaPor' | 'entregadaEn' | 'ultimaEscrituraPor' | 'ultimaEscrituraEn'> | null;
}

export interface ConservadaAlerta {
  alertaId: string;
  subjectId: string;
  periodo: number;
  /** La que el docente del grupo nuevo ya habia puesto, y que se respeta. */
  marcaDestino: MarcaAlerta;
  marcaOrigen: MarcaAlerta;
}

export interface SinDestinoAlerta {
  subjectId: string;
  periodo: number;
  marca: MarcaAlerta;
  /** Por que no viaja: la asignatura no se dicta en el grupo nuevo, o no se sabe quien la dicta. */
  motivo: 'sin_asignatura' | 'docente_ambiguo';
}

export interface PlanAlertas {
  copiar: CopiaAlerta[];
  conservadas: ConservadaAlerta[];
  sinDestino: SinDestinoAlerta[];
}

/** Entrada de la asignacion academica de MJB (`docenteId` ES el `slotId`). */
export interface EntradaAsignacionMinima {
  docenteId: string;
  asignaturaId: string;
  grupo: string;
}

/**
 * El puesto que dicta una asignatura en un grupo, segun la asignacion academica. `null`
 * si nadie la dicta ahi; `'ambiguo'` si la dictan dos (no se adivina a nombre de quien
 * crear la planilla).
 */
export function slotDeAsignatura(
  asignacion: EntradaAsignacionMinima[],
  grupo: string,
  subjectId: string,
): string | null | 'ambiguo' {
  const slots = [...new Set(asignacion.filter((e) => e.grupo === grupo && e.asignaturaId === subjectId).map((e) => e.docenteId))];
  if (slots.length === 0) return null;
  return slots.length === 1 ? slots[0] : 'ambiguo';
}

/**
 * Que marcas de alerta viajan al grupo nuevo, y como.
 *
 * Fuentes, en este orden de preferencia para cada planilla destino:
 *  1. Lo que el docente del grupo nuevo YA marco para el estudiante: nunca se pisa.
 *  2. Lo que ese docente marco a nombre de la ficha DUPLICADA (el estudiante ya asistia a
 *     su clase con la ficha mal creada): es su marca, para este mismo estudiante.
 *  3. Lo que marco el docente del grupo viejo en la misma asignatura y periodo.
 *
 * Si la planilla destino no existe, se crea solo si la asignacion dice quien dicta esa
 * asignatura en el grupo nuevo; si no, la marca se informa como «sin destino».
 */
export function planAlertas(input: {
  studentId: string;
  sede: Sede;
  anio: number;
  gradoNuevo: string;
  /** Planillas del grupo viejo (cualquier periodo del anio). */
  origen: PlanillaAlerta[];
  /** Planillas del grupo nuevo (cualquier periodo del anio). */
  destino: PlanillaAlerta[];
  /** Fichas duplicadas que se van a retirar en el mismo cambio. */
  duplicados?: string[];
  slotDe: (subjectId: string) => string | null | 'ambiguo';
}): PlanAlertas {
  const plan: PlanAlertas = { copiar: [], conservadas: [], sinDestino: [] };
  const destinoPorId = new Map(input.destino.map((p) => [p.alertaId, p]));
  const yaPlaneado = new Set<string>();
  const jornada = jornadaDeGrado(input.gradoNuevo);

  // 2. Marcas a nombre de la ficha duplicada, dentro de las planillas del grupo nuevo.
  for (const p of input.destino) {
    if (p.estudiantes?.[input.studentId]) continue; // 1. ya tiene la suya
    for (const dup of input.duplicados ?? []) {
      const m = p.estudiantes?.[dup];
      if (!m) continue;
      plan.copiar.push({
        alertaId: p.alertaId, subjectId: p.subjectId, periodo: p.periodo, marca: m,
        traslado: { desde: p.alertaId, fichaDuplicada: dup }, crear: null,
      });
      yaPlaneado.add(p.alertaId);
      break;
    }
  }

  // 3. Marcas del grupo viejo.
  // Asignatura compartida (2026-10-23): las planillas de sus docentes viajan combinadas.
  const origenOrdenado = combinarPlanillas(input.origen).sort((a, b) => a.periodo - b.periodo || a.subjectId.localeCompare(b.subjectId));
  for (const p of origenOrdenado) {
    const marca = p.estudiantes?.[input.studentId];
    if (!marca) continue;
    const comun = alertaId(input.anio, p.periodo, input.sede, input.gradoNuevo, p.subjectId);
    // En el grupo nuevo puede haber varias de la misma asignatura (compartida): la marca de
    // cualquiera se respeta, y la copia va a la comun o, si no la hay, a la de un docente.
    const delDestino = input.destino.filter((d) => d.subjectId === p.subjectId && d.periodo === p.periodo);
    const enDestino = destinoPorId.get(comun) ?? delDestino[0];
    const id = enDestino?.alertaId ?? comun;
    const marcaDestino = delDestino.map((d) => d.estudiantes?.[input.studentId]).find(Boolean);
    if (marcaDestino) {
      plan.conservadas.push({ alertaId: id, subjectId: p.subjectId, periodo: p.periodo, marcaDestino, marcaOrigen: marca });
      continue;
    }
    if (yaPlaneado.has(id)) {
      // La del docente del grupo nuevo (a nombre del duplicado) gana sobre la del viejo.
      const suya = plan.copiar.find((c) => c.alertaId === id)!;
      plan.conservadas.push({ alertaId: id, subjectId: p.subjectId, periodo: p.periodo, marcaDestino: suya.marca, marcaOrigen: marca });
      continue;
    }
    if (enDestino) {
      plan.copiar.push({ alertaId: id, subjectId: p.subjectId, periodo: p.periodo, marca, traslado: { desde: p.alertaId }, crear: null });
      yaPlaneado.add(id);
      continue;
    }
    const slot = input.slotDe(p.subjectId);
    if (slot === null || slot === 'ambiguo') {
      plan.sinDestino.push({
        subjectId: p.subjectId, periodo: p.periodo, marca,
        motivo: slot === null ? 'sin_asignatura' : 'docente_ambiguo',
      });
      continue;
    }
    plan.copiar.push({
      alertaId: id, subjectId: p.subjectId, periodo: p.periodo, marca, traslado: { desde: p.alertaId },
      crear: {
        alertaId: id, anio: input.anio, periodo: p.periodo, sede: input.sede, jornada,
        grado: input.gradoNuevo, subjectId: p.subjectId, slotId: slot,
      },
    });
    yaPlaneado.add(id);
  }
  return plan;
}

// ── citaciones ──────────────────────────────────────────────────────────────────

/** Periodos en que el estudiante figura en la agenda de citaciones del grupo viejo. */
export function citacionesPendientes(studentId: string, agendas: AgendaCitaciones[]): number[] {
  return agendas
    .filter((a) => a.citas?.[studentId])
    .map((a) => a.periodo)
    .sort((a, b) => a - b);
}

// ── el cambio completo ─────────────────────────────────────────────────────────

export interface PlanCambioGrupo {
  studentId: string;
  gradoAnterior: string;
  gradoNuevo: string;
  sede: Sede;
  fecha: string;
  /** Estaba retirado: el cambio lo reintegra (`activo: true`). */
  reintegra: boolean;
  matriculas: PlanMatriculas;
  /** Fichas duplicadas que se retiran en el mismo cambio, con sus matriculas abiertas. */
  retirarDuplicados: { studentId: string; cerrarMatriculas: string[] }[];
  alertas: PlanAlertas;
  /** Periodos con citacion en el grupo viejo (solo se informan). */
  citacionesEnGrupoAnterior: number[];
  registro: CambioDeGrupo;
}

export function planCambioGrupo(input: {
  estudiante: Student;
  gradoNuevo: string;
  anio: number;
  fecha: string;
  autor: string;
  ahoraMs: number;
  matriculas: Enrollment[];
  /** Matriculas de las fichas duplicadas que se retiran. */
  matriculasDuplicados?: Enrollment[];
  duplicadosARetirar?: string[];
  alertasOrigen: PlanillaAlerta[];
  alertasDestino: PlanillaAlerta[];
  agendasOrigen: AgendaCitaciones[];
  slotDe: (subjectId: string) => string | null | 'ambiguo';
}): PlanCambioGrupo {
  const est = input.estudiante;
  const gradoNuevo = input.gradoNuevo.trim();
  const duplicados = (input.duplicadosARetirar ?? []).filter((id) => id !== est.studentId);
  return {
    studentId: est.studentId,
    gradoAnterior: est.gradoActual,
    gradoNuevo,
    sede: est.sede,
    fecha: input.fecha,
    reintegra: !est.activo,
    matriculas: planMatriculas({
      studentId: est.studentId, matriculas: input.matriculas, gradoNuevo, sede: est.sede, anio: input.anio, fecha: input.fecha,
    }),
    retirarDuplicados: duplicados.map((id) => ({
      studentId: id,
      cerrarMatriculas: (input.matriculasDuplicados ?? []).filter((m) => m.studentId === id && m.hasta === null).map(idDeMatricula),
    })),
    alertas: planAlertas({
      studentId: est.studentId, sede: est.sede, anio: input.anio, gradoNuevo,
      origen: input.alertasOrigen, destino: input.alertasDestino, duplicados, slotDe: input.slotDe,
    }),
    citacionesEnGrupoAnterior: citacionesPendientes(est.studentId, input.agendasOrigen),
    registro: {
      desde: est.gradoActual, hacia: gradoNuevo, fecha: input.fecha, por: input.autor, en: input.ahoraMs,
      reintegrado: !est.activo,
    },
  };
}
