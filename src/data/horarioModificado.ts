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
  esTaller?: boolean;          // queda con actividad/taller en ese bloque
  supervisorId?: string;       // docente libre que supervisa el taller
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

// ── Editor: fichas y conversión ───────────────────────────────────────────────

export type UbicacionFicha =
  | { tipo: 'colocada'; bloque: number }
  | { tipo: 'pendiente' }
  | { tipo: 'eliminada' }
  | { tipo: 'taller'; bloque: number; supervisorId?: string };

export interface FichaEditor {
  id: string;                  // único: `${docente}_${grupo}_${bloqueOriginal}`
  origen: {
    dia: string;
    bloque: number;
    docente: string;
    grupo: string;
    aula: string;
  };
  ubicacion: UbicacionFicha;
}

export interface EntradaHorarioBase {
  jornada: string;
  dia: string;
  bloque: number;
  docente: string;
  grado: string;
  aula: string;
}

/**
 * Genera las fichas iniciales para el día del borrador.
 * Las clases del docente ausente arrancan en estado 'colocada' (visualmente apagadas)
 * y pueden eliminarse o desplazarse; el resto arranca colocada en su bloque original.
 */
export function crearFichasIniciales(
  borrador: HorarioModificado,
  horarioBase: EntradaHorarioBase[]
): FichaEditor[] {
  const dia = diaDeSemana(borrador.fecha);
  const entradasDelDia = horarioBase.filter(e => e.jornada === borrador.jornada && e.dia === dia);

  return entradasDelDia.map(e => {
    const grado = e.grado.includes('/') ? e.grado.split('/')[0] : e.grado;
    return {
      id: `${e.docente}_${grado}_${e.bloque}`,
      origen: {
        dia,
        bloque: e.bloque,
        docente: e.docente,
        grupo: grado,
        aula: e.aula,
      },
      ubicacion: { tipo: 'colocada' as const, bloque: e.bloque },
    };
  });
}

/**
 * Devuelve true si la ficha está actualmente posicionada en un bloque
 * que coincide con una ausencia declarada para su docente.
 */
export function esFichaAusenteAhora(
  ficha: FichaEditor,
  ausencias: AusenciaDocente[]
): boolean {
  if (ficha.ubicacion.tipo !== 'colocada') return false;
  const aus = ausencias.find(a => a.docenteId === ficha.origen.docente);
  if (!aus) return false;
  return aus.bloques.includes(ficha.ubicacion.bloque);
}

/**
 * Lista de docentes libres en un (dia, bloque) específico:
 *   - no tienen clase en horarioBase a esa hora
 *   - no están en ausencias declaradas para ese bloque
 */
export function docentesLibresEn(
  dia: string,
  bloque: number,
  jornada: 'manana' | 'tarde',
  horarioBase: EntradaHorarioBase[],
  candidatos: { id: string; nombreCorto: string; color?: string }[],
  ausencias: AusenciaDocente[]
): { id: string; nombreCorto: string; color?: string }[] {
  const ocupados = new Set(
    horarioBase
      .filter(e => e.dia === dia && e.bloque === bloque && e.jornada === jornada)
      .map(e => e.docente)
  );
  const ausentesEnBloque = new Set(
    ausencias.filter(a => a.bloques.includes(bloque)).map(a => a.docenteId)
  );
  return candidatos.filter(d => !ocupados.has(d.id) && !ausentesEnBloque.has(d.id));
}

/**
 * Convierte las fichas del editor en modificaciones para persistir.
 * Solo se guardan las fichas cuyo estado cambió respecto al origen.
 */
// ── Asistente de alternativas automáticas ────────────────────────────────────

export type TipoPropuesta = 'entrada_tardia' | 'salida_temprana' | 'compactar';

export interface PropuestaAsistente {
  id: string;
  tipo: TipoPropuesta;
  grupo: string;
  titulo: string;
  descripcion: string;
  // Cambios a aplicar como mapa fichaId → nueva ubicación
  cambios: Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }>;
}

/**
 * Genera propuestas automáticas para resolver las ausencias de un borrador.
 * Por cada grupo afectado, evalúa si las clases del ausente caen al inicio
 * del día (entrada tardía), al final (salida temprana), o si se pueden
 * compactar dentro de horas libres del mismo docente.
 */
