/**
 * Modelo de datos — docs/modelo-datos-asistencia.md, seccion 3.
 *
 * Identificadores en ingles, interfaz y comentarios en espanol (contrato, seccion 4).
 * Sin dependencia del SDK de Firebase: la logica de dominio se prueba sin emulador.
 *
 * Convenciones:
 *  - Emails SIEMPRE en minusculas. Nunca UID.
 *  - Docentes referenciados por `slotId` (puesto), no por correo. Excepcion: los
 *    campos de AUTORIA, que documentan quien hizo el acto, no que puesto lo hizo.
 *  - Grados literales: `9.1` (manana), `6º1` (tarde). Jamas saneados.
 *  - Fechas 'YYYY-MM-DD' en hora local de Colombia.
 */

import type { ExcuseReason, LateArrivalState, MarkCode } from './marks';

export type DocType = 'RC' | 'TI' | 'CC' | 'PPT' | 'otro';

export type Sede = 'central' | 'gustavo_rodas' | 'la_finquita';
export type Jornada = 'manana' | 'tarde';

/** Marca de un estudiante dentro del mapa `estudiantes` de una sesion. */
export interface StudentMark {
  estado: MarkCode;
  /** Correo de quien la escribio. Inmutable una vez puesta. */
  registradoPor: string;
  registradoEn: number;
  /** Solo si el estado es de los justificados. */
  motivo: ExcuseReason | null;
  observacion: string | null;
  modificadoPor: string | null;
  modificadoEn: number | null;
}

/**
 * El documento central: UNA sesion (grado + fecha + bloque) con los estudiantes dentro
 * como MAPA. Un documento por celda multiplicaria el costo de evaluar reglas por el
 * tamano del grupo en cada pase de lista.
 *
 * Se escribe SIEMPRE con rutas de campo puntuales
 * (`estudiantes.est_0412.estado`), nunca reemplazando el mapa completo: Firestore
 * fusiona por campo y asi dos docentes que tocan estudiantes distintos no se pisan.
 */
export interface Session {
  sessionId: string;
  /** Literal: '6º1', '11.2'. */
  grado: string;
  jornada: Jornada;
  sede: Sede;
  fecha: string;
  /** 1..6 */
  bloque: number;
  subjectId: string;
  /** Puesto del docente titular, no su correo. */
  slotId: string;
  createdBy: string;
  createdAt: number;
  closed: boolean;
  closedBy: string | null;
  closedAt: number | null;
  estudiantes: Record<string, StudentMark>;
  /** Sello autenticado por el servidor en cada escritura. */
  ultimaEscrituraPor: string;
  ultimaEscrituraEn: number;
}

export interface Student {
  studentId: string;
  nombres: string;
  apellidos: string;
  /** HMAC del documento. El numero en claro no se almacena jamas. */
  docHash: string;
  docType: DocType;
  acudiente: string;
  telefonos: string[];
  fotoPath: string | null;
  qrToken: string;
  sede: Sede;
  /** Grado vigente, denormalizado: las reglas no pueden consultar colecciones. */
  gradoActual: string;
  activo: boolean;
}

/** El grado nunca es un campo fijo: es una matricula con vigencia. */
export interface Enrollment {
  studentId: string;
  anio: number;
  grado: string;
  seq: number;
  /** `desde` inclusivo, `hasta` exclusivo (null = vigente). */
  desde: string;
  hasta: string | null;
}

export interface Period {
  periodId: string;
  anio: number;
  numero: number;
  desde: string;
  hasta: string;
}

export type AttendanceSource = 'app' | 'master2000';

/** La eleccion explicita Master2000 vs. app, por asignatura y periodo. */
export interface SubjectConfig {
  configId: string;
  anio: number;
  periodo: number;
  grado: string;
  subjectId: string;
  fuente: AttendanceSource;
  slotId: string;
  fijadoPor: string;
  fijadoEn: number;
}

/**
 * Llegada tarde a la institucion. NO es el `retraso` de clase: otra autoridad
 * (coordinacion) y otra unidad temporal.
 *
 * Un unico evento con GRADO de tardanza — `horaLlegada` y `bloqueIngreso` — en vez de
 * dos categorias. Asi "llego 10 minutos tarde" y "llego en cuarta hora" son el mismo
 * hecho con distinta magnitud, y los umbrales se ajustan sin tocar el modelo.
 */
export interface LateArrival {
  lateArrivalId: string;
  studentId: string;
  grado: string;
  sede: Sede;
  fecha: string;
  /** 'HH:mm' real de llegada. */
  horaLlegada: string;
  /** A que bloque alcanza a entrar. Es la magnitud del retraso. */
  bloqueIngreso: number;
  estado: LateArrivalState;
  motivo: ExcuseReason | null;
  observacion: string | null;
  registradoPor: string;
  registradoEn: number;
  resueltoPor: string | null;
  resueltoEn: number | null;
}

export type ContactReason =
  | 'inasistencia_dia'
  | 'umbral_ausencias'
  | 'umbral_retrasos'
  | 'umbral_llegadas_tarde'
  | 'faltas_consecutivas';

export type ContactResult = 'contesto' | 'no_contesto' | 'pendiente';

/**
 * UN solo historial de contactos con la familia: la llamada de la tercera hora y el
 * aviso por acumulado alimentan el mismo registro. Si fueran dos sistemas, habria dos
 * verdades sobre la misma familia.
 */
export interface FamilyContact {
  contactId: string;
  studentId: string;
  grado: string;
  fecha: string;
  motivoContacto: ContactReason;
  telefonoUsado: string;
  resultado: ContactResult;
  observacion: string;
  llamadoPor: string;
  llamadoEn: number;
}

/** Umbrales de alerta. El de retrasos lo puede ajustar cada docente. */
export interface AlertConfig {
  maxAusenciasNoJustificadas: number;
  maxRetrasos: number;
  maxLlegadasTarde: number;
  /** Alerta al docente cuando el estudiante acumula esta racha en su asignatura. */
  faltasConsecutivas: number;
  diasParaEscalar: number;
}

/** `asistenciaConfig/umbralesPorDocente`: override por puesto docente. */
export type TeacherThresholds = Record<string, { maxRetrasos: number }>;
