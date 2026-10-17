// Tipos del módulo de Tareas ("momentos").
// Un momento = 25 min de ejecución en casa. Ver config.ts para topes por nivel.

export type FechaISO = string; // 'YYYY-MM-DD'

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

export type TipoRecordatorio = 'evaluacion' | 'materiales' | 'documentos' | 'aviso';

/** Enlace web que el docente comparte con una tarea o recordatorio (máx. 3). */
export interface EnlaceTarea {
  url: string;
  nombre?: string;
}

export interface Tarea {
  id: string;
  grupo: string;          // notación del horario: '9.1' mañana, '6º1' tarde
  asignaturaId: string;   // id de asignacionAcademica.ts
  docenteId: string;
  titulo: string;
  momentos: number;       // momentos de ejecución que exige
  fechaAsignacion: FechaISO;
  fechaEntrega: FechaISO;
  estado: 'activa' | 'cancelada';
  /** Indicaciones breves para el estudiante. Opcional. */
  descripcion?: string;
  /**
   * Enlace de descarga del archivo adjunto, si lo hay.
   * OJO: la agenda del grupo es pública (sin login), así que este enlace queda
   * accesible para cualquiera que lo tenga. Es una decisión tomada, no un
   * descuido: los estudiantes no tienen cuenta institucional. La advertencia se
   * muestra al docente en el momento de subir.
   */
  adjuntoUrl?: string;
  /** Nombre original del archivo, para mostrarlo en la agenda. */
  adjuntoNombre?: string;
  /**
   * 'tarea' (por omisión) o 'recordatorio'. Ausente = 'tarea': las filas viejas
   * siguen funcionando. Un recordatorio no consume cupo de momentos (momentos = 0),
   * no tiene plazo mínimo y no se entrega: su fechaEntrega es la fecha del aviso.
   */
  tipo?: 'tarea' | 'recordatorio';
  /** Solo para recordatorios. */
  tipoRecordatorio?: TipoRecordatorio;
  /** Hasta 3 enlaces http/https. */
  enlaces?: EnlaceTarea[];
}

// Cesión de momentos entre asignaturas: directa entre docentes,
// vence con el período (semana o quincena) al que pertenece.
export interface Cesion {
  id: string;
  grupo: string;
  periodo: string;             // clave de período de EJECUCIÓN (ver clavePeriodo)
  asignaturaOrigenId: string;
  asignaturaDestinoId: string;
  docenteOrigenId: string;
  momentos: number;
}

// Solicitud de cesión: un docente pide a otro que le ceda momentos.
// Al aceptarse se crea la Cesión correspondiente.
export interface SolicitudCesion {
  id: string;
  grupo: string;
  periodo: string;
  asignaturaCedenteId: string;   // asignatura de la que se piden momentos (del cedente)
  asignaturaDestinoId: string;   // asignatura del solicitante que los recibiría
  docenteCedenteId: string;      // a quién se le pide (debe aprobar)
  docenteSolicitanteId: string;  // quién pide
  momentos: number;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
}

// Agenda calculada de un grupo: momentos por día.
export interface BloqueAgenda {
  tareaId: string;
  momentos: number;
}

export interface AgendaGrupo {
  porDia: Record<FechaISO, BloqueAgenda[]>;
  // Momentos que NO cupieron antes de su fecha de entrega (agenda infactible)
  sinUbicar: BloqueAgenda[];
}

export interface Alternativas {
  primeraEntregaViable?: FechaISO;   // primera fecha en la que sí cabe completa
  maxMomentosParaFecha?: number;     // máximo de momentos que caben con la fecha pedida
}

export type ResultadoValidacion =
  | { ok: true }
  | {
      ok: false;
      filtro: 'entrega' | 'plazo' | 'ventana' | 'cupo' | 'capacidad';
      mensaje: string;
      alternativas?: Alternativas;
    };

export interface ContextoValidacion {
  hoy: FechaISO;
  /** Tareas activas del grupo (todas las asignaturas). */
  tareas: Tarea[];
  /** Cesiones vigentes del grupo. */
  cesiones: Cesion[];
  /** Días de la semana en que el docente dicta clase a ese grupo. */
  diasClase: DiaSemana[];
  /** Cupos por asignatura que reemplazan los default (opcional, del coordinador). */
  cuposOverride?: Record<string, number>;
}
