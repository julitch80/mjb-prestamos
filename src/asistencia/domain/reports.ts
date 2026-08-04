/**
 * Reporte de tercera hora — docs/modelo-datos-asistencia.md, seccion 4.1.
 *
 * Idea de Julian: a la tercera hora los estudiantes que esperaban en el hall ya
 * ingresaron, asi que estar ausente en el bloque 3 es el indicador mas fiel de no haber
 * venido al colegio ese dia.
 *
 * Se CALCULA, no se guarda. Lo unico que se persiste son las llamadas.
 * Son DOS reportes al dia: la tercera hora ocurre una vez en cada jornada.
 *
 * Las tres secciones estan separadas a proposito. Mezclarlas haria que el coordinador
 * llame a una familia para decirle que su hijo no fue, cuando el muchacho esta en el
 * patio.
 */

import { findMark, isJustified } from './marks';
// El nombre se compone en un solo sitio (`./nombres`), porque Master2000 repite los
// apellidos dentro del campo de nombres y esa correccion debe verse igual en todas las
// pantallas. Tenerla duplicada aqui fue justo lo que hizo que la ficha mostrara el
// apellido dos veces cuando la planilla ya estaba bien.
import { nombreCompleto } from './nombres';
import type { Jornada, LateArrival, Session, Student } from './types';

export interface FilaAusente {
  studentId: string;
  nombreCompleto: string;
  grado: string;
  telefonos: string[];
  /** Marca puesta por el docente de tercera hora. */
  estado: string;
}

export interface FilaEnColegio extends FilaAusente {
  /** Hora a la que coordinacion lo registro entrando. */
  horaLlegada: string;
  bloqueIngreso: number;
}

export interface ReporteTerceraHora {
  fecha: string;
  jornada: Jornada;
  /** Ausentes en bloque 3 SIN registro de llegada tarde: no ingresaron al colegio. */
  noIngresaron: FilaAusente[];
  /**
   * Ausentes en bloque 3 CON registro de llegada tarde ese dia: si entraron al colegio.
   * Aqui no se llama a nadie, se busca al estudiante. Es la evasion que hoy se escapa.
   */
  enColegioPeroNoEnClase: FilaEnColegio[];
  /** Grados sin sesion de bloque 3 registrada: no se sabe nada de ellos. */
  gradosSinDatos: string[];
  /** Total de estudiantes cubiertos por el reporte (denominador honesto). */
  estudiantesCubiertos: number;
}

export interface EntradaReporte {
  fecha: string;
  jornada: Jornada;
  /** Todas las sesiones del dia (se filtran aqui por bloque 3 y jornada). */
  sessions: Session[];
  lateArrivals: LateArrival[];
  students: Student[];
  /** Grados que se esperan en esa jornada, para detectar los que no reportaron. */
  gradosEsperados: string[];
}

export function construirReporteTerceraHora(e: EntradaReporte): ReporteTerceraHora {
  const sesiones3 = e.sessions.filter(
    (s) => s.fecha === e.fecha && s.bloque === 3 && s.jornada === e.jornada,
  );

  const gradosConDatos = new Set(sesiones3.map((s) => s.grado));
  const gradosSinDatos = e.gradosEsperados.filter((g) => !gradosConDatos.has(g));

  const porId = new Map(e.students.map((s) => [s.studentId, s]));
  const llegadasDelDia = new Map(
    e.lateArrivals.filter((l) => l.fecha === e.fecha).map((l) => [l.studentId, l]),
  );

  const noIngresaron: FilaAusente[] = [];
  const enColegioPeroNoEnClase: FilaEnColegio[] = [];
  let cubiertos = 0;

  for (const sesion of sesiones3) {
    for (const [studentId, marca] of Object.entries(sesion.estudiantes ?? {})) {
      cubiertos++;
      const def = findMark(marca.estado);
      if (!def?.isAbsence) continue;

      // Ya resuelto: no tiene sentido llamar por algo que el colegio ya sabe.
      if (isJustified(marca.estado)) continue;

      const est = porId.get(studentId);
      const fila: FilaAusente = {
        studentId,
        nombreCompleto: est ? nombreCompleto(est) : studentId,
        grado: sesion.grado,
        telefonos: est?.telefonos ?? [],
        estado: marca.estado,
      };

      const llegada = llegadasDelDia.get(studentId);
      if (llegada) {
        enColegioPeroNoEnClase.push({
          ...fila,
          horaLlegada: llegada.horaLlegada,
          bloqueIngreso: llegada.bloqueIngreso,
        });
      } else {
        noIngresaron.push(fila);
      }
    }
  }

  const porNombre = (a: FilaAusente, b: FilaAusente) =>
    a.grado.localeCompare(b.grado) || a.nombreCompleto.localeCompare(b.nombreCompleto);

  return {
    fecha: e.fecha,
    jornada: e.jornada,
    noIngresaron: noIngresaron.sort(porNombre),
    enColegioPeroNoEnClase: enColegioPeroNoEnClase.sort(porNombre),
    gradosSinDatos: gradosSinDatos.sort(),
    estudiantesCubiertos: cubiertos,
  };
}

/**
 * Texto de advertencia para la cabecera del reporte. No es decorativo: sin el, un
 * coordinador podria leer "3 ausentes" cuando en realidad hay cuatro grados que nunca
 * reportaron, y creer que el resto del colegio esta completo.
 */
export function advertenciaCobertura(r: ReporteTerceraHora): string | null {
  if (r.gradosSinDatos.length === 0) return null;
  return (
    `Sin datos de tercera hora en ${r.gradosSinDatos.length} grado(s): ` +
    `${r.gradosSinDatos.join(', ')}. De esos estudiantes no se sabe si vinieron: ` +
    `no estan contados en este reporte.`
  );
}