export function generarPropuestasAsistente(
  fichas: FichaEditor[],
  borrador: HorarioModificado
): PropuestaAsistente[] {
  const propuestas: PropuestaAsistente[] = [];
  const bloquesAusentesPorDoc: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    bloquesAusentesPorDoc[a.docenteId] = new Set(a.bloques);
  });

  // Agrupar fichas afectadas por grupo
  const fichasPorGrupo: Record<string, FichaEditor[]> = {};
  fichas.forEach(f => {
    if (f.ubicacion.tipo !== 'colocada') return;
    if (!bloquesAusentesPorDoc[f.origen.docente]?.has(f.origen.bloque)) return;
    (fichasPorGrupo[f.origen.grupo] ??= []).push(f);
  });

  // Todas las fichas del grupo colocadas (para detectar contigüidad real)
  const todasPorGrupo: Record<string, FichaEditor[]> = {};
  fichas.forEach(f => {
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    (todasPorGrupo[f.origen.grupo] ??= []).push(f);
  });

  Object.entries(fichasPorGrupo).forEach(([grupo, fichasAusentes]) => {
    const bloquesAusentes = fichasAusentes
      .map(f => f.ubicacion.tipo === 'colocada' ? f.ubicacion.bloque : 0)
      .filter(b => b > 0)
      .sort((a, b) => a - b);
    if (bloquesAusentes.length === 0) return;

    const bloquesGrupo = (todasPorGrupo[grupo] ?? [])
      .map(f => f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : 0)
      .filter(b => b > 0);
    const minGrupo = Math.min(...bloquesGrupo);
    const maxGrupo = Math.max(...bloquesGrupo);

    const minAusente = bloquesAusentes[0];
    const maxAusente = bloquesAusentes[bloquesAusentes.length - 1];

    // Entrada tardía: los bloques ausentes son contiguos y empiezan en la 1ª
    // clase real del grupo ese día (no hay clases del grupo antes de ellos).
    const esContiguoDesdeInicio =
      minAusente === minGrupo &&
      bloquesAusentes.every((b, i) => b === minAusente + i);
    if (esContiguoDesdeInicio) {
      const proximoBloque = maxAusente + 1;
      propuestas.push({
        id: `entrada_tardia_${grupo}`,
        tipo: 'entrada_tardia',
        grupo,
        titulo: `${grupo}: entrada tardía`,
        descripcion: `Cancelar ${bloquesAusentes.map(b => `${b}.ª`).join(', ')} y entrar a la ${proximoBloque}.ª hora.`,
        cambios: fichasAusentes.map(f => ({
          fichaId: f.id,
          nuevaUbicacion: { tipo: 'eliminada' as const },
        })),
      });
    }

    // Salida temprana: bloques ausentes contiguos hasta el último bloque del grupo
    const esContiguoHastaFin =
      maxAusente === maxGrupo &&
      bloquesAusentes.every((b, i) => b === minAusente + i);
    if (esContiguoHastaFin && !esContiguoDesdeInicio) {
      propuestas.push({
        id: `salida_temprana_${grupo}`,
        tipo: 'salida_temprana',
        grupo,
        titulo: `${grupo}: salida temprana`,
        descripcion: `Cancelar ${bloquesAusentes.map(b => `${b}.ª`).join(', ')} y salir después de la ${minAusente - 1}.ª hora.`,
        cambios: fichasAusentes.map(f => ({
          fichaId: f.id,
          nuevaUbicacion: { tipo: 'eliminada' as const },
        })),
      });
    }

    // Compactación: el docente ausente tiene horas libres ANTES (o después) de
    // los bloques ausentes dentro del horario del grupo. Mueve las clases del
    // ausente a esas horas libres si no generan conflicto cruzado.
    const docenteId = fichasAusentes[0].origen.docente;
    const huecosDocente = encontrarHuecosDocente(fichas, docenteId, bloquesAusentes);
    if (huecosDocente.length >= bloquesAusentes.length) {
      // Validar que mover ahí no genere conflicto cruzado con el grupo
      const destinos = huecosDocente.slice(0, bloquesAusentes.length);
      const conflictoGrupo = destinos.some(b =>
        fichas.some(f =>
          f.origen.grupo === grupo &&
          f.origen.docente !== docenteId &&
          (f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller') &&
          (f.ubicacion.tipo === 'colocada' ? f.ubicacion.bloque : f.ubicacion.bloque) === b
        )
      );
      if (!conflictoGrupo) {
        propuestas.push({
          id: `compactar_${grupo}`,
          tipo: 'compactar',
          grupo,
          titulo: `${grupo}: compactar día`,
          descripcion: `Mover las clases del ausente a sus horas libres (${destinos.map(b => `${b}.ª`).join(', ')}).`,
          cambios: fichasAusentes.map((f, i) => ({
            fichaId: f.id,
            nuevaUbicacion: { tipo: 'colocada' as const, bloque: destinos[i] },
          })),
        });
      }
    }
  });

  return propuestas;
}

function encontrarHuecosDocente(
  fichas: FichaEditor[],
  docenteId: string,
  bloquesActuales: number[],
): number[] {
  const ocupados = new Set<number>();
  fichas.forEach(f => {
    if (f.origen.docente !== docenteId) return;
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    const b = f.ubicacion.tipo === 'colocada' ? f.ubicacion.bloque : f.ubicacion.bloque;
    if (!bloquesActuales.includes(b)) ocupados.add(b);
  });
  // El docente trabaja en bloques 1..6
  const huecos: number[] = [];
  for (let b = 1; b <= 6; b++) {
    if (!ocupados.has(b) && !bloquesActuales.includes(b)) huecos.push(b);
  }
  return huecos;
}

export function fichasAModificaciones(fichas: FichaEditor[]): ModificacionBloque[] {
  const mods: ModificacionBloque[] = [];
  fichas.forEach(f => {
    const original = f.origen.bloque;
    if (f.ubicacion.tipo === 'eliminada') {
      mods.push({
        bloqueOriginal: original,
        bloqueNuevo: null,
        docenteOriginal: f.origen.docente,
        grupo: f.origen.grupo,
        aula: f.origen.aula,
      });
    } else if (f.ubicacion.tipo === 'taller') {
      mods.push({
        bloqueOriginal: original,
        bloqueNuevo: f.ubicacion.bloque,
        docenteOriginal: f.origen.docente,
        grupo: f.origen.grupo,
        aula: f.origen.aula,
        esTaller: true,
        supervisorId: f.ubicacion.supervisorId,
      });
    } else if (f.ubicacion.tipo === 'colocada' && f.ubicacion.bloque !== original) {
      mods.push({
        bloqueOriginal: original,
        bloqueNuevo: f.ubicacion.bloque,
        docenteOriginal: f.origen.docente,
        grupo: f.origen.grupo,
        aula: f.origen.aula,
      });
    }
  });
  return mods;
}

