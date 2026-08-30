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

// ---------------------------------------------------------------------------
//  Direccion de grupo — la planilla paralela del director (2026-08-12)
// ---------------------------------------------------------------------------
//
// NO es asistencia y no se cruza con ella: es el cuaderno del director de grupo, con
// columnas que el define (cuotas, equipos de aseo, requisitos, media tecnica). Vive en
// `asistenciaDireccionGrupo/{grado}/anios/{anio}`.
//
// SUBCOLECCION POR AÑO, no un campo `anio`: asi el `{grado}` queda en la RUTA y la regla
// lo lee de ahi sin mirar ningun campo del documento — es demostrable sin filtros, igual
// que las sesiones de un evento. Y al cambiar de año el cuaderno arranca limpio solo, sin
// migrar ni archivar nada.

export type TipoColumna = 'numero' | 'casilla' | 'puntos' | 'icono';

/**
 * Una opcion de una columna de tipo `icono`. La paleta se fija AL CREAR la columna.
 *
 * Por que la paleta es cerrada y no "cualquier icono en cualquier casilla", como hace
 * Additio: si cada casilla admitiera cualquiera de los 5.885 iconos, la columna no se
 * podria contar. Con la paleta declarada, "Aseo" responde sola "Equipo 1: 11 · Equipo 2:
 * 11 · sin asignar: 6", que es para lo que el director la abre.
 */
export interface OpcionColumna {
  opcionId: string;
  /** Nombre del icono en lucide-react (p. ej. 'Brush'), o '' si es una etiqueta suelta. */
  icono: string;
  /** Lo que se ve y se lee: 'Equipo 1', 'Restaurante'. */
  etiqueta: string;
  /** Id de la paleta de `domain/colores.ts`. El color ES parte del significado aqui. */
  colorId: string;
}

export interface ColumnaDireccion {
  columnaId: string;
  /** Corto: cabe en una cabecera de tabla. 'Cuota 1', 'Aseo P1'. */
  nombre: string;
  tipo: TipoColumna;
  orden: number;
  /** Solo en `icono`. Vacio en los demas tipos. */
  opciones: OpcionColumna[];
}

/**
 * Valor de una casilla. El tipo depende de la columna:
 *  - `numero`  -> number (una cifra: 10000)
 *  - `puntos`  -> number (acumulado con signo: 3, -1)
 *  - `casilla` -> boolean
 *  - `icono`   -> string (el `opcionId` elegido)
 *
 * Ausente = sin asignar. NO es cero ni "no": esa distincion es la misma que en la
 * asistencia entre "sin registrar" y "ausencia", y por la misma razon — un total que
 * cuenta los vacios como ceros miente sobre lo que alguien registro.
 */
export type ValorCelda = number | boolean | string;

export interface DireccionGrupo {
  grado: string;
  anio: number;
  columnas: ColumnaDireccion[];
  /** studentId -> columnaId -> valor. Mapa anidado, escrito con rutas de campo puntuales. */
  valores: Record<string, Record<string, ValorCelda>>;
  ultimaEscrituraPor: string;
  ultimaEscrituraEn: number;
}

// ---------------------------------------------------------------------------
//  Programas — centros de interes y todo lo que se reparte por semestre (2026-08-24)
// ---------------------------------------------------------------------------
//
// Ver `docs/modelo-centros-interes.md` para el porque de cada decision. En resumen: un
// centro de interes no es un evento porque se repite un semestre entero, porque su
// autoridad cuelga de una coordinacion que manda sobre los veintiun centros a la vez, y
// porque obliga a una regla que el evento no tiene (un estudiante, un solo centro).
//
// Ruta: `asistenciaProgramas/{programaId}`
//       `asistenciaProgramas/{programaId}/grupos/{grupoId}`
//       `asistenciaProgramas/{programaId}/grupos/{grupoId}/sesiones/{fecha}`
//       `asistenciaProgramas/{programaId}/pendientes/{pendienteId}`
//
// El `programaId` va en la RUTA para que la regla lea `coordinadores` del padre sin
// mirar ningun campo del hijo: lectura demostrable sin filtros ni indices compuestos.

export type TipoPrograma = 'centros_interes';

