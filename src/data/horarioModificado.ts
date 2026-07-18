import { compararGrupos } from './maestros';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AusenciaDocente {
  docenteId: string;
  bloques: number[]; // lista de bloques afectados (todos los bloques del día si está completamente ausente)
  // ¿El docente estará en el colegio ese día (permiso parcial, comisión en la sede, etc.)?
  // undefined se trata como true (comportamiento histórico: el docente ausente se
  // considera disponible/libre en sus horas fuera de los bloques declarados ausentes).
  // Solo cuando es explícitamente false el docente se excluye por completo del día
  // como posible supervisor/apoyo.
  presenteEnColegio?: boolean;
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

// ── Jornada reducida (acortar día por acto cívico / reunión) ─────────────────

export interface BloqueRecalculado {
  id: number;
  inicio: string; // HH:MM
  fin: string;
}

export interface JornadaReducida {
  id: string;
  fecha: string;
  jornada: 'manana' | 'tarde';
  autor: string;
  horaInicio: string;    // hora de inicio de la jornada (HH:MM)
  horaFin: string;       // hora de fin de la jornada (HH:MM)
  motivo: string;        // ej. "Acto cívico", "Reunión de docentes"
  bloques: BloqueRecalculado[];
  numBloques?: number;    // cantidad de horas de clase dictadas (default 6 si no está presente)
  timestamp: string;
}

/** Inicio normal de cada jornada. */
export const INICIO_NORMAL = { manana: '06:00', tarde: '12:15' } as const;
export const FIN_NORMAL = { manana: '12:00', tarde: '18:15' } as const;

/** Convierte "HH:MM" a minutos desde medianoche. */
function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:MM". */
function aHhmm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Recalcula los 6 bloques manteniendo los descansos institucionales
 * (20 min después de la 2.ª y 10 min después de la 4.ª) y repartiendo
 * el tiempo restante equitativamente entre las clases.
 *
 * Acepta tanto la hora de inicio como la de fin. Si no se pasa inicio,
 * usa el inicio normal de la jornada (06:00 mañana / 12:15 tarde).
 */
export function recalcularBloquesAcortados(
  jornada: 'manana' | 'tarde',
  horaFin: string,
  horaInicio?: string,
  numBloques: number = 6,
): BloqueRecalculado[] | { error: string } {
  const inicioBase = horaInicio && horaInicio.trim() ? horaInicio : INICIO_NORMAL[jornada];
  const inicioMin = aMinutos(inicioBase);
  const finMin = aMinutos(horaFin);
  const totalMin = finMin - inicioMin;
  if (totalMin <= 0) {
    return { error: 'La hora de fin debe ser posterior a la hora de inicio.' };
  }
  const n = Math.min(6, Math.max(1, Math.round(numBloques)));
  // Descansos institucionales, ubicados proporcionalmente según cuántos bloques se dicten:
  //   n <= 2  → sin descanso
  //   n 3-4   → un descanso de 20 min tras el 2.º bloque
  //   n 5-6   → descanso de 20 min tras el 2.º y de 10 min tras el 4.º (igual que antes)
  const descansoTrasBloque2 = n >= 3 ? 20 : 0;
  const descansoTrasBloque4 = n >= 5 ? 10 : 0;
  const descansos = descansoTrasBloque2 + descansoTrasBloque4;
  const minutosClases = totalMin - descansos;
  const minMinutos = Math.max(60, n * 10);
  if (minutosClases < minMinutos) {
    return { error: `La jornada es demasiado corta para ${n} clase${n === 1 ? '' : 's'} con los descansos institucionales.` };
  }
  const duracionClase = Math.floor(minutosClases / n);
  // Repartir minutos residuales: dar el extra a las primeras clases
  const sobrante = minutosClases - duracionClase * n;

  const bloques: BloqueRecalculado[] = [];
  let cursor = inicioMin;
  for (let i = 1; i <= n; i++) {
    const dur = duracionClase + (i <= sobrante ? 1 : 0);
    const inicio = cursor;
    const fin = cursor + dur;
    bloques.push({ id: i, inicio: aHhmm(inicio), fin: aHhmm(fin) });
    cursor = fin;
    // Descanso después de 2 (20 min) y 4 (10 min), si aplica
    if (i === 2) cursor += descansoTrasBloque2;
    if (i === 4) cursor += descansoTrasBloque4;
  }
  return bloques;
}

export function generarIdJornadaReducida(): string {
  return `jr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Lista las jornadas reducidas vigentes hoy o en el futuro próximo. */
export function jornadasReducidasProximas(
  jornadas: JornadaReducida[],
  diasAdelante: number = 14,
): JornadaReducida[] {
  const hoy = fechaHoyLocal();
  const limite = new Date(hoy + 'T12:00:00');
  limite.setDate(limite.getDate() + diasAdelante);
  const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  return jornadas
    .filter(j => j.fecha >= hoy && j.fecha <= limiteStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Horario efectivo (aplicar modificaciones a un día) ───────────────────────

export interface EntradaEfectiva {
  jornada: string;
  dia: string;
  bloque: number;
  docente: string;
  grado: string;
  aula: string;
  esModificada: boolean;
  esTaller: boolean;
  bloqueOriginal?: number;     // si fue movida, dónde estaba antes
  supervisorId?: string;       // si es taller
}

/**
 * Cruza horarioBase con las modificaciones guardadas para una fecha+jornada
 * específicas y devuelve las entradas efectivas del día (clases que sí ocurren),
 * marcando cuáles fueron movidas, cancelaciones y talleres.
 */
export function aplicarModificacionesAlDia(
  fecha: string,
  jornada: 'manana' | 'tarde',
  horarioBase: EntradaHorarioBase[],
  horariosModificados: HorarioModificado[],
): EntradaEfectiva[] {
  const dia = diaDeSemana(fecha);
  const hm = horariosModificados.find(h =>
    h.fecha === fecha && h.jornada === jornada && h.estado === 'guardado'
  );

  const entradasBase = horarioBase
    .filter(e => e.jornada === jornada && e.dia === dia)
    .map(e => ({
      ...e,
      grado: e.grado.includes('/') ? e.grado.split('/')[0] : e.grado,
    }));

  if (!hm) {
    return entradasBase.map(e => ({
      jornada: e.jornada,
      dia: e.dia,
      bloque: e.bloque,
      docente: e.docente,
      grado: e.grado,
      aula: e.aula,
      esModificada: false,
      esTaller: false,
    }));
  }

  // Mapa por (docente_grupo_bloqueOriginal) → modificación
  const modPorEntrada = new Map<string, ModificacionBloque>();
  hm.modificaciones.forEach(mod => {
    const key = `${mod.docenteOriginal}_${mod.grupo}_${mod.bloqueOriginal}`;
    modPorEntrada.set(key, mod);
  });

  const resultado: EntradaEfectiva[] = [];

  for (const e of entradasBase) {
    const key = `${e.docente}_${e.grado}_${e.bloque}`;
    const mod = modPorEntrada.get(key);
    if (!mod) {
      // Sin modificación → entrada base tal cual
      resultado.push({
        jornada: e.jornada,
        dia: e.dia,
        bloque: e.bloque,
        docente: e.docente,
        grado: e.grado,
        aula: e.aula,
        esModificada: false,
        esTaller: false,
      });
      continue;
    }
    if (mod.bloqueNuevo === null) continue; // eliminada
    // Movida o convertida en taller
    resultado.push({
      jornada: e.jornada,
      dia: e.dia,
      bloque: mod.bloqueNuevo,
      docente: e.docente,
      grado: e.grado,
      aula: e.aula,
      esModificada: mod.bloqueNuevo !== e.bloque,
      esTaller: mod.esTaller ?? false,
      bloqueOriginal: mod.bloqueNuevo !== e.bloque ? e.bloque : undefined,
      supervisorId: mod.supervisorId,
    });
  }

  return resultado.sort((a, b) => a.bloque - b.bloque);
}

/** Lista las modificaciones guardadas vigentes hoy o en el futuro próximo. */
export function modificacionesProximas(
  horariosModificados: HorarioModificado[],
  diasAdelante: number = 14,
): HorarioModificado[] {
  const hoy = fechaHoyLocal();
  const limite = new Date(hoy + 'T12:00:00');
  limite.setDate(limite.getDate() + diasAdelante);
  const limiteStr = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  return horariosModificados
    .filter(h => h.estado === 'guardado' && h.fecha >= hoy && h.fecha <= limiteStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
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
  // presenteEnColegio undefined ⇒ true (comportamiento histórico: disponible fuera
  // de los bloques declarados ausentes). Solo presenteEnColegio === false excluye
  // al docente del día completo (no está en la sede, no puede supervisar nada).
  const excluidosTodoElDia = new Set(
    ausencias.filter(a => a.presenteEnColegio === false).map(a => a.docenteId)
  );
  const ausentesEnBloque = new Set(
    ausencias
      .filter(a => a.presenteEnColegio !== false && a.bloques.includes(bloque))
      .map(a => a.docenteId)
  );
  return candidatos.filter(d =>
    !ocupados.has(d.id) && !excluidosTodoElDia.has(d.id) && !ausentesEnBloque.has(d.id)
  );
}

/**
 * Convierte las fichas del editor en modificaciones para persistir.
 * Solo se guardan las fichas cuyo estado cambió respecto al origen.
 */
// ── Asistente de alternativas automáticas ────────────────────────────────────

export type TipoPropuesta =
  | 'compactar'           // mover clases del ausente a sus horas libres
  | 'apoyo_taller'        // cubrir el bloque con un apoyo declarado
  | 'entrada_tardia'      // cancelar los primeros bloques afectados
  | 'salida_temprana'     // cancelar los últimos bloques afectados
  | 'mixta_jornada';      // entrada tardía + salida temprana combinadas

export type NivelPropuesta = 1 | 2 | 3;

export interface PropuestaAsistente {
  id: string;
  tipo: TipoPropuesta;
  nivel: NivelPropuesta;
  prioridad: number;       // dentro del nivel, menor = más prioritario
  grupo: string;
  titulo: string;
  descripcion: string;
  // Bloques del grupo que quedan cancelados si se aplica esta propuesta.
  // 0 en compactación pura y en apoyos; > 0 en entrada tardía / salida temprana.
  clasesPerdidas: number;
  // Cambios a aplicar como mapa fichaId → nueva ubicación
  cambios: Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }>;
}

/**
 * Genera propuestas automáticas para resolver las ausencias del borrador,
 * agrupadas en 3 niveles de prioridad:
 *
 *   Nivel 1 — Reorganizar el día (mínima pérdida de clases)
 *             ▸ compactar: mover clases del ausente a sus horas libres
 *
 *   Nivel 2 — Aprovechar apoyos disponibles (PTA, UAI, docente de apoyo,
 *             taller) registrados en el wizard
 *
 *   Nivel 3 — Modificar entrada o salida del grupo
 *             ▸ mañana → prioriza entrada tardía
 *             ▸ tarde  → prioriza salida temprana
 *
 * Las propuestas NO son excluyentes ni se filtran entre sí: el coordinador
 * decide cuál aplicar.
 */
export function generarPropuestasAsistente(
  fichas: FichaEditor[],
  borrador: HorarioModificado
): PropuestaAsistente[] {
  const propuestas: PropuestaAsistente[] = [];
  const esManana = borrador.jornada === 'manana';
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

    // ── NIVEL 1: REORGANIZAR CON CASCADAS DE INTERCAMBIO ──────────────────
    // Busca una cadena de movimientos entre los docentes del grupo afectado
    // tal que cada uno termine en una hora donde está disponible y el grupo
    // no pierda ninguna clase. Si la encuentra, propone aplicarla en bloque.
    const cascadas = buscarCompactacionCascadaMultiple(fichas, borrador, grupo, 3);
    cascadas.forEach((cascada, idx) => {
      // Texto descriptivo: agrupar movimientos por docente
      const porDocente = new Map<string, Array<{ desde: number; hasta: number }>>();
      cascada.forEach(m => {
        const ficha = fichas.find(f => f.id === m.fichaId)!;
        const arr = porDocente.get(ficha.origen.docente) ?? [];
        arr.push({ desde: m.desdeBloque, hasta: m.hastaBloque });
        porDocente.set(ficha.origen.docente, arr);
      });
      const lineas = Array.from(porDocente.entries()).map(([docId, movs]) => {
        const nombre = USUARIO_NOMBRE_FN ? USUARIO_NOMBRE_FN(docId) : docId;
        const detalle = movs
          .sort((a, b) => a.desde - b.desde)
          .map(m => `${m.desde}.ª → ${m.hasta}.ª`)
          .join(', ');
        return `${nombre}: ${detalle}`;
      });
      const sufijoOpcion = cascadas.length > 1 ? ` — opción ${idx + 1}` : '';
      propuestas.push({
        id: `cascada_${grupo}_${idx}`,
        tipo: 'compactar',
        nivel: 1,
        prioridad: idx,
        grupo,
        titulo: `Reorganizar el día de ${grupo} (${cascada.length} ${cascada.length === 1 ? 'movimiento' : 'movimientos'})${sufijoOpcion}`,
        descripcion: `El grupo no pierde ninguna clase. Cadena de intercambios: ${lineas.join(' · ')}.`,
        clasesPerdidas: 0,
        cambios: cascada.map(m => ({
          fichaId: m.fichaId,
          nuevaUbicacion: { tipo: 'colocada' as const, bloque: m.hastaBloque },
        })),
      });
    });

    // ── NIVEL 2: USAR APOYOS DISPONIBLES ──────────────────────────────────
    // Para cada apoyo declarado en el borrador, ver qué bloques ausentes
    // cubre y proponer marcarlos como taller con ese apoyo como supervisor.
    borrador.apoyos.forEach(apoyo => {
      const bloquesCubiertos = bloquesAusentes.filter(b => apoyo.bloques.includes(b));
      if (bloquesCubiertos.length === 0) return;
      const fichasCubiertas = fichasAusentes.filter(f =>
        bloquesCubiertos.includes(f.origen.bloque)
      );
      propuestas.push({
        id: `apoyo_${apoyo.id}_${grupo}`,
        tipo: 'apoyo_taller',
        nivel: 2,
        prioridad: 0,
        grupo,
        titulo: `Cubrir con ${apoyo.nombre} (${apoyo.tipo === 'taller' ? 'taller' : TIPO_APOYO_LABEL[apoyo.tipo]})`,
        descripcion: bloquesCubiertos.length === bloquesAusentes.length
          ? `${grupo}: las clases de ${bloquesCubiertos.map(b => `${b}.ª`).join(', ')} quedan con ${apoyo.nombre}. El grupo cumple jornada completa.`
          : `${grupo}: ${apoyo.nombre} cubre ${bloquesCubiertos.map(b => `${b}.ª`).join(', ')}. Quedan ${bloquesAusentes.length - bloquesCubiertos.length} bloque(s) por resolver.`,
        clasesPerdidas: 0,
        cambios: fichasCubiertas.map(f => ({
          fichaId: f.id,
          nuevaUbicacion: {
            tipo: 'taller' as const,
            bloque: f.origen.bloque,
            // apoyo.id no corresponde a un usuario; lo guardamos como referencia
            // textual via descripción. supervisorId queda undefined a propósito.
          },
        })),
      });
    });

    // ── NIVEL 3: AJUSTES DE JORNADA (entrada tardía / salida temprana / mixta) ──
    // En mañana se prioriza entrada tardía; en tarde, salida temprana.
    // Ofrece TODAS las variantes viables: pura(s) y, si aplica, la combinación
    // mixta que preserva un tramo intermedio limpio entre dos rachas de ausencia.
    const fichasGrupoTodas = todasPorGrupo[grupo] ?? [];
    const alternativasJornada = generarAlternativasJornada(
      fichas, borrador, grupo, fichasGrupoTodas, fichasAusentes,
      bloquesAusentes, minGrupo, maxGrupo, esManana,
    );
    propuestas.push(...alternativasJornada);
  });

  // Ordenar por nivel y luego prioridad
  return propuestas.sort((a, b) => a.nivel - b.nivel || a.prioridad - b.prioridad);
}

/**
 * Genera las variantes de ajuste de jornada (entrada tardía / salida temprana /
 * mixta) para un grupo con bloques ausentes. Intenta reducir la pérdida real
 * reubicando las clases "colaterales" (no causadas por la ausencia) que caen
 * dentro del tramo que se cancela, hacia huecos libres del tramo que se
 * conserva. Devuelve hasta 6 alternativas, ordenadas por menor pérdida y
 * menor número de movimientos.
 */
function generarAlternativasJornada(
  fichas: FichaEditor[],
  borrador: HorarioModificado,
  grupo: string,
  fichasGrupoTodas: FichaEditor[],
  fichasAusentes: FichaEditor[],
  bloquesAusentes: number[],
  minGrupo: number,
  maxGrupo: number,
  esManana: boolean,
): PropuestaAsistente[] {
  if (bloquesAusentes.length === 0) return [];

  const minAusente = bloquesAusentes[0];
  const maxAusente = bloquesAusentes[bloquesAusentes.length - 1];

  const bloquesAusentesPorDoc: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    bloquesAusentesPorDoc[a.docenteId] = new Set(a.bloques);
  });
  const esAusenteEnBloque = (docId: string, bloque: number) =>
    bloquesAusentesPorDoc[docId]?.has(bloque) ?? false;

  // Ocupación fija de otros grupos (para no chocar al reubicar colaterales)
  const ocupacionFijaPorDoc: Record<string, Set<number>> = {};
  fichas.forEach(f => {
    if (f.origen.grupo === grupo) return;
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    (ocupacionFijaPorDoc[f.origen.docente] ??= new Set()).add(f.ubicacion.bloque);
  });

  const bloqueDeFicha = (f: FichaEditor): number =>
    f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : -1;

  const ocupadosGrupo = new Set(fichasGrupoTodas.map(bloqueDeFicha));

  /**
   * Intenta vaciar el rango [rangoLo, rangoHi] moviendo las fichas colaterales
   * (no causadas por ausencia) hacia `targets` (bloques del rango que se
   * conserva), en orden de preferencia. Las fichas que sí son la causa de la
   * ausencia no se intentan mover (el docente no está).
   */
  function intentarLiberarRango(
    rangoLo: number,
    rangoHi: number,
    targets: number[],
  ): { movidos: Array<{ ficha: FichaEditor; destino: number }>; irreductibles: FichaEditor[] } {
    const movidos: Array<{ ficha: FichaEditor; destino: number }> = [];
    const irreductibles: FichaEditor[] = [];
    const targetsUsados = new Set<number>();

    const fichasEnRango = fichasGrupoTodas.filter(f => {
      const b = bloqueDeFicha(f);
      return b >= rangoLo && b <= rangoHi;
    });

    for (const f of fichasEnRango) {
      const bAct = bloqueDeFicha(f);
      if (esAusenteEnBloque(f.origen.docente, bAct)) continue; // se cancela de todas formas
      const destino = targets.find(t =>
        !targetsUsados.has(t) &&
        !ocupadosGrupo.has(t) &&
        !esAusenteEnBloque(f.origen.docente, t) &&
        !(ocupacionFijaPorDoc[f.origen.docente]?.has(t))
      );
      if (destino !== undefined) {
        movidos.push({ ficha: f, destino });
        targetsUsados.add(destino);
      } else {
        irreductibles.push(f);
      }
    }
    return { movidos, irreductibles };
  }

  const nombreDoc = (id: string) => (USUARIO_NOMBRE_FN ? USUARIO_NOMBRE_FN(id) : id);

  function describirMovidos(movidos: Array<{ ficha: FichaEditor; destino: number }>): string {
    if (movidos.length === 0) return '';
    const detalle = movidos
      .map(m => `mover ${nombreDoc(m.ficha.origen.docente)} de ${bloqueDeFicha(m.ficha)}.ª a ${m.destino}.ª`)
      .join(' + ');
    return detalle;
  }

  function construirCambios(
    canceladas: FichaEditor[],
    movidos: Array<{ ficha: FichaEditor; destino: number }>,
    irreductibles: FichaEditor[],
  ): Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }> {
    const cambios: Array<{ fichaId: string; nuevaUbicacion: UbicacionFicha }> = [];
    canceladas.forEach(f => cambios.push({ fichaId: f.id, nuevaUbicacion: { tipo: 'eliminada' } }));
    irreductibles.forEach(f => cambios.push({ fichaId: f.id, nuevaUbicacion: { tipo: 'eliminada' } }));
    movidos.forEach(m => cambios.push({
      fichaId: m.ficha.id,
      nuevaUbicacion: { tipo: 'colocada', bloque: m.destino },
    }));
    return cambios;
  }

  const alternativas: PropuestaAsistente[] = [];

  // ── ENTRADA TARDÍA: vaciar [minGrupo, maxAusente], mover colaterales a (maxAusente, maxGrupo] ──
  {
    const targets: number[] = [];
    for (let b = maxAusente + 1; b <= maxGrupo; b++) targets.push(b);
    const { movidos, irreductibles } = intentarLiberarRango(minGrupo, maxAusente, targets);
    const proximoBloque = maxAusente + 1;
    const perdidas = bloquesAusentes.length + irreductibles.length;
    const detalleMov = describirMovidos(movidos);
    alternativas.push({
      id: `entrada_tardia_${grupo}`,
      tipo: 'entrada_tardia',
      nivel: 3,
      prioridad: esManana ? 0 : 1,
      grupo,
      titulo: `${grupo}: entrada a la ${proximoBloque}.ª hora`,
      descripcion: detalleMov
        ? `${grupo} entra a la ${proximoBloque}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}). Antes se ${detalleMov}.`
        : `${grupo} entra a la ${proximoBloque}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}).`,
      clasesPerdidas: perdidas,
      cambios: construirCambios(fichasAusentes, movidos, irreductibles),
    });
  }

  // ── SALIDA TEMPRANA: vaciar [minAusente, maxGrupo], mover colaterales a [minGrupo, minAusente) ──
  {
    const targets: number[] = [];
    for (let b = minAusente - 1; b >= minGrupo; b--) targets.push(b);
    const { movidos, irreductibles } = intentarLiberarRango(minAusente, maxGrupo, targets);
    const perdidas = bloquesAusentes.length + irreductibles.length;
    const detalleMov = describirMovidos(movidos);
    alternativas.push({
      id: `salida_temprana_${grupo}`,
      tipo: 'salida_temprana',
      nivel: 3,
      prioridad: esManana ? 1 : 0,
      grupo,
      titulo: `${grupo}: salida a la ${minAusente}.ª hora`,
      descripcion: detalleMov
        ? `${grupo} sale a la ${minAusente}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}). Antes se ${detalleMov}.`
        : `${grupo} sale a la ${minAusente}.ª hora (pierde ${perdidas} clase${perdidas === 1 ? '' : 's'}).`,
      clasesPerdidas: perdidas,
      cambios: construirCambios(fichasAusentes, movidos, irreductibles),
    });
  }

  // ── MIXTA: si hay ≥2 rachas de ausencia con un tramo intermedio limpio,
  //           recorta ambos extremos y conserva el tramo del medio.
  const rachas: number[][] = [];
  bloquesAusentes.forEach(b => {
    const ultima = rachas[rachas.length - 1];
    if (ultima && b === ultima[ultima.length - 1] + 1) ultima.push(b);
    else rachas.push([b]);
  });
  if (rachas.length >= 2) {
    const racha1 = rachas[0];
    const rachaN = rachas[rachas.length - 1];
    const cut1 = racha1[racha1.length - 1];   // último bloque de la racha inicial
    const cut2 = rachaN[0];                    // primer bloque de la racha final
    if (cut1 < cut2 - 1) {
      const targetsMedio: number[] = [];
      for (let b = cut1 + 1; b <= cut2 - 1; b++) targetsMedio.push(b);
      const liberoInicio = intentarLiberarRango(minGrupo, cut1, targetsMedio);
      const liberoFin = intentarLiberarRango(cut2, maxGrupo, targetsMedio.filter(
        t => !liberoInicio.movidos.some(m => m.destino === t)
      ));
      const canceladasMixta = fichasAusentes; // todas siguen canceladas: el docente no está
      const irreductiblesMixta = [...liberoInicio.irreductibles, ...liberoFin.irreductibles];
      const movidosMixta = [...liberoInicio.movidos, ...liberoFin.movidos];
      const perdidas = bloquesAusentes.length + irreductiblesMixta.length;
      const proximoBloque = cut1 + 1;
      const detalleMov = describirMovidos(movidosMixta);
      alternativas.push({
        id: `mixta_${grupo}`,
        tipo: 'mixta_jornada',
        nivel: 3,
        prioridad: 0.5,
        grupo,
        titulo: `${grupo}: entra a la ${proximoBloque}.ª y sale a la ${cut2}.ª hora`,
        descripcion: detalleMov
          ? `${grupo} entra a la ${proximoBloque}.ª hora y sale a la ${cut2}.ª hora, conservando ${cut2 - cut1 - 1} clase${cut2 - cut1 - 1 === 1 ? '' : 's'} intermedia(s) (pierde ${perdidas} en total). Antes se ${detalleMov}.`
          : `${grupo} entra a la ${proximoBloque}.ª hora y sale a la ${cut2}.ª hora, conservando ${cut2 - cut1 - 1} clase${cut2 - cut1 - 1 === 1 ? '' : 's'} intermedia(s) (pierde ${perdidas} en total).`,
        clasesPerdidas: perdidas,
        cambios: construirCambios(canceladasMixta, movidosMixta, irreductiblesMixta),
      });
    }
  }

  // Cap y orden: menos pérdida primero, luego menos movimientos.
  return alternativas
    .sort((a, b) => a.clasesPerdidas - b.clasesPerdidas || a.cambios.length - b.cambios.length)
    .slice(0, 6);
}

// Inyectable desde el componente para enriquecer descripciones con nombres
let USUARIO_NOMBRE_FN: ((id: string) => string) | null = null;
export function configurarResolverNombreDocente(fn: (id: string) => string) {
  USUARIO_NOMBRE_FN = fn;
}

// ── Generación de resumen para difundir ─────────────────────────────────────

const HORAS_MANANA = ['06:00', '06:55', '08:10', '09:05', '10:10', '11:05'];
const HORAS_TARDE  = ['12:15', '13:10', '14:25', '15:20', '16:25', '17:20'];

export interface DocenteAfectadoResumen {
  id: string;
  nombre: string;
  nombreCorto: string;
  correo: string;
  motivo: string; // 'ausente' | 'clase movida' | 'supervisor de taller'
}

export interface ResumenDifusion {
  html: string;
  texto: string;
  docentesAfectados: DocenteAfectadoResumen[];
}

export function generarResumenDifusion(
  borrador: HorarioModificado,
  fichas: FichaEditor[],
  usuarios: Array<{ id: string; nombre: string; nombreCorto: string; correo: string }>,
): ResumenDifusion {
  const fechaLegible = formatearFechaLegible(borrador.fecha);
  const jornadaTxt = borrador.jornada === 'manana' ? 'mañana' : 'tarde';
  const horas = borrador.jornada === 'manana' ? HORAS_MANANA : HORAS_TARDE;

  // Agrupar fichas (visibles tras edición) por grupo
  const fichasPorGrupo: Record<string, FichaEditor[]> = {};
  fichas.forEach(f => {
    if (f.ubicacion.tipo === 'eliminada' || f.ubicacion.tipo === 'pendiente') return;
    (fichasPorGrupo[f.origen.grupo] ??= []).push(f);
  });

  // Detectar grupos afectados (los que tuvieron al menos una modificación)
  const gruposAfectados = new Set<string>();
  const ausenteIdsPorBloque: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    ausenteIdsPorBloque[a.docenteId] = new Set(a.bloques);
  });
  fichas.forEach(f => {
    if (ausenteIdsPorBloque[f.origen.docente]?.has(f.origen.bloque)) {
      gruposAfectados.add(f.origen.grupo);
    }
  });

  // ── HTML ─────────────────────────────────────────────────────────────────
  const htmlPartes: string[] = [];
  htmlPartes.push(`<div style="font-family:Arial,sans-serif;max-width:600px;color:#1f2937">`);
  htmlPartes.push(`<h2 style="margin:0 0 4px 0;color:#1e3a8a">I.E. Manuel J. Betancur — Modificación de horario</h2>`);
  htmlPartes.push(`<p style="margin:0 0 16px 0;color:#475569"><strong>${fechaLegible}</strong> · Jornada ${jornadaTxt}</p>`);

  const textoPartes: string[] = [];
  textoPartes.push(`*MJB — Modificación de horario*`);
  textoPartes.push(`${fechaLegible} · Jornada ${jornadaTxt}`);
  textoPartes.push('');

  // Por cada grupo afectado, listar el horario resultante
  Array.from(gruposAfectados).sort(compararGrupos).forEach(grupo => {
    const colocadas = (fichasPorGrupo[grupo] ?? [])
      .filter(f => f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller')
      .sort((a, b) => {
        const ba = a.ubicacion.tipo === 'colocada' || a.ubicacion.tipo === 'taller' ? a.ubicacion.bloque : 0;
        const bb = b.ubicacion.tipo === 'colocada' || b.ubicacion.tipo === 'taller' ? b.ubicacion.bloque : 0;
        return ba - bb;
      });
    const eliminadas = fichas
      .filter(f => f.origen.grupo === grupo && f.ubicacion.tipo === 'eliminada')
      .map(f => f.origen.bloque)
      .sort((a, b) => a - b);

    // ── Aviso de ajuste de jornada (entrada tardía / salida temprana) ─────
    // Se deriva de las modificaciones FINALES (cancelaciones aplicadas), no
    // de la propuesta usada, para cubrir también ediciones manuales equivalentes.
    let avisoJornada: string | null = null;
    if (eliminadas.length > 0) {
      const bloquesGrupoOrigen = fichas
        .filter(f => f.origen.grupo === grupo)
        .map(f => f.origen.bloque);
      const minTotal = Math.min(...bloquesGrupoOrigen);
      const maxTotal = Math.max(...bloquesGrupoOrigen);
      const esPrefijo = eliminadas[0] === minTotal &&
        eliminadas.every((b, i) => b === minTotal + i);
      const esSufijo = !esPrefijo && eliminadas[eliminadas.length - 1] === maxTotal &&
        eliminadas.every((b, i) => b === eliminadas[0] + i);
      if (esPrefijo) {
        const proximoBloque = eliminadas[eliminadas.length - 1] + 1;
        const hora = horas[proximoBloque - 1] ?? '';
        avisoJornada = `📣 El grupo ${grupo} entra a la ${proximoBloque}.ª hora (${hora})`;
      } else if (esSufijo) {
        const primerCancelado = eliminadas[0];
        const hora = horas[primerCancelado - 1] ?? '';
        avisoJornada = `📣 El grupo ${grupo} sale a la ${primerCancelado}.ª hora (${hora})`;
      }
    }

    // HTML
    htmlPartes.push(`<h3 style="margin:16px 0 6px 0;color:#1f2937;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${grupo}</h3>`);
    if (avisoJornada) {
      htmlPartes.push(`<p style="margin:0 0 8px 0;padding:6px 10px;background:#fef3c7;border-left:3px solid #d97706;color:#92400e;font-size:13px;font-weight:600">${avisoJornada}</p>`);
    }
    htmlPartes.push(`<table style="width:100%;border-collapse:collapse;font-size:13px">`);
    htmlPartes.push(`<thead><tr style="background:#f3f4f6">`);
    htmlPartes.push(`<th style="text-align:left;padding:6px 8px;border:1px solid #e5e7eb">Hora</th>`);
    htmlPartes.push(`<th style="text-align:left;padding:6px 8px;border:1px solid #e5e7eb">Docente</th>`);
    htmlPartes.push(`<th style="text-align:left;padding:6px 8px;border:1px solid #e5e7eb">Aula</th>`);
    htmlPartes.push(`</tr></thead><tbody>`);

    colocadas.forEach(f => {
      const bloque = f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : 0;
      const docente = usuarios.find(u => u.id === f.origen.docente)?.nombreCorto ?? f.origen.docente;
      const hora = horas[bloque - 1] ?? '';
      const esTaller = f.ubicacion.tipo === 'taller';
      const supId = f.ubicacion.tipo === 'taller' ? f.ubicacion.supervisorId : undefined;
      const supervisor = supId ? usuarios.find(u => u.id === supId)?.nombreCorto : undefined;
      const docTexto = esTaller
        ? `Taller dejado por ${docente}${supervisor ? ` · supervisa ${supervisor}` : ''}`
        : docente;
      const movida = bloque !== f.origen.bloque;
      const estilo = esTaller ? 'background:#fef3c7' : movida ? 'background:#dbeafe' : '';
      htmlPartes.push(`<tr style="${estilo}">`);
      htmlPartes.push(`<td style="padding:6px 8px;border:1px solid #e5e7eb">${bloque}.ª (${hora})</td>`);
      htmlPartes.push(`<td style="padding:6px 8px;border:1px solid #e5e7eb">${docTexto}</td>`);
      htmlPartes.push(`<td style="padding:6px 8px;border:1px solid #e5e7eb">${f.origen.aula}</td>`);
      htmlPartes.push(`</tr>`);
    });
    htmlPartes.push(`</tbody></table>`);
    if (eliminadas.length > 0) {
      htmlPartes.push(`<p style="margin:6px 0 0 0;color:#b91c1c;font-size:12px"><strong>Bloques sin clase:</strong> ${eliminadas.map(b => `${b}.ª`).join(', ')}</p>`);
    }

    // Texto
    textoPartes.push(`*${grupo}*`);
    if (avisoJornada) {
      textoPartes.push(avisoJornada);
    }
    colocadas.forEach(f => {
      const bloque = f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller' ? f.ubicacion.bloque : 0;
      const docente = usuarios.find(u => u.id === f.origen.docente)?.nombreCorto ?? f.origen.docente;
      const hora = horas[bloque - 1] ?? '';
      const esTaller = f.ubicacion.tipo === 'taller';
      const supId = f.ubicacion.tipo === 'taller' ? f.ubicacion.supervisorId : undefined;
      const supervisor = supId ? usuarios.find(u => u.id === supId)?.nombreCorto : undefined;
      const marca = esTaller ? ' 🟡' : (bloque !== f.origen.bloque ? ' 🔵' : '');
      const docTexto = esTaller
        ? `Taller (${docente})${supervisor ? ` con ${supervisor}` : ''}`
        : docente;
      textoPartes.push(`${bloque}.ª ${hora} — ${docTexto} · ${f.origen.aula}${marca}`);
    });
    if (eliminadas.length > 0) {
      textoPartes.push(`❌ Sin clase: ${eliminadas.map(b => `${b}.ª`).join(', ')}`);
    }
    textoPartes.push('');
  });

  htmlPartes.push(`<p style="margin-top:20px;font-size:11px;color:#94a3b8">Generado por MJB Préstamos</p>`);
  htmlPartes.push(`</div>`);
  textoPartes.push('— MJB Préstamos');

  // ── Docentes afectados ─────────────────────────────────────────────────────
  const docentesAfectadosMap = new Map<string, DocenteAfectadoResumen>();

  // (1) los declarados ausentes
  borrador.ausencias.forEach(a => {
    const u = usuarios.find(x => x.id === a.docenteId);
    if (u && !docentesAfectadosMap.has(u.id)) {
      docentesAfectadosMap.set(u.id, {
        id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
        motivo: 'ausente',
      });
    }
  });

  // (2) docentes con alguna clase movida (origen distinto de actual)
  fichas.forEach(f => {
    if (f.ubicacion.tipo === 'colocada' && f.ubicacion.bloque !== f.origen.bloque) {
      const u = usuarios.find(x => x.id === f.origen.docente);
      if (u && !docentesAfectadosMap.has(u.id)) {
        docentesAfectadosMap.set(u.id, {
          id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
          motivo: 'clase movida',
        });
      }
    }
  });

  // (3) supervisores de taller
  fichas.forEach(f => {
    const supId = f.ubicacion.tipo === 'taller' ? f.ubicacion.supervisorId : undefined;
    if (supId) {
      const u = usuarios.find(x => x.id === supId);
      if (u && !docentesAfectadosMap.has(u.id)) {
        docentesAfectadosMap.set(u.id, {
          id: u.id, nombre: u.nombre, nombreCorto: u.nombreCorto, correo: u.correo,
          motivo: 'supervisor de taller',
        });
      }
    }
  });

  return {
    html: htmlPartes.join('\n'),
    texto: textoPartes.join('\n'),
    docentesAfectados: Array.from(docentesAfectadosMap.values()),
  };
}

