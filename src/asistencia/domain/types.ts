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
  /**
   * HMAC del documento. Es la identidad tecnica del estudiante: por esto —y solo por
   * esto— se empareja al reimportar. Nunca se recalcula ni se sobrescribe.
   */
  docHash: string;
  /**
   * Numero de documento en claro.
   *
   * Se guarda por decision expresa de Julian (2026-08-04) como responsable del dato: en
   * una urgencia medica el 123 y la EPS lo exigen para atender al estudiante, y sin el a
   * la mano hay que ir hasta secretaria mientras el muchacho espera. El costo de no
   * tenerlo es inmediato y recae sobre el menor; el de tenerlo es un riesgo de custodia
   * que el colegio ya asume con el resto de su archivo.
   *
   * NO es intercambiable con `docHash`: emparejar por este campo haria que corregir un
   * digito mal digitado partiera al estudiante en dos personas. Por eso las reglas lo
   * blindan contra la escritura del cliente — solo lo escribe la Cloud Function de
   * importacion, junto con el hash que le corresponde.
   *
   * Opcional: las fichas importadas antes de esta decision no lo tienen hasta que se
   * reimporte el archivo. No se puede reconstruir del hash.
   */
  docNumber?: string;
  docType: DocType;
  acudiente: string;
  /**
   * Parentesco del acudiente ("Madre", "Tio", "Vecino"). Viene de la columna AFINIDAD de
   * Master2000 y se guarda TAL CUAL, sin normalizar a un catalogo: la relacion real de un
   * estudiante con quien responde por el no siempre cabe en una lista cerrada, y para lo
   * que sirve —saber a quien se esta llamando— el texto del colegio es mejor que una
   * categoria inventada aqui.
   *
   * Opcional en la practica: las fichas importadas antes de que existiera este campo no
   * lo tienen hasta la siguiente importacion.
   */
  parentesco?: string;
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
  /**
   * Denormalizada, aunque el grado "ya la implique". No la implica: eso descansa en una
   * convencion implicita (Gustavo Rodas usa 1 y 2 en el ultimo digito, La Finquita el 3)
   * que nadie documento y que se rompe el dia que Gustavo Rodas abra un tercer grupo de
   * primero. En un modelo denormalizado la redundancia es lo que hace la regla
   * demostrable. Anadirla ahora cuesta un campo; despues cuesta migrar.
   */
  sede: Sede;
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
  /**
   * Denormalizada para que las reglas puedan acotar al coordinador por sede
   * (`asisCoordinaSede`). Sin este campo, un coordinador de una sede leería los
   * contactos con familias de las otras dos.
   */
  sede: Sede;
  fecha: string;
  motivoContacto: ContactReason;
  telefonoUsado: string;
  resultado: ContactResult;
  observacion: string;
  llamadoPor: string;
  llamadoEn: number;
}

/**
 * Umbrales de alerta — acordados por Julian con la coordinadora el 2026-08-10.
 * Documento unico `asistenciaConfig/alertas`, institucional: no hay ajuste por docente,
 * porque dos directores del mismo estudiante verian semaforos distintos si lo hubiera.
 * Editable por superusuario o coordinador (`rules/asistencia.rules`).
 */
export interface AlertConfig {
  /** Racha de faltas SIN EXPLICAR seguidas en una asignatura que alerta al docente. */
  faltasConsecutivas: number;
  /** % de inasistencia SIN EXPLICAR sobre las sesiones YA ABIERTAS del periodo que
   *  alerta al docente. Ver domain/alertas.ts sobre por que no es una proyeccion del
   *  horario semanal. */
  porcentajeFaltasPeriodo: number;
  /** Llegadas tarde SIN JUSTIFICAR acumuladas en el año que activan el primer aviso
   *  (amarillo) al coordinador. Ver `pasoLlegadasTarde` para el resto de la escala. */
  llegadasTardeUmbral: number;
  /** Dias consecutivos sin asistir a la institucion (ninguna sesion, ningun bloque) que
   *  alertan al coordinador para verificar con la familia. */
  diasSinAsistir: number;
}

// ---------------------------------------------------------------------------
//  Eventos — grupos temporales (feria, centro de interes, salida), asistencia
//  totalmente independiente de la asistencia por asignatura.
// ---------------------------------------------------------------------------

/** Como se armo el conjunto de integrantes. Se guarda para poder auditar y reconstruir. */
export interface EventMemberSource {
  grados: string[];        // grados literales completos
  jornadas: Jornada[];     // jornadas enteras
  individuales: string[];  // studentIds sueltos
}

export interface Event {
  eventId: string;
  nombre: string;
  sede: Sede;
  desde: string;           // 'YYYY-MM-DD' inclusivo
  hasta: string;           // 'YYYY-MM-DD' inclusivo
  creadoPor: string;       // correo en minusculas
  /**
   * Guarda CORREOS, no `slotId`. En el resto del modulo los docentes se referencian por
   * puesto porque los horarios son del puesto, no de la persona (un docente puede
   * cambiar y el horario sigue). Compartir un evento es distinto: es un acto entre
   * personas concretas, y la unica identidad que las reglas de Firestore pueden
   * garantizar en la escritura es `callerEmail()`, no un `slotId` inventado para algo
   * que no tiene puesto.
   *
   * SIEMPRE incluye al creador: las reglas lo exigen al crear y al compartir, para que
   * nadie pueda fabricar —ni quedarse con— un evento al que su autor no tenga acceso.
   */
  docentes: string[];
  /**
   * FOTO FIJA resuelta al crear el evento, no una consulta viva. Si "11.2 completo"
   * fuera dinamico, un estudiante matriculado en octubre apareceria retroactivamente en
   * las sesiones de agosto y la estadistica cambiaria sola, sin que nadie la haya
   * tocado. Por eso `miembros` se congela al crear y solo se mueve con la accion manual
   * de "actualizar integrantes", cuando alguien decide explicitamente refrescarla.
   */
  miembros: string[];      // studentIds ya resueltos (foto fija, ver comentario)
  origenMiembros: EventMemberSource;
  creadoEn: number;
  activo: boolean;
}

/** Una sesion del evento. Subcoleccion `asistenciaEvents/{eventId}/sesiones/{fecha}`. */
export interface EventSession {
  eventId: string;
  fecha: string;
  estudiantes: Record<string, StudentMark>;  // reusa StudentMark, que ya lleva registradoPor
  ultimaEscrituraPor: string;
  ultimaEscrituraEn: number;
}