export interface Programa {
  programaId: string;          // slug ASCII estable: 'centros-interes-2026-2'
  nombre: string;
  tipo: TipoPrograma;
  sede: Sede;
  /** Ausente = el programa cubre las dos jornadas. */
  jornada?: Jornada;
  desde: string;               // 'YYYY-MM-DD' inclusivo
  hasta: string;               // 'YYYY-MM-DD' inclusivo
  /**
   * CORREOS en minusculas, nunca `slotId` ni UID — misma razon que `Event.docentes`:
   * coordinar es un acto entre personas concretas y lo unico que la regla puede
   * garantizar al escribir es `callerEmail()`.
   */
  coordinadores: string[];
  /** true = un estudiante puede estar en UN solo grupo del programa. */
  exclusivo: boolean;
  activo: boolean;
  creadoPor: string;
  creadoEn: number;
}

export interface GrupoPrograma {
  programaId: string;
  grupoId: string;             // slug ASCII: 'vibe-coding'
  nombre: string;
  /** Correo del responsable. SIEMPRE presente tambien en `docentes`. */
  lider: string;
  docentes: string[];
  /**
   * FOTO FIJA resuelta al inscribir, igual que `Event.miembros` y por la misma razon:
   * si fuera una consulta viva, un estudiante inscrito en octubre apareceria
   * retroactivamente en las sesiones de agosto y la estadistica cambiaria sola.
   */
  miembros: string[];
  /**
   * studentIds de este centro que ademas estan inscritos en OTRO centro del programa,
   * pendientes de que la coordinacion decida. Se GUARDA, no se calcula en pantalla.
   *
   * Por que persistido: el conflicto solo se puede DETECTAR mirando los 21 centros a la
   * vez, y eso solo lo ve la coordinacion. Un lider consulta con
   * where('docentes','array-contains', su correo) y recibe unicamente los suyos: si la
   * marca se calculara en el cliente, el lider de UN solo centro no veria nada, que es
   * justo el caso mas comun. La coordinacion lo detecta una vez al importar y lo deja
   * escrito aqui, donde cualquiera que pueda leer el grupo lo ve.
   *
   * Ausente o vacio = ningun conflicto.
   */
  enConflicto?: string[];
  cupo?: number;
  activo: boolean;
  creadoPor: string;
  creadoEn: number;
}

/**
 * Identica en forma a `EventSession`: se calcula con las MISMAS funciones de
 * `domain/eventos.ts`. No se duplica esa logica.
 */
export interface SesionPrograma {
  programaId: string;
  grupoId: string;
  fecha: string;               // 'YYYY-MM-DD'
  estudiantes: Record<string, StudentMark>;
  ultimaEscrituraPor: string;
  ultimaEscrituraEn: number;
}

/**
 * Por que existe la bandeja: al cruzar los dos archivos reales quedaron 42 casos que el
 * sistema no puede decidir solo. Mandarlos en una lista de papel convierte en tarea
 * humana lo que la aplicacion debe resolver a un clic. Cada pendiente llega con sus
 * candidatos y con la propuesta ya marcada; la coordinadora confirma o corrige.
 */
export type TipoPendiente =
  | 'homonimo'        // varios candidatos posibles
  | 'no_encontrado'   // ninguno
  | 'ortografia'      // uno solo, pero el nombre no coincide literalmente
  | 'duplicado';      // el estudiante quedo en dos grupos y `exclusivo` es true

export interface CandidatoPendiente {
  studentId: string;
  nombre: string;
  grado: string;               // grado LITERAL de la matricula ('9.1', '6º1')
}

export interface PendientePrograma {
  programaId: string;
  pendienteId: string;
  tipo: TipoPendiente;
  /** El nombre tal cual venia en el Excel, sin sanear: es la evidencia. */
  nombreArchivo: string;
  /** El grado que decia el Excel. NO se cree: manda la matricula. Solo desempata. */
  grupoArchivo: string;
  /** A que centro de interes iba. En `duplicado`, los dos van en `gruposEnConflicto`. */
  grupoId: string;
  gruposEnConflicto?: string[];
  candidatos: CandidatoPendiente[];
  /** La propuesta del sistema, ya marcada en la pantalla. `null` = no hay ninguna. */
  sugerido: string | null;
  estado: 'pendiente' | 'resuelto' | 'descartado';
  decision?: string;           // studentId elegido, o grupoId ganador si es `duplicado`
  resueltoPor?: string;
  resueltoEn?: number;