interface MovCascada {
  fichaId: string;
  desdeBloque: number;
  hastaBloque: number;
}

/**
 * Busca por backtracking una cadena de movimientos entre los docentes
 * del grupo afectado, tal que las clases del docente ausente queden
 * en sus horas libres (no ausentes) y todas las otras clases del grupo
 * se preserven en bloques donde cada respectivo docente esté disponible.
 *
 * Caso típico: A falta en 5.ª-6.ª con grupo G. A tiene libres 1.ª-2.ª.
 * En 1.ª-2.ª, G está con B. B tiene libres 3.ª-4.ª.
 * En 3.ª-4.ª, G está con C. C tiene libres 5.ª-6.ª.
 * Resultado: B pasa a 3-4, C pasa a 5-6, A pasa a 1-2.
 *
 * Devuelve un arreglo vacío si no encuentra ninguna cadena viable. Tiene cap
 * de profundidad para evitar explosión combinatoria.
 *
 * `buscarCompactacionCascadaMultiple` explora el mismo espacio de estados
 * pero sin detenerse en la primera solución encontrada: continúa el
 * backtracking (con memoización por estado, igual que antes) hasta acumular
 * hasta `maxSoluciones` cadenas DISTINTAS (distintas en el conjunto final de
 * fichaId→bloque), o hasta agotar el árbol de búsqueda / el cap de profundidad.
 */
