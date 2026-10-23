/**
 * Alerta academica — logica pura. Ver docs/modelo-alerta-academica.md.
 *
 * Julian, 2026-10-02: en la 7.ª semana de cada periodo cada docente senala, en cada planilla
 * (grado + asignatura), quien esta en alerta. El director de grupo consolida su grupo,
 * imprime un informe por estudiante (se entrega EN PERSONA) y cita al acudiente de quien
 * tiene DOS O MAS asignaturas en alerta. Las fechas, la franja y la FORMA de citar (turnos,
 * reunion general o mixta, con sus parametros; el colegio, 2026-10-22) las pone coordinacion;
 * las horas de cada citado, el director, con la propuesta de `proponerAgenda`.
 */
import type {
  AgendaCitaciones,
  BandaAgenda,
  CitaAlerta,
  ConvocatoriaAlerta,
  ExcepcionAgenda,
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

/**
 * Planilla PROPIA de un docente en una asignatura COMPARTIDA (dos docentes en el mismo grupo
 * y asignatura segun la asignacion academica). Julian, 2026-10-23: «si aparece en uno de los
 * dos, queda; si no aparece en ninguno, no queda». Con una sola planilla, el ✓ de uno borraba
 * el ⚠️ del otro (paso en 10.2 Ingles). Ahora cada uno marca la suya y el reporte las combina
 * (`combinarPlanillas`). Si el docente ya tenia la planilla comun a su nombre, sigue con esa.
 */
export function alertaIdDocente(anio: number, periodo: number, sede: Sede, grado: string, subjectId: string, slotId: string): string {
  return `${alertaId(anio, periodo, sede, grado, subjectId)}__${slotId}`;
}

/**
 * Responsable unico de una asignatura compartida (2026-10-22). VACIO desde el 2026-10-23: en
 * las compartidas marcan los dos y se combina (`alertaIdDocente`). Se deja por si un grupo
 * necesita otra vez que digite uno solo. Clave `grado|subjectId`, valor el slotId.
 */
export const RESPONSABLE_ALERTA: Record<string, string> = {};

/** El slotId de quien digita la alerta de ese grupo y asignatura, o null si no hay regla. */
export function responsableAlerta(grado: string, subjectId: string): string | null {
  return RESPONSABLE_ALERTA[`${grado}|${subjectId}`] ?? null;
}

/** ¿Este docente digita la alerta de ese grupo y asignatura? Sin regla, cualquiera que la dicte. */
export function digitaAlerta(slotId: string, grado: string, subjectId: string): boolean {
  const r = responsableAlerta(grado, subjectId);
  return r === null || r === slotId;
}

export function citacionAlertaId(anio: number, periodo: number, sede: Sede, grado: string): string {
  return `${anio}_${periodo}_${sede}_${grado}`;
}

// ── convocatoria ────────────────────────────────────────────────────────────────

/**
 * ¿Se puede marcar o corregir hoy? Abierta por coordinacion y sin pasar la fecha limite
 * (inclusive). Fuera de eso la planilla se ve pero no se edita.
 */
export function convocatoriaEditable(c: ConvocatoriaAlerta | null, hoyISO: string, ahora: number = Date.now()): boolean {
  return !!c && c.abierta && !alertaPorEmpezar(c, ahora) && !alertaVencida(c, hoyISO, ahora);
}

/** Instante (ms) de 'YYYY-MM-DD' a la hora 'HH:MM' de Colombia (UTC-5). Sin hora: fin del dia. */
export function instanteColombia(fechaISO: string, hora?: string | null): number {
  return new Date(`${fechaISO}T${hora ? `${hora}:00` : '23:59:59'}-05:00`).getTime();
}

/** Tiene ventana programada y todavia no llega su hora de inicio. */
export function alertaPorEmpezar(c: Pick<ConvocatoriaAlerta, 'inicio'>, ahora: number = Date.now()): boolean {
  return !!c.inicio && ahora < c.inicio;
}

/**
 * Ya paso el cierre. Sin hora de cierre, cuenta el dia entero (como siempre); con hora, el
 * ultimo dia cierra a esa hora.
 */
export function alertaVencida(
  c: Pick<ConvocatoriaAlerta, 'fechaLimite' | 'horaLimite'>,
  hoyISO: string,
  ahora: number = Date.now(),
): boolean {
  if (hoyISO !== c.fechaLimite) return hoyISO > c.fechaLimite;
  return !!c.horaLimite && ahora > instanteColombia(c.fechaLimite, c.horaLimite);
}

/** 'HH:MM' → '2:00 p. m.', para los textos. */
export function horaCorta(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/**
 * Si la planilla se puede marcar. El docente, mientras la convocatoria siga abierta y sin
 * vencer; coordinacion digitando en su nombre (2026-10-22), con que la convocatoria exista.
 */
export function alertaEditable(
  c: ConvocatoriaAlerta | null,
  hoyISO: string,
  puedeRegistrar: boolean,
  porCoordinacion = false,
): boolean {
  if (porCoordinacion) return !!c;
  return puedeRegistrar && convocatoriaEditable(c, hoyISO);
}

/** Las citaciones se arman con el reporte CERRADO: antes la lista de citados puede cambiar. */
export function puedeCitar(c: ConvocatoriaAlerta | null, hoyISO: string, ahora: number = Date.now()): boolean {
  // Cerrada o vencida. Una ventana PROGRAMADA que aun no empieza no habilita las
  // citaciones: los docentes todavia van a marcar.
  return !!c && (!c.abierta || alertaVencida(c, hoyISO, ahora));
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
  /** Puestos que la dictan en el grupo; con dos o mas es compartida y se esperan las de todos. */
  docentes?: string[];
}

/**
 * Una planilla por grupo y asignatura, combinando las de los docentes de una asignatura
 * compartida: ⚠️ si CUALQUIERA lo marco en alerta; ✓ solo si todos lo marcaron sin alerta;
 * si no, sin marcar (pendiente). Entregada cuando todos entregaron. Un docente esperado que
 * aun no abrio su planilla cuenta como «sin entregar»: la asignatura no queda completa.
 */
export function combinarPlanillas(planillas: PlanillaAlerta[], esperadas: AsignaturaEsperada[] = []): PlanillaAlerta[] {
  const grupos = new Map<string, PlanillaAlerta[]>();
  for (const p of planillas) {
    const k = `${p.grado}|${p.subjectId}|${p.periodo}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  return [...grupos.values()].map((ps) => {
    const docentes = esperadas.find((e) => e.subjectId === ps[0].subjectId)?.docentes ?? [];
    const falta = docentes.length > 1 && docentes.some((d) => !ps.some((p) => p.slotId === d));
    if (ps.length === 1 && !falta) return ps[0];
    const ids = new Set(ps.flatMap((p) => Object.keys(p.estudiantes ?? {})));
    const estudiantes: Record<string, MarcaAlerta> = {};
    for (const id of ids) {
      const marcas = ps.map((p) => p.estudiantes?.[id]);
      if (marcas.includes('alerta')) estudiantes[id] = 'alerta';
      else if (!falta && marcas.every((m) => m === 'sin_alerta')) estudiantes[id] = 'sin_alerta';
    }
    return { ...ps[0], estudiantes, entregada: !falta && ps.every((p) => p.entregada) };
  });
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
  const porAsignatura = new Map(combinarPlanillas(planillas, esperadas).map((p) => [p.subjectId, p]));
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

/**
 * Rangos de cada parametro. Son LOS MISMOS que exige la regla de la convocatoria
 * (`asisParametrosAgendaValidos` en rules/asistencia.rules): si se cambia uno, cambiar el otro.
 */
export const LIMITES_PARAMETROS = {
  baseMin: { min: 1, max: 60 },
  porAsignaturaMin: { min: 0, max: 30 },
  intervaloMin: { min: 0, max: 30 },
  generalMin: { min: 5, max: 240 },
  umbralIndividual: { min: 3, max: 20 },
} as const;

const MODOS_VALIDOS: ModoAgenda[] = ['turnos', 'general', 'mixta'];

/**
 * Lleva cualquier entrada (una caja vacia, un decimal, un documento a medias) a parametros
 * validos: enteros dentro de `LIMITES_PARAMETROS` y lo que falte, por defecto. Lo que se
 * guarda pasa siempre por aqui, asi la regla nunca rechaza lo que la pantalla deja escribir.
 */
export function normalizarParametros(p: Partial<Record<keyof ParametrosAgenda, unknown>> | null | undefined): ParametrosAgenda {
  const fuente = p ?? {};
  const num = (k: keyof typeof LIMITES_PARAMETROS): number => {
    const v = Number(fuente[k]);
    const { min, max } = LIMITES_PARAMETROS[k];
    return Number.isFinite(v) && fuente[k] !== null && fuente[k] !== '' ? Math.min(max, Math.max(min, Math.round(v))) : PARAMETROS_POR_DEFECTO[k];
  };
  return {
    baseMin: num('baseMin'),
    porAsignaturaMin: num('porAsignaturaMin'),
    intervaloMin: num('intervaloMin'),
    generalMin: num('generalMin'),
    umbralIndividual: num('umbralIndividual'),
    orden: fuente.orden === 'alfabetico' ? 'alfabetico' : 'mas_asignaturas',
  };
}

export interface MetodoAgenda {
  modo: ModoAgenda;
  parametros: ParametrosAgenda;
  /** Mixta por rangos (2026-10-23). Sin rangos, la mixta de antes (umbral + turnos). */
  bandas?: BandaAgenda[] | null;
}

// ── mixta por rangos ─────────────────────────────────────────────────────────

export const MAX_BANDAS = 10;

/** Ordena por `desde`, redondea y acota. */
export function normalizarBandas(bandas: BandaAgenda[] | null | undefined): BandaAgenda[] {
  return (bandas ?? [])
    .map((b) => {
      const h = b.hasta as unknown;
      return {
        desde: Math.max(MINIMO_PARA_CITAR, Math.round(Number(b.desde) || MINIMO_PARA_CITAR)),
        hasta: h === null || h === undefined || h === '' ? null : Math.round(Number(h)),
        hora: String(b.hora ?? ''),
        duracionMin: Math.min(240, Math.max(5, Math.round(Number(b.duracionMin) || 30))),
      };
    })
    .sort((a, b) => a.desde - b.desde)
    .slice(0, MAX_BANDAS);
}

/**
 * Lo que impide guardar los rangos, en castellano. Vacio = validos: empiezan en 2, se
 * siguen sin huecos ni cruces, el ultimo queda abierto («o mas») y cada reunion cabe en la
 * franja de entrega.
 */
export function problemasBandas(bandas: BandaAgenda[], franja: Franja | null): string[] {
  const p: string[] = [];
  if (bandas.length === 0) return ['Agregue al menos un rango.'];
  if (bandas[0].desde !== MINIMO_PARA_CITAR) p.push(`El primer rango debe empezar en ${MINIMO_PARA_CITAR} asignaturas (con menos no se cita).`);
  bandas.forEach((b, i) => {
    const ultimo = i === bandas.length - 1;
    if (b.hasta !== null && b.hasta < b.desde) p.push(`Rango ${i + 1}: «hasta» no puede ser menor que «desde».`);
    if (!ultimo && b.hasta === null) p.push(`Rango ${i + 1}: solo el último puede quedar abierto («o más»).`);
    if (ultimo && b.hasta !== null) p.push('El último rango debe quedar abierto («o más»), para que nadie quede sin hora.');
    if (!ultimo && b.hasta !== null && bandas[i + 1].desde !== b.hasta + 1) {
      p.push(bandas[i + 1].desde > b.hasta + 1
        ? `Hay un hueco entre el rango ${i + 1} y el ${i + 2}: falta ${b.hasta + 1}.`
        : `Los rangos ${i + 1} y ${i + 2} se cruzan.`);
    }
    if (!/^\d{2}:\d{2}$/.test(b.hora)) p.push(`Rango ${i + 1}: falta la hora.`);
    else if (franja && (aMinutos(b.hora) < aMinutos(franja.inicio) || aMinutos(b.hora) + b.duracionMin > aMinutos(franja.fin))) {
      p.push(`Rango ${i + 1}: la reunión debe quedar dentro de la franja (${franja.inicio} a ${franja.fin}).`);
    }
  });
  return p;
}

/** El rango que le toca a quien tiene `n` asignaturas en alerta. */
export function bandaDe(n: number, bandas: BandaAgenda[]): BandaAgenda | null {
  return bandas.find((b) => n >= b.desde && (b.hasta === null || n <= b.hasta)) ?? null;
}

/** «2 a 3», «7 o más», «4» */
export function textoRango(b: BandaAgenda): string {
  return b.hasta === null ? `${b.desde} o más` : b.hasta === b.desde ? `${b.desde}` : `${b.desde} a ${b.hasta}`;
}

/** Formas en que la agenda queda determinada por coordinacion: el director no decide nada. */
export function agendaSinDecisiones(m: MetodoAgenda | null): boolean {
  return !!m && (m.modo === 'general' || (m.modo === 'mixta' && !!m.bandas?.length));
}

/**
 * La forma de citar que fijo coordinacion en la convocatoria (el colegio, 2026-10-22), o
 * `null` si aun no la fijo — o si es una convocatoria anterior al cambio, que no la trae.
 */
export function metodoDeConvocatoria(
  c: Pick<ConvocatoriaAlerta, 'modoAgenda' | 'parametrosAgenda' | 'bandasAgenda'> | null,
): MetodoAgenda | null {
  if (!c?.modoAgenda || !MODOS_VALIDOS.includes(c.modoAgenda)) return null;
  const bandas = c.modoAgenda === 'mixta' && c.bandasAgenda?.length ? normalizarBandas(c.bandasAgenda) : null;
  return { modo: c.modoAgenda, parametros: normalizarParametros(c.parametrosAgenda), bandas };
}

/** ¿La agenda guardada se armo con esta misma forma? Si no, el director ve el aviso de recalcular. */
// ── casos especiales por grupo (2026-10-23) ─────────────────────────────────────────

/**
 * La convocatoria tal como la vive UN grupo: con su caso especial (otra fecha, otra franja y,
 * con la mixta por rangos, otras horas) si coordinacion lo definio; si no, la de todos. Todo
 * lo del grupo la usa: agenda, citaciones, planilla de firmas y dia de la entrega.
 */
export function convocatoriaDelGrado(c: ConvocatoriaAlerta, grado: string): ConvocatoriaAlerta {
  const x = c.excepcionesAgenda?.[grado];
  if (!x) return c;
  const conBandas = c.modoAgenda === 'mixta' && !!c.bandasAgenda?.length;
  return {
    ...c,
    fechaEntrega: x.fechaEntrega,
    franjaInicio: x.franjaInicio,
    franjaFin: x.franjaFin,
    bandasAgenda: conBandas && x.bandas?.length ? x.bandas : c.bandasAgenda,
  };
}

/** Para un caso nuevo: lo de todos (fecha, franja y, con rangos, sus mismas horas), para cambiar. */
export function excepcionPropuesta(c: ConvocatoriaAlerta): ExcepcionAgenda {
  return {
    fechaEntrega: c.fechaEntrega ?? '',
    franjaInicio: c.franjaInicio ?? '',
    franjaFin: c.franjaFin ?? '',
    bandas: c.modoAgenda === 'mixta' && c.bandasAgenda?.length ? normalizarBandas(c.bandasAgenda) : null,
    motivo: '',
  };
}

/** Lo que impide guardar un caso especial; con rangos, cada reunion dentro de su franja. */
export function problemasExcepcion(x: ExcepcionAgenda): string[] {
  const p: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.fechaEntrega)) p.push('Falta el día de la entrega.');
  if (!/^\d{2}:\d{2}$/.test(x.franjaInicio) || !/^\d{2}:\d{2}$/.test(x.franjaFin)) p.push('Falta la franja (desde y hasta).');
  else if (x.franjaInicio >= x.franjaFin) p.push('La hora de inicio debe ser anterior a la de fin.');
  else if (x.bandas?.length) p.push(...problemasBandas(normalizarBandas(x.bandas), { inicio: x.franjaInicio, fin: x.franjaFin }));
  return p;
}

/** Al correr la franja, las horas de los rangos se corren lo mismo (empieza 30 min despues: todas 30 min despues). */
export function correrBandas(bandas: BandaAgenda[], deInicio: string, aInicio: string): BandaAgenda[] {
  if (!/^\d{2}:\d{2}$/.test(deInicio) || !/^\d{2}:\d{2}$/.test(aInicio)) return bandas;
  const d = aMinutos(aInicio) - aMinutos(deInicio);
  return bandas.map((b) => (/^\d{2}:\d{2}$/.test(b.hora) ? { ...b, hora: aHora(Math.max(0, Math.min(23 * 60 + 59, aMinutos(b.hora) + d))) } : b));
}

export function mismoMetodo(a: MetodoAgenda, b: MetodoAgenda): boolean {
  if (a.modo !== b.modo) return false;
  if (a.modo === 'mixta' && (a.bandas?.length || b.bandas?.length)) {
    return JSON.stringify(normalizarBandas(a.bandas)) === JSON.stringify(normalizarBandas(b.bandas));
  }
  const pa = normalizarParametros(a.parametros), pb = normalizarParametros(b.parametros);
  // Solo cuentan los parametros que usa el modo: en `general` no importa la duracion del turno.
  const usados: (keyof ParametrosAgenda)[] =
    a.modo === 'turnos' ? ['baseMin', 'porAsignaturaMin', 'intervaloMin', 'orden']
    : a.modo === 'general' ? ['generalMin']
    : ['baseMin', 'porAsignaturaMin', 'intervaloMin', 'generalMin', 'umbralIndividual', 'orden'];
  return usados.every((k) => pa[k] === pb[k]);
}

export const NOMBRE_MODO: Record<ModoAgenda, string> = {
  turnos: 'Turnos individuales',
  general: 'Reunión general',
  mixta: 'Mixta',
};

/** La forma en una linea, para que el director vea con que se le propone la agenda. */
export function describirMetodo(m: MetodoAgenda): string {
  const p = m.parametros;
  const turno = `turnos de ${p.baseMin} min + ${p.porAsignaturaMin} por asignatura, ${p.intervaloMin} min entre turnos`;
  const orden = p.orden === 'alfabetico' ? 'en orden alfabético' : 'más asignaturas primero';
  if (m.modo === 'general') return `Reunión general de ${p.generalMin} min al inicio de la franja`;
  if (m.modo === 'turnos') return `Turnos individuales: ${turno}; ${orden}`;
  if (m.bandas?.length) {
    return 'Por rangos: ' + m.bandas.map((b) => `${textoRango(b)} asignaturas, reunión a las ${horaCorta(b.hora)} (${b.duracionMin} min)`).join('; ');
  }
  return `Mixta: reunión general de ${p.generalMin} min para quien tiene menos de ${p.umbralIndividual} asignaturas, y ${turno}; ${orden}`;
}

export interface AjusteGrupo {
  grado: string;
  citados: number;
  necesariosMin: number;
  alcanza: boolean;
}

/**
 * Para COORDINACION, al elegir la forma: cuanto necesita cada grupo de la jornada con ella
 * en la franja. Antes esa cuenta la veia solo el director; ahora quien decide es coordinacion.
 * Los grupos sin citados no aparecen.
 */
export function ajusteDeJornada(grupos: { grado: string; citados: Citado[] }[], franja: Franja, metodo: MetodoAgenda): AjusteGrupo[] {
  return grupos
    .filter((g) => g.citados.length > 0)
    .map((g) => {
      const r = proponerAgenda(g.citados, franja, metodo.modo, metodo.parametros, metodo.bandas);
      return { grado: g.grado, citados: g.citados.length, necesariosMin: r.necesariosMin, alcanza: r.alcanza };
    });
}

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
export function proponerAgenda(
  citados: Citado[],
  franja: Franja,
  modo: ModoAgenda,
  p: ParametrosAgenda,
  bandas?: BandaAgenda[] | null,
): PropuestaAgenda {
  const ini = aMinutos(franja.inicio);
  const disponiblesMin = Math.max(0, aMinutos(franja.fin) - ini);
  const citas: PropuestaAgenda['citas'] = {};

  // Mixta por rangos: cada citado va a la reunion de su rango (todos a la misma hora).
  if (modo === 'mixta' && bandas?.length) {
    let fin = ini;
    for (const c of citados) {
      const b = bandaDe(c.asignaturas, bandas) ?? bandas[bandas.length - 1];
      citas[c.studentId] = { hora: b.hora, duracionMin: b.duracionMin, general: true };
      fin = Math.max(fin, aMinutos(b.hora) + b.duracionMin);
    }
    const necesariosMin = fin - ini;
    return { modo, citas, necesariosMin, disponiblesMin, alcanza: necesariosMin <= disponiblesMin };
  }
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

/**
 * La agenda tal como la propone la forma de coordinacion, lista para guardar o imprimir,
 * sin envios registrados. Con la REUNION GENERAL no hay nada que decidir (todos a la misma
 * hora, al inicio de la franja), asi que se guarda sola y, si el director nunca abrio su
 * reporte, el archivo de impresion de coordinacion la arma con esto (Julian, 2026-10-22).
 */
export function agendaPropuesta(
  base: { anio: number; periodo: number; sede: Sede; jornada: Jornada; grado: string },
  citados: Citado[],
  franja: Franja,
  metodo: MetodoAgenda,
): AgendaCitaciones {
  const r = proponerAgenda(citados, franja, metodo.modo, metodo.parametros, metodo.bandas);
  const citas = Object.fromEntries(
    Object.entries(r.citas).map(([id, c]) => [id, { ...c, enviadaCorreoEn: null, enviadaSmsEn: null, impresaEn: null } as CitaAlerta]),
  );
  return {
    citacionId: citacionAlertaId(base.anio, base.periodo, base.sede, base.grado),
    ...base,
    modo: metodo.modo,
    parametros: metodo.parametros,
    bandas: metodo.bandas ?? null,
    citas,
    entregaCerradaEn: null,
    ultimaEscrituraPor: '',
    ultimaEscrituraEn: 0,
  };
}

/**
 * La agenda con la que se imprime y se trabaja cuando la forma la decide coordinacion
 * (`agendaSinDecisiones`): si la guardada se armo con OTRA forma (p. ej. se guardo sola con
 * la reunion general y luego coordinacion paso a rangos), se recalcula con la vigente y se
 * conserva lo registrado de cada familia (envios, asistencia, excusa...). Sin agenda guardada,
 * la propuesta. Fallo real, 2026-10-23: las planillas de firmas salian con la hora vieja.
 */
export function agendaVigente(
  guardada: AgendaCitaciones | null | undefined,
  base: { anio: number; periodo: number; sede: Sede; jornada: Jornada; grado: string },
  citados: Citado[],
  franja: Franja,
  metodo: MetodoAgenda,
): AgendaCitaciones | null {
  if (guardada && mismoMetodo({ modo: guardada.modo, parametros: guardada.parametros, bandas: guardada.bandas ?? null }, metodo)) return guardada;
  if (citados.length === 0) return guardada ?? null;
  const nueva = agendaPropuesta(base, citados, franja, metodo);
  if (!guardada) return nueva;
  const citas = Object.fromEntries(Object.entries(nueva.citas).map(([id, c]) => {
    const antes = guardada.citas[id];
    if (!antes) return [id, c];
    const { hora: _h, duracionMin: _d, general: _g, ...resto } = antes;
    return [id, { ...c, ...resto }];
  }));
  return { ...guardada, modo: nueva.modo, parametros: nueva.parametros, bandas: nueva.bandas, citas };
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

// ── digitacion por coordinacion (2026-10-22) ──────────────────────────────────────────

export type EstadoDigitacion = 'entregada' | 'sin_entregar' | 'no_existe';

export interface FilaDigitacion {
  subjectId: string;
  /** Asignatura compartida: hay una fila por docente, cada uno con su planilla. */
  compartida: boolean;
  nombre: string;
  /** Puesto de quien la dicta segun la asignacion academica (o RESPONSABLE_ALERTA). */
  slotResponsable: string;
  estado: EstadoDigitacion;
  /** Puesto a cuyo nombre esta la planilla; null si no existe. */
  slotPlanilla: string | null;
  /** Existe a nombre de OTRO puesto: el docente asignado no puede marcarla (la regla lo rechaza). */
  aNombreDeOtro: boolean;
  /** Coordinacion ya la digito alguna vez. */
  porCoordinacion: boolean;
}

/**
 * Una fila por asignatura esperada del grupo, para la vista de coordinacion: si la planilla
 * esta entregada, sin entregar o no existe, y si esta a nombre de otro puesto (el caso que
 * bloquea al docente: la abrio otro y la regla solo deja escribir al dueño).
 */
export function filasDigitacion(
  grado: string,
  esperadas: { subjectId: string; nombre: string; slotId: string }[],
  planillas: PlanillaAlerta[],
): FilaDigitacion[] {
  return esperadas.map((e) => {
    const compartida = esperadas.filter((x) => x.subjectId === e.subjectId).length > 1;
    const delGrupo = planillas.filter((x) => x.grado === grado && x.subjectId === e.subjectId);
    // Compartida: la de ESTE docente y ninguna otra (la del colega es otra fila).
    const p = delGrupo.find((x) => x.slotId === e.slotId) ?? (compartida ? null : delGrupo[0] ?? null);
    return {
      subjectId: e.subjectId,
      compartida,
      nombre: e.nombre,
      slotResponsable: e.slotId,
      estado: !p ? 'no_existe' : p.entregada ? 'entregada' : 'sin_entregar',
      slotPlanilla: p?.slotId ?? null,
      aNombreDeOtro: !!p && p.slotId !== e.slotId,
      porCoordinacion: !!p?.porCoordinacion,
    };
  });
}
