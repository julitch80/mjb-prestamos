// Plan de trabajo en casa con ajustes razonables — CONTRATO de datos.
// Ver docs/plan-casa/PRD.md y PLAN.md. Todas las piezas (lógica, reglas, funciones,
// pantallas, página pública) se construyen sobre estos tipos: cambiarlos exige
// actualizar todas a la vez.

export type FechaISO = string; // 'YYYY-MM-DD'

/** Colecciones de Firestore. */
export const COL_PLANES = 'planesCasa';             // planesCasa/{planId}
export const SUB_RESERVADO = 'reservado';          // planesCasa/{planId}/reservado/motivo
export const DOC_MOTIVO = 'motivo';
export const SUB_ASIGNATURAS = 'asignaturas';      // planesCasa/{planId}/asignaturas/{asignaturaId}
export const SUB_GUIAS = 'guias';                  // planesCasa/{planId}/guias/{guiaId}
export const SUB_SOLICITUDES = 'solicitudes';      // planesCasa/{planId}/solicitudes/{id}
export const COL_PUBLICO = 'planesCasaPublico';    // planesCasaPublico/{token}
export const DOC_EQUIPO = 'planCasaConfig/equipo'; // { correos: string[] } — UAI y orientador

/** Tope diario por defecto si los ajustes no dicen otro (momentos de 25 min). */
export const TOPE_DIARIO_DEFECTO = 4;

/** Ajustes razonables frecuentes, para elegir con un toque (además del texto libre). */
/** Texto del ajuste que activa el modo sin tecnología (se mantiene sincronizado con PlanCasa.sinTecnologia). */
export const AJUSTE_SIN_TECNOLOGIA = 'Sin uso de tecnología (guía impresa)';

export const AJUSTES_FRECUENTES: string[] = [
  AJUSTE_SIN_TECNOLOGIA,
  'Lecturas cortas',
  'Instrucciones de un paso a la vez',
  'Ejemplos resueltos antes de cada ejercicio',
  'Permitir entregas orales (audio o video)',
  'Evitar trabajo en equipo',
  'Más tiempo para cada entrega',
  'Apoyos visuales (imágenes, esquemas)',
  'Evaluación con preguntas de selección y respuesta corta',
  // Propuesta curricular integrada por áreas (UAI)
  'Priorizar una competencia (EBC) por área',
  'Articular áreas para reducir entregas',
  'Instrucciones cortas con apoyos gráficos',
  'Una entrega parcial por semana, con tiempos flexibles',
  'Actividades cortas por fatiga cognitiva y atención',
  'Máximo 2–3 momentos por día o día por medio',
  'De 3 a 5 ejercicios en lugar de talleres extensos',
  'Ejemplos prácticos de modelado',
  'Sustentación en modalidades diversas (video, audio, entrevista, esquema)',
  'Textos cortos o material audiovisual para consultar',
  'Mapas, esquemas o audios en lugar de escritos extensos',
];

/** Ritmo de trabajo: todos los días hábiles o solo uno por medio (máx. 2–3 momentos). */
export type RitmoPlan = 'diario' | 'dia_por_medio';

export type EstadoPlan = 'activo' | 'cerrado';

/**
 * 'por_asignatura': una guía por asignatura (lo normal).
 * 'transversal': guías que integran varias asignaturas alrededor de un eje temático,
 * para reducir la carga (ajuste razonable). Decisión de Julián 21-oct-2026.
 */
export type ModalidadGuias = 'por_asignatura' | 'transversal';

export interface PlanCasa {
  id: string;
  /** studentId de asistenciaStudents. */
  studentId: string;
  nombres: string;
  apellidos: string;
  /** Notación del horario: '9.1' mañana, '6º1' tarde. */
  grupo: string;
  desde: FechaISO;
  hasta: FechaISO;
  /** Ajustes razonables en lenguaje pedagógico, SIN diagnóstico. Es lo único que va a la IA. */
  ajustes: string[];
  /** Contexto para los docentes del plan, en lenguaje pedagógico, SOLO LECTURA para ellos. Sin diagnóstico ni datos sensibles (eso va en el motivo reservado). No va a la IA ni al QR. */
  contextoDocentes?: string;
  /** El estudiante no usa tecnología: guía impresa, entregas y sustentación en papel/presenciales/orales; sin QR, enlaces ni multimedia. */
  sinTecnologia?: boolean;
  /** Máximo de momentos (25 min) por día sumando todas las asignaturas. */
  topeDiario: number;
  /** 'diario' (defecto) o 'dia_por_medio': solo un día hábil de cada dos lleva trabajo. */
  ritmo: RitmoPlan;
  modalidad: ModalidadGuias;
  /** Correos de los docentes del grupo (para las reglas de lectura). */
  docentesCorreos: string[];
  estado: EstadoPlan;
  /** Último día (inclusive) para corregir las guías. Si falta, es el último día hábil antes de `desde`. */
  cierreEdicion?: FechaISO;
  /** Token largo e imposible de adivinar de la página pública (QR). */
  tokenPublico: string;
  creadoPor: string;   // correo
  creadoEn: number;    // ms
  actualizadoEn: number;
}