  // --- La propuesta del lider del centro (2026-08-25) ---
  //
  // El conocimiento y la autoridad viven en personas distintas, y forzarlas a la misma
  // persona rompe una de las dos. Quien sabe cual de las dos "Jimenez Mariana" de 11-3 es
  // la suya es el LIDER, que tiene la lista en papel; quien puede inscribir sin romper
  // `exclusivo` es la COORDINACION, que ve los veintiun centros a la vez.
  //
  // Antes de esto la bandeja era solo de coordinacion: 63 casos para la unica persona que
  // no conoce a ninguno de esos muchachos, mientras veintiun profesores que si los
  // conocen no podian ni verlos.
  //
  // Con la propuesta, el lider senala y NO inscribe; la coordinacion confirma de un clic.
  // Sus decisiones dejan de ser preguntas y pasan a ser confirmaciones ya respondidas.
  /** studentId (o grupoId ganador en un `duplicado`) que propone el lider. */
  propuestaLider?: string | null;
  /** Correo del lider que propuso. Es quien responde por la propuesta. */
  propuestaLiderPor?: string;
  propuestaLiderEn?: number;
}

// ---------------------------------------------------------------------------
//  Restaurante — vaso de leche y restaurante (2026-08-27)
// ---------------------------------------------------------------------------
//
// "Restaurante" es el nombre INSTITUCIONAL de la pestaña, el que usa el colegio. Adentro
// viven los DOS servicios: el vaso de leche (refrigerio del primer descanso) y el
// restaurante propiamente dicho (el menu del final de la jornada). Que la pestaña y uno
// de los servicios compartan nombre es deliberado: es como se habla en el colegio, y
// renombrarlo "Comedor" o "Alimentacion" seria inventar vocabulario que nadie usa.
//
// ESTO NO ES ASISTENCIA, Y LA DIFERENCIA MANDA SOBRE TODO EL DISEÑO. No hay marcas, no
// hay faltas, no hay denominador. Solo existe "paso" o no hay registro.
//
// Y sobre todo: NO RESTRINGE. Julian, 2026-08-27: "muchas veces estos grupos no se agotan
// y la comida no se puede perder (...) preferible darle el vaso de leche o la comida a un
// estudiante que no esta inscrito en ninguno de los dos". Asi que un estudiante se
// registra SIEMPRE, este o no en la lista oficial, sin advertencia ni friccion. Si esto se
// hubiera construido como un centro de interes —donde solo se puede marcar a quien esta
// en la lista— la pantalla habria rechazado justo el caso que hay que permitir.
//
// La lista oficial existe solo para PODER CONTRASTAR despues: de los inscritos, quienes
// usaron el servicio y cuantas veces; y quienes lo usaron sin estar inscritos.

export type ServicioRestaurante = 'vaso_leche' | 'restaurante';

/**
 * Un paso por el servicio. Ruta: `asistenciaRestaurante/{registroId}`.
 *
 * El id es DETERMINISTA (sede + servicio + fecha + studentId) a proposito: en una fila
 * es normal escanear dos veces al mismo estudiante por error, y con id calculado el
 * segundo escaneo sobrescribe el primero en vez de inflar el conteo. El reporte cuenta
 * documentos, asi que un duplicado seria una comida de mas en la cifra que le llega al
 * proveedor.
 */
export interface RegistroRestaurante {
  registroId: string;
  studentId: string;
  /** Grado literal, denormalizado: el reporte agrupa por grupo sin releer la ficha. */
  grado: string;
  sede: Sede;
  fecha: string;                 // 'YYYY-MM-DD'
  servicio: ServicioRestaurante;
  registradoPor: string;         // correo en minusculas
  registradoEn: number;
  /**
   * Baja logica de un registro equivocado (se escaneo a quien no era). NO se borra, como
   * en todo el modulo: un conteo que baja sin dejar rastro no se puede auditar despues
   * contra lo que el proveedor sirvio ese dia.
   */
  anulado?: boolean;
  anuladoPor?: string;
  anuladoEn?: number;
}

/**
 * La lista oficial de inscritos. Ruta: `asistenciaRestauranteInscritos/{inscritoId}`,
 * con `inscritoId` = `{anio}_{sede}_{studentId}`.
 *
 * NO controla el acceso — no decide quien puede pasar, solo con que se compara el
 * registro al final. Se sube desde Excel, una lista por servicio.
 */
export interface InscritoRestaurante {
  inscritoId: string;
  studentId: string;
  grado: string;
  sede: Sede;
  anio: number;
  servicio: ServicioRestaurante;
  activo: boolean;
  cargadoPor: string;
  cargadoEn: number;
}
