/**
 * Resumen del periodo — lo que pasó con la permanencia entre dos fechas (2026-10-22).
 *
 * Es SOLO LECTURA y no decide nada: cuenta. La parte «Estudiantes en riesgo» de
 * `CasosPermanencia` usa una ventana móvil y abre casos; esto no toca esa lógica ni
 * escribe nada. Sirve para responder «¿cómo nos fue en el periodo 3?» o «¿cuántos casos
 * se cerraron este mes?», con los mismos datos que ya lee la pantalla.
 *
 * Tres fuentes:
 *  - el censo de la tercera hora (`CensoDia`, uno por grupo y día): las inasistencias;
 *  - los casos (`CasoPermanencia`): aperturas, cierres y los que siguen abiertos;
 *  - los seguimientos de cada caso (`SeguimientoCaso`): lo que se hizo.
 *
 * Las dos puntas del rango cuentan (desde y hasta INCLUSIVE). Las fechas son AAAA-MM-DD y
 * se comparan como texto: no pasan por `Date`, así que no hay corrimiento de zona horaria.
 */

import type { EventoCal } from '../../data/calendarioAcademico/tipos';
import { censoEsFiable } from './evasion';
import { gradoEnJornada, type FiltroJornada } from './filtro-jornada';
import { addDays, jornadaDeGrado } from './ids';
import { nombreCompleto } from './nombres';
import {
  ESTADO_CASO_ETIQUETA,
  ESTADOS_ABIERTOS,
  GESTION_ETIQUETA,
  NIVEL_ETIQUETA,
  type CasoPermanencia,
  type EstadoCaso,
  type NivelPermanencia,
  type TipoGestion,
} from './permanencia';
import { TIPO_SEGUIMIENTO_ETIQUETA, type DecisionSeguimiento, type SeguimientoCaso, type TipoSeguimiento } from './seguimiento-caso';
import type { CensoDia, Jornada } from './types';
import type { Hoja } from './exports';

// ---------------------------------------------------------------------------
//  El rango
// ---------------------------------------------------------------------------