function buscarCompactacionCascadaMultiple(
  fichas: FichaEditor[],
  borrador: HorarioModificado,
  grupo: string,
  maxSoluciones: number = 3,
): MovCascada[][] {
  const bloquesAusentesPorDoc: Record<string, Set<number>> = {};
  borrador.ausencias.forEach(a => {
    bloquesAusentesPorDoc[a.docenteId] = new Set(a.bloques);
  });

  // Fichas del grupo cuyas ubicaciones pueden cambiar durante la búsqueda
  const fichasGrupo = fichas.filter(f =>
    f.origen.grupo === grupo &&
    (f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller')
  );
  if (fichasGrupo.length === 0) return [];

  // Ubicación inicial de cada ficha del grupo
  const ubicacionInicial: Record<string, number> = {};
  fichasGrupo.forEach(f => {
    ubicacionInicial[f.id] = f.ubicacion.tipo === 'colocada' || f.ubicacion.tipo === 'taller'
      ? f.ubicacion.bloque : 0;
  });

  // Fichas iniciales por mover: aquellas en bloques ausentes de su docente
  const iniciales = fichasGrupo.filter(f => {
    const b = ubicacionInicial[f.id];
    return bloquesAusentesPorDoc[f.origen.docente]?.has(b);
  });
  if (iniciales.length === 0) return [];

  // Fichas "fijas" (no pertenecen al grupo): mapa docente → set de bloques ocupados
  const ocupacionFijaPorDoc: Record<string, Set<number>> = {};
  fichas.forEach(f => {
    if (f.origen.grupo === grupo) return;
    if (f.ubicacion.tipo !== 'colocada' && f.ubicacion.tipo !== 'taller') return;
    const b = f.ubicacion.bloque;
    (ocupacionFijaPorDoc[f.origen.docente] ??= new Set()).add(b);
  });

  function huecosDocente(docenteId: string, ubicaciones: Record<string, number>): number[] {
    const ocupados = new Set<number>(ocupacionFijaPorDoc[docenteId] ?? []);
    fichasGrupo.forEach(f => {
      if (f.origen.docente !== docenteId) return;
      const b = ubicaciones[f.id];
      if (b > 0) ocupados.add(b);
    });
    const ausentes = bloquesAusentesPorDoc[docenteId] ?? new Set();
    const huecos: number[] = [];
    for (let b = 1; b <= 6; b++) {
      if (!ocupados.has(b) && !ausentes.has(b)) huecos.push(b);
    }
    return huecos;
  }

  const visitados = new Set<string>();
  function claveEstado(ub: Record<string, number>, restantes: string[]): string {
    return Object.entries(ub).sort().map(([k, v]) => `${k}:${v}`).join('|') + '#' + restantes.sort().join(',');
  }

  const solucionesEncontradas: Record<string, number>[] = [];

  function intentar(
    ubicaciones: Record<string, number>,
    porMover: FichaEditor[],
    depth: number,
  ): void {
    if (solucionesEncontradas.length >= maxSoluciones) return;
    if (depth > 20) return;
    if (porMover.length === 0) {
      solucionesEncontradas.push(ubicaciones);
      return;
    }

    const key = claveEstado(ubicaciones, porMover.map(f => f.id));
    if (visitados.has(key)) return;
    visitados.add(key);

    const f = porMover[0];
    const resto = porMover.slice(1);
    const huecos = huecosDocente(f.origen.docente, ubicaciones);

    for (const h of huecos) {
      if (solucionesEncontradas.length >= maxSoluciones) return;
      // Si el nuevo bloque es el mismo que el actual, no es un movimiento real
      if (ubicaciones[f.id] === h) continue;

      // ¿Hay otra ficha del grupo ya en h?
      const ocupante = fichasGrupo.find(x =>
        x.id !== f.id && ubicaciones[x.id] === h
      );

      const nuevasUbicaciones = { ...ubicaciones, [f.id]: h };
      const nuevoPorMover = ocupante && !resto.includes(ocupante)
        ? [ocupante, ...resto]
        : resto;

      intentar(nuevasUbicaciones, nuevoPorMover, depth + 1);
    }
  }

  intentar(ubicacionInicial, iniciales, 0);
  if (solucionesEncontradas.length === 0) return [];

  const vistos = new Set<string>();
  const resultados: MovCascada[][] = [];
  for (const solucion of solucionesEncontradas) {
    const movimientos: MovCascada[] = [];
    fichasGrupo.forEach(f => {
      const original = ubicacionInicial[f.id];
      const finalB = solucion[f.id];
      if (finalB !== original) {
        movimientos.push({
          fichaId: f.id,
          desdeBloque: original,
          hastaBloque: finalB,
        });
      }
    });
    if (movimientos.length === 0) continue;
    // Deduplicar cadenas equivalentes (mismo conjunto final fichaId→bloque)
    const clave = movimientos.map(m => `${m.fichaId}:${m.hastaBloque}`).sort().join('|');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultados.push(movimientos);
  }
  return resultados;
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