export interface MotivoReservado {
  texto: string;
  porCorreo: string;
  actualizadoEn: number;
}

export type EvidenciaTipo = 'foto' | 'texto' | 'audio' | 'video' | 'documento';

/**
 * (Guías integradas) Parte de UNA asignatura dentro de la entrega integrada de la semana.
 * `parte` es lo que el estudiante incluye para esa asignatura; `queRevisar` lo que su docente revisa.
 * `asignatura`, `revisado` y `comentario` solo los pone la copia pública.
 */
export interface ComponenteEntrega {
  asignaturaId: string;
  parte: string;
  queRevisar: string;
  asignatura?: string;
  revisado?: boolean;
  comentario?: string;
}

export interface PasoGuia {
  /** Estable dentro de la guía ('p1', 'p2'…). */
  id: string;
  titulo: string;
  /** Qué hacer, en instrucciones cortas y ajustadas. */
  instrucciones: string;
  /** Texto que el estudiante lee para hacer el paso, escrito por la IA o el docente. */
  lectura?: string;
  /** Duración en momentos de 25 min (1–4). */
  momentos: number;
  evidencia: EvidenciaTipo;
  /** Descripción breve de la evidencia que entrega. */
  evidenciaDetalle: string;
  /** Fase o semana del plan (1..n). El último paso de cada semana es la entrega parcial. */
  semana: number;
  /** Es la entrega parcial semanal (un solo paso por semana). */
  esEntregaParcial?: boolean;
  /** Canal o formato de entrega de la fase (p. ej. «Foto por WhatsApp», «Audio»). */
  canalEntrega?: string;
  /** Ajuste razonable aplicado en esta fase. */
  ajusteAplicado?: string;
  /** La propone el reparto automático; el docente puede cambiarla. */
  fecha: FechaISO | null;
  enlaces?: { url: string; nombre?: string }[];
  /** Solo en la entrega parcial de una guía integrada: qué aporta y qué revisa cada asignatura. */
  componentes?: ComponenteEntrega[];
}

export type ModalidadSustentacion = 'presencial' | 'virtual' | 'video' | 'audio' | 'entrevista' | 'guia_corta' | 'esquema';
export const MODALIDADES_SUSTENTACION: { id: ModalidadSustentacion; texto: string }[] = [
  { id: 'presencial', texto: 'Presencial' },
  { id: 'virtual', texto: 'Virtual' },
  { id: 'video', texto: 'Video' },
  { id: 'audio', texto: 'Audio' },
  { id: 'entrevista', texto: 'Entrevista personalizada' },
  { id: 'guia_corta', texto: 'Guía corta escrita' },
  { id: 'esquema', texto: 'Esquema o mapa de ideas' },
];

export interface Sustentacion {
  modalidad: ModalidadSustentacion;
  fecha: FechaISO | null;
  hora: string | null;      // 'HH:MM'
  lugarOEnlace: string;
  preguntasGuia: string[];  // 3–4
}

/** La guía completa (la propuesta de la IA y, editada, la aprobada). */
export interface Guia {
  /** Producto integrado único. */
  productoFinal: string;
  /** Evidencias de aprendizaje conjuntas, una por área. */
  evidenciasAprendizaje?: { asignatura: string; evidencia: string }[];
  criteriosEvaluacion: string[]; // 3–4
  pasos: PasoGuia[];
  sustentacion: Sustentacion;
  /** Nota corta para el docente sobre cómo se aplicaron los ajustes. */
  notaAjustes?: string;
  /** El líder ejecutó «Integrar la guía»: una entrega por semana que fusiona los entregables de los docentes. */
  integrada?: boolean;
}

/** Lo que el docente escribe para pedir la guía. */
export interface PedidoGuia {
  tematicas: string;
  competencias: string;
  textoReferencia?: string;
}

