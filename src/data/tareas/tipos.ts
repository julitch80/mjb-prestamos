// Tipos del módulo de Tareas ("momentos").
// Un momento = 25 min de ejecución en casa. Ver config.ts para topes por nivel.

export type FechaISO = string; // 'YYYY-MM-DD'

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

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
}

// Cesión de momentos entre asignaturas: directa entre docentes,
// vence con el período (semana o quincena) al que pertenece.
export interface Cesion {
  id: string;
  grupo: string;
  periodo: string;             // clave de período de la ENTREGA (ver clavePeriodo)
  asignaturaOrigenId: string;
  asignaturaDestinoId: string;
  docenteOrigenId: string;
  momentos: number;
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
      filtro: 'entrega' | 'ventana' | 'cupo' | 'capacidad';
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