export interface RangoFechas {
  /** AAAA-MM-DD, inclusive. */
  desde: string;
  /** AAAA-MM-DD, inclusive. */
  hasta: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** ¿La fecha cae en el rango? Las dos puntas cuentan. */
export function enRango(fecha: string | null | undefined, r: RangoFechas): boolean {
  if (!fecha) return false;
  const f = fecha.slice(0, 10);
  return f >= r.desde && f <= r.hasta;
}

/** El primer problema del rango, en palabras, o `null` si sirve. */
export function problemaDelRango(r: RangoFechas): string | null {
  if (!FECHA.test(r.desde)) return 'Falta la fecha «Desde».';
  if (!FECHA.test(r.hasta)) return 'Falta la fecha «Hasta».';
  if (r.desde > r.hasta) return '«Desde» es posterior a «Hasta».';
  return null;
}

/** La vista general: del 1 de enero del año en curso hasta hoy. */
export function rangoDelAnio(hoy: string): RangoFechas {
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
}

export interface AtajoRango {
  id: string;
  etiqueta: string;
  rango: RangoFechas;
  /** Falso si todavía no empieza: el botón se muestra apagado. */
  disponible: boolean;
  /** «en curso» si el periodo no ha terminado y el rango se cortó en hoy. */
  nota?: string;
}

/**
 * Los atajos: el año, los periodos del calendario académico, este mes y los últimos 30 días.
 *
 * Los periodos salen de los eventos `periodo` del calendario de MJB, del año de `hoy`, sin
 * el del grado 11 (que cierra antes, pero es el mismo periodo) ni los que no se realizan.
 * Se numeran en orden de fecha. Un periodo en curso se corta en hoy: lo que viene después
 * no tiene datos todavía, y «abiertos al final del rango» tiene que hablar de hoy.
 */
export function atajosDeRango(eventos: EventoCal[], hoy: string): AtajoRango[] {
  const anio = hoy.slice(0, 4);
  const periodos = eventos
    .filter(
      (e) =>
        e.categoria === 'periodo' &&
        e.aplicaA !== 'grado11' &&
        !e.noSeRealiza &&
        !e.porDefinir &&
        FECHA.test(e.desde) &&
        e.desde.slice(0, 4) === anio,
    )
    .sort((a, b) => a.desde.localeCompare(b.desde));

  const atajos: AtajoRango[] = [{ id: 'anio', etiqueta: 'Todo el año', rango: rangoDelAnio(hoy), disponible: true }];
  periodos.forEach((p, i) => {
    const fin = p.hasta && FECHA.test(p.hasta) ? p.hasta : p.desde;
    const enCurso = p.desde <= hoy && fin > hoy;
    atajos.push({
      id: `periodo_${i + 1}`,
      etiqueta: `Periodo ${i + 1}`,
      rango: { desde: p.desde, hasta: enCurso ? hoy : fin },
      disponible: p.desde <= hoy,
      ...(enCurso ? { nota: 'en curso' } : {}),
    });
  });
  atajos.push(
    { id: 'mes', etiqueta: 'Este mes', rango: { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }, disponible: true },
    { id: 'ultimos30', etiqueta: 'Últimos 30 días', rango: { desde: addDays(hoy, -29), hasta: hoy }, disponible: true },
  );
  return atajos;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function partes(f: string): { a: string; m: string; d: number } {
  return { a: f.slice(0, 4), m: MESES[Number(f.slice(5, 7)) - 1], d: Number(f.slice(8, 10)) };
}

/** «Del 1 de agosto al 22 de octubre de 2026». El año se repite solo si cambia. */
export function textoRango(r: RangoFechas): string {
  const a = partes(r.desde);
  const b = partes(r.hasta);
  if (r.desde === r.hasta) return `El ${a.d} de ${a.m} de ${a.a}`;
  if (a.a === b.a) return `Del ${a.d} de ${a.m} al ${b.d} de ${b.m} de ${b.a}`;
  return `Del ${a.d} de ${a.m} de ${a.a} al ${b.d} de ${b.m} de ${b.a}`;
}

// ---------------------------------------------------------------------------
//  El conteo
// ---------------------------------------------------------------------------

export interface EstudianteResumen {
  studentId: string;
  nombres: string;
  apellidos: string;
  gradoActual: string;
}

export interface FilaInasistencia {
  studentId: string;
  /** Vacío si el estudiante ya no está activo: no se tiene su ficha. */
  nombre: string;
  grado: string;
  inasistencias: number;
  ultima: string;
}

export interface FilaGrado {
  grado: string;
  jornada: Jornada;
  /** Días con censo fiable del grupo en el rango. Cero = nadie pasó lista: «sin datos». */
  diasConCenso: number;
  inasistencias: number;
  estudiantesConInasistencia: number;
  casosAbiertos: number;
}

type Conteo<K extends string> = Partial<Record<K, number>>;

export interface ResumenPeriodo {
  rango: RangoFechas;
  inasistencias: {
    /** Estudiante-día: un estudiante que faltó tres días suma tres. */
    total: number;
    /** Estudiantes distintos con al menos una. */
    estudiantes: number;
    /** Días distintos con al menos un censo fiable. */
    diasConCenso: number;
    primerCenso: string | null;
    ultimoCenso: string | null;
    /** Todos los que faltaron, de más a menos inasistencias. */
    lista: FilaInasistencia[];
    /** Los primeros de `lista`. */
    top: FilaInasistencia[];
    /** Grupos con estudiantes activos y ningún censo fiable en el rango. */
    gruposSinCenso: string[];
  };
  casos: {
    abiertosEnRango: number;
    abiertosEnRangoPorNivel: Conteo<NivelPermanencia>;
    cerradosEnRango: number;
    cerradosEnRangoPorEstado: Conteo<EstadoCaso>;
    abiertosAlFinal: number;
    abiertosAlFinalPorNivel: Conteo<NivelPermanencia>;
    abiertosAlFinalPorEstado: Conteo<EstadoCaso>;
  };
  seguimientos: {
    total: number;
    porTipo: Conteo<TipoSeguimiento>;
    porDecision: Conteo<DecisionSeguimiento>;
    /** Gestiones marcadas en el caso (catálogo fijo), aparte de los seguimientos. */
    gestiones: number;
    gestionesPorTipo: Conteo<TipoGestion>;
  };
  porGrado: FilaGrado[];
}

const sumar = <K extends string>(c: Conteo<K>, k: K) => {
  c[k] = (c[k] ?? 0) + 1;
};

/** `9.1` antes que `10.1`; mañana y tarde quedan cada una en su orden numérico. */
const compararGrado = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

/** Seguimientos que deciden algo, sin correcciones (una corrección no cambia la decisión). */
function decisiones(segs: SeguimientoCaso[]): SeguimientoCaso[] {
  return segs
    .filter((s) => !s.corrigeA && s.decision !== 'ninguna')
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn - b.creadoEn);
}

/** Reproduce las decisiones en orden, con la misma regla de `efectoEnCaso`. */
function reproducir(eventos: SeguimientoCaso[]): EstadoCaso {
  let estado: EstadoCaso = 'abierto';
  for (const e of eventos) {
    if (e.decision === 'cerrar') estado = e.estadoFinal ?? 'cerrado_otro';
    else if (e.decision === 'no_ubicado') estado = 'no_ubicado';
    else if (e.decision === 'programar') estado = estado === 'no_ubicado' ? 'no_ubicado' : 'en_gestion';
  }
  return estado;
}

/**
 * En qué estado estaba un caso al terminar el día `fecha`, o `null` si aún no existía.
 *
 * El caso guarda solo su estado de HOY. Para saber el de otra fecha se reproducen sus
 * seguimientos hasta ese día. Si nada pasó después, el estado de hoy es el bueno (y conserva
 * matices como «reportado» que no salen de un seguimiento). `cerradoEn` es el día en que
 * se REGISTRÓ el cierre; el seguimiento dice cuándo ocurrió, y por eso manda el seguimiento.
 */
export function estadoDelCasoEn(caso: CasoPermanencia, segs: SeguimientoCaso[], fecha: string): EstadoCaso | null {
  if (caso.fechaApertura > fecha) return null;
  const eventos = decisiones(segs);
  const hastaFecha = eventos.filter((e) => e.fecha <= fecha);
  const hayDespues = eventos.length > hastaFecha.length;
  if (!hayDespues) {
    if (ESTADOS_ABIERTOS.includes(caso.estado)) return caso.estado;
    const cerradoAntes = hastaFecha.some((e) => e.decision === 'cerrar') || Boolean(caso.cerradoEn && caso.cerradoEn <= fecha);
    if (cerradoAntes) return caso.estado;
  }
  return reproducir(hastaFecha);
}

/**
 * Cuenta todo para el rango. Solo cuenta lo que pasa el filtro de jornada (por grado,
 * como el resto de la pantalla). Los censos y los casos llegan ya de la sede.
 */
export function resumirPeriodo(input: {
  rango: RangoFechas;
  censos: CensoDia[];
  estudiantes: EstudianteResumen[];
  casos: CasoPermanencia[];
  seguimientos: SeguimientoCaso[];
  filtro: FiltroJornada;
  top?: number;
}): ResumenPeriodo {
  const { rango, filtro } = input;
  const top = input.top ?? 20;
  const porId = new Map(input.estudiantes.map((e) => [e.studentId, e]));
  const filas = new Map<string, FilaGrado>();
  const fila = (grado: string): FilaGrado => {
    let f = filas.get(grado);
    if (!f) {
      f = { grado, jornada: jornadaDeGrado(grado), diasConCenso: 0, inasistencias: 0, estudiantesConInasistencia: 0, casosAbiertos: 0 };
      filas.set(grado, f);
    }
    return f;
  };
  for (const e of input.estudiantes) if (gradoEnJornada(e.gradoActual, filtro)) fila(e.gradoActual);

  // ── Inasistencias ────────────────────────────────────────────────────────
  // Un censo por grupo y día (el id es `${fecha}_${grado}`); si llegara repetido, cuenta una vez.
  const vistos = new Set<string>();
  const dias = new Set<string>();
  const porEstudiante = new Map<string, { n: number; ultima: string; grado: string }>();
  const estudiantesDeGrado = new Map<string, Set<string>>();
  for (const c of input.censos) {
    if (!censoEsFiable(c) || !enRango(c.fecha, rango) || !gradoEnJornada(c.grado, filtro)) continue;
    const clave = `${c.fecha}_${c.grado}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    dias.add(c.fecha);
    const f = fila(c.grado);
    f.diasConCenso += 1;
    for (const id of new Set(c.noVinieron)) {
      // `autorizados` no cuenta (Julián, 2026-09-09), igual que en `inasistenciasDesdeCensos`.
      if (c.autorizados.includes(id)) continue;
      f.inasistencias += 1;
      const set = estudiantesDeGrado.get(c.grado) ?? new Set<string>();
      set.add(id);
      estudiantesDeGrado.set(c.grado, set);
      const p = porEstudiante.get(id);
      if (!p) porEstudiante.set(id, { n: 1, ultima: c.fecha, grado: c.grado });
      else {
        p.n += 1;
        if (c.fecha > p.ultima) {
          p.ultima = c.fecha;
          p.grado = c.grado;
        }
      }
    }
  }
  for (const [g, set] of estudiantesDeGrado) fila(g).estudiantesConInasistencia = set.size;

  const lista: FilaInasistencia[] = [...porEstudiante].map(([studentId, p]) => {
    const e = porId.get(studentId);
    return { studentId, nombre: e ? nombreCompleto(e) : '', grado: e?.gradoActual ?? p.grado, inasistencias: p.n, ultima: p.ultima };
  });
  lista.sort(
    (a, b) =>
      b.inasistencias - a.inasistencias ||
      compararGrado(a.grado, b.grado) ||
      (a.nombre || a.studentId).localeCompare(b.nombre || b.studentId, 'es'),
  );
  const fechas = [...dias].sort();

  // ── Casos ────────────────────────────────────────────────────────────────
  const segsDe = new Map<string, SeguimientoCaso[]>();
  for (const s of input.seguimientos) {
    const l = segsDe.get(s.casoId) ?? [];
    l.push(s);
    segsDe.set(s.casoId, l);
  }
  const casos = input.casos.filter((c) => gradoEnJornada(c.grado, filtro));
  const rc: ResumenPeriodo['casos'] = {
    abiertosEnRango: 0,
    abiertosEnRangoPorNivel: {},
    cerradosEnRango: 0,
    cerradosEnRangoPorEstado: {},
    abiertosAlFinal: 0,
    abiertosAlFinalPorNivel: {},
    abiertosAlFinalPorEstado: {},
  };
  const rs: ResumenPeriodo['seguimientos'] = { total: 0, porTipo: {}, porDecision: {}, gestiones: 0, gestionesPorTipo: {} };

  for (const c of casos) {
    const segs = segsDe.get(c.casoId) ?? [];
    if (enRango(c.fechaApertura, rango)) {
      rc.abiertosEnRango += 1;
      sumar(rc.abiertosEnRangoPorNivel, c.nivel);
      fila(c.grado).casosAbiertos += 1;
    }

    // Cerrado en el rango: un seguimiento «cerrar» con fecha en el rango. Si el caso no tiene
    // ninguno (expedientes anteriores al seguimiento), vale la fecha de cierre del caso.
    const cierres = decisiones(segs).filter((s) => s.decision === 'cerrar');
    const cierreEnRango = cierres.filter((s) => enRango(s.fecha, rango)).pop();
    if (cierreEnRango) {
      rc.cerradosEnRango += 1;
      sumar(rc.cerradosEnRangoPorEstado, cierreEnRango.estadoFinal ?? 'cerrado_otro');
    } else if (cierres.length === 0 && !ESTADOS_ABIERTOS.includes(c.estado) && enRango(c.cerradoEn, rango)) {
      rc.cerradosEnRango += 1;
      sumar(rc.cerradosEnRangoPorEstado, c.estado);
    }

    const alFinal = estadoDelCasoEn(c, segs, rango.hasta);
    if (alFinal && ESTADOS_ABIERTOS.includes(alFinal)) {
      rc.abiertosAlFinal += 1;
      sumar(rc.abiertosAlFinalPorNivel, c.nivel);
      sumar(rc.abiertosAlFinalPorEstado, alFinal);
    }

    // ── Seguimientos (los originales; una corrección no es otro seguimiento) ──
    for (const s of segs) {
      if (s.corrigeA || !enRango(s.fecha, rango)) continue;
      rs.total += 1;
      sumar(rs.porTipo, s.tipo);
      sumar(rs.porDecision, s.decision);
    }
    for (const g of c.gestiones ?? []) {
      if (!enRango(g.fecha, rango)) continue;
      rs.gestiones += 1;
      sumar(rs.gestionesPorTipo, g.tipo);
    }
  }

  const porGrado = [...filas.values()].sort(
    (a, b) => (a.jornada === b.jornada ? 0 : a.jornada === 'manana' ? -1 : 1) || compararGrado(a.grado, b.grado),
  );

  return {
    rango,
    inasistencias: {
      total: lista.reduce((n, f) => n + f.inasistencias, 0),
      estudiantes: lista.length,
      diasConCenso: fechas.length,
      primerCenso: fechas[0] ?? null,
      ultimoCenso: fechas[fechas.length - 1] ?? null,
      lista,
      top: lista.slice(0, top),
      gruposSinCenso: porGrado.filter((f) => f.diasConCenso === 0 && input.estudiantes.some((e) => e.gradoActual === f.grado)).map((f) => f.grado),
    },
    casos: rc,
    seguimientos: rs,
    porGrado,
  };
}

// ---------------------------------------------------------------------------
//  Etiquetas y exportación
// ---------------------------------------------------------------------------

export const DECISION_ETIQUETA: Record<DecisionSeguimiento, string> = {
  programar: 'Programó otro seguimiento',
  no_ubicado: 'No ubicado',
  cerrar: 'Cerró el caso',
  ninguna: 'Sin decisión',
};

/** Un conteo como pares [etiqueta, número], de mayor a menor, sin los ceros. */
export function desglose<K extends string>(c: Conteo<K>, etiquetas: Record<K, string>): [string, number][] {
  return (Object.entries(c) as [K, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => [etiquetas[k] ?? k, n]);
}

/**
 * Las hojas del Excel: el resumen, todos los estudiantes con inasistencias (no solo los
 * primeros), la tabla por grado y el desglose de casos y seguimientos.
 */
export function hojasResumenPeriodo(r: ResumenPeriodo, alcance: string): Hoja[] {
  const titulo = `${textoRango(r.rango)} · ${alcance}`;
  const notaCenso =
    'Inasistencias del censo de la tercera hora: no vino al colegio ese día (falta con o sin excusa). ' +
    'La ausencia autorizada no cuenta. Un grupo sin censo en un día no suma: nadie pasó lista.';
  const i = r.inasistencias;
  const c = r.casos;
  const s = r.seguimientos;
  const bloque = (titulo: string, pares: [string, number][]): (string | number)[][] =>
    pares.length ? [[titulo], ...pares.map(([k, n]) => [`   ${k}`, n])] : [];

  const resumen: Hoja = {
    nombre: 'Resumen',
    encabezados: ['Concepto', 'Cantidad'],
    filas: [
      [titulo],
      [],
      ['Inasistencias (estudiante-día)', i.total],
      ['Estudiantes con al menos una inasistencia', i.estudiantes],
      ['Días con censo', i.diasConCenso],
      [],
      ['Casos abiertos en el rango', c.abiertosEnRango],
      ...bloque('Abiertos en el rango, por nivel', desglose(c.abiertosEnRangoPorNivel, NIVEL_ETIQUETA)),
      ['Casos cerrados en el rango', c.cerradosEnRango],
      ...bloque('Cerrados en el rango, por estado', desglose(c.cerradosEnRangoPorEstado, ESTADO_CASO_ETIQUETA)),
      ['Casos abiertos al final del rango', c.abiertosAlFinal],
      ...bloque('Abiertos al final, por nivel', desglose(c.abiertosAlFinalPorNivel, NIVEL_ETIQUETA)),
      ...bloque('Abiertos al final, por estado', desglose(c.abiertosAlFinalPorEstado, ESTADO_CASO_ETIQUETA)),
      [],
      ['Seguimientos registrados', s.total],
      ...bloque('Por tipo', desglose(s.porTipo, TIPO_SEGUIMIENTO_ETIQUETA)),
      ...bloque('Por decisión', desglose(s.porDecision, DECISION_ETIQUETA)),
      ...(s.gestiones > 0
        ? [['Gestiones marcadas en los casos', s.gestiones] as (string | number)[], ...bloque('Por tipo de gestión', desglose(s.gestionesPorTipo, GESTION_ETIQUETA))]
        : []),
    ],
    notas: [
      notaCenso,
      ...(i.primerCenso ? [`Primer día con censo en el rango: ${i.primerCenso}. Antes de esa fecha no hay datos de inasistencia.`] : []),
      ...(i.gruposSinCenso.length ? [`Grupos sin ningún censo en el rango: ${i.gruposSinCenso.join(', ')}.`] : []),
    ],
  };

  const inasistencias: Hoja = {
    nombre: 'Inasistencias',
    encabezados: ['N.º', 'Estudiante', 'Grado', 'Inasistencias', 'Última'],
    filas: i.lista.map((f, n) => [n + 1, f.nombre || `(ficha no activa: ${f.studentId})`, f.grado, f.inasistencias, f.ultima]),
    notas: [titulo, notaCenso],
  };

  const porGrado: Hoja = {
    nombre: 'Por grado',
    encabezados: ['Grado', 'Días con censo', 'Inasistencias', 'Estudiantes con inasistencias', 'Casos abiertos en el rango'],
    filas: [
      ...r.porGrado.map((f) => [f.grado, f.diasConCenso, f.inasistencias, f.estudiantesConInasistencia, f.casosAbiertos]),
      [],
      [
        'TOTAL',
        i.diasConCenso,
        i.total,
        i.estudiantes,
        c.abiertosEnRango,
      ],
    ],
    notas: [titulo, 'En el total, «Días con censo» son días distintos, no la suma de los grupos.'],
  };

  return [resumen, inasistencias, porGrado];
}
