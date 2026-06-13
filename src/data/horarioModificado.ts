// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AusenciaDocente {
  docenteId: string;
  bloques: number[]; // lista de bloques afectados (todos los bloques del día si está completamente ausente)
}

export type TipoApoyo = 'PTA' | 'UAI' | 'docente_apoyo' | 'taller' | 'otro';

export interface ApoyoDisponible {
  id: string;
  tipo: TipoApoyo;
  nombre: string;        // nombre del apoyo (persona o descripción del taller)
  bloques: number[];     // bloques en los que está disponible
}

export interface ModificacionBloque {
  bloqueOriginal: number;
  bloqueNuevo: number | null; // null = eliminado/cancelado
  docenteOriginal: string;
  docenteNuevo?: string;       // si se sustituye por otro docente o apoyo
  grupo: string;
  aula: string;
  apoyoId?: string;            // si se cubrió con un apoyo
}

export type EstadoHorarioMod = 'borrador' | 'guardado';

export interface HorarioModificado {
  id: string;
  fecha: string;                       // YYYY-MM-DD
  jornada: 'manana' | 'tarde';
  autor: string;                       // userId del coordinador que crea el borrador
  ausencias: AusenciaDocente[];
  apoyos: ApoyoDisponible[];
  modificaciones: ModificacionBloque[]; // se completa en la fase del editor
  estado: EstadoHorarioMod;
  timestamp: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

export const TIPO_APOYO_LABEL: Record<TipoApoyo, string> = {
  PTA:           'Docente PTA',
  UAI:           'Docente UAI',
  docente_apoyo: 'Docente de apoyo',
  taller:        'Taller dejado por el docente',
  otro:          'Otro',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generarIdHorarioMod(): string {
  return `hm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generarIdApoyo(): string {
  return `ap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function fechaHoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function diaDeSemana(fecha: string): string {
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return dias[new Date(fecha + 'T12:00:00').getDay()];
}

const DIAS_LEGIBLE: Record<string, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves',   viernes: 'Viernes', sabado: 'Sábado',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearFechaLegible(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  const dia = diaDeSemana(fecha);
  return `${DIAS_LEGIBLE[dia]} ${parseInt(d)} ${MESES[parseInt(m) - 1]} ${a}`;
}

export function obtenerHorariosVigentes(
  horarios: HorarioModificado[],
  fecha: string,
  jornada: 'manana' | 'tarde'
): HorarioModificado[] {
  return horarios.filter(h => h.fecha === fecha && h.jornada === jornada && h.estado === 'guardado');
}
