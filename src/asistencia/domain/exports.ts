/**
 * Construccion de las exportaciones — docs/modelo-datos-asistencia.md.
 *
 * Arma filas y encabezados; no escribe archivos. La separacion existe para que la regla
 * de negocio mas cara de equivocar —que numero se transcribe al registro oficial del
 * colegio— se pueda probar sin generar un binario.
 */

import { totalDeColumna } from './direccion-grupo';
import { findMark, MARKS, type MarkCode } from './marks';
// Un solo sitio compone el nombre: ver la nota en `./nombres`.
import { nombreCompleto } from './nombres';
import { computeStats, sesionesRelevantes } from './stats';
import type { DireccionGrupo, Enrollment, LateArrival, Session, Student, ValorCelda } from './types';

export interface Hoja {
  nombre: string;
  encabezados: string[];
  filas: (string | number)[][];
  notas: string[];
}

/** Abreviatura de cada marca para que la planilla exportada quepa. */
const SIGLA: Record<MarkCode, string> = {
  asistencia: 'A',
  ausencia: 'F',
  retraso: 'R',
  ausencia_justificada: 'FJ',
  retraso_justificado: 'RJ',
  evasion: 'EV',
  ausencia_autorizada: 'FP',
};

/** 1. Planilla completa por grado, asignatura y periodo. */
export function buildPlanillaExport(input: {
  grado: string;
  asignatura: string;
  periodo: number;
  estudiantes: Student[];
  sesiones: Session[];
}): Hoja {
  const sesiones = [...input.sesiones].sort((a, b) =>
    (a.fecha + String(a.bloque).padStart(2, '0')).localeCompare(
      b.fecha + String(b.bloque).padStart(2, '0'),
    ),
  );

  return {
    nombre: `Planilla ${input.grado} ${input.asignatura} P${input.periodo}`,
    encabezados: ['Estudiante', ...sesiones.map((s) => `${s.fecha} b${s.bloque}`)],
    filas: input.estudiantes.map((e) => [
      nombreCompleto(e),
      // Celda vacia = sin registrar. En el archivo tambien debe verse la diferencia
      // entre "no registrado" y cualquier marca del catalogo.
      ...sesiones.map((s) => {
        const m = s.estudiantes?.[e.studentId];
        return m ? (SIGLA[m.estado] ?? m.estado) : '';
      }),
    ]),
    notas: [
      `Grado ${input.grado} · ${input.asignatura} · periodo ${input.periodo}.`,
      `${sesiones.length} sesiones registradas. La estadistica se calcula solo sobre estas, no sobre el calendario.`,
      'Celda vacia = sin registrar. NO es una ausencia.',
      `Convenciones: ${MARKS.map((m) => `${SIGLA[m.code]} = ${m.label}`).join(' · ')}`,
    ],
  };
}

export interface FilaMaster2000 {
  estudiante: string;
  aTranscribir: number;
  justificadasNoTranscribir: number;
  sesionesRegistradas: number;
}

/**
 * 2. Acumulado para transcribir a Master2000.
 *
 * A Master2000 van SOLO `ausencia` y `evasion`. Las justificadas y las autorizadas se
 * incluyen en columna aparte como contexto para quien transcribe, con el encabezado
 * diciendo explicitamente que no se copian.
 */
export function buildMaster2000Export(input: {
  grado: string;
  asignatura: string;
  periodo: number;
  desde: string;
  hasta: string;
  estudiantes: Student[];
  sesiones: Session[];
  matriculas: Enrollment[];
}): Hoja & { datos: FilaMaster2000[] } {
  const datos: FilaMaster2000[] = input.estudiantes.map((e) => {
    const r = computeStats({
      studentId: e.studentId,
      sessions: input.sesiones,
      enrollments: input.matriculas.filter((m) => m.studentId === e.studentId),
      desde: input.desde,
      hasta: input.hasta,
      subjectId: input.asignatura,
    });
    return {
      estudiante: nombreCompleto(e),
      aTranscribir: r.aMaster2000,
      justificadasNoTranscribir: r.ausenciasTotales - r.aMaster2000,
      sesionesRegistradas: r.sessionsCount,
    };
  });

  return {
    nombre: `Master2000 ${input.grado} ${input.asignatura} P${input.periodo}`,
    encabezados: [
      'Estudiante',
      'Inasistencias a transcribir',
      'Justificadas o autorizadas (NO transcribir)',
      'Sesiones registradas',
    ],
    filas: datos.map((d) => [
      d.estudiante,
      d.aTranscribir,
      d.justificadasNoTranscribir,
      d.sesionesRegistradas,
    ]),
    datos,
    notas: [
      `Grado ${input.grado} · ${input.asignatura} · periodo ${input.periodo} (${input.desde} a ${input.hasta}).`,
      'A Master2000 se transcribe UNICAMENTE la columna de inasistencias a transcribir (ausencia y evasion).',
      'Las justificadas y las autorizadas estan solo como contexto: no se copian.',
      'Si una ausencia se justifica despues de generar este archivo, vuelva a generarlo.',
    ],
  };
}

