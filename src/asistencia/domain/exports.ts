/**
 * Construccion de las exportaciones — docs/modelo-datos-asistencia.md.
 *
 * Arma filas y encabezados; no escribe archivos. La separacion existe para que la regla
 * de negocio mas cara de equivocar —que numero se transcribe al registro oficial del
 * colegio— se pueda probar sin generar un binario.
 */

import { motivoSinDigitar } from './valoracion';
import { totalDeColumna } from './direccion-grupo';
import { findMark, MARKS, type MarkCode } from './marks';
// Un solo sitio compone el nombre: ver la nota en `./nombres`.
import { compararEstudiantes, nombreCompleto, ordenarEstudiantes } from './nombres';
import { computeStats, sesionesRelevantes } from './stats';
import type { ResumenContactabilidad } from './permanencia';
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
    .sort(compararEstudiantes);
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
  const estudiantes = ordenarEstudiantes(input.estudiantes);
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

/**
 * Las columnas de la planilla del Master donde digita el director de grupo, en su orden
 * (captura que paso Julian el 2026-11-09). Son las de cualquier asignatura: el centro de
 * interes aparece alli como optativa.
 */
export const COLUMNAS_PLANILLA_MASTER = [
  'Estado', 'Matricula', 'Nombre estudiante', 'Ord', 'Val',
  'COD1', 'COD2', 'COD3', 'COD4', 'COD5', 'COD6', 'COD7', 'COD8', 'COD9', 'COD10',
  'F', 'FJ', 'Observaciones',
] as const;

/**
 * El resultado de los centros de interes de UN grupo, con la forma de la planilla del
 * Master: mismas columnas y mismo orden, para que digitar sea copiar de izquierda a
 * derecha sin traducir nada.
 *
 * DECISIONES, y por que:
 *  - UNA fila por estudiante, en orden de lista, y NO agrupados por estado como antes. La
 *    planilla del Master trae a todo el grupo en orden; si el archivo los reordena, el
 *    director tiene que buscar a cada uno.
 *  - Lo que no se digita lleva 0, que es como la planilla trae la casilla vacia. El motivo
 *    va en «Observaciones» (plan de apoyo, pendiente, dos centros), nunca en silencio.
 *  - En los que SI se digitan, «Observaciones» lleva la observacion del lider (2026-11-09):
 *    es la columna del Master.
 *  - El plan de apoyo va con Val 0: en el Master el 1 es «Bajo» (Yuri y Janneth,
 *    2026-10-26), asi que jamas sale como 1.
 *  - «Ord» es la posicion en NUESTRA lista. Si no coincide con la del Master, la que manda
 *    es la «Matricula»: por eso va, y la nota lo dice.
 *  - F y FJ: las que el lider escribio A MANO al valorar (2026-11-10; este semestre la
 *    asistencia de los centros no se tomo en la aplicacion). Vacias si no las escribio:
 *    poner 0 diria que no falto.
 */
export function hojaResultadoCentros(
  grado: string,
  filas: {
    apellidos: string;
    nombres: string;
    /** Numero de matricula del Master, si la ficha ya lo trae (importacion ampliada). */
    matricula?: string;
    sinCentro: boolean;
    duplicadas: { grupoId: string; nivel: number; codigos: number[] }[];
    valoracion: {
      nivel: number;
      codigos: number[];
      observacion?: string | null;
      faltas?: number | null;
      faltasJustificadas?: number | null;
    } | null;
  }[],
): Hoja {
  const cuerpo = filas.map((f, i) => {
    const digitable = !!f.valoracion && f.valoracion.nivel !== 1 && f.duplicadas.length < 2;
    const codigos = digitable ? f.valoracion!.codigos : [];
    // «Observaciones» es la columna del Master: en los que SE DIGITAN lleva la observacion
    // del lider (2026-11-09). En los que no se digitan, el motivo, que no va al Master.
    const observacion = digitable ? (f.valoracion!.observacion ?? '') : motivoSinDigitar(f);
    return [
      '',
      f.matricula ?? '',
      `${f.apellidos}, ${f.nombres}`.trim(),
      i + 1,
      digitable ? f.valoracion!.nivel : 0,
      ...Array.from({ length: 10 }, (_, k) => codigos[k] ?? 0),
      // F y FJ: las que escribio el lider a mano (2026-11-10). Vacias si no las escribio:
      // un 0 diria que no falto.
      digitable ? (f.valoracion!.faltas ?? '') : '',
      digitable ? (f.valoracion!.faltasJustificadas ?? '') : '',
      observacion,
    ];
  });

  return {
    nombre: `Centros de interés ${grado}`,
    encabezados: [...COLUMNAS_PLANILLA_MASTER],
    filas: cuerpo,
    notas: [
      'Mismas columnas y orden de la planilla del Máster. Val: 2 Básico · 3 Alto · 4 Superior; 0 = no se digita.',
      'Plan de apoyo: Val 0 (en el Máster el 1 es «Bajo»). Cuando cumpla, su líder lo pasa a 2.',
      'Los indicadores van en COD1 a COD3; los demás quedan en 0.',
      'Si el «Ord» no coincide con el del Máster, guíese por la Matrícula.',
      'F y FJ: las que escribió el líder del centro. Vacías si no las escribió.',
      'Observaciones: la del líder del centro, para digitar en el Máster. En los que no se digitan, el motivo.',
    ],
  };
}

/**
 * Contactabilidad de las familias, por grado. Dos hojas en una sola: el conteo por
 * grado arriba y, abajo, la lista nominal de los que NO tienen celular — que es la que
 * de verdad sirve para hacer algo, porque es a quienes hay que pedirles el dato.
 */
export function hojaContactabilidad(
  resumen: ResumenContactabilidad,
  sinMovil: { apellidos: string; nombres: string; grado: string; telefonos: string[] }[],
): Hoja {
  const filas: (string | number)[][] = resumen.porGrado.map((f) => [
    f.grado,
    f.total,
    f.movil,
    f.soloFijo,
    f.sinTelefono,
    `${f.porcentajeMovil}%`,
  ]);
  const t = resumen.total;
  filas.push([]);
  filas.push(['TOTAL', t.total, t.movil, t.soloFijo, t.sinTelefono, `${t.porcentajeMovil}%`]);

  if (sinMovil.length > 0) {
    filas.push([]);
    filas.push(['SIN CELULAR — a estas familias solo se les puede llamar o citar']);
    filas.push(['Estudiante', 'Grado', 'Teléfonos registrados']);
    for (const e of ordenarEstudiantes(sinMovil)) {
      filas.push([`${e.apellidos} ${e.nombres}`.trim(), e.grado, e.telefonos.join(' / ')]);
    }
  }

  return {
    nombre: 'Contactabilidad',
    encabezados: ['Grado', 'Estudiantes', 'Con celular', 'Solo fijo', 'Sin teléfono', '% con celular'],
    filas,
    notas: [
      'Solo estudiantes activos.',
      'Un teléfono fijo no recibe mensajes de texto ni WhatsApp: a esas familias solo se les puede llamar.',
      'Basta un celular en la ficha para contar como contactable por mensaje.',
      'Un número que no corresponde a la numeración colombiana se cuenta como sin teléfono: es un dato que hay que corregir.',
    ],
  };
}