export type EstadoPaso = 'pendiente' | 'entregado' | 'revisado';
export type EstadoSustentacion = 'sin_citar' | 'citada' | 'sustentada';

export interface SeguimientoPaso {
  estado: EstadoPaso;
  observacion?: string;
  actualizadoEn?: number;
  /** (Entregas, 28-oct-2026) ms de la entrega más reciente desde la agenda pública. Lo escribe solo el servidor. */
  entregadoEn?: number;
  /** (Guías integradas) Revisión de cada asignatura sobre su parte de la entrega. */
  porAsignatura?: Record<string, RevisionAsignatura>;
}

/** Revisión de «mi parte» que hace el docente de una asignatura en una entrega integrada. */
export interface RevisionAsignatura {
  revisado: boolean;
  comentario?: string;
  por?: string;
  en?: number;
}

/** planesCasa/{planId}/asignaturas/{asignaturaId} — lo de cada asignatura que no es la guía. */
export interface AsignaturaPlan {
  asignaturaId: string;
  docenteId: string;          // id de USUARIOS
  docenteCorreo: string;
  /** Criterios mínimos de promoción para este estudiante. */
  criteriosPromocion: string;
  /** Competencias o temáticas que este docente quiere que la guía cubra. */
  aportes?: string;
  /** EBC/DBA esencial priorizado (una competencia por área). */
  ebcDba?: string;
  /** Evidencia de aprendizaje que se espera en esta área. */
  evidenciaAprendizaje?: string;
  /** Entregable que este docente pide en su asignatura (lo pone cada docente, no solo el líder). */
  entregable?: string;
  /** Fecha de entrega de ese entregable ('' = sin fecha). */
  fechaEntrega?: FechaISO;
  /** Los campos los llenó la IA («Generar todo») y el docente aún no los ha guardado él mismo. */
  porIA?: boolean;
  actualizadoEn: number;
}

/**
 * planesCasa/{planId}/guias/{guiaId} — una guía. En 'por_asignatura' cubre UNA asignatura
 * (id de guía = asignaturaId). En 'transversal' cubre VARIAS alrededor de un eje.
 */
export interface GuiaPlan {
  id: string;
  asignaturaIds: string[];
  /** Pregunta orientadora / problema del contexto (transversal) o nombre de la asignatura. */
  eje: string;
  /** Docente que pide y edita la guía (en transversal, el que la equipo designa). */
  responsableCorreo: string;
  /** Correos de los docentes de las asignaturas que cubre. */
  docentesCorreos: string[];
  pedido?: PedidoGuia;
  /** Última propuesta de la IA, sin aprobar. */
  propuesta?: Guia;
  /** Visto bueno de cada docente de la guía (correo → true). Ve el estudiante cuando estado = 'aprobada'. */
  vistosBuenos: Record<string, boolean>;
  /** La guía aprobada: es la que ve el estudiante. La aprueba el responsable. */
  aprobada?: Guia;
  aprobadaEn?: number;
  /** ms en que el líder guardó la última propuesta (generada o reaprobada). */
  propuestaEn?: number;
  /** Coordinación autorizó corregir después del cierre. Solo la escribe un gestor. */
  autorizacion?: { hasta: FechaISO; por: string; motivo: string; en: number };
  seguimiento: Record<string, SeguimientoPaso>; // por id de paso
  sustentacionEstado: EstadoSustentacion;
  sustentacionObservacion?: string;
  actualizadoEn: number;
}

/** planesCasaPublico/{token} — SIN apellidos, motivo ni ajustes. Lo escribe solo el servidor. */
export interface PlanPublico {
  primerNombre: string;
  grupo: string;
  desde: FechaISO;
  hasta: FechaISO;
  /** Pasos aprobados de todas las asignaturas, ya con fecha. */
  /** `asignatura` es el nombre de la asignatura o, en guías transversales, el eje y las asignaturas que integra. */
  /** (Entregas, 28-oct-2026) `guiaId` y `entregadoEn` son opcionales: copias publicadas antes no los traen y la agenda oculta el botón «Entregar». */
  pasos: Array<PasoGuia & { asignatura: string; docente: string; guiaId?: string; entregadoEn?: number; revisado?: boolean; comentario?: string }>;
  sustentaciones: Array<Sustentacion & { asignatura: string; docente: string }>;
  actualizadoEn: number;
}