/** 3. Consolidado de llegadas tarde a la institucion. */
export function buildLateArrivalsExport(input: {
  desde: string;
  hasta: string;
  estudiantes: Student[];
  llegadas: LateArrival[];
}): Hoja & { acumulado: { estudiante: string; total: number; sinJustificar: number }[] } {
  const enRango = input.llegadas.filter((l) => l.fecha >= input.desde && l.fecha <= input.hasta);
  const porId = new Map(input.estudiantes.map((s) => [s.studentId, s]));

  const acumuladoMap = new Map<string, { total: number; sinJustificar: number }>();
  for (const l of enRango) {
    const cur = acumuladoMap.get(l.studentId) ?? { total: 0, sinJustificar: 0 };
    cur.total++;
    // Solo las no justificadas cuentan para alertas (decision de Julian).
    if (l.estado !== 'justificada') cur.sinJustificar++;
    acumuladoMap.set(l.studentId, cur);
  }

  return {
    nombre: 'Llegadas tarde',
    encabezados: ['Fecha', 'Hora', 'Bloque de ingreso', 'Grado', 'Estudiante', 'Estado', 'Motivo', 'Registro'],
    filas: [...enRango]
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaLlegada.localeCompare(b.horaLlegada))
      .map((l) => {
        const e = porId.get(l.studentId);
        return [
          l.fecha,
          l.horaLlegada,
          l.bloqueIngreso,
          l.grado,
          e ? nombreCompleto(e) : l.studentId,
          l.estado,
          l.motivo ?? '',
          l.registradoPor,
        ];
      }),
    acumulado: [...acumuladoMap.entries()]
      .map(([studentId, v]) => ({
        estudiante: porId.get(studentId) ? nombreCompleto(porId.get(studentId)!) : studentId,
        ...v,
      }))
      .sort((a, b) => b.sinJustificar - a.sinJustificar || b.total - a.total),
    notas: [
      `Consolidado del ${input.desde} al ${input.hasta}. ${enRango.length} llegadas tarde a la institucion.`,
      'Llegada tarde a la institucion = ingreso tardio al colegio, registrada por coordinacion.',
      'NO confundir con el retraso a una clase, que registra cada docente en su llamado a lista.',
    ],
  };
}

/** Estudiantes con matricula vigente en el grado a la fecha de corte. */
export function estudiantesDelPeriodo(
  estudiantes: Student[],
  matriculas: Enrollment[],
  grado: string,
  hasta: string,
): Student[] {
  return estudiantes
    .filter((e) =>
      matriculas.some(
        (m) =>
          m.studentId === e.studentId &&
          m.grado === grado &&
          m.desde <= hasta &&
          (m.hasta === null || hasta < m.hasta),
      ),
    )
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
}

/** Celda de Direccion de grupo a texto de Excel. Vacia = sin asignar, igual que en las
 * demas exportaciones: no se inventa un cero ni un "No" donde nadie registro nada. */
function celdaDireccion(valor: ValorCelda | undefined, opciones: { opcionId: string; etiqueta: string }[]): string | number {
  if (valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Si' : 'No';
  if (typeof valor === 'string') {
    // Columna de icono: se exporta la ETIQUETA, no el opcionId ni el nombre del icono
    // en lucide-react — el Excel lo lee una persona, no un componente.
    return opciones.find((o) => o.opcionId === valor)?.etiqueta ?? valor;
  }
  return valor;
}

/** 4. Cuaderno de Direccion de grupo: una fila por estudiante, totales en la ultima. */
export function buildDireccionGrupoExport(input: {
  grado: string;
  anio: number;
  estudiantes: { studentId: string; apellidos: string; nombres: string }[];
  direccion: DireccionGrupo;
}): Hoja {
  const columnas = [...input.direccion.columnas].sort((a, b) => a.orden - b.orden);
  const estudiantes = [...input.estudiantes].sort((a, b) =>
    `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`),
  );
  const studentIds = estudiantes.map((e) => e.studentId);

  const filas: (string | number)[][] = estudiantes.map((e) => [
    `${e.apellidos} ${e.nombres}`,
    ...columnas.map((c) => celdaDireccion(input.direccion.valores[e.studentId]?.[c.columnaId], c.opciones)),
  ]);

  const totales = columnas.map((c) => totalDeColumna(c, input.direccion.valores, studentIds));
  filas.push(['Totales', ...totales.map((t) => t.texto)]);

  return {
    nombre: `Direccion de grupo ${input.grado} ${input.anio}`,
    encabezados: ['Estudiante', ...columnas.map((c) => c.nombre)],
    filas,
    notas: [
      `Grado ${input.grado} · año ${input.anio}.`,
      'Celda vacia = sin asignar. NO es un cero ni un "No": nadie ha registrado nada ahi todavia.',
      'La fila de totales cuenta solo lo que si tiene valor; los vacios no suman ni restan.',
    ],
  };
}

/** Reexport util para quien construya vistas sobre el denominador. */
export { sesionesRelevantes, findMark };