/** Entrada y salida de la función llamable `planCasaGuia`. */
export interface EntradaGuiaIA {
  /** Nombre legible; en transversal, p. ej. 'Ciencias Naturales, Matemáticas y Lengua Castellana'. */
  asignatura: string;
  /** Solo en transversal: el eje temático y las asignaturas con sus criterios. */
  transversal?: { eje: string; asignaturas: { nombre: string; criteriosPromocion: string; aportes?: string; ebcDba?: string; evidenciaAprendizaje?: string }[] };
  grado: string;          // '8º', '10°'…
  desde: FechaISO;
  hasta: FechaISO;
  ajustes: string[];
  topeDiario: number;
  /** Número de semanas del periodo (calculado de desde/hasta): una entrega parcial por semana. */
  semanas: number;
  ritmo: RitmoPlan;
  criteriosPromocion: string;
  pedido: PedidoGuia;
  /** Plan sin tecnología: la guía va impresa, con el contenido dentro y evidencias en papel. */
  sinTecnologia?: boolean;
  /** Indicación para pedir otra versión ('más corta', 'más práctica'…). */
  indicacion?: string;
}
/** Entrada y salida de la función llamable `planCasaIntegrarGuia` (nunca lleva nombre, motivo ni salud del estudiante). */
export interface EntradaIntegrarGuia {
  /** Contenido actual de la guía (propuesta o aprobada). */
  guia: Guia;
  /** Pregunta orientadora. */
  eje: string;
  asignaturas: {
    asignaturaId: string; nombre: string; tematicas?: string; competencia?: string; criterios: string;
    evidencia?: string; entregable?: string; fechaEntrega?: FechaISO;
  }[];
  grado: string;
  desde: FechaISO;
  hasta: FechaISO;
  ajustes: string[];
  topeDiario: number;
  ritmo: RitmoPlan;
  sinTecnologia?: boolean;
}
export interface SalidaIntegrarGuia {
  ok: boolean;
  guia?: Guia;
  /** Observaciones para el líder (capacidad excedida, materias sin parte, etc.). */
  avisos?: string[];
  error?: string;
}

export interface SalidaGuiaIA {
  ok: boolean;
  guia?: Guia;
  error?: string;
}

// ── Entregas desde la agenda pública (28-oct-2026, docs/plan-casa/ENTREGAS-PRD.md) ──
// Tipos NUEVOS; no cambian ningún campo anterior.

/** planesCasa/{planId}/entregas/{entregaId} — lo escribe SOLO el servidor. */
export const SUB_ENTREGAS = 'entregas';

export type TipoEntrega = 'foto' | 'audio' | 'pdf' | 'enlace';

export interface EntregaPlan {
  id: string;
  guiaId: string;
  pasoId: string;
  tipo: TipoEntrega;
  /** Ruta en Storage (vacía si es un enlace). */
  ruta: string;
  /** Solo en tipo 'enlace'. */
  url?: string;
  nombre: string;
  contentType: string;
  /** Bytes del archivo (0 si es un enlace). */
  tamano: number;
  creadoEn: number;
  /** Fecha prevista de borrado (fin del año lectivo), ms. */
  borrarDespuesDe: number;
}

/** Entrada de la callable pública `planCasaSubirEntrega` (sin login: el token es el secreto). */
export interface EntradaSubirEntrega {
  token: string;
  guiaId: string;
  pasoId: string;
  nombreArchivo?: string;
  contentType?: string;
  /** Contenido en base64 (sin el prefijo data:). Ausente si es un enlace. */
  datosBase64?: string;
  /** Enlace (videos en Drive/YouTube). */
  enlace?: string;
}
export interface SalidaSubirEntrega { ok: boolean; entregadoEn?: number; error?: string }

/** Callable `planCasaVerEntrega` (con login y rol): devuelve el archivo en base64, nunca una URL permanente. */
export interface EntradaVerEntrega { planId: string; entregaId: string }
export interface SalidaVerEntrega { ok: boolean; contentType?: string; nombre?: string; datosBase64?: string; url?: string; error?: string }

// ── Corrección hasta la fecha de cierre ──

export const MOTIVOS_SOLICITUD = ['Cambio institucional de fechas', 'Error en criterios o entregables', 'Otro'] as const;

/** planesCasa/{planId}/solicitudes/{id} — petición de autorización para corregir una guía cerrada. */
export interface SolicitudAutorizacion {
  id: string;
  guiaId: string;
  correo: string;
  motivo: string;
  detalle: string;
  creadaEn: number;
  estado: 'pendiente' | 'autorizada' | 'negada';
  respondidaPor?: string;
  respondidaEn?: number;
  hasta?: FechaISO;
}
